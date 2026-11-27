// Field app security.
//   - a phone registers once with the office code (Field Tracking > Phone access, admin) and its mobile number; it gets
//     its own device token (only a SHA-256 of it is kept on the agent, FieldAgents.deviceTokenHash) and sends it as the
//     X-Field-Token header; a token can only send data for its own agent; "Disconnect phone" clears it
//   - office screens send the EagleView login
//   - "Old field app allowed" (setting field_app_legacy, on until every phone has the new app): calls with no token are
//     still taken so the phones in the field keep working, but they get no location, phone number or full record back;
//     the agent is marked lastLegacyAt so the office sees which phones still need the new app
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { FieldAgent } from '../models/index.js';
import { getMany as getSettings } from '../utils/common/settingsStore.js';
import { isRevoked } from '../utils/security/tokenRevoke.js';
import { toField } from './liveBus.js';

const CONFIG_CACHE_TTL_MS = 30000;
const LEGACY_MARK_INTERVAL_MS = 10 * 60 * 1000;
const REGISTER_WINDOW_MS = 15 * 60 * 1000;
const MAX_REGISTER_TRIES = 10;
const MAX_TRACKED_IPS = 5000;
const DEVICE_TOKEN_BYTES = 32;
const DEVICE_TOKEN = /^[a-f0-9]{64}$/;
const DEFAULT_AGENT_ROLE = 'Fleet Driver';

const sha = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const digits10 = (phone) =>
  String(phone || '')
    .replace(/\D/g, '')
    .slice(-10);

let configCache = null;

/** { code, legacy } from Settings, cached for 30 seconds. */
export async function cfg() {
  if (configCache && Date.now() - configCache.at < CONFIG_CACHE_TTL_MS) return configCache;
  const settings = await getSettings(['field_app_secret_code', 'field_app_legacy']);
  configCache = {
    at: Date.now(),
    code: String(settings.field_app_secret_code || '').trim(),
    legacy:
      String(settings.field_app_legacy || 'on')
        .trim()
        .toLowerCase() !== 'off',
  };
  return configCache;
}

export const clearCfg = () => {
  configCache = null;
  cfg().catch(() => {});
};

// last known value, for socket messages (refreshed every 30 s by cfg())
export const legacyNow = () => (configCache ? configCache.legacy : true);

/** EagleView login of an office screen (Authorization: Bearer <jwt>), or null. */
function staffUser(req) {
  const header = (req.header && req.header('Authorization')) || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    return isRevoked(payload) ? null : payload;
  } catch {
    return null;
  }
}

const deviceTokenOf = (req) => String((req.header && req.header('X-Field-Token')) || '').trim();

export async function agentForToken(token) {
  if (!DEVICE_TOKEN.test(String(token || ''))) return null;
  return FieldAgent.findOne({ where: { deviceTokenHash: sha(token), isActive: true } });
}

/** Who is calling: { staff } | { agent } | { legacy: true } | { bad: true } | null. */
export async function caller(req) {
  const staff = staffUser(req);
  if (staff) return { staff };
  const token = deviceTokenOf(req);
  if (token) {
    const agent = await agentForToken(token);
    return agent ? { agent } : { bad: true };
  }
  return (await cfg()).legacy ? { legacy: true } : null;
}

const legacySeenAt = new Map(); // agentId -> last write (one DB write per agent per 10 minutes)

function markLegacy(agentIds) {
  const now = Date.now();
  const due = agentIds.filter((id) => id && now - (legacySeenAt.get(id) || 0) > LEGACY_MARK_INTERVAL_MS);
  if (!due.length) return;
  due.forEach((id) => legacySeenAt.set(id, now));
  FieldAgent.update({ lastLegacyAt: new Date() }, { where: { id: due }, silent: true }).catch(() => {});
}

const notRegisteredText = (result) =>
  result && result.bad
    ? 'This phone was disconnected by the office. Register it again with the office code.'
    : 'Register this phone with the office code first.';

/**
 * Middleware for the calls a phone makes; idsOf(req) = the agent ids the call writes for (a token may only use its own).
 */
export function guard(idsOf) {
  return async (req, res, next) => {
    try {
      const result = await caller(req);
      if (!result || result.bad) {
        return res.status(401).json({ success: false, needRegister: true, error: notRegisteredText(result) });
      }
      const ids = idsOf
        ? [
            ...new Set(
              idsOf(req)
                .filter((id) => id != null && id !== '')
                .map(String),
            ),
          ]
        : [];
      if (result.agent && ids.some((id) => id !== String(result.agent.id))) {
        return res.status(403).json({ success: false, error: 'This phone can send data only for its own name.' });
      }
      if (result.legacy) markLegacy(ids);
      req.field = result;
      return next();
    } catch (error) {
      return res.status(500).json({ success: false, error: `Could not check the phone: ${error.message}` });
    }
  };
}

const registerTries = new Map(); // ip -> { count, first }

function tooManyTries(ip) {
  const now = Date.now();
  let tries = registerTries.get(ip);
  if (!tries || now - tries.first > REGISTER_WINDOW_MS) {
    tries = { count: 0, first: now };
    registerTries.set(ip, tries);
  }
  tries.count += 1;
  if (registerTries.size > MAX_TRACKED_IPS) {
    for (const [key, value] of registerTries) if (now - value.first > REGISTER_WINDOW_MS) registerTries.delete(key);
  }
  return tries.count > MAX_REGISTER_TRIES;
}

const codeMatches = (givenCode, officeCode) => {
  const given = sha(
    String(givenCode || '')
      .trim()
      .toUpperCase(),
  );
  const wanted = sha(officeCode.toUpperCase());
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(wanted));
};

const findActiveAgentByPhone = async (phone) => {
  const agents = await FieldAgent.findAll({ where: { isActive: true } });
  return agents.find((agent) => digits10(agent.phone) === phone);
};

// the next free FB-<nn> id: one more than the highest number used
async function nextAgentId() {
  const rows = await FieldAgent.findAll({ attributes: ['id'], raw: true });
  const highest = rows.reduce((max, row) => Math.max(max, parseInt(String(row.id).replace(/^\D+/, ''), 10) || 0), 0);
  return `FB-${String(highest + 1).padStart(2, '0')}`;
}

async function addAgent(body, name, phone) {
  return FieldAgent.create({
    id: await nextAgentId(),
    name,
    role: String(body.role || DEFAULT_AGENT_ROLE).slice(0, 50),
    phone,
    vehicleNumber: String(body.vehicleNumber || '').slice(0, 30),
    status: 'Idle',
    currentTask: 'None',
    taskStatus: 'N/A',
    lastSeen: new Date(),
  });
}

/** Register a phone: office code + mobile number (+ name for a new person) -> device token. */
export async function register(req, res) {
  try {
    const ip = String(req.ip || (req.socket && req.socket.remoteAddress) || '');
    if (tooManyTries(ip)) {
      return res.status(429).json({ success: false, error: 'Too many tries. Wait 15 minutes and try again.' });
    }
    const body = req.body || {};
    const config = await cfg();
    if (!config.code) {
      return res.status(409).json({
        success: false,
        error: 'The office has not set the field app code yet (Field Tracking > Phone access).',
      });
    }
    if (!codeMatches(body.code, config.code))
      return res.status(403).json({ success: false, error: 'Wrong office code.' });

    const phone = digits10(body.phone);
    if (phone.length !== 10)
      return res.status(400).json({ success: false, error: 'Enter your 10-digit mobile number.' });

    let agent = await findActiveAgentByPhone(phone);
    if (!agent) {
      const name = String(body.name || '')
        .trim()
        .slice(0, 80);
      if (!name) {
        return res.status(404).json({
          success: false,
          needName: true,
          error: 'This mobile number is not in the office list. Enter your name to be added.',
        });
      }
      agent = await addAgent(body, name, phone);
      toField(req.app, 'agent_added', { id: agent.id, name: agent.name, role: agent.role, status: agent.status });
    }

    const token = crypto.randomBytes(DEVICE_TOKEN_BYTES).toString('hex');
    await agent.update({ deviceTokenHash: sha(token), deviceIssuedAt: new Date() });
    console.log(`[FieldTracking] phone registered for ${agent.id} ${agent.name}`);
    return res.json({
      success: true,
      token,
      agent: { id: agent.id, name: agent.name, role: agent.role, vehicleNumber: agent.vehicleNumber || '' },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: `Could not register the phone: ${error.message}` });
  }
}
