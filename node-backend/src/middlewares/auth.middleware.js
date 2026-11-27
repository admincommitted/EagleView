import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { isRevoked, load as loadRevokedTokens } from '../utils/security/tokenRevoke.js';

export const JWT_SECRET = env.jwtSecret;

const USER_STATUS_TTL_MS = 30000;
const BLOCKED_STATUSES = ['inactive', 'locked'];
const UPLOAD_TOKEN_COOKIE = /(?:^|;\s*)edi_token=([^;]+)/;

const userStatusCache = new Map(); // userId -> { status, checkedAt }

const bearerToken = (req) => {
  const header = req.header('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
};

// 'missing' when the user row is gone; a user disabled / locked in User Management is refused even with a valid token
async function userStatus(userId) {
  if (!userId) return null;
  const cached = userStatusCache.get(userId);
  if (cached && Date.now() - cached.checkedAt < USER_STATUS_TTL_MS) return cached.status;
  const user = await User.findByPk(userId, { attributes: ['status'] });
  const status = user ? String(user.status || 'active').toLowerCase() : 'missing';
  userStatusCache.set(userId, { status, checkedAt: Date.now() });
  return status;
}

export const clearUserStatus = (userId) =>
  userStatusCache.delete(userId) || userStatusCache.delete(Number(userId)) || userStatusCache.delete(String(userId));

/** Every /api call after the public ones: a valid, not logged-out token of an active user. */
export async function authenticate(req, res, next) {
  if (req.method === 'OPTIONS') return next();

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Access denied. Please log in.' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.log('[Auth] JWT rejected:', error.message);
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  let status;
  try {
    // after a restart the logged-out list must be read before a token can be trusted
    await loadRevokedTokens();
    if (isRevoked(req.user)) return res.status(401).json({ error: 'Logged out. Please log in again.' });
    status = await userStatus(req.user && req.user.id);
  } catch {
    return next();
  }

  if (status === 'missing') return res.status(401).json({ error: 'Account not found. Please log in again.' });
  if (BLOCKED_STATUSES.includes(status)) {
    return res.status(403).json({ error: `Account is ${status}. Please contact admin.` });
  }
  return next();
}

/** Only admin users through. Use after authenticate. */
export function requireAdmin(req, res, next) {
  const role = String((req.user && req.user.role) || '').toLowerCase();
  if (role !== 'admin') return res.status(403).json({ error: 'Only admins can perform this action.' });
  return next();
}

const tokenFromCookie = (req) => {
  const match = UPLOAD_TOKEN_COOKIE.exec(req.headers.cookie || '');
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

/**
 * /uploads needs a login. Plain links from the screens carry no Authorization header, so the token is also taken
 * from the edi_token cookie the app sets at login. Never from the query string: it would end up in browser history.
 */
export function uploadsAuth(req, res, next) {
  const token = bearerToken(req) || tokenFromCookie(req);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (isRevoked(payload)) throw new Error('logged out');
    return next();
  } catch {
    return res.status(401).type('text').send('Login required to open this file');
  }
}

export default authenticate;
