import { q, today } from '../../../../utils/common/salesHub.js';
import { addDays, financialYearStart, queryOrEmpty } from '../../shared/salesHelpers.js';
import { ensureDealTables } from '../shared/dealTables.js';
import {
  CHARGE_BASIS,
  CHARGE_SECTIONS,
  DEFAULT_TERMS,
  ENQUIRY_STATUSES,
  PRIORITIES,
  QUOTE_STATUSES,
  RECEIVED_VIA,
  dealWhere,
} from '../shared/dealsShared.js';

const MARGIN_WARNING_PCT = 10;
const EXPIRING_WITHIN_DAYS = 7;

/** Lists, GST charges, currency rates and the company letterhead the enquiry / quotation screens use. */
export async function getDealMeta() {
  await ensureDealTables();
  const charges = await queryOrEmpty(
    'SELECT id, chargeName, sacCode, gstRate FROM AccGstCharges WHERE coalesce(isActive, 1) = 1 ORDER BY chargeName',
  );
  const currencies = await queryOrEmpty(
    'SELECT currencyCode code, importRate, exportRate FROM Currencies ORDER BY currencyCode',
  );
  const [company] =
    await queryOrEmpty(`SELECT companyName, legalName, address1, address2, city, state, pincode, country, gstin, pan, phone, email,
      website, logoDataUrl FROM CompanyProfile ORDER BY id LIMIT 1`);
  return {
    success: true,
    enquiryStatus: ENQUIRY_STATUSES,
    quoteStatus: QUOTE_STATUSES,
    via: RECEIVED_VIA,
    priority: PRIORITIES,
    basis: CHARGE_BASIS,
    sections: CHARGE_SECTIONS,
    defaultTerms: DEFAULT_TERMS,
    charges,
    currencies: currencies.map((currency) => ({
      code: currency.code,
      importRate: Number(currency.importRate) || null,
      exportRate: Number(currency.exportRate) || null,
    })),
    company: company || {},
    marginWarnPct: MARGIN_WARNING_PCT,
  };
}

// the Sales dashboard passes the person picked there (only one the viewer may see)
function addPickedPersonFilter(filter, salesViewer, person) {
  const personId = /^\d+$/.test(String(person || '')) ? Number(person) : null;
  if (!personId || (salesViewer.team && !salesViewer.team.has(personId))) return;
  filter.w.push('(e.salesPersonId = ? OR e.customerId IN (SELECT c.id FROM SalesCustomers c WHERE c.kamId = ?))');
  filter.p.push(personId, personId);
}

const firstRow = async (sql, params = []) => (await q(sql, params))[0] || {};

const winRateOf = (won, lost) => (won + lost ? Math.round((100 * won) / (won + lost)) : null);

/** The figures on top of the Enquiries tab. */
export async function getDealsSummary(salesViewer, query) {
  await ensureDealTables();
  const filter = dealWhere(salesViewer, 'e');
  const day = today();
  addPickedPersonFilter(filter, salesViewer, query.person);
  const fyStart = financialYearStart(day);
  const where = (extra) => ([...filter.w, ...extra].length ? 'WHERE ' + [...filter.w, ...extra].join(' AND ') : '');
  const open = await firstRow(
    `SELECT count(*) n, sum(CASE WHEN e.quoteBy IS NOT NULL AND e.quoteBy < ? THEN 1 ELSE 0 END) late
      FROM Leads e ${where(["e.status = 'OPEN'"])}`,
    [day, ...filter.p],
  );
  const sent = await firstRow(
    `SELECT count(*) n, sum(e.totalSellInr) v, sum(CASE WHEN e.validUntil IS NOT NULL AND e.validUntil < ? THEN 1 ELSE 0 END) expired,
      sum(CASE WHEN e.validUntil >= ? AND e.validUntil <= ? THEN 1 ELSE 0 END) expiring FROM Quotations e ${where(["e.status = 'SENT'"])}`,
    [day, day, addDays(day, EXPIRING_WITHIN_DAYS), ...filter.p],
  );
  const wonThisMonth = await firstRow(
    `SELECT count(*) n, sum(e.totalSellInr) v, sum(e.marginInr) m FROM Quotations e
      ${where(["e.status = 'WON'", 'substr(e.wonAt, 1, 10) >= ?'])}`,
    [...filter.p, day.slice(0, 8) + '01'],
  );
  const yearWonLost = await firstRow(
    `SELECT sum(CASE WHEN e.status = 'WON' THEN 1 ELSE 0 END) w, sum(CASE WHEN e.status = 'LOST' THEN 1 ELSE 0 END) l
      FROM Leads e ${where(['e.date >= ?'])}`,
    [...filter.p, fyStart],
  );
  const drafts = await firstRow(`SELECT count(*) n FROM Quotations e ${where(["e.status = 'DRAFT'"])}`, filter.p);
  return {
    success: true,
    data: {
      openEnquiries: open.n || 0,
      lateEnquiries: open.late || 0,
      draftQuotes: drafts.n || 0,
      sentQuotes: sent.n || 0,
      sentValue: sent.v || 0,
      expiredQuotes: sent.expired || 0,
      expiringQuotes: sent.expiring || 0,
      wonMonth: wonThisMonth.n || 0,
      wonMonthValue: wonThisMonth.v || 0,
      wonMonthMargin: wonThisMonth.m || 0,
      fyWon: yearWonLost.w || 0,
      fyLost: yearWonLost.l || 0,
      winRate: winRateOf(yearWonLost.w || 0, yearWonLost.l || 0),
    },
  };
}
