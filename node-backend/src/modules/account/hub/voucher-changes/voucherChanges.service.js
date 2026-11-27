import { sequelize } from '../../../../config/database.js';
import { checkAllocations, checkLines } from '../../../../utils/common/ledgerGuard.js';
import { invoiceVoucherIds } from '../../gst-invoice/gstInvoice.service.js';
import { runSql, runSqlQuietly, selectRows, selectRowsOrEmpty } from '../shared/hubQuery.service.js';
import { nowIso, round2, toNumber } from '../shared/hubFormat.service.js';
import { ensurePurchaseInfoTable, ensureVoucherAuditTable } from '../shared/hubTables.service.js';
import { voucherSnapshot, writeVoucherAudit } from '../shared/voucherAudit.service.js';
import { badRequest, notFound } from '../shared/hubHttp.js';
import { isMonthClosed } from '../month-closing/monthClosing.service.js';
import { isJobClosed } from '../job-closing/jobClosing.service.js';
import { heldBills } from '../purchase-info/purchaseInfo.service.js';
import { interBranchVoucherIds } from '../inter-branch/interBranch.service.js';

// Modify / Delete / Audit trail (iCAFFE buttons on every voucher screen)

const AMOUNT_TOLERANCE = 0.01;
const MAX_REF_LENGTH = 80;
const MAX_REMARKS_LENGTH = 300;

/** Inter branch and GST invoice vouchers are changed only from their own screens. */
async function assertChangedHere(voucherId) {
  if ((await interBranchVoucherIds()).has(voucherId)) {
    throw badRequest('This voucher belongs to an inter branch transfer - use Inter Branch (accept / return) instead');
  }
  if ((await invoiceVoucherIds()).has(voucherId)) {
    throw badRequest('This voucher is a GST invoice - open it in GST Invoice to modify or void it');
  }
}

async function loadVoucher(voucherId) {
  const voucher = await voucherSnapshot(voucherId);
  if (!voucher) throw notFound('Voucher not found');
  return voucher;
}

const monthOf = (date) => String(date).slice(0, 7);

async function checkMonthsAndJob(before, date, jobNo) {
  if (await isMonthClosed(before.date))
    throw badRequest(
      'Month ' + monthOf(before.date) + ' is closed - re-open it in Month Closing to change this voucher',
    );
  if (await isMonthClosed(date)) throw badRequest('Month ' + monthOf(date) + ' is closed - choose another date');
  if (jobNo && (await isJobClosed(jobNo)))
    throw badRequest('Job ' + jobNo + ' is closed (Job Closing) - re-open it to change this voucher');
}

/** Every line needs an account, a side and an amount, and the voucher must balance; answers the debit total. */
function balancedDebit(details) {
  let debit = 0;
  let credit = 0;
  for (const line of details) {
    if (!line.ledgerId) throw badRequest('Every line needs an account');
    if (!['Dr', 'Cr'].includes(line.dc)) throw badRequest('Dr / Cr missing on a line');
    const amount = toNumber(line.amount);
    if (amount <= 0) throw badRequest('Every line needs an amount');
    if (line.dc === 'Dr') debit += amount;
    else credit += amount;
  }
  if (!details.length || Math.abs(debit - credit) > AMOUNT_TOLERANCE)
    throw badRequest('Debit and credit must be equal');
  return debit;
}

// ledgerGuard refusals (another party's ledger, a set-off against another party) are answered as 400
async function guardAsBadRequest(check) {
  try {
    await check();
  } catch (error) {
    throw badRequest(error.message);
  }
}

// iCAFFE's voucher numbers start again every 1st April (BA/NDL/AE/1523 exists in several years), so a number only has
// to be unique within its financial year; keeping the voucher's own number is always allowed
async function checkVoucherNumberFree(before, voucherNumber, voucherId, date) {
  if (voucherNumber === String(before.voucherNumber || '').trim()) return;
  const day = String(date).slice(0, 10);
  const yearStart = Number(day.slice(5, 7)) < 4 ? Number(day.slice(0, 4)) - 1 : Number(day.slice(0, 4));
  const taken = await selectRows(
    'SELECT id FROM Vouchers WHERE voucherTypeId = ? AND voucherNumber = ? AND id <> ? AND date >= ? AND date <= ?',
    [before.voucherTypeId, voucherNumber, voucherId, yearStart + '-04-01', yearStart + 1 + '-03-31'],
  );
  if (taken.length) throw badRequest('Voucher no ' + voucherNumber + ' is already used in this financial year');
}

// Modify on Receipt / Payment / credit note can also change the bills set off (allocations replaced as sent)
const cleanAllocations = (allocations) =>
  Array.isArray(allocations)
    ? allocations
        .map((allocation) => ({
          ledgerId: Number(allocation.ledgerId),
          againstVoucherId: allocation.againstVoucherId ? Number(allocation.againstVoucherId) : null,
          refNo: allocation.refNo ? String(allocation.refNo).slice(0, MAX_REF_LENGTH) : null,
          refType: String(allocation.refType || 'AGAINST').toUpperCase(),
          amount: round2(toNumber(allocation.amount)),
          amountFcy: allocation.amountFcy != null && allocation.amountFcy !== '' ? Number(allocation.amountFcy) : null,
        }))
        .filter((allocation) => allocation.amount > 0)
    : null;

const heldBillText = (bill) =>
  (bill.billNo || bill.voucherNumber) + (bill.holdReason ? ' (' + bill.holdReason + ')' : '');

async function checkAllocationsAllowed(allocations, details, voucherId, before) {
  if (allocations.some((allocation) => !allocation.ledgerId)) throw badRequest('Every bill set off needs the party');
  if (allocations.some((allocation) => allocation.againstVoucherId === voucherId))
    throw badRequest('A voucher cannot be set off against itself');
  await guardAsBadRequest(() =>
    checkAllocations(
      allocations,
      details.map((line) => line.ledgerId),
      voucherId,
    ),
  );
  if (before.baseType !== 'Payment') return;
  const held = await heldBills(allocations.map((allocation) => allocation.againstVoucherId));
  if (held.length)
    throw badRequest(
      'Payment is on hold for bill ' + held.map(heldBillText).join(', ') + ' - release it in the bill first',
    );
}

const keptOrChanged = (sent, kept) => (sent === undefined ? kept : sent || null);

const detailValues = (voucherId, line, stamp) => [
  voucherId,
  line.ledgerId,
  line.dc,
  round2(line.amount),
  line.costCentreId || null,
  line.currency ? String(line.currency).toUpperCase().slice(0, 3) : null,
  line.roe != null && line.roe !== '' ? Number(line.roe) : null,
  line.amountFcy != null && line.amountFcy !== '' ? Number(line.amountFcy) : null,
  line.remarks ? String(line.remarks).slice(0, MAX_REMARKS_LENGTH) : null,
  stamp,
  stamp,
];

async function replaceAllocations(transaction, voucherId, allocations, stamp) {
  await runSql('DELETE FROM VoucherAllocations WHERE voucherId = ?', [voucherId], transaction);
  for (const allocation of allocations) {
    await runSql(
      'INSERT INTO VoucherAllocations (voucherId, ledgerId, againstVoucherId, refNo, refType, amount, amountFcy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)',
      [
        voucherId,
        allocation.ledgerId,
        allocation.refType === 'AGAINST' ? allocation.againstVoucherId : null,
        allocation.refNo,
        allocation.refType,
        allocation.amount,
        allocation.amountFcy,
        stamp,
        stamp,
      ],
      transaction,
    );
  }
}

// bill-wise set-offs stay only for accounts still on the voucher, and never above the new amount
async function dropAllocationsOfRemovedAccounts(transaction, voucherId, details) {
  const keptLedgers = new Set(details.map((line) => Number(line.ledgerId)));
  const allocations = await selectRowsOrEmpty(
    'SELECT id, ledgerId FROM VoucherAllocations WHERE voucherId = ?',
    [voucherId],
    transaction,
  );
  const dropIds = allocations
    .filter((allocation) => !keptLedgers.has(Number(allocation.ledgerId)))
    .map((allocation) => allocation.id);
  if (dropIds.length)
    await runSql(`DELETE FROM VoucherAllocations WHERE id IN (${dropIds.join(',')})`, [], transaction);
}

async function saveVoucherChanges({
  voucherId,
  before,
  body,
  voucherNumber,
  date,
  jobNo,
  details,
  allocations,
  debit,
  userName,
}) {
  await sequelize.transaction(async (transaction) => {
    const stamp = nowIso();
    await runSql(
      `UPDATE Vouchers SET voucherNumber = ?, date = ?, narration = ?, refNo = ?, jobNo = ?, branchCode = ?, totalAmount = ?, status = 'Pending', rejectionReason = NULL, approvedBy = NULL, updatedAt = ? WHERE id = ?`,
      [
        voucherNumber,
        date,
        keptOrChanged(body.narration, before.narration),
        keptOrChanged(body.refNo, before.refNo),
        jobNo,
        keptOrChanged(body.branchCode, before.branchCode),
        round2(debit),
        stamp,
        voucherId,
      ],
      transaction,
    );
    await runSql('DELETE FROM VoucherDetails WHERE voucherId = ?', [voucherId], transaction);
    for (const line of details) {
      await runSql(
        'INSERT INTO VoucherDetails (voucherId, ledgerId, dc, amount, costCentreId, currency, roe, amountFcy, remarks, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        detailValues(voucherId, line, stamp),
        transaction,
      );
    }
    if (allocations) await replaceAllocations(transaction, voucherId, allocations, stamp);
    await dropAllocationsOfRemovedAccounts(transaction, voucherId, details);
    const after = await voucherSnapshot(voucherId, transaction);
    const allocatedTotal = (after.allocations || []).reduce((sum, allocation) => sum + toNumber(allocation.amount), 0);
    if (allocatedTotal - debit > AMOUNT_TOLERANCE)
      throw badRequest(
        'Bills set off (' + round2(allocatedTotal) + ') are more than the new amount - reduce them first',
      );
    await writeVoucherAudit(transaction, {
      voucherId,
      voucherNumber,
      action: 'MODIFIED',
      byUser: userName,
      before,
      after,
    });
  });
}

/** Modify: header, lines and (when sent) set-offs; the voucher goes back to Pending approval. */
export async function modifyVoucher(voucherId, body, userName) {
  await assertChangedHere(voucherId);
  await ensureVoucherAuditTable();
  const before = await loadVoucher(voucherId);
  const date = body.date || before.date;
  const jobNo = body.jobNo === undefined ? before.jobNo : String(body.jobNo || '').trim() || null;
  await checkMonthsAndJob(before, date, jobNo);
  const details = Array.isArray(body.details) ? body.details : [];
  const debit = balancedDebit(details);
  await guardAsBadRequest(() => checkLines(details.map((line) => line.ledgerId)));
  const voucherNumber = String(body.voucherNumber || before.voucherNumber).trim();
  await checkVoucherNumberFree(before, voucherNumber, voucherId, body.date || before.date);
  const allocations = cleanAllocations(body.allocations);
  if (allocations) await checkAllocationsAllowed(allocations, details, voucherId, before);
  await saveVoucherChanges({
    voucherId,
    before,
    body,
    voucherNumber,
    date,
    jobNo,
    details,
    allocations,
    debit,
    userName,
  });
}

/** Delete: not in a closed month and not while another voucher sets it off; the audit keeps what it was. */
export async function deleteVoucher(voucherId, userName) {
  await assertChangedHere(voucherId);
  await ensureVoucherAuditTable();
  await ensurePurchaseInfoTable();
  const before = await loadVoucher(voucherId);
  if (await isMonthClosed(before.date))
    throw badRequest(
      'Month ' + monthOf(before.date) + ' is closed - re-open it in Month Closing to delete this voucher',
    );
  const settledBy = await selectRowsOrEmpty(
    `SELECT v.voucherNumber FROM VoucherAllocations a JOIN Vouchers v ON v.id = a.voucherId WHERE a.againstVoucherId = ?`,
    [voucherId],
  );
  if (settledBy.length)
    throw badRequest(
      'This bill is set off by ' + settledBy.map((row) => row.voucherNumber).join(', ') + ' - change those first',
    );
  await sequelize.transaction(async (transaction) => {
    await runSqlQuietly('DELETE FROM VoucherAllocations WHERE voucherId = ?', [voucherId], transaction);
    await runSql('DELETE FROM VoucherDetails WHERE voucherId = ?', [voucherId], transaction);
    await runSql('DELETE FROM Vouchers WHERE id = ?', [voucherId], transaction);
    await runSqlQuietly('DELETE FROM AccPurchaseInfo WHERE voucherId = ?', [voucherId], transaction);
    await writeVoucherAudit(transaction, {
      voucherId,
      voucherNumber: before.voucherNumber,
      action: 'DELETED',
      byUser: userName,
      before,
      after: null,
    });
  });
}

const parsedJson = (json) => {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
};

// a snapshot shown as date / number / amount / narration and "ledger Dr amount" lines; null when it cannot be read
function snapshotSummary(json) {
  try {
    const snapshot = JSON.parse(json);
    if (!snapshot) return null;
    return {
      date: snapshot.date,
      voucherNumber: snapshot.voucherNumber,
      amount: snapshot.totalAmount,
      narration: snapshot.narration,
      lines: (snapshot.lines || []).map(
        (line) => (line.ledgerName || line.ledgerId) + ' ' + line.dc + ' ' + line.amount,
      ),
    };
  } catch {
    return null;
  }
}

// a hold / release entry carries only a note, no voucher snapshot
function trailNote(afterJson) {
  const after = parsedJson(afterJson || 'null');
  return after && !after.lines ? after.note || null : null;
}

/** The voucher's audit trail with each change's before / after. */
export async function voucherAuditTrail(voucherId) {
  await ensureVoucherAuditTable();
  const voucher = (
    await selectRows(
      'SELECT id, voucherNumber, createdAt, createdByName, status, updatedAt, approvedBy, rejectionReason FROM Vouchers WHERE id = ?',
      [voucherId],
    )
  )[0];
  const rows = await selectRows(
    'SELECT id, action, byUser, createdAt, beforeJson, afterJson FROM AccVoucherAudit WHERE voucherId = ? ORDER BY id',
    [voucherId],
  );
  return {
    voucher: voucher || null,
    trail: rows.map((row) => ({
      id: row.id,
      action: row.action,
      byUser: row.byUser,
      at: row.createdAt,
      before: snapshotSummary(row.beforeJson),
      after: snapshotSummary(row.afterJson),
      note: trailNote(row.afterJson),
    })),
  };
}
