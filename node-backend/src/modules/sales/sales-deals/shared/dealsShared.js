import { NotFoundError } from '../../../../core/http/index.js';
import { q, today, SERVICES } from '../../../../utils/common/salesHub.js';

export const ENQUIRY_STATUSES = [
  ['OPEN', 'Open'],
  ['QUOTED', 'Quoted'],
  ['WON', 'Won'],
  ['LOST', 'Lost'],
  ['DROPPED', 'Dropped / no shipment'],
];
export const QUOTE_STATUSES = [
  ['DRAFT', 'Draft'],
  ['SENT', 'Sent'],
  ['WON', 'Won'],
  ['LOST', 'Lost'],
  ['SUPERSEDED', 'Revised'],
];
export const RECEIVED_VIA = ['E-mail', 'Phone', 'WhatsApp', 'Visit', 'Portal / tender', 'Overseas agent', 'Walk-in'];
export const PRIORITIES = [
  ['HIGH', 'High'],
  ['NORMAL', 'Normal'],
  ['LOW', 'Low'],
];
export const CHARGE_BASIS = [
  ['FLAT', 'Per shipment'],
  ['KG', 'Per kg (chargeable)'],
  ['CBM', 'Per CBM'],
  ['CONTAINER', 'Per container'],
  ['PKG', 'Per package'],
  ['DOC', 'Per document (B/L, AWB, B/E, S/B)'],
  ['PCT', '% of cargo value'],
];
export const CHARGE_SECTIONS = [
  ['FREIGHT', 'Freight'],
  ['ORIGIN', 'Origin charges'],
  ['DESTINATION', 'Destination charges'],
  ['CUSTOMS', 'Customs clearance'],
  ['TRANSPORT', 'Transport'],
  ['OTHER', 'Other charges'],
];
export const DEFAULT_TERMS = [
  'Rates are valid till the date shown and subject to space and equipment availability at the time of booking.',
  'GST is extra as applicable on each charge (rate shown against the charge).',
  'Duty, taxes, demurrage, detention, storage, inspection and any charge not shown above are extra at actuals.',
  'Freight is on chargeable weight / volume as per the carrier; rates in foreign currency are billed at the rate of exchange on the date of the invoice.',
  'Cargo insurance is not included unless shown above. Our services are subject to our standard trading conditions.',
  'Payment as per the agreed credit terms.',
].join('\n');
export const CLOSED_ENQUIRY_STATUSES = ['WON', 'LOST', 'DROPPED'];

const DEAL_NUMBER_RE = /^[A-Z]+\/\d{4}\/(\d+)/;

// Leads / Quotations / QuotationCharges are also Sequelize models: their dates must be in the form Sequelize reads
export const dbNow = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');

export const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

/** "2627" for the financial year 2026-27. */
function financialYearCode(date = today()) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const startYear = month < 4 ? year - 1 : year;
  return String(startYear % 100).padStart(2, '0') + String((startYear + 1) % 100).padStart(2, '0');
}

export const serviceLabel = (code) => (SERVICES.find((service) => service[0] === code) || [code, code || ''])[1];

export function modeOfService(serviceType) {
  const service = String(serviceType || '');
  if (service.startsWith('AIR')) return 'AIR';
  if (service.startsWith('SEA')) return 'SEA';
  if (service.startsWith('CUSTOMS')) return 'CUSTOMS';
  if (service === 'TRANSPORT') return 'ROAD';
  return service || null;
}

/** The next ENQ/2627/0001-style number of a table, from what is already stored. */
export async function nextDealNumber(table, field, prefix) {
  const yearCode = financialYearCode();
  const rows = await q(`SELECT ${field} n FROM "${table}" WHERE ${field} LIKE ?`, [`${prefix}/${yearCode}/%`]);
  let highest = 0;
  rows.forEach((row) => {
    const match = DEAL_NUMBER_RE.exec(String(row.n || ''));
    if (match) highest = Math.max(highest, Number(match[1]));
  });
  return `${prefix}/${yearCode}/${String(highest + 1).padStart(4, '0')}`;
}

/** Who sees what: a sales person sees the deals he handles or of customers he / his team is KAM of. */
export function dealWhere(salesViewer, alias = 'e') {
  const conditions = [];
  const params = [];
  if (salesViewer.team) {
    const ids = [...salesViewer.team];
    const marks = ids.map(() => '?').join(',');
    conditions.push(
      `(${alias}.salesPersonId IN (${marks}) OR ${alias}.customerId IN (SELECT c.id FROM SalesCustomers c WHERE c.kamId IN (${marks})))`,
    );
    params.push(...ids, ...ids);
  } else if (salesViewer.branches && salesViewer.branches.length) {
    conditions.push(
      `(${alias}.branchCode IS NULL OR ${alias}.branchCode = '' OR upper(${alias}.branchCode) IN (${salesViewer.branches.map(() => '?').join(',')}))`,
    );
    params.push(...salesViewer.branches);
  }
  return { w: conditions, p: params };
}

async function viewerCanSeeDeal(salesViewer, table, id) {
  const { w: conditions, p: params } = dealWhere(salesViewer, 'e');
  const extra = conditions.length ? ' AND ' + conditions.join(' AND ') : '';
  return !!(await q(`SELECT e.id FROM "${table}" e WHERE e.id = ?${extra}`, [id, ...params]))[0];
}

/** Throws 404 when the viewer may not see the enquiry / quotation. */
export async function assertCanSeeDeal(salesViewer, table, id, notFoundMessage) {
  if (!(await viewerCanSeeDeal(salesViewer, table, id))) throw new NotFoundError(notFoundMessage);
}

export const whereClause = (conditions) => (conditions.length ? 'WHERE ' + conditions.join(' AND ') : '');
