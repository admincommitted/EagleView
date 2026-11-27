// Number series as iCAFFE gives them. Settings > Number Series (iCAFFE).
//
// One row per document + branch + division + financial year: the format and the NEXT number. The number is taken
// inside the caller's transaction and the row moves on by one, so two users never get the same number; a number that
// is already in the books is skipped.
//   format tokens: {N} the number (padded to "pad" digits), {YY} the year the FY starts (26), {FY} 2627, {DIV} AE/AI/SE/SI
//   iCAFFE formats (read from iCAFFE, Export Air, New Delhi):
//     Bank voucher   BA/NDL/AE/{N}        Cash voucher  CA/NDL/AE/{N}        Journal  JN/NDL/AE/{N}
//     Service inv.   DL/{YY}/EX/{N} (7)   Other inv.    DL/{YY}/ET/{N} (7)   Docket   NDL/AE/{N}/{YY}
//   Every series starts again at 1 on 1st April (iCAFFE does the same); the new year's row is made from last year's.
// A document whose series is not set is refused, with the place to set it - numbers are never made up.
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

const selectRows = (sql, replacements = [], transaction) =>
  sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction });
const execute = (sql, replacements = [], transaction) => sequelize.query(sql, { replacements, transaction });

async function selectRowsOrEmpty(sql, replacements, transaction) {
  try {
    return await selectRows(sql, replacements, transaction);
  } catch {
    return [];
  }
}

// what each document is (label shown on the settings screen, and which table its numbers live in)
const DOCS = {
  VCH_BANK: { label: 'Bank voucher (receipt / payment / bank transfer)', table: 'Vouchers', col: 'voucherNumber' },
  VCH_CASH: { label: 'Cash voucher (receipt / payment / cash transfer)', table: 'Vouchers', col: 'voucherNumber' },
  VCH_JOURNAL: {
    label: 'Journal (journal, trade / non-trade invoice, debit / credit note)',
    table: 'Vouchers',
    col: 'voucherNumber',
  },
  INV_service: { label: 'GST Invoice - Service', table: 'AccSalesInvoices', col: 'invoiceNo' },
  INV_reimbursable: { label: 'GST Invoice - Reimbursable', table: 'AccSalesInvoices', col: 'invoiceNo' },
  INV_other: { label: 'GST Invoice - Other', table: 'AccSalesInvoices', col: 'invoiceNo' },
  INV_debitnote: { label: 'GST Invoice - Debit Note', table: 'AccSalesInvoices', col: 'invoiceNo' },
  INV_courier: { label: 'GST Invoice - Courier', table: 'AccSalesInvoices', col: 'invoiceNo' },
  INV_creditnote: { label: 'GST Invoice - Credit Note', table: 'AccSalesInvoices', col: 'invoiceNo' },
  INV_consultancy: { label: 'GST Invoice - Consultancy', table: 'AccSalesInvoices', col: 'invoiceNo' },
  INV_can: { label: 'GST Invoice - CAN', table: 'AccSalesInvoices', col: 'invoiceNo' },
  INV_overseas: { label: 'GST Invoice - OverSeas Agent', table: 'AccSalesInvoices', col: 'invoiceNo' },
  INV_freight: { label: 'GST Invoice - Freight (AE/T...)', table: 'AccSalesInvoices', col: 'invoiceNo' },
  DOCKET: { label: 'Docket (Shipment Registration)', table: 'Shipments', col: 'docketNo' },
  BE_AMEND: {
    label: 'BE Amendment (Import) - amended job no, goes on from iCAFFE',
    table: 'BeAmendments',
    col: 'amendNo',
  },
};
const DIVS = ['AE', 'AI', 'SE', 'SI'];

// a number already in the books is skipped, up to this many in a row
const MAX_USED_NUMBERS_SKIPPED = 2000;
const APRIL = 4;
const VOUCHER_BASES_WITH_BOOK = ['Receipt', 'Payment', 'Contra'];

const CREATE_NUMBER_SERIES_TABLE = `CREATE TABLE IF NOT EXISTS NumberSeries (id INTEGER PRIMARY KEY AUTOINCREMENT, docType TEXT NOT NULL, branchCode TEXT NOT NULL, division TEXT NOT NULL DEFAULT '',
    fyCode TEXT NOT NULL, format TEXT NOT NULL, pad INTEGER DEFAULT 0, nextNo INTEGER NOT NULL DEFAULT 1, lastNo TEXT, lastDate TEXT, source TEXT, isActive TINYINT(1) DEFAULT 1,
    modifiedBy TEXT, createdAt DATETIME, updatedAt DATETIME, UNIQUE (docType, branchCode, division, fyCode))`;

const columnNames = (rows) => new Set(rows.map((column) => column.name));

async function createTablesAndColumns() {
  await execute(CREATE_NUMBER_SERIES_TABLE);
  const voucherColumns = columnNames(await selectRows('PRAGMA table_info(Vouchers)'));
  if (!voucherColumns.has('division')) await execute('ALTER TABLE Vouchers ADD COLUMN division TEXT');
  const branchColumns = columnNames(await selectRowsOrEmpty('PRAGMA table_info(CompanyBranches)'));
  if (branchColumns.size && !branchColumns.has('icaffeCode'))
    await execute('ALTER TABLE CompanyBranches ADD COLUMN icaffeCode TEXT');
  if (branchColumns.size && !branchColumns.has('stateCode'))
    await execute('ALTER TABLE CompanyBranches ADD COLUMN stateCode TEXT');
}

let ready = null;
const ensure = () => {
  ready =
    ready ||
    (async () => {
      try {
        await createTablesAndColumns();
      } catch (error) {
        ready = null;
        throw error;
      }
    })();
  return ready;
};

const fyStart = (date) => {
  const isoDate = String(date || new Date().toISOString()).slice(0, 10);
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  return month < APRIL ? year - 1 : year;
};

const fyCodeOf = (date) => {
  const startYear = fyStart(date);
  return String(startYear).slice(2) + String(startYear + 1).slice(2);
};

// {DIV} = the document's division (a branch-wide series - division '' - serves every division, as iCAFFE's BA / CA / JN do)
const render = (row, n, date, div) =>
  String(row.format)
    .replace(/\{YY\}/g, String(fyStart(date)).slice(2))
    .replace(/\{FY\}/g, fyCodeOf(date))
    .replace(/\{DIV\}/g, row.division || div || '')
    .replace(/\{N\}/g, String(n).padStart(Number(row.pad) || 0, '0'));

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

const divOf = (value) => {
  const text = String(value || '').toUpperCase();
  if (DIVS.includes(text)) return text;
  const match = /(?:^|\/|-)(AE|AI|SE|SI)(?:\/|-|$)/.exec(text);
  return match ? match[1] : '';
};

const upper = (value) => String(value || '').toUpperCase();

// the row of this financial year for one exact division; a new year starts from 1 with last year's format
async function rowForDivision(docType, branchCode, division, date, transaction) {
  await ensure();
  const fyCode = fyCodeOf(date);
  const branch = upper(branchCode);
  const divisionCode = upper(division);
  const [current] = await selectRows(
    'SELECT * FROM NumberSeries WHERE docType = ? AND branchCode = ? AND division = ? AND fyCode = ? AND coalesce(isActive, 1) = 1',
    [docType, branch, divisionCode, fyCode],
    transaction,
  );
  if (current) return current;
  const [previous] = await selectRows(
    'SELECT * FROM NumberSeries WHERE docType = ? AND branchCode = ? AND division = ? AND coalesce(isActive, 1) = 1 ORDER BY fyCode DESC LIMIT 1',
    [docType, branch, divisionCode],
    transaction,
  );
  if (!previous) return null;
  const now = new Date().toISOString();
  await execute(
    'INSERT OR IGNORE INTO NumberSeries (docType, branchCode, division, fyCode, format, pad, nextNo, source, isActive, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [
      docType,
      branch,
      divisionCode,
      fyCode,
      previous.format,
      previous.pad,
      1,
      'new year from ' + previous.fyCode,
      1,
      now,
      now,
    ],
    transaction,
  );
  const [created] = await selectRows(
    'SELECT * FROM NumberSeries WHERE docType = ? AND branchCode = ? AND division = ? AND fyCode = ?',
    [docType, branch, divisionCode, fyCode],
    transaction,
  );
  return created;
}

// the division's own series, else the branch-wide series (all divisions)
async function rowFor(docType, branchCode, division, date, transaction) {
  const divisionCode = upper(division);
  const divisionRow = await rowForDivision(docType, branchCode, divisionCode, date, transaction);
  if (divisionRow || !divisionCode) return divisionRow;
  return rowForDivision(docType, branchCode, '', date, transaction);
}

const describeSeries = (docType, branch, division) =>
  DOCS[docType]
    ? `${DOCS[docType].label} - branch ${branch || '?'}${division ? ', division ' + division : ''}`
    : docType;

async function used(docType, documentNo, transaction) {
  const doc = DOCS[docType];
  if (!doc) return false;
  const rows = await selectRowsOrEmpty(
    `SELECT 1 FROM ${doc.table} WHERE ${doc.col} = ? LIMIT 1`,
    [documentNo],
    transaction,
  );
  return !!rows.length;
}

// the first number from the row's next number that is not in the books yet
async function firstFreeNumber(docType, row, date, division, transaction) {
  let number = Number(row.nextNo) || 1;
  let documentNo = render(row, number, date, division);
  for (
    let skipped = 0;
    skipped < MAX_USED_NUMBERS_SKIPPED && (await used(docType, documentNo, transaction));
    skipped++
  ) {
    documentNo = render(row, ++number, date, division);
  }
  return { number, documentNo };
}

/** The number the next document will get (nothing is taken). */
async function peek(docType, { branchCode, division, date } = {}, t) {
  const row = await rowFor(docType, branchCode, division, date, t);
  if (!row) return null;
  const { documentNo } = await firstFreeNumber(docType, row, date, division, t);
  return documentNo;
}

/** Takes the number: moves the series on by one (call inside the caller's transaction). */
async function take(docType, { branchCode, division, date } = {}, t) {
  const row = await rowFor(docType, branchCode, division, date, t);
  if (!row) {
    throw badRequest(
      'Number series not set for ' +
        describeSeries(docType, upper(branchCode), upper(division)) +
        ' - set it in Settings > Number Series (iCAFFE)',
    );
  }
  const { number, documentNo } = await firstFreeNumber(docType, row, date, division, t);
  await execute(
    'UPDATE NumberSeries SET nextNo = ?, lastNo = ?, lastDate = ?, updatedAt = ? WHERE id = ?',
    [number + 1, documentNo, String(date || '').slice(0, 10) || null, new Date().toISOString(), row.id],
    t,
  );
  return documentNo;
}

/** Does a series exist for this document (any year)? Lets older callers keep working until the series is set. */
async function has(docType, branchCode, division, t) {
  await ensure();
  const rows = await selectRows(
    "SELECT 1 FROM NumberSeries WHERE docType = ? AND branchCode = ? AND (division = ? OR division = '') AND coalesce(isActive, 1) = 1 LIMIT 1",
    [docType, upper(branchCode), upper(division)],
    t,
  );
  return !!rows.length;
}

/** Which voucher series a voucher goes to (iCAFFE: bank book BA, cash book CA, everything else JN). */
async function voucherDoc(base, ledgerIds, t) {
  if (!VOUCHER_BASES_WITH_BOOK.includes(base)) return 'VCH_JOURNAL';
  const ids = (ledgerIds || []).map(Number).filter(Boolean);
  if (!ids.length) return 'VCH_BANK';
  const groupRows = await selectRowsOrEmpty(
    `WITH RECURSIVE up(id, parentId, name) AS (SELECT g.id, g.parentId, g.name FROM AccountGroups g JOIN AccountLedgers l ON l.groupId = g.id WHERE l.id IN (${ids.join(',')})
      UNION SELECT g.id, g.parentId, g.name FROM AccountGroups g JOIN up ON g.id = up.parentId) SELECT lower(name) name FROM up`,
    [],
    t,
  );
  const groupNames = groupRows.map((group) => group.name);
  if (groupNames.some((name) => /bank/.test(name))) return 'VCH_BANK';
  if (groupNames.some((name) => /cash/.test(name))) return 'VCH_CASH';
  return 'VCH_BANK';
}

async function defaultBranch(t) {
  const [branch] = await selectRowsOrEmpty(
    "SELECT branchCode FROM CompanyBranches WHERE coalesce(status, 'Active') = 'Active' ORDER BY isDefault DESC, id LIMIT 1",
    [],
    t,
  );
  return branch ? branch.branchCode : '';
}

export { DOCS, DIVS, ensure, peek, take, has, render, fyCodeOf, divOf, voucherDoc, defaultBranch };
