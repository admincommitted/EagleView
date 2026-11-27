import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../../config/database.js';
import { BadRequestError, NotFoundError } from '../../../../core/http/index.js';

/** A SELECT with positional replacements, optionally inside a transaction. */
export const selectRows = (sql, replacements = [], transaction) =>
  sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT,
    transaction,
  });

/** Any other statement (INSERT / UPDATE / DELETE / DDL). */
export const runSql = (sql, replacements = [], transaction) => sequelize.query(sql, { replacements, transaction });

export const startTransaction = () => sequelize.transaction();

export const toNumber = (value) => {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};
export const round2 = (value) => Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const nowIso = () => new Date().toISOString();

/** The 400 every GST invoice check answers: { error: message }. */
export const badRequest = (message) => new BadRequestError(message, { body: { error: message } });
export const invoiceNotFound = () => new NotFoundError('Invoice not found', { body: { error: 'Invoice not found' } });

/** Status carried by an error (an ApiError, or the { status } errors of the number series / ledger checks). */
export const statusOf = (error) => error.statusCode || error.status;

export const parseJsonList = (text) => JSON.parse(text || '[]');

const INVOICE_COLUMNS = `kind TEXT, invoiceNo TEXT UNIQUE, date TEXT, branchCode TEXT, voucherId INTEGER, status TEXT, partyType TEXT, partyName TEXT, partyId INTEGER,
  partyBranchId INTEGER, ledgerId INTEGER, address TEXT, gstin TEXT, stateName TEXT, stateCode TEXT, pos TEXT, posName TEXT, sez TEXT, paymentOption TEXT,
  countryCode TEXT, currency TEXT, exRate REAL, costCentre TEXT, roundOff INTEGER, gstExempt INTEGER, hideExRate INTEGER, rcm INTEGER, withOut INTEGER,
  prevInvoiceId INTEGER, prevInvoiceNo TEXT, prevInvoiceDate TEXT, reason TEXT, docketBy TEXT, jobNo TEXT, hawbNo TEXT, mawbNo TEXT, quotationNo TEXT,
  email TEXT, advance REAL, remarks TEXT, linesJson TEXT, chargeTotal REAL, grossInr REAL, igst REAL, cgst REAL, sgst REAL, roundOffAmt REAL, total REAL,
  totalFcy REAL, voidReason TEXT, createdBy TEXT, modifiedBy TEXT, bulk INTEGER, dockets TEXT, irn TEXT, ackNo TEXT, ackDate TEXT, signedQr TEXT, irnStatus TEXT,
  irnCancelReason TEXT, mailLog TEXT, division TEXT`;
const PROVISIONAL_COLUMNS =
  'jobNo TEXT UNIQUE, partyName TEXT, linesJson TEXT, remarks TEXT, createdBy TEXT, modifiedBy TEXT';
export const DELETED_INVOICES_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS AccSalesInvoiceDeleted (id INTEGER PRIMARY KEY AUTOINCREMENT, invoiceId INTEGER, invoiceNo TEXT, dataJson TEXT, voucherJson TEXT, deletedBy TEXT, createdAt DATETIME, updatedAt DATETIME)';

// [name, type] of each column; UNIQUE cannot be used when a column is added to an existing table
const columnList = (sql) =>
  sql
    .split(',')
    .map((column) => column.trim().split(/\s+/))
    .filter((parts) => parts[0])
    .map((parts) => [
      parts[0],
      parts
        .slice(1)
        .join(' ')
        .replace(/UNIQUE/i, '')
        .trim(),
    ]);

const columnNames = async (table) =>
  new Set((await selectRows(`PRAGMA table_info(${table})`)).map((column) => column.name));

async function createInvoiceTables() {
  await runSql(
    `CREATE TABLE IF NOT EXISTS AccSalesInvoices (id INTEGER PRIMARY KEY AUTOINCREMENT, ${INVOICE_COLUMNS}, createdAt DATETIME, updatedAt DATETIME)`,
  );
  // columns added after the first release are added to an existing table on first use
  const invoiceColumns = await columnNames('AccSalesInvoices');
  for (const [column, type] of columnList(INVOICE_COLUMNS)) {
    if (!invoiceColumns.has(column)) await runSql(`ALTER TABLE AccSalesInvoices ADD COLUMN ${column} ${type}`);
  }
  await runSql('CREATE INDEX IF NOT EXISTS idx_accsalesinv_voucher ON AccSalesInvoices (voucherId)');
  await runSql(
    `CREATE TABLE IF NOT EXISTS AccProvisionalSheets (id INTEGER PRIMARY KEY AUTOINCREMENT, ${PROVISIONAL_COLUMNS}, createdAt DATETIME, updatedAt DATETIME)`,
  );
  await runSql(DELETED_INVOICES_TABLE_SQL);
  await runSql('CREATE INDEX IF NOT EXISTS idx_accsalesinv_job ON AccSalesInvoices (jobNo)');
  await runSql('CREATE INDEX IF NOT EXISTS idx_accsalesinv_kind_date ON AccSalesInvoices (kind, date)');
  await runSql('CREATE INDEX IF NOT EXISTS idx_accsalesinv_prev ON AccSalesInvoices (prevInvoiceId)');
  // iCAFFE: a party is billed only through its account (ledger) - the party master id is kept on its ledger
  const ledgerColumns = await columnNames('AccountLedgers');
  if (!ledgerColumns.has('partyId')) await runSql('ALTER TABLE AccountLedgers ADD COLUMN partyId INTEGER');
  // the same column the Ledger Account screen adds
  if (!ledgerColumns.has('isActive')) await runSql('ALTER TABLE AccountLedgers ADD COLUMN isActive TINYINT(1)');
}

let tablesReady = null;

/** Makes the GST invoice tables (and the columns they need) once; a failure is retried on the next call. */
export const ensureInvoiceTables = () => {
  tablesReady =
    tablesReady ||
    createInvoiceTables().catch((error) => {
      tablesReady = null;
      throw error;
    });
  return tablesReady;
};
