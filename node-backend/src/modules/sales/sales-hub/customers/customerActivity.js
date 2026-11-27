import { q, today, isReimbLedger } from '../../../../utils/common/salesHub.js';
import { addYears, daysBetween, financialYearStart, queryOrEmpty } from '../../shared/salesHelpers.js';

const ACTIVITY_CACHE_MS = 10 * 60 * 1000;
const LEDGER_BATCH_SIZE = 800;
const ACTIVE_WITHIN_DAYS = 60;
const SLOWING_WITHIN_DAYS = 120;

let activityCache = { at: 0, key: '', map: new Map() };

/**
 * What the books say per accounts ledger: billed (sales less credit notes, incl. GST) this FY / last FY, the last bill
 * and the bills this FY. Read once and kept 10 minutes.
 */
export async function billedActivityByLedger() {
  const fyStart = financialYearStart();
  const cacheKey = fyStart;
  if (activityCache.key === cacheKey && Date.now() - activityCache.at < ACTIVITY_CACHE_MS) return activityCache.map;
  const from = addYears(fyStart, -1);
  const rows = await q(
    `SELECT d.ledgerId id,
      sum(CASE WHEN v.date >= ? THEN (CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) ELSE 0 END) cy,
      sum(CASE WHEN v.date < ? THEN (CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) ELSE 0 END) ly,
      max(CASE WHEN t.baseType = 'Sales' THEN v.date END) lastBill, count(DISTINCT CASE WHEN t.baseType = 'Sales' AND v.date >= ? THEN v.id END) billsCy
    FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN VoucherDetails d ON d.voucherId = v.id
    WHERE t.baseType IN ('Sales', 'Credit Note') AND v.date >= ? AND coalesce(v.status, '') <> 'Rejected' GROUP BY d.ledgerId`,
    [fyStart, fyStart, fyStart, from],
  );
  const map = new Map(
    rows.map((row) => [
      row.id,
      {
        cy: Math.round(row.cy || 0),
        ly: Math.round(row.ly || 0),
        lastBill: row.lastBill ? String(row.lastBill).slice(0, 10) : null,
        billsCy: row.billsCy || 0,
      },
    ]),
  );
  activityCache = { at: Date.now(), key: cacheKey, map };
  return map;
}

/** The next customer list reads the books again (after customers were loaded from them). */
export function forgetBilledActivity() {
  activityCache.at = 0;
}

/** Every ledger of each customer: the main one (SalesCustomers.ledgerId) and the linked ones. */
export async function ledgersByCustomer(customerIds) {
  const ledgers = new Map();
  if (!customerIds.length) return ledgers;
  for (let start = 0; start < customerIds.length; start += LEDGER_BATCH_SIZE) {
    const idList = customerIds.slice(start, start + LEDGER_BATCH_SIZE).join(',');
    const rows = await q(`SELECT c.id customerId, c.ledgerId, 'MAIN' kind, l.name, g.name groupName
        FROM SalesCustomers c JOIN AccountLedgers l ON l.id = c.ledgerId
        LEFT JOIN AccountGroups g ON g.id = l.groupId WHERE c.id IN (${idList})
        UNION ALL SELECT customerId, ledgerId, kind, NULL, NULL FROM SalesCustomerLedgers WHERE customerId IN (${idList})`);
    for (const row of rows) {
      // a customer whose main ledger is itself a duty account (only duty is billed to it): its billing is reimbursement
      if (row.kind === 'MAIN' && isReimbLedger(row.name, row.groupName)) row.kind = 'REIMB';
      if (!ledgers.has(row.customerId)) ledgers.set(row.customerId, []);
      ledgers.get(row.customerId).push(row);
    }
  }
  return ledgers;
}

/** Billed figures of a customer over all its ledgers: service (main / other) and reimbursement (duty / DO) apart. */
export function sumActivity(ledgers, activity) {
  const totals = { billedCy: 0, billedLy: 0, reimbCy: 0, reimbLy: 0, lastBill: null, billsCy: 0 };
  for (const ledger of ledgers || []) {
    const ledgerActivity = activity.get(ledger.ledgerId);
    if (!ledgerActivity) continue;
    if (ledger.kind === 'REIMB') {
      totals.reimbCy += ledgerActivity.cy;
      totals.reimbLy += ledgerActivity.ly;
    } else {
      totals.billedCy += ledgerActivity.cy;
      totals.billedLy += ledgerActivity.ly;
      totals.billsCy += ledgerActivity.billsCy;
    }
    if (ledgerActivity.lastBill && (!totals.lastBill || ledgerActivity.lastBill > totals.lastBill)) {
      totals.lastBill = ledgerActivity.lastBill;
    }
  }
  return totals;
}

export function activityFlag(lastBill) {
  if (!lastBill) return 'NONE';
  const days = daysBetween(lastBill, today());
  if (days <= ACTIVE_WITHIN_DAYS) return 'ACTIVE';
  return days <= SLOWING_WITHIN_DAYS ? 'SLOWING' : 'DORMANT';
}

function emptyFigures() {
  return {
    months: [],
    billedCy: 0,
    billedLy: 0,
    reimbCy: 0,
    reimbLy: 0,
    lastBill: null,
    billsCy: 0,
    activity: 'NONE',
    dockets: { cy: 0, ly: 0, last: null, byDivision: {} },
    marketingNames: [],
  };
}

function customerLedgerList(ledger, linkedLedgers) {
  const mainLedger = ledger
    ? [{ ledgerId: ledger.id, kind: isReimbLedger(ledger.name, ledger.groupName) ? 'REIMB' : 'MAIN' }]
    : [];
  return [...mainLedger, ...linkedLedgers];
}

function addMonthRow(figures, monthsByKey, row, reimbursementLedgers, fyStart) {
  const amount = Math.round(row.amt || 0);
  const isReimbursement = reimbursementLedgers.has(row.lid);
  const month = monthsByKey.get(row.m) || { month: row.m, billed: 0, reimb: 0, bills: 0 };
  if (isReimbursement) {
    month.reimb += amount;
  } else {
    month.billed += amount;
    month.bills += row.bills;
  }
  monthsByKey.set(row.m, month);
  const isThisYear = `${row.m}-01` >= fyStart;
  if (isReimbursement) {
    if (isThisYear) figures.reimbCy += amount;
    else figures.reimbLy += amount;
  } else if (isThisYear) {
    figures.billedCy += amount;
    figures.billsCy += row.bills;
  } else {
    figures.billedLy += amount;
  }
  if (row.last && (!figures.lastBill || row.last > figures.lastBill)) figures.lastBill = String(row.last).slice(0, 10);
}

async function addBookFigures(figures, ledgers, fyStart, lastFyStart) {
  const reimbursementLedgers = new Set(
    ledgers.filter((ledger) => ledger.kind === 'REIMB').map((ledger) => ledger.ledgerId),
  );
  const ledgerIdList = ledgers.map((ledger) => Number(ledger.ledgerId)).join(',');
  const rows = await q(
    `SELECT d.ledgerId lid, substr(v.date, 1, 7) m, sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) amt,
        count(DISTINCT CASE WHEN t.baseType = 'Sales' THEN v.id END) bills, max(CASE WHEN t.baseType = 'Sales' THEN v.date END) last
      FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
      WHERE d.ledgerId IN (${ledgerIdList}) AND t.baseType IN ('Sales', 'Credit Note') AND coalesce(v.status, '') <> 'Rejected'
        AND v.date >= ? GROUP BY d.ledgerId, m ORDER BY m`,
    [lastFyStart],
  );
  const monthsByKey = new Map();
  for (const row of rows) addMonthRow(figures, monthsByKey, row, reimbursementLedgers, fyStart);
  figures.months = [...monthsByKey.values()].sort((a, b) => a.month.localeCompare(b.month));
  if (!figures.lastBill) {
    const [lastSale] = await q(`SELECT max(v.date) d FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
        JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE d.ledgerId IN (${ledgerIdList}) AND t.baseType = 'Sales'`);
    figures.lastBill = lastSale && lastSale.d ? String(lastSale.d).slice(0, 10) : null;
  }
  figures.activity = activityFlag(figures.lastBill);
}

// dockets (Shipment Registration): the party of the ledger, or the same name as main / billing party
async function addDocketFigures(figures, customer, ledger, fyStart, lastFyStart) {
  const partyId = (ledger && ledger.partyId) || customer.partyId;
  const upperName = String(customer.name || '')
    .trim()
    .toUpperCase();
  const dockets = await queryOrEmpty(
    `SELECT division, docketDate, marketingPerson FROM Shipments
      WHERE coalesce(stage, '') <> 'Cancelled' AND docketDate >= ?
      AND (${partyId ? 'mainPartyId = ? OR ' : ''}upper(trim(mainParty)) = ? OR upper(trim(billingParty)) = ?)`,
    [lastFyStart, ...(partyId ? [partyId] : []), upperName, upperName],
  );
  const docketsByName = new Map();
  for (const docket of dockets) {
    const docketDate = String(docket.docketDate || '').slice(0, 10);
    if (docketDate >= fyStart) {
      figures.dockets.cy++;
      figures.dockets.byDivision[docket.division] = (figures.dockets.byDivision[docket.division] || 0) + 1;
    } else {
      figures.dockets.ly++;
    }
    if (!figures.dockets.last || docketDate > figures.dockets.last) figures.dockets.last = docketDate;
    const marketingPerson = String(docket.marketingPerson || '').trim();
    if (marketingPerson) docketsByName.set(marketingPerson, (docketsByName.get(marketingPerson) || 0) + 1);
  }
  figures.marketingNames = [...docketsByName.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, dockets: count }));
}

/** What the books and the dockets say about this customer. */
export async function customerFigures(customer, ledger, linkedLedgers = []) {
  const figures = emptyFigures();
  const fyStart = financialYearStart();
  const lastFyStart = addYears(fyStart, -1);
  const ledgers = customerLedgerList(ledger, linkedLedgers);
  if (ledgers.length) await addBookFigures(figures, ledgers, fyStart, lastFyStart);
  await addDocketFigures(figures, customer, ledger, fyStart, lastFyStart);
  return figures;
}
