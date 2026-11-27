// A bill loaded from iCAFFE carries no place of supply / state / address, and its GST is at bill level only (every
// line shows 0 %). For viewing they are filled in from what is known - nothing is saved:
//   state / place of supply from the party's GSTIN, address from the party branch or the ledger (as on the print),
//   each line's GST % from the GST Charges master, and the bill's own IGST / CGST / SGST shared over the lines so they
//   add up to the bill exactly.
import { round2, selectRows, toNumber } from '../shared/invoiceDb.js';
import { FOREIGN_POS, GST_STATES, OVERSEAS } from '../shared/invoiceKinds.js';

const MASTER_TAX_TOLERANCE = 1;
const TAX_KEYS = ['igst', 'cgst', 'sgst'];

const firstRow = async (sql, replacements) => (await selectRows(sql, replacements).catch(() => []))[0];

const branchAddress = (branch) =>
  branch
    ? [branch.address1, branch.address2, branch.city, branch.pinCode, branch.state, branch.country]
        .filter(Boolean)
        .join(', ')
    : '';
const ledgerAddress = (ledger) =>
  [ledger.address, ledger.pinCode, ledger.state, ledger.country === 'IN' ? 'INDIA' : ledger.country]
    .filter(Boolean)
    .join(', ');

function fillStateAndPlaceOfSupply(invoice, gstin) {
  const stateCode = String(invoice.stateCode || (/^\d\d/.test(gstin) ? gstin.slice(0, 2) : '')).padStart(2, '0');
  if (!invoice.stateCode && /^\d\d$/.test(stateCode) && stateCode !== '00') invoice.stateCode = stateCode;
  if (!invoice.stateName && GST_STATES[invoice.stateCode]) invoice.stateName = GST_STATES[invoice.stateCode];
  if (!invoice.pos && (invoice.kind === OVERSEAS || invoice.stateCode)) {
    invoice.pos = invoice.kind === OVERSEAS ? FOREIGN_POS : invoice.stateCode;
  }
  if (!invoice.posName && invoice.pos)
    invoice.posName = invoice.pos === FOREIGN_POS ? 'Foreign Country' : GST_STATES[invoice.pos] || '';
}

// a party with several GSTINs: the address of the branch with this bill's GSTIN; the ledger's only for the same GSTIN
async function fillAddress(invoice, gstin) {
  if (invoice.address) return;
  const partyBranch = invoice.partyBranchId
    ? await firstRow('SELECT address1, address2, city, state, pinCode, country FROM PartyBranches WHERE id = ?', [
        invoice.partyBranchId,
      ])
    : null;
  const gstinBranch =
    !partyBranch && gstin
      ? await firstRow(
          'SELECT address1, address2, city, state, pinCode, country FROM PartyBranches WHERE upper(trim(gstin)) = ? OR upper(trim(regNo)) = ? ORDER BY id LIMIT 1',
          [gstin, gstin],
        )
      : null;
  const ledger = invoice.ledgerId
    ? await firstRow('SELECT address, state, pinCode, country, gstin FROM AccountLedgers WHERE id = ?', [
        invoice.ledgerId,
      ])
    : null;
  const ledgerFits = ledger && (!gstin || !ledger.gstin || String(ledger.gstin).trim().toUpperCase() === gstin);
  invoice.address =
    [partyBranch, gstinBranch].map(branchAddress).find(Boolean) || (ledgerFits ? ledgerAddress(ledger) : '') || '';
}

async function masterRatesOf(lines) {
  const names = [
    ...new Set(
      lines
        .map((line) =>
          String(line.charge || '')
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean),
    ),
  ];
  const rates = {};
  if (!names.length) return rates;
  const placeholders = names.map(() => '?').join(',');
  for (const table of ['AccGstCharges', 'Charges']) {
    const rows = await selectRows(
      `SELECT upper(trim(chargeName)) n, sacCode, gstRate FROM ${table} WHERE upper(trim(chargeName)) IN (${placeholders})`,
      names,
    ).catch(() => []);
    for (const row of rows) if (!rates[row.n]) rates[row.n] = { rate: toNumber(row.gstRate), sac: row.sacCode || '' };
  }
  return rates;
}

/** Shares each bill-level tax over the lines by weight; the last line takes what is left, so they add up exactly. */
function shareTaxOverLines(lines, billTax, weights) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  for (const key of TAX_KEYS) {
    let left = round2(billTax[key]);
    lines.forEach((line, index) => {
      const share = index === lines.length - 1 ? left : round2((billTax[key] * weights[index]) / totalWeight);
      line[key] = share;
      left = round2(left - share);
    });
  }
}

async function fillLineTaxes(invoice) {
  const lines = invoice.lines || [];
  const billTax = { igst: toNumber(invoice.igst), cgst: toNumber(invoice.cgst), sgst: toNumber(invoice.sgst) };
  const totalTax = billTax.igst + billTax.cgst + billTax.sgst;
  const noLineTax = lines.every((line) => !toNumber(line.igst) && !toNumber(line.cgst) && !toNumber(line.sgst));
  if (!(lines.length && noLineTax && totalTax > 0)) return;
  const masterRates = await masterRatesOf(lines);
  const amountOf = (line) => toNumber(line.inrAmount != null ? line.inrAmount : line.amount);
  const base = lines.map((line) => {
    const master =
      masterRates[
        String(line.charge || '')
          .trim()
          .toUpperCase()
      ];
    return { amount: amountOf(line), rate: master ? master.rate : null, sac: master ? master.sac : '' };
  });
  const taxByMaster = base.reduce((sum, row) => sum + (row.amount * (row.rate || 0)) / 100, 0);
  const taxable = base.reduce((sum, row) => sum + row.amount, 0);
  // the master's rates give the bill's tax: use them; otherwise one effective rate for the bill
  const useMaster = base.every((row) => row.rate != null) && Math.abs(taxByMaster - totalTax) <= MASTER_TAX_TOLERANCE;
  const effectiveRate = taxable ? round2((totalTax / taxable) * 100) : 0;
  shareTaxOverLines(
    lines,
    billTax,
    base.map((row) => row.amount * (useMaster ? row.rate : effectiveRate)),
  );
  lines.forEach((line, index) => {
    let rate;
    if (useMaster) rate = base[index].rate;
    else
      rate = base[index].amount
        ? round2(((toNumber(line.igst) + toNumber(line.cgst) + toNumber(line.sgst)) / base[index].amount) * 100)
        : 0;
    line.gstRate = rate;
    if (billTax.igst) {
      line.igstPct = rate;
      line.cgstPct = 0;
      line.sgstPct = 0;
    } else {
      line.igstPct = 0;
      line.cgstPct = round2(rate / 2);
      line.sgstPct = round2(rate / 2);
    }
    if (!line.sac && base[index].sac) line.sac = base[index].sac;
  });
  invoice.viewNote = useMaster
    ? 'GST % per line from the GST Charges master'
    : "GST shown at the bill's effective rate " + effectiveRate + '%';
}

/** The view of a bill loaded from iCAFFE: missing state, address and line GST filled in, marked view only. */
export async function icaffeView(invoice) {
  const gstin = String(invoice.gstin || '')
    .trim()
    .toUpperCase();
  fillStateAndPlaceOfSupply(invoice, gstin);
  await fillAddress(invoice, gstin);
  await fillLineTaxes(invoice);
  invoice.viewOnly = true;
  return invoice;
}
