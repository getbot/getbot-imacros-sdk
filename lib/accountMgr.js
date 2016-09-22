import GetBot from './GetBot.js';
import createLogger from './Logger.js';

const log = createLogger('accountMgr');
const accountMgr = Object.assign({}, GetBot.accountMgr, {applyCredentials, checkProxy});

export default accountMgr;

function applyCredentials(creds) {
  GetBot.accountMgr.applyCredentials(creds);

  if (!creds.proxyIp || creds.proxyIp === '') return Promise.resolve(creds);
  else return checkProxy(creds.proxyIp).then(() => creds);
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
