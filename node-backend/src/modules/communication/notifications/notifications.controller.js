import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../../middlewares/auth.middleware.js';
import { isRevoked } from '../../../utils/security/tokenRevoke.js';
import * as notificationsService from './notifications.service.js';

const userIdOf = (req) => Number(req.user.id);

/** The /api login check normally ran already; otherwise the Bearer token is checked here. */
export function ensureTokenUser(req, res, next) {
  if (req.user && req.user.id) return next();
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    const tokenUser = jwt.verify(token, JWT_SECRET);
    if (isRevoked(tokenUser)) return res.status(401).json({ error: 'Logged out. Please log in again.' });
    req.user = tokenUser;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/** GET /api/notifications?limit=50&unreadOnly=1 */
export async function listNotifications(req, res) {
  res.json(await notificationsService.listNotifications(userIdOf(req), req.query));
}

export async function markAllRead(req, res) {
  res.json(await notificationsService.markAllRead(userIdOf(req)));
}

export async function clearRead(req, res) {
  res.json(await notificationsService.clearRead(userIdOf(req)));
}

export async function markRead(req, res) {
  res.json(await notificationsService.markRead(req.params.id, userIdOf(req)));
}

export async function removeNotification(req, res) {
  res.json(await notificationsService.removeNotification(req.params.id, userIdOf(req)));
}

export async function sendTestNotification(req, res) {
  res.json(await notificationsService.sendTestNotification(req.app, req.user, req.body));
}

export async function sendNotification(req, res) {
  res.json(await notificationsService.sendNotification(req.app, req.user, req.body));
}

export async function sendWhatsappStatus(req, res) {
  res.json(await notificationsService.sendWhatsappStatus(req.body));
}
