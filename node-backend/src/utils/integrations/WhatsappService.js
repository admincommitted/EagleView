/**
 * Sends WhatsApp messages through an API provider (Settings > WhatsApp > API mode).
 * Supported: MSG91, Meta (WhatsApp Business Cloud API), Twilio; 2Factor sends SMS (not WhatsApp).
 *
 * WhatsApp lets a business start a chat only with an approved TEMPLATE; plain text is delivered only within
 * 24 hours of the customer's last message. When a template name is set in Settings, status messages are sent
 * as that template with 3 body values: {{1}} party name, {{2}} AWB / job / BE no, {{3}} status text.
 * Without a template, plain text is sent (works only inside the 24-hour window).
 * - MSG91: the documented template request (bulk endpoint, to_and_components) or a session text message;
 * - Meta: Graph API version from Settings (default v21.0);
 * - number check: 10-15 digits; 10 digits = India (+91);
 * - provider errors are shown as text; "disabled" and "not set up" are errors the screen can show.
 */
import * as settingsStore from '../common/settingsStore.js';

const WHATSAPP_CONFIG_KEYS = [
  'whatsapp_provider',
  'whatsapp_api_key',
  'whatsapp_sender_id',
  'whatsapp_from_number',
  'whatsapp_enabled',
  'whatsapp_status_template',
  'whatsapp_template_name',
  'whatsapp_template_lang',
  'whatsapp_template_namespace',
  'whatsapp_api_version',
];
const DEFAULT_PROVIDER = 'msg91';
const DEFAULT_META_API_VERSION = 'v21.0';
const DEFAULT_TEMPLATE_LANG = 'en';
const DEFAULT_2FACTOR_SENDER = 'EAGLEV';
const ERROR_TEXT_MAX = 300;
const NOTIFICATION_PARAM_MAX = 900;
const META_PHONE_NUMBER_ID = /^\d{6,20}$/;
const PROVIDERS_WITH_TEMPLATES = ['msg91', 'meta'];

const MSG91_BULK_URL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';
const MSG91_TEXT_URL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/';
const META_GRAPH_URL = 'https://graph.facebook.com';
const TWILIO_ACCOUNTS_URL = 'https://api.twilio.com/2010-04-01/Accounts/';
const TWO_FACTOR_SMS_URL = 'https://2factor.in/API/R1/?module=TRANS_SMS&apikey=';

const DEFAULT_STATUS_TEMPLATE =
  'Dear {name},\n\nYour consignment *{awb}* status:\n\n\u{1F4E6} {status}\n\n_Committed Cargo Care Ltd._';

// settings from table WhatsappConfig
async function getWhatsappConfig() {
  return settingsStore.getMany(WHATSAPP_CONFIG_KEYS);
}

function normalizeIndianNumber(number) {
  if (!number) return null;
  let digits = String(number).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10) return '91' + digits;
  if (digits.startsWith('0') && digits.length === 11) return '91' + digits.slice(1);
  if (digits.length < 11 || digits.length > 15) return null; // not a full international number
  return digits;
}

const fail = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const invalidNumberError = (toNumber) =>
  fail(
    'Mobile number not valid: ' + (toNumber || '(empty)') + ' - give 10 digits, or the full number with country code',
  );

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, ERROR_TEXT_MAX) };
  }
}

// a readable message from a provider error body
function errorTextOf(body) {
  if (!body || typeof body !== 'object') return String(body || '');
  if (body.error && typeof body.error === 'object') {
    return [
      body.error.message,
      body.error.error_data && body.error.error_data.details,
      body.error.code && 'code ' + body.error.code,
    ]
      .filter(Boolean)
      .join(' - ');
  }
  const message = body.message || body.errors || body.error || body.Details || body.raw;
  return typeof message === 'string' ? message : JSON.stringify(message || body).slice(0, ERROR_TEXT_MAX);
}

async function post(url, options, providerLabel) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (e) {
    throw fail(`${providerLabel}: cannot reach the provider (${e.message})`, 502);
  }
  const data = await readJson(response);
  // MSG91 can answer 200 with { hasError: true } / { status: 'fail' } on errors
  if (!response.ok || data.hasError || data.status === 'fail' || data.type === 'error') {
    throw fail(`${providerLabel}: ${errorTextOf(data)} (HTTP ${response.status})`, 502);
  }
  return data;
}

async function sendViaMSG91(config, mobile, message, template) {
  if (!config.whatsapp_from_number) throw fail('MSG91: enter the integrated WhatsApp number (From Number) in Settings');
  const integrated = String(config.whatsapp_from_number).replace(/\D/g, '');
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', authkey: config.whatsapp_api_key };
  if (template) {
    const components = {};
    template.params.forEach((value, index) => {
      components['body_' + (index + 1)] = { type: 'text', value: String(value) };
    });
    const templateBody = {
      name: template.name,
      language: { code: template.lang, policy: 'deterministic' },
      to_and_components: [{ to: [mobile], components }],
    };
    if (config.whatsapp_template_namespace) templateBody.namespace = config.whatsapp_template_namespace;
    const body = {
      integrated_number: integrated,
      content_type: 'template',
      payload: { messaging_product: 'whatsapp', type: 'template', template: templateBody },
    };
    return post(MSG91_BULK_URL, { method: 'POST', headers, body: JSON.stringify(body) }, 'MSG91');
  }
  const body = {
    integrated_number: integrated,
    content_type: 'text',
    payload: { text: message },
    recipient_number: mobile,
  };
  return post(MSG91_TEXT_URL, { method: 'POST', headers, body: JSON.stringify(body) }, 'MSG91');
}

function metaMessageBody(mobile, message, template) {
  if (!template)
    return { messaging_product: 'whatsapp', to: mobile, type: 'text', text: { preview_url: false, body: message } };
  return {
    messaging_product: 'whatsapp',
    to: mobile,
    type: 'template',
    template: {
      name: template.name,
      language: { code: template.lang },
      components: [
        { type: 'body', parameters: template.params.map((value) => ({ type: 'text', text: String(value) })) },
      ],
    },
  };
}

async function sendViaMeta(config, mobile, message, template) {
  if (!config.whatsapp_from_number || !META_PHONE_NUMBER_ID.test(String(config.whatsapp_from_number).trim())) {
    throw fail('Meta: "Phone Number ID" must be the numeric ID from Meta (WhatsApp > API Setup), not the phone number');
  }
  const apiVersion = config.whatsapp_api_version || DEFAULT_META_API_VERSION;
  const phoneNumberId = String(config.whatsapp_from_number).trim();
  return post(
    `${META_GRAPH_URL}/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.whatsapp_api_key },
      body: JSON.stringify(metaMessageBody(mobile, message, template)),
    },
    'Meta',
  );
}

async function sendViaTwilio(config, mobile, message) {
  const [accountSid, authToken, ...rest] = String(config.whatsapp_api_key || '').split(':');
  if (rest.length || authToken === undefined || !accountSid || !authToken)
    throw fail('Twilio: API key must be AccountSID:AuthToken');
  const from = String(config.whatsapp_from_number || '').replace(/[^\d+]/g, '');
  if (!from) throw fail('Twilio: enter the WhatsApp sender number (From Number)');
  const form = new URLSearchParams({
    From: 'whatsapp:' + (from.startsWith('+') ? from : '+' + from),
    To: 'whatsapp:+' + mobile,
    Body: message,
  });
  return post(
    TWILIO_ACCOUNTS_URL + accountSid + '/Messages.json',
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(accountSid + ':' + authToken).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    },
    'Twilio',
  );
}

// 2Factor transactional SMS (it is not WhatsApp)
async function sendVia2Factor(config, mobile, message) {
  const url =
    TWO_FACTOR_SMS_URL +
    encodeURIComponent(config.whatsapp_api_key) +
    '&to=' +
    mobile +
    '&from=' +
    encodeURIComponent(config.whatsapp_sender_id || DEFAULT_2FACTOR_SENDER) +
    '&msg=' +
    encodeURIComponent(message);
  let response;
  try {
    response = await fetch(url);
  } catch (e) {
    throw fail('2Factor: cannot reach the provider (' + e.message + ')', 502);
  }
  const data = await readJson(response);
  if (data.Status !== 'Success') throw fail('2Factor: ' + errorTextOf(data), 502);
  return data;
}

function checkApiReady(config) {
  if (String(config.whatsapp_enabled) === 'false') throw fail('WhatsApp API is switched off in Settings > WhatsApp');
  if (!config.whatsapp_api_key) throw fail('WhatsApp API key is not set in Settings > WhatsApp');
}

const providerOf = (config) => (config.whatsapp_provider || DEFAULT_PROVIDER).toLowerCase();

const maskedNumber = (mobile) => mobile.slice(0, 4) + '******' + mobile.slice(-2);

/**
 * send one message.
 * @param {string} toNumber
 * @param {string} message - plain text (used when no template, and by Twilio / 2Factor)
 * @param {object} [cfgOverride]
 * @param {string[]} [templateParams] - values for {{1}}, {{2}}, {{3}} of the approved template
 */
async function sendWhatsapp(toNumber, message, cfgOverride, templateParams) {
  const config = cfgOverride || (await getWhatsappConfig());
  checkApiReady(config);
  const mobile = normalizeIndianNumber(toNumber);
  if (!mobile) throw invalidNumberError(toNumber);
  const provider = providerOf(config);
  const template =
    config.whatsapp_template_name && PROVIDERS_WITH_TEMPLATES.includes(provider)
      ? {
          name: config.whatsapp_template_name,
          lang: config.whatsapp_template_lang || DEFAULT_TEMPLATE_LANG,
          params: templateParams || [message],
        }
      : null;
  console.log(
    '[WhatsApp] Sending via ' +
      provider +
      (template ? ' (template ' + template.name + ')' : ' (text)') +
      ' to ' +
      maskedNumber(mobile),
  );
  let data;
  switch (provider) {
    case 'msg91':
      data = await sendViaMSG91(config, mobile, message, template);
      break;
    case 'meta':
      data = await sendViaMeta(config, mobile, message, template);
      break;
    case 'twilio':
      data = await sendViaTwilio(config, mobile, message);
      break;
    case '2factor':
      data = await sendVia2Factor(config, mobile, message);
      break;
    default:
      throw fail('Unknown WhatsApp provider: ' + provider);
  }
  return { sent: true, provider, to: mobile, template: template ? template.name : null, response: data };
}

async function sendShipmentStatus(partyName, mobileNumber, awbNumber, statusText) {
  const config = await getWhatsappConfig();
  const template = config.whatsapp_status_template || DEFAULT_STATUS_TEMPLATE;
  const message = template
    .replace(/{name}/g, partyName || 'Valued Customer')
    .replace(/{awb}/g, awbNumber || '')
    .replace(/{status}/g, statusText || '');
  return await sendWhatsapp(mobileNumber, message, config, [
    partyName || 'Customer',
    awbNumber || '-',
    statusText || '-',
  ]);
}

function internalNotificationText(employeeName, messageType, data) {
  switch (messageType) {
    case 'password_reset':
      return (
        '*Committed Cargo ERP*\n\nHello ' +
        employeeName +
        ',\n\nYour password has been reset.\n\n🔑 New Password: *' +
        data.newPassword +
        '*\n\nPlease login and change it immediately.\n\n_This is an automated security alert._'
      );
    case 'account_lock':
      return (
        '*Committed Cargo ERP*\n\nHello ' +
        employeeName +
        ',\n\n⚠️ Your account has been *locked*.\n\nPlease contact your administrator.\n\n_Committed Cargo Care Ltd._'
      );
    case 'account_activate':
      return (
        '*Committed Cargo ERP*\n\nHello ' +
        employeeName +
        ',\n\n✅ Your account has been *activated*.\n\nYou can now login with your credentials.\n\n_Committed Cargo Care Ltd._'
      );
    default:
      return (
        '*Committed Cargo ERP*\n\nHello ' +
        employeeName +
        ',\n\n' +
        (data.text || 'You have a new notification.') +
        '\n\n_Committed Cargo Care Ltd._'
      );
  }
}

async function sendInternalNotification(employeeName, mobileNumber, messageType, data) {
  const details = data || {};
  const message = internalNotificationText(employeeName, messageType, details);
  const templateParams = [
    employeeName || 'User',
    messageType || '-',
    (details.text || message).slice(0, NOTIFICATION_PARAM_MAX),
  ];
  return await sendWhatsapp(mobileNumber, message, null, templateParams);
}

// A document (the invoice PDF) through the API. Meta: the file is uploaded to Meta's media store and sent by its id
// (works inside the 24-hour customer window, like plain text). MSG91 / Twilio / 2Factor need the file at a public
// link, which this server does not have - for them the PDF goes through WhatsApp Web.
async function sendDocument(toNumber, buffer, filename, caption, cfgOverride) {
  const config = cfgOverride || (await getWhatsappConfig());
  checkApiReady(config);
  const mobile = normalizeIndianNumber(toNumber);
  if (!mobile) throw invalidNumberError(toNumber);
  const provider = providerOf(config);
  if (provider !== 'meta') {
    throw fail(
      'Sending the PDF on WhatsApp works with WhatsApp Web (scan the QR in Settings > WhatsApp) or the Meta API - the ' +
        provider +
        ' API needs a public link to the file',
    );
  }
  if (!META_PHONE_NUMBER_ID.test(String(config.whatsapp_from_number || '').trim())) {
    throw fail('Meta: "Phone Number ID" must be the numeric ID from Meta (WhatsApp > API Setup)');
  }
  const apiVersion = config.whatsapp_api_version || DEFAULT_META_API_VERSION;
  const phoneNumberId = String(config.whatsapp_from_number).trim();
  const authorization = 'Bearer ' + config.whatsapp_api_key;

  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'application/pdf');
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), filename);
  const upload = await post(
    `${META_GRAPH_URL}/${apiVersion}/${phoneNumberId}/media`,
    {
      method: 'POST',
      headers: { Authorization: authorization },
      body: form,
    },
    'Meta media',
  );
  if (!upload || !upload.id) throw fail('Meta: the PDF was not taken (no media id)', 502);

  const data = await post(
    `${META_GRAPH_URL}/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authorization },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: mobile,
        type: 'document',
        document: { id: upload.id, filename, caption: caption || '' },
      }),
    },
    'Meta',
  );
  return { sent: true, provider, to: mobile, response: data };
}

export { sendWhatsapp, sendDocument, sendShipmentStatus, sendInternalNotification };
