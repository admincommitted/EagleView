// Is this shipment already on another job? (as iCAFFE warns when a new job repeats an invoice / HAWB)
// Checked when a NEW Import (BE) or Export (SB) job is saved from the screen - a duplicated job keeps the invoices and
// AWB nos of the job it was copied from. Same IEC + same invoice no, or the same HAWB (or MAWB of a direct shipment
// without a HAWB), on a job of the last ~13 months that is not void / cancelled and not a BE amendment copy.
// The screen asks "save anyway?" and sends _dupOk: true to go on.
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

const LOOKBACK_DAYS = 400;
const DAY_MS = 86400000;
const COLUMN_CACHE_MS = 600000;
const MAX_MATCHES = 10;
const MAX_HAWBS_IN_IGM_SEARCH = 10;

const q = (sql, args) => sequelize.query(sql, { replacements: args, type: QueryTypes.SELECT });
const key = (value) =>
  String(value == null ? '' : value)
    .replace(/\s+/g, '')
    .toUpperCase();
const BLANK = new Set(['', 'NA', 'N/A', 'NIL', 'NONE', 'NOMAWB', 'NOHAWB', '0', 'DRAFT']);
const isRealKey = (k) => k && !BLANK.has(k) && !k.endsWith('-INV');
const sinceDay = () => {
  const since = new Date(Date.now() - LOOKBACK_DAYS * DAY_MS);
  return since.toISOString().slice(0, 10).replace(/-/g, '');
};

const columnsCache = {};
async function columnsOf(table) {
  const cached = columnsCache[table];
  if (!cached || Date.now() - cached.at > COLUMN_CACHE_MS) {
    const info = await q(`PRAGMA table_info(${table})`, []);
    columnsCache[table] = { at: Date.now(), set: new Set(info.map((c) => c.name)) };
  }
  return columnsCache[table].set;
}

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

function addMatch(found, row, why) {
  const id = String(row.id);
  if (!found.has(id)) found.set(id, { jobId: row.id, jobNo: row.jobNo, jobDate: row.jobDate || '', why: [] });
  const match = found.get(id);
  if (!match.why.includes(why)) match.why.push(why);
}

// SQL parts for a field: the column, else the value kept in the JSON column (extendedData / additionalData -
// export jobs keep many fields there)
function fieldExpressions(columns, names, alias) {
  const jsonColumn = ['extendedData', 'additionalData'].find((x) => columns.has(x));
  const parts = names.filter((n) => columns.has(n)).map((n) => `nullif(trim(${alias}."${n}"), '')`);
  if (jsonColumn) {
    for (const n of names) {
      parts.push(
        `nullif(trim(CASE WHEN json_valid(${alias}.${jsonColumn}) THEN json_extract(${alias}.${jsonColumn}, '$.${n}') END), '')`,
      );
    }
  }
  return parts;
}
const coalesceOf = (parts) => (parts.length ? `coalesce(${parts.join(', ')}, '')` : "''");
const placeholders = (list) => list.map(() => '?').join(',');

async function check(side, payload) {
  const isImport = side === 'IMPORT';
  const jobTable = isImport ? 'ImportJobs' : 'ExportJobs';
  const invoiceTable = isImport ? 'ImportInvoices' : 'ExportInvoices';
  const foreignKey = isImport ? 'importJobId' : 'exportJobId';
  const jobColumns = await columnsOf(jobTable);
  const invoiceColumns = await columnsOf(invoiceTable);

  const day = `replace(substr(coalesce(nullif(trim(j.jobDate), ''), j.createdAt), 1, 10), '-', '')`;
  const live = [
    `${day} >= ?`,
    "coalesce(j.jobNo, '') NOT LIKE 'AMD/%'",
    "upper(coalesce(j.status, '')) NOT IN ('VOID', 'CANCELLED', 'CANCEL')",
  ];
  if (jobColumns.has('isVoid')) live.push('coalesce(j.isVoid, 0) = 0');
  const liveWhere = live.join(' AND ');
  const notSelf = payload.id ? ' AND j.id <> ?' : '';
  const withBaseArgs = (args) => [sinceDay(), ...(payload.id ? [payload.id] : []), ...args];
  const found = new Map();

  // 1. same exporter / importer IEC + same invoice no
  const iec = key(isImport ? payload.autoField_5 || payload.iecCode : payload.shipperIec || payload.iec);
  const invoiceList = Array.isArray(payload.invoices) ? payload.invoices : [];
  const invoiceNos = [...new Set(invoiceList.map((i) => key(i && (i.invNo || i.invoiceNo || i.no))).filter(isRealKey))];
  const invoiceExpr = `upper(replace(${coalesceOf(fieldExpressions(invoiceColumns, ['invNo', 'invoiceNo', 'no'], 'i'))}, ' ', ''))`;
  const iecNames = isImport ? ['autoField_5', 'iecCode'] : ['shipperIec'];
  const iecExpr = `upper(replace(${coalesceOf(fieldExpressions(jobColumns, iecNames, 'j'))}, ' ', ''))`;
  if (iec && invoiceNos.length && invoiceExpr !== "upper(replace('', ' ', ''))") {
    const rows = await q(
      `SELECT DISTINCT j.id, j.jobNo, j.jobDate, ${invoiceExpr} k FROM ${invoiceTable} i JOIN ${jobTable} j ON j.id = i.${foreignKey}
      WHERE ${liveWhere}${notSelf} AND ${iecExpr} = ? AND ${invoiceExpr} IN (${placeholders(invoiceNos)}) LIMIT 50`,
      withBaseArgs([iec, ...invoiceNos]),
    );
    for (const r of rows) addMatch(found, r, 'Invoice ' + r.k);
  }

  // 2. same HAWB; a MAWB only when neither job has a HAWB (direct shipment - a consol MAWB carries many HAWBs)
  const igmRows = isImport ? parseJsonArray(payload._igmRows) : [];
  const hawbs = [...new Set([payload.hawbNo, ...igmRows.map((r) => r && r.hawbNo)].map(key).filter(isRealKey))];
  const mawbs = [...new Set([payload.mawbNo, ...igmRows.map((r) => r && r.mawbNo)].map(key).filter(isRealKey))];
  const hawbExpr = `upper(replace(${coalesceOf(fieldExpressions(jobColumns, ['hawbNo'], 'j'))}, ' ', ''))`;
  const mawbExpr = `upper(replace(${coalesceOf(fieldExpressions(jobColumns, ['mawbNo'], 'j'))}, ' ', ''))`;
  if (hawbs.length) {
    const rows = await q(
      `SELECT j.id, j.jobNo, j.jobDate, ${hawbExpr} k FROM ${jobTable} j WHERE ${liveWhere}${notSelf} AND ${hawbExpr} IN (${placeholders(hawbs)}) LIMIT 50`,
      withBaseArgs(hawbs),
    );
    for (const r of rows) addMatch(found, r, 'HAWB ' + r.k);
    if (isImport && jobColumns.has('_igmRows')) {
      for (const hawb of hawbs.slice(0, MAX_HAWBS_IN_IGM_SEARCH)) {
        const candidates = await q(
          `SELECT j.id, j.jobNo, j.jobDate, j._igmRows FROM ${jobTable} j WHERE ${liveWhere}${notSelf} AND j._igmRows LIKE ? LIMIT 50`,
          withBaseArgs(['%' + hawb + '%']),
        );
        for (const r of candidates)
          if (parseJsonArray(r._igmRows).some((x) => key(x && x.hawbNo) === hawb)) addMatch(found, r, 'HAWB ' + hawb);
      }
    }
  } else if (mawbs.length) {
    const noHawb = ` AND ${hawbExpr} IN ('', 'NA', 'NIL', 'NOHAWB')`;
    const rows = await q(
      `SELECT j.id, j.jobNo, j.jobDate, ${mawbExpr} k FROM ${jobTable} j WHERE ${liveWhere}${notSelf} AND ${mawbExpr} IN (${placeholders(mawbs)})${noHawb} LIMIT 50`,
      withBaseArgs(mawbs),
    );
    for (const r of rows) addMatch(found, r, 'MAWB ' + r.k);
  }
  return [...found.values()].slice(0, MAX_MATCHES);
}

const jobDateSuffix = (jobDate) => {
  const text = String(jobDate || '');
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return '';
  return ' (' + text.slice(8, 10) + '-' + text.slice(5, 7) + '-' + text.slice(0, 4) + ')';
};

function message(matches) {
  return (
    'This shipment may already be on ' +
    (matches.length === 1 ? 'job ' : 'jobs ') +
    matches.map((m) => `${m.jobNo}${jobDateSuffix(m.jobDate)}: ${m.why.join(', ')}`).join('; ')
  );
}

export { check, message };
