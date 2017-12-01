/** @module terminate */

import {GetBot} from './GetBot';

export function terminate() {
  // Даем знать серверу что робот остановился
  GetBot.ws.publish('ru.getbot.robots.stopped');
}
