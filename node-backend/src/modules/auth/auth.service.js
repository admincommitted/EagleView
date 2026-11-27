import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { User, UserPermission, UserProfile, UserSettings } from '../../models/index.js';
import { sequelize } from '../../config/database.js';
import { BACKEND_ROOT, env } from '../../config/env.js';
import { JWT_SECRET } from '../../middlewares/auth.middleware.js';
import { isOfficeIp } from '../../utils/security/webSecurity.js';
import { revoke } from '../../utils/security/tokenRevoke.js';
import * as settingsStore from '../../utils/common/settingsStore.js';
import { lazyTransport } from '../../utils/integrations/mailer.js';
import { normalizePermissions } from '../../utils/common/moduleCatalog.js';
import {
  ApiError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from '../../core/http/index.js';
import { APP_BACKGROUNDS, APP_COLORS } from './auth.validation.js';

const MINUTE_MS = 60 * 1000;
const FAILURE_WINDOW_MS = 15 * MINUTE_MS;
const MAX_FAILS_PER_USER_AND_PC = 10;
const MAX_FAILS_PER_OUTSIDE_ADDRESS = 25;
const MAX_TRACKED_FAILURES = 5000;
const OTP_VALID_MS = 10 * MINUTE_MS;
const MAX_OTP_TRIES = 5;
const RESET_LINK_VALID_MS = 30 * MINUTE_MS;
const RESET_COOLDOWN_MS = 15 * MINUTE_MS;
const BCRYPT_ROUNDS = 10;
const OUTSIDE_TOKEN_EXPIRY = '10h';
const OFFICE_TOKEN_EXPIRY = '1d';
const DEFAULT_SENDER = 'no-reply@committedcargo.com';
const SERVICE_UNAVAILABLE = 503;
const INACTIVE_STATUSES = ['inactive', 'locked'];

const errorWith = (ErrorClass, message, extra = {}) => new ErrorClass(message, { body: { error: message, ...extra } });
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const plural = (count) => (count > 1 ? 's' : '');
const isInactive = (user) => INACTIVE_STATUSES.includes(String(user.status || '').toLowerCase());
// a new list per query: Sequelize writes its own state into the include objects
const withProfileAndSettings = () => [
  { model: UserProfile, as: 'profile' },
  { model: UserSettings, as: 'settings' },
];

// ---- Wrong-password limits ------------------------------------------------------------------------------------------
// 10 wrong passwords for one User ID from one PC within 15 minutes make that User ID wait 15 minutes on that PC.
// One address outside the office is stopped after 25 wrong passwords in 15 minutes, whatever the User IDs (password
// spraying); office / LAN addresses are not limited that way. Kept in memory: a backend restart clears them.
const userFailures = new Map(); // "<address>|<user id>" -> { n, first, until }
const addressFailures = new Map(); // address -> { n, first }

const failureKey = (address, userId) => String(address || '') + '|' + String(userId || '').toLowerCase();
const plainAddress = (address) => String(address || '').replace(/^::ffff:/, '');

function minutesUntilUserMayRetry(key) {
  const failure = userFailures.get(key);
  if (!failure) return 0;
  if (failure.until && failure.until > Date.now()) return Math.ceil((failure.until - Date.now()) / MINUTE_MS);
  if (failure.until || Date.now() - failure.first > FAILURE_WINDOW_MS) userFailures.delete(key);
  return 0;
}

function minutesUntilAddressMayRetry(address) {
  const ip = plainAddress(address);
  if (isOfficeIp(ip)) return 0;
  const failure = addressFailures.get(ip);
  if (!failure) return 0;
  if (Date.now() - failure.first > FAILURE_WINDOW_MS) {
    addressFailures.delete(ip);
    return 0;
  }
  return failure.n >= MAX_FAILS_PER_OUTSIDE_ADDRESS
    ? Math.ceil((failure.first + FAILURE_WINDOW_MS - Date.now()) / MINUTE_MS)
    : 0;
}

function recordAddressFailure(address) {
  const ip = plainAddress(address);
  if (isOfficeIp(ip)) return;
  const now = Date.now();
  let failure = addressFailures.get(ip);
  if (!failure || now - failure.first > FAILURE_WINDOW_MS) failure = { n: 0, first: now };
  failure.n += 1;
  addressFailures.set(ip, failure);
  if (addressFailures.size <= MAX_TRACKED_FAILURES) return;
  for (const [key, value] of addressFailures) if (now - value.first > FAILURE_WINDOW_MS) addressFailures.delete(key);
}

function recordLoginFailure(key, address) {
  recordAddressFailure(address);
  const now = Date.now();
  let failure = userFailures.get(key);
  if (!failure || now - failure.first > FAILURE_WINDOW_MS) failure = { n: 0, first: now, until: 0 };
  failure.n += 1;
  if (failure.n >= MAX_FAILS_PER_USER_AND_PC) failure.until = now + FAILURE_WINDOW_MS;
  userFailures.set(key, failure);
  if (userFailures.size <= MAX_TRACKED_FAILURES) return;
  for (const [entryKey, value] of userFailures) {
    if (!value.until && now - value.first > FAILURE_WINDOW_MS) userFailures.delete(entryKey);
  }
}

function checkNotTooManyFailures(key, address) {
  const userWait = minutesUntilUserMayRetry(key);
  if (userWait) {
    throw errorWith(
      TooManyRequestsError,
      `Too many wrong passwords. Try again in ${userWait} minute${plural(userWait)}, ` +
        'or ask the admin to reset the password.',
    );
  }
  const addressWait = minutesUntilAddressMayRetry(address);
  if (addressWait) {
    throw errorWith(
      TooManyRequestsError,
      `Too many wrong passwords from this address. Try again in ${addressWait} minute${plural(addressWait)}.`,
    );
  }
}

// ---- Login --------------------------------------------------------------------------------------------------------
// A login from outside the office (not LAN / not in Settings "office_ips") needs a 6-digit code e-mailed to the user
// (setting login_otp_outside, on unless "off"); such a token lasts 10 hours, an office one 1 day. Every token has its
// own id (jti) so Logout can cancel it.
const isOtpWantedOutside = async () =>
  String(await settingsStore.get('login_otp_outside', 'on'))
    .trim()
    .toLowerCase() !== 'off';

/** The User ID is compared case-insensitively without LIKE (a % or _ typed in the User ID would match other users). */
function findUserForLogin(userId) {
  return User.findOne({
    where: {
      [Op.or]: [
        sequelize.where(sequelize.fn('lower', sequelize.col('User.username')), userId.toLowerCase()),
        { email: userId.toLowerCase() },
      ],
    },
    include: withProfileAndSettings(),
  });
}

/** Module rights go with the login so the menu can hide what the user cannot open. */
async function loadLoginPermissions(userId) {
  try {
    const rows = await UserPermission.findAll({ where: { userId } });
    return rows.length ? normalizePermissions(rows.map((row) => row.toJSON())) : null;
  } catch {
    return null;
  }
}

async function buildLoginAnswer(user, fromOutside) {
  const tokenPayload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    jti: crypto.randomBytes(16).toString('hex'),
  };
  const token = jwt.sign(tokenPayload, JWT_SECRET, {
    expiresIn: fromOutside ? OUTSIDE_TOKEN_EXPIRY : OFFICE_TOKEN_EXPIRY,
  });
  const permissions = await loadLoginPermissions(user.id);
  return {
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      profile: user.profile,
      settings: user.settings,
      permissions,
    },
  };
}

// ---- One-time code for a login from outside the office ---------------------------------------------------------
const pendingOtps = new Map(); // otpId -> { userId, hash, exp, tries }

function forgetExpiredOtps(now) {
  for (const [otpId, otp] of pendingOtps) if (otp.exp < now) pendingOtps.delete(otpId);
}

const maskEmail = (email) => {
  const [name, domain] = String(email).split('@');
  return (name || '').slice(0, 2) + '****@' + (domain || '');
};

function mailLoginCode(user, code) {
  return lazyTransport().sendMail({
    from: `"EagleView" <${process.env.SMTP_USER || DEFAULT_SENDER}>`,
    to: user.email,
    subject: `EagleView login code ${code}`,
    text:
      `Your EagleView login code is ${code}. It is valid for 10 minutes.\n` +
      'If you did not try to log in just now, change your password and tell the admin.',
    html:
      '<div style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;color:#334155">Your EagleView login code is' +
      `<div style="font-size:30px;font-weight:800;letter-spacing:6px;color:#1e3a8a;margin:12px 0">${code}</div>` +
      'It is valid for 10 minutes.<br><span style="color:#64748b;font-size:13px">If you did not try to log in just now, ' +
      'change your password and tell the admin.</span></div>',
  });
}

async function startOtpLogin(user, requestIp) {
  if (!user.email) {
    throw errorWith(
      ForbiddenError,
      'A login from outside the office needs an e-mail address on your user for the ' +
        'one-time code. Ask the admin, or log in from the office.',
    );
  }
  const now = Date.now();
  forgetExpiredOtps(now);
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const otpId = crypto.randomBytes(24).toString('hex');
  pendingOtps.set(otpId, { userId: user.id, hash: sha256(code), exp: now + OTP_VALID_MS, tries: 0 });
  try {
    await mailLoginCode(user, code);
  } catch (error) {
    pendingOtps.delete(otpId);
    console.error('[Login OTP] could not e-mail the code for', user.username, error.message);
    const message =
      'Could not e-mail the login code. Log in from the office, or ask the admin to check Settings > Email.';
    throw new ApiError(SERVICE_UNAVAILABLE, message, { body: { error: message } });
  }
  console.log(`[Login OTP] code e-mailed for ${user.username} (login from ${String(requestIp || '')})`);
  return {
    otpRequired: true,
    otpId,
    sentTo: maskEmail(user.email),
    message: 'Enter the 6-digit code e-mailed to you.',
  };
}

/**
 * client: { ip: req.ip, address: req.ip or the socket address }.
 * Answers the login, or the "code e-mailed" answer for a login from outside the office.
 */
export async function login({ email, username, password }, client) {
  const userId = String(username || email || '').trim();
  const key = failureKey(client.address, userId);
  checkNotTooManyFailures(key, client.address);

  const user = await findUserForLogin(userId);
  if (!user) {
    recordLoginFailure(key, client.address);
    throw errorWith(UnauthorizedError, 'Invalid User ID or Password');
  }
  if (user.status === 'inactive' || user.status === 'locked') {
    throw errorWith(ForbiddenError, `Account is ${user.status}. Please contact admin.`);
  }
  if (!(await bcrypt.compare(password, user.password))) {
    recordLoginFailure(key, client.address);
    throw errorWith(UnauthorizedError, 'Invalid User ID or Password');
  }
  userFailures.delete(key);

  const fromOutside = !isOfficeIp(client.address);
  if (fromOutside && (await isOtpWantedOutside())) return startOtpLogin(user, client.ip);
  return buildLoginAnswer(user, fromOutside);
}

const codeMatches = (given, expectedHash) =>
  /^\d{6}$/.test(given) && crypto.timingSafeEqual(Buffer.from(sha256(given)), Buffer.from(expectedHash));

/** Second step of a login from outside the office: the e-mailed code. */
export async function verifyLoginCode({ otpId, code } = {}) {
  const key = String(otpId || '');
  const otp = pendingOtps.get(key);
  if (!otp || otp.exp < Date.now()) {
    pendingOtps.delete(key);
    throw errorWith(UnauthorizedError, 'The code has expired. Log in again.', { restart: true });
  }
  otp.tries += 1;
  if (otp.tries > MAX_OTP_TRIES) {
    pendingOtps.delete(key);
    throw errorWith(TooManyRequestsError, 'Too many wrong codes. Log in again.', { restart: true });
  }
  if (!codeMatches(String(code || '').trim(), otp.hash)) {
    throw errorWith(UnauthorizedError, `Wrong code (${MAX_OTP_TRIES - otp.tries} tries left).`);
  }
  pendingOtps.delete(key);
  const user = await User.findByPk(otp.userId, { include: withProfileAndSettings() });
  if (!user || isInactive(user)) throw errorWith(ForbiddenError, 'Account is not active. Please contact admin.');
  return buildLoginAnswer(user, true);
}

/** Logout cancels the token on the server too, so a copied token stops working. */
export async function logout(authorizationHeader) {
  const header = authorizationHeader || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return;
  try {
    await revoke(jwt.verify(token, JWT_SECRET));
  } catch {
    // an expired or bad token: nothing to cancel
  }
}

// ---- Profile ----------------------------------------------------------------------------------------------------
async function findOrCreateProfile(userId) {
  const profile = await UserProfile.findOne({ where: { userId } });
  return profile || UserProfile.create({ userId });
}

/** Empty profile fields are filled from the User row. */
function fillProfileFromUser(profile, user) {
  if (!profile.firstName && !profile.lastName && user.fullName) {
    const parts = user.fullName.split(' ');
    profile.firstName = parts[0] || '';
    profile.lastName = parts.slice(1).join(' ') || '';
  }
  if (!profile.phone && user.contactNumber) profile.phone = user.contactNumber;
  if (!profile.jobTitle && user.designation) profile.jobTitle = user.designation;
}

export async function getProfile(tokenUser) {
  const user = await User.findByPk(tokenUser.id);
  const profile = (await findOrCreateProfile(tokenUser.id)).toJSON();
  if (user) fillProfileFromUser(profile, user);

  const email = user && user.email ? user.email : tokenUser.email || 'admin@eagleview.com';
  const role = user && user.role ? user.role : tokenUser.role;
  const reporting = user
    ? {
        reportingTo1: user.reportingTo1,
        reportingTo2: user.reportingTo2,
        limitMin: user.limitMin,
        limitMax: user.limitMax,
      }
    : {};
  return { ...profile, ...reporting, email, role };
}

async function syncProfileToUser(userId, changes) {
  const user = await User.findByPk(userId);
  if (!user) return;
  const fullName = [changes.firstName, changes.lastName].filter(Boolean).join(' ');
  const updates = {
    fullName: fullName || user.fullName,
    contactNumber: changes.phone || user.contactNumber,
    designation: changes.jobTitle || user.designation,
  };
  if (changes.password) updates.password = await bcrypt.hash(changes.password, await bcrypt.genSalt(BCRYPT_ROUNDS));
  await user.update(updates);
}

// the only boxes My Profile may change; id / userId / timestamps in the body are ignored, so nobody can write another
// user's profile row
const EDITABLE_PROFILE_FIELDS = ['firstName', 'lastName', 'phone', 'companyName', 'jobTitle', 'address'];

const editableProfileChanges = (body = {}) =>
  Object.fromEntries(
    EDITABLE_PROFILE_FIELDS.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]),
  );

export async function updateProfile(userId, body) {
  const changes = editableProfileChanges(body);
  let profile = await UserProfile.findOne({ where: { userId } });
  if (!profile) profile = await UserProfile.create({ ...changes, userId });
  else await profile.update(changes);
  await syncProfileToUser(userId, { ...changes, password: body?.password });
  return { message: 'Profile updated successfully', profile };
}

// ---- App Settings (gear icon > App Settings): one UserSettings row per user -----------------------------------
/** One row per user even when two tabs open at once: the oldest row is kept, extra ones removed. */
async function settingsRowOf(userId) {
  const rows = await UserSettings.findAll({ where: { userId }, order: [['id', 'ASC']] });
  if (rows.length > 1) await UserSettings.destroy({ where: { id: rows.slice(1).map((row) => row.id) } });
  return rows[0] || UserSettings.create({ userId });
}

function appSettingsAnswer(settingsRow) {
  const settings = settingsRow.toJSON();
  return {
    id: settings.id,
    userId: settings.userId,
    theme: settings.theme,
    appBackground: APP_BACKGROUNDS.includes(settings.appBackground) ? settings.appBackground : 'sky',
    primaryColor: APP_COLORS.includes(settings.primaryColor) ? settings.primaryColor : 'blue',
    notificationsEnabled: settings.notificationsEnabled !== false,
    language: settings.language || 'en',
    timezone: settings.timezone || 'Asia/Kolkata',
    updatedAt: settings.updatedAt,
  };
}

export async function getAppSettings(userId) {
  return appSettingsAnswer(await settingsRowOf(userId));
}

export async function updateAppSettings(userId, values) {
  const settings = await settingsRowOf(userId);
  await settings.update(values);
  return { message: 'Settings updated successfully', settings: appSettingsAnswer(settings) };
}

// ---- First admin (not in production) -------------------------------------------------------------------------
export async function createFirstAdmin() {
  if (env.nodeEnv === 'production') throw errorWith(NotFoundError, 'Not found');
  if ((await User.count()) !== 0) return { message: 'Users already initialized' };
  const hashedPassword = await bcrypt.hash('admin123', BCRYPT_ROUNDS);
  const user = await User.create({ email: 'admin@company.com', password: hashedPassword, role: 'admin' });
  await UserProfile.create({ userId: user.id, firstName: 'Admin', lastName: 'User' });
  await UserSettings.create({ userId: user.id });
  return { message: 'Admin user created. Use admin@company.com / admin123' };
}

// ---- Forgot / reset password ----------------------------------------------------------------------------------
// The answer is the same whether the User ID exists or not (so a stranger cannot learn which IDs exist), and the link
// uses only the EagleView address set in Settings ("app_public_url") or the office LAN address the request came to,
// never a host a stranger can send (Origin / Host), which could leak the reset token to another site.
export const FORGOT_PASSWORD_ANSWER = {
  message:
    'If this User ID has an e-mail address, a password reset link has been sent to it. It is valid for 30 minutes.',
};
const lastResetAt = new Map(); // upper-case User ID -> time of the last reset

const escapeHtml = (value) =>
  String(value == null ? '' : value).replace(
    /[&<>"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char],
  );

/** One reset per account per 15 minutes, so nobody can keep resetting someone else's password to lock them out. */
function isResetCoolingDown(userId) {
  const resetKey = userId.trim().toUpperCase();
  const previous = lastResetAt.get(resetKey);
  if (previous && Date.now() - previous < RESET_COOLDOWN_MS) return true;
  lastResetAt.set(resetKey, Date.now());
  return false;
}

function findUserByUserId(userId) {
  return User.findOne({
    where: sequelize.where(sequelize.fn('lower', sequelize.col('username')), userId.trim().toLowerCase()),
  });
}

function resetMailHtml(who, username, link) {
  return `
        <div style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
          <div style="background: #1e3a8a; padding: 24px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0; font-size: 22px;">COMMITTED CARGO CARE</h2>
            <p style="color: #bfdbfe; margin: 4px 0 0 0; font-size: 13px;">Password reset</p>
          </div>
          <div style="padding: 28px 26px; background: #ffffff; color: #334155; font-size: 15px; line-height: 1.6;">
            <p>Hello <b>${escapeHtml(who)}</b>,</p>
            <p>A password reset was requested for User ID <b>${escapeHtml(username)}</b>. Click the button within <b>30 minutes</b> to set a new password.</p>
            <p style="text-align: center; margin: 26px 0;">
              <a href="${escapeHtml(link)}" style="background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 6px; font-weight: bold;">Set a new password</a>
            </p>
            <p style="font-size: 13px; color: #64748b;">If you did not ask for this, ignore this e-mail. Your password has <b>not</b> changed.</p>
          </div>
        </div>`;
}

/** Sent in the background: the answer does not wait for the mail. */
async function mailResetLink(user, link) {
  const who = user.fullName || user.username;
  try {
    await lazyTransport().sendMail({
      from: `"Committed Cargo ERP" <${process.env.SMTP_USER || DEFAULT_SENDER}>`,
      to: user.email,
      subject: `Password reset link - User ID: ${user.username}`,
      text:
        `Hello ${who},\n\nA password reset was requested for User ID ${user.username}.\n` +
        `Open this link within 30 minutes to set a new password:\n${link}\n\n` +
        'If you did not ask for this, ignore this e-mail - your password has not changed.',
      html: resetMailHtml(who, user.username, link),
    });
    console.log(`[ForgotPwd] Reset link e-mailed for User ID: ${user.username}`);
  } catch (error) {
    console.error(`[ForgotPwd] could not e-mail the reset link for ${user.username}:`, error.message);
  }
}

/** appUrl: the EagleView address for the link (webSecurity.publicBase of the request), or null. */
export async function sendPasswordResetLink(userId, appUrl) {
  if (isResetCoolingDown(userId)) return;

  const user = await findUserByUserId(userId);
  if (!user || !user.email || isInactive(user)) {
    console.log(
      `[ForgotPwd] request for "${userId.trim().slice(0, 40)}" - no active user with an e-mail; nothing sent`,
    );
    return;
  }
  if (!appUrl) {
    console.warn(
      '[ForgotPwd] no EagleView address set (Settings: app_public_url) for a request from outside the office - nothing sent',
    );
    return;
  }

  // a one-time link: the password changes only when the user opens it and sets a new one
  const token = crypto.randomBytes(32).toString('hex');
  user.resetTokenHash = sha256(token);
  user.resetTokenExpires = new Date(Date.now() + RESET_LINK_VALID_MS);
  await user.save();
  mailResetLink(user, `${appUrl.replace(/\/$/, '')}/reset-password?token=${token}`);
}

export async function resetPassword({ token, newPassword }) {
  const user = await User.findOne({
    where: { resetTokenHash: sha256(token), resetTokenExpires: { [Op.gt]: new Date() } },
  });
  if (!user) throw errorWith(BadRequestError, 'This reset link is invalid or has expired. Please ask for a new one.');
  user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  user.resetTokenHash = null;
  user.resetTokenExpires = null;
  await user.save();
  console.log(`[ForgotPwd] Password changed via reset link for User ID: ${user.username}`);
  return { message: 'Password changed. You can log in with the new password now.' };
}

// ---- Admin system backup ---------------------------------------------------------------------------------------
// The database is copied with SQLite "VACUUM INTO" (a clean, complete copy while the server keeps running; copying
// database.sqlite as a file could miss the changes still in database.sqlite-wal). Code is copied without node_modules /
// dist / old backups / the WhatsApp login (they make it slow and very big; npm install brings node_modules back).
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');
const BACKUP_PARTS = ['frontend', 'node-backend'];
const SKIPPED_FOLDERS = new Set([
  'node_modules',
  'dist',
  'backups',
  '.git',
  '.whatsapp-session',
  '.wwebjs_cache',
  '.wwebjs_auth',
]);
const SQLITE_FILE = /\.sqlite(-wal|-shm|-journal)?$/i;
const BYTES_PER_MB = 1048576;
let backupRunning = false;

const pad2 = (number) => String(number).padStart(2, '0');
const backupStamp = (date) =>
  `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}` +
  `_${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;

const isCopied = (source) => {
  const base = path.basename(source);
  return !SKIPPED_FOLDERS.has(base) && !SQLITE_FILE.test(base);
};

function folderTotals(folder, totals = { files: 0, bytes: 0 }) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const fullPath = path.join(folder, entry.name);
    if (entry.isDirectory()) folderTotals(fullPath, totals);
    else {
      totals.files++;
      totals.bytes += fs.statSync(fullPath).size;
    }
  }
  return totals;
}

async function copyCodeAndDatabase(startedAt) {
  const backupDir = path.join(PROJECT_ROOT, 'backups', 'admin_backup_' + backupStamp(new Date()));
  fs.mkdirSync(backupDir, { recursive: true });
  for (const part of BACKUP_PARTS) {
    const source = path.join(PROJECT_ROOT, part);
    if (fs.existsSync(source))
      await fs.promises.cp(source, path.join(backupDir, part), { recursive: true, filter: isCopied });
  }
  await sequelize.query('VACUUM INTO ?', { replacements: [path.join(backupDir, 'database.sqlite')] });

  const { files, bytes } = folderTotals(backupDir);
  const sizeMb = (bytes / BYTES_PER_MB).toFixed(1);
  console.log(
    `[Backup] ${backupDir} - ${files} files, ${sizeMb} MB, ${((Date.now() - startedAt) / 1000).toFixed(1)} s`,
  );
  return {
    success: true,
    message: `Backup created: ${files} files, ${sizeMb} MB (code + database, without node_modules)`,
    backupDir,
    files,
    sizeMB: Number(sizeMb),
    seconds: Math.round((Date.now() - startedAt) / 1000),
  };
}

/** One backup at a time. */
export async function createSystemBackup() {
  if (backupRunning) throw errorWith(ConflictError, 'A backup is already running');
  backupRunning = true;
  try {
    return await copyCodeAndDatabase(Date.now());
  } catch (error) {
    console.error('Backup error:', error.message);
    throw errorWith(InternalServerError, 'Backup failed: ' + error.message);
  } finally {
    backupRunning = false;
  }
}
