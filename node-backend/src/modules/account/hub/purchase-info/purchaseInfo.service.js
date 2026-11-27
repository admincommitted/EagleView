import { runSql, selectRows } from '../shared/hubQuery.service.js';
import { nowIso } from '../shared/hubFormat.service.js';
import { ensurePurchaseInfoTable } from '../shared/hubTables.service.js';
import { writeVoucherAudit } from '../shared/voucherAudit.service.js';
import { badRequest, notFound } from '../shared/hubHttp.js';

const MAX_VENDOR_BILLS = 300;

// Trade Invoice extras kept per voucher in AccPurchaseInfo
const PURCHASE_INFO_KEYS = [
  'kind',
  'desk',
  'billNo',
  'billDate',
  'dueDate',
  'hblNo',
  'mblNo',
  'isSez',
  'sezType',
  'tds1Section',
  'tds1Amount',
  'tds2Section',
  'tds2Amount',
  'againstVoucherId',
  'cnReason',
  'holdPayment',
  'holdReason',
];

const roundToPaisa = (value) => Math.round(value * 100) / 100;

async function assertVoucherExists(voucherId) {
  if (!(await selectRows('SELECT id FROM Vouchers WHERE id = ?', [voucherId])).length)
    throw notFound('Voucher not found');
}

export async function getPurchaseInfo(voucherId) {
  await ensurePurchaseInfoTable();
  return (await selectRows('SELECT * FROM AccPurchaseInfo WHERE voucherId = ?', [voucherId]))[0] || null;
}

/** Saves the bill extras of a purchase voucher (a hold needs its reason, a credit note the bill it is against). */
export async function savePurchaseInfo(voucherId, body, userName) {
  await ensurePurchaseInfoTable();
  await assertVoucherExists(voucherId);
  if (Number(body.holdPayment) && !String(body.holdReason || '').trim())
    throw badRequest('Give the reason for holding the payment');
  if (body.kind === 'cn' && !body.againstVoucherId) throw badRequest('A credit note needs the bill it is against');
  const stamp = nowIso();
  const savedBy = userName || null;
  const values = PURCHASE_INFO_KEYS.map((key) => (body[key] === '' || body[key] === undefined ? null : body[key]));
  const existing = (
    await selectRows('SELECT id, holdPayment FROM AccPurchaseInfo WHERE voucherId = ?', [voucherId])
  )[0];
  const heldBy = Number(body.holdPayment) ? savedBy : null;
  const heldAt = Number(body.holdPayment) ? stamp : null;
  if (existing) {
    await runSql(
      `UPDATE AccPurchaseInfo SET ${PURCHASE_INFO_KEYS.map((key) => key + ' = ?').join(', ')}, holdBy = ?, holdAt = ?, updatedAt = ? WHERE voucherId = ?`,
      [...values, heldBy, heldAt, stamp, voucherId],
    );
    return;
  }
  await runSql(
    `INSERT INTO AccPurchaseInfo (voucherId, ${PURCHASE_INFO_KEYS.join(', ')}, holdBy, holdAt, createdByName, createdAt, updatedAt) VALUES (?, ${PURCHASE_INFO_KEYS.map(() => '?').join(', ')}, ?, ?, ?, ?, ?)`,
    [voucherId, ...values, heldBy, heldAt, savedBy, stamp, stamp],
  );
}

async function auditHoldQuietly(voucherId, voucherNumber, hold, userName, reason) {
  try {
    await writeVoucherAudit(null, {
      voucherId,
      voucherNumber,
      action: hold ? 'PAYMENT HELD' : 'PAYMENT RELEASED',
      byUser: userName,
      before: null,
      after: { note: reason || null },
    });
  } catch {
    // the audit line is extra - the hold stands without it
  }
}

/** Holds (hold = 1, with a reason) or releases the payment of a bill; answers the new hold flag. */
export async function setPaymentHold(voucherId, body, userName) {
  await ensurePurchaseInfoTable();
  const hold = body && Number(body.hold) ? 1 : 0;
  const reason = String((body && body.reason) || '').trim();
  await assertVoucherExists(voucherId);
  const stamp = nowIso();
  const savedBy = userName || null;
  if (!(await selectRows('SELECT id FROM AccPurchaseInfo WHERE voucherId = ?', [voucherId])).length) {
    await runSql(
      'INSERT INTO AccPurchaseInfo (voucherId, kind, createdByName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
      [voucherId, 'bill', savedBy, stamp, stamp],
    );
  }
  await runSql(
    'UPDATE AccPurchaseInfo SET holdPayment = ?, holdReason = ?, holdBy = ?, holdAt = ?, updatedAt = ? WHERE voucherId = ?',
    [hold, hold ? reason : null, savedBy, stamp, stamp, voucherId],
  );
  const { voucherNumber } = (await selectRows('SELECT voucherNumber FROM Vouchers WHERE id = ?', [voucherId]))[0];
  await auditHoldQuietly(voucherId, voucherNumber, hold, savedBy, reason);
  return hold;
}

/** Bills whose payment is held, of one ledger when given. */
export async function listHeldBills(ledgerId) {
  await ensurePurchaseInfoTable();
  return selectRows(
    `SELECT p.voucherId, p.holdReason, p.holdBy, p.holdAt, v.voucherNumber, p.billNo FROM AccPurchaseInfo p JOIN Vouchers v ON v.id = p.voucherId
      WHERE p.holdPayment = 1 ${ledgerId ? 'AND EXISTS (SELECT 1 FROM VoucherDetails d WHERE d.voucherId = p.voucherId AND d.ledgerId = ?)' : ''}`,
    ledgerId ? [ledgerId] : [],
  );
}

/** Used by the payment vouchers: which of these bills have their payment held? ([] when it cannot be read) */
export async function heldBills(ids) {
  try {
    await ensurePurchaseInfoTable();
    const voucherIds = (ids || []).map(Number).filter(Boolean);
    if (!voucherIds.length) return [];
    return await selectRows(
      `SELECT p.voucherId, v.voucherNumber, p.billNo, p.holdReason FROM AccPurchaseInfo p JOIN Vouchers v ON v.id = p.voucherId WHERE p.holdPayment = 1 AND p.voucherId IN (${voucherIds.map(() => '?').join(',')})`,
      voucherIds,
    );
  } catch {
    return [];
  }
}

/** Bills of a vendor, for a credit note: what was billed, what is already credited, what is left. */
export async function listVendorBills(ledgerId) {
  await ensurePurchaseInfoTable();
  const bills = await selectRows(
    `SELECT v.id, v.voucherNumber, v.date, v.refNo, v.jobNo, d.amount, p.billNo, p.billDate, p.hblNo, p.mblNo, p.holdPayment
      FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN VoucherDetails d ON d.voucherId = v.id AND d.ledgerId = ? AND d.dc = 'Cr'
      LEFT JOIN AccPurchaseInfo p ON p.voucherId = v.id WHERE t.baseType = 'Purchase' ORDER BY v.date DESC, v.id DESC LIMIT ${MAX_VENDOR_BILLS}`,
    [ledgerId],
  );
  const credits = await selectRows(
    `SELECT p.againstVoucherId id, sum(d.amount) amt FROM AccPurchaseInfo p JOIN VoucherDetails d ON d.voucherId = p.voucherId AND d.ledgerId = ? AND d.dc = 'Dr'
      WHERE p.kind = 'cn' GROUP BY p.againstVoucherId`,
    [ledgerId],
  );
  const creditedByBill = new Map(credits.map((row) => [row.id, Number(row.amt) || 0]));
  return bills.map((bill) => ({
    ...bill,
    billNo: bill.billNo || bill.refNo,
    credited: roundToPaisa(creditedByBill.get(bill.id) || 0),
    left: roundToPaisa(Number(bill.amount) - (creditedByBill.get(bill.id) || 0)),
  }));
}
