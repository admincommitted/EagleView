const express = require('express');
const router = express.Router();
const wa = require('../utils/WhatsappWebService');
const { sendWhatsapp, sendInternalNotification: apiInternal } = require('../utils/WhatsappService');
// 28-Oct-2026: QR or API, as chosen in Settings > WhatsApp (send-internal always used QR; a second
// /send-status further down, which follows the setting, was never reached because the QR-only one came first)
const waMode = async () => ((await require('../utils/settingsStore').get('whatsapp_mode')) === 'api' ? 'api' : 'qr');
const errOut = (res, err) => res.status(err.status || 500).json({ success: false, error: err.message });
// 14-Nov-2026 (security check): connecting WhatsApp (the QR / link stream), tests and queue control are for an admin only
const { requireAdmin } = require('../middleware/auth');

// GET /api/whatsapp/state
router.get('/state', (req, res) => {
  // 14-Nov-2026: the QR that links a phone to the company WhatsApp only for an admin
  const st = { ...wa.getState() };
  if (String((req.user && req.user.role) || '').toLowerCase() !== 'admin') st.qr = null;
  res.json(st);
});

// POST /api/whatsapp/api-test  — test the API-based provider
router.post('/api-test', requireAdmin, async (req, res) => {
  try {
    const { toNumber } = req.body;
    if (!toNumber) return res.status(400).json({ error: 'toNumber is required' });
    // with a template set, the test goes as that template ({{1}} name, {{2}} ref, {{3}} status)
    const result = await sendWhatsapp(toNumber, 'Hello! This is a test from Committed Cargo ERP via API. ✅', null, ['Test', 'TEST-001', 'WhatsApp API test from Committed Cargo ERP']);
    res.json({ success: true, result });
  } catch (err) {
    errOut(res, err);
  }
});

// GET /api/whatsapp/events  (Server-Sent Events for live QR / status updates)
router.get('/events', requireAdmin, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write(':' + Array(4096).join(' ') + '\n\n');

  // Send current state immediately
  const state = wa.getState();
  res.write('data: ' + JSON.stringify({ type: 'state', ...state }) + '\n\n');

  // Subscribe to future updates
  const unsub = wa.subscribe((msg) => {
    res.write('data: ' + msg + '\n\n');
  });

  // Heartbeat every 25 seconds to keep connection alive
  const hb = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(hb);
    unsub();
  });
});

// POST /api/whatsapp/connect
// Start WhatsApp Web client (shows QR)
router.post('/connect', requireAdmin, (req, res) => {
  try {
    // 09-Nov-2026: a start that failed or hung is restarted (before, Connect did nothing while the old one hung)
    const st = wa.getState().status;
    wa.initClient(st === 'disconnected' || st === 'starting' || !!(req.body && req.body.force));
    res.json({ success: true, message: 'WhatsApp client starting. QR code will appear shortly.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/disconnect
router.post('/disconnect', requireAdmin, async (req, res) => {
  try {
    await wa.disconnect();
    res.json({ success: true, message: 'WhatsApp disconnected.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/test
// Send a test message
router.post('/test', requireAdmin, async (req, res) => {
  try {
    const { toNumber, message } = req.body;
    if (!toNumber) return res.status(400).json({ error: 'toNumber is required' });
    const text = message || 'Hello! This is a test message from Committed Cargo ERP. WhatsApp is working correctly. \u2705';
    const result = await wa.sendMessage(toNumber, text);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/send-internal
// Send internal notification to an employee
router.post('/send-internal', async (req, res) => {
  try {
    const User = require('../models/User');
    const { userId, messageType, data } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.contactNumber) return res.status(400).json({ error: 'No mobile number set for this user.' });
    const send = (await waMode()) === 'api' ? apiInternal : wa.sendInternalNotification;
    const result = await send(user.fullName || user.username, user.contactNumber, messageType || 'custom', data || {});
    res.json({ success: true, sentTo: user.contactNumber, result });
  } catch (err) {
    errOut(res, err);
  }
});

// ── Scheduler Routes ─────────────────────────────────────────────

// GET /api/whatsapp/queue-stats — pending queue count & mode info
router.get('/queue-stats', async (req, res) => {
  try {
    const { getQueueStats } = require('../utils/WhatsappScheduler');
    const stats = await getQueueStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/flush-queue — manually send all pending now
router.post('/flush-queue', requireAdmin, async (req, res) => {
  try {
    const { flushQueue } = require('../utils/WhatsappScheduler');
    const result = await flushQueue();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/restart-scheduler — reload cron after settings change
router.post('/restart-scheduler', requireAdmin, async (req, res) => {
  try {
    const { startScheduler } = require('../utils/WhatsappScheduler');
    await startScheduler();
    res.json({ success: true, message: 'Scheduler restarted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/send-status  (smart — respects instant/scheduled mode)
router.post('/send-status', async (req, res) => {
  try {
    const { partyName, mobileNumber, awbNumber, statusText } = req.body;
    if (!mobileNumber) return res.status(400).json({ error: 'mobileNumber is required' });
    if (!statusText)   return res.status(400).json({ error: 'statusText is required' });
    const { handleStatusUpdate } = require('../utils/WhatsappScheduler');
    const result = await handleStatusUpdate(partyName, mobileNumber, awbNumber, statusText);
    res.json({ success: true, result });
  } catch (err) {
    errOut(res, err);
  }
});

// ── Module-wise WhatsApp numbers (Settings → WhatsApp): table WhatsappModuleNumber (one row per module). 28-Oct-2026
const settingsStore = require('../utils/settingsStore');
async function readModuleNumbers() {
    await settingsStore.ready();
    return (await settingsStore.models.WhatsappModuleNumber.findAll({ order: [['moduleName', 'ASC']] })).map(r => ({ moduleName: r.moduleName, phoneNumber: r.phoneNumber }));
}
async function writeModuleNumbers(list) {
    await settingsStore.ready();
    const W = settingsStore.models.WhatsappModuleNumber;
    const { sequelize } = require('../db');
    await sequelize.transaction(async (t) => {
        await W.destroy({ where: {}, transaction: t });
        for (const m of list) await W.create({ moduleName: m.moduleName, phoneNumber: m.phoneNumber }, { transaction: t });
    });
}
router.get('/module-numbers', async (req, res) => {
    try { res.json(await readModuleNumbers()); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/module-numbers', requireAdmin, async (req, res) => {
    try {
        const moduleName = String((req.body && req.body.moduleName) || '').trim();
        const phoneNumber = String((req.body && req.body.phoneNumber) || '').replace(/[^\d+]/g, '');
        if (!moduleName || phoneNumber.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Module name and a valid phone number are required' });
        const list = (await readModuleNumbers()).filter(m => m.moduleName.toLowerCase() !== moduleName.toLowerCase());
        list.push({ moduleName, phoneNumber });
        await writeModuleNumbers(list);
        res.json(list);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/module-numbers/:moduleName', requireAdmin, async (req, res) => {
    try {
        const name = String(req.params.moduleName).toLowerCase();
        const list = await readModuleNumbers();
        const next = list.filter(m => m.moduleName.toLowerCase() !== name);
        if (next.length === list.length) return res.status(404).json({ error: 'Not found' });
        await writeModuleNumbers(next);
        res.json(next);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
router.readModuleNumbers = readModuleNumbers;

module.exports = router;
