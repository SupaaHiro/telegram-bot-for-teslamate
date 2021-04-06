'use strict';

/**
 * MQTT Subscription
 */
class MQTTSubscription {
  static _UNKNOWN = 'unknown';

  constructor(topic?: string) {
    this.topic = topic;
    this.value = MQTTSubscription._UNKNOWN;
    this.oldValue = MQTTSubscription._UNKNOWN;
  }

  topic: string = '';
  value: string = '';
  oldValue: string = '';
  enabled: boolean = true;
}

export default MQTTSubscription;