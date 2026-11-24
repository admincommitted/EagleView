const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const Notification = require('../models/Notification');
const { NotificationRead } = Notification;
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth'); // fix 28-Oct-2026: was a hardcoded old secret, so every request failed
const { sendSystemAlert, TYPES } = require('../utils/notificationHelper');

/*
 * Bell icon notifications. 28-Oct-2026 rework:
 * - the list has the user's own notifications AND broadcasts (sent to all users); broadcasts were never saved, so
 *   they disappeared on refresh;
 * - read / removed state of a broadcast is kept per user (table NotificationRead);
 * - unreadCount from the server, mark all read, remove one, clear read ones;
 * - sending: only an admin can send to all users; anyone can send to one user; title / message / type checked;
 * - the fake POST /whatsapp (answered "sent" without sending anything) now really sends through WhatsApp.
 */
const authenticateToken = (req, res, next) => {
  if (req.user && req.user.id) return next(); // already checked by the /api auth middleware
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (ex) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
router.use(authenticateToken);

const isAdmin = (req) => String((req.user && req.user.role) || '').toLowerCase() === 'admin';
const uid = (req) => Number(req.user.id);
let synced = null;
const ready = () => (synced = synced || Promise.all([Notification.sync(), NotificationRead.sync()]).catch(e => { synced = null; throw e; }));

// the notifications a user may see: own + broadcasts not removed by the user
async function visibleFor(userId, extraWhere = {}, limit = 50) {
  await ready();
  const states = await NotificationRead.findAll({ where: { userId } });
  const read = new Set(states.map(s => s.notificationId));
  const hidden = states.filter(s => s.hidden).map(s => s.notificationId);
  const rows = await Notification.findAll({
    where: { [Op.and]: [{ [Op.or]: [{ userId }, { userId: null }] }, hidden.length ? { id: { [Op.notIn]: hidden } } : {}, extraWhere] },
    order: [['createdAt', 'DESC'], ['id', 'DESC']], limit,
  });
  return rows.map(r => { const j = r.toJSON(); const b = j.userId == null; return { ...j, broadcast: b, isRead: b ? read.has(j.id) : !!j.isRead }; });
}

// GET /api/notifications?limit=50&unreadOnly=1
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    let data = await visibleFor(uid(req), {}, limit);
    const unreadCount = (await visibleFor(uid(req), {}, 500)).filter(n => !n.isRead).length;
    if (req.query.unreadOnly) data = data.filter(n => !n.isRead);
    res.json({ success: true, data, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

async function markRead(userId, n) {
  if (n.userId == null) {
    const [st] = await NotificationRead.findOrCreate({ where: { notificationId: n.id, userId }, defaults: { notificationId: n.id, userId } });
    return st;
  }
  if (!n.isRead) { n.isRead = true; await n.save(); }
  return n;
}
const findVisible = async (req) => {
  await ready();
  const n = await Notification.findByPk(req.params.id);
  if (!n || (n.userId != null && Number(n.userId) !== uid(req))) return null;
  return n;
};

// Mark all as read (registered before /:id so "read-all" is not taken as an id)
router.put('/read-all', async (req, res) => {
  try {
    await ready();
    await Notification.update({ isRead: true }, { where: { userId: uid(req), isRead: false } });
    const unread = (await visibleFor(uid(req), { userId: null }, 500)).filter(n => !n.isRead);
    for (const n of unread) await NotificationRead.findOrCreate({ where: { notificationId: n.id, userId: uid(req) }, defaults: { notificationId: n.id, userId: uid(req) } });
    res.json({ success: true, message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remove all read notifications from the user's list
router.delete('/clear-read', async (req, res) => {
  try {
    const read = (await visibleFor(uid(req), {}, 1000)).filter(n => n.isRead);
    let removed = 0;
    for (const n of read) {
      if (n.broadcast) await NotificationRead.update({ hidden: true }, { where: { notificationId: n.id, userId: uid(req) } });
      else await Notification.destroy({ where: { id: n.id, userId: uid(req) } });
      removed++;
    }
    res.json({ success: true, removed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mark a notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const n = await findVisible(req);
    if (!n) return res.status(404).json({ success: false, error: 'Not found' });
    await markRead(uid(req), n);
    res.json({ success: true, data: { ...n.toJSON(), isRead: true } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remove one notification from the user's list (a broadcast is only hidden for this user)
router.delete('/:id', async (req, res) => {
  try {
    const n = await findVisible(req);
    if (!n) return res.status(404).json({ success: false, error: 'Not found' });
    if (n.userId == null) {
      const [st] = await NotificationRead.findOrCreate({ where: { notificationId: n.id, userId: uid(req) }, defaults: { notificationId: n.id, userId: uid(req) } });
      await st.update({ hidden: true });
    } else await n.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test route to send a dummy notification to the calling user
router.post('/test', async (req, res) => {
  try {
    await ready();
    const row = await sendSystemAlert(req.app, uid(req), req.body.title || 'Test Notification', req.body.message || 'This is a live test notification generated manually.', 'info', { sentBy: req.user.username });
    if (!row) return res.status(500).json({ success: false, error: 'Could not save the notification' });
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Broadcast screen: { targetUserId ('all' or a user id), title, message, type, link }
router.post('/send', async (req, res) => {
  try {
    const { targetUserId, title, message, type, link } = req.body || {};
    if (!String(title || '').trim() || !String(message || '').trim()) return res.status(400).json({ success: false, error: 'Title and message are required' });
    if (String(title).length > 200 || String(message).length > 2000) return res.status(400).json({ success: false, error: 'Title max 200, message max 2000 characters' });
    if (type && !TYPES.includes(type)) return res.status(400).json({ success: false, error: 'Type must be ' + TYPES.join(' / ') });
    const all = targetUserId === 'all';
    if (all && !isAdmin(req)) return res.status(403).json({ success: false, error: 'Only an admin can send a message to all users' });
    if (!all) {
      const User = require('../models/User');
      const u = Number.isInteger(Number(targetUserId)) ? await User.findByPk(Number(targetUserId), { attributes: ['id'] }) : null;
      if (!u) return res.status(400).json({ success: false, error: 'Choose a user to send to' });
    }
    await ready();
    const row = await sendSystemAlert(req.app, all ? 'all' : Number(targetUserId), title, message, type || 'info', { sentBy: req.user.username, link });
    if (!row) return res.status(500).json({ success: false, error: 'Could not save the notification' });
    res.json({ success: true, message: 'Notification sent successfully', data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifications/whatsapp { mobileNumber, partyName, refNo, statusText } - shipment status on WhatsApp
// (before: a fake answer "sent" after 1 second, nothing was sent)
router.post('/whatsapp', async (req, res) => {
  try {
    const { mobileNumber, partyName, refNo, statusText } = req.body || {};
    if (!mobileNumber || String(mobileNumber).replace(/\D/g, '').length < 10) return res.status(400).json({ success: false, error: 'A valid mobile number is required' });
    if (!statusText) return res.status(400).json({ success: false, error: 'statusText is required' });
    const { handleStatusUpdate } = require('../utils/WhatsappScheduler');
    const result = await handleStatusUpdate(partyName || '', String(mobileNumber).trim(), refNo || '', statusText);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
