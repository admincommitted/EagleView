import { VALID_VOUCHER, selectRows } from '../../shared/hubQuery.service.js';
import { round2 } from '../../shared/hubFormat.service.js';
import { loadGroupTree } from '../../shared/groupTree.service.js';

const tdsColumns = () => [
  ['date', 'Date', 'date'],
  ['voucherNumber', 'Voucher No'],
  ['party', 'Party'],
  ['tdsLedger', 'TDS Ledger'],
  ['jobNo', 'Job No'],
  ['deducted', 'Deducted', 'money'],
  ['paid', 'Paid / Adjusted', 'money'],
];

/** Which vouchers touch a bank / a cash ledger (voucher id -> { bank, cash }). */
function bankCashTouches(lines, bankGroups, cashGroups) {
  const touches = new Map();
  for (const line of lines) {
    const touch = touches.get(line.vid) || { bank: false, cash: false };
    if (bankGroups.has(line.groupId)) touch.bank = true;
    if (cashGroups.has(line.groupId)) touch.cash = true;
    touches.set(line.vid, touch);
  }
  return touches;
}

const keepsVoucherType = (voucherType, touch) =>
  voucherType === 'all' ||
  (voucherType === 'bank' && touch.bank) ||
  (voucherType === 'cash' && touch.cash) ||
  (voucherType === 'journal' && !touch.bank && !touch.cash);

// Day Book (iCAFFE): every voucher line of the period - bank, cash, journal or all (vtype); the voucher's own
// details print on its first line only
export async function dayBook(params) {
  const { groups, descendants } = await loadGroupTree();
  const groupsMatching = (pattern) =>
    descendants(groups.filter((group) => pattern.test(group.name)).map((group) => group.id));
  const bankGroups = groupsMatching(/^bank (accounts|od)/i);
  const cashGroups = groupsMatching(/^cash-in-hand$/i);
  const voucherType = params.vtype || 'all';
  const lines = await selectRows(
    `SELECT v.id vid, t.baseType, t.name typeName, v.voucherNumber, v.date, v.narration, v.jobNo, v.refNo, v.branchCode, d.dc, d.amount, l.name ledger, l.groupId
        FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN AccountLedgers l ON l.id = d.ledgerId
        WHERE ${VALID_VOUCHER} AND v.date >= ? AND v.date <= ? ORDER BY v.date, v.id, d.id`,
    [params.from, params.to],
  );
  const touches = bankCashTouches(lines, bankGroups, cashGroups);
  let previousVoucherId = null;
  const rows = lines
    .filter((line) => keepsVoucherType(voucherType, touches.get(line.vid)))
    .map((line) => {
      const first = line.vid !== previousVoucherId;
      previousVoucherId = line.vid;
      return {
        _v: line.vid,
        _b: line.baseType,
        voucherNumber: first ? line.voucherNumber : '',
        date: first ? line.date : '',
        particulars: line.ledger,
        narration: first ? line.narration || '' : '',
        jobNo: first ? line.jobNo || '' : '',
        typeName: first ? line.typeName : '',
        chqNo: first && (touches.get(line.vid) || {}).bank ? line.refNo || '' : '',
        debit: line.dc === 'Dr' ? round2(line.amount) : 0,
        credit: line.dc === 'Cr' ? round2(line.amount) : 0,
        branch: first ? line.branchCode || '' : '',
      };
    });
  return {
    subtitle: 'Day Book',
    columns: [
      ['voucherNumber', 'Voucher No'],
      ['date', 'Date', 'date'],
      ['particulars', 'Particulars'],
      ['narration', 'Narration'],
      ['jobNo', 'Docket No'],
      ['typeName', 'Voucher Type'],
      ['chqNo', 'Chq./DD. No'],
      ['debit', 'Dr.', 'money'],
      ['credit', 'Cr.', 'money'],
      ['branch', 'Dealing Branch'],
    ],
    rows,
    totals: ['debit', 'credit'],
  };
}

// TDS payable: credits to TDS ledgers with the party of the voucher
export async function tdsPayableReport(params) {
  const lines = await selectRows(
    `SELECT v.date, v.voucherNumber, v.jobNo, l.name tdsLedger, d.amount, d.dc, v.id vid FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
        JOIN AccountLedgers l ON l.id = d.ledgerId WHERE ${VALID_VOUCHER} AND lower(l.name) LIKE '%tds%' AND v.date >= ? AND v.date <= ? ORDER BY v.date`,
    [params.from, params.to],
  );
  if (!lines.length) return { columns: tdsColumns(), rows: [], totals: ['deducted', 'paid'] };
  const voucherIds = [...new Set(lines.map((line) => line.vid))].join(',');
  const partyLines = await selectRows(
    `SELECT d.voucherId, l.name FROM VoucherDetails d JOIN AccountLedgers l ON l.id = d.ledgerId WHERE d.voucherId IN (${voucherIds}) AND lower(l.name) NOT LIKE '%tds%' AND d.dc = 'Cr'`,
  );
  const partyByVoucher = new Map();
  for (const line of partyLines) {
    if (!partyByVoucher.has(line.voucherId)) partyByVoucher.set(line.voucherId, line.name);
  }
  return {
    columns: tdsColumns(),
    rows: lines.map((line) => ({
      _v: line.vid,
      date: line.date,
      voucherNumber: line.voucherNumber,
      party: partyByVoucher.get(line.vid) || '',
      tdsLedger: line.tdsLedger,
      jobNo: line.jobNo || '',
      deducted: line.dc === 'Cr' ? round2(line.amount) : 0,
      paid: line.dc === 'Dr' ? round2(line.amount) : 0,
    })),
    totals: ['deducted', 'paid'],
  };
}
