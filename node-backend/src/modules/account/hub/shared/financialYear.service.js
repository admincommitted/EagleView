import { fyId as financialYearOfScope } from '../../../../middlewares/branchScope.middleware.js';
import { selectRows } from './hubQuery.service.js';
import { todayIso } from './hubFormat.service.js';

const FIRST_VALID_YEAR = 1999;

/** The year asked for; with none named the one picked in the top bar (X-FY), else the active one. */
export async function findFinancialYear(requestedYearId) {
  const years = await selectRows(
    'SELECT * FROM FinancialYears WHERE coalesce(isDeleted, 0) = 0 ORDER BY isDefault DESC, startDate DESC',
  );
  const wantedId = String(requestedYearId || financialYearOfScope());
  return (
    years.find((year) => String(year.id) === wantedId) ||
    years.find((year) => year.isActive) ||
    years[0] || { startDate: todayIso().slice(0, 4) + '-04-01', endDate: Number(todayIso().slice(0, 4)) + 1 + '-03-31' }
  );
}

/** 1 April of the financial year a date (YYYY-MM-DD) falls in; null for a date that cannot be read. */
export const financialYearStartOf = (isoDate) => {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  if (!(year > FIRST_VALID_YEAR && month >= 1)) return null;
  return (month >= 4 ? year : year - 1) + '-04-01';
};

/** The short answer every screen gets about the year it shows. */
export const yearSummary = (year) => ({
  id: year.id,
  name: year.name || year.code,
  startDate: year.startDate,
  endDate: year.endDate,
});
