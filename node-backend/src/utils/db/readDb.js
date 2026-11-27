// Second, read-only SQLite connection for the heavy account reads.
// Sequelize keeps ONE connection to database.sqlite and runs every query of every user on it, one after another. The
// Accounts dashboard and the account reports add up the whole voucher history (lakhs of voucher lines): seconds in
// which every other screen of every user would wait. In WAL mode SQLite lets a second connection read while the first
// one reads and writes, so these SELECTs run here, beside the main connection.
//   - read only (OPEN_READONLY): nothing can be written through it
//   - the branch scope of the top bar (branchScope middleware) is applied the same way as on the main connection
//   - if it cannot be opened (or a query fails on it), the query runs on the main connection
import path from 'node:path';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';
import { BACKEND_ROOT } from '../../config/env.js';
import * as branchScope from '../../middlewares/branchScope.middleware.js';

const DATABASE_FILE = (sequelize.options && sequelize.options.storage) || path.join(BACKEND_ROOT, 'database.sqlite');
const BUSY_TIMEOUT_MS = 15000;
const READ_CONNECTION_PRAGMAS =
  'PRAGMA cache_size = -32000; PRAGMA temp_store = MEMORY; PRAGMA mmap_size = 30000000000;';
// errors of the read connection itself: the query is retried on the main connection; any other error is the query's own
const CONNECTION_ERROR = /SQLITE_BUSY|SQLITE_LOCKED|SQLITE_CANTOPEN|SQLITE_IOERR|SQLITE_CORRUPT|SQLITE_NOTADB/;

let opening = null;
let readConnectionOff = false;

async function loadSqliteDriver() {
  try {
    return (await import('sqlite3')).default;
  } catch {
    return null;
  }
}

async function openReadConnection() {
  const sqlite3 = await loadSqliteDriver();
  if (!sqlite3) {
    readConnectionOff = true;
    return null;
  }
  return new Promise((resolve) => {
    const db = new sqlite3.Database(DATABASE_FILE, sqlite3.OPEN_READONLY, (error) => {
      if (error) {
        console.warn('[readDb] read connection not opened, using the main one:', error.message);
        readConnectionOff = true;
        return resolve(null);
      }
      db.configure('busyTimeout', BUSY_TIMEOUT_MS);
      db.exec(READ_CONNECTION_PRAGMAS, () => resolve(db));
    });
  });
}

function readConnection() {
  if (readConnectionOff || sequelize.getDialect() !== 'sqlite') return Promise.resolve(null);
  opening = opening || openReadConnection();
  return opening;
}

function applyBranchScope(sqlText) {
  const scope = branchScope.current();
  const isVoucherRead = /^\s*(SELECT|WITH)\b/i.test(sqlText) && /Vouchers/.test(sqlText);
  if (scope && scope.clause && isVoucherRead) return branchScope.rewrite(sqlText, scope.clause);
  return sqlText;
}

const allRows = (db, sqlText, replacements) =>
  new Promise((resolve, reject) => {
    db.all(sqlText, replacements, (error, rows) => (error ? reject(error) : resolve(rows)));
  });

/** Same call shape as the routes' q(sql, replacements): returns the rows. */
async function q(sql, replacements = []) {
  const scopedSql = applyBranchScope(String(sql));
  const db = await readConnection();
  if (db) {
    try {
      return await allRows(db, scopedSql, replacements);
    } catch (error) {
      if (!CONNECTION_ERROR.test(String(error.code || error.message))) throw error;
      console.warn('[readDb] read failed, retrying on the main connection:', error.message);
    }
  }
  // the main connection applies its own branch-scope patch, so it gets the original text
  return sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
}

export { q };
