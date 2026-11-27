import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../../core/http/index.js';
import * as numberSeries from '../../../utils/common/numberSeries.js';
import { firstIssueMessage } from '../shared/firstIssue.js';
import { numberSeriesSchema } from './numberSeries.validation.js';

const DUPLICATE_SERIES_MESSAGE = 'This document, branch, division and year already has a series';
const SHARED_SERIES_NOTE = '  (AE / AI / SE / SI share it)';
const SAMPLE_DIVISION = 'AE';

const selectRows = (sql, replacements = []) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
const runSql = (sql, replacements = []) => sequelize.query(sql, { replacements });
const todayIso = () => new Date().toISOString().slice(0, 10);
const badRequest = (message) => new BadRequestError(message, { body: { error: message } });

/** The values of a series row as the screen sends them, trimmed and typed. */
const cleanSeries = (body) => ({
  docType: String(body.docType || '').trim(),
  branchCode: String(body.branchCode || '')
    .trim()
    .toUpperCase(),
  division: String(body.division || '')
    .trim()
    .toUpperCase(),
  fyCode: String(body.fyCode || '').trim(),
  format: String(body.format || '').trim(),
  pad: parseInt(body.pad, 10) || 0,
  nextNo: parseInt(body.nextNo, 10),
  isActive: body.isActive === false || body.isActive === 0 ? 0 : 1,
});

function checkSeries(series) {
  const problem = firstIssueMessage(numberSeriesSchema, series);
  if (problem) throw badRequest(problem);
}

async function nextNumberOf(row, currentFy, today) {
  if (row.fyCode !== currentFy) return null;
  if (row.division) {
    return numberSeries.peek(row.docType, { branchCode: row.branchCode, division: row.division, date: today });
  }
  return numberSeries.render(row, row.nextNo, today, SAMPLE_DIVISION) + SHARED_SERIES_NOTE;
}

export async function listNumberSeries(date) {
  await numberSeries.ensure();
  const fy = numberSeries.fyCodeOf(date);
  const rows = await selectRows('SELECT * FROM NumberSeries ORDER BY branchCode, division, docType, fyCode DESC');
  const today = todayIso();
  const seriesRows = [];
  for (const row of rows) {
    seriesRows.push({
      ...row,
      label: (numberSeries.DOCS[row.docType] || {}).label || row.docType,
      sample: numberSeries.render(row, row.nextNo, today, row.division || SAMPLE_DIVISION),
      next: await nextNumberOf(row, fy, today),
    });
  }
  const branches = await selectRows(
    'SELECT branchCode, branchName, icaffeCode, stateCode FROM CompanyBranches ORDER BY isDefault DESC, branchCode',
  ).catch(() => []);
  return {
    fy,
    rows: seriesRows,
    docs: Object.entries(numberSeries.DOCS).map(([id, doc]) => ({ id, label: doc.label })),
    divisions: numberSeries.DIVS,
    branches,
  };
}

export async function peekNextNumber({ doc, branch, division, jobNo, date }) {
  const branchCode = branch || (await numberSeries.defaultBranch());
  const no = await numberSeries.peek(String(doc || ''), {
    branchCode,
    division: numberSeries.divOf(division || jobNo),
    date,
  });
  return { no };
}

async function insertSeries(series, userName) {
  const now = new Date().toISOString();
  try {
    await runSql(
      `INSERT INTO NumberSeries (docType, branchCode, division, fyCode, format, pad, nextNo, source, isActive, modifiedBy,
        createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        series.docType,
        series.branchCode,
        series.division,
        series.fyCode,
        series.format,
        series.pad,
        series.nextNo,
        'added by hand',
        series.isActive,
        userName || null,
        now,
        now,
      ],
    );
  } catch (error) {
    if (/UNIQUE/.test(error.message)) {
      throw new ConflictError(DUPLICATE_SERIES_MESSAGE, { body: { error: DUPLICATE_SERIES_MESSAGE } });
    }
    throw error;
  }
}

export async function createSeries(body, userName) {
  await numberSeries.ensure();
  const series = cleanSeries(body || {});
  checkSeries(series);
  await insertSeries(series, userName);
  return { ok: true };
}

// a next number that is already in the books would give a duplicate
async function checkNextNumberIsFree(series) {
  const sampleDate = '20' + series.fyCode.slice(0, 2) + '-06-01';
  const number = numberSeries.render(series, series.nextNo, sampleDate, series.division || SAMPLE_DIVISION);
  const doc = numberSeries.DOCS[series.docType];
  if (!doc) return;
  const used = await selectRows(`SELECT 1 FROM ${doc.table} WHERE ${doc.col} = ? LIMIT 1`, [number]).catch(() => []);
  if (used.length) throw badRequest(number + ' is already used - give a higher next number');
}

export async function updateSeries(id, body, userName) {
  await numberSeries.ensure();
  const existing = (await selectRows('SELECT * FROM NumberSeries WHERE id = ?', [Number(id)]))[0];
  if (!existing) throw new NotFoundError('Not found', { body: { error: 'Not found' } });
  const series = cleanSeries({ ...existing, ...body });
  checkSeries(series);
  await checkNextNumberIsFree(series);
  await runSql(
    'UPDATE NumberSeries SET format = ?, pad = ?, nextNo = ?, isActive = ?, modifiedBy = ?, updatedAt = ? WHERE id = ?',
    [
      series.format,
      series.pad,
      series.nextNo,
      series.isActive,
      userName || null,
      new Date().toISOString(),
      existing.id,
    ],
  );
  return { ok: true };
}

export async function updateBranchCodes(body) {
  await numberSeries.ensure();
  const branch = body || {};
  await runSql('UPDATE CompanyBranches SET icaffeCode = ?, stateCode = ?, updatedAt = ? WHERE branchCode = ?', [
    String(branch.icaffeCode || '').toUpperCase() || null,
    String(branch.stateCode || '').toUpperCase() || null,
    new Date().toISOString(),
    String(branch.branchCode || '').toUpperCase(),
  ]);
  return { ok: true };
}
