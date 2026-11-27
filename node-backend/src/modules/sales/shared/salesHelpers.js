import { sequelize } from '../../../config/database.js';
import { listOf, nameKey, q, today } from '../../../utils/common/salesHub.js';

const ONE_DAY_MS = 86400000;
const FINANCIAL_YEAR_FIRST_MONTH = 4;

/** router.param handler: a non-numeric id is not this route's (the next matching route gets the request). */
export const onlyNumericParam = (req, res, next, value) => (/^\d+$/.test(String(value)) ? next() : next('route'));

/** Runs the work in one database transaction. */
export const inTransaction = (work) => sequelize.transaction(work);

/** Rows of a query, or [] when the query fails (a table that does not exist on this installation). */
export async function queryOrEmpty(sql, params = [], transaction) {
  try {
    return await q(sql, params, transaction);
  } catch {
    return [];
  }
}

/** First day (YYYY-04-01) of the Indian financial year the date is in. */
export function financialYearStart(date = today()) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return `${month < FINANCIAL_YEAR_FIRST_MONTH ? year - 1 : year}-04-01`;
}

export const addYears = (date, years) => `${Number(date.slice(0, 4)) + years}${date.slice(4)}`;

export const addDays = (date, days) =>
  new Date(Date.parse(date + 'T00:00:00Z') + days * ONE_DAY_MS).toISOString().slice(0, 10);

export const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / ONE_DAY_MS);

/** The sales routes answered an unexpected error as { success: false, error } (with the error's status, else 500). */
export const salesErrorBody = (error) => ({ success: false, error: error.message });

/** True when the sales person's name or one of the aliases gives this name key (iCAFFE names are matched by it). */
export const personHasNameKey = (person, key) =>
  nameKey(person.name) === key || listOf(person.aliases).some((alias) => nameKey(alias) === key);
