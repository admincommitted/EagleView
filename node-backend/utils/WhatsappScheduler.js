/**
 * WhatsappScheduler.js
 * Manages instant vs. scheduled (batched) WhatsApp status notifications.
 *
 * Modes:
 *  "instant"   — Send immediately when status changes
 *  "scheduled" — Queue notifications, send all at a specific time daily
 */

const cron      = require('node-cron');
const AppSetting                = require('../models/AppSetting');
const WhatsappNotificationQueue = require('../models/WhatsappNotificationQueue');
const { Op }    = require('sequelize');

// 28-Oct-2026: a failed send stays in the queue (it was marked sent and lost), tried again next run up to 5 times,
// with the error kept; "today" is the Indian date (the UTC date was used, so before 05:30 IST it was yesterday).
const MAX_TRIES = 5;
const todayIST = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const startOfTodayIST = () => new Date(todayIST() + 'T00:00:00+05:30');

let schedulerJob = null;   // active cron job reference
let currentTime  = null;   // e.g. "09:00"
let currentMode  = null;   // "instant" | "scheduled"

// ── Load config from DB ───────────────────────────────────────────
async function getConfig() {
  const keys = ['whatsapp_notify_mode', 'whatsapp_notify_time', 'whatsapp_mode'];
  const cfg   = await require('./settingsStore').getMany(keys); // table WhatsappConfig (28-Oct-2026)
  return {
    mode:       cfg.whatsapp_notify_mode  || 'instant',   // instant | scheduled
    notifyTime: cfg.whatsapp_notify_time  || '09:00',     // HH:MM
    waMode:     cfg.whatsapp_mode         || 'qr',        // qr | api
  };
}

// ── Get the correct send function based on waMode ─────────────────
async function getSendFn(waMode) {
  if (waMode === 'qr') {
    const { sendShipmentStatus } = require('./WhatsappWebService');
    return sendShipmentStatus;
  } else {
    const { sendShipmentStatus } = require('./WhatsappService');
    return sendShipmentStatus;
  }
}

// ── Process and flush the queue (send all pending for today) ──────
async function flushQueue(cfg) {
  const today = todayIST();
  const pending = await WhatsappNotificationQueue.findAll({
    where: {
      sent: false,
      scheduledFor: { [Op.lte]: today },
      [Op.or]: [{ attempts: null }, { attempts: { [Op.lt]: MAX_TRIES } }]
    },
    order: [['mobileNumber', 'ASC'], ['createdAt', 'ASC']]
  });

  if (pending.length === 0) {
    console.log('[WhatsApp Scheduler] No pending notifications to send.');
    return { sent: 0 };
  }

  const sendFn = await getSendFn(cfg.waMode);

  // Group by mobile number so one client gets one combined message
  const grouped = {};
  pending.forEach(n => {
    if (!grouped[n.mobileNumber]) {
      grouped[n.mobileNumber] = { partyName: n.partyName, items: [], ids: [] };
    }
    grouped[n.mobileNumber].items.push({ awb: n.awbNumber, status: n.statusText });
    grouped[n.mobileNumber].ids.push(n.id);
  });

  let sentCount = 0, failed = 0;
  const errors = [];

  for (const [mobile, data] of Object.entries(grouped)) {
    try {
      let message = '';
      if (data.items.length === 1) {
        // Single shipment — use normal template
        await sendFn(data.partyName, mobile, data.items[0].awb, data.items[0].status);
      } else {
        // Multiple shipments — combined message
        const lines = data.items.map((it, i) =>
          (i + 1) + '. *' + (it.awb || 'N/A') + '* — ' + it.status
        ).join('\n');
        message = '*Committed Cargo Care Ltd.*\n\nDear ' + (data.partyName || 'Valued Customer') + ',\n\nYour shipment status updates:\n\n' + lines + '\n\n_For queries, contact us._';

        if (cfg.waMode === 'qr') {
          const { sendMessage } = require('./WhatsappWebService');
          await sendMessage(mobile, message);
        } else {
          const { sendWhatsapp } = require('./WhatsappService');
          // template values: {{1}} party, {{2}} "n shipments", {{3}} the list
          await sendWhatsapp(mobile, message, null, [data.partyName || 'Customer', data.items.length + ' shipments', data.items.map(it => (it.awb || 'N/A') + ': ' + it.status).join('; ').slice(0, 900)]);
        }
      }
      await WhatsappNotificationQueue.update({ sent: true, sentAt: new Date(), lastError: null }, { where: { id: { [Op.in]: data.ids } } });
      sentCount++;
      console.log('[WhatsApp Scheduler] Sent batch to:', mobile.slice(0, 4) + '****', '(' + data.items.length + ' shipments)');
    } catch (err) {
      failed++;
      errors.push(mobile.slice(-4) + ': ' + err.message);
      const { sequelize } = require('../db');
      await WhatsappNotificationQueue.update({ attempts: sequelize.literal('COALESCE(attempts, 0) + 1'), lastError: String(err.message).slice(0, 480) }, { where: { id: { [Op.in]: data.ids } } }).catch(() => {});
      console.error('[WhatsApp Scheduler] Failed to send to', mobile.slice(0, 4) + '****', ':', err.message);
    }
  }

  console.log('[WhatsApp Scheduler] Flush complete. Sent to', sentCount, 'parties,', failed, 'failed.');
  return { sent: sentCount, failed, total: pending.length, errors: errors.slice(0, 10) };
}

// ── Queue a notification (for scheduled mode) ─────────────────────
async function queueNotification(partyName, mobileNumber, awbNumber, statusText) {
  const today = todayIST();
  await WhatsappNotificationQueue.create({
    partyName, mobileNumber, awbNumber, statusText, scheduledFor: today
  });
  console.log('[WhatsApp Scheduler] Queued notification for:', mobileNumber, '| AWB:', awbNumber);
}

// ── Main entry: handle a status update ────────────────────────────
async function handleStatusUpdate(partyName, mobileNumber, awbNumber, statusText) {
  if (!mobileNumber) { const e = new Error('mobileNumber is required'); e.status = 400; throw e; }

  const cfg = await getConfig();

  if (cfg.mode === 'instant') {
    // Send immediately
    const sendFn = await getSendFn(cfg.waMode);
    return await sendFn(partyName, mobileNumber, awbNumber, statusText);
  } else {
    // Queue for later batch send
    await queueNotification(partyName, mobileNumber, awbNumber, statusText);
    return { queued: true };
  }
}

// ── Start / Restart the cron scheduler ────────────────────────────
async function startScheduler() {
  const cfg = await getConfig();

  // Stop existing job if running
  if (schedulerJob) { schedulerJob.stop(); schedulerJob = null; }

  if (cfg.mode !== 'scheduled') {
    console.log('[WhatsApp Scheduler] Mode is instant — no cron needed.');
    currentMode = cfg.mode;
    return;
  }

  const [hh, mm] = (cfg.notifyTime || '09:00').split(':');
  const cronExpr  = mm + ' ' + hh + ' * * *';   // e.g. "0 9 * * *"

  try {
    schedulerJob = cron.schedule(cronExpr, async () => {
      console.log('[WhatsApp Scheduler] Cron fired at', cfg.notifyTime, '— flushing queue...');
      const latestCfg = await getConfig();
      await flushQueue(latestCfg);
    }, { timezone: 'Asia/Kolkata' });

    currentTime = cfg.notifyTime;
    currentMode = 'scheduled';
    console.log('[WhatsApp Scheduler] Scheduled batch at', cfg.notifyTime, 'IST | Cron:', cronExpr);
  } catch (err) {
    console.error('[WhatsApp Scheduler] Cron setup failed:', err.message);
  }
}

// ── Get queue stats ────────────────────────────────────────────────
async function getQueueStats() {
  const today   = todayIST();
  const pending = await WhatsappNotificationQueue.count({ where: { sent: false, scheduledFor: { [Op.lte]: today }, [Op.or]: [{ attempts: null }, { attempts: { [Op.lt]: MAX_TRIES } }] } });
  const failed  = await WhatsappNotificationQueue.count({ where: { sent: false, attempts: { [Op.gte]: MAX_TRIES } } });
  const sentToday = await WhatsappNotificationQueue.count({
    where: { sent: true, sentAt: { [Op.gte]: startOfTodayIST() } }
  });
  const last = await WhatsappNotificationQueue.findOne({ where: { sent: false, lastError: { [Op.ne]: null } }, order: [['updatedAt', 'DESC']] });
  return { pending, failed, sentToday, lastError: last ? last.lastError : null, scheduledTime: currentTime, mode: currentMode };
}

module.exports = { handleStatusUpdate, startScheduler, flushQueue: async () => flushQueue(await getConfig()), queueNotification, getQueueStats };
