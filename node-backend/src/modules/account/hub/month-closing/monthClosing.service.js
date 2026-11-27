import { runSql, selectRows, selectRowsOrEmpty } from '../shared/hubQuery.service.js';
import { nowIso, yearMonths } from '../shared/hubFormat.service.js';
import { ensureMonthClosingTable } from '../shared/hubTables.service.js';
import { findFinancialYear } from '../shared/financialYear.service.js';

const lastDayOfMonth = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);

/** The twelve months of the year with their closing state and voucher count. */
export async function listYearMonths(requestedYearId) {
  await ensureMonthClosingTable();
  const year = await findFinancialYear(requestedYearId);
  const stateByMonth = new Map((await selectRows('SELECT * FROM AccMonthClosings')).map((row) => [row.month, row]));
  const voucherCounts = await selectRowsOrEmpty(
    `SELECT substr(date, 1, 7) m, count(*) n FROM Vouchers WHERE date >= ? AND date <= ? GROUP BY 1`,
    [year.startDate, year.endDate],
  );
  const vouchersByMonth = new Map(voucherCounts.map((row) => [row.m, row.n]));
  const months = yearMonths(year.startDate).map(({ key, date }) => {
    const state = stateByMonth.get(key) || {};
    return {
      id: key,
      month: key,
      periodName: date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }) + '-' + date.getUTCFullYear(),
      startDate: key + '-01',
      endDate: lastDayOfMonth(date),
      isClosed: !!state.isClosed,
      closedBy: state.closedBy || '',
      closedOn: state.closedOn || '',
      vouchers: vouchersByMonth.get(key) || 0,
    };
  });
  return { fy: year, months };
}

/** Closes (action "close") or re-opens ("open") a month 'YYYY-MM'. */
export async function setMonthClosed(month, action, closedBy) {
  await ensureMonthClosingTable();
  const isClosed = action === 'close' ? 1 : 0;
  const stamp = nowIso();
  await runSql(
    `INSERT INTO AccMonthClosings (month, isClosed, closedBy, closedOn, createdAt, updatedAt) VALUES (?,?,?,?,?,?)
      ON CONFLICT(month) DO UPDATE SET isClosed = excluded.isClosed, closedBy = excluded.closedBy, closedOn = excluded.closedOn, updatedAt = excluded.updatedAt`,
    [month, isClosed, closedBy, stamp, stamp, stamp],
  );
}

/** Used before any voucher is saved: is the month of this date closed? (false when it cannot be read) */
export async function isMonthClosed(date) {
  try {
    await ensureMonthClosingTable();
    const rows = await selectRows('SELECT isClosed FROM AccMonthClosings WHERE month = ?', [
      String(date || '').slice(0, 7),
    ]);
    return !!(rows[0] && rows[0].isClosed);
  } catch {
    return false;
  }
}
