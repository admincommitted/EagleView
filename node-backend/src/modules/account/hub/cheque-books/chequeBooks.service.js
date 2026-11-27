import { runSql, selectRows } from '../shared/hubQuery.service.js';
import { nowIso, round2 } from '../shared/hubFormat.service.js';
import { ensureChequeLeavesTable } from '../shared/hubTables.service.js';
import { ensureMasterTable } from '../shared/masterDefinitions.service.js';
import { badRequest, notFound } from '../shared/hubHttp.js';

const MAX_LEAVES_LISTED = 1000;

/** A cheque no as digits without leading zeros ("000123" -> "123"). */
const leafNumber = (text) =>
  String(text || '')
    .replace(/\D/g, '')
    .replace(/^0+/, '');

const digitWidth = (text) => String(text || '').replace(/\D/g, '').length;

// Issued leaves come from Payment / Contra vouchers whose bank line is this bank and whose ref no is the cheque no:
// leaf number -> the first such voucher
async function issuedLeaves(bankLedgerId) {
  const rows = await selectRows(
    `SELECT v.id, v.voucherNumber, v.date, v.refNo, v.status, d.amount,
      (SELECT l.name FROM VoucherDetails d2 JOIN AccountLedgers l ON l.id = d2.ledgerId WHERE d2.voucherId = v.id AND d2.ledgerId <> d.ledgerId ORDER BY d2.amount DESC LIMIT 1) party
      FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId WHERE d.ledgerId = ? AND d.dc = 'Cr' AND coalesce(v.refNo, '') <> ''`,
    [bankLedgerId],
  );
  const byLeaf = new Map();
  for (const row of rows) {
    const leaf = leafNumber(row.refNo);
    if (leaf && !byLeaf.has(leaf)) byLeaf.set(leaf, row);
  }
  return byLeaf;
}

async function ensureChequeTables() {
  await ensureMasterTable('chequebooks');
  await ensureChequeLeavesTable();
}

function bookUsage(book, issued, cancelled) {
  const from = Number(leafNumber(book.fromNo));
  const to = Number(leafNumber(book.toNo));
  const total = from && to && to >= from ? to - from + 1 : 0;
  let issuedCount = 0;
  let next = null;
  let lastUsed = null;
  for (let number = from; total && number <= to; number++) {
    const leaf = String(number);
    if (issued.has(leaf)) {
      issuedCount++;
      const voucher = issued.get(leaf);
      if (!lastUsed || voucher.date > lastUsed) lastUsed = voucher.date;
    } else if (!cancelled.has(leaf) && next === null) next = number;
  }
  return {
    ...book,
    total,
    issued: issuedCount,
    cancelled: cancelled.size,
    unused: Math.max(0, total - issuedCount - cancelled.size),
    nextNo: next === null ? '' : String(next).padStart(digitWidth(book.fromNo), '0'),
    lastUsed,
  };
}

/** Every cheque book with leaves issued / cancelled / unused, the next free leaf and the last date used. */
export async function listChequeBooks() {
  await ensureChequeTables();
  const books = await selectRows(
    `SELECT b.*, l.name bankName FROM AccChequeBooks b LEFT JOIN AccountLedgers l ON l.id = b.bankLedgerId ORDER BY b.id DESC`,
  );
  // books of the same bank share its issued leaves: read once per bank
  const issuedByBank = new Map();
  const summaries = [];
  for (const book of books) {
    if (!issuedByBank.has(book.bankLedgerId))
      issuedByBank.set(book.bankLedgerId, await issuedLeaves(book.bankLedgerId));
    const cancelledRows = await selectRows(
      "SELECT chequeNo FROM AccChequeLeaves WHERE bookId = ? AND status = 'CANCELLED'",
      [book.id],
    );
    const cancelled = new Set(cancelledRows.map((row) => leafNumber(row.chequeNo)));
    summaries.push(bookUsage(book, issuedByBank.get(book.bankLedgerId), cancelled));
  }
  return summaries;
}

/** Leaf by leaf (at most 1000) of one book: ISSUED with its voucher, CANCELLED with the reason, or UNUSED. */
export async function listChequeLeaves(bookId) {
  await ensureChequeTables();
  const book = (await selectRows('SELECT * FROM AccChequeBooks WHERE id = ?', [bookId]))[0];
  if (!book) throw notFound('Cheque book not found');
  const from = Number(leafNumber(book.fromNo));
  const to = Number(leafNumber(book.toNo));
  const width = digitWidth(book.fromNo);
  if (!from || !to || to < from) return [];
  const issued = await issuedLeaves(book.bankLedgerId);
  const marks = new Map(
    (await selectRows('SELECT * FROM AccChequeLeaves WHERE bookId = ?', [book.id])).map((row) => [
      leafNumber(row.chequeNo),
      row,
    ]),
  );
  const leaves = [];
  for (let number = from; number <= Math.min(to, from + MAX_LEAVES_LISTED - 1); number++) {
    const leaf = String(number);
    const voucher = issued.get(leaf);
    const mark = marks.get(leaf);
    leaves.push({
      chequeNo: leaf.padStart(width, '0'),
      status: voucher ? 'ISSUED' : mark && mark.status === 'CANCELLED' ? 'CANCELLED' : 'UNUSED',
      voucherId: voucher ? voucher.id : null,
      voucherNumber: voucher ? voucher.voucherNumber : '',
      date: voucher ? voucher.date : mark ? String(mark.updatedAt || '').slice(0, 10) : '',
      party: voucher ? voucher.party : '',
      amount: voucher ? round2(voucher.amount) : null,
      reason: mark ? mark.reason : '',
    });
  }
  return leaves;
}

/** Marks a leaf cancelled (action "cancel", with a reason) or clears its mark. */
export async function markChequeLeaf(bookId, chequeNo, body, userName) {
  await ensureChequeLeavesTable();
  const stamp = nowIso();
  const leaf = String(chequeNo);
  await runSql('DELETE FROM AccChequeLeaves WHERE bookId = ? AND chequeNo = ?', [bookId, leaf]);
  if (body.action !== 'cancel') return;
  if (!String(body.reason || '').trim()) throw badRequest('Enter why the cheque is cancelled');
  await runSql(
    "INSERT INTO AccChequeLeaves (bookId, chequeNo, status, reason, byUser, createdAt, updatedAt) VALUES (?,?,'CANCELLED',?,?,?,?)",
    [bookId, leaf, String(body.reason).trim(), userName, stamp, stamp],
  );
}
