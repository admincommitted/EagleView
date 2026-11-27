import { sequelize } from '../../../../config/database.js';
import { runSql, selectRows } from '../shared/hubQuery.service.js';
import { nowIso, round2, toNumber } from '../shared/hubFormat.service.js';
import { ensureInterBranchTable } from '../shared/hubTables.service.js';
import { badRequest, notFound } from '../shared/hubHttp.js';
import { isMonthClosed } from '../month-closing/monthClosing.service.js';
import { branchLedgerId, postBranchVoucher } from './branchVoucher.service.js';

// Inter Branch (iCAFFE): Bank Transfer, Journal, Cash Transfer.
// The sending branch raises it (its voucher posts at once against "BRANCH A/C - <to>"); the receiving branch accepts it
// (its voucher posts against "BRANCH A/C - <from>") or returns it (the sending voucher is reversed, nothing is deleted).
//   Bank / cash transfer: from-bank Cr | Branch A/c-TO Dr ; on accept: to-bank Dr | Branch A/c-FROM Cr   (Contra)
//   Journal: from-account Cr (or Dr) | Branch A/c-TO ; on accept: the lines asked for | Branch A/c-FROM   (Journal)

export const TRANSFER_TYPES = { bank: 'Bank Transfer', journal: 'Journal', cash: 'Cash Transfer' };
const WAITING = 'Waiting';

const voucherBaseOf = (type) => (type === 'journal' ? 'Journal' : 'Contra');
const accountKindOf = (type) => (type === 'cash' ? 'cash' : 'bank');

const cleanLines = (lines) =>
  (Array.isArray(lines) ? lines : [])
    .map((line) => ({
      ledgerId: Number(line.ledgerId),
      dc: line.dc,
      amount: round2(toNumber(line.amount)),
      remarks: line.remarks || null,
    }))
    .filter((line) => line.ledgerId && ['Dr', 'Cr'].includes(line.dc) && line.amount > 0);

const netDebit = (lines) =>
  round2(lines.reduce((sum, line) => sum + (line.dc === 'Dr' ? line.amount : -line.amount), 0));

/** Voucher ids raised / accepted / reversed by inter branch transfers (they are changed only through Inter Branch). */
export async function interBranchVoucherIds() {
  try {
    await ensureInterBranchTable();
    const rows = await selectRows('SELECT raiseVoucherId a, acceptVoucherId b, reverseVoucherId c FROM AccInterBranch');
    return new Set(
      rows
        .flatMap((row) => [row.a, row.b, row.c])
        .filter(Boolean)
        .map(Number),
    );
  } catch {
    return new Set();
  }
}

export const listActiveBranches = () =>
  selectRows(
    "SELECT branchCode code, branchName name, isDefault FROM CompanyBranches WHERE coalesce(status, 'Active') = 'Active' ORDER BY isDefault DESC, branchCode",
  );

function transferFilter(query) {
  const where = [];
  const replacements = [];
  if (query.from) {
    where.push('i.date >= ?');
    replacements.push(query.from);
  }
  if (query.to) {
    where.push('i.date <= ?');
    replacements.push(query.to);
  }
  if (query.type) {
    where.push('i.type = ?');
    replacements.push(query.type);
  }
  if (query.status) {
    where.push('i.status = ?');
    replacements.push(query.status);
  }
  if (query.branch) {
    where.push('(i.fromBranch = ? OR i.toBranch = ?)');
    replacements.push(query.branch, query.branch);
  }
  return { whereSql: where.length ? 'WHERE ' + where.join(' AND ') : '', replacements };
}

const parsedLines = (json) => {
  try {
    return JSON.parse(json || '[]');
  } catch {
    return [];
  }
};

/** Transfers of the filter with ledgers, voucher numbers and the receiving branch's entries named. */
export async function listTransfers(query) {
  await ensureInterBranchTable();
  const { whereSql, replacements } = transferFilter(query);
  const rows = await selectRows(
    `SELECT i.*, fl.name fromLedger, tl.name toLedger, rv.voucherNumber raiseNo, av.voucherNumber acceptNo, xv.voucherNumber reverseNo
      FROM AccInterBranch i LEFT JOIN AccountLedgers fl ON fl.id = i.fromLedgerId LEFT JOIN AccountLedgers tl ON tl.id = i.toLedgerId
      LEFT JOIN Vouchers rv ON rv.id = i.raiseVoucherId LEFT JOIN Vouchers av ON av.id = i.acceptVoucherId LEFT JOIN Vouchers xv ON xv.id = i.reverseVoucherId
      ${whereSql} ORDER BY i.date DESC, i.id DESC`,
    replacements,
  );
  const ledgerNames = new Map(
    (await selectRows('SELECT id, name FROM AccountLedgers')).map((ledger) => [ledger.id, ledger.name]),
  );
  return rows.map((row) => ({
    ...row,
    typeName: TRANSFER_TYPES[row.type] || row.type,
    toLines: parsedLines(row.toLines).map((line) => ({
      ...line,
      ledgerName: ledgerNames.get(Number(line.ledgerId)) || '',
    })),
  }));
}

async function assertMonthOpen(date) {
  if (await isMonthClosed(date)) throw badRequest('Month ' + date.slice(0, 7) + ' is closed (Month Closing)');
}

// Journal: the other branch's entries decide the amount and the side of "Branch A/c-TO" on the raising voucher
function journalTransferAmount(body, fromLedgerId) {
  const toLines = cleanLines(body.toLines);
  if (!toLines.length) throw badRequest('Add the entries the other branch should book');
  if (toLines.some((line) => line.ledgerId === fromLedgerId))
    throw badRequest("Your own account cannot be in the other branch's entries");
  const net = netDebit(toLines);
  if (!net) throw badRequest("The other branch's entries add up to nil");
  return { toLines, amount: Math.abs(net), side: net > 0 ? 'Dr' : 'Cr' };
}

/** Raises a transfer: { type, fromBranch, toBranch, date, amount, fromLedgerId, toLines (journal), refNo, narration }. */
export async function raiseTransfer(body, userName) {
  await ensureInterBranchTable();
  const type = String(body.type || '');
  const raisedBy = userName || null;
  const fromBranch = String(body.fromBranch || '')
    .trim()
    .toUpperCase();
  const toBranch = String(body.toBranch || '')
    .trim()
    .toUpperCase();
  const date = String(body.date || '').slice(0, 10);
  await assertMonthOpen(date);
  const fromLedgerId = Number(body.fromLedgerId);
  if (!fromLedgerId)
    throw badRequest(
      type === 'journal'
        ? 'Choose the account of your branch'
        : 'Choose the ' + accountKindOf(type) + ' account it goes from',
    );
  const { toLines, amount, side } =
    type === 'journal'
      ? journalTransferAmount(body, fromLedgerId)
      : { toLines: [], amount: round2(toNumber(body.amount)), side: 'Dr' };
  if (amount <= 0) throw badRequest('Enter the amount');
  return sequelize.transaction(async (transaction) => {
    const toBranchLedgerId = await branchLedgerId(toBranch, transaction);
    const narration =
      body.narration || `${TRANSFER_TYPES[type]} to ${toBranch}${body.refNo ? ' - ref ' + body.refNo : ''}`;
    const voucher = await postBranchVoucher(transaction, {
      division: body.division,
      base: voucherBaseOf(type),
      date,
      narration,
      refNo: body.refNo,
      branchCode: fromBranch,
      by: raisedBy,
      lines: [
        { ledgerId: toBranchLedgerId, dc: side, amount, remarks: 'Inter branch to ' + toBranch },
        { ledgerId: fromLedgerId, dc: side === 'Dr' ? 'Cr' : 'Dr', amount, remarks: TRANSFER_TYPES[type] },
      ],
    });
    const count = (await selectRows('SELECT count(*) n FROM AccInterBranch', [], transaction))[0].n;
    const ibNo = 'IB/' + fromBranch + '/' + (Number(count) + 1);
    const stamp = nowIso();
    await runSql(
      `INSERT INTO AccInterBranch (ibNo, type, fromBranch, toBranch, date, amount, fromLedgerId, toLines, refNo, narration, status, raiseVoucherId, raisedBy, createdAt, updatedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        ibNo,
        type,
        fromBranch,
        toBranch,
        date,
        amount,
        fromLedgerId,
        JSON.stringify(toLines),
        body.refNo || null,
        narration,
        WAITING,
        voucher.id,
        raisedBy,
        stamp,
        stamp,
      ],
      transaction,
    );
    return { ibNo, voucherId: voucher.id, voucherNumber: voucher.vno };
  });
}

async function waitingTransfer(transferId) {
  const transfer = (await selectRows('SELECT * FROM AccInterBranch WHERE id = ?', [transferId]))[0];
  if (!transfer) throw notFound('Transfer not found');
  if (transfer.status !== WAITING)
    throw badRequest('This transfer is already ' + String(transfer.status).toLowerCase());
  return transfer;
}

// the receiving branch's lines: the journal entries (as raised, or as changed) or the bank / cash account it comes in
function acceptLines(transfer, body) {
  if (transfer.type === 'journal') {
    const lines = cleanLines(body.toLines && body.toLines.length ? body.toLines : JSON.parse(transfer.toLines || '[]'));
    const net = netDebit(lines);
    if (Math.abs(Math.abs(net) - transfer.amount) > 0.01)
      throw badRequest('The entries must add up to ' + transfer.amount + ' as raised');
    return { lines, toLedgerId: null };
  }
  const toLedgerId = Number(body.toLedgerId);
  if (!toLedgerId) throw badRequest('Choose the ' + accountKindOf(transfer.type) + ' account it is received in');
  return {
    lines: [{ ledgerId: toLedgerId, dc: 'Dr', amount: transfer.amount, remarks: TRANSFER_TYPES[transfer.type] }],
    toLedgerId,
  };
}

/** Accepts a waiting transfer: { date, toLedgerId (bank / cash), toLines (journal, may be changed), division }. */
export async function acceptTransfer(transferId, body, userName) {
  await ensureInterBranchTable();
  const transfer = await waitingTransfer(transferId);
  const decidedBy = userName || null;
  const date = String(body.date || transfer.date).slice(0, 10);
  if (date < transfer.date) throw badRequest('Accept date cannot be before the transfer date');
  await assertMonthOpen(date);
  const { lines, toLedgerId } = acceptLines(transfer, body);
  return sequelize.transaction(async (transaction) => {
    const fromBranchLedgerId = await branchLedgerId(transfer.fromBranch, transaction);
    const net = netDebit(lines);
    const voucher = await postBranchVoucher(transaction, {
      division: body.division,
      base: voucherBaseOf(transfer.type),
      date,
      narration: `${TRANSFER_TYPES[transfer.type]} from ${transfer.fromBranch} (${transfer.ibNo})${transfer.refNo ? ' - ref ' + transfer.refNo : ''}`,
      refNo: transfer.refNo,
      branchCode: transfer.toBranch,
      by: decidedBy,
      lines: [
        ...lines,
        {
          ledgerId: fromBranchLedgerId,
          dc: net > 0 ? 'Cr' : 'Dr',
          amount: Math.abs(net),
          remarks: 'Inter branch from ' + transfer.fromBranch,
        },
      ],
    });
    const stamp = nowIso();
    await runSql(
      'UPDATE AccInterBranch SET status = ?, acceptVoucherId = ?, toLedgerId = ?, toLines = ?, decidedBy = ?, decidedAt = ?, updatedAt = ? WHERE id = ?',
      [
        'Accepted',
        voucher.id,
        toLedgerId,
        transfer.type === 'journal' ? JSON.stringify(lines) : transfer.toLines,
        decidedBy,
        stamp,
        stamp,
        transfer.id,
      ],
      transaction,
    );
    return { voucherId: voucher.id, voucherNumber: voucher.vno };
  });
}

/** Returns a waiting transfer: { reason, date } - the sending voucher is reversed on the return date. */
export async function returnTransfer(transferId, body, userName) {
  await ensureInterBranchTable();
  const transfer = await waitingTransfer(transferId);
  const reason = String((body && body.reason) || '').trim();
  if (!reason) throw badRequest('Enter why it is returned');
  const decidedBy = userName || null;
  const askedDate = String((body && body.date) || nowIso()).slice(0, 10);
  const date = askedDate < transfer.date ? transfer.date : askedDate;
  await assertMonthOpen(date);
  const raisedLines = await selectRows('SELECT ledgerId, dc, amount, remarks FROM VoucherDetails WHERE voucherId = ?', [
    transfer.raiseVoucherId,
  ]);
  return sequelize.transaction(async (transaction) => {
    const voucher = await postBranchVoucher(transaction, {
      division: (body || {}).division,
      base: voucherBaseOf(transfer.type),
      date,
      narration: `Reversal of ${transfer.ibNo} - returned by ${transfer.toBranch}: ${reason}`,
      refNo: transfer.refNo,
      branchCode: transfer.fromBranch,
      by: decidedBy,
      lines: raisedLines.map((line) => ({
        ledgerId: line.ledgerId,
        dc: line.dc === 'Dr' ? 'Cr' : 'Dr',
        amount: line.amount,
        remarks: 'Reversal',
      })),
    });
    const stamp = nowIso();
    await runSql(
      'UPDATE AccInterBranch SET status = ?, reverseVoucherId = ?, returnReason = ?, decidedBy = ?, decidedAt = ?, updatedAt = ? WHERE id = ?',
      ['Returned', voucher.id, reason, decidedBy, stamp, stamp, transfer.id],
      transaction,
    );
    return { voucherId: voucher.id, voucherNumber: voucher.vno };
  });
}

/** Balance between branches: each "BRANCH A/C - <code>" ledger's net. */
export async function branchBalances() {
  const rows =
    await selectRows(`SELECT l.id, l.name, coalesce(sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END), 0) net
      FROM AccountLedgers l LEFT JOIN VoucherDetails d ON d.ledgerId = l.id WHERE l.name LIKE 'BRANCH A/C - %' GROUP BY l.id ORDER BY l.name`);
  return rows.map((row) => ({ ...row, branch: row.name.replace('BRANCH A/C - ', ''), net: round2(row.net) }));
}
