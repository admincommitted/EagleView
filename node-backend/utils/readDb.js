// Second, read-only SQLite connection for the heavy account reads (14-Nov-2026).
// Sequelize keeps ONE connection to database.sqlite and runs every query of every user on it, one after another. The
// Accounts dashboard and the account reports add up the whole voucher history (42 lakh voucher lines): 3-10 seconds in
// which every other screen of every user waited. In WAL mode SQLite lets a second connection read while the first one
// reads and writes, so these SELECTs now run here, beside the main connection.
//   - read only (OPEN_READONLY): nothing can be written through it
//   - the branch scope of the top bar (utils/branchScope) is applied the same way as on the main connection
//   - if it cannot be opened (or a query fails on it), the query runs on the main connection as before
const path = require('path');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../db');
const bs = require('./branchScope');

const FILE = (sequelize.options && sequelize.options.storage) || path.join(__dirname, '..', 'database.sqlite');
let opening = null; let off = false;
function conn() {
  if (off || sequelize.getDialect() !== 'sqlite') return Promise.resolve(null);
  return (opening = opening || new Promise((resolve) => {
    let sqlite3; try { sqlite3 = require('sqlite3'); } catch (e) { off = true; return resolve(null); }
    const db = new sqlite3.Database(FILE, sqlite3.OPEN_READONLY, (err) => {
      if (err) { console.warn('[readDb] read connection not opened, using the main one:', err.message); off = true; return resolve(null); }
      db.configure('busyTimeout', 15000);
      db.exec('PRAGMA cache_size = -32000; PRAGMA temp_store = MEMORY; PRAGMA mmap_size = 30000000000;', () => resolve(db));
    });
  }));
}

// same call shape as the routes' q(sql, replacements): returns the rows
async function q(sql, replacements = []) {
  let text = String(sql);
  const st = bs.current();
  if (st && st.clause && /^\s*(SELECT|WITH)\b/i.test(text) && /Vouchers/.test(text)) text = bs.rewrite(text, st.clause);
  const db = await conn();
  if (db) {
    try {
      return await new Promise((resolve, reject) => db.all(text, replacements, (e, rows) => (e ? reject(e) : resolve(rows))));
    } catch (e) {
      if (!/SQLITE_BUSY|SQLITE_LOCKED|SQLITE_CANTOPEN|SQLITE_IOERR|SQLITE_CORRUPT|SQLITE_NOTADB/.test(String(e.code || e.message))) throw e;
      console.warn('[readDb] read failed, retrying on the main connection:', e.message);
    }
  }
  // fallback: the main connection (its own branch-scope patch applies, so pass the original text)
  return sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
}

module.exports = { q };
