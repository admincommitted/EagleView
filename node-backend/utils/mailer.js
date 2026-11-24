// SMTP from Settings > Email (table EmailConfig), .env SMTP_* as fallback. 28-Oct-2026.
// Before, only the Settings test e-mail used the Settings SMTP; password reset and PO approval mails used .env only,
// so mail set up on the Settings screen did not reach them.
const nodemailer = require('nodemailer');

async function smtpConfig(override = {}) {
  const store = require('./settingsStore');
  const db = await store.getMany(['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE', 'SMTP_FROM_NAME']);
  const pick = (k, envKey) => {
    const o = override && override[k];
    if (o != null && String(o).trim() !== '' && !String(o).startsWith('***')) return String(o).trim(); // typed on the screen
    if (db[k] != null && db[k] !== '') return db[k];
    return process.env[envKey || k] || '';
  };
  const port = parseInt(pick('SMTP_PORT') || '587', 10);
  const secureRaw = pick('SMTP_SECURE');
  return {
    host: pick('SMTP_HOST') || 'smtp.gmail.com',
    port,
    secure: secureRaw ? String(secureRaw) === 'true' : port === 465,
    user: pick('SMTP_USER'),
    pass: pick('SMTP_PASS'),
    fromName: pick('SMTP_FROM_NAME') || 'Committed Cargo ERP',
  };
}

async function transport(override) {
  const c = await smtpConfig(override);
  if (!c.user || !c.pass) { const e = new Error('SMTP is not set up: enter the SMTP user and password in Settings > Email'); e.status = 400; throw e; }
  return { t: nodemailer.createTransport({ host: c.host, port: c.port, secure: c.secure, auth: { user: c.user, pass: c.pass } }), c };
}

// send with the Settings SMTP; "from" keeps the caller's display name but uses the SMTP user's address
async function sendMail(opts, override) {
  const { t, c } = await transport(override);
  const name = (/^"?([^"<]+?)"?\s*</.exec(String(opts.from || '')) || [])[1] || c.fromName;
  return t.sendMail({ ...opts, from: `"${String(name).replace(/"/g, '')}" <${c.user}>` });
}

// drop-in for code that kept a module-level transporter
const lazyTransport = () => ({ sendMail: (opts, cb) => { const p = sendMail(opts); if (typeof cb === 'function') p.then(r => cb(null, r), cb); return p; } });

module.exports = { smtpConfig, transport, sendMail, lazyTransport };
