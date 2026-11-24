/**
 * WhatsappService.js
 * Sends WhatsApp messages through an API provider (Settings > WhatsApp > API mode).
 * Supported: MSG91, Meta (WhatsApp Business Cloud API), Twilio; 2Factor sends SMS (not WhatsApp).
 *
 * 28-Oct-2026 rework:
 * - WhatsApp lets a business start a chat only with an approved TEMPLATE; plain text is delivered only within
 *   24 hours of the customer's last message. When a template name is set in Settings, status messages are sent
 *   as that template with 3 body values: {{1}} party name, {{2}} AWB / job / BE no, {{3}} status text.
 *   Without a template, plain text is sent (works only inside the 24-hour window);
 * - MSG91: the old request mixed "template" with a text body, so MSG91 rejected it. Now the documented template
 *   request (bulk endpoint, to_and_components) or a session text message;
 * - Meta: Graph API version from Settings (default v21.0; v18.0 was hard-coded and is retired);
 * - node-fetch (not a dependency of this project) replaced by the fetch built into Node;
 * - number check: 10-15 digits; 10 digits = India (+91);
 * - provider error messages shown as text instead of raw JSON;
 * - "disabled" and "not set up" are errors the screen can show, not a silent "sent".
 */

async function getWhatsappConfig() {
  const keys = [
    'whatsapp_provider', 'whatsapp_api_key', 'whatsapp_sender_id', 'whatsapp_from_number', 'whatsapp_enabled',
    'whatsapp_status_template', 'whatsapp_template_name', 'whatsapp_template_lang', 'whatsapp_template_namespace', 'whatsapp_api_version',
  ];
  return require('./settingsStore').getMany(keys); // table WhatsappConfig
}

function normalizeIndianNumber(num) {
  if (!num) return null;
  let n = String(num).replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.length === 10) return '91' + n;
  if (n.startsWith('0') && n.length === 11) return '91' + n.slice(1);
  if (n.length < 11 || n.length > 15) return null; // not a full international number
  return n;
}

const fail = (msg, status = 400) => { const e = new Error(msg); e.status = status; return e; };

async function readJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { return { raw: text.slice(0, 300) }; }
}
// a readable message from a provider error body
function errText(d) {
  if (!d || typeof d !== 'object') return String(d || '');
  if (d.error && typeof d.error === 'object') return [d.error.message, d.error.error_data && d.error.error_data.details, d.error.code && ('code ' + d.error.code)].filter(Boolean).join(' - ');
  const m = d.message || d.errors || d.error || d.Details || d.raw;
  return typeof m === 'string' ? m : JSON.stringify(m || d).slice(0, 300);
}
async function post(url, opts, who) {
  let res;
  try { res = await fetch(url, opts); } catch (e) { throw fail(`${who}: cannot reach the provider (${e.message})`, 502); }
  const data = await readJson(res);
  // MSG91 can answer 200 with { hasError: true } / { status: 'fail' } on errors
  if (!res.ok || data.hasError || data.status === 'fail' || data.type === 'error') throw fail(`${who}: ${errText(data)} (HTTP ${res.status})`, 502);
  return data;
}

// ── providers ───────────────────────────────────────────────────
async function sendViaMSG91(config, mobile, message, tpl) {
  if (!config.whatsapp_from_number) throw fail('MSG91: enter the integrated WhatsApp number (From Number) in Settings');
  const integrated = String(config.whatsapp_from_number).replace(/\D/g, '');
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', authkey: config.whatsapp_api_key };
  if (tpl) {
    const components = {};
    tpl.params.forEach((v, i) => { components['body_' + (i + 1)] = { type: 'text', value: String(v) }; });
    const template = { name: tpl.name, language: { code: tpl.lang, policy: 'deterministic' }, to_and_components: [{ to: [mobile], components }] };
    if (config.whatsapp_template_namespace) template.namespace = config.whatsapp_template_namespace;
    return post('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', { method: 'POST', headers,
      body: JSON.stringify({ integrated_number: integrated, content_type: 'template', payload: { messaging_product: 'whatsapp', type: 'template', template } }) }, 'MSG91');
  }
  return post('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/', { method: 'POST', headers,
    body: JSON.stringify({ integrated_number: integrated, content_type: 'text', payload: { text: message }, recipient_number: mobile }) }, 'MSG91');
}

async function sendViaMeta(config, mobile, message, tpl) {
  if (!config.whatsapp_from_number || !/^\d{6,20}$/.test(String(config.whatsapp_from_number).trim())) throw fail('Meta: "Phone Number ID" must be the numeric ID from Meta (WhatsApp > API Setup), not the phone number');
  const ver = config.whatsapp_api_version || 'v21.0';
  const body = tpl
    ? { messaging_product: 'whatsapp', to: mobile, type: 'template', template: { name: tpl.name, language: { code: tpl.lang }, components: [{ type: 'body', parameters: tpl.params.map(v => ({ type: 'text', text: String(v) })) }] } }
    : { messaging_product: 'whatsapp', to: mobile, type: 'text', text: { preview_url: false, body: message } };
  return post(`https://graph.facebook.com/${ver}/${String(config.whatsapp_from_number).trim()}/messages`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.whatsapp_api_key }, body: JSON.stringify(body) }, 'Meta');
}

async function sendViaTwilio(config, mobile, message) {
  const parts = String(config.whatsapp_api_key || '').split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw fail('Twilio: API key must be AccountSID:AuthToken');
  const from = String(config.whatsapp_from_number || '').replace(/[^\d+]/g, '');
  if (!from) throw fail('Twilio: enter the WhatsApp sender number (From Number)');
  return post('https://api.twilio.com/2010-04-01/Accounts/' + parts[0] + '/Messages.json', { method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(parts[0] + ':' + parts[1]).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: 'whatsapp:' + (from.startsWith('+') ? from : '+' + from), To: 'whatsapp:+' + mobile, Body: message }).toString() }, 'Twilio');
}

// 2Factor transactional SMS (it is not WhatsApp)
async function sendVia2Factor(config, mobile, message) {
  const url = 'https://2factor.in/API/R1/?module=TRANS_SMS&apikey=' + encodeURIComponent(config.whatsapp_api_key) + '&to=' + mobile + '&from=' + encodeURIComponent(config.whatsapp_sender_id || 'EAGLEV') + '&msg=' + encodeURIComponent(message);
  let res;
  try { res = await fetch(url); } catch (e) { throw fail('2Factor: cannot reach the provider (' + e.message + ')', 502); }
  const data = await readJson(res);
  if (data.Status !== 'Success') throw fail('2Factor: ' + errText(data), 502);
  return data;
}

/**
 * send one message.
 * @param {string} toNumber
 * @param {string} message - plain text (used when no template, and by Twilio / 2Factor)
 * @param {object} [cfgOverride]
 * @param {string[]} [templateParams] - values for {{1}}, {{2}}, {{3}} of the approved template
 */
async function sendWhatsapp(toNumber, message, cfgOverride, templateParams) {
  const config = cfgOverride || await getWhatsappConfig();
  if (String(config.whatsapp_enabled) === 'false') throw fail('WhatsApp API is switched off in Settings > WhatsApp');
  if (!config.whatsapp_api_key) throw fail('WhatsApp API key is not set in Settings > WhatsApp');
  const mobile = normalizeIndianNumber(toNumber);
  if (!mobile) throw fail('Mobile number not valid: ' + (toNumber || '(empty)') + ' - give 10 digits, or the full number with country code');
  const provider = (config.whatsapp_provider || 'msg91').toLowerCase();
  const tpl = config.whatsapp_template_name && ['msg91', 'meta'].includes(provider)
    ? { name: config.whatsapp_template_name, lang: config.whatsapp_template_lang || 'en', params: templateParams || [message] }
    : null;
  console.log('[WhatsApp] Sending via ' + provider + (tpl ? ' (template ' + tpl.name + ')' : ' (text)') + ' to ' + mobile.slice(0, 4) + '******' + mobile.slice(-2));
  let data;
  switch (provider) {
    case 'msg91':   data = await sendViaMSG91(config, mobile, message, tpl); break;
    case 'meta':    data = await sendViaMeta(config, mobile, message, tpl); break;
    case 'twilio':  data = await sendViaTwilio(config, mobile, message); break;
    case '2factor': data = await sendVia2Factor(config, mobile, message); break;
    default:        throw fail('Unknown WhatsApp provider: ' + provider);
  }
  return { sent: true, provider, to: mobile, template: tpl ? tpl.name : null, response: data };
}

async function sendShipmentStatus(partyName, mobileNumber, awbNumber, statusText) {
  const config = await getWhatsappConfig();
  const template = config.whatsapp_status_template ||
    'Dear {name},\n\nYour consignment *{awb}* status:\n\n\u{1F4E6} {status}\n\n_Committed Cargo Care Ltd._';
  const message = template
    .replace(/{name}/g, partyName || 'Valued Customer')
    .replace(/{awb}/g, awbNumber || '')
    .replace(/{status}/g, statusText || '');
  return await sendWhatsapp(mobileNumber, message, config, [partyName || 'Customer', awbNumber || '-', statusText || '-']);
}

async function sendInternalNotification(employeeName, mobileNumber, messageType, data) {
  data = data || {};
  let message = '';
  switch (messageType) {
    case 'password_reset':
      message = '*Committed Cargo ERP*\n\nHello ' + employeeName + ',\n\nYour password has been reset.\n\n🔑 New Password: *' + data.newPassword + '*\n\nPlease login and change it immediately.\n\n_This is an automated security alert._';
      break;
    case 'account_lock':
      message = '*Committed Cargo ERP*\n\nHello ' + employeeName + ',\n\n⚠️ Your account has been *locked*.\n\nPlease contact your administrator.\n\n_Committed Cargo Care Ltd._';
      break;
    case 'account_activate':
      message = '*Committed Cargo ERP*\n\nHello ' + employeeName + ',\n\n✅ Your account has been *activated*.\n\nYou can now login with your credentials.\n\n_Committed Cargo Care Ltd._';
      break;
    default:
      message = '*Committed Cargo ERP*\n\nHello ' + employeeName + ',\n\n' + (data.text || 'You have a new notification.') + '\n\n_Committed Cargo Care Ltd._';
  }
  return await sendWhatsapp(mobileNumber, message, null, [employeeName || 'User', messageType || '-', (data.text || message).slice(0, 900)]);
}

// 08-Nov-2026: a document (the invoice PDF) through the API. Meta: the file is uploaded to Meta's media store and sent
// by its id (works inside the 24-hour customer window, like plain text). MSG91 / Twilio / 2Factor need the file at a
// public link, which this server does not have - for them the PDF goes through WhatsApp Web.
async function sendDocument(toNumber, buffer, filename, caption, cfgOverride) {
  const config = cfgOverride || await getWhatsappConfig();
  if (String(config.whatsapp_enabled) === 'false') throw fail('WhatsApp API is switched off in Settings > WhatsApp');
  if (!config.whatsapp_api_key) throw fail('WhatsApp API key is not set in Settings > WhatsApp');
  const mobile = normalizeIndianNumber(toNumber);
  if (!mobile) throw fail('Mobile number not valid: ' + (toNumber || '(empty)') + ' - give 10 digits, or the full number with country code');
  const provider = (config.whatsapp_provider || 'msg91').toLowerCase();
  if (provider !== 'meta') throw fail('Sending the PDF on WhatsApp works with WhatsApp Web (scan the QR in Settings > WhatsApp) or the Meta API - the ' + provider + ' API needs a public link to the file');
  if (!/^\d{6,20}$/.test(String(config.whatsapp_from_number || '').trim())) throw fail('Meta: "Phone Number ID" must be the numeric ID from Meta (WhatsApp > API Setup)');
  const ver = config.whatsapp_api_version || 'v21.0'; const pid = String(config.whatsapp_from_number).trim();
  const fd = new FormData();
  fd.append('messaging_product', 'whatsapp'); fd.append('type', 'application/pdf');
  fd.append('file', new Blob([buffer], { type: 'application/pdf' }), filename);
  const up = await post(`https://graph.facebook.com/${ver}/${pid}/media`, { method: 'POST', headers: { Authorization: 'Bearer ' + config.whatsapp_api_key }, body: fd }, 'Meta media');
  if (!up || !up.id) throw fail('Meta: the PDF was not taken (no media id)', 502);
  const data = await post(`https://graph.facebook.com/${ver}/${pid}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.whatsapp_api_key },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: mobile, type: 'document', document: { id: up.id, filename, caption: caption || '' } }) }, 'Meta');
  return { sent: true, provider, to: mobile, response: data };
}

module.exports = { sendWhatsapp, sendDocument, sendShipmentStatus, sendInternalNotification, normalizeIndianNumber, getWhatsappConfig };
