// Field app security (14-Nov-2026).
// Before, every field-tracking call from a phone needed nothing: anyone with the internet link could list the field
// staff, read an agent's record (with his location) by sending his mobile number, send false GPS points, give or close
// tasks. Now:
//   - a phone registers once with the office code (Field Tracking > Phone access, admin) and its mobile number; it gets
//     its own device token (only a SHA-256 of it is kept on the agent, FieldAgents.deviceTokenHash) and sends it as the
//     X-Field-Token header; a token can only send data for its own agent; "Disconnect phone" clears it
//   - office screens send the EagleView login as before
//   - "Old field app allowed" (setting field_app_legacy, on until every phone has the new app): calls with no token are
//     still taken so the phones in the field keep working, but they get no location, phone number or full record back;
//     the agent is marked lastLegacyAt so the office sees which phones still need the new app
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const store = require('./settingsStore');
const { JWT_SECRET } = require('../middleware/auth');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const digits10 = (p) => String(p || '').replace(/\D/g, '').slice(-10);

let cache = null;
async function cfg() {
  if (cache && Date.now() - cache.at < 30000) return cache;
  const all = await store.getMany(['field_app_secret_code', 'field_app_legacy']);
  cache = { at: Date.now(), code: String(all.field_app_secret_code || '').trim(), legacy: String(all.field_app_legacy || 'on').trim().toLowerCase() !== 'off' };
  return cache;
}
const clearCfg = () => { cache = null; cfg().catch(() => {}); };
const legacyNow = () => (cache ? cache.legacy : true); // last known (socket messages; refreshed every 30 s by cfg())

// EagleView login (office screens) - Authorization: Bearer <jwt>
function staffUser(req) {
  const h = (req.header && req.header('Authorization')) || '';
  const t = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!t) return null;
  try { const p = jwt.verify(t, JWT_SECRET); return require('./tokenRevoke').isRevoked(p) ? null : p; } catch (e) { return null; }
}
const tokenOf = (req) => String((req.header && req.header('X-Field-Token')) || '').trim();

async function agentForToken(tok) {
  if (!/^[a-f0-9]{64}$/.test(String(tok || ''))) return null;
  const FieldAgent = require('../models/FieldAgent');
  return FieldAgent.findOne({ where: { deviceTokenHash: sha(tok), isActive: true } });
}

// who is calling: { staff } | { agent } | { legacy: true } | { bad: true } | null
async function caller(req) {
  const u = staffUser(req); if (u) return { staff: u };
  const t = tokenOf(req);
  if (t) { const a = await agentForToken(t); return a ? { agent: a } : { bad: true }; }
  return (await cfg()).legacy ? { legacy: true } : null;
}

const legacySeen = new Map(); // agentId -> last write (one DB write per agent per 10 minutes)
function markLegacy(ids) {
  const now = Date.now();
  const due = ids.filter(id => id && now - (legacySeen.get(id) || 0) > 600000);
  if (!due.length) return;
  due.forEach(id => legacySeen.set(id, now));
  const FieldAgent = require('../models/FieldAgent');
  FieldAgent.update({ lastLegacyAt: new Date() }, { where: { id: due }, silent: true }).catch(() => {});
}

// middleware for the calls a phone makes; idsOf(req) = the agent ids the call writes for (a token may only use its own)
function guard(idsOf) {
  return async (req, res, next) => {
    try {
      const c = await caller(req);
      if (!c || c.bad) {
        return res.status(401).json({ success: false, needRegister: true,
          error: c && c.bad ? 'This phone was disconnected by the office. Register it again with the office code.' : 'Register this phone with the office code first.' });
      }
      const ids = idsOf ? [...new Set(idsOf(req).filter(v => v != null && v !== '').map(String))] : [];
      if (c.agent && ids.some(id => id !== String(c.agent.id))) return res.status(403).json({ success: false, error: 'This phone can send data only for its own name.' });
      if (c.legacy) markLegacy(ids);
      req.field = c;
      next();
    } catch (e) {
      res.status(500).json({ success: false, error: 'Could not check the phone: ' + e.message });
    }
  };
}

// register a phone: office code + mobile number (+ name for a new person) -> device token
const tries = new Map(); // ip -> { n, first }
function tooMany(ip) {
  const now = Date.now(); let t = tries.get(ip);
  if (!t || now - t.first > 15 * 60000) { t = { n: 0, first: now }; tries.set(ip, t); }
  t.n += 1;
  if (tries.size > 5000) for (const [k, v] of tries) if (now - v.first > 15 * 60000) tries.delete(k);
  return t.n > 10;
}
async function register(req, res) {
  try {
    const ip = String(req.ip || (req.socket && req.socket.remoteAddress) || '');
    if (tooMany(ip)) return res.status(429).json({ success: false, error: 'Too many tries. Wait 15 minutes and try again.' });
    const b = req.body || {};
    const c = await cfg();
    if (!c.code) return res.status(409).json({ success: false, error: 'The office has not set the field app code yet (Field Tracking > Phone access).' });
    const given = sha(String(b.code || '').trim().toUpperCase());
    const want = sha(c.code.toUpperCase());
    if (!crypto.timingSafeEqual(Buffer.from(given), Buffer.from(want))) return res.status(403).json({ success: false, error: 'Wrong office code.' });
    const phone = digits10(b.phone);
    if (phone.length !== 10) return res.status(400).json({ success: false, error: 'Enter your 10-digit mobile number.' });
    const FieldAgent = require('../models/FieldAgent');
    let agent = (await FieldAgent.findAll({ where: { isActive: true } })).find(a => digits10(a.phone) === phone);
    if (!agent) {
      const name = String(b.name || '').trim().slice(0, 80);
      if (!name) return res.status(404).json({ success: false, needName: true, error: 'This mobile number is not in the office list. Enter your name to be added.' });
      const ids = await FieldAgent.findAll({ attributes: ['id'], raw: true });
      const max = ids.reduce((m, r) => Math.max(m, parseInt(String(r.id).replace(/^\D+/, ''), 10) || 0), 0);
      agent = await FieldAgent.create({ id: `FB-${String(max + 1).padStart(2, '0')}`, name, role: String(b.role || 'Fleet Driver').slice(0, 50), phone,
        vehicleNumber: String(b.vehicleNumber || '').slice(0, 30), status: 'Idle', currentTask: 'None', taskStatus: 'N/A', lastSeen: new Date() });
      const bus = require('./liveBus');
      bus.toField(req.app, 'agent_added', { id: agent.id, name: agent.name, role: agent.role, status: agent.status });
    }
    const token = crypto.randomBytes(32).toString('hex');
    await agent.update({ deviceTokenHash: sha(token), deviceIssuedAt: new Date() });
    console.log(`[FieldTracking] phone registered for ${agent.id} ${agent.name}`);
    res.json({ success: true, token, agent: { id: agent.id, name: agent.name, role: agent.role, vehicleNumber: agent.vehicleNumber || '' } });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Could not register the phone: ' + e.message });
  }
}

module.exports = { cfg, clearCfg, legacyNow, caller, guard, register, staffUser, agentForToken, sha, digits10 };
