import fs from 'node:fs';
import path from 'node:path';
import { Op } from 'sequelize';
import { AppSetting, FieldAgent, FieldAgentLocation } from '../../models/index.js';
import { BACKEND_ROOT } from '../../config/env.js';
import * as settingsStore from '../../utils/common/settingsStore.js';
import { cfg as fieldAppConfig, clearCfg as clearFieldAppConfig } from '../../sockets/fieldAuth.js';
import { toAgent, toField } from '../../sockets/liveBus.js';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../core/http/index.js';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
// a phone that has not sent its location for this long is shown Offline
const OFFLINE_AFTER_MS = 10 * MINUTE_MS;
const MAX_BULK_PINGS = 200;
const DEFAULT_HISTORY_HOURS = 8;
const EARTH_RADIUS_KM = 6371;
// a jump of more than 1 km between two pings is a GPS error, not distance travelled
const MAX_PING_JUMP_KM = 1;
const MAX_REAL_SPEED = 200;
const PUBLIC_URL_FILE = path.join(BACKEND_ROOT, 'FIELD_PUBLIC_URL.txt');
const PUBLIC_URL_PATTERN = /^https:\/\/[a-z0-9.-]+$/i;
const OFFICE_CODE_SETTING = 'field_app_secret_code';
const LEGACY_APP_SETTING = 'field_app_legacy';

const failure = (message, extra = {}) => ({ body: { success: false, ...extra, error: message } });
const agentNotFound = () => new NotFoundError('Agent not found', failure('Agent not found'));
const nowIso = () => new Date().toISOString();

// ---- Agents ------------------------------------------------------------------------------------------------------
/** The next number after the highest one used, so a removed agent's ID is never given again. */
async function nextAgentId() {
  const ids = await FieldAgent.findAll({ attributes: ['id'], raw: true });
  const highest = ids.reduce((max, row) => Math.max(max, parseInt(String(row.id).replace(/^\D+/, ''), 10) || 0), 0);
  return `FB-${String(highest + 1).padStart(2, '0')}`;
}

function lastSeenText(lastSeen) {
  if (!lastSeen) return 'Never';
  const minutes = Math.floor((Date.now() - new Date(lastSeen).getTime()) / MINUTE_MS);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} mins ago`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)} hours ago`;
  return `${Math.floor(minutes / 1440)} days ago`;
}

const isStale = (agent) => !agent.lastSeen || Date.now() - new Date(agent.lastSeen).getTime() > OFFLINE_AFTER_MS;

/** The field app's "choose your name" list: no live location, battery or task. */
const briefAgent = (agent) => ({
  id: agent.id,
  name: agent.name,
  role: agent.role,
  vehicleNumber: agent.vehicleNumber || '',
  status: agent.status,
});

const maskPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 4 ? '******' + digits.slice(-4) : '';
};

/** An app that is closed or without signal shows Offline. */
function withLiveStatus(agentRow) {
  const agent = agentRow.toJSON();
  agent.lastSeenText = lastSeenText(agent.lastSeen);
  if (agent.status !== 'Offline' && isStale(agent)) agent.status = 'Offline';
  return agent;
}

/**
 * caller (fieldAuth.caller): { staff } | { agent } | { legacy } | { bad } | null.
 * A registered phone sees only its own name; without an EagleView login only the "choose your name" list with the
 * phone masked; the office sees everything.
 */
export async function listAgents(caller) {
  if (!caller || caller.bad) {
    throw new UnauthorizedError(
      'Register this phone with the office code first.',
      failure('Register this phone with the office code first.', { needRegister: true }),
    );
  }
  if (caller.agent) return { success: true, data: [briefAgent(caller.agent)] };

  const agents = (await FieldAgent.findAll({ where: { isActive: true }, order: [['lastSeen', 'DESC']] })).map(
    withLiveStatus,
  );
  if (!caller.staff) {
    return { success: true, data: agents.map((agent) => ({ ...briefAgent(agent), phone: maskPhone(agent.phone) })) };
  }
  return { success: true, data: agents };
}

/** The internet address of the field app while start_field_internet.bat runs (the field gateway writes it). */
export function readPublicUrl() {
  try {
    const url = fs.readFileSync(PUBLIC_URL_FILE, 'utf8').trim();
    return { success: true, url: PUBLIC_URL_PATTERN.test(url) ? url : null };
  } catch {
    return { success: true, url: null };
  }
}

export async function getAgent(id) {
  const agent = await FieldAgent.findByPk(id);
  if (!agent) throw agentNotFound();
  return { success: true, data: agent };
}

const lastTenDigits = (phone) =>
  String(phone || '')
    .replace(/\D/g, '')
    .slice(-10);

async function findActiveAgentByPhone(digits) {
  const agents = await FieldAgent.findAll({ where: { isActive: true } });
  return agents.find((agent) => lastTenDigits(agent.phone) === digits);
}

/**
 * Office screens (login) or the old field app while it is allowed; the new app registers through /device/register.
 * The same mobile number registering again gets its own agent back, not a copy.
 * Answers { isNew, answer }.
 */
export async function addAgent(caller, body, app) {
  if (!caller || caller.bad || caller.agent) {
    throw new UnauthorizedError(
      'Register this phone with the office code (new field app).',
      failure('Register this phone with the office code (new field app).', { needRegister: true }),
    );
  }
  const shown = (agent) => (caller.staff ? agent : briefAgent(agent));
  const { name, role, phone, vehicleNumber } = body;
  if (!name || !phone) throw new BadRequestError('Name and phone are required', failure('Name and phone are required'));

  const digits = lastTenDigits(phone);
  if (digits.length === 10) {
    const sameAgent = await findActiveAgentByPhone(digits);
    if (sameAgent) return { isNew: false, answer: { success: true, data: shown(sameAgent.toJSON()), existing: true } };
  }

  const agent = await FieldAgent.create({
    id: await nextAgentId(),
    name,
    role: role || 'Fleet Driver',
    phone,
    vehicleNumber: vehicleNumber || '',
    status: 'Idle',
    currentLat: null,
    currentLng: null,
    currentLocation: 'Location Unknown',
    battery: 100,
    speed: '0 km/h',
    currentTask: 'None',
    taskStatus: 'N/A',
    lastSeen: new Date(),
  });
  toField(app, 'agent_added', agent.toJSON());
  return { isNew: true, answer: { success: true, data: shown(agent.toJSON()) } };
}

export async function deactivateAgent(id, app) {
  await FieldAgent.update({ isActive: false }, { where: { id } });
  toField(app, 'agent_removed', { agentId: id });
  return { success: true, message: 'Agent deactivated' };
}

// ---- Locations ---------------------------------------------------------------------------------------------------
const speedText = (speed) => (speed !== undefined ? `${Math.round(speed)} km/h` : undefined);

function locationHistoryRow({ agentId, lat, lng, accuracy, speed, heading, battery, locationName }, recordedAt) {
  return {
    agentId,
    lat,
    lng,
    accuracy: accuracy || null,
    speed: speed || 0,
    heading: heading || null,
    battery: battery || null,
    locationName: locationName || null,
    recordedAt,
  };
}

/** An agent registered by hand on a phone is created on its first ping (office logins and the old app only). */
async function createAgentFromPing(body, speed) {
  const { agentId, lat, lng, battery, locationName } = body;
  const agentName = body.agentName || agentId;
  await FieldAgent.create({
    id: agentId,
    name: agentName,
    role: body.role || 'Fleet Driver',
    phone: body.phone || '',
    status: 'In Transit',
    currentLat: lat,
    currentLng: lng,
    currentLocation: locationName || 'Unknown',
    battery: battery || 100,
    speed: speed || '0 km/h',
    lastSeen: new Date(),
  });
  console.log('[FieldTracking] Auto-created agent:', agentId, agentName);
}

function currentPositionUpdate({ lat, lng, battery, locationName }, speed) {
  const update = { currentLat: lat, currentLng: lng, lastSeen: new Date(), status: 'In Transit' };
  if (battery !== undefined) update.battery = battery;
  if (speed !== undefined) update.speed = speed;
  if (locationName) update.currentLocation = locationName;
  return update;
}

/** field: who sent it (fieldAuth.guard). */
export async function recordLocation(field, body, app) {
  const { agentId, lat, lng, battery, locationName } = body;
  const speed = speedText(body.speed);
  const existing = await FieldAgent.findByPk(agentId);
  if (!existing && !field.legacy && !field.staff) throw agentNotFound();
  if (existing) await FieldAgent.update(currentPositionUpdate(body, speed), { where: { id: agentId } });
  else await createAgentFromPing(body, speed);

  await FieldAgentLocation.create(locationHistoryRow(body, body.timestamp ? new Date(body.timestamp) : new Date()));
  toField(app, 'agent_location_update', {
    agentId,
    lat,
    lng,
    speed: speed || '0 km/h',
    battery,
    locationName,
    lastSeen: nowIso(),
  });
  return { success: true, message: 'Location updated' };
}

/** Saves the pings (at most 200 at a time) and answers the newest ping of each agent; a bad ping is skipped. */
async function saveBulkPings(pings) {
  const latestByAgent = {};
  let accepted = 0;
  for (const ping of pings.slice(0, MAX_BULK_PINGS)) {
    const { agentId, lat, lng, speed, battery, locationName, timestamp } = ping;
    if (!agentId || lat === undefined || lng === undefined) continue;
    try {
      await FieldAgentLocation.create(locationHistoryRow(ping, timestamp ? new Date(timestamp) : new Date()));
      accepted++;
      latestByAgent[agentId] = { agentId, lat, lng, speed, battery, locationName, ts: timestamp };
    } catch {
      // skip a bad record
    }
  }
  return { accepted, latestByAgent };
}

/** The offline queue of the field app: many pings at once; each agent moves to his newest one. */
export async function recordLocations(pings, app) {
  const { accepted, latestByAgent } = await saveBulkPings(pings);
  for (const [agentId, latest] of Object.entries(latestByAgent)) {
    const speed = speedText(latest.speed);
    const update = { currentLat: latest.lat, currentLng: latest.lng, lastSeen: new Date(), status: 'In Transit' };
    if (latest.battery !== undefined) update.battery = latest.battery;
    if (speed) update.speed = speed;
    await FieldAgent.update(update, { where: { id: agentId } });
    toField(app, 'agent_location_update', {
      agentId,
      lat: latest.lat,
      lng: latest.lng,
      speed: speed || '0 km/h',
      battery: latest.battery,
      lastSeen: nowIso(),
    });
  }
  return { success: true, accepted, total: pings.length };
}

export async function locationHistory(agentId, hoursText) {
  const hours = parseInt(hoursText) || DEFAULT_HISTORY_HOURS;
  const since = new Date(Date.now() - hours * HOUR_MS);
  const locations = await FieldAgentLocation.findAll({
    where: { agentId, recordedAt: { [Op.gte]: since } },
    order: [['recordedAt', 'ASC']],
  });
  return { success: true, data: locations };
}

// ---- Phone access (office code, old field app allowed, registered phones) --------------------------------------
export async function phoneAccessSettings(isAdmin) {
  const config = await fieldAppConfig();
  const agentRows = await FieldAgent.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });
  const agents = agentRows.map((agent) => ({
    id: agent.id,
    name: agent.name,
    phone: agent.phone,
    phoneSecure: !!agent.deviceTokenHash,
    deviceIssuedAt: agent.deviceIssuedAt,
    lastLegacyAt: agent.lastLegacyAt,
  }));
  return {
    success: true,
    data: { codeSet: !!config.code, code: isAdmin ? config.code : undefined, legacy: config.legacy, isAdmin, agents },
  };
}

/** values: { code, legacy } from fieldTracking.validation.js; an empty code clears it. */
export async function savePhoneAccess(values) {
  const settings = {};
  if (values.code !== undefined) settings[OFFICE_CODE_SETTING] = values.code;
  if (values.legacy !== undefined) settings[LEGACY_APP_SETTING] = values.legacy;
  // settingsStore keeps an empty secret, so clearing the code removes the loose AppSetting row directly
  if (settings[OFFICE_CODE_SETTING] === '') {
    await AppSetting.destroy({ where: { key: OFFICE_CODE_SETTING } });
    delete settings[OFFICE_CODE_SETTING];
  }
  if (Object.keys(settings).length) await settingsStore.setMany(settings);
  clearFieldAppConfig();
  return { success: true };
}

/** A lost / changed phone: its token stops working and it has to register again with the office code. */
export async function disconnectPhone(id) {
  const [updated] = await FieldAgent.update({ deviceTokenHash: null, deviceIssuedAt: null }, { where: { id } });
  if (!updated) throw agentNotFound();
  return { success: true };
}

// ---- Tasks, status, siren ---------------------------------------------------------------------------------------
const URGENT_PRIORITIES = ['Urgent', 'High'];

export async function assignTask({ agentId, task, location, priority, assignedBy }, app) {
  const isSelfAssigned = assignedBy && assignedBy.includes('Self-Assigned');
  // only an urgent / high or self-assigned task puts the agent In Transit at once
  const startsTransit = URGENT_PRIORITIES.includes(priority) || isSelfAssigned;
  await FieldAgent.update(
    {
      currentTask: task,
      taskStatus: 'Pending',
      ...(startsTransit && { status: 'In Transit' }),
      ...(location && { currentLocation: location }),
    },
    { where: { id: agentId } },
  );

  const agent = await FieldAgent.findByPk(agentId);
  toAgent(app, agentId, 'agent_task_updated', {
    agentId,
    task,
    priority: priority || 'Normal',
    location,
    assignedBy: assignedBy || 'Admin',
    isSelfAssigned,
    assignedAt: nowIso(),
  });
  if (isSelfAssigned) {
    toField(app, 'self_task_reported', {
      agentId,
      agentName: agent?.name || agentId,
      task,
      priority: priority || 'Normal',
      location,
      reportedAt: nowIso(),
    });
  }
  return { success: true, data: agent, message: `Task assigned to ${agent?.name}` };
}

export async function setAgentStatus(id, status, app) {
  await FieldAgent.update({ status, lastSeen: new Date() }, { where: { id } });
  toField(app, 'agent_status_updated', { agentId: id, status });
  return { success: true, message: 'Status updated' };
}

/** The field boy or the admin marks the task Done. */
export async function completeTask(id, app) {
  const agent = await FieldAgent.findByPk(id);
  if (!agent) throw agentNotFound();
  const completedTask = agent.currentTask;
  await FieldAgent.update({ taskStatus: 'Done', status: 'Idle', lastSeen: new Date() }, { where: { id } });
  toField(app, 'task_completed', { agentId: id, agentName: agent.name, completedTask, completedAt: nowIso() });
  toField(app, 'agent_status_updated', { agentId: id, status: 'Idle' });
  return { success: true, message: `Task completed by ${agent.name}` };
}

/** The emergency siren goes to the agent's phone over the socket (no push / SMS gateway yet). */
export async function triggerSiren({ agentId, message }, app) {
  const agent = await FieldAgent.findByPk(agentId);
  if (!agent) throw agentNotFound();
  toAgent(app, agentId, 'siren_triggered', {
    agentId,
    agentName: agent.name,
    message: message || 'URGENT: Call Operations immediately!',
    triggeredAt: nowIso(),
  });
  return {
    success: true,
    message: `Emergency siren sent to ${agent.name}`,
    note: 'Integrate with FCM/SMS gateway for mobile push in production',
  };
}

/** The dashboard KPI pills, counted with the same Offline rule as the agent list. */
export async function agentStats() {
  const agents = (await FieldAgent.findAll({ where: { isActive: true }, raw: true })).map((agent) => ({
    ...agent,
    status: isStale(agent) ? 'Offline' : agent.status,
  }));
  const countWith = (status) => agents.filter((agent) => agent.status === status).length;
  return {
    success: true,
    data: {
      total: agents.length,
      inTransit: countWith('In Transit'),
      idle: countWith('Idle'),
      offline: countWith('Offline'),
    },
  };
}

// ---- Day reports -------------------------------------------------------------------------------------------------
const toRadians = (degrees) => (degrees * Math.PI) / 180;

function haversineKm(lat1, lng1, lat2, lng2) {
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function travelledKm(locations) {
  let distanceKm = 0;
  for (let index = 1; index < locations.length; index++) {
    const previous = locations[index - 1];
    const current = locations[index];
    const stepKm = haversineKm(previous.lat, previous.lng, current.lat, current.lng);
    if (stepKm < MAX_PING_JUMP_KM) distanceKm += stepKm;
  }
  return parseFloat(distanceKm.toFixed(2));
}

function averageSpeed(locations) {
  const speeds = locations
    .map((location) => parseFloat(location.speed) || 0)
    .filter((speed) => speed > 0 && speed < MAX_REAL_SPEED);
  return speeds.length ? Math.round(speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length) : 0;
}

/** One UTC day, YYYY-MM-DD (today when not given). */
function dayRange(dateText) {
  const date = dateText || new Date().toISOString().split('T')[0];
  return { date, start: new Date(date + 'T00:00:00.000Z'), end: new Date(date + 'T23:59:59.999Z') };
}

const locationsOn = (agentId, { start, end }) =>
  FieldAgentLocation.findAll({
    where: { agentId, recordedAt: { [Op.between]: [start, end] } },
    order: [['recordedAt', 'ASC']],
  });

async function agentDaySummary(agent, range) {
  const locations = await locationsOn(agent.id, range);
  const firstPing = locations[0]?.recordedAt || null;
  const lastPing = locations[locations.length - 1]?.recordedAt || null;
  const activeHours = firstPing && lastPing ? ((new Date(lastPing) - new Date(firstPing)) / HOUR_MS).toFixed(1) : 0;
  return {
    agentId: agent.id,
    agentName: agent.name,
    role: agent.role,
    phone: agent.phone,
    totalPings: locations.length,
    distanceKm: travelledKm(locations),
    activeHours: parseFloat(activeHours),
    avgSpeed: averageSpeed(locations),
    firstPing,
    lastPing,
  };
}

/** GET /report/summary?date=YYYY-MM-DD - every agent's day. */
export async function dailySummary(dateText) {
  const range = dayRange(dateText);
  const agents = await FieldAgent.findAll({ order: [['name', 'ASC']] });
  return { success: true, data: await Promise.all(agents.map((agent) => agentDaySummary(agent, range))) };
}

/** GET /report/:agentId?date=YYYY-MM-DD - one agent's day with every ping. */
export async function agentDayReport(agentId, dateText) {
  const range = dayRange(dateText);
  const agent = await FieldAgent.findByPk(agentId);
  if (!agent) throw agentNotFound();
  const locations = await locationsOn(agentId, range);
  const first = locations[0];
  const last = locations[locations.length - 1];
  return {
    success: true,
    data: {
      agentId: agent.id,
      agentName: agent.name,
      role: agent.role,
      date: range.date,
      totalPings: locations.length,
      distanceKm: travelledKm(locations),
      activeHours:
        locations.length > 1 ? ((new Date(last.recordedAt) - new Date(first.recordedAt)) / HOUR_MS).toFixed(1) : 0,
      avgSpeed: averageSpeed(locations),
      firstPing: first?.recordedAt,
      lastPing: last?.recordedAt,
      locations: locations.map((location) => ({
        lat: location.lat,
        lng: location.lng,
        speed: location.speed,
        recordedAt: location.recordedAt,
      })),
    },
  };
}
