// Logged-out login tokens. Logout sends the token here; its id (jti) is refused until it would have expired, so a copied
// token stops working at logout instead of at expiry. Kept in table RevokedTokens (survives a restart) and in memory for
// the check on every call.
import { sequelize } from '../../config/database.js';

const ONE_DAY_SECONDS = 86400; // a token without exp is kept as long as a login token lives

const revoked = new Map(); // jti -> exp (seconds)
let ready = null;

const nowInSeconds = () => Math.floor(Date.now() / 1000);

async function loadRevokedTokens() {
  await sequelize.query(
    'CREATE TABLE IF NOT EXISTS RevokedTokens (jti TEXT PRIMARY KEY, exp INTEGER NOT NULL, userId INTEGER, at TEXT)',
  );
  await sequelize.query('DELETE FROM RevokedTokens WHERE exp < ?', { replacements: [nowInSeconds()] });
  const [rows] = await sequelize.query('SELECT jti, exp FROM RevokedTokens');
  rows.forEach((row) => revoked.set(row.jti, row.exp));
}

function load() {
  ready =
    ready ||
    (async () => {
      try {
        await loadRevokedTokens();
      } catch (error) {
        ready = null;
        console.warn('[Auth] revoked tokens not loaded:', error.message);
      }
    })();
  return ready;
}

// read at start-up, so the first request already knows the logged-out tokens
load();

async function revoke(payload) {
  if (!payload || !payload.jti) return false;
  const exp = Number(payload.exp) || nowInSeconds() + ONE_DAY_SECONDS;
  revoked.set(payload.jti, exp);
  await load();
  await sequelize.query('INSERT OR REPLACE INTO RevokedTokens (jti, exp, userId, at) VALUES (?,?,?,?)', {
    replacements: [String(payload.jti), exp, payload.id || null, new Date().toISOString()],
  });
  return true;
}

function isRevoked(payload) {
  if (!payload || !payload.jti) return false;
  const exp = revoked.get(payload.jti);
  if (exp == null) return false;
  if (exp < Date.now() / 1000) {
    revoked.delete(payload.jti);
    return false;
  }
  return true;
}

export { revoke, isRevoked, load };
