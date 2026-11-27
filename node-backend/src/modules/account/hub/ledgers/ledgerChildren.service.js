import { runSql } from '../shared/hubQuery.service.js';
import { nowIso } from '../shared/hubFormat.service.js';
import { ensureLedgerColumns } from '../shared/ledgerColumns.service.js';
import { badRequest, notFound } from '../shared/hubHttp.js';

const GSTIN_FORMAT = /^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]{3}$/;
const IFSC_FORMAT = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPPERCASE_FIELDS = ['gstin', 'ifsc', 'swift'];

// child lists of a ledger: addresses, bank accounts, opening bills
const CHILD_LISTS = {
  addresses: {
    table: 'AccLedgerAddresses',
    fields: [
      'label',
      'address',
      'city',
      'state',
      'pinCode',
      'country',
      'gstin',
      'contactPerson',
      'phone',
      'email',
      'isDefault',
    ],
    check: (row) => {
      if (!row.address) throw badRequest('Enter the address');
      if (row.gstin && !GSTIN_FORMAT.test(row.gstin)) throw badRequest('GSTIN should be 15 characters');
    },
  },
  banks: {
    table: 'AccLedgerBanks',
    fields: ['bankName', 'accountName', 'accountNo', 'ifsc', 'branch', 'swift', 'isDefault'],
    check: (row) => {
      if (!row.accountNo) throw badRequest('Enter the account no');
      if (row.ifsc && !IFSC_FORMAT.test(row.ifsc)) throw badRequest('IFSC should be 11 characters, like HDFC0001234');
    },
  },
  openings: {
    table: 'AccLedgerOpenings',
    fields: ['docNo', 'docDate', 'dueDate', 'dc', 'amount', 'jobNo', 'remarks'],
    check: (row) => {
      if (!row.docNo) throw badRequest('Enter the bill / document no');
      if (!row.docDate) throw badRequest('Enter the bill date');
      if (!(Number(row.amount) > 0)) throw badRequest('Enter the amount');
      if (!['Dr', 'Cr'].includes(row.dc)) row.dc = 'Dr';
    },
  },
};

async function childListOf(kind) {
  await ensureLedgerColumns();
  const list = CHILD_LISTS[kind];
  if (!list) throw notFound('Unknown list');
  return list;
}

function cleanChildValue(field, value) {
  if (field === 'isDefault') return value ? 1 : 0;
  if (field === 'amount') return Number(value) || 0;
  const text = value == null ? null : String(value).trim() || null;
  return UPPERCASE_FIELDS.includes(field) && text ? String(text).toUpperCase() : text;
}

function cleanChildRow(list, body) {
  const row = {};
  for (const field of list.fields) row[field] = cleanChildValue(field, body[field]);
  list.check(row);
  return row;
}

// a new default address / bank account replaces the earlier default
async function clearDefault(list, ledgerId, row) {
  if (row.isDefault) await runSql(`UPDATE ${list.table} SET isDefault = 0 WHERE ledgerId = ?`, [ledgerId]);
}

/** Adds one row or a list of rows; answers how many were added. */
export async function addLedgerChildren(ledgerId, kind, body) {
  const list = await childListOf(kind);
  const rows = (Array.isArray(body) ? body : [body]).map((entry) => cleanChildRow(list, entry));
  const stamp = nowIso();
  for (const row of rows) {
    await clearDefault(list, ledgerId, row);
    const keys = Object.keys(row);
    await runSql(
      `INSERT INTO ${list.table} (ledgerId, ${keys.join(',')}, createdAt, updatedAt) VALUES (?, ${keys.map(() => '?').join(',')}, ?, ?)`,
      [ledgerId, ...keys.map((key) => row[key]), stamp, stamp],
    );
  }
  return rows.length;
}

export async function updateLedgerChild(ledgerId, kind, childId, body) {
  const list = await childListOf(kind);
  const row = cleanChildRow(list, body);
  await clearDefault(list, ledgerId, row);
  const keys = Object.keys(row);
  await runSql(
    `UPDATE ${list.table} SET ${keys.map((key) => key + ' = ?').join(', ')}, updatedAt = ? WHERE id = ? AND ledgerId = ?`,
    [...keys.map((key) => row[key]), nowIso(), childId, ledgerId],
  );
}

export async function deleteLedgerChild(ledgerId, kind, childId) {
  const list = await childListOf(kind);
  await runSql(`DELETE FROM ${list.table} WHERE id = ? AND ledgerId = ?`, [childId, ledgerId]);
}
