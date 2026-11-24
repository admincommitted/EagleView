const Notification = require('../models/Notification');

/**
 * Send a notification (bell icon) from backend code or from the Broadcast screen.
 *
 * 28-Oct-2026:
 * - a broadcast ('all') is saved too (userId null): before it was only pushed live, so it was lost on refresh, and
 *   its fake id (Date.now()) could not be marked read;
 * - pushed to every open tab of the user (socket room "user:<id>"), not only the last one opened;
 * - type checked (info / success / warning / error), title / message trimmed and limited.
 *
 * @param {object} app - express app (req.app)
 * @param {number|'all'} userId - target user id, or 'all'
 * @param {string} title
 * @param {string} message
 * @param {string} type - 'info' | 'success' | 'warning' | 'error'
 * @param {object} [extra] - { sentBy, link }
 * @returns the saved notification (or null when it failed)
 */
const TYPES = ['info', 'success', 'warning', 'error'];

function emitTo(app, userId, payload) {
  const io = app && app.get && app.get('io');
  if (!io) return false;
  if (userId === 'all') { io.to('staff').emit('new_notification', payload); return true; } // 14-Nov-2026: logged-in users only
  io.to('user:' + userId).emit('new_notification', payload);
  // older connections that did not join the room
  const sid = (app.get('userSockets') || {})[userId];
  if (sid) { const s = io.sockets && io.sockets.sockets && io.sockets.sockets.get(sid); if (s && !s.rooms.has('user:' + userId)) io.to(sid).emit('new_notification', payload); }
  return true;
}

const sendSystemAlert = async (app, userId, title, message, type = 'info', extra = {}) => {
  try {
    const all = userId === 'all' || userId == null;
    const row = await Notification.create({
      userId: all ? null : Number(userId),
      title: String(title || '').trim().slice(0, 200) || 'Notification',
      message: String(message || '').trim().slice(0, 2000),
      type: TYPES.includes(type) ? type : 'info',
      sentBy: extra.sentBy ? String(extra.sentBy).slice(0, 100) : 'SYSTEM',
      link: extra.link ? String(extra.link).slice(0, 250) : null,
    });
    emitTo(app, all ? 'all' : row.userId, { ...row.toJSON(), isRead: false, broadcast: all });
    return row;
  } catch (error) {
    console.error('Failed to send system alert:', error.message);
    return null;
  }
};

module.exports = { sendSystemAlert, emitTo, TYPES };
