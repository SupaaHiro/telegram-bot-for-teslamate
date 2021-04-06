'use strict';

import * as assert from 'assert';
import { connect, MqttClient } from 'mqtt';

import Application from '../application.js';
import BaseComponent from './base-component.js';
import MQTTMessage from './mqtt-message.js';
import MQTTClientConfig from '../config/mqtt-client-config.js';
import { EventEmitter } from 'events';

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

    const config = app.load_json<MQTTClientConfig>('mqtt-client.json');
    assert.ok(MQTTClient._VALIDATE_HOST.test(config.host), 'MQTT client: host not valid ! Check mqtt-client.json configuration')
    assert.ok(config.port > 0 && config.port < 65535, 'MQTT client: port not valid ! Check mqtt-client.json configuration')

    this.config = config;
    this.mqtt_client = null;

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
      const options = { port: self.config.port, username: self.config.username, password: self.config.password, rejectUnauthorized: false, connectTimeout: 10000 };
      const host = self.config.host;

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