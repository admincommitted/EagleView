import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { BadRequestError, NotFoundError } from '../../../core/http/index.js';
import { cess, cvd, tariffvalue } from '../../../utils/customs/dutyListTables.js';

/*
 * Customs duty lists, mounted at /api/tariff/dutylists:
 *   add          anti-dumping duty rows      table AddDutyRates (filled from iCAFFE by load_icaffe_antidumping.js; view only)
 *   cvd          countervailing duty rows    table CvdDutyRates
 *   cess         export cess rows            table ExportCessRates
 *   tariffvalue  tariff values (36/2001)     table TariffValueRates
 * The three editable tables are made on first use (CREATE TABLE IF NOT EXISTS), so the screen works before any loader
 * ran. A row is switched off from the screen, never deleted.
 */
const TEXT = 's';
const NUMBER = 'n';
const column = (name, type, options = {}) => ({ name, type, ...options });

const KINDS = {
  add: {
    table: 'AddDutyRates',
    readOnly: true,
    order: 'notifDate DESC, notifNo DESC, CAST(serialNo AS INTEGER), CAST(cthSlNo AS INTEGER)',
    cols: [
      column('notifNo', TEXT),
      column('notifDate', TEXT),
      column('endDate', TEXT),
      column('serialNo', TEXT),
      column('cthSlNo', TEXT),
      column('cth', TEXT),
      column('specSeries', TEXT),
      column('originCountry', TEXT),
      column('exportCountry', TEXT),
      column('flag', TEXT),
      column('rate', NUMBER),
      column('amount', NUMBER),
      column('uqc', TEXT),
      column('currency', TEXT),
      column('memorandum', TEXT),
    ],
    search: ['notifNo', 'cth', 'originCountry', 'exportCountry', 'memorandum'],
  },
  cvd: {
    table: 'CvdDutyRates',
    order: 'notifNo DESC, CAST(serialNo AS INTEGER), CAST(itemSlNo AS INTEGER), CAST(suppSlNo AS INTEGER)',
    cols: [
      column('notifNo', TEXT, { req: true, max: 20 }),
      column('serialNo', TEXT, { max: 10 }),
      column('itemSlNo', TEXT, { max: 10 }),
      column('suppSlNo', TEXT, { max: 10 }),
      column('cth', TEXT, { req: true, max: 8 }),
      column('originCountry', TEXT, { max: 2 }),
      column('exportCountry', TEXT, { max: 2 }),
      column('rate', NUMBER),
      column('calcMethod', TEXT, { max: 40 }),
      column('description', TEXT, { max: 500 }),
      column('exporter', TEXT, { max: 300 }),
      column('producer', TEXT, { max: 300 }),
    ],
    search: ['notifNo', 'cth', 'originCountry', 'exportCountry', 'description', 'producer', 'exporter'],
    ddl: cvd.ddl,
    idx: cvd.idx,
  },
  cess: {
    table: 'ExportCessRates',
    order: 'ritc, CAST(serialNo AS INTEGER)',
    cols: [
      column('ritc', TEXT, { max: 8 }),
      column('serialNo', TEXT, { max: 10 }),
      column('tariffValue', NUMBER),
      column('tariffUnit', TEXT, { max: 10 }),
      column('ratePercent', NUMBER),
      column('rateRs', NUMBER),
      column('unit', TEXT, { max: 10 }),
      column('description', TEXT, { max: 300 }),
    ],
    search: ['ritc', 'description'],
    ddl: cess.ddl,
    idx: cess.idx,
  },
  tariffvalue: {
    table: 'TariffValueRates',
    order: 'cth, CAST(serialNo AS INTEGER)',
    cols: [
      column('notifNo', TEXT, { req: true, max: 20 }),
      column('serialNo', TEXT, { max: 10 }),
      column('cth', TEXT, { req: true, max: 8 }),
      column('description', TEXT, { req: true, max: 300 }),
      column('tariffValue', NUMBER, { req: true }),
      column('currency', TEXT, { max: 3 }),
      column('uqc', TEXT, { max: 6 }),
      column('effectiveDate', TEXT, { max: 10 }),
    ],
    search: ['notifNo', 'cth', 'description'],
    ddl: tariffvalue.ddl,
    idx: tariffvalue.idx,
  },
};

const UPPER_CASE_COLUMNS = ['cth', 'ritc', 'originCountry', 'exportCountry', 'currency', 'uqc', 'tariffUnit', 'unit'];
const CODE_COLUMNS = ['cth', 'ritc'];
const CODE_PATTERN = /^\d{2,8}$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const READ_ONLY_MESSAGE = 'This list is loaded from iCAFFE and is not changed here';

const failed = (ErrorClass, message) => new ErrorClass(message, { body: { error: message } });

let tablesReady = null;

async function createTables() {
  for (const kind of Object.values(KINDS)) {
    if (!kind.ddl) continue;
    await sequelize.query(kind.ddl);
    for (const indexColumn of kind.idx || []) {
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${kind.table.toLowerCase()}_${indexColumn.toLowerCase()} ON ${kind.table} (${indexColumn})`,
      );
    }
  }
}

/** The editable tables are created once, on first use; a failed attempt is tried again next time. */
function ensureTables() {
  if (!tablesReady) {
    tablesReady = (async () => {
      try {
        await createTables();
      } catch (error) {
        tablesReady = null;
        throw error;
      }
    })();
  }
  return tablesReady;
}

const hasTable = async (table) =>
  (
    await sequelize.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", {
      replacements: [table],
      type: QueryTypes.SELECT,
    })
  ).length > 0;

// the SQLite text stamp Sequelize writes
const nowSql = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');

/** The list of a kind; 404 { error: 'Unknown list' } when there is none. */
function kindOf(kindName) {
  const kind = KINDS[String(kindName || '').toLowerCase()];
  if (!kind) throw failed(NotFoundError, 'Unknown list');
  return kind;
}

function editableKindOf(kindName) {
  const kind = kindOf(kindName);
  if (kind.readOnly) throw failed(BadRequestError, READ_ONLY_MESSAGE);
  return kind;
}

function cleanNumber(columnSpec, raw, values) {
  if (raw === '' || raw === null || raw === undefined) {
    if (columnSpec.req) return `${columnSpec.name} is required`;
    values[columnSpec.name] = null;
    return null;
  }
  const number = Number(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(number) || number < 0) return `${columnSpec.name} must be a number, 0 or more`;
  values[columnSpec.name] = number;
  return null;
}

function cleanText(columnSpec, raw, values) {
  let text = String(raw === null || raw === undefined ? '' : raw).trim();
  if (UPPER_CASE_COLUMNS.includes(columnSpec.name)) text = text.toUpperCase();
  if (!text && columnSpec.req) return `${columnSpec.name} is required`;
  if (columnSpec.max && text.length > columnSpec.max)
    return `${columnSpec.name} is too long (${columnSpec.max} characters at most)`;
  if (CODE_COLUMNS.includes(columnSpec.name) && text && !CODE_PATTERN.test(text))
    return `${columnSpec.name.toUpperCase()} must be 2 to 8 digits`;
  if (columnSpec.name === 'effectiveDate' && text && !ISO_DAY.test(text)) return 'Date must be YYYY-MM-DD';
  values[columnSpec.name] = text || null;
  return null;
}

/** One row from the form: trimmed, codes upper-cased, numbers as numbers; 400 with the first problem. */
function cleanRow(kind, body) {
  const values = {};
  for (const columnSpec of kind.cols) {
    const raw = body[columnSpec.name];
    const problem =
      columnSpec.type === NUMBER ? cleanNumber(columnSpec, raw, values) : cleanText(columnSpec, raw, values);
    if (problem) throw failed(BadRequestError, problem);
  }
  return values;
}

const columnNamesOf = (kind) => kind.cols.map((columnSpec) => columnSpec.name);

function rowId(idText) {
  const id = parseInt(idText, 10);
  if (!id) throw failed(BadRequestError, 'Bad id');
  return id;
}

/** GET /: total and active rows of each list. */
export async function listCounts() {
  await ensureTables();
  const counts = {};
  for (const [key, kind] of Object.entries(KINDS)) {
    if (!(await hasTable(kind.table))) {
      counts[key] = { total: 0, active: 0 };
      continue;
    }
    const [row] = await sequelize.query(
      `SELECT count(*) total, coalesce(sum(CASE WHEN isActive = 1 THEN 1 ELSE 0 END), 0) active FROM ${kind.table}`,
      { type: QueryTypes.SELECT },
    );
    counts[key] = { total: row.total, active: row.active };
  }
  return counts;
}

function searchConditions(kind, { inactive, q }) {
  const conditions = [];
  const replacements = [];
  if (String(inactive || '') !== '1') conditions.push('isActive = 1');
  const text = String(q || '').trim();
  if (text) {
    conditions.push(`(${kind.search.map((searchColumn) => `${searchColumn} LIKE ?`).join(' OR ')})`);
    // codes match from their start, other columns anywhere
    for (const searchColumn of kind.search)
      replacements.push(`${CODE_COLUMNS.includes(searchColumn) ? '' : '%'}${text}%`);
  }
  return { where: conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '', replacements };
}

/** GET /:kind?q=&page=&limit=&inactive=1 -> { rows, total, page, limit } */
export async function listRows(kindName, query) {
  const kind = kindOf(kindName);
  await ensureTables();
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  if (!(await hasTable(kind.table))) return { rows: [], total: 0, page: 1, limit };
  const { where, replacements } = searchConditions(kind, query);
  const [{ n: total }] = await sequelize.query(`SELECT count(*) n FROM ${kind.table}${where}`, {
    replacements,
    type: QueryTypes.SELECT,
  });
  const rows = await sequelize.query(
    `SELECT id, ${columnNamesOf(kind).join(', ')}, isActive FROM ${kind.table}${where} ORDER BY ${kind.order} LIMIT ? OFFSET ?`,
    { replacements: [...replacements, limit, (page - 1) * limit], type: QueryTypes.SELECT },
  );
  return { rows, total, page, limit };
}

/** POST /:kind - a manual row (source MANUAL, active). */
export async function addRow(kindName, body) {
  const kind = editableKindOf(kindName);
  await ensureTables();
  const values = cleanRow(kind, body);
  const names = columnNamesOf(kind);
  const stamp = nowSql();
  const [id] = await sequelize.query(
    `INSERT INTO ${kind.table} (${names.join(', ')}, source, isActive, createdAt, updatedAt) VALUES (${names.map(() => '?').join(', ')}, 'MANUAL', 1, ?, ?)`,
    { replacements: [...names.map((name) => values[name]), stamp, stamp], type: QueryTypes.INSERT },
  );
  return { id, ...values, isActive: 1 };
}

const rowNotFound = () => failed(NotFoundError, 'Row not found');

/** PUT /:kind/:id/active { isActive } */
export async function setRowActive(kindName, idText, isActiveFlag) {
  const kind = editableKindOf(kindName);
  await ensureTables();
  const id = rowId(idText);
  const isActive = isActiveFlag === true || isActiveFlag === 1 || isActiveFlag === '1' ? 1 : 0;
  const [, meta] = await sequelize.query(`UPDATE ${kind.table} SET isActive = ?, updatedAt = ? WHERE id = ?`, {
    replacements: [isActive, nowSql(), id],
  });
  if (meta && meta.changes === 0) throw rowNotFound();
  return { id, isActive };
}

/** PUT /:kind/:id - changes a row. */
export async function updateRow(kindName, idText, body) {
  const kind = editableKindOf(kindName);
  await ensureTables();
  const id = rowId(idText);
  const values = cleanRow(kind, body);
  const names = columnNamesOf(kind);
  const [, meta] = await sequelize.query(
    `UPDATE ${kind.table} SET ${names.map((name) => `${name} = ?`).join(', ')}, updatedAt = ? WHERE id = ?`,
    { replacements: [...names.map((name) => values[name]), nowSql(), id] },
  );
  if (meta && meta.changes === 0) throw rowNotFound();
  return { id, ...values };
}
