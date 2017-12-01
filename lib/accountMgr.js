import {GetBot} from './GetBot';
import {createLogger} from './Logger';

const log = createLogger('accountMgr');
const ipRegex = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$|^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9-]*[A-Za-z0-9])$|^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/;

export const accountMgr = Object.assign({}, GetBot.accountMgr, {applyCredentials, checkProxy});

/**
 * Applies credentials passing them to the checker function. The checker
 * function must return a Promise which resolves or rejects. In case of
 * credentials are bad (wrong password or smth), a Promise should be rejected
 * with an error message 'LOGIN_FAILED'. In this case another request for
 * credentials will be made untill the valid credentials are obtained or
 * credentials are over.
 * 
 * @param {Object} creds 
 * @param {string} creds.login
 * @param {string} creds.website
 * @param {string} creds.password
 * @param {string} creds.proxyIp
 * @param {Function} loginCallback
 * @returns {Promise}
 */
function applyCredentials(creds, loginCallback) {
  log.debug('Applying credentials: %j', creds);
  log.debug('loginCallback: ', loginCallback);
  if (!loginCallback) loginCallback = () => Promise.resolve();
  GetBot.accountMgr.applyCredentials(creds);

  const checkCreds = function(creds) {
    return loginCallback(creds).catch(err => {
      log.debug(err, 'Error occurred executing login callback.');
      if (err.message === 'LOGIN_FAILED') {
        accountMgr['invalidateCredentials'](creds.website, creds.login);
        return GetBot.accountMgr.getCredentials(creds.website)
          .then(creds => applyCredentials(creds, loginCallback));
      }

      return Promise.reject(err);
    });
  };

  if (!creds.proxyIp || !ipRegex.test(creds.proxyIp)) return checkCreds(creds);
  else return checkProxy(creds.proxyIp).then(() => checkCreds(creds));
}

function checkProxy(proxyIp) {
  // We use validateProxy method to check proxy requesting IP from the
  // http://api.ipify.com service. But sometimes it fails due to 'offline' error.
  // To mitigate this we additionaly check the proxy via Яндекс.Интернетометр
  // service.
  return GetBot.accountMgr.validateProxy(proxyIp).catch(err => {
    log.error({err}, 'Error occurred checking proxy settings via request to api.ipify.com');
    log.info('Trying to check proxy settings via Яндекс.Интернетометр...');

    const macro = `
      SET !ERRORIGNORE NO
      URL GOTO=http://yandex.ru/internet
      TAG XPATH="//li[@class='client__item client__item_type_ipv4']/div"
      TAG XPATH="//li[@class='client__item client__item_type_ipv4']/div" EXTRACT=TXT
    `;

    let res = iimPlayCode(macro);
    log.debug(`Macro play result: ${res}`);

    if (res !== 1) return Promise.reject(new Error('PROXY_NOT_SET'));

    const ip = iimGetLastExtract();
    log.debug('IP parsed: ${ip}');

    if (ip !== proxyIp) return Promise.reject(new Error('PROXY_IP_MISMATCH'));

    log.info('Proxy have been set correctly.');
    return Promise.resolve();
  });
}
