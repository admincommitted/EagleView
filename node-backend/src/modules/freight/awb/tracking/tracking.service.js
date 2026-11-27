import { Op } from 'sequelize';
import { ConflictError, NotFoundError } from '../../../../core/http/index.js';
import { Airline, Airwaybill, AwbLog, AwbTracking, AwbTrackingEvent, HouseAWB } from '../../../../models/index.js';
import { getSettings, saveSettings } from '../../../../utils/awb/awbNotify.js';
import { CODE_NAME, normAwb, recordEvent, refreshMilestone } from '../../../../utils/awb/awbTrackingEvents.js';
import { loadAwbRows } from '../shared/awbRows.js';
import { bareAwbNo, liveStatus } from '../shared/awbNumbers.js';

const DOCUMENT_TYPE_OF = { AWB: 'AIR WAYBILL', MAWB: 'MASTER', HAWB: 'HOUSE' };
const EDITABLE_MILESTONES = [
  'fna',
  'fma',
  'foh',
  'rcs',
  'dep',
  'arr',
  'tfd',
  'rcf',
  'nfd',
  'dlv',
  'status',
  'submittedToAirline',
];
const MAX_EVENT_LOGS = 200;
const MAX_LOG_DETAIL = 250;
const MAX_NOTE_IN_LOG = 100;

const notFound = (message) => new NotFoundError(message, { body: { error: message } });
const conflict = (message) => new ConflictError(message, { body: { error: message } });
const filled = (value) => value && String(value).trim();

/** "2026-10-30T10:00" / Date text -> "2026-10-30" ('' when not a date). */
function dayOf(value) {
  const text = String(value || '');
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const date = new Date(text);
  return isNaN(date) ? '' : date.toISOString().slice(0, 10);
}

function airlinePrefixesMatching(airlines, airlineQuery) {
  const wanted = String(airlineQuery).trim().toLowerCase();
  const prefixes = airlines
    .filter(
      (airline) =>
        (airline.prefix && airline.prefix === wanted) ||
        (airline.code2 && airline.code2.toLowerCase() === wanted) ||
        (airline.name && airline.name.toLowerCase().includes(wanted)),
    )
    .map((airline) => String(airline.prefix || ''));
  if (/^\d{3}$/.test(wanted)) prefixes.push(wanted);
  return [...new Set(prefixes.filter(Boolean))];
}

function filterByStatus(rows, statusQuery) {
  const status = statusQuery && statusQuery !== 'ALL' ? String(statusQuery).toUpperCase() : '';
  if (status === 'FINISHED') return rows.filter((row) => row.stage === 'DELIVERED');
  if (status === 'PENDING') return rows.filter((row) => row.stage !== 'DELIVERED');
  if (status) return rows.filter((row) => row.stage === status);
  return rows;
}

function filterByDates(rows, query) {
  if (!query.fromDate && !query.toDate) return rows;
  const dayToCompare = (row) => {
    if (query.dateType === 'ARRIVAL') return dayOf(row.arrivalDate);
    if (query.dateType === 'DEPARTURE') return dayOf(row.departureDate);
    return dayOf(row.departureDate) || dayOf(row.createdAt);
  };
  return rows.filter((row) => {
    const day = dayToCompare(row);
    if (!day) return false;
    if (query.fromDate && day < query.fromDate) return false;
    if (query.toDate && day > query.toDate) return false;
    return true;
  });
}

function applyTrackingFilters(rows, query, airlines) {
  let out = rows;
  if (query.documentType && query.documentType !== 'ALL') {
    out = out.filter((row) => row.documentType === String(query.documentType).toUpperCase());
  }
  if (filled(query.awbNumber)) {
    const wanted = bareAwbNo(query.awbNumber);
    out = out.filter((row) => bareAwbNo(row.awbNumber).includes(wanted) || bareAwbNo(row.hawbNumber).includes(wanted));
  }
  if (filled(query.airline)) {
    const prefixes = airlinePrefixesMatching(airlines, query.airline);
    out = out.filter((row) => prefixes.includes(bareAwbNo(row.awbNumber).slice(0, 3)));
  }
  out = filterByStatus(out, query.status);
  if (filled(query.shipper)) {
    const party = String(query.shipper).trim().toUpperCase();
    out = out.filter(
      (row) =>
        String(row.shipperName || '')
          .toUpperCase()
          .includes(party) ||
        String(row.consigneeName || '')
          .toUpperCase()
          .includes(party),
    );
  }
  if (filled(query.origin)) {
    const origin = String(query.origin).trim().toUpperCase();
    out = out.filter((row) => String(row.origin).toUpperCase().startsWith(origin));
  }
  if (filled(query.destination)) {
    const destination = String(query.destination).trim().toUpperCase();
    out = out.filter((row) => String(row.destination).toUpperCase().startsWith(destination));
  }
  return filterByDates(out, query);
}

/** Track Shipments screen: the live AWB / MAWB / HAWB records of the branch and year, with their tracking. */
export async function listTrackedShipments(query, { branchWhere, yearWhere }) {
  const airlines = await Airline.findAll({ attributes: ['id', 'name', 'code2', 'prefix', 'trackingUrl'] });
  const { rows } = await loadAwbRows({ [Op.and]: [{ status: liveStatus() }, branchWhere, yearWhere] });
  const withDates = rows.map((row) => ({
    ...row,
    documentType: DOCUMENT_TYPE_OF[row.type] || 'MASTER',
    departureDate: row.dep || row.flightDate || '',
    arrivalDate: row.arr || row.rcf || '',
  }));
  const data = applyTrackingFilters(withDates, query, airlines);
  return { success: true, data, total: data.length, airlines };
}

function airlineTrackingUrl(airline, digits, dashed) {
  if (!airline || !airline.trackingUrl) return null;
  return String(airline.trackingUrl)
    .replace(/\{awb\}/gi, digits)
    .replace(/\{prefix\}/gi, digits.slice(0, 3))
    .replace(/\{serial\}/gi, digits.slice(3))
    .replace(/\{awbdash\}/gi, dashed);
}

/** All events of the AWB (for a house, the master's events too: the house flies with its master). */
export async function trackingEventsOf(query) {
  const awbNumber = normAwb(query.awbNumber);
  const hawbNumber = query.hawbNumber ? String(query.hawbNumber).trim() : null;
  const digits = awbNumber.replace(/\D/g, '');
  const events = await AwbTrackingEvent.findAll({
    where: { awbNumber: [awbNumber, digits], [Op.or]: [{ hawbNumber: null }, ...(hawbNumber ? [{ hawbNumber }] : [])] },
    order: [
      ['eventAt', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  const tracking = await AwbTracking.findOne({ where: { awbNumber: [awbNumber, digits], hawbNumber } });
  const airline = await Airline.findOne({ where: { prefix: digits.slice(0, 3) } });
  const logs = await AwbLog.findAll({
    where: { awbNumber: hawbNumber ? [awbNumber, hawbNumber] : [awbNumber] },
    order: [['createdAt', 'ASC']],
    limit: MAX_EVENT_LOGS,
  });
  return {
    success: true,
    awbNumber,
    hawbNumber,
    events: events.map((event) => ({
      ...event.toJSON(),
      name: CODE_NAME[event.code] || event.code,
      scope: event.hawbNumber ? 'HAWB' : 'MAWB',
    })),
    tracking,
    airline: airline ? { name: airline.name, code2: airline.code2, prefix: airline.prefix } : null,
    airlineTrackingUrl: airlineTrackingUrl(airline, digits, awbNumber),
    logs: logs.map((log) => ({ action: log.action, user: log.user, details: log.details, at: log.createdAt })),
  };
}

async function findLiveRecordForEvent(body, dashed, bare) {
  if (body.hawbNumber) {
    return HouseAWB.findOne({
      where: { awbNumber: String(body.hawbNumber).trim(), masterAwbNumber: [dashed, bare], status: liveStatus() },
    });
  }
  return Airwaybill.findOne({ where: { awbNumber: [dashed, bare], status: liveStatus() } });
}

function milestoneLogDetail(code, happenedAt, body) {
  const station = body.station ? ' ' + String(body.station).toUpperCase() : '';
  const note = body.note ? ' - ' + String(body.note).slice(0, MAX_NOTE_IN_LOG) : '';
  return `${code} ${happenedAt.toISOString()}${station}${note}`;
}

/** A milestone entered by hand (e.g. the airline told it on the phone); the AWB / HAWB must exist and be live. */
export async function addManualEvent(body, user) {
  const code = String(body.code || '').toUpperCase();
  const happenedAt = new Date(body.eventAt);
  const bare = String(body.awbNumber || '').replace(/[^A-Za-z0-9]/g, '');
  const dashed = /^\d{11}$/.test(bare) ? `${bare.slice(0, 3)}-${bare.slice(3)}` : body.awbNumber;

  const record = await findLiveRecordForEvent(body, dashed, bare);
  if (!record)
    throw notFound(body.hawbNumber ? `HAWB ${body.hawbNumber} of ${dashed} not found` : `AWB ${dashed} not found`);

  const result = await recordEvent({ ...body, code, eventAt: happenedAt.toISOString(), source: 'MANUAL', user });
  if (result.duplicate) throw conflict(`${code} at this time is already there`);
  await AwbLog.create({
    awbNumber: body.hawbNumber || dashed,
    action: 'MILESTONE_ADDED',
    user,
    details: milestoneLogDetail(code, happenedAt, body),
  }).catch(() => {});
  return { success: true, event: result.event };
}

/** Only a hand-entered event can be removed (an airline FSU stays). */
export async function removeManualEvent(eventId, user) {
  const event = await AwbTrackingEvent.findByPk(eventId);
  if (!event) throw notFound('Event not found');
  if (event.source !== 'MANUAL') throw conflict('Only a milestone entered by hand can be removed');
  const tracking = await AwbTracking.findOne({
    where: { awbNumber: [event.awbNumber, event.awbNumber.replace(/\D/g, '')], hawbNumber: event.hawbNumber },
  });
  const milestoneColumn = event.code.toLowerCase();
  const wasShown = tracking && tracking[milestoneColumn] === event.eventAt;
  await event.destroy();
  if (wasShown) await refreshMilestone(event.awbNumber, event.hawbNumber, event.code);
  await AwbLog.create({
    awbNumber: event.hawbNumber || event.awbNumber,
    action: 'MILESTONE_REMOVED',
    user,
    details: `${event.code} ${event.eventAt}`,
  }).catch(() => {});
  return { success: true };
}

/** Customer shipment updates: off by default; changing them needs an admin. */
export async function readNotifySettings(isAdmin) {
  return { success: true, settings: await getSettings(), canEdit: isAdmin };
}

export async function updateNotifySettings(input, user) {
  const settings = await saveSettings(input);
  await AwbLog.create({
    awbNumber: '-',
    action: 'NOTIFY_SETTINGS',
    user,
    details: JSON.stringify(settings).slice(0, MAX_LOG_DETAIL),
  }).catch(() => {});
  return { success: true, settings };
}

/** A tracking row made by hand (dummy / testing generation). */
export const createTrackingRow = (body) => AwbTracking.create(body);

/** A tracking milestone changed by hand. */
export async function updateTrackingMilestones(trackingId, body) {
  const record = await AwbTracking.findByPk(trackingId);
  if (!record) throw notFound('Tracking record not found');
  const updates = {};
  for (const key of EDITABLE_MILESTONES) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  await record.update(updates);
  return { success: true, data: record };
}
