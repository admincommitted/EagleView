import { VALID_VOUCHER, selectRows, selectRowsOrEmpty } from '../../shared/hubQuery.service.js';
import { nearestOf, round2, toNumber, todayIso } from '../../shared/hubFormat.service.js';
import { loadGroupTree, natureGroupIds } from '../../shared/groupTree.service.js';
import { voucherLines } from '../voucherLines.service.js';
import { divisionOfJob, jobColumns, loadJobDetails, salesPersonLookup } from '../jobDetails.service.js';
import {
  CGST_LEDGER,
  IGST_LEDGER,
  SGST_LEDGER,
  gstAmountOf,
  ledgerColumnKey,
  partyMatches,
  salesBaseTypes,
  sortedLedgerColumns,
} from '../reportHelpers.service.js';

const EARLIEST_DATE = '2000-01-01';
const DEFAULT_GST_SLAB = 18;
const GST_SLABS = [0, 5, 12, 18, 28];
const GST_SPLIT_RATES = [0.25, 1.5, 2.5, 3, 5, 6, 9, 12, 14, 18, 28];
const HALF_RUPEE = 0.5;
const ROUNDING_GAP = 1;
const PAISA = 0.009;

/** A credit note reverses the bill: income on the Dr side, amounts negative. */
const saleSides = (voucher) => ({
  sign: voucher.baseType === 'Credit Note' ? -1 : 1,
  incomeSide: voucher.baseType === 'Credit Note' ? 'Dr' : 'Cr',
});

const signedIncome = (line, { sign, incomeSide }) =>
  round2(sign * (line.dc === incomeSide ? line.amount : -line.amount));

const gstSplit = (tax, sign) => ({
  cgst: round2(sign * gstAmountOf(tax, CGST_LEDGER)),
  sgst: round2(sign * gstAmountOf(tax, SGST_LEDGER)),
  igst: round2(sign * gstAmountOf(tax, IGST_LEDGER)),
});

// BRO: export shipping bills against the money received for the job
export async function bro(params) {
  const jobs = await selectRowsOrEmpty(
    `SELECT jobNo, jobDate, sbNo, sbDate, shipperName, consigneeName, currency, invoiceValue, fobRs FROM ExportJobs WHERE coalesce(sbDate, jobDate) >= ? AND coalesce(sbDate, jobDate) <= ? ORDER BY coalesce(sbDate, jobDate)`,
    [params.from, params.to],
  );
  const receipts = await selectRowsOrEmpty(
    `SELECT v.jobNo, sum(v.totalAmount) amt FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE ${VALID_VOUCHER} AND t.baseType = 'Receipt' AND v.jobNo IS NOT NULL GROUP BY v.jobNo`,
  );
  const receivedByJob = new Map(receipts.map((row) => [row.jobNo, toNumber(row.amt)]));
  const rows = jobs
    .map((job) => ({
      ...job,
      fobRs: round2(job.fobRs),
      invoiceValue: round2(job.invoiceValue),
      realised: round2(receivedByJob.get(job.jobNo) || 0),
    }))
    .map((job) => ({ ...job, balance: round2(job.fobRs - job.realised) }));
  return {
    columns: [
      ['jobNo', 'Job No'],
      ['sbNo', 'SB No'],
      ['sbDate', 'SB Date', 'date'],
      ['shipperName', 'Exporter'],
      ['consigneeName', 'Consignee'],
      ['currency', 'Cur'],
      ['invoiceValue', 'Invoice Value', 'money'],
      ['fobRs', 'FOB (INR)', 'money'],
      ['realised', 'Realised (INR)', 'money'],
      ['balance', 'Balance', 'money'],
    ],
    rows,
    totals: ['fobRs', 'realised', 'balance'],
  };
}

// Sales Register (iCAFFE, GST print): bill + job details, one column per charge, CGST / SGST / IGST, charge total
export async function salesRegister(params) {
  const { vs: entries } = await voucherLines(salesBaseTypes(params.billType), params.from, params.to, {
    jobNo: params.jobNo,
  });
  const salesPersonOf = await salesPersonLookup();
  const chargeNames = new Map();
  const rows = [];
  for (const { v, party, tax, other, fcy, job } of entries) {
    if (!partyMatches(party, params.party)) continue;
    const sides = saleSides(v);
    const row = {
      _v: v.id,
      _b: v.baseType,
      billNo: v.voucherNumber,
      date: v.date,
      jobNo: v.jobNo || '',
      ...jobColumns(job, v.jobNo),
      branch: v.branchCode || (job && job.branch) || '',
      party: party ? party.ledgerName : '',
      gstin: party ? party.gstin || '' : '',
      currency: fcy ? fcy.currency : 'INR',
      typeName: v.typeName,
      salesPerson: salesPersonOf(job, party && party.ledgerId),
    };
    let chargeTotal = 0;
    for (const line of other) {
      const key = ledgerColumnKey(line);
      const amount = signedIncome(line, sides);
      row[key] = round2((row[key] || 0) + amount);
      chargeTotal += amount;
      if (!chargeNames.has(key)) chargeNames.set(key, line.ledgerName);
    }
    Object.assign(row, gstSplit(tax, sides.sign));
    row.totalGst = round2(row.cgst + row.sgst + row.igst);
    row.chargeTotal = round2(chargeTotal);
    row.total = round2(sides.sign * (party ? party.amount : toNumber(v.totalAmount)));
    rows.push(row);
  }
  const chargeColumns = sortedLedgerColumns(chargeNames, 'Charges');
  return {
    subtitle: 'Sales Register',
    note: "Sales person: the docket's marketing person, else the customer's KAM (Sales > Customers). IRN is not kept in EagleView yet",
    columns: [
      ['billNo', 'Bill No'],
      ['date', 'Date', 'date'],
      ['jobNo', 'Docket No'],
      ['jobType', 'Job Type'],
      ['branch', 'Branch Name'],
      ['division', 'Division Name'],
      ['mawb', 'MAWB/BL No'],
      ['hawb', 'HAWB/HBL No'],
      ['party', 'Party Name'],
      ['gstin', 'Party GSTN No.'],
      ['salesPerson', 'Sales Person'],
      ['currency', 'Currency'],
      ['total', 'Total', 'money'],
      ['totalGst', 'Total GST', 'money'],
      ...chargeColumns,
      ['cgst', 'CGST', 'money'],
      ['sgst', 'SGST', 'money'],
      ['igst', 'IGST', 'money'],
      ['chargeTotal', 'Charge Total', 'money'],
    ],
    rows,
    totals: ['total', 'totalGst', ...chargeColumns.map((column) => column[0]), 'cgst', 'sgst', 'igst', 'chargeTotal'],
  };
}

async function invoiceItemTotalsByVoucher(voucherIds) {
  if (!voucherIds.length) return new Map();
  const items =
    await selectRowsOrEmpty(`SELECT i.autoVoucherId vid, sum(CASE WHEN coalesce(it.taxRate, 0) = 0 THEN it.amount ELSE 0 END) nonTax, sum(CASE WHEN coalesce(it.taxRate, 0) > 0 THEN it.amount ELSE 0 END) tax
      FROM Invoices i JOIN InvoiceItems it ON it.invoiceId = i.id WHERE i.autoVoucherId IN (${voucherIds.join(',')}) GROUP BY i.autoVoucherId`);
  return new Map(items.map((item) => [item.vid, item]));
}

// Taxable / non-taxable split: from the invoice items when the bill came from an invoice; otherwise worked back from
// the GST charged at the nearest slab (a small remainder counts as all taxable)
function taxableSplit(itemTotals, sign, income, gst) {
  if (itemTotals)
    return { taxable: round2(sign * toNumber(itemTotals.tax)), nonTaxable: round2(sign * toNumber(itemTotals.nonTax)) };
  if (!gst) return { taxable: 0, nonTaxable: income };
  const slab = nearestOf(GST_SLABS, Math.abs(gst / (income || 1)) * 100, 0) || DEFAULT_GST_SLAB;
  const taxable =
    Math.abs(round2((gst * 100) / slab)) <= Math.abs(income) + ROUNDING_GAP ? round2((gst * 100) / slab) : income;
  const nonTaxable = round2(income - taxable);
  if (Math.abs(nonTaxable) < ROUNDING_GAP) return { taxable: income, nonTaxable: 0 };
  return { taxable, nonTaxable };
}

const gstRateShown = (amount, taxable) => {
  if (!amount || !taxable) return '';
  return nearestOf(GST_SPLIT_RATES, Math.abs(amount / taxable) * 100, 0);
};

const billTypeTitle = (billType) => {
  if (billType === 'invoice') return 'INVOICE';
  if (billType === 'creditnote') return 'CREDIT NOTE';
  return 'ALL';
};

// List Of Invoices GST (iCAFFE): invoice amount non-taxable / taxable, GST rate-wise, AWB / HAWB / SB-BE, branch, division
export async function listOfInvoices(params) {
  const { vs: entries } = await voucherLines(salesBaseTypes(params.billType), params.from, params.to, {
    jobNo: params.jobNo,
  });
  const itemTotals = await invoiceItemTotalsByVoucher(entries.map((entry) => entry.v.id));
  const rows = [];
  for (const { v, party, tax, other, fcy, job } of entries) {
    if (!partyMatches(party, params.party)) continue;
    const sides = saleSides(v);
    const income = round2(
      sides.sign * other.reduce((sum, line) => sum + (line.dc === sides.incomeSide ? line.amount : -line.amount), 0),
    );
    const { cgst, sgst, igst } = gstSplit(tax, sides.sign);
    const gst = round2(cgst + sgst + igst);
    const { taxable, nonTaxable } = taxableSplit(itemTotals.get(v.id), sides.sign, income, gst);
    rows.push({
      _v: v.id,
      _b: v.baseType,
      billNo: v.voucherNumber,
      date: v.date,
      jobNo: v.jobNo || '',
      ...jobColumns(job, v.jobNo),
      party: party ? party.ledgerName : '',
      gstin: party ? party.gstin || '' : '',
      pos: party && /^\d{2}/.test(party.gstin || '') ? party.gstin.slice(0, 2) : '',
      currency: fcy ? fcy.currency : 'INR',
      roe: fcy ? toNumber(fcy.roe) : 1,
      nonTaxable,
      taxable,
      invTotal: round2(nonTaxable + taxable),
      sgstPct: gstRateShown(sgst, taxable),
      sgst,
      cgstPct: gstRateShown(cgst, taxable),
      cgst,
      igstPct: gstRateShown(igst, taxable),
      igst,
      totalTax: gst,
      refNo: v.refNo || '',
      branch: v.branchCode || (job && job.branch) || '',
    });
  }
  const gstHeader = 'Goods And Service Tax';
  return {
    subtitle: 'List Of Invoice Gst (' + billTypeTitle(params.billType) + ')',
    note: 'E-invoice IRN, client invoice and UTR references are not kept in EagleView yet',
    columns: [
      ['billNo', 'Bill No'],
      ['date', 'Date', 'date'],
      ['jobNo', 'Docket No'],
      ['jobType', 'Job Type'],
      ['party', 'Party Name'],
      ['gstin', 'GSTIN No.'],
      ['pos', 'Place of Supply Code'],
      ['currency', 'Currency'],
      ['roe', 'Exchange rate'],
      ['nonTaxable', 'Non Taxable', 'money', 'Invoice Amount'],
      ['taxable', 'Taxable', 'money', 'Invoice Amount'],
      ['invTotal', 'Total', 'money', 'Invoice Amount'],
      ['sgstPct', '%', 'text', gstHeader],
      ['sgst', 'SGST', 'money', gstHeader],
      ['cgstPct', '%', 'text', gstHeader],
      ['cgst', 'CGST', 'money', gstHeader],
      ['igstPct', '%', 'text', gstHeader],
      ['igst', 'IGST', 'money', gstHeader],
      ['totalTax', 'Total Tax', 'money', gstHeader],
      ['mawb', 'AWB No'],
      ['hawb', 'HAWB No'],
      ['sbBe', 'BE No./SB No.'],
      ['refNo', 'Referance No'],
      ['branch', 'Branch'],
      ['division', 'Division'],
    ],
    rows,
    totals: ['nonTaxable', 'taxable', 'invTotal', 'sgst', 'cgst', 'igst', 'totalTax'],
  };
}

// Remittance Register: foreign currency receipts with the job's master / house no ("all=1": every receipt)
export async function remittanceRegister(params) {
  const { vs: entries } = await voucherLines(['Receipt'], params.from, params.to);
  const rows = [];
  let serial = 0;
  for (const { v, party, fcy, job } of entries) {
    if (!(params.all === '1' || fcy)) continue;
    rows.push({
      _v: v.id,
      _b: v.baseType,
      sr: ++serial,
      typeName: v.typeName,
      branch: v.branchCode || (job && job.branch) || '',
      party: party ? party.ledgerName : '',
      mawb: (job && job.mawb) || '',
      hawb: (job && job.hawb) || '',
      date: v.date,
      voucherNumber: v.voucherNumber,
      refNo: v.refNo || '',
      jobNo: v.jobNo || '',
      currency: fcy ? fcy.currency : 'INR',
      roe: fcy ? toNumber(fcy.roe) : 1,
      amountFcy: fcy ? round2(fcy.amountFcy) : '',
      amount: round2(party ? party.amount : toNumber(v.totalAmount)),
    });
  }
  return {
    subtitle: 'Remittance Register',
    note: 'CAN, agent invoice and profit share are not kept in EagleView accounts yet',
    columns: [
      ['sr', 'Sr No.', 'int'],
      ['typeName', 'Type'],
      ['branch', 'Branch'],
      ['party', 'Remitter / Party'],
      ['mawb', 'Master No.'],
      ['hawb', 'House No.'],
      ['voucherNumber', 'Receipt No'],
      ['date', 'Date', 'date'],
      ['refNo', 'Ref / Advice No'],
      ['jobNo', 'Docket No'],
      ['currency', 'Curr'],
      ['roe', 'Ex. Rate'],
      ['amountFcy', 'Amount (FC)', 'money'],
      ['amount', 'Amount (INR)', 'money'],
    ],
    rows,
    totals: ['amount'],
  };
}

// Pending Remittance: bills raised in foreign currency not yet fully received - master / house no, bill, remittance
// amount, paid, balance ("fcyOnly=0": INR bills too)
export async function pendingRemittance(params) {
  const { vs: entries } = await voucherLines(['Sales'], params.from || EARLIEST_DATE, params.to || todayIso());
  const ids = entries.map((entry) => entry.v.id);
  if (!ids.length) return { subtitle: 'Pending Remittance', columns: [['party', 'Party']], rows: [] };
  const allocations = await selectRowsOrEmpty(
    `SELECT againstVoucherId id, sum(amount) amt, sum(coalesce(amountFcy, 0)) fc FROM VoucherAllocations WHERE againstVoucherId IN (${ids.join(',')}) GROUP BY againstVoucherId`,
  );
  const receivedByBill = new Map(allocations.map((allocation) => [allocation.id, allocation]));
  const rows = [];
  for (const { v, party, fcy, job } of entries) {
    if (params.fcyOnly !== '0' && !fcy) continue;
    const amount = fcy ? round2(fcy.amountFcy) : round2(party ? party.amount : toNumber(v.totalAmount));
    const received = receivedByBill.get(v.id) || { amt: 0, fc: 0 };
    const paid = fcy
      ? round2(toNumber(received.fc) || toNumber(received.amt) / (toNumber(fcy.roe) || 1))
      : round2(toNumber(received.amt));
    const balance = round2(amount - paid);
    if (balance <= PAISA) continue;
    rows.push({
      _v: v.id,
      _b: v.baseType,
      party: party ? party.ledgerName : '',
      docNo: v.jobNo || v.voucherNumber,
      mawb: (job && job.mawb) || '',
      hawb: (job && job.hawb) || '',
      billNo: v.voucherNumber,
      billDate: v.date,
      refNo: v.refNo || '',
      currency: fcy ? fcy.currency : 'INR',
      amount,
      paid,
      balance,
    });
  }
  return {
    subtitle: 'Pending Remittance',
    groupBy: 'party',
    columns: [
      ['party', 'Party'],
      ['docNo', 'Doc. No.'],
      ['mawb', 'Master No.'],
      ['hawb', 'House No.'],
      ['billNo', 'Bill No.'],
      ['billDate', 'Bill Dt.', 'date'],
      ['refNo', 'Ref. No'],
      ['currency', 'Curr'],
      ['amount', 'Rem. Amt', 'money'],
      ['paid', 'Paid', 'money'],
      ['balance', 'Balance', 'money'],
    ],
    rows,
    totals: ['amount', 'paid', 'balance'],
  };
}

async function jobIncomeAndCost(params) {
  const groupTree = await loadGroupTree();
  const incomeGroups = natureGroupIds(groupTree, 'Income');
  const expenseGroups = natureGroupIds(groupTree, 'Expenses');
  const lines = await selectRows(
    `SELECT upper(trim(v.jobNo)) jobNo, v.date, v.branchCode, d.dc, d.amount, d.remarks, l.groupId, l.name ledger, l.id lid FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
        JOIN AccountLedgers l ON l.id = d.ledgerId WHERE ${VALID_VOUCHER} AND coalesce(v.jobNo, '') <> '' AND v.date >= ? AND v.date <= ?`,
    [params.from || EARLIEST_DATE, params.to],
  );
  const jobs = new Map();
  for (const line of lines) {
    const job = jobs.get(line.jobNo) || {
      jobNo: line.jobNo,
      first: line.date,
      branch: line.branchCode || '',
      income: 0,
      cost: 0,
      heads: new Map(),
    };
    const signed = line.dc === 'Dr' ? toNumber(line.amount) : -toNumber(line.amount);
    if (expenseGroups.has(line.groupId)) {
      job.cost += signed;
      job.heads.set(line.ledger, round2((job.heads.get(line.ledger) || 0) + signed));
    }
    if (incomeGroups.has(line.groupId)) job.income -= signed;
    if (line.date < job.first) job.first = line.date;
    jobs.set(line.jobNo, job);
  }
  await addBulkInvoiceIncome(jobs, params.to);
  return jobs;
}

// bulk GST invoices carry no docket on the voucher - their lines say which docket each charge is for
async function addBulkInvoiceIncome(jobs, to) {
  const bulkInvoices = await selectRowsOrEmpty(
    "SELECT date, linesJson, kind FROM AccSalesInvoices WHERE bulk = 1 AND coalesce(status, '') <> 'Void' AND date <= ?",
    [to],
  );
  for (const invoice of bulkInvoices) {
    for (const line of JSON.parse(invoice.linesJson || '[]')) {
      const job = jobs.get(
        String(line.jobNo || '')
          .toUpperCase()
          .trim(),
      );
      if (job) job.income += (invoice.kind === 'creditnote' ? -1 : 1) * toNumber(line.inrAmount);
    }
  }
}

// Unbilled Charge (iCAFFE): charge by charge - UNBILLED (cost booked, nothing billed on the job) or Billed / Short
// (billed less than cost, "rtype=short")
export async function unbilled(params) {
  const jobs = await jobIncomeAndCost(params);
  const details = await loadJobDetails([...jobs.keys()]);
  const shortOnly = params.rtype === 'short';
  const rows = [];
  for (const job of jobs.values()) {
    const detail = details.get(job.jobNo) || {};
    const common = { jobNo: job.jobNo, date: job.first, party: detail.party || '' };
    const where = { branch: job.branch || detail.branch || '', division: divisionOfJob(job.jobNo) };
    if (!shortOnly && job.cost > HALF_RUPEE && job.income < HALF_RUPEE) {
      for (const [head, amount] of job.heads) {
        if (amount > HALF_RUPEE)
          rows.push({ ...common, charge: head, expense: round2(amount), income: 0, short: round2(amount), ...where });
      }
    }
    if (shortOnly && job.income > HALF_RUPEE && job.cost - job.income > HALF_RUPEE) {
      rows.push({
        ...common,
        charge: [...job.heads.keys()].join(', '),
        expense: round2(job.cost),
        income: round2(job.income),
        short: round2(job.cost - job.income),
        ...where,
      });
    }
  }
  rows.sort(
    (first, second) => String(first.date).localeCompare(String(second.date)) || first.jobNo.localeCompare(second.jobNo),
  );
  return {
    subtitle: (shortOnly ? 'BILLED / SHORT' : 'UNBILLED') + ' - Docket Date Wise',
    columns: [
      ['jobNo', 'Docket No'],
      ['date', 'Date', 'date'],
      ['party', 'Party'],
      ['charge', 'Charge Name'],
      ['expense', 'Expense', 'money'],
      ['income', 'Income', 'money'],
      ['short', 'Short', 'money'],
      ['branch', 'Branch'],
      ['division', 'Division'],
    ],
    rows,
    totals: ['expense', 'income', 'short'],
  };
}
