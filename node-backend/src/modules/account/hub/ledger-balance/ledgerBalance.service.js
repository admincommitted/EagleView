import { VALID_VOUCHER, selectRows } from '../shared/hubQuery.service.js';
import { round2, toNumber } from '../shared/hubFormat.service.js';
import { ensureLedgerColumns } from '../shared/ledgerColumns.service.js';
import { signedOpening } from '../shared/ledgerMovements.service.js';
import { notFound } from '../shared/hubHttp.js';

/** One ledger with its current balance (shown next to the bank / party on the voucher screens). */
export async function ledgerWithBalance(ledgerId) {
  await ensureLedgerColumns();
  const ledger = (
    await selectRows(
      'SELECT l.id, l.name, l.openingBalance, l.balanceType, l.gstin, l.state, l.pan, l.creditDays, l.isBlacklisted, l.blacklistReason, l.msmeNo, l.msmeAgreementDays, l.isActive, g.name groupName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId WHERE l.id = ?',
      [ledgerId],
    )
  )[0];
  if (!ledger) throw notFound('Ledger not found');
  const totals =
    (
      await selectRows(
        `SELECT sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE 0 END) dr, sum(CASE WHEN d.dc = 'Cr' THEN d.amount ELSE 0 END) cr FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId WHERE ${VALID_VOUCHER} AND d.ledgerId = ?`,
        [ledger.id],
      )
    )[0] || {};
  const balance = round2(signedOpening(ledger) + toNumber(totals.dr) - toNumber(totals.cr));
  return { ...ledger, balance: Math.abs(balance), side: balance < 0 ? 'Cr' : 'Dr' };
}
