import { VALID_VOUCHER, firstRowOrEmpty, selectRowsOrEmpty } from '../shared/hubQuery.service.js';
import { findFinancialYear, yearSummary } from '../shared/financialYear.service.js';

/** Figures for the Accounts home page: counts, vouchers of the year by type and by month. */
export async function buildAccountsSummary(requestedYearId) {
  const year = await findFinancialYear(requestedYearId);
  const groups = await firstRowOrEmpty('SELECT count(*) n FROM AccountGroups');
  const ledgers = await firstRowOrEmpty('SELECT count(*) n FROM AccountLedgers');
  const vouchers = await firstRowOrEmpty(
    `SELECT count(*) n, sum(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) pending FROM Vouchers WHERE date >= ? AND date <= ?`,
    [year.startDate, year.endDate],
  );
  const byType = await selectRowsOrEmpty(
    `SELECT t.baseType, count(*) n, sum(v.totalAmount) amt FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId
        WHERE ${VALID_VOUCHER} AND v.date >= ? AND v.date <= ? GROUP BY t.baseType`,
    [year.startDate, year.endDate],
  );
  const months = await selectRowsOrEmpty(
    `SELECT substr(v.date, 1, 7) m, t.baseType, sum(v.totalAmount) amt FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId
        WHERE ${VALID_VOUCHER} AND v.date >= ? AND v.date <= ? AND t.baseType IN ('Sales', 'Purchase', 'Receipt', 'Payment') GROUP BY 1, 2 ORDER BY 1`,
    [year.startDate, year.endDate],
  );
  return {
    fy: yearSummary(year),
    groups: groups.n || 0,
    ledgers: ledgers.n || 0,
    vouchers: vouchers.n || 0,
    pending: vouchers.pending || 0,
    byType,
    months,
  };
}
