/** @module logger */

import bunyan from 'browser-bunyan';
import {GetBot} from './GetBot';

const {classes: Cc, interfaces: Ci} = Components;

const ds = Cc['@mozilla.org/file/directory_service;1'].getService(Ci.nsIProperties);

const ffProfile = ds.get('ProfD', Ci.nsIFile).leafName;

const now = new Date();
const date = now.toISOString().split('T')[0];
const hours = now.getHours();
const minutes = now.getMinutes();
const seconds = now.getSeconds();
const LOG_FILE_NAME = `${ffProfile}_${date}_${hours}-${minutes}-${seconds}.log`;

/**
 *
 * MyFilestream - a class to write logs to text files.
 *
 */
class MyFilestream {
  /**
   *
   * @param {string} logFileName Name of the log file to write to.
   *
   */
  constructor(logFileName) {
    // Create the Logs folder sibling to Datasources folder
    let defdownpath = imns.Pref.getFilePref('defdownpath');
    let pathDelimeter = '\\';

    // Проверяем разделитель пути. Возможно мы используем Unix
    if (defdownpath.path.indexOf('/') != -1) pathDelimeter = '/';

    let splitted = defdownpath.path.split(pathDelimeter);
    splitted.pop(); // убираем папку Downloads
    splitted.push('Logs'); // добавляем папку Logs
    let logsPath = splitted.join(pathDelimeter);

    let logsDir = imns.FIO.makeDirectory(logsPath);
    logsDir.append(logFileName);

    this.logFile = logsDir;
  }

  /**
   *
   * @param {object} rec Bunyan record object
   * @returns {undefined}
   */
  write(rec) {
    const loggerName = rec.childName ? `${rec.name}/${rec.childName}` : rec.name;

    const time = rec.time.toISOString();
    const levelName = bunyan.nameFromLevel[rec.level];

    imns.FIO.appendTextFile(this.logFile,
      `[${time}]\t${levelName}\t${loggerName}\t${rec.msg}\r\n`);
  }
}

export function createLogger(name = 'unnamed', logLevel = 'info', logFileNamePrefix) {

  const logStreams = [{
    level: logLevel,
    stream: new bunyan.ConsoleFormattedStream({ logByLevel: true }),
    type: 'raw'
  }];

  // Add WAMP Logger transport for pushing log messages to the Console.
  // Check for wampLoggerTransport for backward compatibility
  if (GetBot.wampLoggerTransport) {
    logStreams.push({
      level: 'info',
      stream: GetBot.wampLoggerTransport,
      type: 'raw'
    });
  }

  // Если в настройках стоит опция `logToFile`, то добавляем инстанс
  // класса MyFileStream.
  if (global.BOT_CONFIG && global.BOT_CONFIG.logToFile) {
    const logFileName = logFileNamePrefix && logFileNamePrefix !== ''
      ?  `${logFileNamePrefix}_${LOG_FILE_NAME}`
      : LOG_FILE_NAME;

    logStreams.push({
      level: 'trace',
      stream: new MyFilestream(logFileName),
      type: 'raw'
    });
  }

  return bunyan.createLogger({
    name: name,
    streams: logStreams
  });
}
