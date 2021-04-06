'use strict';

/**
 * MQTT Message
 */
class MQTTMessage {

  constructor(topic?: string) {
    this.topic = topic;
    this.value = '';
  }

  topic: string = '';
  value: string = '';
}

export default MQTTMessage;