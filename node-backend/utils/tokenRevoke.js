// Logged-out login tokens (14-Nov-2026, security check). Before, Logout only deleted the token in the browser: a copied
// token kept working until it expired (1 day). Now Logout sends it here; its id (jti) is refused until it would have
// expired. Kept in table RevokedTokens (survives a restart) and in memory for the check on every call.
const { sequelize } = require('../db');

const revoked = new Map(); // jti -> exp (seconds)
let ready = null;
function load() {
  return (ready = ready || (async () => {
    await sequelize.query('CREATE TABLE IF NOT EXISTS RevokedTokens (jti TEXT PRIMARY KEY, exp INTEGER NOT NULL, userId INTEGER, at TEXT)');
    const now = Math.floor(Date.now() / 1000);
    await sequelize.query('DELETE FROM RevokedTokens WHERE exp < ?', { replacements: [now] });
    const [rows] = await sequelize.query('SELECT jti, exp FROM RevokedTokens');
    rows.forEach(r => revoked.set(r.jti, r.exp));
  })().catch((e) => { ready = null; console.warn('[Auth] revoked tokens not loaded:', e.message); }));
}
load();

async function revoke(payload) {
  if (!payload || !payload.jti) return false;
  const exp = Number(payload.exp) || Math.floor(Date.now() / 1000) + 86400;
  revoked.set(payload.jti, exp);
  await load();
  await sequelize.query('INSERT OR REPLACE INTO RevokedTokens (jti, exp, userId, at) VALUES (?,?,?,?)',
    { replacements: [String(payload.jti), exp, payload.id || null, new Date().toISOString()] });
  return true;
}
function isRevoked(payload) {
  if (!payload || !payload.jti) return false;
  const exp = revoked.get(payload.jti);
  if (exp == null) return false;
  if (exp < Date.now() / 1000) { revoked.delete(payload.jti); return false; }
  return true;
}
module.exports = { revoke, isRevoked, load };
