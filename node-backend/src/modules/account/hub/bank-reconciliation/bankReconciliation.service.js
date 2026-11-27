import { VALID_VOUCHER, selectRows } from '../shared/hubQuery.service.js';
import { round2, toNumber, todayIso } from '../shared/hubFormat.service.js';
import { signedOpening } from '../shared/ledgerMovements.service.js';
import { notFound } from '../shared/hubHttp.js';

// Bank Reconciliation: one bank / cash ledger - the lines of the period plus every older line not yet cleared by the
// bank on the "to" date, with the cheque / ref no and the other side of the voucher. Book balance, cheques issued but
// not presented and deposits not yet credited give the balance the bank statement should show. Clearing is saved per
// line (VoucherDetails.clearanceDate) through POST /api/vouchers/brs/reconcile.

async function bookBalanceChange(ledgerId, condition, replacements) {
  const row = (
    await selectRows(
      `SELECT coalesce(sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END), 0) n FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId WHERE ${VALID_VOUCHER} AND d.ledgerId = ? AND ${condition}`,
      [ledgerId, ...replacements],
    )
  )[0];
  return toNumber(row.n);
}

const bankLines = (ledgerId, from, to) =>
  selectRows(
    `SELECT d.id, d.voucherId, d.dc, d.amount, d.clearanceDate, d.remarks, v.date, v.voucherNumber, v.refNo, v.narration, t.name typeName,
        (SELECT l2.name FROM VoucherDetails d2 JOIN AccountLedgers l2 ON l2.id = d2.ledgerId WHERE d2.voucherId = v.id AND d2.ledgerId <> d.ledgerId ORDER BY d2.amount DESC LIMIT 1) party
      FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
      WHERE ${VALID_VOUCHER} AND d.ledgerId = ? AND v.date <= ? AND (v.date >= ? OR d.clearanceDate IS NULL OR d.clearanceDate = '' OR d.clearanceDate > ?)
      ORDER BY v.date, v.id`,
    [ledgerId, to, from, to],
  );

const sumOf = (lines) => round2(lines.reduce((sum, line) => sum + toNumber(line.amount), 0));

/** Book balance, open items and the balance as per bank for a bank ledger over from..to (default: this month). */
export async function bankReconciliation(query) {
  const ledgerId = Number(query.ledgerId);
  const ledger = (
    await selectRows('SELECT id, name, openingBalance, balanceType FROM AccountLedgers WHERE id = ?', [ledgerId])
  )[0];
  if (!ledger) throw notFound('Ledger not found');
  const to = String(query.to || todayIso()).slice(0, 10);
  const from = String(query.from || to.slice(0, 8) + '01').slice(0, 10);
  const opening = round2(signedOpening(ledger) + (await bookBalanceChange(ledgerId, 'v.date < ?', [from])));
  const closing = round2(signedOpening(ledger) + (await bookBalanceChange(ledgerId, 'v.date <= ?', [to])));
  const lines = await bankLines(ledgerId, from, to);
  const notCleared = (line) => !line.clearanceDate || String(line.clearanceDate).slice(0, 10) > to;
  const notPresented = sumOf(lines.filter((line) => line.dc === 'Cr' && notCleared(line)));
  const notCredited = sumOf(lines.filter((line) => line.dc === 'Dr' && notCleared(line)));
  return {
    ledger: { id: ledger.id, name: ledger.name },
    from,
    to,
    opening,
    closing,
    notPresented,
    notCredited,
    asPerBank: round2(closing + notPresented - notCredited),
    rows: lines.map((line) => ({
      ...line,
      amount: round2(line.amount),
      clearanceDate: line.clearanceDate ? String(line.clearanceDate).slice(0, 10) : null,
      older: line.date < from,
    })),
  };
}
