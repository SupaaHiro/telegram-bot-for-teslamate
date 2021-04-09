'use strict';

import * as assert from 'assert';
import { connect, MqttClient } from 'mqtt';

import Application from '../application.js';
import BaseComponent from './base-component.js';
import MQTTMessage from './mqtt-message.js';
import MQTTClientConfig from '../config/mqtt-client-config.js';
import { EventEmitter } from 'events';
import { StringUtils } from './utils.js';

/**
 * MQTT Client
 */
class MQTTClient extends EventEmitter implements BaseComponent {
  static _VALIDATE_HOST = /((((?:mqtt|mqtts|ws):(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/;

  app: Application = null;
  config: MQTTClientConfig = null;
  mqtt_client: MqttClient = null;

  /**
   * Initialize
   * 
   * @param {*} app
   */
  constructor(app: Application) {
    super();

    assert.ok(app, 'app is mandatory');

    this.app = app;
    this.config = this.load_config(app);
    this.mqtt_client = null;

  }

  /**
   * Load configuration
   */
  private load_config(app: Application): MQTTClientConfig {
    const config = app.load_json<MQTTClientConfig>('mqtt-client.json');

    // Fill config from environment variables
    const env_mqtt_protocol = process.env.MQTT_PROTOCOL;
    const env_mqtt_host = process.env.MQTT_HOST;
    const env_mqtt_port = process.env.MQTT_PORT;
    const env_mqtt_username = process.env.MQTT_USERNAME;
    const env_mqtt_password = process.env.MQTT_PASSWORD;
    if (!StringUtils.isNullOrEmpty(env_mqtt_protocol))
      config.protocol = env_mqtt_protocol;
    if (!StringUtils.isNullOrEmpty(env_mqtt_host))
      config.host = env_mqtt_host;
    if (!StringUtils.isNullOrEmpty(env_mqtt_port))
      config.port = env_mqtt_port;
    if (env_mqtt_username)
      config.username = env_mqtt_username;
    if (env_mqtt_password)
      config.password = env_mqtt_password;

    return config;
  }

  /**
  * Connect to MQTT broker
  */
  private connect_to_broker(host, options): Promise<MqttClient> {
    const self = this;
    assert.ok(self.config, 'mqtt config is not loaded');

    return new Promise(function (resolve, reject) {
      const mqtt_client = connect(host, options);

      // Emit event on connect
      mqtt_client.once('connect', function () {
        resolve(mqtt_client);
      });

      mqtt_client.once('error', function (err) {
        reject(err);
      });
    });
  }

  /**
  * Initialize mqtt client
  */
  private async initialize_mqtt_client() {
    assert.ok(!this.mqtt_client, 'mqtt client is already initialized');

    const self = this;
    try {
      let host = self.config.host, port = self.config.port;
      if (!StringUtils.isNullOrEmpty(self.config.protocol))
        host = self.config.protocol + '://' + self.config.host;

      const options = { port: port, username: self.config.username, password: self.config.password, rejectUnauthorized: false, connectTimeout: 10000 };

      assert.ok(MQTTClient._VALIDATE_HOST.test(host), `MQTT client: host ${host} not valid ! Check mqtt-client.json configuration`)
      assert.ok(Number(port) > 0 && Number(port) < 65535, `MQTT client: port ${port} not valid ! Check mqtt-client.json configuration`)

      console.log(`Attemping connection to ${host}:${options.port} ...`);

      const mqtt_client = await self.connect_to_broker(host, options);

      // Emit event on topic update
      mqtt_client.on('message', function (topic, data) {
        const message = new MQTTMessage();
        message.topic = topic;
        message.value = data.toString();

        self.emit('message', message);
      });
      this.mqtt_client = mqtt_client;

      console.log(`Connected to ${host}:${options.port}`);

      self.emit('connect', mqtt_client);

    } catch (ex: unknown) {
      this.mqtt_client = null;
      throw ex;
    }
  }

  /**
  * Execute
  */
  async exec() {
    try {
      await this.initialize_mqtt_client();
    }
    catch (ex: unknown) {
      throw ex;
    }
  }

  /**
   * Subscribe a topic
   * 
   * @param {*} topic topic
   */
  subscribe(topic: string) {
    this.mqtt_client.subscribe(topic, function (err) {
      if (err)
        return console.log(`Unabled to subscribe to ${topic}`, err);

      console.log(`Subscribed to ${topic}`)
    })
  }

  /**
   * Dispose
   */
  async dispose() {
    if (this.mqtt_client) this.mqtt_client.end()
  }
}

export default MQTTClient;