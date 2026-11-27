import { VALID_VOUCHER, selectRows, selectRowsOrEmpty } from '../../shared/hubQuery.service.js';
import { round2, toNumber } from '../../shared/hubFormat.service.js';
import { loadGroupTree, natureGroupIds } from '../../shared/groupTree.service.js';
import { ensureLedgerColumns } from '../../shared/ledgerColumns.service.js';
import { voucherLines, voucherRegister } from '../voucherLines.service.js';
import { jobColumns } from '../jobDetails.service.js';
import {
  CGST_LEDGER,
  IGST_LEDGER,
  SGST_LEDGER,
  TDS_LEDGER,
  gstAmountOf,
  ledgerColumnKey,
  partyMatches,
  sortedLedgerColumns,
} from '../reportHelpers.service.js';

const LATEST_BILLS_SHOWN = 100;

/** A debit note (cn = '1') reverses the bill: expense on the Cr side, amounts negative. */
const billSides = (isDebitNote) => ({ expenseSide: isDebitNote ? 'Cr' : 'Dr', sign: isDebitNote ? -1 : 1 });

const signedExpense = (line, { expenseSide, sign }) =>
  round2(sign * (line.dc === expenseSide ? line.amount : -line.amount));

// Expense Sheet: expense ledgers debited, job-wise
export async function expenseSheet(params) {
  const expenseGroups = natureGroupIds(await loadGroupTree(), 'Expenses');
  const where = [VALID_VOUCHER, 'v.date >= ?', 'v.date <= ?'];
  const replacements = [params.from, params.to];
  if (params.jobNo) {
    where.push('v.jobNo = ?');
    replacements.push(params.jobNo);
  }
  const lines = await selectRows(
    `SELECT v.id vid, t.baseType, l.id lid, v.date, v.voucherNumber, v.jobNo, v.narration, l.name ledger, l.groupId, d.dc, d.amount FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
        JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN AccountLedgers l ON l.id = d.ledgerId WHERE ${where.join(' AND ')} ORDER BY v.jobNo, v.date`,
    replacements,
  );
  const rows = lines
    .filter((line) => expenseGroups.has(line.groupId))
    .map((line) => ({
      _v: line.vid,
      _b: line.baseType,
      _l: line.lid,
      date: line.date,
      voucherNumber: line.voucherNumber,
      jobNo: line.jobNo || '',
      ledger: line.ledger,
      narration: line.narration || '',
      amount: round2((line.dc === 'Dr' ? 1 : -1) * toNumber(line.amount)),
    }));
  return {
    columns: [
      ['jobNo', 'Job No'],
      ['date', 'Date', 'date'],
      ['voucherNumber', 'Voucher No'],
      ['ledger', 'Expense Head'],
      ['narration', 'Narration'],
      ['amount', 'Amount', 'money'],
    ],
    rows,
    totals: ['amount'],
  };
}

async function msmeDetailsOf(partyIds) {
  if (!partyIds.length) return new Map();
  const ledgers = await selectRowsOrEmpty(
    `SELECT id, msmeNo, msmeType, msmeActivity, msmeAgreementDays FROM AccountLedgers WHERE id IN (${partyIds.join(',')})`,
  );
  return new Map(ledgers.map((ledger) => [ledger.id, ledger]));
}

function purchaseRegisterRow({ v, party, tax, other, fcy, job, info, docs }, msme, sides, ledgerColumnNames) {
  const msmeOfParty = party ? msme.get(party.ledgerId) || {} : {};
  const tds = round2(
    tax
      .filter((line) => TDS_LEDGER.test(line.ledgerName))
      .reduce((sum, line) => sum + (line.dc === sides.expenseSide ? -line.amount : line.amount), 0),
  );
  const payable = round2(party ? party.amount : toNumber(v.totalAmount));
  const row = {
    _v: v.id,
    _b: v.baseType,
    voucherNumber: v.voucherNumber,
    date: v.date,
    docStatus: docs ? 'Uploaded (' + docs + ')' : '',
    billNo: (info && info.billNo) || v.refNo || '',
    billDate: (info && info.billDate) || '',
    jobNo: v.jobNo || '',
    ...jobColumns(job, v.jobNo),
    hawb: (info && info.hblNo) || (job && job.hawb) || '',
    mawb: (info && info.mblNo) || (job && job.mawb) || '',
    branch: v.branchCode || (job && job.branch) || '',
    party: party ? party.ledgerName : '',
    msmeNo: msmeOfParty.msmeNo || '',
    msmeType: msmeOfParty.msmeType || '',
    msmeAgreement: msmeOfParty.msmeAgreementDays ? msmeOfParty.msmeAgreementDays + ' days' : '',
    msmeActivity: msmeOfParty.msmeActivity || '',
    currency: fcy ? fcy.currency : 'INR',
    total: round2(sides.sign * (payable + tds)),
    tds: round2(sides.sign * tds),
    payable: round2(sides.sign * payable),
  };
  let chargeTotal = 0;
  for (const line of [...other, ...tax.filter((taxLine) => !TDS_LEDGER.test(taxLine.ledgerName))]) {
    const key = ledgerColumnKey(line);
    const amount = signedExpense(line, sides);
    row[key] = round2((row[key] || 0) + amount);
    if (!tax.includes(line)) chargeTotal += amount;
    if (!ledgerColumnNames.has(key)) ledgerColumnNames.set(key, line.ledgerName);
  }
  row.chargeTotal = round2(chargeTotal);
  return row;
}

// Purchase Register (iCAFFE): bill + job + MSME details, Total / TDS / Payable, then one column per ledger posted.
// Without a search only the latest 100 bills of the period are loaded ("all=1" loads every bill).
export async function purchaseRegister(params) {
  const isDebitNote = params.cn === '1';
  try {
    await ensureLedgerColumns();
  } catch {
    // the MSME columns are optional here
  }
  const searching = !!(
    String(params.q || '').trim() ||
    String(params.party || '').trim() ||
    String(params.jobNo || '').trim()
  );
  const limit = !searching && params.all !== '1' ? LATEST_BILLS_SHOWN : 0;
  const { vs: entries, total } = await voucherLines(
    isDebitNote ? ['Debit Note'] : ['Purchase'],
    params.from,
    params.to,
    {
      jobNo: params.jobNo,
      party: String(params.party || '').trim(),
      q: String(params.q || '').trim(),
      limit,
      purchaseInfo: true,
      docs: true,
    },
  );
  const partyIds = [...new Set(entries.map((entry) => entry.party && entry.party.ledgerId).filter(Boolean))];
  const msme = await msmeDetailsOf(partyIds);
  const sides = billSides(isDebitNote);
  const ledgerColumnNames = new Map();
  const rows = entries
    .filter((entry) => partyMatches(entry.party, params.party))
    .map((entry) => purchaseRegisterRow(entry, msme, sides, ledgerColumnNames));
  const ledgerColumns = sortedLedgerColumns(ledgerColumnNames, 'Ledgers');
  rows.reverse(); // latest bill first
  const limited = limit && total > rows.length ? { shown: rows.length, total } : null;
  return {
    subtitle: isDebitNote ? 'Purchase Register - Credit Note' : 'Purchase Register',
    limited,
    searched: searching,
    columns: [
      ['voucherNumber', 'Voucher No'],
      ['date', 'Date', 'date'],
      ['docStatus', 'Document Upload Status'],
      ['billNo', 'Invoice No'],
      ['billDate', 'Invoice Date', 'date'],
      ['jobNo', 'Docket No'],
      ['mawb', 'Mawb No'],
      ['hawb', 'Hawb No'],
      ['sbBe', 'SB/BE No'],
      ['branch', 'Branch Name'],
      ['division', 'Division Name'],
      ['party', 'Party Name'],
      ['msmeNo', 'MSME No'],
      ['msmeType', 'MSME Type'],
      ['msmeAgreement', 'Agreement'],
      ['msmeActivity', 'MSME Type 2'],
      ['currency', 'Currency'],
      ['total', 'Total Amt', 'money'],
      ['tds', 'TDS Amt', 'money'],
      ['payable', 'Payable Amt', 'money'],
      ['chargeTotal', 'Charge Total', 'money'],
      ...ledgerColumns,
    ],
    rows,
    totals: ['total', 'tds', 'payable', 'chargeTotal', ...ledgerColumns.map((column) => column[0])],
  };
}

// Purchase Bill Summary (iCAFFE): bill by bill under its docket - bill amount, GST, voucher, foreign currency
export async function purchaseBillSummary(params) {
  const isDebitNote = params.cn === '1';
  const sides = billSides(isDebitNote);
  const { vs: entries } = await voucherLines(isDebitNote ? ['Debit Note'] : ['Purchase'], params.from, params.to, {
    jobNo: params.jobNo,
    purchaseInfo: true,
  });
  const rows = [];
  for (const { v, party, tax, other, fcy, job, info } of entries) {
    if (!partyMatches(party, params.party)) continue;
    const billAmount = round2(
      sides.sign * other.reduce((sum, line) => sum + (line.dc === sides.expenseSide ? line.amount : -line.amount), 0),
    );
    const cgst = round2(sides.sign * gstAmountOf(tax, CGST_LEDGER));
    const sgst = round2(sides.sign * gstAmountOf(tax, SGST_LEDGER));
    const igst = round2(sides.sign * gstAmountOf(tax, IGST_LEDGER));
    rows.push({
      _v: v.id,
      _b: v.baseType,
      docket: v.jobNo || '(no docket)',
      docketDate: (job && job.jobDate) || '',
      particulars: party ? party.ledgerName : v.narration || '',
      narration: v.narration || '',
      billNo: (info && info.billNo) || v.refNo || '',
      billDate: (info && info.billDate) || v.date,
      billAmount,
      sgst,
      cgst,
      igst,
      totalBill: round2(billAmount + cgst + sgst + igst),
      voucherNumber: v.voucherNumber,
      date: v.date,
      currency: fcy ? fcy.currency : 'INR',
      roe: fcy ? toNumber(fcy.roe) : '',
      fcAmt: fcy ? round2(sides.sign * fcy.amountFcy) : '',
    });
  }
  rows.sort(
    (first, second) =>
      first.docket.localeCompare(second.docket) || String(first.date).localeCompare(String(second.date)),
  );
  return {
    subtitle: isDebitNote ? 'Purchase Bill Summary - Credit Note' : 'Purchase Bill Summary',
    groupBy: 'docket',
    columns: [
      ['docket', 'Docket No'],
      ['docketDate', 'Docket Date', 'date'],
      ['particulars', 'Particulars'],
      ['billNo', 'Invoice No'],
      ['billDate', 'Invoice Date', 'date'],
      ['billAmount', 'Bill Amount', 'money'],
      ['sgst', 'SGST Amt.', 'money'],
      ['cgst', 'CGST Amt.', 'money'],
      ['igst', 'IGST Amt.', 'money'],
      ['totalBill', 'Total Bill Amt', 'money'],
      ['voucherNumber', 'Voucher No'],
      ['date', 'Voucher Date', 'date'],
      ['currency', 'Currency'],
      ['roe', 'Ex Rate'],
      ['fcAmt', 'FC Amt.', 'money'],
    ],
    rows,
    totals: ['billAmount', 'sgst', 'cgst', 'igst', 'totalBill'],
  };
}

// a bill saved on a Non Trade desk, or (no desk saved) a bill without a docket
const isNonTradeBill = (voucher, info) => {
  const desk = info && info.desk;
  return desk ? /^nontrade/.test(desk) : !voucher.jobNo;
};

// Non Trade (iCAFFE "Non Trade Invoice", item wise): every expense line of an office / overhead bill under its item;
// the bill's GST is shared over its lines in proportion to their amounts
export async function nonTrade(params) {
  const { vs: entries } = await voucherLines(['Purchase', 'Debit Note'], params.from, params.to, {
    purchaseInfo: true,
  });
  const rows = [];
  for (const { v, party, tax, other, info } of entries) {
    if (!isNonTradeBill(v, info)) continue;
    const sides = billSides(v.baseType === 'Debit Note');
    const lines = other.map((line) => ({ line, amount: signedExpense(line, sides) }));
    const base = lines.reduce((sum, entry) => sum + entry.amount, 0) || 1;
    const gst = {
      cgst: round2(sides.sign * gstAmountOf(tax, CGST_LEDGER)),
      sgst: round2(sides.sign * gstAmountOf(tax, SGST_LEDGER)),
      igst: round2(sides.sign * gstAmountOf(tax, IGST_LEDGER)),
    };
    for (const { line, amount } of lines) {
      rows.push({
        _v: v.id,
        _b: v.baseType,
        item: line.ledgerName,
        voucherNumber: v.voucherNumber,
        date: v.date,
        party: party ? party.ledgerName : '',
        billNo: (info && info.billNo) || v.refNo || '',
        billDate: (info && info.billDate) || v.date,
        billAmt: round2(sides.sign * (party ? party.amount : toNumber(v.totalAmount))),
        narration: line.remarks || v.narration || '',
        qty: 1,
        rate: amount,
        amount,
        sgst: round2((gst.sgst * amount) / base),
        cgst: round2((gst.cgst * amount) / base),
        igst: round2((gst.igst * amount) / base),
      });
    }
  }
  rows.sort(
    (first, second) => first.item.localeCompare(second.item) || String(first.date).localeCompare(String(second.date)),
  );
  return {
    subtitle: 'Non Trade Invoice',
    groupBy: 'item',
    columns: [
      ['item', 'Item Name'],
      ['voucherNumber', 'Voucher No.'],
      ['date', 'Voucher Date', 'date'],
      ['party', 'Party Name'],
      ['billNo', 'Bill No.'],
      ['billDate', 'Date', 'date'],
      ['billAmt', 'Bill Amt.', 'money'],
      ['narration', 'Narration'],
      ['qty', 'Qty', 'int'],
      ['rate', 'Rate', 'money'],
      ['amount', 'Amount', 'money'],
      ['sgst', 'SGST Amt', 'money'],
      ['cgst', 'CGST Amt', 'money'],
      ['igst', 'IGST Amt', 'money'],
    ],
    rows,
    totals: ['amount', 'sgst', 'cgst', 'igst'],
  };
}

// Overseas purchase: purchase / debit note / payment vouchers in a foreign currency
export async function overseasPurchase(params) {
  const rows = (await voucherRegister(['Purchase', 'Debit Note', 'Payment'], params.from, params.to)).filter(
    (row) => row.currency && row.currency !== 'INR',
  );
  return {
    columns: [
      ['date', 'Date', 'date'],
      ['voucherNumber', 'Voucher No'],
      ['typeName', 'Type'],
      ['partyName', 'Party'],
      ['jobNo', 'Job No'],
      ['currency', 'Cur'],
      ['amountFcy', 'Amount (FC)', 'money'],
      ['roe', 'ROE'],
      ['total', 'Amount (INR)', 'money'],
    ],
    rows,
    totals: ['total'],
  };
}
