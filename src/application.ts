'use strict';

import * as assert from 'assert';
import * as fsext from './components/fs-extension.js';
import { String } from './components/utils.js';

import MQTTClient from './components/mqtt-client.js';
import TelegramBot from './components/telegram-bot.js';
import ApplicationConfig from './config/application-config.js';

/**
 * Application main class
 */
class Application {
  // static _COMMAND_START_BOT = '';

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
  constructor(argv: (string | number)[]) {
    if (!argv)
      argv = [];

    this.config = fsext.load_json<ApplicationConfig>('application.json');
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

      assert.ok(this.config, 'initialize: configuration not loaded');
      assert.ok(!String.isNullOrEmpty(this.config.name), 'initialize: application name not definited');

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

      setTimeout(async function () {
        // Enable alerts
        self.telegram_bot.alerts_enabled = true;

        // Send MOTD
        await self.telegram_bot.send_motd()

      }, 5000);
    }
    catch (ex: unknown) {
      throw ex;
    }
  }

  /**
   * Load a json configuration file from app-root:/config directory
   * 
   * @param {*} name name
   */
  load_json<T>(name: string): T {
    return fsext.load_json(name);
  }

  /**
   * Load a txt configuration file from app-root:/config directory
   * 
   * @param {*} name name
   */
  load_txt(name: string): string {
    return fsext.load_txt(name);
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
        telegram_bot.subscribe(this.mqtt_client);
      })
      mqtt_client.on('message', function (e) {
        telegram_bot.update(e);
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
    return new Promise(function (resolve: Function, reject: Function) {

      setTimeout(function () {
        resolve();
      }, ms);
    })
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

    this.disposed = true;
  }
}

export default Application;
