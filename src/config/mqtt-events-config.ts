import MQTTAlert from '../components/mqtt-alert.js';

export default interface MQTTEventsConfig {
  mu_temperature: string;
  mu_distance: string;
  subscriptions: string[];
  alerts: MQTTAlert[];
  motd: boolean;
}