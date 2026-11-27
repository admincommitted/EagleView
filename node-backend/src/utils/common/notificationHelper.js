import { Notification } from '../../models/index.js';

/**
 * Send a notification (bell icon) from backend code or from the Broadcast screen.
 *
 * - a broadcast ('all') is saved too (userId null), so it survives a refresh and can be marked read;
 * - pushed to every open tab of the user (socket room "user:<id>");
 * - type checked (info / success / warning / error), title / message trimmed and limited.
 */
const TYPES = ['info', 'success', 'warning', 'error'];

const TITLE_MAX = 200;
const MESSAGE_MAX = 2000;
const SENT_BY_MAX = 100;
const LINK_MAX = 250;
const NOTIFICATION_EVENT = 'new_notification';

// connections that did not join the user's room still get it through their socket id
function emitToUnjoinedSocket(app, io, userId, payload) {
  const socketId = (app.get('userSockets') || {})[userId];
  if (!socketId) return;
  const socket = io.sockets && io.sockets.sockets && io.sockets.sockets.get(socketId);
  if (socket && !socket.rooms.has('user:' + userId)) io.to(socketId).emit(NOTIFICATION_EVENT, payload);
}

function emitTo(app, userId, payload) {
  const io = app && app.get && app.get('io');
  if (!io) return false;
  if (userId === 'all') {
    io.to('staff').emit(NOTIFICATION_EVENT, payload); // logged-in users only
    return true;
  }
  io.to('user:' + userId).emit(NOTIFICATION_EVENT, payload);
  emitToUnjoinedSocket(app, io, userId, payload);
  return true;
}

/**
 * @param {object} app - express app (req.app)
 * @param {number|'all'} userId - target user id, or 'all'
 * @param {string} title
 * @param {string} message
 * @param {string} type - 'info' | 'success' | 'warning' | 'error'
 * @param {object} [extra] - { sentBy, link }
 * @returns the saved notification (or null when it failed)
 */
const sendSystemAlert = async (app, userId, title, message, type = 'info', extra = {}) => {
  try {
    const isBroadcast = userId === 'all' || userId == null;
    const notification = await Notification.create({
      userId: isBroadcast ? null : Number(userId),
      title:
        String(title || '')
          .trim()
          .slice(0, TITLE_MAX) || 'Notification',
      message: String(message || '')
        .trim()
        .slice(0, MESSAGE_MAX),
      type: TYPES.includes(type) ? type : 'info',
      sentBy: extra.sentBy ? String(extra.sentBy).slice(0, SENT_BY_MAX) : 'SYSTEM',
      link: extra.link ? String(extra.link).slice(0, LINK_MAX) : null,
    });
    const payload = { ...notification.toJSON(), isRead: false, broadcast: isBroadcast };
    emitTo(app, isBroadcast ? 'all' : notification.userId, payload);
    return notification;
  } catch (error) {
    console.error('Failed to send system alert:', error.message);
    return null;
  }
};

export { sendSystemAlert, TYPES };
