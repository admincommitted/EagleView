/**
 * Instant vs. scheduled (batched) WhatsApp status notifications.
 *
 * Modes:
 *  "instant"   — Send immediately when status changes
 *  "scheduled" — Queue notifications, send all at a specific time daily
 *
 * A failed send stays in the queue with its error and is tried again on the next run, up to MAX_TRIES times.
 * "Today" is the Indian date (the UTC date would still be yesterday before 05:30 IST).
 */
import cron from 'node-cron';
import { WhatsappNotificationQueue } from '../../models/index.js';
import { sequelize, Op } from '../../config/database.js';
import * as settingsStore from '../common/settingsStore.js';
import * as whatsappWeb from './WhatsappWebService.js';
import * as whatsappApi from './WhatsappService.js';

const MAX_TRIES = 5;
const IST_OFFSET_MS = 330 * 60000;
const DEFAULT_NOTIFY_TIME = '09:00';
const ERROR_TEXT_MAX = 480;
const TEMPLATE_LIST_MAX = 900;
const STATS_ERROR_LIMIT = 10;
const SCHEDULER_CONFIG_KEYS = ['whatsapp_notify_mode', 'whatsapp_notify_time', 'whatsapp_mode'];

const todayIST = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
const startOfTodayIST = () => new Date(todayIST() + 'T00:00:00+05:30');

let schedulerJob = null; // active cron job
let currentTime = null; // e.g. "09:00"
let currentMode = null; // "instant" | "scheduled"

// settings from table WhatsappConfig
async function getConfig() {
  const settings = await settingsStore.getMany(SCHEDULER_CONFIG_KEYS);
  return {
    mode: settings.whatsapp_notify_mode || 'instant', // instant | scheduled
    notifyTime: settings.whatsapp_notify_time || DEFAULT_NOTIFY_TIME, // HH:MM
    waMode: settings.whatsapp_mode || 'qr', // qr | api
  };
}

// QR mode sends through WhatsApp Web, any other mode through the API provider
async function getSendFn(waMode) {
  return waMode === 'qr' ? whatsappWeb.sendShipmentStatus : whatsappApi.sendShipmentStatus;
}

const dueToday = (today) => ({
  sent: false,
  scheduledFor: { [Op.lte]: today },
  [Op.or]: [{ attempts: null }, { attempts: { [Op.lt]: MAX_TRIES } }],
});

const maskedStart = (mobile) => mobile.slice(0, 4) + '****';

// one combined message per mobile number
function groupByMobile(pending) {
  const grouped = {};
  pending.forEach((notification) => {
    if (!grouped[notification.mobileNumber]) {
      grouped[notification.mobileNumber] = { partyName: notification.partyName, items: [], ids: [] };
    }
    grouped[notification.mobileNumber].items.push({ awb: notification.awbNumber, status: notification.statusText });
    grouped[notification.mobileNumber].ids.push(notification.id);
  });
  return grouped;
}

function combinedMessageOf(group) {
  const lines = group.items
    .map((item, index) => index + 1 + '. *' + (item.awb || 'N/A') + '* — ' + item.status)
    .join('\n');
  return (
    '*Committed Cargo Care Ltd.*\n\nDear ' +
    (group.partyName || 'Valued Customer') +
    ',\n\nYour shipment status updates:\n\n' +
    lines +
    '\n\n_For queries, contact us._'
  );
}

async function sendCombined(config, mobile, group) {
  const message = combinedMessageOf(group);
  if (config.waMode === 'qr') {
    await whatsappWeb.sendMessage(mobile, message);
    return;
  }
  // template values: {{1}} party, {{2}} "n shipments", {{3}} the list
  const shipmentList = group.items
    .map((item) => (item.awb || 'N/A') + ': ' + item.status)
    .join('; ')
    .slice(0, TEMPLATE_LIST_MAX);
  await whatsappApi.sendWhatsapp(mobile, message, null, [
    group.partyName || 'Customer',
    group.items.length + ' shipments',
    shipmentList,
  ]);
}

async function sendGroup(config, sendFn, mobile, group) {
  if (group.items.length === 1) {
    await sendFn(group.partyName, mobile, group.items[0].awb, group.items[0].status);
    return;
  }
  await sendCombined(config, mobile, group);
}

async function recordFailedAttempt(ids, error) {
  try {
    await WhatsappNotificationQueue.update(
      {
        attempts: sequelize.literal('COALESCE(attempts, 0) + 1'),
        lastError: String(error.message).slice(0, ERROR_TEXT_MAX),
      },
      { where: { id: { [Op.in]: ids } } },
    );
  } catch {
    /* the next run tries again */
  }
}

// sends everything due today
async function flushPendingQueue(config) {
  const pending = await WhatsappNotificationQueue.findAll({
    where: dueToday(todayIST()),
    order: [
      ['mobileNumber', 'ASC'],
      ['createdAt', 'ASC'],
    ],
  });

  if (pending.length === 0) {
    console.log('[WhatsApp Scheduler] No pending notifications to send.');
    return { sent: 0 };
  }

  const sendFn = await getSendFn(config.waMode);
  let sentCount = 0;
  let failed = 0;
  const errors = [];

  for (const [mobile, group] of Object.entries(groupByMobile(pending))) {
    try {
      await sendGroup(config, sendFn, mobile, group);
      await WhatsappNotificationQueue.update(
        { sent: true, sentAt: new Date(), lastError: null },
        { where: { id: { [Op.in]: group.ids } } },
      );
      sentCount++;
      console.log('[WhatsApp Scheduler] Sent batch to:', maskedStart(mobile), '(' + group.items.length + ' shipments)');
    } catch (err) {
      failed++;
      errors.push(mobile.slice(-4) + ': ' + err.message);
      await recordFailedAttempt(group.ids, err);
      console.error('[WhatsApp Scheduler] Failed to send to', maskedStart(mobile), ':', err.message);
    }
  }

  console.log('[WhatsApp Scheduler] Flush complete. Sent to', sentCount, 'parties,', failed, 'failed.');
  return { sent: sentCount, failed, total: pending.length, errors: errors.slice(0, STATS_ERROR_LIMIT) };
}

// queue for the daily batch (scheduled mode)
async function queueNotification(partyName, mobileNumber, awbNumber, statusText) {
  await WhatsappNotificationQueue.create({
    partyName,
    mobileNumber,
    awbNumber,
    statusText,
    scheduledFor: todayIST(),
  });
  console.log('[WhatsApp Scheduler] Queued notification for:', mobileNumber, '| AWB:', awbNumber);
}

async function handleStatusUpdate(partyName, mobileNumber, awbNumber, statusText) {
  if (!mobileNumber) {
    const error = new Error('mobileNumber is required');
    error.status = 400;
    throw error;
  }

  const config = await getConfig();
  if (config.mode === 'instant') {
    const sendFn = await getSendFn(config.waMode);
    return await sendFn(partyName, mobileNumber, awbNumber, statusText);
  }
  await queueNotification(partyName, mobileNumber, awbNumber, statusText);
  return { queued: true };
}

// starts / restarts the daily cron job (IST) for scheduled mode
async function startScheduler() {
  const config = await getConfig();

  if (schedulerJob) {
    schedulerJob.stop();
    schedulerJob = null;
  }

  if (config.mode !== 'scheduled') {
    console.log('[WhatsApp Scheduler] Mode is instant — no cron needed.');
    currentMode = config.mode;
    return;
  }

  const [hours, minutes] = (config.notifyTime || DEFAULT_NOTIFY_TIME).split(':');
  const cronExpression = minutes + ' ' + hours + ' * * *';

  try {
    schedulerJob = cron.schedule(
      cronExpression,
      async () => {
        console.log('[WhatsApp Scheduler] Cron fired at', config.notifyTime, '— flushing queue...');
        await flushPendingQueue(await getConfig());
      },
      { timezone: 'Asia/Kolkata' },
    );

    currentTime = config.notifyTime;
    currentMode = 'scheduled';
    console.log('[WhatsApp Scheduler] Scheduled batch at', config.notifyTime, 'IST | Cron:', cronExpression);
  } catch (err) {
    console.error('[WhatsApp Scheduler] Cron setup failed:', err.message);
  }
}

async function getQueueStats() {
  const pending = await WhatsappNotificationQueue.count({ where: dueToday(todayIST()) });
  const failed = await WhatsappNotificationQueue.count({ where: { sent: false, attempts: { [Op.gte]: MAX_TRIES } } });
  const sentToday = await WhatsappNotificationQueue.count({
    where: { sent: true, sentAt: { [Op.gte]: startOfTodayIST() } },
  });
  const lastFailed = await WhatsappNotificationQueue.findOne({
    where: { sent: false, lastError: { [Op.ne]: null } },
    order: [['updatedAt', 'DESC']],
  });
  return {
    pending,
    failed,
    sentToday,
    lastError: lastFailed ? lastFailed.lastError : null,
    scheduledTime: currentTime,
    mode: currentMode,
  };
}

// sends the queue now with the current settings
async function flushQueue() {
  return flushPendingQueue(await getConfig());
}

export { handleStatusUpdate, startScheduler, flushQueue, getQueueStats };
