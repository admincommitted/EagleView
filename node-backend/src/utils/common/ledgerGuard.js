// Ledger mix-up guard. One party's entry must never land on, or be set off against, another party's ledger.
//
// The iCAFFE accounts carry look-alike ledgers: names that differ only in spaces / dots ("SG ENTERPRISES." and
// "SG ENTERPRISES"), GSTINs on more than one ledger (some on two different companies, some junk like "1111"), and
// parties tied to two ledgers. So nothing is ever guessed. The rules here, used by vouchers, GST invoices, OCR and the
// ledger master:
//   - a ledger is only ever found when exactly ONE fits; when more than one fits, nothing is guessed - the screen gets the
//     names and the user picks the account;
//   - every line of a voucher must be an existing, active ledger;
//   - a bill set-off must be for the same party: the allocation's ledger must be on the voucher, and the bill it is set
//     against must carry that same ledger;
//   - a new / renamed ledger may not look like an existing one (same letters and digits) and may not take a GSTIN that
//     another party's ledger already has (two accounts of the same party - same party link - are allowed);
//   - ledger create / change / delete / merge are written to AccLedgerAudit (who, when, before / after).
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

// __noScope: the top-bar branch scope is not applied to these reads
const selectRows = (sql, replacements = [], transaction) =>
  sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT,
    transaction,
    __noScope: true,
  });
const execute = (sql, replacements = [], transaction) => sequelize.query(sql, { replacements, transaction });
const badRequest = (message, extra) => Object.assign(new Error(message), { status: 400 }, extra || {});

// letters and digits only: "SG ENTERPRISES." = "S.G. ENTERPRISES" = "SGENTERPRISES"
const key = (text) =>
  String(text || '')
    .toUpperCase()
    .replace(/&/g, 'AND')
    .replace(/[^A-Z0-9]/g, '');
const GSTIN_RX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const cleanGstin = (gstin) =>
  String(gstin || '')
    .toUpperCase()
    .replace(/\s/g, '');
const validGstin = (gstin) => GSTIN_RX.test(cleanGstin(gstin));

const NAME_PREFIX_LENGTH = 6;
const CANDIDATES_IN_MESSAGE = 5;
const CANDIDATES_RETURNED = 10;

let hasActive = null;
async function activeCol(transaction) {
  if (hasActive === null) {
    const columns = await selectRows('PRAGMA table_info(AccountLedgers)', [], transaction);
    hasActive = columns.some((column) => column.name === 'isActive');
  }
  return hasActive ? 'coalesce(isActive, 1) = 1' : '1 = 1';
}

// exactly one ledger fits: its id; none: null; more than one: an error with the names (nothing is guessed)
function pickSingle(rows, how) {
  if (rows.length === 1) return rows[0].id;
  if (rows.length > 1) {
    const names = rows
      .slice(0, CANDIDATES_IN_MESSAGE)
      .map((row) => row.name)
      .join(' / ');
    throw badRequest('More than one account ' + how + ': ' + names + ' - pick the account (Ledger) by hand', {
      candidates: rows.slice(0, CANDIDATES_RETURNED),
    });
  }
  return null;
}

// a GSTIN hit is used only when the name also fits (a GSTIN typed against the wrong party must not move the entry)
function ledgersFittingName(rows, name) {
  const nameKey = key(name);
  if (!nameKey) return rows;
  const fitting = rows.filter((row) => {
    const rowKey = key(row.name);
    return (
      rowKey.startsWith(nameKey.slice(0, NAME_PREFIX_LENGTH)) || nameKey.startsWith(rowKey.slice(0, NAME_PREFIX_LENGTH))
    );
  });
  return fitting;
}

/** One ledger by party / GSTIN / name - or an error listing the look-alikes. */
async function findOne({ ledgerId, partyId, gstin, name }, t) {
  const activeCondition = await activeCol(t);
  if (ledgerId) {
    const [ledger] = await selectRows(
      `SELECT id, name FROM AccountLedgers WHERE id = ? AND ${activeCondition}`,
      [Number(ledgerId)],
      t,
    );
    if (!ledger) throw badRequest('The account picked is not an active ledger any more - pick it again');
    return ledger.id;
  }
  if (partyId) {
    const rows = await selectRows(
      `SELECT id, name FROM AccountLedgers WHERE partyId = ? AND ${activeCondition}`,
      [Number(partyId)],
      t,
    );
    const id = pickSingle(rows, 'is tied to this party');
    if (id) return id;
  }
  const gstinText = cleanGstin(gstin);
  if (validGstin(gstinText)) {
    const rows = await selectRows(
      `SELECT id, name FROM AccountLedgers WHERE upper(replace(gstin, ' ', '')) = ? AND ${activeCondition}`,
      [gstinText],
      t,
    );
    const fitting = ledgersFittingName(rows, name);
    const id = pickSingle(fitting.length ? fitting : key(name) ? [] : rows, 'has GSTIN ' + gstinText);
    if (id) return id;
  }
  const nameKey = key(name);
  if (nameKey) {
    const rows = (await selectRows(`SELECT id, name FROM AccountLedgers WHERE ${activeCondition}`, [], t)).filter(
      (row) => key(row.name) === nameKey,
    );
    const id = pickSingle(rows, 'has this name');
    if (id) return id;
  }
  return null;
}

async function ledgersByIds(ids, t) {
  const idList = ids.join(',');
  const activeColumn = hasActive !== false ? ', coalesce(isActive, 1) act' : '';
  try {
    return await selectRows(`SELECT id, name${activeColumn} FROM AccountLedgers WHERE id IN (${idList})`, [], t);
  } catch {
    hasActive = false;
    return selectRows(`SELECT id, name FROM AccountLedgers WHERE id IN (${idList})`, [], t);
  }
}

/** Every line: an existing, active ledger. */
async function checkLines(ledgerIds, t) {
  const ids = [...new Set((ledgerIds || []).map(Number).filter(Boolean))];
  if (!ids.length) return;
  const ledgers = await ledgersByIds(ids, t);
  const found = new Map(ledgers.map((ledger) => [Number(ledger.id), ledger]));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) {
    throw badRequest(
      'Account not found (id ' + missing.join(', ') + ') - it may have been merged or deleted; pick the account again',
    );
  }
  const inactive = ledgers.filter((ledger) => ledger.act !== undefined && Number(ledger.act) === 0);
  if (inactive.length) {
    throw badRequest(
      'Account ' + inactive.map((ledger) => ledger.name).join(', ') + ' is inactive - pick an active account',
    );
  }
}

/** A set-off is for the voucher's own party and against a bill of that same party. */
async function checkAllocations(allocs, lineLedgerIds, selfId, t) {
  const ledgersOnVoucher = new Set((lineLedgerIds || []).map(Number));
  for (const allocation of allocs || []) {
    const ledgerId = Number(allocation.ledgerId);
    if (!ledgerId) continue;
    if (!ledgersOnVoucher.has(ledgerId)) {
      throw badRequest(
        'A bill is set off for an account that is not on this voucher - set off only the party of this voucher',
      );
    }
    const againstVoucherId = Number(allocation.againstVoucherId) || null;
    if (!againstVoucherId) continue;
    if (selfId && againstVoucherId === Number(selfId)) throw badRequest('A voucher cannot be set off against itself');
    const billLine = await selectRows(
      'SELECT 1 FROM VoucherDetails WHERE voucherId = ? AND ledgerId = ? LIMIT 1',
      [againstVoucherId, ledgerId],
      t,
    );
    if (!billLine.length) {
      const [bill] = await selectRows('SELECT voucherNumber FROM Vouchers WHERE id = ?', [againstVoucherId], t);
      throw badRequest(
        'Bill ' +
          (bill ? bill.voucherNumber : '#' + againstVoucherId) +
          ' is not a bill of this party - it cannot be set off here',
      );
    }
  }
}

async function checkNameIsNew(id, name, previous, t) {
  const nameKey = key(name);
  if (!nameKey || (previous && key(previous.name) === nameKey)) return;
  const sameName = (await selectRows('SELECT id, name FROM AccountLedgers WHERE id <> ?', [Number(id) || 0], t)).filter(
    (ledger) => key(ledger.name) === nameKey,
  );
  if (sameName.length) {
    throw badRequest(
      'An account "' +
        sameName[0].name +
        '" already exists - it differs only in spaces / dots. Use that account (or Merge Account) instead of a second one.',
    );
  }
}

async function checkGstinIsFree(id, gstin, partyId, previous, t) {
  const gstinText = cleanGstin(gstin);
  if (!gstinText || (previous && cleanGstin(previous.gstin) === gstinText)) return;
  const [current] = id ? await selectRows('SELECT partyId FROM AccountLedgers WHERE id = ?', [Number(id)], t) : [null];
  const ownPartyId = partyId || (current && current.partyId) || null;
  const otherParties = (
    await selectRows(
      "SELECT id, name, partyId FROM AccountLedgers WHERE id <> ? AND upper(replace(gstin, ' ', '')) = ?",
      [Number(id) || 0, gstinText],
      t,
    )
  ).filter((ledger) => !(ownPartyId && ledger.partyId && Number(ledger.partyId) === Number(ownPartyId)));
  if (otherParties.length) {
    throw badRequest(
      'GSTIN ' +
        gstinText +
        ' is already on account "' +
        otherParties[0].name +
        '" - one GSTIN belongs to one party. Check the GSTIN, or use that account.',
    );
  }
}

/** A new / changed ledger must not look like another one or take another party's GSTIN. */
async function checkLedgerMaster({ id, name, gstin, partyId }, t) {
  // only what is new or changed is checked (the iCAFFE look-alikes already in the books can still be edited)
  const [previous] = id
    ? await selectRows('SELECT name, gstin, partyId FROM AccountLedgers WHERE id = ?', [Number(id)], t)
    : [null];
  await checkNameIsNew(id, name, previous, t);
  await checkGstinIsFree(id, gstin, partyId, previous, t);
}

const CREATE_AUDIT_TABLE = `CREATE TABLE IF NOT EXISTS AccLedgerAudit (id INTEGER PRIMARY KEY AUTOINCREMENT, ledgerId INTEGER, ledgerName TEXT, action TEXT, byUser TEXT,
    beforeJson TEXT, afterJson TEXT, createdAt DATETIME)`;

let auditReady = null;
function ensureAuditTable() {
  auditReady =
    auditReady ||
    (async () => {
      try {
        await execute(CREATE_AUDIT_TABLE);
        await execute('CREATE INDEX IF NOT EXISTS idx_accledaudit_ledger ON AccLedgerAudit (ledgerId)');
      } catch (error) {
        auditReady = null;
        throw error;
      }
    })();
  return auditReady;
}

async function auditLedger(t, ledgerId, action, by, before, after) {
  await ensureAuditTable();
  const ledgerName = (after && after.name) || (before && before.name) || null;
  await execute(
    'INSERT INTO AccLedgerAudit (ledgerId, ledgerName, action, byUser, beforeJson, afterJson, createdAt) VALUES (?,?,?,?,?,?,?)',
    [
      ledgerId || null,
      ledgerName,
      action,
      by || null,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      new Date().toISOString(),
    ],
    t,
  );
}

// groups of rows that share the same non-empty key, only where more than one row shares it
function sharedBy(rows, keyOf) {
  const groups = new Map();
  for (const row of rows) {
    const groupKey = keyOf(row);
    if (!groupKey) continue;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(row);
  }
  return [...groups.entries()].filter(([, members]) => members.length > 1);
}

/** Look-alike report: names, GSTINs and party links that point at more than one ledger. */
async function lookAlikes() {
  const ledgers = await selectRows(
    'SELECT l.id, l.name, l.gstin, l.partyId, l.icaffeId, g.name groupName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId',
  );
  const report = [];
  for (const [, accounts] of sharedBy(ledgers, (ledger) => key(ledger.name))) {
    report.push({ check: 'Same name (only spaces / dots differ)', value: accounts[0].name, accounts });
  }
  for (const [gstin, accounts] of sharedBy(ledgers, (ledger) => cleanGstin(ledger.gstin) || null)) {
    const check = validGstin(gstin) ? 'Same GSTIN on more than one account' : 'Invalid GSTIN on more than one account';
    report.push({ check, value: gstin, accounts });
  }
  for (const [partyId, accounts] of sharedBy(ledgers, (ledger) => ledger.partyId || null)) {
    report.push({ check: 'One party tied to more than one account', value: 'party #' + partyId, accounts });
  }
  return report;
}

export { key, findOne, checkLines, checkAllocations, checkLedgerMaster, auditLedger, lookAlikes };
