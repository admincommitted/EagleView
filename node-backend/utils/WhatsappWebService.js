/**
 * WhatsappWebService.js
 * WhatsApp Web automation via QR code scan (whatsapp-web.js)
 * No API key needed — just scan QR from mobile WhatsApp
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');

// ── State ────────────────────────────────────────────────────────
let client = null;
let currentQR = null;          // base64 QR image string
let connectionStatus = 'disconnected'; // 'disconnected' | 'qr_ready' | 'connecting' | 'connected'
let connectedNumber = null;
const messageCallbacks = [];   // SSE subscribers for QR updates
// 09-Nov-2026: why the last start failed (shown under DISCONNECTED in Settings > WhatsApp). Before, a failed start
// only went to the backend console and the screen stayed on "Disconnected" with nothing to say why.
let lastError = null;
let startedAt = null;
let watchdog = null;
const fs = require('fs');

// ── Normalize Indian number for WhatsApp ─────────────────────────
function toWhatsAppId(num) {
  if (!num) return null;
  let n = String(num).replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.length === 10) n = '91' + n;
  else if (n.startsWith('0') && n.length === 11) n = '91' + n.slice(1);
  if (n.length < 11 || n.length > 15) return null; // 28-Oct-2026: short / wrong numbers were sent as they were
  return n + '@c.us';
}

// ── Notify all SSE subscribers ───────────────────────────────────
function notifySubscribers(data) {
  const msg = JSON.stringify(data);
  messageCallbacks.forEach(cb => { try { cb(msg); } catch(e) {} });
}

// ── Initialize / Start WhatsApp Client ──────────────────────────
function initClient(force) {
  // a start that never reached QR / ready within 2 minutes may be restarted from the Connect button
  if (client && !force) return; // already initialized
  if (client && force) { const old = client; client = null; old.destroy().catch(() => {}); }

  const sessionPath = path.join(__dirname, '..', '.whatsapp-session');
  // Chrome leaves lock files in the profile when the backend was closed while it ran; the next start then fails
  // with "The browser is already running". No client is running here, so they are stale.
  for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile']) {
    try { fs.rmSync(path.join(sessionPath, 'session', f), { force: true }); } catch (e) { /* not there */ }
  }
  lastError = null; startedAt = new Date().toISOString(); connectionStatus = 'starting';
  notifySubscribers({ type: 'status', status: 'starting' });
  if (watchdog) clearTimeout(watchdog);
  watchdog = setTimeout(() => {
    if (connectionStatus === 'starting') {
      lastError = 'WhatsApp Web did not open within 2 minutes (no QR). Check the internet on this PC and click Connect again.';
      console.error('[WhatsApp Web]', lastError);
      const old = client; client = null; connectionStatus = 'disconnected';
      if (old) old.destroy().catch(() => {});
      notifySubscribers({ type: 'status', status: 'disconnected', error: lastError });
    }
  }, 120000);

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }),
    webVersionCache: {
      type: 'none',
    },
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        // 09-Nov-2026: '--single-process' and '--no-zygote' removed - on Windows Chrome closes the page's frame while
        // WhatsApp Web loads with them ("Navigating frame was detached") and no QR ever came
        '--disable-gpu'
      ]
    }
  });

  // QR Code generated — convert to base64 image
  client.on('qr', async (qr) => {
    console.log('[WhatsApp Web] QR Code generated — scan from mobile');
    connectionStatus = 'qr_ready'; lastError = null;
    try {
      currentQR = await qrcode.toDataURL(qr, { width: 280, margin: 2 });
      notifySubscribers({ type: 'qr', qr: currentQR, status: 'qr_ready' });
    } catch (e) {
      console.error('[WhatsApp Web] QR generation failed:', e.message);
    }
  });

  // Loading screen
  client.on('loading_screen', (percent) => {
    console.log('[WhatsApp Web] Loading:', percent + '%');
    connectionStatus = 'connecting';
    notifySubscribers({ type: 'status', status: 'connecting', percent });
  });

  // Successfully authenticated
  client.on('authenticated', () => {
    console.log('[WhatsApp Web] Authenticated!');
    currentQR = null;
    connectionStatus = 'connecting';
    notifySubscribers({ type: 'status', status: 'connecting' });
  });

  // the saved login was refused (logged out from the phone): a new QR is needed
  client.on('auth_failure', (msg) => {
    lastError = 'Saved WhatsApp login was refused (' + (msg || 'auth failure') + '). Click Connect again for a new QR.';
    console.error('[WhatsApp Web]', lastError);
    notifySubscribers({ type: 'status', status: 'disconnected', error: lastError });
  });

  // Ready to send messages
  client.on('ready', async () => {
    connectionStatus = 'connected'; lastError = null;
    const info = client.info;
    connectedNumber = info?.wid?.user || 'Unknown';
    console.log('[WhatsApp Web] READY! Connected as:', connectedNumber);
    notifySubscribers({ type: 'status', status: 'connected', number: connectedNumber });
  });

  // Disconnected
  client.on('disconnected', (reason) => {
    console.log('[WhatsApp Web] Disconnected:', reason);
    lastError = reason ? 'WhatsApp logged out: ' + reason : null;
    connectionStatus = 'disconnected';
    connectedNumber = null;
    currentQR = null;
    client = null;
    notifySubscribers({ type: 'status', status: 'disconnected', reason, error: lastError });
  });

  const mine = client;
  client.initialize().catch(err => {
    console.error('[WhatsApp Web] Init error:', err.message);
    if (client !== mine) return; // a newer start replaced this one
    lastError = 'WhatsApp could not start: ' + String(err.message || err).split('\n')[0].slice(0, 300);
    connectionStatus = 'disconnected';
    client = null;
    notifySubscribers({ type: 'status', status: 'disconnected', error: lastError });
  });
}

// ── Send a text message ─────────────────────────────────────────
async function sendMessage(toNumber, message) {
  if (!client || connectionStatus !== 'connected') {
    throw new Error('WhatsApp not connected. Please scan QR code first.');
  }
  const chatId = toWhatsAppId(toNumber);
  if (!chatId) { const e = new Error('Mobile number not valid: ' + (toNumber || '(empty)') + ' - give 10 digits, or the full number with country code'); e.status = 400; throw e; }
  // a number without WhatsApp: say so (before, the send "worked" and nothing arrived). 28-Oct-2026
  try {
    if (typeof client.isRegisteredUser === 'function' && !(await client.isRegisteredUser(chatId))) { const e = new Error('This number is not on WhatsApp: ' + toNumber); e.status = 400; throw e; }
  } catch (e) { if (e.status) throw e; /* check not available: just send */ }
  await client.sendMessage(chatId, message);
  console.log('[WhatsApp Web] Message sent to:', toNumber);
  return { success: true, to: toNumber };
}

// 08-Nov-2026: a file (the invoice PDF) with a caption
async function sendDocument(toNumber, buffer, filename, caption, mimetype = 'application/pdf') {
  if (!client || connectionStatus !== 'connected') throw new Error('WhatsApp not connected. Please scan QR code first.');
  const chatId = toWhatsAppId(toNumber);
  if (!chatId) { const e = new Error('Mobile number not valid: ' + (toNumber || '(empty)') + ' - give 10 digits, or the full number with country code'); e.status = 400; throw e; }
  try {
    if (typeof client.isRegisteredUser === 'function' && !(await client.isRegisteredUser(chatId))) { const e = new Error('This number is not on WhatsApp: ' + toNumber); e.status = 400; throw e; }
  } catch (e) { if (e.status) throw e; }
  const media = new MessageMedia(mimetype, Buffer.from(buffer).toString('base64'), filename);
  await client.sendMessage(chatId, media, { caption: caption || '', sendMediaAsDocument: true });
  console.log('[WhatsApp Web] Document sent to:', toNumber, filename);
  return { success: true, to: toNumber };
}

// ── Send Shipment Status to Party ────────────────────────────────
async function sendShipmentStatus(partyName, mobileNumber, awbNumber, statusText) {
  const template = (await require('./settingsStore').get('whatsapp_status_template')) || // table WhatsappConfig
    'Dear {name},\n\nYour consignment *{awb}* status:\n\n\u{1F4E6} {status}\n\n_Committed Cargo Care Ltd._';

  const message = template
    .replace(/{name}/g, partyName || 'Valued Customer')
    .replace(/{awb}/g, awbNumber || '')
    .replace(/{status}/g, statusText || '');

  return await sendMessage(mobileNumber, message);
}

// ── Send Internal Notification ────────────────────────────────────
async function sendInternalNotification(employeeName, mobileNumber, messageType, data) {
  data = data || {};
  let message = '';
  switch (messageType) {
    case 'password_reset':
      message = '*Committed Cargo ERP*\n\nHello ' + employeeName + ',\n\nYour password has been reset.\n\n\uD83D\uDD11 New Password: *' + data.newPassword + '*\n\nPlease login and change it immediately.\n\n_This is an automated security alert._';
      break;
    case 'account_lock':
      message = '*Committed Cargo ERP*\n\nHello ' + employeeName + ',\n\n\u26A0\uFE0F Your account has been *locked*. Contact admin.\n\n_Committed Cargo Care Ltd._';
      break;
    case 'account_activate':
      message = '*Committed Cargo ERP*\n\nHello ' + employeeName + ',\n\n\u2705 Your account has been *activated*. You can now login.\n\n_Committed Cargo Care Ltd._';
      break;
    default:
      message = '*Committed Cargo ERP*\n\nHello ' + employeeName + ',\n\n' + (data.text || 'You have a new notification.') + '\n\n_Committed Cargo Care Ltd._';
  }
  return await sendMessage(mobileNumber, message);
}

// ── Disconnect ────────────────────────────────────────────────────
async function disconnect() {
  if (client) {
    await client.destroy().catch(() => {});
    client = null;
  }
  connectionStatus = 'disconnected';
  connectedNumber = null;
  currentQR = null;
}

// ── Subscribe to live updates (for SSE) ──────────────────────────
function subscribe(callback) {
  messageCallbacks.push(callback);
  return () => {
    const idx = messageCallbacks.indexOf(callback);
    if (idx > -1) messageCallbacks.splice(idx, 1);
  };
}

// ── Get current state ─────────────────────────────────────────────
function getState() {
  return { status: connectionStatus, qr: currentQR, number: connectedNumber, error: lastError, startedAt };
}

module.exports = { initClient, sendMessage, sendDocument, sendShipmentStatus, sendInternalNotification, disconnect, subscribe, getState };
