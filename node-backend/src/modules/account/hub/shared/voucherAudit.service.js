import { runSql, selectRows, selectRowsOrEmpty } from './hubQuery.service.js';
import { nowIso } from './hubFormat.service.js';
import { ensureVoucherAuditTable } from './hubTables.service.js';

/** The voucher as it stands (header, lines, set-offs) - written to the audit trail before / after a change. */
export async function voucherSnapshot(voucherId, transaction) {
  const voucher = (
    await selectRows(
      'SELECT v.*, t.name typeName, t.baseType FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE v.id = ?',
      [voucherId],
      transaction,
    )
  )[0];
  if (!voucher) return null;
  voucher.lines = await selectRows(
    'SELECT d.ledgerId, l.name ledgerName, d.dc, d.amount, d.currency, d.roe, d.amountFcy, d.remarks, d.costCentreId FROM VoucherDetails d LEFT JOIN AccountLedgers l ON l.id = d.ledgerId WHERE d.voucherId = ? ORDER BY d.id',
    [voucherId],
    transaction,
  );
  voucher.allocations = await selectRowsOrEmpty(
    'SELECT ledgerId, againstVoucherId, refNo, refType, amount FROM VoucherAllocations WHERE voucherId = ?',
    [voucherId],
    transaction,
  );
  return voucher;
}

/** One line of the voucher audit trail (AccVoucherAudit). */
export async function writeVoucherAudit(transaction, { voucherId, voucherNumber, action, byUser, before, after }) {
  await ensureVoucherAuditTable();
  const stamp = nowIso();
  await runSql(
    'INSERT INTO AccVoucherAudit (voucherId, voucherNumber, action, byUser, beforeJson, afterJson, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)',
    [
      voucherId,
      voucherNumber,
      action,
      byUser || null,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      stamp,
      stamp,
    ],
    transaction,
  );
}
