// One place that records a status event (from an FSU file or entered by hand):
// 1. the event is kept in AwbTrackingEvents (full history, no duplicates of the same code + time);
// 2. the milestone column of the AwbTracking row is filled (first time; FNA / FMA keep the latest, so a new rejection
//    after an acceptance shows again) and the row status moves forward;
// 3. customer updates are sent if they are switched on (awbNotify.js).
import { AwbTracking, AwbTrackingEvent } from '../../models/index.js';
import { notifyEvent } from './awbNotify.js';

const CODES = ['FNA', 'FMA', 'FOH', 'RCS', 'DEP', 'ARR', 'TFD', 'RCF', 'NFD', 'DLV'];
const CODE_NAME = {
  FNA: 'Rejected by airline (FNA)',
  FMA: 'Accepted by airline (FMA)',
  FOH: 'Freight on hand',
  RCS: 'Received by airline (RCS)',
  DEP: 'Departed',
  ARR: 'Arrived',
  TFD: 'Transferred',
  RCF: 'Received at destination',
  NFD: 'Consignee notified',
  DLV: 'Delivered',
};
const STATUS_ORDER = ['PENDING', 'TRANSMITTED', 'BOOKED', 'RECEIVED', 'DEPARTED', 'ARRIVED', 'DELIVERED', 'FINISHED'];
const CODE_TO_STATUS = {
  RCS: 'RECEIVED',
  FOH: 'RECEIVED',
  DEP: 'DEPARTED',
  ARR: 'ARRIVED',
  RCF: 'ARRIVED',
  NFD: 'ARRIVED',
  DLV: 'FINISHED',
};
const LATEST_WINS = ['FNA', 'FMA'];

const bare = (number) =>
  String(number || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
const normAwb = (number) => {
  const digits = bare(number);
  return /^\d{11}$/.test(digits) ? `${digits.slice(0, 3)}-${digits.slice(3)}` : String(number || '').trim();
};

// airline time text -> ISO; text that is not a date is kept as it came (the FSU text format can send 30JAN)
function toIso(value) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return isNaN(date) ? String(value).trim() : date.toISOString();
}

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const intOrNull = (value) => (Number.isFinite(parseInt(value, 10)) ? parseInt(value, 10) : null);
const floatOrNull = (value) => (Number.isFinite(parseFloat(value)) ? parseFloat(value) : null);

function eventRow(input, keys) {
  return {
    ...keys,
    station: input.station ? String(input.station).trim().toUpperCase().slice(0, 5) : null,
    flight: input.flight ? String(input.flight).replace(/\s+/g, '').toUpperCase().slice(0, 12) : null,
    pieces: intOrNull(input.pieces),
    weight: floatOrNull(input.weight),
    source: input.source === 'MANUAL' ? 'MANUAL' : 'FSU',
    note: input.note ? String(input.note).slice(0, 300) : null,
    user: input.user ? String(input.user).slice(0, 60) : null,
  };
}

// tracking row: the master's own row (hawbNumber null) or the house's row
async function findOrCreateTrackingRow(awbNumber, hawbNumber) {
  const variants = [...new Set([awbNumber, bare(awbNumber)])];
  const row = await AwbTracking.findOne({ where: { awbNumber: variants, hawbNumber } });
  if (row) return row;
  return AwbTracking.create({
    awbNumber,
    hawbNumber,
    documentType: hawbNumber ? 'HOUSE' : 'MASTER',
    saved: true,
    submittedToAirline: true,
    status: 'PENDING',
  });
}

async function applyMilestone(row, code, eventAt) {
  const column = code.toLowerCase();
  const changes = { submittedToAirline: true };
  if (!row[column] || (LATEST_WINS.includes(code) && String(eventAt) > String(row[column]))) changes[column] = eventAt;
  const nextStatus = CODE_TO_STATUS[code];
  if (nextStatus && STATUS_ORDER.indexOf(nextStatus) > STATUS_ORDER.indexOf(row.status || 'PENDING'))
    changes.status = nextStatus;
  await row.update(changes);
}

async function notifyCustomer(event) {
  try {
    const sent = await notifyEvent(event);
    if (sent) await event.update({ notified: sent });
  } catch (err) {
    await event.update({ notified: 'ERROR: ' + String(err.message || err).slice(0, 200) }).catch(() => {});
  }
}

async function recordEvent(input, opts = {}) {
  const code = String(input.code || '').toUpperCase();
  if (!CODES.includes(code)) throw badRequest(`Unknown milestone ${input.code}. Use one of ${CODES.join(', ')}`);
  const awbNumber = normAwb(input.awbNumber);
  if (!awbNumber) throw badRequest('AWB number is required');
  const hawbNumber = input.hawbNumber ? String(input.hawbNumber).trim() : null;
  const eventAt = toIso(input.eventAt);

  const duplicate = await AwbTrackingEvent.findOne({ where: { awbNumber, hawbNumber, code, eventAt } });
  if (duplicate) return { event: duplicate, duplicate: true };

  const event = await AwbTrackingEvent.create(eventRow(input, { awbNumber, hawbNumber, code, eventAt }));
  const row = await findOrCreateTrackingRow(awbNumber, hawbNumber);
  await applyMilestone(row, code, eventAt);

  if (!opts.skipNotify) await notifyCustomer(event);
  return { event, duplicate: false };
}

// after a hand-entered event is deleted: the milestone column goes back to the latest remaining event of that code
async function refreshMilestone(awbNumber, hawbNumber, code) {
  const column = String(code).toLowerCase();
  const remaining = await AwbTrackingEvent.findAll({
    where: { awbNumber: normAwb(awbNumber), hawbNumber: hawbNumber || null, code },
    order: [['eventAt', 'ASC']],
  });
  const row = await AwbTracking.findOne({
    where: { awbNumber: [normAwb(awbNumber), bare(awbNumber)], hawbNumber: hawbNumber || null },
  });
  if (!row) return;
  let value = null;
  if (remaining.length)
    value = LATEST_WINS.includes(code) ? remaining[remaining.length - 1].eventAt : remaining[0].eventAt;
  await row.update({ [column]: value });
}

export { recordEvent, refreshMilestone, CODES, CODE_NAME, normAwb, toIso };
