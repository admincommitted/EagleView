import * as numberSeries from '../../../utils/common/numberSeries.js';
import { execute, selectRows } from './shipments.tables.js';

/**
 * Docket no: <branch>/<division>/<serial>/<yy>, e.g. DEL/AI/1001/26 - one series per branch, division and financial
 * year (April-March). A branch with an iCAFFE DOCKET series in Settings > Number Series uses that one instead.
 */
const FIRST_DOCKET_SERIAL = 1001;
const MAX_SERIAL_PROBES = 5000;
const APRIL = 4;
const HEAD_OFFICE_ICAFFE_CODE = 'NDL';

export const today = () => new Date().toISOString().slice(0, 10);

function financialYearStart(date) {
  const text = String(date || today());
  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(5, 7));
  return month < APRIL ? year - 1 : year;
}

/** "2526" for the year April 2025 - March 2026. */
export function financialYearKey(date) {
  const start = financialYearStart(date);
  return String(start).slice(2) + String(start + 1).slice(2);
}

const docketNumberOf = (branch, division, serial, date) =>
  `${String(branch).toUpperCase()}/${division}/${serial}/${String(financialYearStart(date)).slice(2)}`;

const SERIES_SQL = 'SELECT * FROM ShipmentSeries WHERE branchCode = ? AND division = ? AND fy = ?';

/** The series row of a branch / division / year (made on first use, starting at 1001). */
export async function seriesRow(branch, division, date, transaction) {
  const existing = (await selectRows(SERIES_SQL, [branch, division, financialYearKey(date)], transaction))[0];
  if (existing) return existing;
  const now = new Date().toISOString();
  await execute(
    'INSERT OR IGNORE INTO ShipmentSeries (branchCode, division, fy, nextNo, createdAt, updatedAt) VALUES (?,?,?,?,?,?)',
    [branch, division, financialYearKey(date), FIRST_DOCKET_SERIAL, now, now],
    transaction,
  );
  return (await selectRows(SERIES_SQL, [branch, division, financialYearKey(date)], transaction))[0];
}

/** The next free docket number; `take` uses it up (the series moves on). */
export async function nextDocket(branch, division, date, transaction, take) {
  if (await numberSeries.has('DOCKET', branch, division, transaction)) {
    const context = { branchCode: branch, division, date };
    return take ? numberSeries.take('DOCKET', context, transaction) : numberSeries.peek('DOCKET', context, transaction);
  }
  const series = await seriesRow(branch, division, date, transaction);
  let serial = Number(series.nextNo) || FIRST_DOCKET_SERIAL;
  for (let probe = 0; probe < MAX_SERIAL_PROBES; probe++) {
    const number = docketNumberOf(branch, division, serial, date);
    if (!(await selectRows('SELECT id FROM Shipments WHERE docketNo = ?', [number], transaction)).length) break;
    serial++;
  }
  if (take) {
    await execute(
      'UPDATE ShipmentSeries SET nextNo = ?, updatedAt = ? WHERE id = ?',
      [serial + 1, new Date().toISOString(), series.id],
      transaction,
    );
  }
  return docketNumberOf(branch, division, serial, date);
}

/**
 * The iCAFFE dockets carry iCAFFE's branch code (NDL, MUM ...) while the screen sends the Branch Master code (DEL ...):
 * a branch also takes its iCAFFE code (Settings > Number Series), and the default branch iCAFFE's head office NDL.
 */
export async function branchCodesOf(branch) {
  const code = String(branch || '')
    .trim()
    .toUpperCase();
  const codes = new Set([code]);
  const branches = await selectRows('SELECT branchCode, icaffeCode, isDefault FROM CompanyBranches').catch(() => []);
  for (const row of branches) {
    if (
      String(row.branchCode || '')
        .trim()
        .toUpperCase() !== code
    )
      continue;
    if (row.icaffeCode)
      codes.add(
        String(row.icaffeCode)
          .trim()
          .toUpperCase()
          .replace(/^OFF\/?/, ''),
      );
    if (Number(row.isDefault) === 1) codes.add(HEAD_OFFICE_ICAFFE_CODE);
  }
  return [...codes].filter(Boolean);
}

export async function defaultBranch() {
  const rows = await selectRows(
    "SELECT branchCode FROM CompanyBranches WHERE coalesce(status, 'Active') = 'Active' ORDER BY isDefault DESC, id LIMIT 1",
  ).catch(() => []);
  return rows[0] ? rows[0].branchCode : 'DEL';
}

/** SQL condition: the docket's branch is one of these codes, or it has none. */
export const branchCondition = (column, codes) =>
  `(upper(trim(coalesce(${column}, ''))) IN (${codes.map(() => '?').join(',')}) OR coalesce(${column}, '') = '')`;
