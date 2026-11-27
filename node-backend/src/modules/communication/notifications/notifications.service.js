import { Op } from 'sequelize';
import * as models from '../../../models/index.js';
import { sendSystemAlert } from '../../../utils/common/notificationHelper.js';
import { handleStatusUpdate } from '../../../utils/integrations/WhatsappScheduler.js';
import { ApiError, BadRequestError, ForbiddenError, NotFoundError } from '../../../core/http/index.js';

const { Notification, User } = models;
// the read / hidden state of a broadcast for each user is defined in the same model file as Notification
const NotificationRead = models.NotificationRead ?? Notification.NotificationRead;

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;
const UNREAD_COUNT_SCAN = 500;
const CLEAR_READ_SCAN = 1000;
const SERVER_ERROR = 500;

const failure = (message) => ({ body: { success: false, error: message } });
const isAdmin = (tokenUser) => String((tokenUser && tokenUser.role) || '').toLowerCase() === 'admin';

let tablesReady = null;
const ensureTables = () => {
  tablesReady =
    tablesReady ||
    Promise.all([Notification.sync(), NotificationRead.sync()]).catch((error) => {
      tablesReady = null;
      throw error;
    });
  return tablesReady;
};

/**
 * The notifications a user may see: his own and the broadcasts (userId null) he did not remove. A broadcast counts as
 * read when the user has a NotificationRead row for it.
 */
async function visibleNotifications(userId, extraWhere = {}, limit = DEFAULT_LIST_LIMIT) {
  await ensureTables();
  const states = await NotificationRead.findAll({ where: { userId } });
  const readIds = new Set(states.map((state) => state.notificationId));
  const hiddenIds = states.filter((state) => state.hidden).map((state) => state.notificationId);
  const rows = await Notification.findAll({
    where: {
      [Op.and]: [
        { [Op.or]: [{ userId }, { userId: null }] },
        hiddenIds.length ? { id: { [Op.notIn]: hiddenIds } } : {},
        extraWhere,
      ],
    },
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC'],
    ],
    limit,
  });
  return rows.map((row) => {
    const notification = row.toJSON();
    const broadcast = notification.userId == null;
    return { ...notification, broadcast, isRead: broadcast ? readIds.has(notification.id) : !!notification.isRead };
  });
}

const listLimit = (limit) => Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);

export async function listNotifications(userId, { limit, unreadOnly }) {
  let data = await visibleNotifications(userId, {}, listLimit(limit));
  const unreadCount = (await visibleNotifications(userId, {}, UNREAD_COUNT_SCAN)).filter((item) => !item.isRead).length;
  if (unreadOnly) data = data.filter((item) => !item.isRead);
  return { success: true, data, unreadCount };
}

const markBroadcastSeen = (notificationId, userId) =>
  NotificationRead.findOrCreate({
    where: { notificationId, userId },
    defaults: { notificationId, userId },
  });

export async function markAllRead(userId) {
  await ensureTables();
  await Notification.update({ isRead: true }, { where: { userId, isRead: false } });
  const broadcasts = await visibleNotifications(userId, { userId: null }, UNREAD_COUNT_SCAN);
  for (const broadcast of broadcasts.filter((item) => !item.isRead)) await markBroadcastSeen(broadcast.id, userId);
  return { success: true, message: 'All marked as read' };
}

/** Removes the read notifications from the user's list; a broadcast is only hidden for this user. */
export async function clearRead(userId) {
  const readItems = (await visibleNotifications(userId, {}, CLEAR_READ_SCAN)).filter((item) => item.isRead);
  let removed = 0;
  for (const item of readItems) {
    if (item.broadcast) await NotificationRead.update({ hidden: true }, { where: { notificationId: item.id, userId } });
    else await Notification.destroy({ where: { id: item.id, userId } });
    removed++;
  }
  return { success: true, removed };
}

/** The notification when the user may see it: his own or a broadcast. */
async function findVisibleNotification(id, userId) {
  await ensureTables();
  const notification = await Notification.findByPk(id);
  if (!notification || (notification.userId != null && Number(notification.userId) !== userId)) {
    throw new NotFoundError('Not found', failure('Not found'));
  }
  return notification;
}

export async function markRead(id, userId) {
  const notification = await findVisibleNotification(id, userId);
  if (notification.userId == null) {
    await markBroadcastSeen(notification.id, userId);
  } else if (!notification.isRead) {
    notification.isRead = true;
    await notification.save();
  }
  return { success: true, data: { ...notification.toJSON(), isRead: true } };
}

export async function removeNotification(id, userId) {
  const notification = await findVisibleNotification(id, userId);
  if (notification.userId == null) {
    const [state] = await markBroadcastSeen(notification.id, userId);
    await state.update({ hidden: true });
  } else {
    await notification.destroy();
  }
  return { success: true };
}

function checkSaved(row) {
  if (!row)
    throw new ApiError(SERVER_ERROR, 'Could not save the notification', failure('Could not save the notification'));
}

/** A test notification to the calling user. */
export async function sendTestNotification(app, tokenUser, body) {
  await ensureTables();
  const row = await sendSystemAlert(
    app,
    Number(tokenUser.id),
    body.title || 'Test Notification',
    body.message || 'This is a live test notification generated manually.',
    'info',
    { sentBy: tokenUser.username },
  );
  checkSaved(row);
  return { success: true, data: row };
}

/** Only an admin can send to all users; anyone can send to one user. */
async function checkRecipient(targetUserId, tokenUser) {
  if (targetUserId === 'all') {
    if (isAdmin(tokenUser)) return;
    const message = 'Only an admin can send a message to all users';
    throw new ForbiddenError(message, failure(message));
  }
  const user = Number.isInteger(Number(targetUserId))
    ? await User.findByPk(Number(targetUserId), { attributes: ['id'] })
    : null;
  if (!user) throw new BadRequestError('Choose a user to send to', failure('Choose a user to send to'));
}

export async function sendNotification(app, tokenUser, { targetUserId, title, message, type, link }) {
  await checkRecipient(targetUserId, tokenUser);
  await ensureTables();
  const recipient = targetUserId === 'all' ? 'all' : Number(targetUserId);
  const row = await sendSystemAlert(app, recipient, title, message, type || 'info', {
    sentBy: tokenUser.username,
    link,
  });
  checkSaved(row);
  return { success: true, message: 'Notification sent successfully', data: row };
}

/** A shipment status on WhatsApp (instant or scheduled, as set in Settings > WhatsApp). */
export async function sendWhatsappStatus({ mobileNumber, partyName, refNo, statusText }) {
  const result = await handleStatusUpdate(partyName || '', String(mobileNumber).trim(), refNo || '', statusText);
  return { success: true, result };
}
