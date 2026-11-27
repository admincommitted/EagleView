// Air Export dashboard insights - GET /api/awb/insights
// Everything is read from data the system already keeps: AWB / MAWB / HAWB records, tracking rows (FSU milestones),
// rate lines, AWB stock, AWB logs and the SFTP poller state. Only live (not VOID) records are counted.
import { Op } from '../../config/database.js';
import { getSftpStatus } from './FsuService.js';
import { getSftpConfigStatus } from '../integrations/SftpService.js';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const RCS_TO_DEP_HOURS = 24; // received by airline but not departed after this -> stuck
const DEP_TO_ARR_HOURS = 48; // departed but no arrival / receipt at destination after this -> stuck
const LOW_STOCK = 10; // fewer available AWB numbers than this for an airline -> low stock
const RESERVE_HOURS = 4; // stock reservation that is not saved on an AWB is released after this (stock routes)
const LIST_LIMIT = 20;
const ACTIVITY_LIMIT = 15;
const TOP_LIMIT = 5;
const TREND_MONTHS = 6;
const MILESTONE_COLUMNS = ['fna', 'fma', 'foh', 'rcs', 'dep', 'arr', 'tfd', 'rcf', 'nfd', 'dlv'];

const bare = (number) =>
  String(number || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
const dashed = (number) => {
  const digits = bare(number);
  return /^\d{11}$/.test(digits) ? `${digits.slice(0, 3)}-${digits.slice(3)}` : String(number || '');
};
const num = (value) => {
  const parsed = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date) ? null : date;
};
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// flight date as the screens save it: 2026-10-30T10:30 / 2026-10-30; also 30-10-2026 / 30/10/2026
function flightDay(value) {
  const text = String(value || '').trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return null;
}
const round = (x, decimals = 1) => +(+x).toFixed(decimals);
const trackKey = (awb, hawb) => bare(awb) + '|' + bare(hawb);
const isSentToAirline = (awb, track) =>
  !!(track.submittedToAirline || awb.status === 'TRANSMITTED' || track.fma || track.rcs || track.dep);
const isRejected = (track) =>
  !!(track.fna && !(track.fma && String(track.fma) > String(track.fna)) && !track.rcs && !track.dep);
const isMaster = (awb) => (awb.type || 'MAWB') === 'MAWB';
const isDirectAwb = (awb) => (awb.type || 'MAWB') === 'AWB';

const brief = (awb, extra = {}) => ({
  id: awb.id,
  type: awb.type || 'MAWB',
  awbNumber: awb.awbNumber,
  shipperName: awb.shipperName || '',
  origin: awb.origin || '',
  destination: awb.destination || '',
  ...extra,
});

// 1. flights today / tomorrow (and missed in the last 7 days) whose FWB has not gone, or was rejected
function findDueFlights(awbs, awbTrack, now) {
  const today = ymd(now);
  const tomorrow = ymd(new Date(now.getTime() + DAY));
  const weekAgo = ymd(new Date(now.getTime() - 7 * DAY));
  const dueFlights = [];
  for (const awb of awbs) {
    const day = flightDay(awb.flightDate1);
    if (!day) continue;
    const track = awbTrack(awb);
    const rejected = isRejected(track);
    if (isSentToAirline(awb, track) && !rejected) continue;
    let due = null;
    if (day === today) due = 'TODAY';
    else if (day === tomorrow) due = 'TOMORROW';
    else if (day < today && day >= weekAgo) due = 'MISSED';
    if (!due) continue;
    dueFlights.push(
      brief(awb, {
        flight: awb.flightNumber1 || '',
        flightDate: awb.flightDate1,
        due,
        problem: rejected ? 'REJECTED (FNA)' : 'NOT SENT',
      }),
    );
  }
  const dueOrder = { MISSED: 0, TODAY: 1, TOMORROW: 2 };
  dueFlights.sort(
    (x, y) => dueOrder[x.due] - dueOrder[y.due] || String(x.flightDate).localeCompare(String(y.flightDate)),
  );
  return dueFlights;
}

// 2. stuck shipments (airline / own AWBs and MAWBs)
function findStuckShipments(awbs, awbTrack, now) {
  const stuck = [];
  for (const awb of awbs) {
    const track = awbTrack(awb);
    const received = toDate(track.rcs || track.foh);
    const departed = toDate(track.dep);
    if (track.dlv) continue;
    if (received && !departed && now - received > RCS_TO_DEP_HOURS * HOUR) {
      stuck.push(
        brief(awb, {
          problem: 'RCS, NOT DEPARTED',
          since: received.toISOString(),
          hours: Math.floor((now - received) / HOUR),
        }),
      );
    } else if (departed && !track.arr && !track.rcf && !track.nfd && now - departed > DEP_TO_ARR_HOURS * HOUR) {
      stuck.push(
        brief(awb, {
          problem: 'DEPARTED, NO ARRIVAL',
          since: departed.toISOString(),
          hours: Math.floor((now - departed) / HOUR),
        }),
      );
    }
  }
  stuck.sort((x, y) => y.hours - x.hours);
  return stuck;
}

// 3. MAWB sent but some of its houses' FHL not sent
function findFhlPending(awbs, awbTrack, housesOf, trackOf) {
  const fhlPending = [];
  for (const awb of awbs) {
    if (!isMaster(awb)) continue;
    if (!isSentToAirline(awb, awbTrack(awb))) continue;
    const houses = housesOf[bare(awb.awbNumber)] || [];
    const notSent = houses.filter((house) => {
      const track = trackOf[trackKey(awb.awbNumber, house.awbNumber)];
      return !(track && track.submittedToAirline) && house.status !== 'TRANSMITTED';
    });
    if (notSent.length) {
      fhlPending.push(
        brief(awb, {
          houses: houses.length,
          notSent: notSent.length,
          hawbs: notSent.slice(0, 10).map((house) => house.awbNumber),
        }),
      );
    }
  }
  return fhlPending;
}

// 5. AWB stock per airline
async function stockByAirline(AwbStock, liveAwbNos, now) {
  const stockRows = AwbStock
    ? await AwbStock.findAll({ attributes: ['airlinePrefix', 'fullAwbNumber', 'status', 'updatedAt'] })
    : [];
  const stockMap = {};
  for (const row of stockRows) {
    const prefix = row.airlinePrefix || String(row.fullAwbNumber || '').slice(0, 3);
    const entry = (stockMap[prefix] = stockMap[prefix] || {
      prefix,
      available: 0,
      reserved: 0,
      expiredReservations: 0,
      used: 0,
      availableButUsed: 0,
    });
    if (row.status === 'AVAILABLE') {
      if (liveAwbNos.has(bare(row.fullAwbNumber))) entry.availableButUsed += 1;
      else entry.available += 1;
    } else if (row.status === 'ALLOCATED') {
      entry.reserved += 1;
      if (now - new Date(row.updatedAt) > RESERVE_HOURS * HOUR) entry.expiredReservations += 1;
    } else if (row.status === 'USED') {
      entry.used += 1;
    }
  }
  return Object.values(stockMap)
    .map((entry) => ({ ...entry, low: entry.available < LOW_STOCK }))
    .sort((a, b) => a.available - b.available);
}

async function chargeableWeightByAwb(AwbRateLine, awbs) {
  const ids = awbs.map((awb) => awb.id);
  const lines = ids.length
    ? await AwbRateLine.findAll({
        where: { awbId: ids, awbType: ['AWB', 'MAWB'] },
        attributes: ['awbId', 'chargeableWeight', 'grossWeight'],
      })
    : [];
  const weightOf = {};
  lines.forEach((line) => {
    weightOf[line.awbId] = (weightOf[line.awbId] || 0) + (num(line.chargeableWeight) || num(line.grossWeight));
  });
  return weightOf;
}

const monthOf = (record) => monthKey(new Date(record.createdAt));

function buildTonnage(awbs, weightOf, now) {
  const thisMonth = monthKey(now);
  const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const sumMonth = (month) => {
    const rows = awbs.filter((awb) => monthOf(awb) === month);
    return {
      awbs: rows.length,
      grossWeight: round(rows.reduce((sum, awb) => sum + num(awb.grossWeight), 0)),
      chargeableWeight: round(rows.reduce((sum, awb) => sum + (weightOf[awb.id] || num(awb.grossWeight)), 0)),
      pieces: rows.reduce((sum, awb) => sum + (parseInt(awb.totalPieces, 10) || 0), 0),
    };
  };
  const tonnage = {
    thisMonth: { month: thisMonth, ...sumMonth(thisMonth) },
    lastMonth: { month: lastMonth, ...sumMonth(lastMonth) },
  };
  const byAirline = {};
  awbs
    .filter((awb) => monthOf(awb) === thisMonth)
    .forEach((awb) => {
      const prefix = bare(awb.awbNumber).slice(0, 3);
      const entry = (byAirline[prefix] = byAirline[prefix] || { prefix, awbs: 0, grossWeight: 0, chargeableWeight: 0 });
      entry.awbs += 1;
      entry.grossWeight += num(awb.grossWeight);
      entry.chargeableWeight += weightOf[awb.id] || num(awb.grossWeight);
    });
  tonnage.byAirline = Object.values(byAirline)
    .map((entry) => ({
      ...entry,
      grossWeight: round(entry.grossWeight),
      chargeableWeight: round(entry.chargeableWeight),
    }))
    .sort((a, b) => b.chargeableWeight - a.chargeableWeight);
  return tonnage;
}

function topBy(rows, keyFn, limit = TOP_LIMIT) {
  const totals = {};
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!key) return;
    const entry = (totals[key] = totals[key] || { name: key, shipments: 0, grossWeight: 0 });
    entry.shipments += 1;
    entry.grossWeight += num(row.grossWeight);
  });
  return Object.values(totals)
    .map((entry) => ({ ...entry, grossWeight: round(entry.grossWeight) }))
    .sort((a, b) => b.shipments - a.shipments || b.grossWeight - a.grossWeight)
    .slice(0, limit);
}

function buildFreightValue(awbs, now) {
  const months = [];
  for (let i = TREND_MONTHS - 1; i >= 0; i--) months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  const perCurrency = {};
  awbs.forEach((awb) => {
    const month = monthOf(awb);
    if (!months.includes(month)) return;
    const currency = String(awb.currencyCode || 'INR').toUpperCase();
    const entry = (perCurrency[currency] =
      perCurrency[currency] || Object.fromEntries(months.map((key) => [key, { pp: 0, cc: 0 }])));
    entry[month].pp += num(awb.totalChargePP);
    entry[month].cc += num(awb.totalChargeCC);
  });
  return {
    months,
    byCurrency: Object.entries(perCurrency).map(([currency, perMonth]) => ({
      currency,
      months: months.map((month) => ({
        month,
        prepaid: round(perMonth[month].pp, 2),
        collect: round(perMonth[month].cc, 2),
        total: round(perMonth[month].pp + perMonth[month].cc, 2),
      })),
    })),
  };
}

// 10. airline connection (SFTP poller state + last FSU / last FWB sent)
async function buildConnection({ AwbLog, tracks, scope, inScope }) {
  let poller = {};
  try {
    poller = getSftpStatus();
  } catch {
    poller = {};
  }
  let configured = null;
  try {
    configured = (await getSftpConfigStatus()).configured;
  } catch {
    configured = null;
  }
  let lastFsuAt = null;
  tracks.forEach((track) =>
    MILESTONE_COLUMNS.forEach((column) => {
      const date = toDate(track[column]);
      if (date && (!lastFsuAt || date > lastFsuAt)) lastFsuAt = date;
    }),
  );
  let lastSent = null;
  if (AwbLog) {
    const sentLogs = await AwbLog.findAll({
      where: { action: { [Op.in]: ['FWB_TRANSMITTED', 'FHL_TRANSMITTED'] } },
      order: [['createdAt', 'DESC']],
      limit: scope ? 200 : 1,
    });
    lastSent = sentLogs.find((log) => inScope(log.awbNumber)) || null;
  }
  return {
    configured,
    connected: !!poller.connected,
    lastConnectedAt: poller.lastConnectedAt || null,
    lastCheckedAt: poller.lastCheckedAt || null,
    lastError: poller.lastError || null,
    env: poller.env || null,
    lastFsuAt: lastFsuAt ? lastFsuAt.toISOString() : null,
    lastSentAt: lastSent ? lastSent.createdAt : null,
    lastSentAwb: lastSent ? lastSent.awbNumber : null,
  };
}

async function buildInsights(models, opts = {}) {
  const { Airwaybill, HouseAWB, AwbTracking, AwbRateLine, AwbLog, AwbStock } = models;
  const now = opts.now ? new Date(opts.now) : new Date();
  const live = { [Op.or]: [{ [Op.ne]: 'VOID' }, null] };
  // only the branch picked in the top bar (opts.scope from awbBranch). Not the year: a shipment still pending from
  // last year must still be shown.
  const scope = opts.scope && Reflect.ownKeys(opts.scope).length ? opts.scope : null;
  const scoped = (whereClause) => (scope ? { [Op.and]: [whereClause, scope] } : whereClause);

  const awbs = await Airwaybill.findAll({
    where: scoped({ status: live }),
    attributes: [
      'id',
      'awbNumber',
      'type',
      'status',
      'shipperName',
      'consigneeName',
      'origin',
      'destination',
      'flightNumber1',
      'flightDate1',
      'totalPieces',
      'grossWeight',
      'currencyCode',
      'totalChargePP',
      'totalChargeCC',
      'createdAt',
    ],
  });
  const houses = await HouseAWB.findAll({
    where: scoped({ status: live }),
    attributes: [
      'id',
      'awbNumber',
      'masterAwbNumber',
      'status',
      'shipperName',
      'consigneeName',
      'origin',
      'destination',
      'totalPieces',
      'grossWeight',
      'createdAt',
    ],
  });
  const tracks = await AwbTracking.findAll();
  const trackOf = {};
  tracks.forEach((track) => {
    trackOf[trackKey(track.awbNumber, track.hawbNumber)] = track;
  });
  const awbTrack = (awb) => trackOf[trackKey(awb.awbNumber, '')] || {};
  const liveAwbNos = new Set(awbs.map((awb) => bare(awb.awbNumber)));
  const housesOf = {};
  houses.forEach((house) => {
    const key = bare(house.masterAwbNumber);
    if (key) (housesOf[key] = housesOf[key] || []).push(house);
  });

  const dueFlights = findDueFlights(awbs, awbTrack, now);
  const stuck = findStuckShipments(awbs, awbTrack, now);
  const fhlPending = findFhlPending(awbs, awbTrack, housesOf, trackOf);

  // 4. houses with no (live) master, and masters with no houses
  const orphanHawbs = houses
    .filter((house) => !house.masterAwbNumber || !liveAwbNos.has(bare(house.masterAwbNumber)))
    .map((house) => ({
      id: house.id,
      type: 'HAWB',
      hawbNumber: house.awbNumber,
      masterAwbNumber: house.masterAwbNumber || '',
      shipperName: house.shipperName || '',
      destination: house.destination || '',
      problem: house.masterAwbNumber ? 'MAWB NOT SAVED / VOID' : 'NO MAWB',
    }));
  const emptyMawbs = awbs
    .filter((awb) => isMaster(awb) && !(housesOf[bare(awb.awbNumber)] || []).length)
    .map((awb) => brief(awb, { createdAt: awb.createdAt }));

  const stock = await stockByAirline(AwbStock, liveAwbNos, now);

  // 6-8. business numbers (airline AWBs = direct AWB + MAWB; customers = direct AWB shippers + house shippers)
  const weightOf = await chargeableWeightByAwb(AwbRateLine, awbs);
  const tonnage = buildTonnage(awbs, weightOf, now);
  const thisMonth = monthKey(now);
  const monthAwbs = awbs.filter((awb) => monthOf(awb) === thisMonth);
  const customerRows = [...monthAwbs.filter(isDirectAwb), ...houses.filter((house) => monthOf(house) === thisMonth)];
  const topDestinations = topBy(monthAwbs, (awb) =>
    String(awb.destination || '')
      .toUpperCase()
      .trim(),
  );
  const topCustomers = topBy(customerRows, (row) =>
    String(row.shipperName || '')
      .toUpperCase()
      .trim(),
  );
  const freightValue = buildFreightValue(awbs, now);

  // 9. recent activity
  const ownNos = new Set([
    ...awbs.map((awb) => bare(awb.awbNumber)),
    ...houses.map((house) => bare(house.awbNumber)),
    ...houses.map((house) => bare(house.masterAwbNumber)),
  ]);
  const inScope = (number) => !scope || ownNos.has(bare(number));
  let activity = [];
  if (AwbLog) {
    const logs = await AwbLog.findAll({
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
      limit: scope ? 400 : ACTIVITY_LIMIT,
    });
    activity = logs
      .filter((log) => inScope(log.awbNumber))
      .slice(0, ACTIVITY_LIMIT)
      .map((log) => ({
        awbNumber: log.awbNumber,
        action: log.action,
        user: log.user || '',
        details: log.details || '',
        at: log.createdAt,
      }));
  }

  const connection = await buildConnection({ AwbLog, tracks, scope, inScope });

  return {
    generatedAt: now.toISOString(),
    rules: { rcsToDepHours: RCS_TO_DEP_HOURS, depToArrHours: DEP_TO_ARR_HOURS, lowStock: LOW_STOCK },
    dueFlights,
    stuck,
    fhlPending,
    orphanHawbs: orphanHawbs.slice(0, LIST_LIMIT),
    orphanCount: orphanHawbs.length,
    emptyMawbs: emptyMawbs.slice(0, LIST_LIMIT),
    emptyMawbCount: emptyMawbs.length,
    stock,
    tonnage,
    topDestinations,
    topCustomers,
    freightValue,
    activity,
    connection,
  };
}

export { buildInsights, dashed };
