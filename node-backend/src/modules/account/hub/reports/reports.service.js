import { invoiceLinks } from '../../../../utils/common/invoiceLinks.js';
import { selectRowsOrEmpty } from '../shared/hubQuery.service.js';
import { todayIso } from '../shared/hubFormat.service.js';
import { findFinancialYear } from '../shared/financialYear.service.js';
import { notFound } from '../shared/hubHttp.js';
import {
  groupWise,
  ledgerLookalikes,
  listOfAccounts,
  monthlyLedger,
  partyBalance,
} from './builders/ledgerReports.service.js';
import {
  expenseSheet,
  nonTrade,
  overseasPurchase,
  purchaseBillSummary,
  purchaseRegister,
} from './builders/purchaseReports.service.js';
import {
  bro,
  listOfInvoices,
  pendingRemittance,
  remittanceRegister,
  salesRegister,
  unbilled,
} from './builders/salesReports.service.js';
import { ageing } from './builders/outstandingReports.service.js';
import { dayBook, tdsPayableReport } from './builders/bookReports.service.js';

const DEFAULT_COMPANY_NAME = 'COMMITTED CARGO CARE LIMITED';

// the iCAFFE account reports: each answers { columns: [[key, label, type, group]], rows, totals, subtitle, note ... }
const REPORT_BUILDERS = {
  'list-of-accounts': listOfAccounts,
  'monthly-ledger': monthlyLedger,
  'expense-sheet': expenseSheet,
  bro,
  'tds-payable': tdsPayableReport,
  'party-balance': partyBalance,
  'group-wise': groupWise,
  'sales-register': salesRegister,
  'purchase-register': purchaseRegister,
  'purchase-bill-summary': purchaseBillSummary,
  'non-trade': nonTrade,
  'overseas-purchase': overseasPurchase,
  'list-of-invoices': listOfInvoices,
  'remittance-register': remittanceRegister,
  'pending-remittance': pendingRemittance,
  unbilled,
  ageing,
  'day-book': dayBook,
  'ledger-lookalikes': ledgerLookalikes,
};

/** Company block printed on top of every report, as iCAFFE does. */
export async function companyHead() {
  const company =
    (
      await selectRowsOrEmpty(
        'SELECT companyName, legalName, address1, address2, city, state, pincode, country, phone, email, website, gstin FROM CompanyProfile ORDER BY id LIMIT 1',
      )
    )[0] || {};
  const address =
    [company.address1, company.address2, company.city, company.state, company.country].filter(Boolean).join(', ') +
    (company.pincode ? ', PIN-' + company.pincode : '') +
    (company.phone ? ', PHONE-' + company.phone : '');
  return {
    name: company.legalName || company.companyName || DEFAULT_COMPANY_NAME,
    address,
    contact: [company.email, company.website].filter(Boolean).join(', '),
    gstin: company.gstin || '',
  };
}

const columnObjects = (columns) =>
  columns.map(([key, label, type, group]) => ({ key, label, type: type || 'text', ...(group ? { group } : {}) }));

// drill-down: _v voucher id (+ _b base type), _l ledger id
const withDrillDown = (rows) =>
  (rows || []).map((row) => ({
    ...row,
    _v: row._v || (row.baseType && row.id) || null,
    _b: row._b || row.baseType || null,
    _l: row._l || row.partyId || null,
    lines: undefined,
  }));

// A row whose voucher is a GST invoice opens the invoice itself (_k = invoice kind); bill-wise reports (with a Bill No
// column) also show which GST invoice it is and whether it has an IRN
async function addGstInvoiceLinks(report) {
  try {
    const links = await invoiceLinks(report.rows.map((row) => row._v));
    if (!links.size) return;
    const billColumn = report.columns.findIndex((column) => column.key === 'billNo');
    for (const row of report.rows) {
      const link = links.get(Number(row._v));
      if (!link) continue;
      row._k = link.kind;
      if (billColumn >= 0) row.gstInv = link.invoiceNo + (link.irn ? '  (IRN)' : '');
    }
    if (billColumn >= 0 && !report.columns.some((column) => column.key === 'gstInv')) {
      report.columns.splice(billColumn + 1, 0, { key: 'gstInv', label: 'GST Invoice', type: 'text' });
    }
  } catch {
    // links are extra - the report stands without them
  }
}

/** One report by name over the query's period (default: the year's start up to today). */
export async function runReport(name, query) {
  const buildReport = REPORT_BUILDERS[name];
  if (!buildReport) throw notFound('Unknown report');
  const year = await findFinancialYear(query.fyId);
  const params = { ...query, from: query.from || year.startDate, to: query.to || todayIso() };
  const report = await buildReport(params);
  report.columns = columnObjects(report.columns);
  report.rows = withDrillDown(report.rows);
  await addGstInvoiceLinks(report);
  return { from: params.from, to: params.to, ...report };
}
