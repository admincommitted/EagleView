// fix_iso_timestamps.js  (14-Nov-2026)
// The iCAFFE loaders wrote createdAt / updatedAt as '2026-11-07T10:55:18.200Z'. Sequelize (SQLite) reads only
// '2026-11-07 10:55:18.200 +00:00', so those rows came back with createdAt / updatedAt = null (timeline "Job created · -",
// TAT banner "Clearance delayed by 20771d"). This rewrites only such values, in every table, into the form Sequelize reads.
// The moment in time does not change (both are UTC).
//   node fix_iso_timestamps.js --check   -> counts only, nothing is written
//   node fix_iso_timestamps.js           -> writes; the old values are saved first to ..\backups\iso_timestamps_<stamp>.csv
//   --all  also the 4 big accounting tables (Vouchers, VoucherDetails, AccSalesInvoices, AccPurchaseInfo: ~9.5 million
//          values, no screen shows their created time). Left out by default - the PC is short of disk space and the
//          old-value file / database journal for them would be hundreds of MB.
// Stop the EagleView backend before the write run.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const CHECK = process.argv.includes('--check');
const ALL = process.argv.includes('--all');
const BIG = new Set(['Vouchers', 'VoucherDetails', 'AccSalesInvoices', 'AccPurchaseInfo']);
const DB = path.join(__dirname, 'database.sqlite');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BK = path.join(__dirname, '..', 'backups', 'iso_timestamps_' + stamp + '.csv');
const db = new sqlite3.Database(DB, CHECK ? sqlite3.OPEN_READONLY : sqlite3.OPEN_READWRITE);
const all = (sql, p = []) => new Promise((ok, bad) => db.all(sql, p, (e, r) => (e ? bad(e) : ok(r))));
const run = (sql, p = []) => new Promise((ok, bad) => db.run(sql, p, function (e) { return e ? bad(e) : ok(this); }));
const ISO = "GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]*Z'";
// '2026-11-07T10:55:18.200Z' -> '2026-11-07 10:55:18.200 +00:00'
const fixed = (c) => `substr("${c}", 1, 10) || ' ' || substr("${c}", 12, length("${c}") - 12) || ' +00:00'`;

(async () => {
  const tables = (await all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).map(r => r.name);
  const work = []; const skipped = [];
  for (const t of tables) {
    const cols = (await all(`PRAGMA table_info("${t}")`)).map(c => c.name).filter(c => c === 'createdAt' || c === 'updatedAt');
    for (const c of cols) {
      const [{ n }] = await all(`SELECT count(*) AS n FROM "${t}" WHERE "${c}" ${ISO}`);
      if (n) (BIG.has(t) && !ALL ? skipped : work).push({ t, c, n });
    }
  }
  if (skipped.length) console.log('Left out (big accounting tables, use --all to include): ' + skipped.map(w => w.t + '.' + w.c + ' ' + w.n).join(', ') + '\n');
  if (!work.length) { console.log('Nothing to fix - every createdAt / updatedAt is already in the form EagleView reads.'); db.close(); return; }
  console.log('Values to fix (table / column / rows):');
  for (const w of work) console.log('  ' + w.t.padEnd(32) + w.c.padEnd(11) + w.n);
  console.log('Total: ' + work.reduce((a, w) => a + w.n, 0));
  if (CHECK) { console.log('\nCheck only - nothing written.'); db.close(); return; }

  // old values first (table, rowid, column, old value), so the change can be undone
  fs.mkdirSync(path.dirname(BK), { recursive: true });
  const out = fs.createWriteStream(BK);
  out.write('table,rowid,column,old_value\r\n');
  for (const w of work) {
    const rows = await all(`SELECT rowid AS r, "${w.c}" AS v FROM "${w.t}" WHERE "${w.c}" ${ISO}`);
    for (const r of rows) out.write(`${w.t},${r.r},${w.c},${r.v}\r\n`);
  }
  await new Promise(ok => out.end(ok));
  console.log('\nOld values saved: ' + BK);

  await run('BEGIN');
  try {
    let done = 0;
    for (const w of work) { const r = await run(`UPDATE "${w.t}" SET "${w.c}" = ${fixed(w.c)} WHERE "${w.c}" ${ISO}`); done += r.changes; }
    await run('COMMIT');
    console.log('Fixed: ' + done + ' values.');
  } catch (e) { await run('ROLLBACK'); throw e; }
  db.close();
})().catch(e => { console.error('Stopped, nothing changed: ' + e.message); process.exit(1); });
