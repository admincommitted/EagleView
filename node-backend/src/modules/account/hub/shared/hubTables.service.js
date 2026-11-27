import { runSql } from './hubQuery.service.js';

// The accounts-hub tables are created on first use (and once at startup): CREATE TABLE IF NOT EXISTS only.
const createdTables = new Set();

export async function ensureSimpleTable(table, columns) {
  if (createdTables.has(table)) return;
  await runSql(
    `CREATE TABLE IF NOT EXISTS ${table} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${columns}, createdAt DATETIME, updatedAt DATETIME)`,
  );
  createdTables.add(table);
}

const CHEQUE_LEAVES_COLUMNS = 'bookId INTEGER, chequeNo TEXT, status TEXT, reason TEXT, byUser TEXT';
const TDS_CHALLAN_COLUMNS =
  'month TEXT, section TEXT, challanNo TEXT, bsrCode TEXT, paidOn TEXT, amount REAL, interest REAL, remarks TEXT, byUser TEXT';
const VOUCHER_AUDIT_COLUMNS =
  'voucherId INTEGER, voucherNumber TEXT, action TEXT, byUser TEXT, beforeJson TEXT, afterJson TEXT';

// Trade Invoice extras (bill details, HBL / Master, SEZ, 2nd TDS, Hold Payment, the vendor's credit note against a
// bill): one row per voucher in its own table, so the Vouchers table is not changed
const PURCHASE_INFO_COLUMNS = `voucherId INTEGER UNIQUE, kind TEXT, desk TEXT, billNo TEXT, billDate TEXT, dueDate TEXT, hblNo TEXT, mblNo TEXT,
  isSez TINYINT(1) DEFAULT 0, sezType TEXT, tds1Section TEXT, tds1Amount REAL, tds2Section TEXT, tds2Amount REAL,
  againstVoucherId INTEGER, cnReason TEXT, holdPayment TINYINT(1) DEFAULT 0, holdReason TEXT, holdBy TEXT, holdAt TEXT, createdByName TEXT`;

const INTER_BRANCH_COLUMNS = `ibNo TEXT, type TEXT, fromBranch TEXT, toBranch TEXT, date TEXT, amount REAL, fromLedgerId INTEGER, toLedgerId INTEGER,
  toLines TEXT, refNo TEXT, narration TEXT, status TEXT, raiseVoucherId INTEGER, acceptVoucherId INTEGER, reverseVoucherId INTEGER,
  raisedBy TEXT, decidedBy TEXT, decidedAt TEXT, returnReason TEXT`;

export const ensureChequeLeavesTable = () => ensureSimpleTable('AccChequeLeaves', CHEQUE_LEAVES_COLUMNS);
export const ensureTdsChallansTable = () => ensureSimpleTable('AccTdsChallans', TDS_CHALLAN_COLUMNS);
export const ensureVoucherAuditTable = () => ensureSimpleTable('AccVoucherAudit', VOUCHER_AUDIT_COLUMNS);
export const ensurePurchaseInfoTable = () => ensureSimpleTable('AccPurchaseInfo', PURCHASE_INFO_COLUMNS);
export const ensureInterBranchTable = () => ensureSimpleTable('AccInterBranch', INTER_BRANCH_COLUMNS);

// FinancialPeriods allows one row per year (its periodNo / financialYearId are UNIQUE), so month closing keeps its
// own register: one row per month 'YYYY-MM'
export async function ensureMonthClosingTable() {
  await runSql(
    'CREATE TABLE IF NOT EXISTS AccMonthClosings (id INTEGER PRIMARY KEY AUTOINCREMENT, month VARCHAR(7) NOT NULL UNIQUE, isClosed TINYINT(1) DEFAULT 0, closedBy VARCHAR(100), closedOn DATETIME, createdAt DATETIME, updatedAt DATETIME)',
  );
}
