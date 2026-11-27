export const PROVIDERS = [
  { value: 'msg91', label: 'MSG91', desc: 'Indian provider. API Key = MSG91 authkey. From Number = your integrated WhatsApp number. Set the approved template below.' },
  { value: 'meta', label: 'Meta (Official WhatsApp Business API)', desc: 'API Key = permanent Access Token. Phone Number ID = the numeric ID from Meta > WhatsApp > API Setup (not the phone number).' },
  { value: 'twilio', label: 'Twilio', desc: 'International. API Key = AccountSID:AuthToken. From Number = your Twilio WhatsApp sender (+...).' },
  { value: '2factor', label: '2Factor.in (SMS only)', desc: 'Sends a normal SMS, NOT WhatsApp. API Key from 2factor.in, Sender ID = 6-letter DLT header.' },
];

export const DEFAULT_API_SETTINGS = {
  whatsapp_provider: 'msg91',
  whatsapp_api_key: '',
  whatsapp_sender_id: '',
  whatsapp_from_number: '',
  whatsapp_enabled: 'true',
  whatsapp_template_name: '',
  whatsapp_template_lang: 'en',
  whatsapp_template_namespace: '',
  whatsapp_api_version: 'v21.0',
};

export const CONNECTION_MODES = [
  { id: 'qr', label: '📱 QR Scan (Free)', desc: 'Scan from mobile' },
  { id: 'api', label: '🔑 API Key', desc: 'MSG91 / 2Factor etc.' },
];

export const NOTIFY_MODES = [
  { id: 'instant', label: 'Instant', desc: 'Send immediately when new status arrives' },
  { id: 'scheduled', label: 'Scheduled', desc: 'Send all pending notifications at a specific time daily' },
];

export const SAMPLE_TEMPLATES = [
  { label: '📄 Standard', preview: 'Formal, short', template: 'Dear {name},\n\nYour consignment *{awb}* status:\n\n📦 {status}\n\n_Committed Cargo Care Ltd._' },
  { label: '✈️ Air Cargo', preview: 'Airline style', template: '✈️ *Flight Update — Committed Cargo*\n\nDear {name},\n\nAWB No: *{awb}*\nStatus: {status}\n\nFor assistance: +91-XXXXXXXXXX\n\n_This is an auto-generated message._' },
  { label: '🚨 Urgent Alert', preview: 'Attention-grabbing', template: '🚨 *URGENT — Action Required*\n\nDear {name},\n\nYour shipment *{awb}* needs attention:\n\n⚠️ {status}\n\nPlease contact us immediately.\n📞 Call: +91-XXXXXXXXXX\n\n_Committed Cargo Care Ltd._' },
  { label: '🎉 Delivered', preview: 'Cheerful delivery', template: '🎉 Great News, {name}!\n\nYour consignment *{awb}* has been successfully delivered!\n\n✅ {status}\n\nThank you for choosing *Committed Cargo Care Ltd.*\nWe look forward to serving you again! 🌟' },
  { label: '🕒 Delay Notice', preview: 'Apology + ETA', template: 'Dear {name},\n\nWe regret to inform you that your consignment *{awb}* has been delayed.\n\n🕒 Current Status: {status}\n\nWe sincerely apologize for the inconvenience and are working to resolve this at the earliest.\n\n_Committed Cargo Care Ltd._' },
  { label: '📋 Customs Hold', preview: 'Customs clearance', template: '⚠️ *Customs Update — {name}*\n\nYour consignment *{awb}* is currently:\n\n🛑 {status}\n\nPlease arrange the required documents at the earliest to avoid demurrage charges.\n\n📞 Contact: +91-XXXXXXXXXX\n_Committed Cargo Care Ltd._' },
];

export const DEFAULT_TEMPLATE = SAMPLE_TEMPLATES[0].template;

export const TEMPLATE_VARIABLES = ['{name}', '{awb}', '{status}'];

export const ROUTING_MODULES = ['Admin', 'Purchase (Director)', 'HR Alerts', 'Operations Updates', 'Accounts'];

export const QR_STATUS = {
  starting: { label: 'Starting WhatsApp Web... (QR in about 30-60 seconds)', tone: 'primary' },
  disconnected: { label: 'Disconnected', tone: 'danger' },
  qr_ready: { label: 'Scan QR from mobile WhatsApp', tone: 'warning' },
  connecting: { label: 'Connecting...', tone: 'primary' },
  connected: { label: 'Connected', tone: 'success' },
};

export const STARTING_STATUSES = ['starting', 'connecting', 'qr_ready'];

export const autoSentMessages = (notifyMode, notifyTime) => [
  { icon: '🔑', label: 'Password Reset', desc: 'User Profile mobile → new password will be sent (always instant)' },
  { icon: '📦', label: 'Shipment Status (Client)', desc: 'Party Master mobile → ' + (notifyMode === 'instant' ? 'sent immediately' : 'queued, batch sent at ' + notifyTime) },
  { icon: '🔒', label: 'Account Lock/Activate', desc: 'Employee mobile → account status alert (always instant)' },
];

// WhatsApp formatting in the preview: *bold*, _italic_, sample values for the variables
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

// the typed template is plain text: it is escaped first, so only the preview's own markup becomes HTML
export const previewHtml = (template) => escapeHtml(template)
  .replace(/{name}/g, '<span class="tw:font-bold tw:text-green-700">ABC Exports Ltd.</span>')
  .replace(/{awb}/g, '<span class="tw:font-bold tw:text-blue-700">020-12345678</span>')
  .replace(/{status}/g, '<span class="tw:font-bold tw:text-red-700">Shipment arrived at Delhi Airport ✅</span>')
  .replace(/\*([^*]+)\*/g, '<b>$1</b>')
  .replace(/_([^_]+)_/g, '<i class="tw:text-neutral-600">$1</i>')
  .replace(/\n/g, '<br/>');
