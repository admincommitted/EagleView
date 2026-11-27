import { Op } from 'sequelize';
import { BadRequestError, NotFoundError } from '../../../core/http/index.js';
import { ExportJob, FreightEvent, ImportJob } from '../../../models/index.js';
import { unpackExtra } from '../../../utils/db/extraFields.js';
import { dashboardKindOf, FREIGHT_EVENTS, upperText } from './freightOps.validation.js';

/**
 * The freight dashboards (Air Import, Sea Import, Sea Export): the rows are the real import / export jobs and the
 * buttons record operational events. Filing an IGM to SCMTR / ICEGATE, a VGM to the line's portal or AMS to US
 * customs needs outside credentials and channels: those are recorded as events with isInternal = false, and the
 * screen says plainly that recording is not transmitting.
 */
const EXTERNAL_NOTE = {
  IGM: 'Recorded in this system only. An IGM is filed to SCMTR / ICEGATE through the carrier or your own ICEGATE channel - this software has not been given those credentials, so it did not transmit anything.',
  VGM: 'Recorded in this system only. A VGM goes to the shipping line’s own portal or by EDI - this software has no line portal credentials, so it did not transmit anything.',
  MANIFEST:
    'Recorded in this system only. A manifest / AMS filing goes to the destination customs system (for the USA, AMS through an approved filer) - this software has no such channel, so it did not transmit anything.',
  AMS: 'Recorded in this system only. AMS is filed to US customs through an approved filer - this software has no such channel, so it did not transmit anything.',
};
const EVENTS_NEEDING_REFERENCE = ['DO', 'MBL', 'HBL', 'IGM', 'VGM'];
const MAX_DASHBOARD_JOBS = 2000;
const MAX_EVENT_ROWS = 500;
const MAX_REFERENCE_LENGTH = 60;

const failure = (ErrorClass) => (message) => new ErrorClass(message, { body: { success: false, error: message } });
const badRequest = failure(BadRequestError);
const notFound = failure(NotFoundError);

const modeOf = (job) => upperText(job.shipmentMode || job.transportMode || job.modeOfTransport);
const isAir = (job) => /AIR/.test(modeOf(job));
const isSea = (job) => /SEA|OCEAN|VESSEL/.test(modeOf(job));
const firstFilled = (job, keys) => {
  for (const key of keys) {
    const value = job[key] != null ? job[key] : (job.dataValues || {})[key];
    if (value) return String(value);
  }
  return '';
};

const eventTypesList = () =>
  Object.entries(FREIGHT_EVENTS).map(([type, event]) => ({ type, label: event.label, internal: event.internal }));

function jsonRows(value) {
  let rows = value;
  if (typeof rows === 'string') {
    try {
      rows = JSON.parse(rows);
    } catch {
      rows = [];
    }
  }
  return Array.isArray(rows) ? rows : [];
}

/**
 * The master document is kept in one field for both modes - mawbNo / mawbblNo holds the MAWB for air and the MBL for
 * sea, hawbNo / hawbhblNo the house document - the convention the BE builder and the IGM rows use.
 */
function dashboardRowOf(job, kind) {
  const igmRow = jsonRows(job._igmRows)[0] || {};
  const fromJobOrIgm = (keys) => firstFilled(job, keys) || firstFilled(igmRow, keys);
  return {
    id: job.id,
    jobNo: job.jobNo || '',
    jobKind: kind.endsWith('import') ? 'IMPORT' : 'EXPORT',
    docNo: fromJobOrIgm(['mawbNo', 'mawbblNo', 'masterBlNo', 'mblNo', 'blNo', 'oblNo']),
    houseNo: fromJobOrIgm(['hawbNo', 'hawbhblNo', 'hblNo']),
    igmNo: fromJobOrIgm(['igmNumber', 'igmNo']),
    party: firstFilled(job, [
      'autoField_4',
      'nameOfImporter',
      'importerName',
      'exporterName',
      'shipperName',
      'partyName',
    ]),
    origin: firstFilled(job, ['portOfOrigin', 'portOfShipment', 'loadingPortCode', 'loadingPortName', 'portOfLoading']),
    destination: firstFilled(job, [
      'portCode',
      'portName',
      'destPortCode',
      'destPortName',
      'discPortCode',
      'PortOfDischarge',
    ]),
    carrier: fromJobOrIgm(['vessel', 'flightVoyage', 'vesselName', 'carrierName', 'shippingLine']),
    eta: fromJobOrIgm(['eta', 'etaDate', 'arrivalDate', 'inwardDate']),
    etd: firstFilled(job, ['etd', 'etdDate', 'sailingDate']),
    mode: firstFilled(job, ['shipmentMode', 'transportMode', 'modeOfTransport']),
    grossWt: firstFilled(job, ['grossWt', 'grossWeight']),
    grossWtUnit: firstFilled(job, ['grossWtUnit']),
    status: upperText(job.status) || 'DRAFT',
    icegateStatus: upperText(job.icegateStatus) || '',
    beNo: firstFilled(job, ['beNo']),
    sbNo: firstFilled(job, ['sbNo']),
    jobDate: firstFilled(job, ['jobDate', 'date']),
  };
}

/** Most job fields (autoField_*, the IGM / container grids) live as JSON in extendedData. */
async function loadJobs(wantImport) {
  const Model = wantImport ? ImportJob : ExportJob;
  const jobs = await Model.findAll({ order: [['id', 'DESC']], limit: MAX_DASHBOARD_JOBS });
  return jobs.map((job) => unpackExtra(job, 'extendedData'));
}

async function attachEvents(rows) {
  const jobNumbers = rows.map((row) => row.jobNo).filter(Boolean);
  const events = jobNumbers.length
    ? await FreightEvent.findAll({
        where: { jobNo: { [Op.in]: jobNumbers } },
        order: [
          ['eventDate', 'DESC'],
          ['id', 'DESC'],
        ],
      })
    : [];
  const eventsByJob = new Map();
  events.forEach((event) => {
    if (!eventsByJob.has(event.jobNo)) eventsByJob.set(event.jobNo, []);
    eventsByJob.get(event.jobNo).push(event);
  });
  rows.forEach((row) => {
    const jobEvents = eventsByJob.get(row.jobNo) || [];
    row.events = jobEvents.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      eventDate: event.eventDate,
      refNo: event.refNo,
      detail: event.detail,
      isInternal: event.isInternal,
    }));
    row.has = {};
    Object.keys(FREIGHT_EVENTS).forEach((type) => {
      row.has[type] = jobEvents.some((event) => event.eventType === type);
    });
  });
}

function kpisOf(rows, wantImport, wantAir) {
  const countWhere = (test) => rows.filter(test).length;
  if (wantImport) {
    return {
      total: rows.length,
      arrivingNoBe: countWhere((row) => !row.beNo && !['OOC', 'DELIVERED'].includes(row.status)),
      pendingDo: countWhere((row) => !row.has.DO),
      customsHold: countWhere((row) => /QUERY/.test(row.status) || /QUERY/.test(row.icegateStatus)),
      consoleBreak: countWhere((row) => row.has.CONSOLE && !row.has.DESTUFF),
      igmNotRecorded: wantAir ? null : countWhere((row) => !row.has.IGM),
    };
  }
  return {
    total: rows.length,
    booked: countWhere((row) => row.has.BOOKING),
    pendingVgm: wantAir ? null : countWhere((row) => !row.has.VGM),
    blIssued: countWhere((row) => row.has.MBL || row.has.HBL),
    sailed: countWhere((row) => /SAILED|SHIPPED|GATED|LEO/.test(row.status)),
  };
}

function dashboardNote(rowCount, unknownModeCount, wantImport, wantAir) {
  const side = wantImport ? 'import' : 'export';
  if (!rowCount) {
    return (
      'No ' +
      (wantAir ? 'air' : 'sea') +
      ' ' +
      side +
      ' job yet. Create one in ' +
      (wantImport ? 'Import' : 'Export') +
      ' Entry and set its shipment mode.'
    );
  }
  return (
    'Rows are the real ' +
    side +
    ' jobs. ' +
    (unknownModeCount
      ? unknownModeCount +
        ' job(s) have no shipment mode recorded, so they are listed here and flagged rather than hidden. '
      : '') +
    'IGM, VGM and manifest / AMS are recorded here only - this software does not transmit them to the portal.'
  );
}

/** GET /dashboard?kind=sea-import. A job with no mode recorded is shown in both, flagged, rather than hidden from both. */
export async function buildDashboard(query) {
  const kind = dashboardKindOf(query);
  const wantImport = kind.endsWith('import');
  const wantAir = kind.startsWith('air');
  const jobs = await loadJobs(wantImport);
  const matching = jobs.filter((job) => (wantAir ? isAir(job) : isSea(job)));
  const unknownMode = jobs.filter((job) => !isAir(job) && !isSea(job));
  const rows = [...matching, ...unknownMode].map((job) => {
    const row = dashboardRowOf(job, kind);
    row.modeUnknown = !isAir(job) && !isSea(job);
    return row;
  });
  await attachEvents(rows);
  return {
    success: true,
    kind,
    data: rows,
    kpis: kpisOf(rows, wantImport, wantAir),
    eventTypes: eventTypesList(),
    externalNotes: EXTERNAL_NOTE,
    counts: { matchedByMode: matching.length, modeNotRecorded: unknownMode.length, totalJobs: jobs.length },
    note: dashboardNote(rows.length, unknownMode.length, wantImport, wantAir),
  };
}

async function assertEventCanBeRecorded(type, jobNo, body) {
  // these produce a document number that has to be recorded, or the row is useless later
  if (EVENTS_NEEDING_REFERENCE.includes(type) && !String(body.refNo || '').trim()) {
    throw badRequest('A ' + FREIGHT_EVENTS[type].label + ' needs its reference / document number');
  }
  const duplicate = await FreightEvent.findOne({ where: { jobNo, eventType: type } });
  if (duplicate && !body.allowRepeat) {
    throw badRequest(
      FREIGHT_EVENTS[type].label +
        ' is already recorded on ' +
        jobNo +
        ' (' +
        (duplicate.refNo || duplicate.eventDate) +
        '). Send allowRepeat to record another one.',
    );
  }
}

/** POST /events - records an operational event on an import / export job (nothing is transmitted). */
export async function recordEvent(body, user) {
  const type = upperText(body.eventType);
  const jobNo = String(body.jobNo || '').trim();
  const jobKind = upperText(body.jobKind) === 'EXPORT' ? 'EXPORT' : 'IMPORT';
  const job =
    jobKind === 'EXPORT'
      ? await ExportJob.findOne({ where: { jobNo } })
      : await ImportJob.findOne({ where: { jobNo } });
  if (!job) throw notFound('No ' + jobKind.toLowerCase() + ' job ' + jobNo);

  const eventDate = String(body.eventDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw badRequest('Give a valid date');
  await assertEventCanBeRecorded(type, jobNo, body);

  const event = FREIGHT_EVENTS[type];
  const row = await FreightEvent.create({
    jobNo,
    jobKind,
    jobId: job.id,
    eventType: type,
    eventDate,
    refNo: body.refNo ? String(body.refNo).trim().slice(0, MAX_REFERENCE_LENGTH) : null,
    detail: body.detail ? String(body.detail) : null,
    isInternal: event.internal,
    createdBy: (user && user.id) || null,
    createdByName: (user && (user.fullName || user.username)) || null,
  });
  return {
    success: true,
    data: row,
    note: event.internal
      ? event.label + ' recorded on ' + jobNo + '.'
      : EXTERNAL_NOTE[type] || event.label + ' recorded on ' + jobNo + ' - this system did not transmit it.',
    transmitted: false,
  };
}

export async function listEvents(query) {
  const where = {};
  if (query.jobNo) where.jobNo = String(query.jobNo);
  if (query.eventType) where.eventType = upperText(query.eventType);
  const rows = await FreightEvent.findAll({
    where,
    order: [
      ['eventDate', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: MAX_EVENT_ROWS,
  });
  return { success: true, data: rows, eventTypes: eventTypesList() };
}

export async function deleteEvent(eventId) {
  const row = await FreightEvent.findByPk(eventId);
  if (!row) throw notFound('Event not found');
  await row.destroy();
  return { success: true };
}
