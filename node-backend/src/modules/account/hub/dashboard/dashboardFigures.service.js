import { VALID_VOUCHER, readRows } from '../shared/hubQuery.service.js';
import { addDaysIso, daysBetween, round2, toNumber, yearMonths } from '../shared/hubFormat.service.js';

// Pieces of the Accounts dashboard (GET /dashboard), each worked out from the year's ledgers and voucher lines.

const AGE_BUCKETS = [
  ['0-30', 0, 30],
  ['31-60', 31, 60],
  ['61-90', 61, 90],
  ['91-180', 91, 180],
  ['180+', 181, 1e9],
];
const DEFAULT_CREDIT_DAYS = 30;
const DUE_SOON_DAYS = 30;
const OLDER_THAN_YEAR_DAYS = 181;
const RECENT_BILLS_DAYS = 400;
const LEDGER_BATCH = 500;
const MAX_PARTIES_LISTED = 300;
const TOP_LISTED = 8;
const PAISA_HALF = 0.005;

/** The twelve months of the year with zero figures, and a lookup by 'YYYY-MM'. */
export function emptyYearMonths(startDate) {
  const months = yearMonths(startDate).map(({ key }) => ({
    m: key,
    sales: 0,
    purchase: 0,
    receipt: 0,
    payment: 0,
    income: 0,
    expense: 0,
    gstOut: 0,
    gstIn: 0,
    tds: 0,
  }));
  return { months, monthByKey: new Map(months.map((month) => [month.m, month])) };
}

/** Voucher count / amount per base type for the year, and sales / purchase / receipt / payment per month. */
export function addVoucherTypeTotals(typeMonthRows, monthByKey) {
  const byType = {};
  for (const row of typeMonthRows) {
    byType[row.baseType] = byType[row.baseType] || { n: 0, amt: 0 };
    byType[row.baseType].n += row.n;
    byType[row.baseType].amt = round2(byType[row.baseType].amt + toNumber(row.amt));
    const month = monthByKey.get(row.m);
    if (!month) continue;
    if (row.baseType === 'Sales') month.sales = round2(month.sales + toNumber(row.amt));
    if (row.baseType === 'Credit Note') month.sales = round2(month.sales - toNumber(row.amt));
    if (row.baseType === 'Purchase') month.purchase = round2(month.purchase + toNumber(row.amt));
    if (row.baseType === 'Debit Note') month.purchase = round2(month.purchase - toNumber(row.amt));
    if (row.baseType === 'Receipt') month.receipt = round2(month.receipt + toNumber(row.amt));
    if (row.baseType === 'Payment') month.payment = round2(month.payment + toNumber(row.amt));
  }
  return byType;
}

// iCAFFE's heads are "CGST PAYABLE-9%" (output, by rate) and "CGST RECEIVABLE 9%" / "IGST RECEVIABLE 18%" (input).
// The plain "IGST PAYABLE" / "CGST PAYABLE" heads without a rate carry the monthly set-off and payment, so they are
// not counted as output tax. EagleView's own "Output ... GST" / "Input ... GST" names still count. TDS deducted is the
// Cr side of a TDS head (deposits are the Dr side).
function taxHeadKind(ledgerName, side) {
  const name = String(ledgerName || '');
  const isGst = /\b(c|s|i|u)?gst\b|\bgst/i.test(name);
  if (isGst && (/output|rcm tax payable/i.test(name) || (/payable/i.test(name) && /\d+(\.\d+)?\s*%/.test(name))))
    return 'gstOut';
  if (isGst && /input|rcm input|rece?i?v(e|i)?able|receviable/i.test(name)) return 'gstIn';
  if (/output|input/i.test(name) && /tax/i.test(name) && !/tds/i.test(name))
    return /output/i.test(name) ? 'gstOut' : 'gstIn';
  if (/tds/i.test(name) && side === 'Cr') return 'tds';
  return null;
}

/**
 * Income / expense per month and per ledger, and GST out / in and TDS deducted for the year (also per month for the
 * GST / TDS due dates). `lines` are the year's lines summed per ledger, side and month.
 */
export function addLedgerLineTotals(lines, ledgerById, monthByKey, { incomeGroups, expenseGroups, taxGroups }) {
  const tax = { gstOut: 0, gstIn: 0, tds: 0 };
  const expenseByLedger = new Map();
  const incomeByLedger = new Map();
  for (const line of lines) {
    const ledger = ledgerById.get(line.ledgerId);
    if (!ledger) continue;
    const month = monthByKey.get(String(line.date).slice(0, 7));
    const amount = toNumber(line.amount);
    const signed = line.dc === 'Dr' ? amount : -amount;
    if (incomeGroups.has(ledger.groupId)) {
      if (month) month.income = round2(month.income - signed);
      incomeByLedger.set(ledger.id, round2((incomeByLedger.get(ledger.id) || 0) - signed));
    }
    if (expenseGroups.has(ledger.groupId)) {
      if (month) month.expense = round2(month.expense + signed);
      expenseByLedger.set(ledger.id, round2((expenseByLedger.get(ledger.id) || 0) + signed));
    }
    if (taxGroups.has(ledger.groupId)) addTaxLine(tax, month, taxHeadKind(ledger.name, line.dc), signed, amount);
  }
  return { tax, expenseByLedger, incomeByLedger };
}

function addTaxLine(tax, month, kind, signed, amount) {
  const before = { ...tax };
  if (kind === 'gstOut') tax.gstOut -= signed;
  else if (kind === 'gstIn') tax.gstIn += signed;
  else if (kind === 'tds') tax.tds += amount;
  if (!month) return;
  month.gstOut = round2(month.gstOut + tax.gstOut - before.gstOut);
  month.gstIn = round2(month.gstIn + tax.gstIn - before.gstIn);
  month.tds = round2(month.tds + tax.tds - before.tds);
}

const idList = (ids) => [...ids].map(Number).filter(Number.isFinite).join(',') || '0';

/**
 * Party bill lines for the ageing (debtors' Dr lines, creditors' Cr lines), latest first per ledger: the bills of the
 * last 400 days, then the earlier bills only of the parties whose balance is older than that.
 */
export async function partyBillLines({ ledgers, balanceOf, debtorGroups, creditorGroups, asOn }) {
  const billSql = (
    extra,
  ) => `SELECT d.ledgerId, d.dc, d.amount, v.date FROM AccountLedgers l CROSS JOIN VoucherDetails d ON d.ledgerId = l.id JOIN Vouchers v ON v.id = d.voucherId
        WHERE ${VALID_VOUCHER} AND v.date <= ? ${extra} AND ((l.groupId IN (${idList(debtorGroups)}) AND d.dc = 'Dr') OR (l.groupId IN (${idList(creditorGroups)}) AND d.dc = 'Cr')) ORDER BY v.date DESC, v.id DESC`;
  const recentFrom = addDaysIso(asOn, -RECENT_BILLS_DAYS);
  const linesByLedger = new Map();
  const addLines = (rows) => {
    for (const row of rows) {
      if (!linesByLedger.has(row.ledgerId)) linesByLedger.set(row.ledgerId, []);
      linesByLedger.get(row.ledgerId).push(row);
    }
  };
  addLines(await readRows(billSql('AND v.date >= ?'), [asOn, recentFrom]));
  const shortLedgerIds = [];
  for (const ledger of ledgers) {
    const side = debtorGroups.has(ledger.groupId) ? 'Dr' : creditorGroups.has(ledger.groupId) ? 'Cr' : null;
    if (!side) continue;
    const balance = balanceOf(ledger) * (side === 'Dr' ? 1 : -1);
    if (balance < PAISA_HALF) continue;
    const recentBilled = (linesByLedger.get(ledger.id) || []).reduce((sum, line) => sum + toNumber(line.amount), 0);
    if (recentBilled < balance - PAISA_HALF) shortLedgerIds.push(Number(ledger.id));
  }
  for (let index = 0; index < shortLedgerIds.length; index += LEDGER_BATCH) {
    const ids = shortLedgerIds
      .slice(index, index + LEDGER_BATCH)
      .filter(Number.isFinite)
      .join(',');
    if (ids) addLines(await readRows(billSql(`AND v.date < ? AND d.ledgerId IN (${ids})`), [asOn, recentFrom]));
  }
  return linesByLedger;
}

function partyAgeing(ledger, balance, bills, side, { asOn, yearStart, buckets }) {
  const creditDays = toNumber(ledger.creditDays) || DEFAULT_CREDIT_DAYS;
  const row = {
    id: ledger.id,
    name: ledger.name,
    balance: round2(balance),
    overdue: 0,
    notDue: 0,
    oldestDays: 0,
    avgDays: 0,
    bills: 0,
    creditDays,
    creditLimit: toNumber(ledger.creditLimit),
    gstin: ledger.gstin || '',
    buckets: AGE_BUCKETS.map(() => 0),
    due30: 0,
  };
  let weighted = 0;
  const put = (amount, age) => {
    const index = AGE_BUCKETS.findIndex(([, from, to]) => age >= from && age <= to);
    row.buckets[index] = round2(row.buckets[index] + amount);
    buckets[index].amount = round2(buckets[index].amount + amount);
    if (age > creditDays) row.overdue = round2(row.overdue + amount);
    else row.notDue = round2(row.notDue + amount);
    if (age <= creditDays && creditDays - age <= DUE_SOON_DAYS) row.due30 = round2(row.due30 + amount);
    row.oldestDays = Math.max(row.oldestDays, age);
    weighted += amount * age;
    row.bills++;
  };
  // the closing balance is set against the latest bills first
  let left = balance;
  for (const bill of bills.filter((line) => line.dc === side)) {
    if (left <= PAISA_HALF) break;
    const take = Math.min(left, toNumber(bill.amount));
    left -= take;
    put(take, daysBetween(bill.date, asOn));
  }
  // what no bill explains is the opening balance: older than the year
  if (left > PAISA_HALF) put(left, Math.max(OLDER_THAN_YEAR_DAYS, daysBetween(yearStart, asOn) + 1));
  row.avgDays = Math.round(weighted / balance);
  return { row, weighted };
}

/** Receivables (side Dr) or payables (side Cr): total, advances, overdue, ageing buckets and the parties. */
export function ageingSide({ ledgers, partyGroups, side, balanceOf, linesByLedger, asOn, yearStart }) {
  const buckets = AGE_BUCKETS.map(([bucket]) => ({ bucket, amount: 0, parties: 0 }));
  const parties = [];
  let advances = 0;
  let advanceParties = 0;
  let total = 0;
  let ageWeighted = 0;
  for (const ledger of ledgers.filter((candidate) => partyGroups.has(candidate.groupId))) {
    const balance = balanceOf(ledger) * (side === 'Dr' ? 1 : -1);
    if (balance < -PAISA_HALF) {
      advances = round2(advances - balance);
      advanceParties++;
      continue;
    }
    if (balance < PAISA_HALF) continue;
    total = round2(total + balance);
    const { row, weighted } = partyAgeing(ledger, balance, linesByLedger.get(ledger.id) || [], side, {
      asOn,
      yearStart,
      buckets,
    });
    ageWeighted += weighted;
    row.buckets.forEach((amount, index) => {
      if (amount) buckets[index].parties++;
    });
    parties.push(row);
  }
  parties.sort((first, second) => second.balance - first.balance);
  const overdue = round2(parties.reduce((sum, party) => sum + party.overdue, 0));
  return {
    total,
    advances,
    advParties: advanceParties,
    overdue,
    notDue: round2(total - overdue),
    due30: round2(parties.reduce((sum, party) => sum + party.due30, 0)),
    overduePct: total ? Math.round((overdue / total) * 1000) / 10 : 0,
    avgDays: total ? Math.round(ageWeighted / total) : 0,
    count: parties.length,
    overdueParties: parties.filter((party) => party.overdue > PAISA_HALF).length,
    buckets,
    parties: parties.slice(0, MAX_PARTIES_LISTED),
    top: parties.slice(0, TOP_LISTED),
    overLimit: parties.filter((party) => party.creditLimit && party.balance > party.creditLimit).length,
  };
}

/** The 8 largest positive heads of a ledger -> amount map, with their names. */
export const topHeads = (amountByLedger, ledgerById) =>
  [...amountByLedger.entries()]
    .filter(([, amount]) => amount > 0)
    .sort((first, second) => second[1] - first[1])
    .slice(0, TOP_LISTED)
    .map(([id, amount]) => ({ id, name: (ledgerById.get(id) || {}).name || '#' + id, amount }));
