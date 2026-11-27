import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../../config/database.js';
import { q as readOnlyRows } from '../../../../utils/db/readDb.js';

/** SQL condition (voucher alias `v`): every voucher counts in the books except a rejected one. */
export const VALID_VOUCHER = "coalesce(v.status, '') <> 'Rejected'";

/** Rows of a SELECT. sequelize.query is looked up at call time so the branch-scope patch applies. */
export const selectRows = (sql, replacements = [], transaction) =>
  sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT,
    transaction,
  });

/** Any other statement (INSERT / UPDATE / DELETE / DDL); answers [results, metadata] like sequelize.query. */
export const runSql = (sql, replacements = [], transaction) => sequelize.query(sql, { replacements, transaction });

/** Rows of a SELECT, or [] when the query fails (a table that does not exist yet, an older column set). */
export async function selectRowsOrEmpty(sql, replacements = [], transaction) {
  try {
    return await selectRows(sql, replacements, transaction);
  } catch {
    return [];
  }
}

/** A statement whose failure does not matter (optional column, index on a table that may be missing). */
export async function runSqlQuietly(sql, replacements = [], transaction) {
  try {
    return await runSql(sql, replacements, transaction);
  } catch {
    return null;
  }
}

/** Heavy reads over the whole voucher history run on the second, read-only connection so other users do not wait. */
export const readRows = (sql, replacements = []) => readOnlyRows(sql, replacements);

/** First row of a SELECT, or {} when the query fails or finds nothing. */
export async function firstRowOrEmpty(sql, replacements = []) {
  try {
    return (await selectRows(sql, replacements))[0] || {};
  } catch {
    return {};
  }
}

export const sqlPlaceholders = (values) => values.map(() => '?').join(',');
