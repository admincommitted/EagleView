import { badRequest, nowIso, round2, runSql, selectRows, toNumber } from '../shared/invoiceDb.js';
import { CREDIT_NOTE, FOREIGN_POS, KINDS, REIMBURSABLE } from '../shared/invoiceKinds.js';

const BALANCE_TOLERANCE = 0.01;
const MAX_REMARKS_LENGTH = 300;
const ROUND_OFF_LEDGER = 'Round Off';
const REIMBURSEMENT_LEDGER = 'reimbursement of expenses';
const TAX_HEADS = [
  ['igst', 'igstLedgerId', 'IGST'],
  ['cgst', 'cgstLedgerId', 'CGST'],
  ['sgst', 'sgstLedgerId', 'SGST'],
];

function priceLine(line, index, invoice, tax) {
  const qty = toNumber(line.qty) || 1;
  const rate = toNumber(line.rate);
  const discount = toNumber(line.discount);
  const amount = round2(rate * qty - discount);
  const lineRate = toNumber(line.exRate) || 1;
  const inrAmount = round2(amount * lineRate);
  const gstRate = tax.gstOn ? toNumber(line.gstRate) : 0;
  const igstPct = tax.gstOn && !tax.intra ? gstRate : 0;
  const cgstPct = tax.gstOn && tax.intra ? gstRate / 2 : 0;
  return {
    sr: index + 1,
    jobNo: String(line.jobNo || invoice.jobNo || '').trim(),
    containerNo: line.containerNo || '',
    charge: String(line.charge).trim().toUpperCase(),
    sac: line.sac || '',
    unit: line.unit || '',
    qty,
    rate,
    amount,
    discount,
    gstRate,
    igstPct,
    cgstPct,
    sgstPct: cgstPct,
    igst: round2((inrAmount * igstPct) / 100),
    cgst: round2((inrAmount * cgstPct) / 100),
    sgst: round2((inrAmount * cgstPct) / 100),
    currency: line.currency || 'INR',
    exRate: lineRate,
    inrAmount,
    receiptNo: line.receiptNo || '',
    receiptDate: line.receiptDate || '',
    costCentre: line.costCentre || '',
    narration: line.narration || '',
  };
}

const sumOf = (lines, key) => round2(lines.reduce((sum, line) => sum + line[key], 0));

/**
 * The invoice arithmetic, done here whatever the screen sent. GST is CGST + SGST when the place of supply is our
 * state, else IGST; none for exempt, RCM or zero-rated (SEZ / export without payment) bills.
 */
export function computeInvoice(invoice, our) {
  const kind = KINDS[invoice.kind];
  const exRate = toNumber(invoice.exRate) || 1;
  const foreign = invoice.pos === FOREIGN_POS || /foreign/i.test(invoice.posName || '');
  const zeroRated = (invoice.sez || foreign) && /without/i.test(invoice.paymentOption || '');
  const gstOn = kind.gst && !toNumber(invoice.gstExempt) && !zeroRated && !toNumber(invoice.rcm);
  const intra = !foreign && !invoice.sez && String(invoice.pos || '') === our.code;
  const lines = (Array.isArray(invoice.lines) ? invoice.lines : [])
    .filter((line) => String(line.charge || '').trim())
    .map((line, index) => priceLine(line, index, invoice, { gstOn, intra }));
  const grossInr = sumOf(lines, 'inrAmount');
  const igst = sumOf(lines, 'igst');
  const cgst = sumOf(lines, 'cgst');
  const sgst = sumOf(lines, 'sgst');
  const raw = round2(grossInr + igst + cgst + sgst);
  const total = toNumber(invoice.roundOff) === 0 ? raw : Math.round(raw);
  return {
    lines,
    grossInr,
    igst,
    cgst,
    sgst,
    roundOffAmt: round2(total - raw),
    total: round2(total),
    chargeTotal: sumOf(lines, 'amount'),
    exRate,
    totalFcy: exRate !== 1 ? round2(total / exRate) : null,
    intra,
    gstOn,
    foreign,
  };
}

async function gstChargeRow(transaction, name) {
  return (
    (
      await selectRows(
        'SELECT * FROM AccGstCharges WHERE lower(trim(chargeName)) = lower(trim(?)) ORDER BY id LIMIT 1',
        [name],
        transaction,
      ).catch(() => [])
    )[0] || null
  );
}

// iCAFFE rule: a charge posts only to the ledger mapped to it - no ledger is made here
async function incomeLedgerOf(transaction, line) {
  const charge = await gstChargeRow(transaction, line.charge);
  if (charge && charge.ledgerId) return charge.ledgerId;
  throw badRequest(
    'Income ledger is not mapped for charge "' +
      String(line.charge).toUpperCase() +
      '" - map it in Accounts > Masters > MAP CSR Posting (or GST Charges), then save again.',
  );
}

async function reimbursementLedgerOf(transaction, line) {
  const charge = await gstChargeRow(transaction, line.charge);
  if (charge && charge.expenseLedgerId) return charge.expenseLedgerId;
  const fallback = (
    await selectRows(
      `SELECT id FROM AccountLedgers WHERE lower(trim(name)) = '${REIMBURSEMENT_LEDGER}' AND coalesce(isActive, 1) = 1 LIMIT 1`,
      [],
      transaction,
    )
  )[0];
  if (fallback) return fallback.id;
  throw badRequest(
    'Expense ledger is not mapped for reimbursable charge "' +
      String(line.charge).toUpperCase() +
      '" - map it in Accounts > Masters > MAP CSR Posting, then save again.',
  );
}

// tax and round-off ledgers must exist (Accounts > Masters > Ledger Account) - an invoice never makes a ledger
async function existingLedger(transaction, name) {
  const ledger = (
    await selectRows(
      'SELECT id FROM AccountLedgers WHERE lower(trim(name)) = lower(trim(?)) AND coalesce(isActive, 1) = 1 ORDER BY id LIMIT 1',
      [name],
      transaction,
    )
  )[0];
  if (!ledger)
    throw badRequest('Ledger "' + name + '" is not in the accounts - create it in Accounts > Masters > Ledger Account');
  return ledger.id;
}

/**
 * iCAFFE posts GST charge-wise to the heads set on the GST charge (IGST / CGST / SGST account head, e.g.
 * "IGST PAYABLE-18%"); a charge without its head is refused. The same head on several charges is one line.
 */
async function taxLines(transaction, lines, incomeSide) {
  const taxByHead = new Map();
  for (const line of lines) {
    if (!(line.igst || line.cgst || line.sgst)) continue;
    const charge = (await gstChargeRow(transaction, line.charge)) || {};
    for (const [taxKey, headColumn, label] of TAX_HEADS) {
      if (!line[taxKey]) continue;
      const headId = charge[headColumn] ? Number(charge[headColumn]) : null;
      if (!headId) {
        throw badRequest(
          label +
            ' account head is not set for charge "' +
            String(line.charge).toUpperCase() +
            '" - set it in Accounts > Masters > GST Charges, then save again.',
        );
      }
      const key = headId + '|' + label;
      const soFar = taxByHead.get(key) ? taxByHead.get(key).amount : 0;
      taxByHead.set(key, { ledgerId: headId, label, amount: round2(soFar + line[taxKey]) });
    }
  }
  return [...taxByHead.values()].map((head) => ({
    ledgerId: head.ledgerId,
    dc: incomeSide,
    amount: head.amount,
    remarks: head.label,
  }));
}

const lineRemarks = (line) =>
  [line.charge, line.sac ? 'SAC ' + line.sac : '', line.jobNo ? 'Job ' + line.jobNo : '', line.narration]
    .filter(Boolean)
    .join(' - ');

const flippedSide = (side) => (side === 'Dr' ? 'Cr' : 'Dr');

/** Voucher lines of an invoice (Sales) or a credit note (the same lines reversed); they must balance. */
export async function postingLines(transaction, invoice, computed, partyLedgerId) {
  const isCreditNote = invoice.kind === CREDIT_NOTE;
  const incomeSide = isCreditNote ? 'Dr' : 'Cr';
  const partySide = isCreditNote ? 'Cr' : 'Dr';
  const foreignCurrency =
    invoice.currency && invoice.currency !== 'INR'
      ? { currency: invoice.currency, amountFcy: computed.totalFcy, roe: computed.exRate }
      : {};
  const posting = [
    {
      ledgerId: partyLedgerId,
      dc: partySide,
      amount: computed.total,
      remarks: KINDS[invoice.kind].label + ' ' + (invoice.invoiceNo || ''),
      ...foreignCurrency,
    },
  ];
  for (const line of computed.lines) {
    const ledgerId =
      invoice.kind === REIMBURSABLE
        ? await reimbursementLedgerOf(transaction, line)
        : await incomeLedgerOf(transaction, line);
    posting.push({
      ledgerId,
      dc: incomeSide,
      amount: line.inrAmount,
      remarks: lineRemarks(line),
    });
  }
  posting.push(...(await taxLines(transaction, computed.lines, incomeSide)));
  if (computed.roundOffAmt) {
    posting.push({
      ledgerId: await existingLedger(transaction, ROUND_OFF_LEDGER),
      dc: computed.roundOffAmt > 0 === isCreditNote ? 'Dr' : 'Cr',
      amount: Math.abs(computed.roundOffAmt),
      remarks: 'Round off',
    });
  }
  // a negative line (discount bigger than the charge) flips side
  const lines = posting
    .filter((line) => line.amount)
    .map((line) => (line.amount < 0 ? { ...line, dc: flippedSide(line.dc), amount: -line.amount } : line));
  const debit = round2(lines.filter((line) => line.dc === 'Dr').reduce((sum, line) => sum + line.amount, 0));
  const credit = round2(lines.filter((line) => line.dc === 'Cr').reduce((sum, line) => sum + line.amount, 0));
  if (Math.abs(debit - credit) > BALANCE_TOLERANCE)
    throw badRequest('Posting does not balance (' + debit + ' / ' + credit + ')');
  return { lines, amount: debit };
}

export async function writeVoucherDetails(transaction, voucherId, lines) {
  const now = nowIso();
  for (const line of lines) {
    await runSql(
      'INSERT INTO VoucherDetails (voucherId, ledgerId, dc, amount, currency, amountFcy, roe, remarks, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [
        voucherId,
        line.ledgerId,
        line.dc,
        round2(line.amount),
        line.currency || null,
        line.amountFcy || null,
        line.roe || null,
        line.remarks ? String(line.remarks).slice(0, MAX_REMARKS_LENGTH) : null,
        now,
        now,
      ],
      transaction,
    );
  }
}
