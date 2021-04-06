'use strict';

import * as assert from 'assert';
import { String } from './utils.js';

import Application from '../application';
import BaseComponent from './base-component';
import TelegramBotConfig from '../config/telegram-config.js';
import { Telegraf } from 'telegraf'
import MQTTClient from './mqtt-client.js';
import MQTTEventsConfig from '../config/mqtt-events-config.js';
import MQTTMessage from './mqtt-message.js';
import MQTTSubscription from './mqtt-subscription.js';
import MQTTAlert from './mqtt-alert.js';

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
    assert.ok(!String.isNullOrEmpty(botConfig.bot_token_id), 'exec: bot_token_id not definited');
    assert.ok(!String.isNullOrEmpty(botConfig.bot_owner_id), 'exec: bot_owner_id not definited');

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
        let motd = await this.get_motd();
        if (!String.isNullOrEmpty(motd))
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

    if (String.isNullOrEmpty(recipient_id))
      recipient_id = this.botConfig.bot_owner_id;

    this.bot.telegram.sendMessage(recipient_id, message);
  }

  /**
  * Subscribe topics
  * 
  * @param {*} mqtt_client mqtt client
  */
  async subscribe(mqtt_client: MQTTClient) {
    assert.ok(mqtt_client, 'mqtt client not initialized')
    this.subscriptions.forEach(element => mqtt_client.subscribe(element.topic));
  }

  /**
  * Receive topics updates
  * 
  * @param {*} mqtt_message mqtt message
  */
  async update(mqtt_message: MQTTMessage) {
    assert.ok(mqtt_message, 'message is mandatory')

    // Find subscription and update its value
    const subscriptions = this.subscriptions.filter((x) => x.topic === mqtt_message.topic);
    if (subscriptions.length != 1) return;
    const subscription = subscriptions[0];
    subscription.oldValue = subscription.value;
    subscription.value = mqtt_message.value;
    console.log(`Updated ${subscription.topic}, value: ${subscription.value}`);

    // Send alert (only if enabled)
    if (this.alerts_enabled) {
      const alerts = this.alerts.filter(
        function (x) {
          if (x.topic !== mqtt_message.topic) return false;

          const regEx = String.toRegEx(x.test);

          // Test regular expression
          if (regEx) {
            console.log('Testing regex for ', x.topic, 'regex:', regEx, 'value:', mqtt_message.value, 'test:', regEx.test(mqtt_message.value));
            return regEx.test(mqtt_message.value);
          }

          // Test if value can be anything
          else if (x.test === '*')
            return true;

          // Test if value is below a certain value
          else if (x.test.startsWith('<')) {
            if (subscription.enabled && Number(mqtt_message.value) < Number(x.test.replace('<', ''))) {
              subscription.enabled = false;
              return true;
            }

            if (Number(mqtt_message.value) > Number(x.test.replace('<', '')))
              subscription.enabled = true;

            return false;
          }

          // Test if value is above a certain value
          else if (x.test.startsWith('>')) {
            if (subscription.enabled && Number(mqtt_message.value) > Number(x.test.replace('>', ''))) {
              subscription.enabled = false;
              return true;
            }

            if (Number(mqtt_message.value) < Number(x.test.replace('<', '')))
              subscription.enabled = true;

            return false;
          }
          // Test if value is equal to a certain value
          else if (x.test === mqtt_message.value)
            return true;

          return false;
        });
      if (alerts.length > 0 && !String.isNullOrEmpty(alerts[0].message)) {
        const alert = alerts[0];
        if (alerts.length != 1)
          console.log(`Multiple events configured for ${alert.topic}, picking the first one: ${alert.test}`);

        let message = alert.message
          .replace("${value}", mqtt_message.value)
          .replace("${test}", alert.test.replace('<', '').replace('>', ''))
          ;
        this.send_message(message);

        console.log(`Send alert ${alert.topic}, test: ${alert.test}, value: ${mqtt_message.value}`);
      }
    }
  }

  async get_motd() {
    if (!this.mqttEventsConfig.motd) return '';

    // Sent MOTD
    let motd = this.app.load_txt('telegram-motd.txt');

    motd = String.replaceAll(motd, '${mu_distance}', this.mqttEventsConfig.mu_distance);
    motd = String.replaceAll(motd, '${mu_temperature}', this.mqttEventsConfig.mu_temperature);

    this.subscriptions.forEach((x) => motd = motd.replace('${' + x.topic + '}', x.value));

    return motd;
  }

  async send_motd() {
    // Sent MOTD
    let motd = await this.get_motd();
    if (!String.isNullOrEmpty(motd))
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