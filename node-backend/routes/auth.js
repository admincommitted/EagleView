require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserProfile = require('../models/UserProfile');
const UserSettings = require('../models/UserSettings');

const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { requireAdmin, JWT_SECRET } = authMiddleware;
const crypto = require('crypto');


// Middleware to authenticate.
// Security fix: no 'dummy-token' and no silent fallback to admin on a bad/expired token.
const authenticate = authMiddleware;

// 14-Nov-2026: wrong-password limit. 10 wrong passwords for one User ID from one PC within 15 minutes -> that User ID
// waits 15 minutes on that PC. Kept in memory (a backend restart clears it); other PCs / users are not affected.
const LOGIN_MAX_FAILS = 10; const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginFails = new Map(); // key -> { n, first, until }
const loginKey = (req, id) => String(req.ip || (req.socket && req.socket.remoteAddress) || '') + '|' + String(id || '').toLowerCase();
function loginWaitMin(k) {
  const f = loginFails.get(k); if (!f) return 0;
  if (f.until && f.until > Date.now()) return Math.ceil((f.until - Date.now()) / 60000);
  if (f.until || Date.now() - f.first > LOGIN_WINDOW_MS) loginFails.delete(k);
  return 0;
}
// 14-Nov-2026 (security check): one address outside the office trying many User IDs (password spraying) is stopped
// after 25 wrong passwords in 15 minutes, whatever the IDs; office / LAN addresses are not limited this way
const IP_MAX_FAILS = 25;
const ipFails = new Map(); // ip -> { n, first }
const ipOf = (req) => String(req.ip || (req.socket && req.socket.remoteAddress) || '').replace(/^::ffff:/, '');
function ipBlocked(req) {
  const ip = ipOf(req); if (require('../utils/webSecurity').isOfficeIp(ip)) return 0;
  const f = ipFails.get(ip); if (!f) return 0;
  if (Date.now() - f.first > LOGIN_WINDOW_MS) { ipFails.delete(ip); return 0; }
  return f.n >= IP_MAX_FAILS ? Math.ceil((f.first + LOGIN_WINDOW_MS - Date.now()) / 60000) : 0;
}
function ipFailed(req) {
  const ip = ipOf(req); if (require('../utils/webSecurity').isOfficeIp(ip)) return;
  const now = Date.now(); let f = ipFails.get(ip);
  if (!f || now - f.first > LOGIN_WINDOW_MS) f = { n: 0, first: now };
  f.n += 1; ipFails.set(ip, f);
  if (ipFails.size > 5000) for (const [k, v] of ipFails) if (now - v.first > LOGIN_WINDOW_MS) ipFails.delete(k);
}
function loginFailed(k, req) {
  if (req) ipFailed(req);
  const now = Date.now(); let f = loginFails.get(k);
  if (!f || now - f.first > LOGIN_WINDOW_MS) f = { n: 0, first: now, until: 0 };
  f.n += 1; if (f.n >= LOGIN_MAX_FAILS) f.until = now + LOGIN_WINDOW_MS;
  loginFails.set(k, f);
  if (loginFails.size > 5000) for (const [key, v] of loginFails) if (!v.until && now - v.first > LOGIN_WINDOW_MS) loginFails.delete(key);
}


// POST /api/auth/login
// 14-Nov-2026 (security check): a login from outside the office (not LAN / not in Settings "office_ips") needs a
// 6-digit code e-mailed to the user (setting login_otp_outside, on unless "off"); such a token lasts 10 hours (office:
// 1 day); every token has its own id (jti) so Logout can cancel it (utils/tokenRevoke.js)
const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const otpWanted = async () => String(await require('../utils/settingsStore').get('login_otp_outside', 'on')).trim().toLowerCase() !== 'off';
const isOutside = (req) => !require('../utils/webSecurity').isOfficeIp(req.ip || (req.socket && req.socket.remoteAddress));
async function issueLogin(user, outside) {
  const token = jwt.sign({ id: user.id, email: user.email, username: user.username, role: user.role, jti: crypto.randomBytes(16).toString('hex') }, JWT_SECRET, { expiresIn: outside ? '10h' : '1d' });
  // module rights go with the login so the menu can hide what the user cannot open (30-Oct-2026)
  let permissions = null;
  try {
    const rows = await require('../models/UserPermission').findAll({ where: { userId: user.id } });
    permissions = rows.length ? require('../utils/moduleCatalog').normalizePermissions(rows.map(r => r.toJSON())) : null;
  } catch (e) { permissions = null; }
  return { message: 'Login successful', token, user: { id: user.id, email: user.email, username: user.username, role: user.role, fullName: user.fullName, profile: user.profile, settings: user.settings, permissions } };
}
const otps = new Map(); // otpId -> { userId, hash, exp, tries }
async function startOtp(req, res, user) {
  if (!user.email) return res.status(403).json({ error: 'A login from outside the office needs an e-mail address on your user for the one-time code. Ask the admin, or log in from the office.' });
  const now = Date.now();
  for (const [k, v] of otps) if (v.exp < now) otps.delete(k);
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const otpId = crypto.randomBytes(24).toString('hex');
  otps.set(otpId, { userId: user.id, hash: sha256(code), exp: now + 10 * 60000, tries: 0 });
  try {
    await require('../utils/mailer').lazyTransport().sendMail({
      from: `"EagleView" <${process.env.SMTP_USER || 'no-reply@committedcargo.com'}>`,
      to: user.email,
      subject: `EagleView login code ${code}`,
      text: `Your EagleView login code is ${code}. It is valid for 10 minutes.\nIf you did not try to log in just now, change your password and tell the admin.`,
      html: `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;color:#334155">Your EagleView login code is<div style="font-size:30px;font-weight:800;letter-spacing:6px;color:#1e3a8a;margin:12px 0">${code}</div>It is valid for 10 minutes.<br><span style="color:#64748b;font-size:13px">If you did not try to log in just now, change your password and tell the admin.</span></div>`,
    });
  } catch (e) {
    otps.delete(otpId);
    console.error('[Login OTP] could not e-mail the code for', user.username, e.message);
    return res.status(503).json({ error: 'Could not e-mail the login code. Log in from the office, or ask the admin to check Settings > Email.' });
  }
  const [n, d] = String(user.email).split('@');
  console.log(`[Login OTP] code e-mailed for ${user.username} (login from ${String(req.ip || '')})`);
  return res.json({ otpRequired: true, otpId, sentTo: (n || '').slice(0, 2) + '****@' + (d || ''), message: 'Enter the 6-digit code e-mailed to you.' });
}

router.post('/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    
    // The login page sends { username }; older clients send { email }. Accept both.
    const inputValue = String(username || email || '').trim();
    if (!inputValue || !password) {
      return res.status(400).json({ error: 'User ID and Password are required' });
    }

    // Find user by username (User ID) — case-insensitive, also support email fallback
    const { Op } = require('sequelize');
    // 14-Nov-2026: too many wrong passwords for this User ID from this PC -> wait (stops password guessing)
    const lk = loginKey(req, inputValue); const wait = loginWaitMin(lk);
    if (wait) return res.status(429).json({ error: `Too many wrong passwords. Try again in ${wait} minute${wait > 1 ? 's' : ''}, or ask the admin to reset the password.` });
    const ipWait = ipBlocked(req);
    if (ipWait) return res.status(429).json({ error: `Too many wrong passwords from this address. Try again in ${ipWait} minute${ipWait > 1 ? 's' : ''}.` });
    // 14-Nov-2026: User ID compared case-insensitively without LIKE (a % or _ typed in the User ID matched other users)
    const sq = User.sequelize;
    const user = await User.findOne({ 
      where: { 
        [Op.or]: [
          sq.where(sq.fn('lower', sq.col('User.username')), inputValue.toLowerCase()), // User ID, any case
          { email: inputValue.toLowerCase() }                  // legacy email support
        ]
      },
      include: [{ model: UserProfile, as: 'profile' }, { model: UserSettings, as: 'settings' }]
    });
    if (!user) {
      loginFailed(lk, req);
      return res.status(401).json({ error: 'Invalid User ID or Password' });
    }

    // Check account status
    if (user.status === 'inactive' || user.status === 'locked') {
      return res.status(403).json({ error: `Account is ${user.status}. Please contact admin.` });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      loginFailed(lk, req);
      return res.status(401).json({ error: 'Invalid User ID or Password' });
    }
    loginFails.delete(lk);

    const outside = isOutside(req);
    if (outside && await otpWanted()) return startOtp(req, res, user);
    res.json(await issueLogin(user, outside));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
// second step of a login from outside the office: the e-mailed code
router.post('/login/otp', async (req, res) => {
  try {
    const { otpId, code } = req.body || {};
    const key = String(otpId || '');
    const o = otps.get(key);
    if (!o || o.exp < Date.now()) { otps.delete(key); return res.status(401).json({ error: 'The code has expired. Log in again.', restart: true }); }
    o.tries += 1;
    if (o.tries > 5) { otps.delete(key); return res.status(429).json({ error: 'Too many wrong codes. Log in again.', restart: true }); }
    const given = String(code || '').trim();
    if (!/^\d{6}$/.test(given) || !crypto.timingSafeEqual(Buffer.from(sha256(given)), Buffer.from(o.hash))) return res.status(401).json({ error: `Wrong code (${5 - o.tries} tries left).` });
    otps.delete(key);
    const user = await User.findByPk(o.userId, { include: [{ model: UserProfile, as: 'profile' }, { model: UserSettings, as: 'settings' }] });
    if (!user || ['inactive', 'locked'].includes(String(user.status || '').toLowerCase())) return res.status(403).json({ error: 'Account is not active. Please contact admin.' });
    res.json(await issueLogin(user, true));
  } catch (err) {
    res.status(500).json({ error: 'Could not check the code: ' + err.message });
  }
});

// 14-Nov-2026: Logout cancels the token on the server too (before, a copied token kept working until it expired)
router.post('/logout', async (req, res) => {
  const h = req.header('Authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (t) { try { await require('../utils/tokenRevoke').revoke(jwt.verify(t, JWT_SECRET)); } catch (e) { /* expired / bad: nothing to cancel */ } }
  res.json({ message: 'Logout successful' });
});

// GET /api/auth/profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    let profile = await UserProfile.findOne({ where: { userId: req.user.id } });
    
    if (!profile) {
      profile = await UserProfile.create({ userId: req.user.id });
    }
    
    let pJson = profile.toJSON();
    
    // Auto-fill from User table if empty
    if (user) {
        if (!pJson.firstName && !pJson.lastName && user.fullName) {
            const parts = user.fullName.split(' ');
            pJson.firstName = parts[0] || '';
            pJson.lastName = parts.slice(1).join(' ') || '';
        }
        if (!pJson.phone && user.contactNumber) pJson.phone = user.contactNumber;
        if (!pJson.jobTitle && user.designation) pJson.jobTitle = user.designation;
    }

    const email = (user && user.email) ? user.email : (req.user.email || 'admin@eagleview.com');
    const role = (user && user.role) ? user.role : req.user.role;
    
    const extra = user ? {
        reportingTo1: user.reportingTo1,
        reportingTo2: user.reportingTo2,
        limitMin: user.limitMin,
        limitMax: user.limitMax
    } : {};
    
    res.json({ ...pJson, ...extra, email, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    let profile = await UserProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      profile = await UserProfile.create({ userId: req.user.id, ...req.body });
    } else {
      await profile.update(req.body);
    }
    
    // Also sync back to User table
    const user = await User.findByPk(req.user.id);
    if (user) {
       const fullName = [req.body.firstName, req.body.lastName].filter(Boolean).join(' ');
       let updates = {
           fullName: fullName || user.fullName,
           contactNumber: req.body.phone || user.contactNumber,
           designation: req.body.jobTitle || user.designation
       };
       
       if (req.body.password) {
           const bcrypt = require('bcryptjs');
           const salt = await bcrypt.genSalt(10);
           updates.password = await bcrypt.hash(req.body.password, salt);
       }
       
       await user.update(updates);
    }

    res.json({ message: 'Profile updated successfully', profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// App Settings (gear icon > App Settings): one UserSettings row per user. 28-Oct-2026:
// - PUT saved the whole body, so a request could change userId / id (another user's row); now only the 6 fields,
//   each checked against the values the screen offers;
// - the server no longer overrides the chosen background from the colour (picking a background after a colour was
//   lost on save, and "midnight" saved a background that does not exist);
// - one row per user even when two tabs open at once (oldest row kept, extra ones removed).
const APP_BACKGROUNDS = ['slate', 'white', 'warm', 'sky', 'mint', 'lavender', 'peach', 'rose', 'coolgrey', 'ivory', 'ice', 'seagreen', 'lemon']; // 22-Nov-2026: last five added
const APP_COLORS = ['ocean', 'blue', 'emerald', 'forest', 'violet', 'plum', 'rose', 'crimson', 'amber', 'pumpkin', 'cyan', 'pink', 'teal', 'indigo', 'midnight', 'gray', 'ruby', 'lime', 'sage', 'coral', 'magenta', 'slate', 'navy', 'sky', 'gold', 'fuchsia', 'tangerine', 'cerulean', 'olive', 'berry', 'chocolate', 'lavender', 'deepteal', 'steel', 'royal', 'petrol', 'bottle', 'maroon', 'bronze', 'charcoal']; // 22-Nov-2026: last seven added
const APP_LANGS = ['en', 'hi', 'es'];
async function settingsRow(userId) {
  const rows = await UserSettings.findAll({ where: { userId }, order: [['id', 'ASC']] });
  if (rows.length > 1) await UserSettings.destroy({ where: { id: rows.slice(1).map(r => r.id) } });
  return rows[0] || UserSettings.create({ userId });
}
const settingsOut = (s) => { const j = s.toJSON(); return { id: j.id, userId: j.userId, theme: j.theme, appBackground: APP_BACKGROUNDS.includes(j.appBackground) ? j.appBackground : 'sky', primaryColor: APP_COLORS.includes(j.primaryColor) ? j.primaryColor : 'blue', notificationsEnabled: j.notificationsEnabled !== false, language: j.language || 'en', timezone: j.timezone || 'Asia/Kolkata', updatedAt: j.updatedAt }; };

// GET /api/auth/settings
router.get('/settings', authenticate, async (req, res) => {
  try {
    res.json(settingsOut(await settingsRow(req.user.id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/settings
router.put('/settings', authenticate, async (req, res) => {
  try {
    const b = req.body || {};
    const v = {}; const errors = [];
    if (b.appBackground !== undefined) { if (APP_BACKGROUNDS.includes(b.appBackground)) v.appBackground = b.appBackground; else errors.push('Unknown background: ' + b.appBackground); }
    if (b.primaryColor !== undefined) { if (APP_COLORS.includes(b.primaryColor)) v.primaryColor = b.primaryColor; else errors.push('Unknown theme colour: ' + b.primaryColor); }
    if (b.language !== undefined) { if (APP_LANGS.includes(b.language)) v.language = b.language; else errors.push('Unknown language: ' + b.language); }
    if (b.theme !== undefined) { if (['light', 'dark'].includes(b.theme)) v.theme = b.theme; else errors.push('Theme must be light or dark'); }
    if (b.notificationsEnabled !== undefined) v.notificationsEnabled = b.notificationsEnabled === true || b.notificationsEnabled === 'true';
    if (b.timezone !== undefined) {
      try { new Intl.DateTimeFormat('en', { timeZone: String(b.timezone) }); v.timezone = String(b.timezone); } catch (e) { errors.push('Unknown time zone: ' + b.timezone); }
    }
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });
    const settings = await settingsRow(req.user.id);
    await settings.update(v);
    res.json({ message: 'Settings updated successfully', settings: settingsOut(settings) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create default admin if no users exist
router.post('/init', async (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'Not found' });
    const count = await User.count();
    if (count === 0) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const user = await User.create({ email: 'admin@company.com', password: hashedPassword, role: 'admin' });
        await UserProfile.create({ userId: user.id, firstName: 'Admin', lastName: 'User' });
        await UserSettings.create({ userId: user.id });
        res.json({ message: 'Admin user created. Use admin@company.com / admin123' });
    } else {
        res.json({ message: 'Users already initialized' });
    }
});


const nodemailer = require('nodemailer');

// POST /api/auth/forgot-password
// Accepts User ID (username) — finds the mapped email and sends reset password there
const lastResetAt = new Map(); // username -> timestamp (per-account cooldown)
const RESET_COOLDOWN_MS = 15 * 60 * 1000;

router.post('/forgot-password', async (req, res) => {
  // 14-Nov-2026 (security check): the same answer whether the User ID exists or not (before, "No account found" told a
  // stranger which IDs exist), and the link in the e-mail uses only the EagleView address set in Settings
  // ("app_public_url" / APP_PUBLIC_URL) or the office LAN address the request came to - never a host a stranger can send
  // (Origin / Host), which could have made the real e-mail carry a link to another site and leak the reset token.
  const SAME = { message: 'If this User ID has an e-mail address, a password reset link has been sent to it. It is valid for 30 minutes.' };
  try {
    const { userId } = req.body || {};
    if (!userId || typeof userId !== 'string' || userId.length > 100) return res.status(400).json({ error: 'User ID is required' });

    // one reset per account per 15 minutes, so nobody can keep resetting someone else's password to lock them out
    const resetKey = userId.trim().toUpperCase();
    const prev = lastResetAt.get(resetKey);
    if (prev && Date.now() - prev < RESET_COOLDOWN_MS) return res.json(SAME);
    lastResetAt.set(resetKey, Date.now());

    const sq = User.sequelize;
    const user = await User.findOne({ where: sq.where(sq.fn('lower', sq.col('username')), userId.trim().toLowerCase()) });
    if (!user || !user.email || ['inactive', 'locked'].includes(String(user.status || '').toLowerCase())) {
      console.log(`[ForgotPwd] request for "${userId.trim().slice(0, 40)}" - no active user with an e-mail; nothing sent`);
      return res.json(SAME);
    }
    const appUrl = require('../utils/webSecurity').publicBase(req);
    if (!appUrl) {
      console.warn('[ForgotPwd] no EagleView address set (Settings: app_public_url) for a request from outside the office - nothing sent');
      return res.json(SAME);
    }

    // one-time link (valid 30 minutes); the password changes only when the user opens it and sets a new one
    const token = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    const link = `${appUrl.replace(/\/$/, '')}/reset-password?token=${token}`;
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const who = user.fullName || user.username;

    // SMTP from Settings > Email, .env as fallback (utils/mailer.js). 28-Oct-2026
    const transporter = require('../utils/mailer').lazyTransport();
    transporter.sendMail({
      from: `"Committed Cargo ERP" <${process.env.SMTP_USER || 'no-reply@committedcargo.com'}>`,
      to: user.email,
      subject: `Password reset link - User ID: ${user.username}`,
      text: `Hello ${who},\n\nA password reset was requested for User ID ${user.username}.\nOpen this link within 30 minutes to set a new password:\n${link}\n\nIf you did not ask for this, ignore this e-mail - your password has not changed.`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
          <div style="background: #1e3a8a; padding: 24px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0; font-size: 22px;">COMMITTED CARGO CARE</h2>
            <p style="color: #bfdbfe; margin: 4px 0 0 0; font-size: 13px;">Password reset</p>
          </div>
          <div style="padding: 28px 26px; background: #ffffff; color: #334155; font-size: 15px; line-height: 1.6;">
            <p>Hello <b>${esc(who)}</b>,</p>
            <p>A password reset was requested for User ID <b>${esc(user.username)}</b>. Click the button within <b>30 minutes</b> to set a new password.</p>
            <p style="text-align: center; margin: 26px 0;">
              <a href="${esc(link)}" style="background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 6px; font-weight: bold;">Set a new password</a>
            </p>
            <p style="font-size: 13px; color: #64748b;">If you did not ask for this, ignore this e-mail. Your password has <b>not</b> changed.</p>
          </div>
        </div>`
    }).then(() => console.log(`[ForgotPwd] Reset link e-mailed for User ID: ${user.username}`))
      .catch((e) => console.error(`[ForgotPwd] could not e-mail the reset link for ${user.username}:`, e.message));
    res.json(SAME);
  } catch (error) {
    console.error("Forgot password error:", error);
    res.json(SAME);
  }
});


// POST /api/auth/reset-password  { token, newPassword }  - finishes the e-mailed reset (28-Oct-2026)
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Reset link is missing or broken.' });
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    const { Op } = require('sequelize');
    const user = await User.findOne({ where: {
      resetTokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      resetTokenExpires: { [Op.gt]: new Date() }
    } });
    if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired. Please ask for a new one.' });
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetTokenHash = null;
    user.resetTokenExpires = null;
    await user.save();
    console.log(`[ForgotPwd] Password changed via reset link for User ID: ${user.username}`);
    res.json({ message: 'Password changed. You can log in with the new password now.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Could not reset the password. Please contact admin.' });
  }
});

// Admin System Backup Route
// 28-Oct-2026: the database is copied with SQLite "VACUUM INTO" (a clean, complete copy while the server keeps
// running; copying database.sqlite as a file could miss the changes still in database.sqlite-wal). Code is copied
// without node_modules / dist / old backups / the WhatsApp login (node_modules made it slow and very big, and it can
// be installed again with npm install). Folder found from this file, not a fixed d:\ path. One backup at a time.
let backupRunning = false;
router.post('/system-backup', authenticate, requireAdmin, async (req, res) => {
  if (backupRunning) return res.status(409).json({ error: 'A backup is already running' });
  backupRunning = true;
  const fs = require('fs'); const path = require('path');
  const t0 = Date.now();
  try {
    const root = path.resolve(__dirname, '..', '..');
    const pad = (n) => String(n).padStart(2, '0'); const d = new Date();
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const backupDir = path.join(root, 'backups', 'admin_backup_' + stamp);
    fs.mkdirSync(backupDir, { recursive: true });
    const SKIP = new Set(['node_modules', 'dist', 'backups', '.git', '.whatsapp-session', '.wwebjs_cache', '.wwebjs_auth']);
    const filter = (src) => { const base = path.basename(src); if (SKIP.has(base)) return false; if (/\.sqlite(-wal|-shm|-journal)?$/i.test(base)) return false; return true; };
    let files = 0, bytes = 0;
    const count = (p) => { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const f = path.join(p, e.name); if (e.isDirectory()) count(f); else { files++; bytes += fs.statSync(f).size; } } };
    for (const part of ['frontend', 'node-backend']) {
      const src = path.join(root, part);
      if (fs.existsSync(src)) await fs.promises.cp(src, path.join(backupDir, part), { recursive: true, filter });
    }
    // database: consistent copy
    const { sequelize } = require('../db');
    const dbFile = path.join(backupDir, 'database.sqlite');
    await sequelize.query('VACUUM INTO ?', { replacements: [dbFile] });
    count(backupDir);
    const mb = (bytes / 1048576).toFixed(1);
    console.log(`[Backup] ${backupDir} - ${files} files, ${mb} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    res.json({ success: true, message: `Backup created: ${files} files, ${mb} MB (code + database, without node_modules)`, backupDir, files, sizeMB: Number(mb), seconds: Math.round((Date.now() - t0) / 1000) });
  } catch (error) {
    console.error('Backup error:', error.message);
    res.status(500).json({ error: 'Backup failed: ' + error.message });
  } finally { backupRunning = false; }
});


module.exports = router;
