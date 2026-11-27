import { auditLedger, checkLedgerMaster } from '../../../../utils/common/ledgerGuard.js';
import { VALID_VOUCHER, runSql, selectRows } from '../shared/hubQuery.service.js';
import { nowIso, round2, toNumber, todayIso } from '../shared/hubFormat.service.js';
import { loadGroupTree } from '../shared/groupTree.service.js';
import { LEDGER_EXTRA_COLUMNS, ensureLedgerColumns, ledgerColumnNames } from '../shared/ledgerColumns.service.js';
import { NO_MOVEMENT, ledgerMovements, signedOpening } from '../shared/ledgerMovements.service.js';
import { badRequest, notFound } from '../shared/hubHttp.js';

const DEFAULT_LIST_LIMIT = 500;
const MAX_LIST_LIMIT = 3000;
const MSME_MAX_PAYMENT_DAYS = 45;

const GSTIN_FORMAT = /^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]{3}$/;
const PAN_FORMAT = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_FORMAT = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UDYAM_FORMAT = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;

const LEDGER_FIELDS = [
  'name',
  'groupId',
  'openingBalance',
  'balanceType',
  'address',
  'state',
  'pinCode',
  'country',
  'gstin',
  'pan',
  'bankAccount',
  'bankIfsc',
  'bankName',
  'creditLimit',
  'creditDays',
  'isTdsApplicable',
  'tdsNatureId',
  'isTdsDeductible',
  'deducteeType',
  'isGstApplicable',
  'hsnSac',
  'taxability',
  'gstRate',
  'maintainBillByBill',
  'costCentresApplicable',
  'contactPerson',
  'email',
  'phone',
  ...Object.keys(LEDGER_EXTRA_COLUMNS).filter((column) => !['createdByName', 'modifiedByName'].includes(column)),
];
const NUMBER_FIELDS = ['openingBalance', 'creditLimit', 'gstRate', 'monthlyBudget'];
const INTEGER_FIELDS = ['creditDays', 'groupId', 'tdsNatureId', 'partyTdsLedgerId', 'msmeAgreementDays'];
const FLAG_FIELDS = [
  'isTdsApplicable',
  'isTdsDeductible',
  'isGstApplicable',
  'maintainBillByBill',
  'costCentresApplicable',
  'isUnregistered',
  'isBlacklisted',
  'isComposite',
  'isFixedDeposit',
  'isTdsExempt',
  'isActive',
];
const UPPERCASE_FIELDS = ['gstin', 'pan', 'bankIfsc', 'msmeNo', 'accountCode'];

const isTrue = (value) => value === true || value === 1 || value === '1' || value === 'true';

/** Balance shown as an amount with its side. */
const balanceWithSide = (balance) => ({ balance: Math.abs(balance), side: balance < 0 ? 'Cr' : 'Dr' });

const ledgerFlagCondition = {
  blacklisted: 'coalesce(l.isBlacklisted, 0) = 1',
  msme: "coalesce(l.msmeNo, '') <> ''",
  inactive: 'coalesce(l.isActive, 1) = 0',
  nogstin: "coalesce(l.gstin, '') = '' AND coalesce(l.isUnregistered, 0) = 0",
};

async function ledgerListFilter(query) {
  const { descendants } = await loadGroupTree();
  const where = [];
  const replacements = [];
  const text = String(query.q || '').trim();
  if (text) {
    where.push('(l.name LIKE ? OR l.gstin LIKE ? OR l.pan LIKE ? OR l.accountCode LIKE ?)');
    const like = '%' + text + '%';
    replacements.push(like, like, like, like);
  }
  if (query.groupId) {
    const groupIds = [...descendants([Number(query.groupId)])];
    where.push(`l.groupId IN (${groupIds.join(',') || 0})`);
  }
  if (typeof query.flag === 'string' && Object.hasOwn(ledgerFlagCondition, query.flag))
    where.push(ledgerFlagCondition[query.flag]);
  return { whereSql: where.length ? 'WHERE ' + where.join(' AND ') : '', replacements };
}

/** Ledger Account list: the search's ledgers with their balance, and the total of the same search. */
export async function listLedgers(query) {
  await ensureLedgerColumns();
  const { whereSql, replacements } = await ledgerListFilter(query);
  const limit = Math.min(Number(query.limit) || DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
  const rows = await selectRows(
    `SELECT l.id, l.name, l.groupId, l.gstin, l.pan, l.state, l.openingBalance, l.balanceType, l.creditDays, l.creditLimit, l.accountCode, l.isBlacklisted, l.msmeNo, l.msmeType, l.isActive, l.isUnregistered, g.name groupName
      FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId ${whereSql} ORDER BY l.name LIMIT ?`,
    [...replacements, limit],
  );
  const movements = await ledgerMovements(null, todayIso());
  // the total lets "20 of 7,800" show only when the list is really cut short
  const total = (await selectRows(`SELECT count(*) n FROM AccountLedgers l ${whereSql}`, replacements))[0].n;
  return {
    total,
    rows: rows.map((ledger) => {
      const movement = movements.get(ledger.id) || NO_MOVEMENT;
      const balance = round2(signedOpening(ledger) + movement.dr - movement.cr);
      return { ...ledger, ...balanceWithSide(balance), used: !!(movement.dr || movement.cr) };
    }),
  };
}

/** One ledger with its balance, entry totals and its addresses, bank accounts and opening bills. */
export async function getLedger(id) {
  await ensureLedgerColumns();
  const ledger = (
    await selectRows(
      'SELECT l.*, g.name groupName, g.nature, pt.name partyTdsLedgerName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId LEFT JOIN AccountLedgers pt ON pt.id = l.partyTdsLedgerId WHERE l.id = ?',
      [id],
    )
  )[0];
  if (!ledger) throw notFound('Ledger not found');
  const entries =
    (
      await selectRows(
        `SELECT count(*) n, sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE 0 END) dr, sum(CASE WHEN d.dc = 'Cr' THEN d.amount ELSE 0 END) cr, max(v.date) last
      FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId WHERE ${VALID_VOUCHER} AND d.ledgerId = ?`,
        [ledger.id],
      )
    )[0] || {};
  const balance = round2(signedOpening(ledger) + toNumber(entries.dr) - toNumber(entries.cr));
  const addresses = await selectRows(
    'SELECT * FROM AccLedgerAddresses WHERE ledgerId = ? ORDER BY isDefault DESC, id',
    [ledger.id],
  );
  const banks = await selectRows('SELECT * FROM AccLedgerBanks WHERE ledgerId = ? ORDER BY isDefault DESC, id', [
    ledger.id,
  ]);
  const openings = await selectRows('SELECT * FROM AccLedgerOpenings WHERE ledgerId = ? ORDER BY docDate, id', [
    ledger.id,
  ]);
  return {
    ...ledger,
    ...balanceWithSide(balance),
    entries: entries.n || 0,
    totalDr: round2(entries.dr),
    totalCr: round2(entries.cr),
    lastEntry: entries.last || null,
    addresses,
    banks,
    openings,
  };
}

function cleanLedgerValue(field, value) {
  if (NUMBER_FIELDS.includes(field)) return value === '' || value == null ? 0 : Number(value);
  if (INTEGER_FIELDS.includes(field)) return value === '' || value == null ? null : Number(value);
  if (FLAG_FIELDS.includes(field)) return isTrue(value) ? 1 : 0;
  return value == null ? null : String(value).trim() || null;
}

function checkLedgerFormats(ledger, body) {
  if (ledger.gstin && !GSTIN_FORMAT.test(ledger.gstin))
    throw badRequest('GSTIN should be 15 characters, like 07AAACC1234D1Z5');
  if (ledger.pan && !PAN_FORMAT.test(ledger.pan)) throw badRequest('PAN should be like AAACC1234D');
  if (ledger.bankIfsc && !IFSC_FORMAT.test(ledger.bankIfsc))
    throw badRequest('IFSC should be 11 characters, like HDFC0001234');
  if (ledger.msmeNo && !UDYAM_FORMAT.test(ledger.msmeNo))
    throw badRequest('Udyam no should be like UDYAM-DL-07-0012345');
  if (
    ledger.msmeAgreementDays != null &&
    (ledger.msmeAgreementDays < 0 || ledger.msmeAgreementDays > MSME_MAX_PAYMENT_DAYS)
  ) {
    throw badRequest('MSME payment terms cannot be more than 45 days (MSMED Act)');
  }
  if (ledger.isBlacklisted && !ledger.blacklistReason && body.blacklistReason !== undefined)
    throw badRequest('Enter why the party is blacklisted');
}

/** The ledger fields sent (only columns the table has), cleaned and checked. */
async function cleanLedger(body) {
  await ensureLedgerColumns();
  const columns = await ledgerColumnNames();
  const ledger = {};
  for (const field of LEDGER_FIELDS) {
    if (columns.has(field) && body[field] !== undefined) ledger[field] = cleanLedgerValue(field, body[field]);
  }
  if (ledger.name) ledger.name = ledger.name.replace(/\s+/g, ' ');
  for (const field of UPPERCASE_FIELDS) {
    if (ledger[field]) ledger[field] = ledger[field].toUpperCase();
  }
  if (ledger.balanceType && !['Dr', 'Cr'].includes(ledger.balanceType)) ledger.balanceType = 'Dr';
  checkLedgerFormats(ledger, body);
  if (ledger.accountCode) {
    const duplicate = await selectRows('SELECT id FROM AccountLedgers WHERE accountCode = ? AND id <> ?', [
      ledger.accountCode,
      Number(body.id) || 0,
    ]);
    if (duplicate.length) throw badRequest('A/c code ' + ledger.accountCode + ' is already used');
  }
  return ledger;
}

async function auditLedgerQuietly(...args) {
  try {
    await auditLedger(...args);
  } catch {
    // the audit line is extra - the change stands without it
  }
}

const nameTaken = async (name, exceptId) =>
  (exceptId
    ? await selectRows('SELECT id FROM AccountLedgers WHERE lower(name) = lower(?) AND id <> ?', [name, exceptId])
    : await selectRows('SELECT id FROM AccountLedgers WHERE lower(name) = lower(?)', [name])
  ).length > 0;

export async function createLedger(body, userName) {
  const ledger = await cleanLedger(body);
  if (!ledger.name) throw badRequest('Enter the account name');
  if (!ledger.groupId) throw badRequest('Choose the under group');
  if (await nameTaken(ledger.name)) throw badRequest('An account with this name already exists');
  await checkLedgerMaster({ name: ledger.name, gstin: ledger.gstin, partyId: ledger.partyId });
  const stamp = nowIso();
  ledger.createdAt = stamp;
  ledger.updatedAt = stamp;
  if (!ledger.balanceType) ledger.balanceType = 'Dr';
  if (ledger.openingBalance == null) ledger.openingBalance = 0;
  ledger.createdByName = userName || null;
  if (ledger.isActive == null) ledger.isActive = 1;
  const keys = Object.keys(ledger);
  await runSql(
    `INSERT INTO AccountLedgers (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
    keys.map((key) => ledger[key]),
  );
  const created = (await selectRows('SELECT id, name FROM AccountLedgers WHERE name = ?', [ledger.name]))[0];
  await auditLedgerQuietly(null, created && created.id, 'CREATED', userName, null, ledger);
  return created;
}

const changedFields = (before, after, keys) => {
  const changed = {};
  for (const key of keys) {
    if (!['updatedAt', 'modifiedByName'].includes(key) && String(before[key] ?? '') !== String(after[key] ?? ''))
      changed[key] = [before[key], after[key]];
  }
  return changed;
};

export async function updateLedger(id, body, userName) {
  if (!(await selectRows('SELECT id FROM AccountLedgers WHERE id = ?', [id])).length)
    throw notFound('Ledger not found');
  const ledger = await cleanLedger({ ...body, id });
  if (ledger.name === null || ledger.name === '') throw badRequest('Enter the account name');
  if (ledger.name && (await nameTaken(ledger.name, id))) throw badRequest('An account with this name already exists');
  if ('groupId' in ledger && !ledger.groupId) throw badRequest('Choose the under group');
  await checkLedgerMaster({ id, name: ledger.name, gstin: ledger.gstin, partyId: ledger.partyId });
  const before = (await selectRows('SELECT * FROM AccountLedgers WHERE id = ?', [id]))[0];
  ledger.updatedAt = nowIso();
  ledger.modifiedByName = userName || null;
  const keys = Object.keys(ledger);
  await runSql(`UPDATE AccountLedgers SET ${keys.map((key) => key + ' = ?').join(', ')} WHERE id = ?`, [
    ...keys.map((key) => ledger[key]),
    id,
  ]);
  const changed = changedFields(before, ledger, keys);
  if (Object.keys(changed).length) {
    await auditLedgerQuietly(
      null,
      id,
      'CHANGED',
      userName,
      { name: before.name },
      { name: ledger.name || before.name, changed },
    );
  }
}

export async function deleteLedger(id, userName) {
  await ensureLedgerColumns();
  const entries = (await selectRows('SELECT count(*) n FROM VoucherDetails WHERE ledgerId = ?', [id]))[0].n;
  if (entries)
    throw badRequest(
      `This account has ${entries} voucher entries - use Merge Account to move them first, or untick Active`,
    );
  const deleted = (await selectRows('SELECT * FROM AccountLedgers WHERE id = ?', [id]))[0];
  await runSql('DELETE FROM AccLedgerAddresses WHERE ledgerId = ?', [id]);
  await runSql('DELETE FROM AccLedgerBanks WHERE ledgerId = ?', [id]);
  await runSql('DELETE FROM AccLedgerOpenings WHERE ledgerId = ?', [id]);
  await runSql('DELETE FROM AccountLedgers WHERE id = ?', [id]);
  await auditLedgerQuietly(null, id, 'DELETED', userName, deleted || null, null);
}
