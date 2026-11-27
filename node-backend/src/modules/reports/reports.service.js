import { QueryTypes } from 'sequelize';
import { Op, sequelize } from '../../config/database.js';
import { Airline, Airwaybill, AwbOtherCharge, AwbRateLine, HouseAWB, IataAgent, Party } from '../../models/index.js';
import { buildCsr, buildTonnage, recentPeriods } from '../../utils/awb/awbReports.js';

const CSR_PERIODS_SHOWN = 24;
const SUBMITTED_BY = 'Admin';
const PARTY_COLUMNS = 'id, name, street, city, countryCode, partyType';
const MAWB_ATTRIBUTES = [
  'id',
  'awbNumber',
  'type',
  'origin',
  'destination',
  'grossWeight',
  'totalPieces',
  'shipperName',
  'consigneeName',
  'flightNumber1',
  'flightDate1',
  'createdAt',
];
const HAWB_ATTRIBUTES = [
  'id',
  'awbNumber',
  'masterAwbNumber',
  'origin',
  'destination',
  'grossWeight',
  'totalPieces',
  'shipperName',
  'consigneeName',
  'createdAt',
];
const EXPORT_AWB_ATTRIBUTES = [
  'awbNumber',
  'type',
  'origin',
  'destination',
  'status',
  'flightNumber1',
  'flightDate1',
  'shipperName',
  'consigneeName',
  'grossWeight',
  'totalPieces',
  'createdAt',
];
const EXPORT_HAWB_ATTRIBUTES = [
  'awbNumber',
  'masterAwbNumber',
  'origin',
  'destination',
  'status',
  'shipperName',
  'grossWeight',
  'totalPieces',
  'createdAt',
];

const dayStart = (day) => new Date(day + 'T00:00:00Z');
const dayEnd = (day) => new Date(day + 'T23:59:59Z');

/** createdAt between the from / to days (either may be missing); null when neither is given. */
function createdAtRange(fromDate, toDate) {
  if (fromDate && toDate) return { [Op.between]: [dayStart(fromDate), dayEnd(toDate)] };
  if (fromDate) return { [Op.gte]: dayStart(fromDate) };
  if (toDate) return { [Op.lte]: dayEnd(toDate) };
  return null;
}

function createdAtWhere(fromDate, toDate) {
  const range = createdAtRange(fromDate, toDate);
  return range ? { createdAt: range } : {};
}

/**
 * The parties of the pickers. The ~1.2 lakh iCAFFE consignees loaded in bulk (Parties.searchOnly = 1) are left out,
 * as in the Party Master's full list: sending them all froze the Search AWB screen.
 */
async function partiesForPickers(companyId) {
  try {
    const parties = await sequelize.query(
      `SELECT ${PARTY_COLUMNS} FROM Parties WHERE coalesce(searchOnly, 0) = 0 ORDER BY name`,
      { type: QueryTypes.SELECT },
    );
    // eslint-disable-next-line eqeqeq
    if (companyId && !parties.some((party) => party.id == companyId)) {
      parties.push(
        ...(await sequelize.query(`SELECT ${PARTY_COLUMNS} FROM Parties WHERE id = ?`, {
          replacements: [companyId],
          type: QueryTypes.SELECT,
        })),
      );
    }
    return parties;
  } catch {
    // no searchOnly column yet
    return Party.findAll({ attributes: ['id', 'name', 'street', 'city', 'countryCode', 'partyType'], raw: true });
  }
}

const wantsDocType = (docType, kind) => !docType || docType === 'All' || docType === kind;

function airlineNameOfAwb(awbNumber, airlines) {
  if (!awbNumber) return 'N/A';
  const prefix = awbNumber.split('-')[0];
  const airline = airlines.find((entry) => entry.prefix === prefix);
  return airline ? airline.name : 'N/A';
}

const masterTransactionRow = (awb, airlines) => ({
  docType: awb.type || 'MAWB',
  mawbNo: awb.awbNumber || '-',
  hawbNo: '',
  airline: airlineNameOfAwb(awb.awbNumber, airlines),
  origin: awb.origin || '-',
  destination: awb.destination || '-',
  grossWeight: awb.grossWeight || 0,
  pieces: awb.totalPieces || 0,
  shipper: awb.shipperName || '-',
  consignee: awb.consigneeName || '-',
  flight: awb.flightNumber1 || '-',
  flightDate: awb.flightDate1 || '-',
  submittedDate: awb.createdAt,
  submittedBy: SUBMITTED_BY,
});

const houseTransactionRow = (house) => ({
  docType: 'HAWB',
  mawbNo: house.masterAwbNumber || '-',
  hawbNo: house.awbNumber || '-',
  airline: 'N/A',
  origin: house.origin || '-',
  destination: house.destination || '-',
  grossWeight: house.grossWeight || 0,
  pieces: house.totalPieces || 0,
  shipper: house.shipperName || '-',
  consignee: house.consigneeName || '-',
  flight: '-',
  flightDate: '-',
  submittedDate: house.createdAt,
  submittedBy: SUBMITTED_BY,
});

function companyOf(companyId, parties) {
  const companyInfo = { name: 'ALL COMPANIES', address: '---' };
  if (!companyId) return { companyInfo, partyName: null };
  // eslint-disable-next-line eqeqeq
  const party = parties.find((entry) => entry.id == companyId);
  if (!party) return { companyInfo, partyName: null };
  companyInfo.name = party.name;
  companyInfo.address = [party.street, party.city, party.countryCode].filter(Boolean).join(', ');
  return { companyInfo, partyName: party.name };
}

/** GET /forwarder-transactions: the MAWBs / HAWBs of the period, with the airline and party pickers. */
export async function forwarderTransactions({ fromDate, toDate, docType, airline, companyId }) {
  const mawbWhere = createdAtWhere(fromDate, toDate);
  const hawbWhere = createdAtWhere(fromDate, toDate);

  const airlines = await Airline.findAll({ attributes: ['id', 'name', 'code2', 'prefix'] });
  const parties = await partiesForPickers(companyId);
  const { companyInfo, partyName } = companyOf(companyId, parties);

  if (partyName) {
    mawbWhere[Op.or] = [{ shipperName: partyName }, { consigneeName: partyName }];
    hawbWhere[Op.or] = [{ shipperName: partyName }, { consigneeName: partyName }];
  }
  // the airline is matched on the AWB prefix, which a HAWB does not have
  if (airline) {
    const selectedAirline = airlines.find((entry) => entry.code2 === airline);
    if (selectedAirline && selectedAirline.prefix) mawbWhere.awbNumber = { [Op.like]: selectedAirline.prefix + '-%' };
  }

  const mawbs = wantsDocType(docType, 'MAWB')
    ? await Airwaybill.findAll({ where: mawbWhere, attributes: MAWB_ATTRIBUTES, order: [['createdAt', 'DESC']] })
    : [];
  const hawbs = wantsDocType(docType, 'HAWB')
    ? await HouseAWB.findAll({ where: hawbWhere, attributes: HAWB_ATTRIBUTES, order: [['createdAt', 'DESC']] })
    : [];

  const rows = [...mawbs.map((awb) => masterTransactionRow(awb, airlines)), ...hawbs.map(houseTransactionRow)];
  rows.sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));
  return {
    success: true,
    data: rows.map((row, index) => ({ ...row, sno: index + 1 })),
    airlines,
    parties,
    companyInfo,
    summary: { totalMawb: mawbs.length, totalHawb: hawbs.length, totalRecords: rows.length },
  };
}

const localDate = (value) => new Date(value).toLocaleDateString();

const exportAwbRow = (awb) => ({
  type: awb.type || 'MAWB',
  awb: awb.awbNumber,
  status: awb.status || 'ACTIVE',
  prefix: (awb.awbNumber || '').split('-')[0],
  origin: awb.origin,
  dep: awb.flightDate1 || localDate(awb.createdAt),
  dst: awb.destination,
  shipper: awb.shipperName,
  gw: awb.grossWeight,
  pcs: awb.totalPieces,
  awbDate: localDate(awb.createdAt),
});

const exportHouseRow = (house) => ({
  type: 'HAWB',
  awb: house.awbNumber,
  mawb: house.masterAwbNumber,
  status: house.status || 'ACTIVE',
  prefix: 'N/A',
  origin: house.origin,
  dep: localDate(house.createdAt),
  dst: house.destination,
  shipper: house.shipperName,
  gw: house.grossWeight,
  pcs: house.totalPieces,
  awbDate: localDate(house.createdAt),
});

/** GET /export-data: the AWBs / HAWBs of the period for the CSV / Excel export. */
export async function exportData({ fromDate, toDate, fileType }) {
  const where = createdAtWhere(fromDate, toDate);
  const rows = [];
  if (!fileType || fileType === 'MAWB' || fileType === 'ALL') {
    rows.push(...(await Airwaybill.findAll({ where, attributes: EXPORT_AWB_ATTRIBUTES })).map(exportAwbRow));
  }
  if (!fileType || fileType === 'HAWB' || fileType === 'ALL') {
    rows.push(...(await HouseAWB.findAll({ where, attributes: EXPORT_HAWB_ATTRIBUTES })).map(exportHouseRow));
  }
  rows.sort((a, b) => new Date(b.awbDate) - new Date(a.awbDate));
  return { success: true, data: rows };
}

const awbReportModels = () => ({ Airwaybill, HouseAWB, Airline, AwbRateLine, AwbOtherCharge });

/** GET /tonnage: Air Export tonnage, grouped by airline / destination / origin / customer / month / day. */
export async function tonnageReport(scopeWhere, query) {
  return { success: true, ...(await buildTonnage({ ...awbReportModels(), scopeWhere }, query)) };
}

/** GET /csr: the CASS sales report of a fortnight (-1 = 1st-15th, -2 = 16th-end). */
export async function csrReport(scopeWhere, query) {
  return { success: true, ...(await buildCsr({ ...awbReportModels(), scopeWhere }, query)) };
}

const bareCode = (code) =>
  String(code || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();

/**
 * GET /awb-agents: the IATA Agent master plus every agent written on an airline AWB (an agent typed on the AWB but
 * missing in the master is still listed).
 */
export async function listAwbAgents() {
  const agents = new Map();
  (await IataAgent.findAll({ attributes: ['name', 'iataCode'] })).forEach((agent) => {
    const key = bareCode(agent.iataCode) || String(agent.name || '').toUpperCase();
    if (key) agents.set(key, { name: agent.name || '', iataCode: agent.iataCode || '', inMaster: true });
  });
  const awbAgents = await Airwaybill.findAll({
    attributes: ['agentName', 'agentCode'],
    where: { status: { [Op.or]: [{ [Op.ne]: 'VOID' }, null] } },
    group: ['agentName', 'agentCode'],
  });
  awbAgents.forEach((agent) => {
    const key =
      bareCode(agent.agentCode) ||
      String(agent.agentName || '')
        .trim()
        .toUpperCase();
    if (key && !agents.has(key))
      agents.set(key, { name: agent.agentName || '', iataCode: agent.agentCode || '', inMaster: false });
  });
  return { success: true, agents: [...agents.values()].sort((x, y) => String(x.name).localeCompare(String(y.name))) };
}

/** GET /csr-periods: the last 24 CASS periods for the picker. */
export function listCsrPeriods() {
  return { success: true, periods: recentPeriods(CSR_PERIODS_SHOWN) };
}
