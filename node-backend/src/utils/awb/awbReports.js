// Air Export reports: Tonnage report and CSR statement (Cargo Sales Report, IATA CASS style).
// Only live (not VOID) records. Airline documents = direct AWB + MAWB; houses are used only for "by customer".
import { Op } from '../../config/database.js';

const num = (value) => {
  const parsed = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const round2 = (x) => Math.round(x * 100) / 100;
const round1 = (x) => Math.round(x * 10) / 10;
const bare = (number) =>
  String(number || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
const pad = (x) => String(x).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NUMBER = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};
const TONNAGE_GROUPS = ['airline', 'agent', 'destination', 'origin', 'customer', 'month', 'day'];
const AIRLINE_DOC_TYPES = ['AWB', 'MAWB'];
const KG_PER_TONNE = 1000;

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const liveStatus = () => ({ [Op.or]: [{ [Op.ne]: 'VOID' }, null] });
const docType = (record) => record.type || 'MAWB';

// a date as the screens save it -> 'YYYY-MM-DD' (2026-10-30T10:00 / 2026-10-30 / 30-10-2026 / 30/10/2026 / 30OCT26 / 30-Oct-2026)
function dayOf(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value) ? null : ymd(value);
  const text = String(value).trim().toUpperCase();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = text.match(/^(\d{2})[-/.](\d{2})[-/.](\d{4})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  match = text.match(/^(\d{1,2})[-\s]?([A-Z]{3})[-\s]?(\d{2,4})$/);
  if (match && MONTH_NUMBER[match[2]]) {
    const year = match[3].length === 2 ? '20' + match[3] : match[3];
    return `${year}-${pad(MONTH_NUMBER[match[2]])}-${pad(match[1])}`;
  }
  const date = new Date(value);
  return isNaN(date) ? null : ymd(date);
}

// IATA agent (forwarder) on the AWB: code without spaces / dashes / slashes, else the name
const agentKey = (awb) =>
  bare(awb.agentCode) ||
  String(awb.agentName || '')
    .trim()
    .toUpperCase() ||
  '-';
const agentLabel = (awb) => {
  const name = String(awb.agentName || '').trim();
  const code = String(awb.agentCode || '').trim();
  return name || code ? `${name || '(no name)'}${code ? ` (${code})` : ''}` : '(no agent on AWB)';
};
// agent filter: IATA code (any format) or part of the name
const agentMatch = (awb, wanted) => {
  if (!wanted) return true;
  const text = String(wanted).trim();
  const code = bare(text);
  return (
    (code.length >= 4 && bare(awb.agentCode).includes(code)) ||
    String(awb.agentName || '')
      .toUpperCase()
      .includes(text.toUpperCase())
  );
};
// AWB date: execution date on the AWB, else the first flight date, else the day it was saved
const awbDay = (awb) => dayOf(awb.executedDate) || dayOf(awb.flightDate1) || dayOf(awb.createdAt);

// CASS billing periods: 1-15 and 16-end of month. "2026-10-1" / "2026-10-2"
function periodRange(period) {
  const match = String(period || '').match(/^(\d{4})-(\d{2})-([12])$/);
  if (!match) return null;
  const year = +match[1];
  const month = +match[2];
  const half = +match[3];
  const lastDay = new Date(year, month, 0).getDate();
  const firstHalf = half === 1;
  return {
    from: `${match[1]}-${match[2]}-${firstHalf ? '01' : '16'}`,
    to: `${match[1]}-${match[2]}-${firstHalf ? '15' : pad(lastDay)}`,
    label: `${firstHalf ? '01' : '16'}-${firstHalf ? '15' : lastDay} ${MONTH_NAMES[month - 1]} ${year}`,
    period: `${match[1]}-${match[2]}-${half}`,
  };
}

function recentPeriods(count = 24, now = new Date()) {
  const periods = [];
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  let half = now.getDate() <= 15 ? 1 : 2;
  for (let i = 0; i < count; i++) {
    periods.push(periodRange(`${year}-${pad(month)}-${half}`));
    if (half === 2) {
      half = 1;
    } else {
      half = 2;
      month -= 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
    }
  }
  return periods;
}

// only the branch picked in the top bar (models.scopeWhere from awbBranch; the report's own dates pick the period)
const scoped = (models, whereClause) =>
  models && models.scopeWhere && Reflect.ownKeys(models.scopeWhere).length
    ? { [Op.and]: [whereClause, models.scopeWhere] }
    : whereClause;

async function loadLines(models, ids, types) {
  if (!ids.length) return {};
  const linesByAwb = {};
  const lines = await models.AwbRateLine.findAll({
    where: { awbId: ids, awbType: types },
    attributes: ['awbId', 'pieces', 'grossWeight', 'chargeableWeight', 'rateCharge', 'total', 'rateClass'],
  });
  for (const line of lines) (linesByAwb[line.awbId] = linesByAwb[line.awbId] || []).push(line);
  return linesByAwb;
}

const chargeableOf = (record, lines) => {
  const total = (lines || []).reduce((sum, line) => sum + num(line.chargeableWeight), 0);
  return total || num(record.grossWeight);
};

// ---------------- Tonnage ----------------

function tonnageRow(record, { kind, no, hawb, day, lines }) {
  return {
    agentKey: agentKey(record),
    agent: agentLabel(record),
    kind,
    no,
    hawb,
    customer: record.shipperName || '',
    origin: record.origin || '',
    destination: record.destination || '',
    day,
    pieces: parseInt(record.totalPieces, 10) || 0,
    gross: num(record.grossWeight),
    chargeable: chargeableOf(record, lines),
    volume: num(record.totalVolume),
    flight: record.flightNumber1 || '',
  };
}

function tonnageGroupKey(groupBy, airlineName) {
  return (row) => {
    switch (groupBy) {
      case 'airline': {
        const prefix = bare(row.no).slice(0, 3);
        return [prefix, airlineName(prefix)];
      }
      case 'agent':
        return [row.agentKey, row.agent];
      case 'destination':
        return [row.destination.toUpperCase() || '-', row.destination.toUpperCase() || '(none)'];
      case 'origin':
        return [row.origin.toUpperCase() || '-', row.origin.toUpperCase() || '(none)'];
      case 'customer': {
        const customer = row.customer.toUpperCase().trim() || '(no shipper)';
        return [customer, customer];
      }
      case 'month': {
        const month = String(row.day).slice(0, 7);
        return [month, `${MONTH_NAMES[+month.slice(5, 7) - 1] || ''} ${month.slice(0, 4)}`];
      }
      default:
        return [row.day, row.day];
    }
  };
}

function sumTonnageGroups(rows, keyOf, groupBy) {
  const groups = {};
  rows.forEach((row) => {
    const [key, label] = keyOf(row);
    const group = (groups[key] = groups[key] || {
      key,
      label,
      docs: 0,
      pieces: 0,
      grossWeight: 0,
      chargeableWeight: 0,
      volume: 0,
    });
    group.docs += 1;
    group.pieces += row.pieces;
    group.grossWeight += row.gross;
    group.chargeableWeight += row.chargeable;
    group.volume += row.volume;
  });
  const sortByTime = groupBy === 'month' || groupBy === 'day';
  return Object.values(groups)
    .map((group) => ({
      ...group,
      grossWeight: round1(group.grossWeight),
      chargeableWeight: round1(group.chargeableWeight),
      volume: round2(group.volume),
    }))
    .sort((a, b) =>
      sortByTime ? String(a.key).localeCompare(String(b.key)) : b.chargeableWeight - a.chargeableWeight,
    );
}

// q: from, to (YYYY-MM-DD), dateBasis AWB|FLIGHT, groupBy airline|agent|destination|origin|customer|month|day,
//    airline (prefix), agent, type ALL|AWB|MAWB
async function buildTonnage(models, q = {}) {
  const { Airwaybill, HouseAWB, Airline } = models;
  const live = liveStatus();
  const groupBy = TONNAGE_GROUPS.includes(q.groupBy) ? q.groupBy : 'airline';
  const from = dayOf(q.from);
  const to = dayOf(q.to);
  if (!from || !to) throw badRequest('Give a from and to date');
  if (from > to) throw badRequest('From date is after to date');
  const byFlight = q.dateBasis === 'FLIGHT';
  const pickDay = (record) => (byFlight ? dayOf(record.flightDate1) : awbDay(record));
  const inRange = (day) => day && day >= from && day <= to;
  const attributes = [
    'id',
    'awbNumber',
    'type',
    'masterAwbNumber',
    'agentName',
    'agentCode',
    'shipperName',
    'origin',
    'destination',
    'totalPieces',
    'grossWeight',
    'totalVolume',
    'flightNumber1',
    'flightDate1',
    'executedDate',
    'createdAt',
  ];
  const prefix = q.airline && /^\d{3}$/.test(String(q.airline)) ? String(q.airline) : null;

  const allAwbs = await Airwaybill.findAll({
    where: scoped(models, { status: live }),
    attributes: attributes.filter((name) => name !== 'masterAwbNumber'),
  });
  let awbs = allAwbs.filter(
    (awb) => inRange(pickDay(awb)) && (!prefix || bare(awb.awbNumber).startsWith(prefix)) && agentMatch(awb, q.agent),
  );
  if (q.type === 'AWB') awbs = awbs.filter((awb) => docType(awb) === 'AWB');
  if (q.type === 'MAWB') awbs = awbs.filter((awb) => docType(awb) === 'MAWB');
  const awbLines = await loadLines(
    models,
    awbs.map((awb) => awb.id),
    AIRLINE_DOC_TYPES,
  );

  // rows that are counted: airline docs; for "customer" the direct AWBs + the houses (a MAWB's customers are its houses)
  let rows = awbs.map((awb) =>
    tonnageRow(awb, {
      kind: docType(awb),
      no: awb.awbNumber,
      hawb: '',
      day: pickDay(awb),
      lines: awbLines[awb.id],
    }),
  );
  if (groupBy === 'customer') {
    const masterDay = {};
    awbs.forEach((awb) => {
      masterDay[bare(awb.awbNumber)] = pickDay(awb);
    });
    const houseDay = (house) =>
      byFlight ? dayOf(house.flightDate1) || masterDay[bare(house.masterAwbNumber)] : awbDay(house);
    const allHouses = await HouseAWB.findAll({ where: scoped(models, { status: live }), attributes });
    const houses = allHouses.filter(
      (house) =>
        inRange(houseDay(house)) &&
        (!prefix || bare(house.masterAwbNumber).startsWith(prefix)) &&
        (!q.agent || masterDay[bare(house.masterAwbNumber)] !== undefined),
    );
    const houseLines = await loadLines(
      models,
      houses.map((house) => house.id),
      ['HAWB'],
    );
    const mastersWithHouses = new Set(houses.map((house) => bare(house.masterAwbNumber)));
    rows = [
      ...rows.filter((row) => row.kind === 'AWB' || !mastersWithHouses.has(bare(row.no))),
      ...houses.map((house) =>
        tonnageRow(house, {
          kind: 'HAWB',
          no: house.masterAwbNumber || '',
          hawb: house.awbNumber,
          day: houseDay(house),
          lines: houseLines[house.id],
        }),
      ),
    ];
  }

  const airlines = await Airline.findAll({ attributes: ['prefix', 'code2', 'name'] });
  const airlineName = (airlinePrefix) => {
    const airline = airlines.find((row) => String(row.prefix) === airlinePrefix);
    return airline ? `${airlinePrefix} ${airline.code2 || ''} ${airline.name}`.replace(/\s+/g, ' ') : airlinePrefix;
  };
  const keyOf = tonnageGroupKey(groupBy, airlineName);
  const groups = sumTonnageGroups(rows, keyOf, groupBy);
  const totals = groups.reduce(
    (sum, group) => ({
      docs: sum.docs + group.docs,
      pieces: sum.pieces + group.pieces,
      grossWeight: sum.grossWeight + group.grossWeight,
      chargeableWeight: sum.chargeableWeight + group.chargeableWeight,
      volume: sum.volume + group.volume,
    }),
    { docs: 0, pieces: 0, grossWeight: 0, chargeableWeight: 0, volume: 0 },
  );
  groups.forEach((group) => {
    group.share = totals.chargeableWeight ? round1((group.chargeableWeight / totals.chargeableWeight) * 100) : 0;
  });
  return {
    from,
    to,
    dateBasis: byFlight ? 'FLIGHT' : 'AWB',
    groupBy,
    groups,
    totals: {
      ...totals,
      grossWeight: round1(totals.grossWeight),
      chargeableWeight: round1(totals.chargeableWeight),
      volume: round2(totals.volume),
      tonnes: round2(totals.chargeableWeight / KG_PER_TONNE),
    },
    rows: rows
      .map((row) => ({ ...row, group: keyOf(row)[1], gross: round1(row.gross), chargeable: round1(row.chargeable) }))
      .sort((a, b) => String(a.day).localeCompare(String(b.day)) || String(a.no).localeCompare(String(b.no))),
  };
}

// ---------------- CSR (Cargo Sales Report) ----------------

const isCollect = (value) => /^C/i.test(String(value || '').trim());

// due agent / due carrier split of the AWB's other charges, PP / CC
function splitOtherCharges(charges, otherIsCollect) {
  const split = { dueCarrierPP: 0, dueCarrierCC: 0, dueAgentPP: 0, dueAgentCC: 0 };
  (charges || []).forEach((charge) => {
    const amount = num(charge.amount);
    const side = String(charge.ppcc || '');
    const collect = /^(CC|C)$/i.test(side) ? true : /^(PP|P)$/i.test(side) ? false : otherIsCollect;
    // due agent / due carrier: the saved entitlement; without it the IATA code's 3rd letter (MYC = carrier, AWA = agent)
    const entitlement = String(charge.entitlement || '')
      .trim()
      .toUpperCase();
    const dueAgent =
      /^(A|AGENT|DUE ?AGENT)$/.test(entitlement) ||
      (!entitlement && /^[A-Z]{2}A$/i.test(String(charge.chargeCode || '')));
    if (dueAgent) {
      if (collect) split.dueAgentCC += amount;
      else split.dueAgentPP += amount;
    } else if (collect) {
      split.dueCarrierCC += amount;
    } else {
      split.dueCarrierPP += amount;
    }
  });
  return split;
}

function csrItem(awb, { lines, otherCharges, airlineOf }) {
  const airlinePrefix = bare(awb.awbNumber).slice(0, 3);
  const airline = airlineOf(airlinePrefix);
  const commType = String((airline && airline.commType) || 'NET').toUpperCase();
  const commRate = commType === 'NET' ? 0 : num(airline && airline.commRate);
  const weightIsCollect = isCollect(awb.wtVal) || (!awb.wtVal && isCollect(awb.chargeCode));
  const otherIsCollect = isCollect(awb.other) || (!awb.other && isCollect(awb.chargeCode));
  // weight charge: the saved PP / CC figures, else the rate-line totals on the AWB's PP/CC side
  let weightPP = num(awb.weightChargePP);
  let weightCC = num(awb.weightChargeCC);
  if (!weightPP && !weightCC) {
    const linesTotal = (lines || []).reduce((sum, line) => sum + num(line.total), 0);
    if (weightIsCollect) weightCC = linesTotal;
    else weightPP = linesTotal;
  }
  const valuationPP = num(awb.valChargePP);
  const valuationCC = num(awb.valChargeCC);
  const taxPP = num(awb.taxPP);
  const taxCC = num(awb.taxCC);
  const { dueCarrierPP, dueCarrierCC, dueAgentPP, dueAgentCC } = splitOtherCharges(otherCharges, otherIsCollect);
  const commissionPP = round2((weightPP * commRate) / 100);
  const commissionCC = round2((weightCC * commRate) / 100);
  const payable = round2(weightPP + valuationPP + taxPP + dueCarrierPP - commissionPP);
  const receivable = round2(dueAgentCC + commissionCC);
  return {
    id: awb.id,
    type: docType(awb),
    awbNumber: awb.awbNumber,
    date: awbDay(awb),
    airlinePrefix,
    airline: airline ? airline.name : airlinePrefix,
    agentKey: agentKey(awb),
    agent: agentLabel(awb),
    agentName: awb.agentName || '',
    agentCode: awb.agentCode || '',
    origin: awb.origin || '',
    destination: awb.destination || '',
    flight: awb.flightNumber1 || '',
    shipper: awb.shipperName || '',
    consignee: awb.consigneeName || '',
    pieces: parseInt(awb.totalPieces, 10) || 0,
    grossWeight: round1(num(awb.grossWeight)),
    chargeableWeight: round1(chargeableOf(awb, lines)),
    rate: (lines || []).map((line) => num(line.rateCharge)).find((x) => x) || 0,
    currency: String(awb.currencyCode || 'INR').toUpperCase(),
    ppcc: weightIsCollect ? 'CC' : 'PP',
    weightPP: round2(weightPP),
    weightCC: round2(weightCC),
    valuationPP: round2(valuationPP),
    valuationCC: round2(valuationCC),
    taxPP: round2(taxPP),
    taxCC: round2(taxCC),
    dueCarrierPP: round2(dueCarrierPP),
    dueCarrierCC: round2(dueCarrierCC),
    dueAgentPP: round2(dueAgentPP),
    dueAgentCC: round2(dueAgentCC),
    commRate,
    commType,
    commissionPP,
    commissionCC,
    payable,
    receivable,
    net: round2(payable - receivable),
  };
}

const CSR_SUM_FIELDS = [
  'pieces',
  'grossWeight',
  'chargeableWeight',
  'weightPP',
  'weightCC',
  'valuationPP',
  'valuationCC',
  'taxPP',
  'taxCC',
  'dueCarrierPP',
  'dueCarrierCC',
  'dueAgentPP',
  'dueAgentCC',
  'commissionPP',
  'commissionCC',
  'payable',
  'receivable',
  'net',
];

// one CSR per IATA agent code, airline and currency (CASS bills each agent code separately)
function summariseCsr(items) {
  const summary = {};
  items.forEach((item) => {
    const key = `${item.agentKey}|${item.airlinePrefix}|${item.currency}`;
    const entry = (summary[key] = summary[key] || {
      agentKey: item.agentKey,
      agent: item.agent,
      agentCode: item.agentCode,
      airlinePrefix: item.airlinePrefix,
      airline: item.airline,
      currency: item.currency,
      awbs: 0,
      commRate: item.commRate,
      commType: item.commType,
      ...Object.fromEntries(CSR_SUM_FIELDS.map((field) => [field, 0])),
    });
    entry.awbs += 1;
    CSR_SUM_FIELDS.forEach((field) => {
      entry[field] += item[field];
    });
  });
  return Object.values(summary)
    .map((entry) => {
      CSR_SUM_FIELDS.forEach((field) => {
        entry[field] = field === 'pieces' ? entry[field] : round2(entry[field]);
      });
      return entry;
    })
    .sort(
      (a, b) =>
        a.agentKey.localeCompare(b.agentKey) ||
        a.airlinePrefix.localeCompare(b.airlinePrefix) ||
        a.currency.localeCompare(b.currency),
    );
}

// q: period 'YYYY-MM-1|2' (CASS fortnight) or from/to; airline prefix or 'ALL'
// Per AWB: weight charge, valuation, tax, due carrier, due agent split PP / CC (from the AWB's saved charges),
// commission = airline commission % of the weight charge (none when the airline is on NET),
// payable to airline = PP weight + valuation + tax + due carrier - commission on PP;
// receivable from airline = CC due agent + commission on CC;  net = payable - receivable (in each currency).
async function buildCsr(models, q = {}) {
  const { Airwaybill, Airline, AwbOtherCharge } = models;
  let range = q.period ? periodRange(q.period) : null;
  if (!range && q.from && q.to)
    range = { from: dayOf(q.from), to: dayOf(q.to), label: `${dayOf(q.from)} to ${dayOf(q.to)}`, period: null };
  if (!range || !range.from || !range.to) throw badRequest('Pick a CASS period (1-15 or 16-end of month)');
  const prefix = q.airline && q.airline !== 'ALL' ? String(q.airline) : null;
  const agentWanted = q.agent && q.agent !== 'ALL' ? String(q.agent) : '';
  if (prefix && !/^\d{3}$/.test(prefix)) throw badRequest('Airline must be a 3-digit AWB prefix');

  const allAwbs = await Airwaybill.findAll({ where: scoped(models, { status: liveStatus() }) });
  const awbs = allAwbs.filter((awb) => {
    const day = awbDay(awb);
    return (
      day &&
      day >= range.from &&
      day <= range.to &&
      (!prefix || bare(awb.awbNumber).startsWith(prefix)) &&
      agentMatch(awb, agentWanted)
    );
  });
  const ids = awbs.map((awb) => awb.id);
  const lines = await loadLines(models, ids, AIRLINE_DOC_TYPES);
  const otherCharges = {};
  if (ids.length) {
    const charges = await AwbOtherCharge.findAll({ where: { awbId: ids, awbType: AIRLINE_DOC_TYPES } });
    for (const charge of charges) (otherCharges[charge.awbId] = otherCharges[charge.awbId] || []).push(charge);
  }
  const airlines = await Airline.findAll();
  const airlineOf = (airlinePrefix) => airlines.find((row) => String(row.prefix) === airlinePrefix);

  const items = awbs
    .map((awb) => csrItem(awb, { lines: lines[awb.id], otherCharges: otherCharges[awb.id], airlineOf }))
    .sort(
      (x, y) =>
        x.agentKey.localeCompare(y.agentKey) ||
        x.airlinePrefix.localeCompare(y.airlinePrefix) ||
        String(x.date).localeCompare(String(y.date)) ||
        x.awbNumber.localeCompare(y.awbNumber),
    );

  return {
    period: range.period,
    from: range.from,
    to: range.to,
    label: range.label,
    airline: prefix || 'ALL',
    agent: agentWanted || 'ALL',
    items,
    airlineSummary: summariseCsr(items),
  };
}

export { buildTonnage, buildCsr, recentPeriods, dayOf };
