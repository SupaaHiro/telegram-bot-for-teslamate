'use strict';

import * as assert from 'assert';
import * as fsext from './components/fs-extension.js';
import { StringUtils, PromiseUtils } from './components/utils.js';
import MQTTClient from './components/mqtt-client.js';
import TelegramBot from './components/telegram-bot.js';
import ApplicationConfig from './config/application-config.js';
import MQTTMessage from './components/mqtt-message.js';

/**
 * Application main class
 */
class Application {
  private static _MOTD_DELAY_MS = 5000;

  private config_path: string;
  private config: ApplicationConfig;
  private maplock: Map<string, any>;
  private promises_to_wait: Array<any>;
  private mqtt_client: MQTTClient;
  private telegram_bot: TelegramBot;
  private doevents_resolve: Function;
  private disposed: boolean;

  /**
   * Initializes a new instance of Application
   *
   * @param {*} argv    Command-line arguments
   */
  constructor(argv: any) {

    // Find configuration path
    let config_path: string = String(argv.c);
    if (StringUtils.isNullOrEmpty(config_path) && process.env.CONFIG_PATH_DIR)
      config_path = process.env.CONFIG_PATH_DIR;
    this.config_path = config_path;

    this.maplock = new Map();
    this.promises_to_wait = [];
    this.mqtt_client = null;
    this.telegram_bot = null;
    this.doevents_resolve = null;
    this.disposed = false;
  }

  /**
   * Initializes application
   *
   * @param {*} name application name
   */
  async initialize() {
    try {
      const self = this;

      // Load app config
      this.config = fsext.load_json<ApplicationConfig>('application.json', this.config_path);
      assert.ok(!StringUtils.isNullOrEmpty(this.config.name), 'initialize: application name not definited');

      // Handlers to terminate (semi) gracefully
      process.on('uncaughtException', async (err, origin) => {
        console.log(`Uncaught exception: ${err}\n` + `Exception origin: ${origin}`);
        await self.dispose();
        process.exit(1);
      });
      process.on('SIGINT', async () => {
        console.log('SIGINT received, application now shutting down...');
        await self.dispose();
        process.exit(0);
      });
      process.on('SIGTERM', async () => {
        console.log('SIGTERM received, application now shutting down...');
        await self.dispose();
        process.exit(0);
      });

      await fsext.lock(this.config.name, this.maplock);

      await this.initialize_telegram_bot();
      await this.initialize_mqtt_client(this.telegram_bot);

      // Enable alerts
      setTimeout(function () {
        self.telegram_bot.alerts_enabled = true;
      }, 500);

      // Send MOTD if enabled
      if (self.telegram_bot.hasToSendMOTDStart()) {
        setTimeout(async function () {
          await self.telegram_bot.sendMOTD()
        }, Application._MOTD_DELAY_MS);
      }
    }
    catch (ex: unknown) {
      throw ex;
    }
  }

  /**
   * Load a json configuration file from app-root:/config directory
   * 
   * @param {*} filename name
   */
  load_json<T>(filename: string): T {
    return fsext.load_json(filename, this.config_path);
  }

  /**
   * Load a txt configuration file from app-root:/config directory
   * 
   * @param {*} name name
   */
  load_txt(filename: string): string {
    return fsext.load_txt(filename, this.config_path);
  }

  /**
   * Initialize telegram bot
   *
   */
  async initialize_telegram_bot() {
    try {
      this.telegram_bot = new TelegramBot(this);
      await this.telegram_bot.exec();
    }
    catch (ex: unknown) {
      throw ex;
    }
  }

  /**
   * Initialize mqtt client
   *
   */
  async initialize_mqtt_client(telegram_bot: TelegramBot) {
    try {
      const mqtt_client = new MQTTClient(this);
      this.mqtt_client = mqtt_client;

      mqtt_client.on('connect', function (host) {
        telegram_bot.addSubscriptionsToMQTT(this.mqtt_client);
      })
      mqtt_client.on('message', function (e) {
        telegram_bot.receiveUpdateFromMQTT(e);
      })

      await this.mqtt_client.exec();
    }
    catch (ex: unknown) {
      throw ex;
    }
  }

  /**
   * Wait for a certain tasks / promise (before dispose the application)
   * 
   * @param {*} promise
   */
  wait_for(promise: Promise<any>) {
    this.promises_to_wait.push(promise);
  }

  /**
  * Wait for a certain delay
  * 
  * @param {*} delay delay in milliseconds
  */
  wait_for_delay(ms?: number) {
    return PromiseUtils.wait_for_delay(ms);
  }

  /**
   * Doevents
   */
  async doevents() {
    const self = this;
    return new Promise(function (resolve: Function, reject: Function) {
      self.doevents_resolve = resolve;
    });
  }

  /**
   * Wait for other tasks to complete
   */
  async wait_for_tasks() {
    // Wait other tasks / promises
    let x = this.promises_to_wait;
    if (x.length > 0) {
      await Promise.all(x);
      x.splice(0, x.length);
    }
  }

  /**
   * Dispose application
   */
  async dispose() {
    if (this.disposed) return;

    // Dispose components
    if (this.mqtt_client)
      this.mqtt_client.dispose();
    this.mqtt_client = null;

    if (this.telegram_bot)
      this.telegram_bot.dispose();
    this.telegram_bot = null;

    // End dovents
    if (this.doevents_resolve)
      this.doevents_resolve();

    // Release locks
    await fsext.release_locks(this.maplock);

    // Wait for IO process
    await PromiseUtils.wait_for_delay(250);

    this.disposed = true;
  }
}

export default Application;
