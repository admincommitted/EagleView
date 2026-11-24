const express = require('express');
const router = express.Router();
const AppSetting = require('../models/AppSetting');
// 14-Nov-2026 (security check): writing settings, keys and connections is for an admin only
const { requireAdmin } = require('../middleware/auth');
const { Client } = require('ssh2');

// 28-Oct-2026: settings live in their own tables (models/SettingsTables.js) through utils/settingsStore.js; the
// screens keep their key names. Before, every secret except a few was sent to the browser in clear (SMTP_PASS,
// ULIP_PASSWORD, whatsapp_api_key did not match the mask check), an empty field could not be cleared, and a
// true/false value crashed the bulk save.
const store = require('../utils/settingsStore');
const fail = (res, e) => res.status(e.status || 500).json({ success: false, error: e.message, errors: e.errors });

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    res.json(await store.getPublic());
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/settings
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { key, value } = req.body || {};
    if (!key) return res.status(400).json({ error: 'Key is required' });
    await store.setMany({ [key]: value });
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving setting:', error.message);
    fail(res, error);
  }
});

// POST /api/settings/bulk
router.post('/bulk', requireAdmin, async (req, res) => {
  try {
    const { settings } = req.body; // { key: value, ... }
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    await store.setMany(settings);
    require('../utils/webSecurity').clearCache(); // public address / office IPs used at once (14-Nov-2026)
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error in bulk update:', error.message);
    fail(res, error);
  }
});

// GET /api/settings/security-check (14-Nov-2026): how this server sees the caller - for the Security tab
router.get('/security-check', (req, res) => {
  const ws = require('../utils/webSecurity');
  res.json({ success: true, data: { ip: ws.normIp(req.ip), office: ws.isOfficeIp(req.ip), https: !!req.secure, linkBase: ws.publicBase(req), trustProxy: String(require('../utils/webSecurity').trustProxySetting()) } });
});

// POST /api/settings/test-sftp
router.post('/test-sftp', requireAdmin, async (req, res) => {
  try {
    // Always load all settings from DB first
    const cfg = await store.getAll();

    // Resolve active host based on env
    const env        = req.body.env || cfg['sftp_active_env'] || 'test';
    const activeHost = env === 'test'
      ? (cfg['sftp_test_host'] || cfg['sftp_host'] || 'ftptest.myvan.descartes.com')
      : (cfg['sftp_prod_host'] || cfg['sftp_host'] || 'ftp.myvan.descartes.com');

    // Frontend can override host/port/username — but private key always from DB if masked/missing
    const host       = req.body.host     || activeHost;
    const port       = parseInt(req.body.port || cfg['sftp_port'] || '22');
    const username   = req.body.username || cfg['sftp_username'] || '';
    const passphrase = req.body.passphrase || cfg['sftp_passphrase'] || '';

    // Private key: use DB value — never trust masked '***' from frontend
    const rawKey   = req.body.privateKey;
    const isMasked = !rawKey || rawKey === '***' || rawKey === 'undefined';
    const privateKey = isMasked
      ? (cfg['sftp_private_key'] || '')   // always read real key from DB
      : rawKey;

    // Password fallback (only if no private key)
    const rawPwd  = req.body.password;
    const password = (!rawPwd || rawPwd === '***') ? (cfg['sftp_password'] || '') : rawPwd;

    // Validate
    if (!username) {
      return res.json({ success: false, message: 'Username not configured. Enter SFTP username in Settings.' });
    }
    if (!privateKey && !password) {
      return res.json({ success: false, message: 'No SSH key found in database. Please generate an SSH key first.' });
    }

    const conn = new Client();
    conn.on('ready', () => {
      conn.end();
      res.json({ success: true, message: `Connected to ${host}:${port} successfully! [${env.toUpperCase()}]` });
    });
    conn.on('error', (err) => {
      res.json({ success: false, message: `Connection failed: ${err.message}` });
    });

    const connectOptions = {
      host, port, username,
      readyTimeout: 60000, // 60s for test
      algorithms: {
        // Same as FsuService.js — chacha20-poly1305 causes ECONNRESET on Descartes
        cipher: ['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com', 'aes256-ctr', 'aes192-ctr', 'aes128-ctr'],
        kex:    ['diffie-hellman-group-exchange-sha256', 'ecdh-sha2-nistp256', 'ecdh-sha2-nistp384'],
        hmac:   ['hmac-sha2-256', 'hmac-sha2-512'],
      },
    };

    if (privateKey) {
      connectOptions.privateKey = privateKey;
      if (passphrase) connectOptions.passphrase = passphrase;
    } else {
      connectOptions.password = password;
    }

    conn.connect(connectOptions);

  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// POST /api/settings/export-private-key
// Reads private key from DB and returns it for download (works anytime).
router.post('/export-private-key', requireAdmin, async (req, res) => {
  try {
    const setting = { value: await store.get('sftp_private_key') };

    if (!setting || !setting.value) {
      return res.json({
        success: false,
        message: 'Private key not found in DB. Please generate SSH key first.',
      });
    }

    res.json({
      success: true,
      privateKey: setting.value,
      message: 'Private key successfully exported.',
    });
  } catch (error) {
    console.error('Error exporting private key:', error);
    res.status(500).json({ error: 'Failed to export private key', message: error.message });
  }
});

// POST /api/settings/export-public-key
// Derives the OpenSSH public key from the stored private key — works anytime.
router.post('/export-public-key', requireAdmin, async (req, res) => {
  try {
    const setting = { value: await store.get('sftp_private_key') };

    if (!setting || !setting.value) {
      return res.json({
        success: false,
        message: 'Private key not found in database. Please generate an SSH key first.',
      });
    }

    const crypto        = require('crypto');
    const privateKeyObj = crypto.createPrivateKey(setting.value);
    const publicKeyPem  = crypto.createPublicKey(privateKeyObj).export({ type: 'spki', format: 'pem' });

    // Use the same RFC 4251-compliant encoder used during key generation
    const sshPublicKey = convertPemToOpenSsh(publicKeyPem, 'edi-automation');

    res.json({ success: true, publicKey: sshPublicKey, message: 'Public key derived from stored private key.' });
  } catch (error) {
    console.error('Error exporting public key:', error);
    res.status(500).json({ error: 'Failed to derive public key', message: error.message });
  }

});

// Generates RSA 4096-bit SSH key pair. Returns public key; optionally saves private key to DB.
router.post('/generate-ssh-key', requireAdmin, async (req, res) => {
  try {
    const crypto = require('crypto');
    const { saveToDb } = req.body;

    // Generate RSA 4096-bit key pair (as recommended by Descartes FAQ Q3)
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding:  { type: 'spki',  format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, // PKCS1 = -----BEGIN RSA PRIVATE KEY-----
    });

    // Convert SPKI PEM → OpenSSH "ssh-rsa ..." format
    const sshPublicKey = convertPemToOpenSsh(publicKey, 'edi-automation-descartes');

    if (saveToDb) {
      await store.setMany({ sftp_private_key: privateKey });
      await (await store.row('SftpConfig')).update({ publicKey: sshPublicKey });
    }

    res.json({
      success: true,
      publicKey: sshPublicKey,
      privateKeyPem: privateKey,
      savedToDb: !!saveToDb,
      message: 'SSH key pair generated! Copy the Public Key and email it to Descartes (Dejin).',
    });
  } catch (error) {
    console.error('Error generating SSH key:', error);
    res.status(500).json({ error: 'Failed to generate SSH key', message: error.message });
  }
});

/** Convert RSA PEM public key → proper OpenSSH wire format (ssh-rsa AAAA... comment)
 *  Follows RFC 4251 (SSH Protocol) — MPIntegers must have a leading 0x00 byte
 *  if the high bit is set, to indicate a positive two's complement number.
 *  Without this, a 4096-bit RSA modulus (which always has its high bit set)
 *  would be interpreted as a negative number and rejected by any SSH server.
 */
function convertPemToOpenSsh(pemPublicKey, comment = 'edi-automation') {
  const crypto = require('crypto');
  const keyObj  = crypto.createPublicKey(pemPublicKey);
  const jwk     = keyObj.export({ format: 'jwk' }); // e and n as base64url

  // Encode an SSH string field: 4-byte big-endian length + bytes
  function encodeStr(str) {
    const data = Buffer.from(str, 'utf8');
    const len  = Buffer.alloc(4); len.writeUInt32BE(data.length); return Buffer.concat([len, data]);
  }

  // Encode an SSH MPInteger (RFC 4251 §5):
  // JWK encodes integers as minimum-length unsigned big-endian (no leading zeros).
  // SSH requires a leading 0x00 byte when the high bit of the first byte is set,
  // so the integer is unambiguously positive in two's complement encoding.
  function encodeMPInt(b64url) {
    const raw  = Buffer.from(b64url, 'base64'); // base64url-safe decode
    const padded = (raw[0] >= 0x80) ? Buffer.concat([Buffer.alloc(1), raw]) : raw;
    const len  = Buffer.alloc(4); len.writeUInt32BE(padded.length);
    return Buffer.concat([len, padded]);
  }

  const wireBytes = Buffer.concat([
    encodeStr('ssh-rsa'),  // key type identifier
    encodeMPInt(jwk.e),    // public exponent (e.g. 65537)
    encodeMPInt(jwk.n),    // modulus (512 bytes for RSA-4096, needs leading 0x00)
  ]);

  return `ssh-rsa ${wireBytes.toString('base64')}${comment ? ' ' + comment : ''}`;
}

// System Setup: company profile (own table CompanyProfile). 28-Oct-2026
const COMPANY_FIELDS = ['companyName', 'legalName', 'address1', 'address2', 'city', 'state', 'pincode', 'country', 'gstin', 'pan', 'iec', 'cin', 'phone', 'email', 'website', 'defaultCurrency', 'timezone', 'dateFormat',
  // 30-Oct-2026: added with the Company Settings screen - tagline/LUT, the bank block printed on invoices, the logo, and the e-invoice API login
  'tagline', 'lutNo', 'logoDataUrl', 'bankName', 'accountName', 'accountNo', 'ifsc', 'swift', 'einvoiceUser', 'einvoicePass', 'einvoiceBaseUrl',
  // 08-Nov-2026: invoice print - fax, registered office, notes
  'fax', 'registeredOffice', 'invoiceNotes'];
// 08-Nov-2026: the logo the GST invoice prints when none is uploaded (node-backend/assets/company_logo.jpg)
router.get('/company/default-logo', async (req, res) => {
  try {
    const f = require('path').join(__dirname, '..', 'assets', 'company_logo.jpg');
    const ok = require('fs').existsSync(f);
    res.json({ success: true, dataUrl: ok ? 'data:image/jpeg;base64,' + require('fs').readFileSync(f).toString('base64') : '' });
  } catch (e) { fail(res, e); }
});
router.get('/company', async (req, res) => {
  // 08-Nov-2026: the e-invoice API password is never sent to the browser - only whether one is saved
  try { const r = await store.row('CompanyProfile'); const d = r.toJSON(); d.hasEinvoicePass = !!d.einvoicePass; delete d.einvoicePass; res.json({ success: true, data: d }); } catch (e) { fail(res, e); }
});
router.put('/company', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {}; const v = {}; const errors = [];
    for (const f of COMPANY_FIELDS) if (b[f] !== undefined) v[f] = b[f] == null ? null : String(b[f]).trim() || null;
    ['gstin', 'pan', 'iec', 'cin', 'defaultCurrency', 'state', 'country', 'ifsc', 'swift'].forEach(f => { if (v[f]) v[f] = v[f].toUpperCase(); });
    if (!v.companyName && b.companyName !== undefined) errors.push('Company name is required');
    if (v.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v.gstin)) errors.push('GSTIN must be 15 characters like 07AAACC1234D1Z5');
    if (v.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(v.pan)) errors.push('PAN must be like AAACC1234D');
    if (v.iec && !/^[A-Z0-9]{10}$/.test(v.iec)) errors.push('IEC must be 10 characters');
    if (v.gstin && v.pan && v.gstin.slice(2, 12) !== v.pan) errors.push('PAN does not match the GSTIN (characters 3-12)');
    if (v.pincode && !/^\d{6}$/.test(v.pincode)) errors.push('PIN code must be 6 digits');
    if (v.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.ifsc.toUpperCase())) errors.push('IFSC must be 11 characters like HDFC0000123');
    if (v.swift && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v.swift.toUpperCase())) errors.push('SWIFT / BIC must be 8 or 11 characters like HDFCINBB or HDFCINBBXXX');
    if (v.accountNo && !/^[0-9A-Z]{5,34}$/.test(v.accountNo.toUpperCase())) errors.push('Bank account number looks wrong (5 to 34 letters or digits, no spaces)');
    if (v.lutNo && v.lutNo.length > 60) errors.push('LUT number is too long');
    if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) errors.push('Email is not valid');
    if (v.defaultCurrency && !/^[A-Z]{3}$/.test(v.defaultCurrency)) errors.push('Currency must be a 3-letter code (INR)');
    if (errors.length) return res.status(400).json({ success: false, error: errors.join('; '), errors });
    if (v.fax && v.fax.length > 30) return res.status(400).json({ success: false, error: 'Fax number is too long', errors: ['Fax number is too long'] });
    const r = await store.row('CompanyProfile'); await r.update(v);
    const d = r.toJSON(); d.hasEinvoicePass = !!d.einvoicePass; delete d.einvoicePass;
    res.json({ success: true, data: d });
  } catch (e) { fail(res, e); }
});

// GET /api/settings/sftp-status — live Descartes SFTP connection status
router.get('/sftp-status', (req, res) => {
  try {
    const { getSftpStatus } = require('../utils/FsuService');
    const status = getSftpStatus();
    // Consider "connected" only if lastConnectedAt is within 15 minutes
    const stale = status.lastConnectedAt
      ? (Date.now() - new Date(status.lastConnectedAt).getTime()) > 15 * 60 * 1000
      : true;
    res.json({
      connected:       status.connected && !stale,
      lastConnectedAt: status.lastConnectedAt,
      lastCheckedAt:   status.lastCheckedAt,
      lastError:       status.lastError,
      host:            status.host,
      env:             status.env,
      stale,
    });
  } catch (e) {
    res.json({ connected: false, lastError: e.message });
  }
});


// ---------------------------------------------------------------------------
// Email (SMTP) block of the Company Settings screen. The Settings > Email tab
// already writes EmailConfig through /bulk; this is the same row, by name, so
// the Company Settings screen does not need its own storage. Added 30-Oct-2026.
// ---------------------------------------------------------------------------
const EMAIL_FIELDS = ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'smtpSecure', 'fromName'];
router.get('/email', async (req, res) => {
  try {
    const r = await store.row('EmailConfig');
    const d = r.toJSON();
    // never hand the stored password back to the browser - say whether one is set instead
    const hasPass = !!d.smtpPass;
    delete d.smtpPass;
    res.json({ success: true, data: { ...d, hasPassword: hasPass } });
  } catch (e) { fail(res, e); }
});
router.put('/email', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {}; const v = {}; const errors = [];
    for (const f of EMAIL_FIELDS) if (b[f] !== undefined) v[f] = b[f];
    if (v.smtpPort !== undefined && v.smtpPort !== null && v.smtpPort !== '') {
      const n = parseInt(v.smtpPort, 10);
      if (!(n > 0 && n < 65536)) errors.push('SMTP port must be a number between 1 and 65535');
      else v.smtpPort = n;
    }
    if (v.smtpUser && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v.smtpUser))) errors.push('SMTP username should be the full email address');
    // an empty password box means "leave the stored one alone", not "clear it"
    if (v.smtpPass === '' || v.smtpPass === '********') delete v.smtpPass;
    if (v.smtpSecure !== undefined) v.smtpSecure = !!v.smtpSecure;
    if (errors.length) return res.status(400).json({ success: false, error: errors.join('; '), errors });
    const r = await store.row('EmailConfig'); await r.update(v);
    const d = r.toJSON(); const hasPass = !!d.smtpPass; delete d.smtpPass;
    res.json({ success: true, data: { ...d, hasPassword: hasPass } });
  } catch (e) { fail(res, e); }
});

// ---------------------------------------------------------------------------
// POST /api/settings/test-einvoice
// The screen's "Test E-Invoice API Connection" button used to do nothing at all.
// This actually opens the configured GSP / NIC endpoint and reports exactly what
// came back. It never reports success it did not get: no URL configured, an
// unreachable host and an HTTP error are three different answers.
// ---------------------------------------------------------------------------
router.post('/test-einvoice', requireAdmin, async (req, res) => {
  const started = Date.now();
  let row = null;
  try { row = await store.row('CompanyProfile'); } catch (e) { return fail(res, e); }
  const p = row.toJSON();
  const url = String((req.body && req.body.baseUrl) || p.einvoiceBaseUrl || '').trim();
  const user = String((req.body && req.body.username) || p.einvoiceUser || '').trim();
  const save = async (ok, message) => {
    try { await row.update({ einvoiceLastTestAt: new Date(), einvoiceLastTestOk: ok, einvoiceLastTestMessage: String(message).slice(0, 500) }); } catch (e) { /* the answer matters more than the log */ }
  };
  if (!url) {
    const msg = 'No e-invoice API URL is saved yet. Fill "E-Invoice API URL" with the endpoint your GSP gave you (for example https://<gsp-host>/eivital/v1.04/auth) and save, then test.';
    await save(false, msg);
    return res.status(400).json({ success: false, configured: false, error: msg });
  }
  if (!/^https?:\/\//i.test(url)) {
    const msg = 'The e-invoice API URL must start with https:// - got "' + url + '"';
    await save(false, msg);
    return res.status(400).json({ success: false, configured: false, error: msg });
  }
  if (!user) {
    const msg = 'The e-invoice API username is empty, so there is nothing to authenticate with. The URL itself can still be reached - fill the username and password before filing.';
    await save(false, msg);
    return res.status(400).json({ success: false, configured: false, error: msg });
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { method: 'GET', signal: ctl.signal, headers: { 'User-Agent': 'EDI-Automation/settings-test' } });
    clearTimeout(timer);
    const ms = Date.now() - started;
    let body = '';
    try { body = (await r.text()).slice(0, 300); } catch (e) { body = ''; }
    // A GSP auth endpoint answering 401/403/405 to a bare GET still proves the host is reachable and the
    // path exists. That is as far as a test can honestly go without sending the real credentials.
    const reachable = true;
    const looksRight = r.status < 500;
    const msg = 'Host answered HTTP ' + r.status + ' in ' + ms + ' ms'
      + (looksRight ? ' - the endpoint is reachable. A 401/403/405 here is normal: the real login is only sent when an invoice is filed.'
                    : ' - the endpoint is reachable but returned a server error, so it is not ready to file against.')
      + (body ? ' Response starts: ' + body.replace(/\s+/g, ' ').slice(0, 160) : '');
    await save(looksRight, msg);
    return res.json({ success: looksRight, configured: true, reachable, httpStatus: r.status, ms, message: msg,
      username: user, url, body: body || undefined });
  } catch (e) {
    clearTimeout(timer);
    const ms = Date.now() - started;
    const aborted = e.name === 'AbortError';
    const msg = aborted
      ? 'No answer from ' + url + ' within 12 seconds. Check the URL, and whether this server is allowed out to that host.'
      : 'Could not reach ' + url + ' - ' + e.message + '. Check the URL, DNS, and the firewall / proxy on this server.';
    await save(false, msg);
    return res.status(502).json({ success: false, configured: true, reachable: false, ms, error: msg });
  }
});

module.exports = router;
