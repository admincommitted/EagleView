// Open receivable / payable items.
//
// The Outstanding report (vouchers) and the Credit Control screen need exactly the same figures with different ageing
// buckets, so both read them from here.
//
// Many receipts in this database carry no bill-wise reference. Such a payment goes to the bill it names, else to a bill
// of the same amount, and the rest is applied oldest-bill-first (FIFO). The basis text says so on every screen.
import { QueryTypes } from 'sequelize';
import { Op } from '../../config/database.js';
import { AccountGroup, AccountLedger, VoucherAllocation, VoucherDetail } from '../../models/index.js';
import * as branchScope from '../../middlewares/branchScope.middleware.js';

const BASIS_FIFO = 'FIFO by voucher date (no bill-wise allocation on these receipts)';
const BASIS_MIXED = 'Bill-wise where the receipt was allocated, FIFO for the rest';
const BASIS_ALLOC = 'Bill-wise, from the allocation recorded on each receipt';
const BASIS_ICAFFE =
  "Bill-wise as in iCAFFE's outstanding report on its date (on-account amounts set against the oldest bills only for receipts after it)";
// kept for callers that only want a label
const BASIS = BASIS_FIFO;
const BASIS_SNAPSHOT_WITH_ALLOCATIONS = '; set-offs made here after that date applied';
const BASIS_MATCHED =
  '; receipts without a set-off go to the bill they name or a bill of the same amount, the rest FIFO';

const PAISA = 0.009;
const SAME_AMOUNT_TOLERANCE = 0.5;
const MIN_BILL_NO_LENGTH = 6;
const DAY_MS = 86400000;
// bill nos named in the narration, e.g. "INV#DL/26/SI/T006", "AGAINST DL/26/AI/0005041"
const BILL_NO_IN_TEXT = /[A-Z]{2,3}\/\d{2}\/[A-Z]{1,4}\/[A-Z]{0,2}\d{2,7}(?![A-Z0-9])/g;

const roundToPaisa = (amount) => Math.round(amount * 100) / 100;
const dayOf = (date) => String(date || '').slice(0, 10);

function pushInto(map, mapKey, value) {
  if (!map.has(mapKey)) map.set(mapKey, []);
  map.get(mapKey).push(value);
}

// the group and everything under it
function groupAndChildren(rootId, allGroups) {
  const ids = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    allGroups.forEach((group) => {
      if (group.parentId && ids.has(group.parentId) && !ids.has(group.id)) {
        ids.add(group.id);
        grew = true;
      }
    });
  }
  return ids;
}

// one plain query for all ledgers, grouped per ledger (a model include is far too slow on the iCAFFE history)
async function loadLedgerLines(ledgerIds, asOn) {
  const rows = await VoucherDetail.sequelize.query(
    `SELECT d.ledgerId, d.dc, d.amount, v.id vid, v.voucherNumber, v.date, v.narration, v.refNo, v.jobNo
           FROM AccountLedgers l CROSS JOIN VoucherDetails d ON d.ledgerId = l.id JOIN Vouchers v ON v.id = d.voucherId
          WHERE l.id IN (${ledgerIds.join(',') || '0'}) AND v.date <= ?`,
    { replacements: [asOn], type: QueryTypes.SELECT },
  );
  const linesByLedger = new Map();
  for (const row of rows) {
    const line = {
      ledgerId: row.ledgerId,
      dc: row.dc,
      amount: row.amount,
      Voucher: {
        id: row.vid,
        voucherNumber: row.voucherNumber,
        date: row.date,
        narration: row.narration,
        refNo: row.refNo,
        jobNo: row.jobNo,
      },
    };
    pushInto(linesByLedger, row.ledgerId, line);
  }
  return linesByLedger;
}

// bill-wise allocations recorded on receipts: used exactly; only the unallocated rest falls back to FIFO
async function loadAllocations(ledgers) {
  const allocations = await VoucherAllocation.findAll({
    where: { ledgerId: { [Op.in]: ledgers.map((ledger) => ledger.id) } },
  });
  const allocationsByLedger = new Map();
  const allocatedVoucherIds = new Set();
  allocations.forEach((allocation) => {
    pushInto(allocationsByLedger, allocation.ledgerId, allocation);
    allocatedVoucherIds.add(allocation.voucherId);
  });
  return { allocationsByLedger, allocatedVoucherIds };
}

// iCAFFE's bill-wise outstanding, read party by party. Where a party has it, its open bills and on-account amounts as at
// that date are taken exactly as iCAFFE shows them; only what happens after that date is worked out here.
async function loadSnapshots(ledgerIds, wantDr) {
  const snapshotsByLedger = new Map();
  try {
    const rows = await VoucherDetail.sequelize.query(
      // a bill shows for the branch of its voucher (the Vouchers read is limited to the branches in scope);
      // a bill with no voucher here (before Apr-2022) belongs with the opening, i.e. the default branch
      `SELECT s.* FROM AccOutstandingSnapshot s LEFT JOIN Vouchers v ON v.id = s.voucherId
              WHERE s.side = ? AND s.ledgerId IN (${ledgerIds.join(',') || '0'}) AND (v.id IS NOT NULL OR (s.voucherId IS NULL AND ${branchScope.openingOn() ? 1 : 0} = 1))
              ORDER BY s.billDate, s.id`,
      { replacements: [wantDr ? 'R' : 'P'], type: QueryTypes.SELECT },
    );
    for (const row of rows) pushInto(snapshotsByLedger, row.ledgerId, row);
  } catch {
    /* no snapshot table yet */
  }
  return snapshotsByLedger;
}

// snapshot rows -> open bills, and the on-account amounts the party has paid in advance
function billsFromSnapshot(snapshot, bills, onAccountSnapshot) {
  for (const row of snapshot) {
    const balance = parseFloat(row.balance) || 0;
    // balance is signed the party's way: + the party owes (receivable Dr / payable Cr), - an advance.
    // An on-account entry that the party owes (a debit note or journal not raised as a bill) is an open item.
    if (row.kind === 'ONACC' && balance < -PAISA) {
      onAccountSnapshot.push(row);
      continue;
    }
    if (balance <= PAISA) continue;
    bills.push({
      date: row.billDate,
      voucherNumber: row.billNo || row.voucherNo || '',
      narration: row.narration || '',
      refNo: row.voucherNo || row.billNo || '',
      jobNo: row.docket || '',
      voucherId: row.voucherId || null,
      amount: balance,
      original: parseFloat(row.amount) || balance,
    });
  }
}

// the opening balance is the oldest open item when it is on the side that owes (opening = default branch only)
function addOpeningBalance(ledger, snapshotDay, wantDr, bills, payments) {
  const opening = snapshotDay || !branchScope.openingOn() ? 0 : parseFloat(ledger.openingBalance || 0);
  if (opening > 0 && ((wantDr && ledger.balanceType === 'Dr') || (!wantDr && ledger.balanceType === 'Cr'))) {
    bills.push({
      date: null,
      voucherNumber: 'Opening balance',
      narration: '',
      refNo: '',
      jobNo: '',
      voucherId: null,
      amount: opening,
    });
  } else if (opening > 0) {
    payments.push({ amount: opening });
  }
}

function addVoucherLines(lines, wantDr, allocatedVoucherIds, bills, payments) {
  const paymentByVoucher = new Map(); // one receipt / note per voucher (a receipt split into TDS + bank lines is one payment)
  lines.forEach((line) => {
    const amount = parseFloat(line.amount) || 0;
    const voucher = line.Voucher || {};
    const increases = wantDr ? line.dc === 'Dr' : line.dc === 'Cr';
    if (increases) {
      bills.push({
        date: voucher.date,
        voucherNumber: voucher.voucherNumber,
        narration: voucher.narration || '',
        refNo: voucher.refNo || '',
        jobNo: voucher.jobNo || '',
        voucherId: voucher.id || null,
        amount,
      });
      return;
    }
    // a receipt that was allocated bill-wise is applied through its allocation, not thrown into the FIFO pool
    if (voucher.id && allocatedVoucherIds.has(voucher.id)) return;
    const paymentKey = voucher.id ? 'v' + voucher.id : 'x' + payments.length;
    if (paymentByVoucher.has(paymentKey)) {
      paymentByVoucher.get(paymentKey).amount += amount;
      return;
    }
    const payment = {
      amount,
      date: voucher.date,
      narration: voucher.narration || '',
      voucherNumber: voucher.voucherNumber || '',
    };
    paymentByVoucher.set(paymentKey, payment);
    payments.push(payment);
  });
}

const refKey = (refNo) => 'r' + String(refNo || '').toUpperCase();

function applyAllocations(allocations, usage) {
  const knockedOff = new Map(); // 'v' + billVoucherId -> amount, and 'r' + refNo -> amount for older rows
  const onAccount = [];
  allocations.forEach((allocation) => {
    const amount = parseFloat(allocation.amount) || 0;
    if (!amount) return;
    usage.allocation = true;
    if (allocation.againstVoucherId) {
      const billKey = 'v' + allocation.againstVoucherId;
      knockedOff.set(billKey, (knockedOff.get(billKey) || 0) + amount);
    } else if (allocation.refNo) {
      const billKey = 'r' + String(allocation.refNo).toUpperCase();
      knockedOff.set(billKey, (knockedOff.get(billKey) || 0) + amount);
    } else {
      onAccount.push(amount); // an advance / on-account receipt behaves like a FIFO payment
    }
  });
  return { knockedOff, onAccount };
}

const knockedOffFor = (knockedOff, bill) =>
  (knockedOff.get('v' + bill.voucherId) || 0) + (knockedOff.get(refKey(bill.refNo)) || 0);

function indexBills(bills) {
  const billsByNo = new Map();
  const billsByAmount = new Map();
  bills.forEach((bill, index) => {
    const billNo = String(bill.voucherNumber || '')
      .toUpperCase()
      .trim();
    if (billNo.length >= MIN_BILL_NO_LENGTH) pushInto(billsByNo, billNo, index);
    pushInto(billsByAmount, Math.round(bill.amount), index);
  });
  return { billsByNo, billsByAmount };
}

// a receipt / credit note goes to the bill it names in its narration
function matchByBillNo(payments, billsByNo, openAmounts, matched, usage) {
  for (const payment of payments) {
    const ownNo = String(payment.voucherNumber || '').toUpperCase();
    for (const namedBillNo of String(payment.narration || '')
      .toUpperCase()
      .match(BILL_NO_IN_TEXT) || []) {
      if (payment.amount <= PAISA || namedBillNo === ownNo) continue;
      for (const index of billsByNo.get(namedBillNo) || []) {
        const free = openAmounts[index] - matched[index];
        if (free <= PAISA) continue;
        const usedAmount = Math.min(free, payment.amount);
        matched[index] += usedAmount;
        payment.amount -= usedAmount;
        usage.match = true;
      }
    }
  }
}

// then to a bill of exactly the same amount, still fully open, dated on or before the receipt
function matchBySameAmount(payments, bills, billsByAmount, openAmounts, matched, usage) {
  for (const payment of payments) {
    if (payment.amount <= PAISA) continue;
    for (const index of billsByAmount.get(Math.round(payment.amount)) || []) {
      const free = openAmounts[index] - matched[index];
      const sameAmount = Math.abs(free - payment.amount) < SAME_AMOUNT_TOLERANCE;
      const stillFullyOpen = Math.abs(bills[index].amount - free) < SAME_AMOUNT_TOLERANCE;
      const datedBefore = !bills[index].date || !payment.date || dayOf(bills[index].date) <= dayOf(payment.date);
      if (sameAmount && stillFullyOpen && datedBefore) {
        matched[index] += payment.amount;
        payment.amount = 0;
        usage.match = true;
        break;
      }
    }
  }
}

// Before FIFO, receipts with no bill-wise reference go to the bill they name, then to a bill of the same amount.
// FIFO alone would set e.g. a receipt that paid one bill in full against an older bill and leave the paid bill open.
function matchPaymentsToBills(bills, payments, knockedOff, usage) {
  const openAmounts = bills.map((bill) =>
    Math.max(0, bill.amount - Math.min(knockedOffFor(knockedOff, bill), bill.amount)),
  );
  const matched = bills.map(() => 0);
  const voucherPayments = payments.filter((payment) => payment.voucherNumber !== undefined);
  if (voucherPayments.length) {
    const { billsByNo, billsByAmount } = indexBills(bills);
    matchByBillNo(voucherPayments, billsByNo, openAmounts, matched, usage);
    matchBySameAmount(voucherPayments, bills, billsByAmount, openAmounts, matched, usage);
  }
  return matched;
}

function dueDateOf(bill, creditDays) {
  if (!bill.date) return null;
  return new Date(new Date(bill.date).getTime() + creditDays * DAY_MS).toISOString().slice(0, 10);
}

function openBillItems(ledger, bills, payments, onAccount, knockedOff, matched, asOn, usage, items) {
  let pool =
    payments.reduce((sum, payment) => sum + payment.amount, 0) + onAccount.reduce((sum, amount) => sum + amount, 0);
  if (pool > PAISA) usage.fifo = true;
  for (let index = 0; index < bills.length; index++) {
    const bill = bills[index];
    const direct = knockedOffFor(knockedOff, bill) + matched[index];
    let used = Math.min(direct, bill.amount);
    // whatever the allocation did not cover is still open to the FIFO pool
    const fromPool = Math.min(pool, bill.amount - used);
    pool -= fromPool;
    used += fromPool;
    const pending = roundToPaisa(bill.amount - used);
    if (pending <= PAISA) continue;
    const creditDays = parseInt(ledger.creditDays, 10) || 0;
    const dueDate = dueDateOf(bill, creditDays);
    const overdueDays = dueDate ? Math.floor((new Date(asOn) - new Date(dueDate)) / DAY_MS) : 0;
    items.push({
      id: ledger.id + '-' + (bill.voucherNumber || '') + '-' + (bill.date || ''),
      ledgerId: ledger.id,
      party: ledger.name,
      refNo: bill.voucherNumber || '',
      billNo: bill.refNo || '',
      jobNo: bill.jobNo || '',
      voucherId: bill.voucherId,
      narration: bill.narration,
      date: bill.date,
      dueDate,
      amount: roundToPaisa(bill.original || bill.amount),
      pending,
      overdueDays,
    });
  }
}

// iCAFFE's on-account amounts (receipts / payments not set against any bill) stay as they are, shown as minus lines, so
// the party total is the same as iCAFFE's; the receipt can still be set off here later
function onAccountItems(ledger, onAccountSnapshot, items) {
  for (const row of onAccountSnapshot) {
    const balance = -roundToPaisa(parseFloat(row.balance) || 0);
    items.push({
      id: ledger.id + '-onacc-' + (row.voucherNo || row.billNo || '') + '-' + (row.billDate || ''),
      ledgerId: ledger.id,
      party: ledger.name,
      refNo: row.voucherNo || row.billNo || 'On account',
      billNo: 'On account',
      jobNo: '',
      voucherId: row.voucherId || null,
      narration: 'On account (not set against a bill in iCAFFE)',
      date: row.billDate,
      dueDate: row.billDate,
      amount: -balance,
      pending: -balance,
      overdueDays: 0,
      onAccount: true,
    });
  }
}

function openItemsOfLedger(ledger, context, usage, items) {
  const { linesByLedger, snapshotsByLedger, allocationsByLedger, allocatedVoucherIds, wantDr, asOn } = context;
  const allLines = linesByLedger.get(ledger.id) || [];
  const snapshot = snapshotsByLedger.get(ledger.id);
  // used only for an as-on date on or after the snapshot's own date
  const snapshotDay =
    snapshot && snapshot.length && dayOf(snapshot[0].asOn) <= asOn ? String(snapshot[0].asOn).slice(0, 10) : null;
  // with a snapshot only the lines after its date count; everything up to it is in the snapshot
  const lines = snapshotDay ? allLines.filter((line) => dayOf((line.Voucher || {}).date) > snapshotDay) : allLines;
  const bills = [];
  const payments = [];
  const onAccountSnapshot = [];
  if (snapshotDay) {
    usage.snapshot = true;
    billsFromSnapshot(snapshot, bills, onAccountSnapshot);
  }
  addOpeningBalance(ledger, snapshotDay, wantDr, bills, payments);
  addVoucherLines(lines, wantDr, allocatedVoucherIds, bills, payments);
  bills.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

  const { knockedOff, onAccount } = applyAllocations(allocationsByLedger.get(ledger.id) || [], usage);
  const matched = matchPaymentsToBills(bills, payments, knockedOff, usage);
  openBillItems(ledger, bills, payments, onAccount, knockedOff, matched, asOn, usage, items);
  onAccountItems(ledger, onAccountSnapshot, items);
}

function basisOf(usage) {
  let basis = usage.allocation && usage.fifo ? BASIS_MIXED : usage.allocation ? BASIS_ALLOC : BASIS_FIFO;
  if (usage.snapshot) basis = BASIS_ICAFFE + (usage.allocation ? BASIS_SNAPSHOT_WITH_ALLOCATIONS : '');
  if (usage.match) basis += BASIS_MATCHED;
  return basis;
}

async function openItems({ type = 'receivable', asOn = null, ledgerId = null } = {}) {
  const on = asOn || new Date().toISOString().slice(0, 10);
  const wantDr = String(type).toLowerCase() !== 'payable'; // debtors carry a Dr balance, creditors a Cr one
  const groupName = wantDr ? 'Sundry Debtors' : 'Sundry Creditors';

  const root = await AccountGroup.findOne({ where: { name: groupName } });
  if (!root)
    return {
      items: [],
      ledgers: [],
      asOn: on,
      basis: BASIS,
      note: 'No "' + groupName + '" group in the chart of accounts yet',
    };

  const groupIds = groupAndChildren(root.id, await AccountGroup.findAll());
  // ledgerId: just that party (the Payment / Receipt screen's due bills)
  const ledgerWhere = ledgerId
    ? { groupId: { [Op.in]: [...groupIds] }, id: Number(ledgerId) }
    : { groupId: { [Op.in]: [...groupIds] } };
  const ledgers = await AccountLedger.findAll({ where: ledgerWhere });
  if (!ledgers.length) return { items: [], ledgers: [], asOn: on, basis: BASIS };

  const ledgerIds = ledgers.map((ledger) => Number(ledger.id)).filter(Number.isFinite);
  const linesByLedger = await loadLedgerLines(ledgerIds, on);
  const { allocationsByLedger, allocatedVoucherIds } = await loadAllocations(ledgers);
  const snapshotsByLedger = await loadSnapshots(ledgerIds, wantDr);

  const context = { linesByLedger, snapshotsByLedger, allocationsByLedger, allocatedVoucherIds, wantDr, asOn: on };
  const usage = { snapshot: false, allocation: false, fifo: false, match: false };
  const items = [];
  for (const ledger of ledgers) openItemsOfLedger(ledger, context, usage, items);
  items.sort((a, b) => b.overdueDays - a.overdueDays);
  return { items, ledgers, asOn: on, basis: basisOf(usage) };
}

function roundBuckets(buckets) {
  Object.keys(buckets).forEach((bucket) => {
    buckets[bucket] = roundToPaisa(buckets[bucket]);
  });
  return buckets;
}

/** The 30 / 60 / 90 buckets used by the Outstanding report. */
function buckets30(items) {
  const buckets = { notDue: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
  items.forEach((item) => {
    if (item.overdueDays <= 0) buckets.notDue += item.pending;
    else if (item.overdueDays <= 30) buckets.days30 += item.pending;
    else if (item.overdueDays <= 60) buckets.days60 += item.pending;
    else if (item.overdueDays <= 90) buckets.days90 += item.pending;
    else buckets.over90 += item.pending;
  });
  return roundBuckets(buckets);
}

// The Credit Control ageing bar. notDue is kept separate from the 0-15 overdue band on purpose: money still within the
// customer's credit days is not a collection problem, and lumping the two together makes a healthy account look overdue.
function buckets15(items) {
  const buckets = { notDue: 0, b15: 0, b30: 0, b60: 0, b90: 0 };
  items.forEach((item) => {
    const days = item.overdueDays;
    if (days <= 0) buckets.notDue += item.pending;
    else if (days <= 15) buckets.b15 += item.pending;
    else if (days <= 30) buckets.b30 += item.pending;
    else if (days <= 60) buckets.b60 += item.pending;
    else buckets.b90 += item.pending;
  });
  return roundBuckets(buckets);
}

export { openItems, buckets30, buckets15, BASIS };
