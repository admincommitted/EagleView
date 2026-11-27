// Provisional Sheet (iCAFFE "Provisional Sheet" / cost sheet of a docket): what the docket should be billed - the
// saved sheet if there is one, else a proposal from the customer's contract, the Sales quotation of the job, the
// charge rules for its mode and the costs already booked on it - each line with what has been billed so far.
import { buildContractBilling } from '../../contract-billing/contractBilling.service.js';
import {
  badRequest,
  ensureInvoiceTables,
  nowIso,
  parseJsonList,
  round2,
  runSql,
  selectRows,
  toNumber,
} from '../shared/invoiceDb.js';
import { CREDIT_NOTE } from '../shared/invoiceKinds.js';

const DEFAULT_GST_RATE = 18;
const QUOTE_RATE_PRECISION = 10000;
// a purchase line of a receipted charge reads "Rec <charge> SAC ..."
const RECEIPTED_CHARGE = /^Rec\s+(.+?)\s+SAC/i;

const upperKey = (value) => String(value).toUpperCase();
const firstRow = async (sql, replacements) => (await selectRows(sql, replacements).catch(() => []))[0];

async function jobOf(jobNo) {
  const shipment = await firstRow(
    `SELECT docketNo jobNo, docketDate jobDate, grossWeight, pkgs totalPackages, division, mainParty party FROM Shipments
      WHERE upper(trim(docketNo)) = upper(?) LIMIT 1`,
    [jobNo],
  );
  if (shipment) {
    return {
      ...shipment,
      mode: /^A/.test(shipment.division) ? 'AIR' : 'SEA',
      dir: /I$/.test(shipment.division) ? 'Import' : 'Export',
    };
  }
  const exportJob = await firstRow(
    `SELECT jobNo, jobDate, grossWeight, totalPackages, shipmentMode mode, shipperName party, 'Export' dir FROM ExportJobs
      WHERE upper(trim(jobNo)) = upper(?) LIMIT 1`,
    [jobNo],
  );
  if (exportJob) return exportJob;
  return (
    (await firstRow(
      `SELECT jobNo, jobDate, shipmentMode mode, nameOfImporter party, 'Import' dir FROM ImportJobs
      WHERE upper(trim(jobNo)) = upper(?) LIMIT 1`,
      [jobNo],
    )) || null
  );
}

/** What has been billed on the docket so far, by charge (credit notes take it back). */
async function billedOn(jobNo) {
  const billed = new Map();
  const invoices = await selectRows(
    "SELECT kind, jobNo, linesJson FROM AccSalesInvoices WHERE coalesce(status, '') <> 'Void' AND (upper(jobNo) = upper(?) OR linesJson LIKE ?)",
    [jobNo, '%' + jobNo + '%'],
  );
  for (const invoice of invoices) {
    for (const line of parseJsonList(invoice.linesJson)) {
      if (String(line.jobNo || invoice.jobNo || '').toUpperCase() !== String(jobNo).toUpperCase()) continue;
      const charge = upperKey(line.charge);
      const sign = invoice.kind === CREDIT_NOTE ? -1 : 1;
      billed.set(charge, round2((billed.get(charge) || 0) + sign * toNumber(line.inrAmount)));
    }
  }
  return billed;
}

/**
 * Costs booked on the docket, by Accounts GST charge: the receipted charge named on the purchase line, else the GST
 * charge whose expense ledger it is, else the ledger name. Receipted ones are marked.
 */
async function costsBookedOn(jobNo) {
  const costs = new Map();
  const receipted = new Set();
  const chargeByExpenseLedger = new Map();
  const expenseCharges = await selectRows(
    'SELECT chargeName, expenseLedgerId FROM AccGstCharges WHERE expenseLedgerId IS NOT NULL AND coalesce(isActive, 1) = 1 ORDER BY id',
  ).catch(() => []);
  for (const charge of expenseCharges) {
    if (!chargeByExpenseLedger.has(charge.expenseLedgerId))
      chargeByExpenseLedger.set(charge.expenseLedgerId, upperKey(charge.chargeName));
  }
  const lines = await selectRows(
    `SELECT d.amount, d.dc, d.remarks, l.id ledgerId, l.name ledger, g.nature FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
      JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN AccountLedgers l ON l.id = d.ledgerId LEFT JOIN AccountGroups g ON g.id = l.groupId
      WHERE upper(trim(v.jobNo)) = ? AND coalesce(v.status, '') <> 'Rejected' AND t.baseType IN ('Purchase', 'Payment', 'Journal', 'Debit Note')`,
    [jobNo],
  );
  for (const line of lines) {
    if (line.nature !== 'Expenses') continue;
    const receiptedCharge = String(line.remarks || '').match(RECEIPTED_CHARGE);
    const charge = (receiptedCharge ? receiptedCharge[1] : chargeByExpenseLedger.get(line.ledgerId) || line.ledger)
      .toUpperCase()
      .trim();
    if (receiptedCharge) receipted.add(charge);
    costs.set(charge, round2((costs.get(charge) || 0) + (line.dc === 'Dr' ? 1 : -1) * toNumber(line.amount)));
  }
  return { costs, receipted };
}

const hasCharge = (lines, charge) => lines.some((line) => line.charge === charge);

// a quotation line can carry a minimum or a % basis: the quoted amount is what is billed, so the rate is that amount
// over the quantity
async function quotationLines(jobNo, lines) {
  const quotationNo =
    ((await firstRow('SELECT quotationNo FROM Shipments WHERE upper(trim(docketNo)) = ? LIMIT 1', [jobNo])) || {})
      .quotationNo || '';
  const quoteKey = String(quotationNo).trim().toUpperCase();
  const quotation = await firstRow(
    "SELECT id, quoteNo FROM Quotations WHERE upper(trim(jobNo)) = ? OR (? <> '' AND upper(trim(quoteNo)) = ?) ORDER BY id DESC LIMIT 1",
    [jobNo, quoteKey, quoteKey],
  );
  if (!quotation) return;
  const charges = await selectRows('SELECT * FROM QuotationCharges WHERE quotationId = ? ORDER BY sortOrder, id', [
    quotation.id,
  ]).catch(() => []);
  for (const charge of charges) {
    if (hasCharge(lines, upperKey(charge.head))) continue;
    const qty = toNumber(charge.qty) || 1;
    const effectiveRate = (amount, rate) =>
      toNumber(amount) > 0
        ? Math.round((toNumber(amount) / qty) * QUOTE_RATE_PRECISION) / QUOTE_RATE_PRECISION
        : toNumber(rate);
    lines.push({
      charge: upperKey(charge.head),
      currency: charge.currency || 'INR',
      exRate: toNumber(charge.roe) || 1,
      qty,
      buyRate: effectiveRate(charge.buyAmount, charge.buyRate),
      sellRate: effectiveRate(charge.sellAmount, charge.sellRate),
      basis: charge.basis || '',
      from: 'Quotation ' + quotation.quoteNo,
    });
  }
}

// the general charge rules, only when the customer has no contract
async function chargeRuleLines(job, lines) {
  const mode = job ? (/sea/i.test(job.mode || '') ? 'SEA ' : 'AIR ') + String(job.dir).toUpperCase() : '';
  const rules = await selectRows(
    'SELECT chargeName, basis, rate, minAmount, currency, mode FROM AccChargeRules WHERE coalesce(isActive, 1) = 1',
  ).catch(() => []);
  for (const rule of rules) {
    const ruleMode = String(rule.mode || 'ALL').toUpperCase();
    if (
      ruleMode !== 'ALL' &&
      ruleMode !== mode &&
      !(ruleMode === 'CUSTOMS' && /customs|clearance/i.test(rule.chargeName))
    )
      continue;
    if (hasCharge(lines, upperKey(rule.chargeName))) continue;
    const qty = /KG/i.test(rule.basis || '') ? toNumber(job && job.grossWeight) || 1 : 1;
    const sell = Math.max(toNumber(rule.rate) * qty, toNumber(rule.minAmount)) / qty;
    lines.push({
      charge: upperKey(rule.chargeName),
      currency: rule.currency || 'INR',
      exRate: 1,
      qty,
      buyRate: 0,
      sellRate: round2(sell),
      basis: rule.basis || '',
      from: 'Charge rule',
    });
  }
}

// receipted charges at the cost booked; other costs too, but unticked when a contract sets the rates
function costLines(costs, receipted, contract, lines) {
  for (const [charge, cost] of costs) {
    if (hasCharge(lines, charge)) continue;
    const isReceipted = receipted.has(charge);
    lines.push({
      charge,
      currency: 'INR',
      exRate: 1,
      qty: 1,
      buyRate: cost,
      sellRate: cost,
      basis: isReceipted ? 'At actual cost' : '',
      from: isReceipted ? 'Receipted - at cost' : 'Cost booked',
      receipted: isReceipted,
      optional: !!contract && !isReceipted,
      note: contract && !isReceipted ? 'cost booked - not in the contract' : '',
    });
  }
}

async function proposedLines({ jobNo, job, contractBilling, contract, costs, receipted }) {
  const lines = [];
  if (contractBilling && contractBilling.lines) lines.push(...contractBilling.lines);
  await quotationLines(jobNo, lines);
  if (!contract) await chargeRuleLines(job, lines);
  costLines(costs, receipted, contract, lines);
  return lines;
}

const inrOf = (rate, line) => round2(toNumber(rate) * (toNumber(line.qty) || 1) * (toNumber(line.exRate) || 1));

// SAC / GST from the charge master, with cost, billed and still to bill
async function linesWithAmounts(lines, costs, billed) {
  const chargeMaster = new Map(
    (await selectRows('SELECT chargeName, sacCode, gstRate FROM AccGstCharges').catch(() => [])).map((charge) => [
      upperKey(charge.chargeName),
      charge,
    ]),
  );
  const sheetLines = lines.map((line) => {
    const master = chargeMaster.get(line.charge) || {};
    const sellInr = inrOf(line.sellRate, line);
    return {
      sac: master.sacCode || '',
      gstRate: master.gstRate != null ? toNumber(master.gstRate) : DEFAULT_GST_RATE,
      ...line,
      sellInr,
      buyInr: inrOf(line.buyRate, line),
      actualCost: costs.get(line.charge) || 0,
      billed: billed.get(line.charge) || 0,
      toBill: round2(sellInr - (billed.get(line.charge) || 0)),
      notGst: !chargeMaster.has(String(line.charge || '').toUpperCase()),
    };
  });
  for (const [charge, amount] of billed) {
    if (hasCharge(sheetLines, charge)) continue;
    sheetLines.push({
      charge,
      currency: 'INR',
      exRate: 1,
      qty: 1,
      buyRate: 0,
      sellRate: 0,
      sellInr: 0,
      buyInr: 0,
      actualCost: costs.get(charge) || 0,
      billed: amount,
      toBill: round2(-amount),
      from: 'Billed, not on the sheet',
    });
  }
  return sheetLines;
}

// the customer's contract (Customer Contract & Quotation Master) - shown even on a saved sheet
async function contractBillingOf(jobNo, costs, notes) {
  try {
    return await buildContractBilling(selectRows, jobNo, costs);
  } catch (error) {
    notes.push('Contract rates could not be read: ' + error.message);
    return null;
  }
}

export async function provisionalSheet(jobNoText) {
  await ensureInvoiceTables();
  const jobNo = String(jobNoText || '')
    .trim()
    .toUpperCase();
  if (!jobNo) throw badRequest('Docket no is required');
  const job = await jobOf(jobNo);
  const saved = (await selectRows('SELECT * FROM AccProvisionalSheets WHERE upper(jobNo) = ?', [jobNo]))[0] || null;
  const billed = await billedOn(jobNo);
  const { costs, receipted } = await costsBookedOn(jobNo);
  let notes = [];
  const contractBilling = await contractBillingOf(jobNo, costs, notes);
  let contract = null;
  if (contractBilling) {
    contract = contractBilling.contract;
    notes = notes.concat(contractBilling.notes || []);
  }
  const lines = saved
    ? parseJsonList(saved.linesJson)
    : await proposedLines({
        jobNo,
        job,
        contractBilling,
        contract,
        costs,
        receipted,
      });
  const sheetLines = await linesWithAmounts(lines, costs, billed);
  return {
    jobNo,
    job,
    source: saved ? 'saved' : 'proposed',
    contract,
    notes,
    savedBy: saved ? saved.modifiedBy || saved.createdBy : '',
    savedAt: saved ? saved.updatedAt : '',
    remarks: saved ? saved.remarks : '',
    lines: sheetLines,
    totals: {
      buy: round2(sheetLines.reduce((sum, line) => sum + line.buyInr, 0)),
      sell: round2(sheetLines.reduce((sum, line) => sum + line.sellInr, 0)),
      cost: round2([...costs.values()].reduce((sum, cost) => sum + cost, 0)),
      billed: round2([...billed.values()].reduce((sum, amount) => sum + amount, 0)),
    },
  };
}

const sheetLineOf = (line) => ({
  charge: String(line.charge).trim().toUpperCase(),
  sac: line.sac || '',
  gstRate: toNumber(line.gstRate),
  currency: line.currency || 'INR',
  exRate: toNumber(line.exRate) || 1,
  qty: toNumber(line.qty) || 1,
  buyRate: toNumber(line.buyRate),
  sellRate: toNumber(line.sellRate),
  basis: line.basis || '',
  from: line.from || '',
});

export async function saveProvisionalSheet(body, userName) {
  await ensureInvoiceTables();
  const sheet = body || {};
  const jobNo = String(sheet.jobNo || '')
    .trim()
    .toUpperCase();
  if (!jobNo) throw badRequest('Docket no is required');
  const lines = (Array.isArray(sheet.lines) ? sheet.lines : [])
    .filter((line) => String(line.charge || '').trim())
    .map(sheetLineOf);
  const now = nowIso();
  const existing = (await selectRows('SELECT id FROM AccProvisionalSheets WHERE upper(jobNo) = ?', [jobNo]))[0];
  if (existing) {
    await runSql(
      'UPDATE AccProvisionalSheets SET linesJson = ?, remarks = ?, partyName = ?, modifiedBy = ?, updatedAt = ? WHERE id = ?',
      [JSON.stringify(lines), sheet.remarks || null, sheet.partyName || null, userName || null, now, existing.id],
    );
  } else {
    await runSql(
      'INSERT INTO AccProvisionalSheets (jobNo, partyName, linesJson, remarks, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)',
      [jobNo, sheet.partyName || null, JSON.stringify(lines), sheet.remarks || null, userName || null, now, now],
    );
  }
  return { ok: true, lines: lines.length };
}
