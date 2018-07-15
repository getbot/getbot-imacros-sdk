/** @module playMacro */

import once           from 'lodash.once';
import {createLogger} from './Logger';
import {terminate}    from './terminate';

const log = createLogger('playMacro');

export {
  playMacro,
  registerObserver,
  unregisterObserver
};

let observers = [];
let clearSessionOnce = once(terminate);

/**
 * A wrapper for iMacros' iimPlayCode function.
 *
 * @param {string} macro iim macro to play.
 * @param {Object} opts Options map
 * @param {boolean} [opts.errorIgnore=false] Tells iMacros to ignore errors.
 *                                           The replay of macros continues even if
 *                                           one or more commands fail.
 * @param {number} [opts.timeoutStep=1] Timeout in seconds for command TAG to
 *                                       search for an element on a webpage before
 *                                       exiting with error.
 * @param {number} [opts.timeoutPage=30] Timeout in seconds to wait for page to
 *                                       finish loading
 */
function playMacro(macro, opts) {
  const options     = opts || {};
  const errorIgnore = options.errorIgnore ? 'YES' : 'NO';
  const timeoutStep = options.timeoutStep || 1;
  const timeoutPage = options.timeoutPage || 30;

  macro = `
    SET !REPLAYSPEED FAST
    SET !TIMEOUT_PAGE ${timeoutPage}
    SET !ERRORIGNORE ${errorIgnore}
    SET !TIMEOUT_STEP ${timeoutStep}
    ${macro}
  `;

  //log.debug('Macro: %s', macro);
  const code = iimPlayCode(macro);

  switch (code) {
    case 1:
      break;
    case -101:
      log.warn('Была нажата кнопка Stop.');
      clearSessionOnce();
      break;
    case -802:
      // Timeout error (failed to load web page)
      log.warn('Не удалось загрузить страницу в отведенное время. ' +
        'Останавливаем загрузку и идем дальше...');
      window.stop();
      break;
    case -910:
      log.error('Синтаксическая ошибка в исполняемом макросе: %s', macro);
      break;
    case -920:
    case -921:
    case -922:
    case -923:
    case -924:
    case -925:
    case -926:
      log.warn('Элемент не найден на текущей странице: %s', iimGetLastError());
      log.info('Адрес страницы: %s', window.location.href);
      log.debug('Неудавшийся скрипт: %s', macro);
      break;
    case -1001:
      log.error('Ошибка при выполнении действия на странице: %s', iimGetLastError());
      log.error('Адрес страницы: %s', window.location.href);
      log.debug('Выполняемый макрос: %s', macro);
      break;
    default:
      log.error('Произошла ошибка %s при выполнении макроса: %s', code, iimGetLastError());
  }


  let extract = iimGetLastExtract().split('[EXTRACT]');

  const result = {
    code,
    extract: extract.length === 1 ? extract[0] : extract
  };

  // Call each registered observer
  observers.forEach(observer => observer(result));

  return result;
}

function registerObserver(observer) {
  observers.push(observer);
}

function unregisterObserver(observer) {
  observers.splice(observers.indexOf(observer) >>> 0, 1);
}
