import fs from 'node:fs';
import path from 'node:path';
import { BACKEND_ROOT } from '../../../../config/env.js';
import { runSql, selectRows } from './hubQuery.service.js';
import { ensureSimpleTable } from './hubTables.service.js';

// Ledger Account fields as on iCAFFE's Ledger Account screen. The extra columns are added to AccountLedgers the first
// time they are needed, after a copy of the database is saved in backups\ (VACUUM INTO). Extra addresses, bank
// accounts and the bill-wise opening balance live in their own tables.
export const LEDGER_EXTRA_COLUMNS = {
  accountCode: 'TEXT',
  accountType: 'TEXT',
  dealingBranch: 'TEXT',
  monthlyBudget: 'REAL',
  creditMode: 'TEXT',
  businessType: 'TEXT',
  isUnregistered: 'TINYINT(1) DEFAULT 0',
  isBlacklisted: 'TINYINT(1) DEFAULT 0',
  blacklistReason: 'TEXT',
  isComposite: 'TINYINT(1) DEFAULT 0',
  isFixedDeposit: 'TINYINT(1) DEFAULT 0',
  isTdsExempt: 'TINYINT(1) DEFAULT 0',
  partyTdsLedgerId: 'INTEGER',
  msmeNo: 'TEXT',
  msmeType: 'TEXT',
  msmeActivity: 'TEXT',
  msmeAgreementDays: 'INTEGER',
  isActive: 'TINYINT(1) DEFAULT 1',
  createdByName: 'TEXT',
  modifiedByName: 'TEXT',
};

// the backups folder beside node-backend (EagleView\backups)
const BACKUPS_DIR = path.join(BACKEND_ROOT, '..', 'backups');

let ledgerColumnsReady = false;
let ledgerColumnsSetup = null;
let ledgerColumnNameCache = null;

/** Adds the extra ledger columns and the ledger child tables once; parallel callers share the same run. */
export function ensureLedgerColumns() {
  if (ledgerColumnsReady) return Promise.resolve();
  if (!ledgerColumnsSetup) ledgerColumnsSetup = runLedgerColumnSetup();
  return ledgerColumnsSetup;
}

// a failed setup is tried again by the next caller
async function runLedgerColumnSetup() {
  try {
    await setUpLedgerColumns();
  } catch (error) {
    ledgerColumnsSetup = null;
    throw error;
  }
}

async function backUpDatabaseBeforeChange() {
  try {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  } catch {
    // an existing or unwritable folder: VACUUM INTO reports the real problem
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const file = path.join(BACKUPS_DIR, 'database_before_ledger_fields_' + stamp + '.sqlite');
  await runSql(`VACUUM INTO '${file.replace(/\\/g, '/').replace(/'/g, "''")}'`);
}

async function setUpLedgerColumns() {
  if (ledgerColumnsReady) return;
  const existingColumns = new Set((await selectRows('PRAGMA table_info(AccountLedgers)')).map((column) => column.name));
  const missingColumns = Object.keys(LEDGER_EXTRA_COLUMNS).filter((column) => !existingColumns.has(column));
  if (missingColumns.length) {
    await backUpDatabaseBeforeChange();
    for (const column of missingColumns)
      await runSql(`ALTER TABLE AccountLedgers ADD COLUMN ${column} ${LEDGER_EXTRA_COLUMNS[column]}`);
  }
  await ensureSimpleTable(
    'AccLedgerAddresses',
    'ledgerId INTEGER, label TEXT, address TEXT, city TEXT, state TEXT, pinCode TEXT, country TEXT, gstin TEXT, contactPerson TEXT, phone TEXT, email TEXT, isDefault TINYINT(1) DEFAULT 0',
  );
  await ensureSimpleTable(
    'AccLedgerBanks',
    'ledgerId INTEGER, bankName TEXT, accountName TEXT, accountNo TEXT, ifsc TEXT, branch TEXT, swift TEXT, isDefault TINYINT(1) DEFAULT 0',
  );
  await ensureSimpleTable(
    'AccLedgerOpenings',
    'ledgerId INTEGER, docNo TEXT, docDate TEXT, dueDate TEXT, dc TEXT, amount REAL, jobNo TEXT, remarks TEXT',
  );
  ledgerColumnNameCache = null;
  ledgerColumnsReady = true;
}

/** The column names of AccountLedgers (read once). */
export async function ledgerColumnNames() {
  ledgerColumnNameCache =
    ledgerColumnNameCache ||
    new Set((await selectRows('PRAGMA table_info(AccountLedgers)')).map((column) => column.name));
  return ledgerColumnNameCache;
}
