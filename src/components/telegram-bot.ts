'use strict';

import * as assert from 'assert';
import { StringUtils } from './utils.js';

import Application from '../application';
import BaseComponent from './base-component';
import TelegramBotConfig from '../config/telegram-config.js';
import { Telegraf } from 'telegraf'
import MQTTClient from './mqtt-client.js';
import MQTTEventsConfig from '../config/mqtt-events-config.js';
import MQTTMessage from './mqtt-message.js';
import MQTTSubscription from './mqtt-subscription.js';
import MQTTAlert from './mqtt-alert.js';
import { runInThisContext } from 'node:vm';

/**
 * Telegram bot
 */
class TelegramBot implements BaseComponent {

  private botConfig: TelegramBotConfig = null;
  private mqttEventsConfig: MQTTEventsConfig = null;
  private app: Application = null;
  private bot: Telegraf = null;
  private subscriptions: MQTTSubscription[] = null;
  private alerts: MQTTAlert[] = null;
  public alerts_enabled: boolean = false;

  /**
   * Initialize
   * 
   * @param {*} app
   */
  constructor(app: Application) {
    assert.ok(app, 'app is mandatory');

    const botConfig = app.load_json<TelegramBotConfig>('telegram.json');
    assert.ok(!StringUtils.isNullOrEmpty(botConfig.bot_token_id), 'exec: bot_token_id not definited');
    assert.ok(!StringUtils.isNullOrEmpty(botConfig.bot_owner_id), 'exec: bot_owner_id not definited');

    this.botConfig = botConfig;
    this.mqttEventsConfig = app.load_json<MQTTEventsConfig>('mqtt-events.json');
    this.app = app;
    this.bot = null;
    this.subscriptions = [];
    this.alerts = [];
    this.alerts_enabled = false;

    // Load subscriptions and alerts
    this.mqttEventsConfig.subscriptions.forEach(topic => this.subscriptions.push(new MQTTSubscription(topic)));
    this.mqttEventsConfig.alerts.forEach(alert => this.alerts.push(alert));
    this.alerts.forEach(alert => {
      const subscriptions = this.subscriptions.filter((x) => x.topic === alert.topic);
      if (subscriptions.length == 0)
        this.subscriptions.push(new MQTTSubscription(alert.topic));
    });
  }

  /**
   * Initialize bot
   * 
   * @param {*} app
   */
  private async initialize_bot() {
    assert.ok(!this.bot, 'bot is already initialized');

    const self = this;
    try {
      const bot = new Telegraf(self.botConfig.bot_token_id)

      bot.command('quit', (ctx) => {
        ctx.leaveChat()
      })
      bot.on('text', async (ctx) => {
        // Only reply to bot owner
        if (ctx.from.id.toString() !== self.botConfig.bot_owner_id) return;

        // Sent MOTD
        let motd = await this.getMOTD();
        if (!StringUtils.isNullOrEmpty(motd))
          ctx.reply(motd)
      })

      await bot.launch()

      this.bot = bot;

      console.log('Bot initialization completed');

    } catch (ex: unknown) {
      this.bot = null;
      console.log('Bot initialization failed');
      throw ex;
    }
  }

  /**
   * Execute
   */
  async exec() {
    try {
      await this.initialize_bot();
    } catch (ex: unknown) {
      throw ex;
    }
  }

  /**
  * Send a message
  * 
  * @param {*} message message to send
  * @param {*} recipient_id recipient id, if omitted send to bot owner
  */
  private async send_message(message: string, recipient_id?: string) {
    assert.ok(this.bot, 'telegram bot not initialized');

    if (StringUtils.isNullOrEmpty(recipient_id))
      recipient_id = this.botConfig.bot_owner_id;

    this.bot.telegram.sendMessage(recipient_id, message);
  }

  /**
  * Subscribe all MQTT topics to MQTT client
  * 
  * @param {*} mqtt_client mqtt client
  */
  async addSubscriptionsToMQTT(mqtt_client: MQTTClient) {
    assert.ok(mqtt_client, 'mqtt client not initialized')
    this.subscriptions.forEach(element => mqtt_client.subscribe(element.topic));
  }

  /**
   * Find subscription and update its value
   * 
   * @param mqtt_message mqtt message
   */
  private updateTopicValue(mqtt_message: MQTTMessage): boolean {
    const subscriptions = this.subscriptions.filter((x) => x.topic === mqtt_message.topic);
    if (subscriptions.length != 1) return false;

    const subscription = subscriptions[0];
    if (subscription.value == mqtt_message.value) return false;
    subscription.oldValue = subscription.value;
    subscription.value = mqtt_message.value;

    console.log(`Updated ${subscription.topic}, value: ${subscription.value}`);

    return true;
  }

  /**
   * Test if an alert can be tirggered by an mqtt message
   * 
   * @param mqtt_message 
   * @param subscription 
   * @param alert 
   * @returns 
   */
  private testAlert(mqtt_message: MQTTMessage, subscription: MQTTSubscription, alert: MQTTAlert) {
    if (alert.topic !== mqtt_message.topic) return false;
    const regEx = StringUtils.toRegEx(alert.test);

    // First, test regular expression
    if (regEx) {
      console.log('Testing regex for', alert.topic, 'regex:', regEx, 'value:', mqtt_message.value, 'test:', regEx.test(mqtt_message.value));
      if (regEx.test(mqtt_message.value)) return true;
    }
    // Then, do other tests

    // Test if value can be anything
    if (alert.test === '*')
      return true;

    // Test if value is below a certain value
    else if (alert.test.startsWith('<')) {
      if (subscription.enabled && Number(mqtt_message.value) < Number(alert.test.replace('<', ''))) {
        subscription.enabled = false;
        return true;
      }

      if (Number(mqtt_message.value) > Number(alert.test.replace('<', '')))
        subscription.enabled = true;

      return false;
    }

    // Test if value is above a certain value
    else if (alert.test.startsWith('>')) {
      if (subscription.enabled && Number(mqtt_message.value) > Number(alert.test.replace('>', ''))) {
        subscription.enabled = false;
        return true;
      }

      if (Number(mqtt_message.value) < Number(alert.test.replace('<', '')))
        subscription.enabled = true;

      return false;
    }
    // Test if value is equal to a certain value
    else if (alert.test === mqtt_message.value)
      return true;

    return false;
  }

  /**
  * Send subscription alerts
  * 
  * @param mqtt_message mqtt message
  */
  private async sendAlerts(mqtt_message: MQTTMessage) {
    if (!this.alerts_enabled) return;

    // Find subscription
    const subscriptions = this.subscriptions.filter((x) => x.topic === mqtt_message.topic);
    if (subscriptions.length != 1) return;
    const subscription = subscriptions[0];

    // Get suitable alerts
    const alerts = this.alerts.filter((alert) => this.testAlert(mqtt_message, subscription, alert));
    if (alerts.length == 0) return;

    // Send alerts
    const modt = await this.getMOTD();
    alerts.forEach((alert) => {
      let message = alert.message
        .replace("${value}", mqtt_message.value)
        .replace("${test}", alert.test.replace('<', '').replace('>', ''))
        .replace("${MOTD}", modt)
        ;
      this.send_message(message);

      console.log(`Send alert ${alert.topic}, test: ${alert.test}, value: ${mqtt_message.value}`);
    });

  }

  /**
  * Receive a topic update from MQTT client
  * 
  * @param {*} mqtt_message mqtt message
  */
  async receiveUpdateFromMQTT(mqtt_message: MQTTMessage) {
    assert.ok(mqtt_message, 'message is mandatory')

    if (this.updateTopicValue(mqtt_message))
      await this.sendAlerts(mqtt_message);
  }

  /**
   * Returns TRUE if has to send a MOTD on start
   * @returns 
   */
  hasToSendMOTDStart(): boolean {
    return this.mqttEventsConfig.motd_on_start;
  }

  /**
  * Get MOTD
  * 
  */
  async getMOTD() {
    let motd = this.app.load_txt('telegram-motd.txt');
    motd = StringUtils.replaceAll(motd, '${mu_distance}', this.mqttEventsConfig.mu_distance);
    motd = StringUtils.replaceAll(motd, '${mu_temperature}', this.mqttEventsConfig.mu_temperature);

    this.subscriptions.forEach((x) => motd = motd.replace('${' + x.topic + '}', x.value));

    return motd;
  }

  /**
   * Send MOTD
   */
  async sendMOTD() {
    // Sent MOTD
    let motd = await this.getMOTD();
    if (!StringUtils.isNullOrEmpty(motd))
      await this.send_message(motd);
  }

  /**
   * Dispose
   */
  async dispose() {
    if (this.bot) this.bot.stop();
  }

}


export default TelegramBot;