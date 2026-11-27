/**
 * WhatsApp Web automation via QR code scan (whatsapp-web.js).
 * No API key needed — just scan the QR from mobile WhatsApp.
 */
import fs from 'node:fs';
import path from 'node:path';
import qrcode from 'qrcode';
import whatsappWeb from 'whatsapp-web.js';
import { BACKEND_ROOT } from '../../config/env.js';
import * as settingsStore from '../common/settingsStore.js';

const { Client, LocalAuth, MessageMedia } = whatsappWeb;

const SESSION_PATH = path.join(BACKEND_ROOT, '.whatsapp-session');
// Chrome leaves these lock files in the profile when the backend was closed while it ran; the next start then fails
// with "The browser is already running". No client is running when a start begins, so they are stale.
const STALE_CHROME_LOCK_FILES = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile'];
const START_TIMEOUT_MS = 120000;
const QR_IMAGE_OPTIONS = { width: 280, margin: 2 };
const ERROR_TEXT_MAX = 300;
const NOT_CONNECTED_MESSAGE = 'WhatsApp not connected. Please scan QR code first.';
const DEFAULT_STATUS_TEMPLATE =
  'Dear {name},\n\nYour consignment *{awb}* status:\n\n\u{1F4E6} {status}\n\n_Committed Cargo Care Ltd._';

// '--single-process' and '--no-zygote' must stay out: on Windows Chrome then detaches the page's frame while
// WhatsApp Web loads ("Navigating frame was detached") and no QR ever comes
const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--disable-gpu',
];

let client = null;
let currentQR = null; // base64 QR image string
let connectionStatus = 'disconnected'; // 'disconnected' | 'starting' | 'qr_ready' | 'connecting' | 'connected'
let connectedNumber = null;
const subscribers = []; // SSE subscribers for QR / status updates
// why the last start failed: shown under DISCONNECTED in Settings > WhatsApp
let lastError = null;
let startedAt = null;
let startWatchdog = null;

function toWhatsAppId(number) {
  if (!number) return null;
  let digits = String(number).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10) digits = '91' + digits;
  else if (digits.startsWith('0') && digits.length === 11) digits = '91' + digits.slice(1);
  if (digits.length < 11 || digits.length > 15) return null; // short / wrong numbers are refused
  return digits + '@c.us';
}

function notifySubscribers(data) {
  const message = JSON.stringify(data);
  subscribers.forEach((callback) => {
    try {
      callback(message);
    } catch {
      /* a closed SSE stream */
    }
  });
}

const destroyQuietly = (oldClient) => {
  oldClient.destroy().catch(() => {});
};

function removeStaleChromeLocks() {
  for (const fileName of STALE_CHROME_LOCK_FILES) {
    try {
      fs.rmSync(path.join(SESSION_PATH, 'session', fileName), { force: true });
    } catch {
      /* not there */
    }
  }
}

function armStartWatchdog() {
  if (startWatchdog) clearTimeout(startWatchdog);
  startWatchdog = setTimeout(() => {
    if (connectionStatus !== 'starting') return;
    lastError =
      'WhatsApp Web did not open within 2 minutes (no QR). Check the internet on this PC and click Connect again.';
    console.error('[WhatsApp Web]', lastError);
    const oldClient = client;
    client = null;
    connectionStatus = 'disconnected';
    if (oldClient) destroyQuietly(oldClient);
    notifySubscribers({ type: 'status', status: 'disconnected', error: lastError });
  }, START_TIMEOUT_MS);
}

function attachClientEvents(whatsappClient) {
  whatsappClient.on('qr', async (qr) => {
    console.log('[WhatsApp Web] QR Code generated — scan from mobile');
    connectionStatus = 'qr_ready';
    lastError = null;
    try {
      currentQR = await qrcode.toDataURL(qr, QR_IMAGE_OPTIONS);
      notifySubscribers({ type: 'qr', qr: currentQR, status: 'qr_ready' });
    } catch (e) {
      console.error('[WhatsApp Web] QR generation failed:', e.message);
    }
  });

  whatsappClient.on('loading_screen', (percent) => {
    console.log('[WhatsApp Web] Loading:', percent + '%');
    connectionStatus = 'connecting';
    notifySubscribers({ type: 'status', status: 'connecting', percent });
  });

  whatsappClient.on('authenticated', () => {
    console.log('[WhatsApp Web] Authenticated!');
    currentQR = null;
    connectionStatus = 'connecting';
    notifySubscribers({ type: 'status', status: 'connecting' });
  });

  // the saved login was refused (logged out from the phone): a new QR is needed
  whatsappClient.on('auth_failure', (message) => {
    lastError =
      'Saved WhatsApp login was refused (' + (message || 'auth failure') + '). Click Connect again for a new QR.';
    console.error('[WhatsApp Web]', lastError);
    notifySubscribers({ type: 'status', status: 'disconnected', error: lastError });
  });

  whatsappClient.on('ready', async () => {
    connectionStatus = 'connected';
    lastError = null;
    const info = client.info;
    connectedNumber = info?.wid?.user || 'Unknown';
    console.log('[WhatsApp Web] READY! Connected as:', connectedNumber);
    notifySubscribers({ type: 'status', status: 'connected', number: connectedNumber });
  });

  whatsappClient.on('disconnected', (reason) => {
    console.log('[WhatsApp Web] Disconnected:', reason);
    lastError = reason ? 'WhatsApp logged out: ' + reason : null;
    connectionStatus = 'disconnected';
    connectedNumber = null;
    currentQR = null;
    client = null;
    notifySubscribers({ type: 'status', status: 'disconnected', reason, error: lastError });
  });
}

async function startClient(whatsappClient) {
  try {
    await whatsappClient.initialize();
  } catch (err) {
    console.error('[WhatsApp Web] Init error:', err.message);
    if (client !== whatsappClient) return; // a newer start replaced this one
    lastError =
      'WhatsApp could not start: ' +
      String(err.message || err)
        .split('\n')[0]
        .slice(0, ERROR_TEXT_MAX);
    connectionStatus = 'disconnected';
    client = null;
    notifySubscribers({ type: 'status', status: 'disconnected', error: lastError });
  }
}

// a start that never reached QR / ready may be restarted from the Connect button (force)
function initClient(force) {
  if (client && !force) return;
  if (client && force) {
    const oldClient = client;
    client = null;
    destroyQuietly(oldClient);
  }

  removeStaleChromeLocks();
  lastError = null;
  startedAt = new Date().toISOString();
  connectionStatus = 'starting';
  notifySubscribers({ type: 'status', status: 'starting' });
  armStartWatchdog();

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
    webVersionCache: { type: 'none' },
    puppeteer: { headless: true, args: CHROME_ARGS },
  });
  attachClientEvents(client);
  startClient(client);
}

function checkConnected() {
  if (!client || connectionStatus !== 'connected') throw new Error(NOT_CONNECTED_MESSAGE);
}

function chatIdOrFail(toNumber) {
  const chatId = toWhatsAppId(toNumber);
  if (chatId) return chatId;
  const error = new Error(
    'Mobile number not valid: ' + (toNumber || '(empty)') + ' - give 10 digits, or the full number with country code',
  );
  error.status = 400;
  throw error;
}

// a number without WhatsApp is refused (otherwise the send "works" and nothing arrives);
// when the check itself is not available the message is just sent
async function checkOnWhatsapp(chatId, toNumber) {
  try {
    if (typeof client.isRegisteredUser === 'function' && !(await client.isRegisteredUser(chatId))) {
      const error = new Error('This number is not on WhatsApp: ' + toNumber);
      error.status = 400;
      throw error;
    }
  } catch (e) {
    if (e.status) throw e;
  }
}

async function sendMessage(toNumber, message) {
  checkConnected();
  const chatId = chatIdOrFail(toNumber);
  await checkOnWhatsapp(chatId, toNumber);
  await client.sendMessage(chatId, message);
  console.log('[WhatsApp Web] Message sent to:', toNumber);
  return { success: true, to: toNumber };
}

// a file (the invoice PDF) with a caption
async function sendDocument(toNumber, buffer, filename, caption, mimetype = 'application/pdf') {
  checkConnected();
  const chatId = chatIdOrFail(toNumber);
  await checkOnWhatsapp(chatId, toNumber);
  const media = new MessageMedia(mimetype, Buffer.from(buffer).toString('base64'), filename);
  await client.sendMessage(chatId, media, { caption: caption || '', sendMediaAsDocument: true });
  console.log('[WhatsApp Web] Document sent to:', toNumber, filename);
  return { success: true, to: toNumber };
}

async function sendShipmentStatus(partyName, mobileNumber, awbNumber, statusText) {
  // template from table WhatsappConfig
  const template = (await settingsStore.get('whatsapp_status_template')) || DEFAULT_STATUS_TEMPLATE;
  const message = template
    .replace(/{name}/g, partyName || 'Valued Customer')
    .replace(/{awb}/g, awbNumber || '')
    .replace(/{status}/g, statusText || '');
  return await sendMessage(mobileNumber, message);
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
        ',\n\n⚠️ Your account has been *locked*. Contact admin.\n\n_Committed Cargo Care Ltd._'
      );
    case 'account_activate':
      return (
        '*Committed Cargo ERP*\n\nHello ' +
        employeeName +
        ',\n\n✅ Your account has been *activated*. You can now login.\n\n_Committed Cargo Care Ltd._'
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
  const message = internalNotificationText(employeeName, messageType, data || {});
  return await sendMessage(mobileNumber, message);
}

async function disconnect() {
  if (client) {
    try {
      await client.destroy();
    } catch {
      /* the browser is already gone */
    }
    client = null;
  }
  connectionStatus = 'disconnected';
  connectedNumber = null;
  currentQR = null;
}

// live updates for the Settings screen (SSE); returns the unsubscribe function
function subscribe(callback) {
  subscribers.push(callback);
  return () => {
    const index = subscribers.indexOf(callback);
    if (index > -1) subscribers.splice(index, 1);
  };
}

function getState() {
  return { status: connectionStatus, qr: currentQR, number: connectedNumber, error: lastError, startedAt };
}

export {
  initClient,
  sendMessage,
  sendDocument,
  sendShipmentStatus,
  sendInternalNotification,
  disconnect,
  subscribe,
  getState,
};
