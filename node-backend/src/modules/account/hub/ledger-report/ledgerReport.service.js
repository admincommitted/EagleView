import { VALID_VOUCHER, selectRows } from '../shared/hubQuery.service.js';
import { dayBefore, round2, toNumber, todayIso } from '../shared/hubFormat.service.js';
import { signedOpening } from '../shared/ledgerMovements.service.js';
import { findFinancialYear } from '../shared/financialYear.service.js';
import { notFound } from '../shared/hubHttp.js';

const UNIT_SEPARATOR = String.fromCharCode(31);
const INVOICE_TAG = /INV#\s*([A-Z0-9/-]+)/;

const normalisedText = (text) =>
  String(text || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
const invoiceTagOf = (text) => (INVOICE_TAG.exec(normalisedText(text)) || [])[1] || '';

// As iCAFFE shows it: each account once in Particulars (a bill with two charges has CGST / SGST twice), and the
// line's narration only when it says something the voucher's narration does not (iCAFFE bills carry the same text
// on both, so it printed twice)
function tidyLine(line) {
  line.contra = [
    ...new Set(
      String(line.contra || '')
        .split(UNIT_SEPARATOR)
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ].join(', ');
  if (!line.remarks || !line.narration) return;
  const voucherText = normalisedText(line.narration);
  const lineText = normalisedText(line.remarks);
  const sameText =
    voucherText.includes(lineText) ||
    lineText.includes(voucherText) ||
    (invoiceTagOf(voucherText) && invoiceTagOf(voucherText) === invoiceTagOf(lineText));
  if (!sameText) return;
  if (lineText.length > voucherText.length) line.narration = line.remarks;
  line.remarks = null;
}

async function openingBalance(ledger, from) {
  const before =
    (
      await selectRows(
        `SELECT sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE 0 END) dr, sum(CASE WHEN d.dc = 'Cr' THEN d.amount ELSE 0 END) cr
        FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId WHERE ${VALID_VOUCHER} AND d.ledgerId = ? AND v.date <= ?`,
        [ledger.id, dayBefore(from)],
      )
    )[0] || {};
  return round2(signedOpening(ledger) + toNumber(before.dr) - toNumber(before.cr));
}

const ledgerEntries = (ledgerId, from, to) =>
  selectRows(
    `SELECT v.id, v.date, v.voucherNumber, v.refNo, v.jobNo, v.narration, v.status, t.name typeName, t.baseType, d.dc, d.amount, d.remarks, d.currency, d.amountFcy,
        (SELECT group_concat(l2.name, char(31)) FROM VoucherDetails d2 JOIN AccountLedgers l2 ON l2.id = d2.ledgerId WHERE d2.voucherId = v.id AND d2.ledgerId <> d.ledgerId AND d2.dc <> d.dc) contra
        FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
        WHERE ${VALID_VOUCHER} AND d.ledgerId = ? AND v.date >= ? AND v.date <= ? ORDER BY v.date, v.id, d.id`,
    [ledgerId, from, to],
  );

/** Ledger (Accounts > Reports > Ledger): opening, every entry with the other side and a running balance. */
export async function buildLedgerReport(query) {
  const ledgerId = Number(query.ledgerId);
  const year = await findFinancialYear(query.fyId);
  const from = query.from || year.startDate;
  const to = query.to || todayIso();
  const ledger = (
    await selectRows(
      'SELECT l.*, g.name groupName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId WHERE l.id = ?',
      [ledgerId],
    )
  )[0];
  if (!ledger) throw notFound('Account not found');
  const opening = await openingBalance(ledger, from);
  const lines = await ledgerEntries(ledgerId, from, to);
  lines.forEach(tidyLine);
  let balance = opening;
  let debit = 0;
  let credit = 0;
  const rows = lines.map((line) => {
    const amount = round2(line.amount);
    if (line.dc === 'Dr') {
      debit += amount;
      balance += amount;
    } else {
      credit += amount;
      balance -= amount;
    }
    return {
      ...line,
      amount,
      debit: line.dc === 'Dr' ? amount : 0,
      credit: line.dc === 'Cr' ? amount : 0,
      balance: round2(balance),
    };
  });
  return {
    ledger: {
      id: ledger.id,
      name: ledger.name,
      groupName: ledger.groupName,
      gstin: ledger.gstin,
      pan: ledger.pan,
      address: ledger.address,
      state: ledger.state,
      creditDays: ledger.creditDays,
    },
    from,
    to,
    opening,
    debit: round2(debit),
    credit: round2(credit),
    closing: round2(balance),
    rows,
  };
}
