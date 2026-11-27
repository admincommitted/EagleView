// SMTP comes from Settings > Email (table EmailConfig), with the .env SMTP_* values as fallback, so every mail
// (password reset, PO approval, test mail …) uses the SMTP set up on the Settings screen.
import nodemailer from 'nodemailer';
import * as settingsStore from '../common/settingsStore.js';

const SMTP_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE', 'SMTP_FROM_NAME'];
const DEFAULT_SMTP_HOST = 'smtp.gmail.com';
const DEFAULT_SMTP_PORT = '587';
const IMPLICIT_TLS_PORT = 465;
const DEFAULT_FROM_NAME = 'Committed Cargo ERP';
// the Settings screen shows saved secrets masked as "***…"; such a value means "keep the saved one"
const MASKED_VALUE_PREFIX = '***';

async function smtpConfig(override = {}) {
  const saved = await settingsStore.getMany(SMTP_KEYS);
  const pick = (key, envKey) => {
    const typed = override && override[key];
    if (typed != null && String(typed).trim() !== '' && !String(typed).startsWith(MASKED_VALUE_PREFIX))
      return String(typed).trim();
    if (saved[key] != null && saved[key] !== '') return saved[key];
    return process.env[envKey || key] || '';
  };
  const port = parseInt(pick('SMTP_PORT') || DEFAULT_SMTP_PORT, 10);
  const secureSetting = pick('SMTP_SECURE');
  return {
    host: pick('SMTP_HOST') || DEFAULT_SMTP_HOST,
    port,
    secure: secureSetting ? String(secureSetting) === 'true' : port === IMPLICIT_TLS_PORT,
    user: pick('SMTP_USER'),
    pass: pick('SMTP_PASS'),
    fromName: pick('SMTP_FROM_NAME') || DEFAULT_FROM_NAME,
  };
}

async function transport(override) {
  const config = await smtpConfig(override);
  if (!config.user || !config.pass) {
    const error = new Error('SMTP is not set up: enter the SMTP user and password in Settings > Email');
    error.status = 400;
    throw error;
  }
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  return { t: transporter, c: config };
}

const displayNameOf = (from) => (/^"?([^"<]+?)"?\s*</.exec(String(from || '')) || [])[1];

// "from" keeps the caller's display name but always uses the SMTP user's address (the server rejects other senders)
async function sendMail(options, override) {
  const { t: transporter, c: config } = await transport(override);
  const name = displayNameOf(options.from) || config.fromName;
  return transporter.sendMail({ ...options, from: `"${String(name).replace(/"/g, '')}" <${config.user}>` });
}

// drop-in for code that keeps a module-level transporter object
const lazyTransport = () => ({
  sendMail: (options, callback) => {
    const sending = sendMail(options);
    if (typeof callback === 'function') sending.then((result) => callback(null, result), callback);
    return sending;
  },
});

export { smtpConfig, transport, sendMail, lazyTransport };
