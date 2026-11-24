// Countervailing duty (CVD), export cess and tariff value rows read from Logi-Sys (system directory, read only, 21-Nov-2026)
// for the EagleView screen Masters > Customs Duty Lists. Source: _tariff_load/logisys_duty_lists_20261121.json
//   cvd          [notifNo, serialNo, itemSlNo, suppSlNo, cth, originCountry, exportCountry, rate, calcMethod, description, exporter, producer]
//   cess         [ritc, serialNo, tariffValue, tariffUnit, ratePercent, rateRs, unit]      (8 Logi-Sys rows with no RITC are left out)
//   tariffvalue  [notifNo, serialNo, cth, description, tariffValue, currency, uqc]
// ADD ONLY, in one transaction. Each row carries source 'LOGISYS' and a key made of its own values; a row whose key is
// already in the table is skipped, so running it again changes nothing. Rows added by hand on the screen are never touched.
// The three tables are made if they are not there yet. The result file has the counts and the undo statements.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));
const TABLES = require('./utils/dutyListTables');

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const DATA = path.join(__dirname, '_tariff_load', 'logisys_duty_lists_20261121.json');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const LOG = path.join(__dirname, '_tariff_load', 'logisys_duty_lists_result_' + stamp + '.txt');
const CHECK = process.argv.includes('--check');
const COLS = {
  cvd: ['notifNo', 'serialNo', 'itemSlNo', 'suppSlNo', 'cth', 'originCountry', 'exportCountry', 'rate', 'calcMethod', 'description', 'exporter', 'producer'],
  cess: ['ritc', 'serialNo', 'tariffValue', 'tariffUnit', 'ratePercent', 'rateRs', 'unit'],
  tariffvalue: ['notifNo', 'serialNo', 'cth', 'description', 'tariffValue', 'currency', 'uqc'],
};
const NAME = { cvd: 'Countervailing duty', cess: 'Export cess', tariffvalue: 'Tariff values' };

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const keyOf = (row) => require('crypto').createHash('sha1').update(row.map((x) => (x === null || x === undefined ? '' : String(x))).join('|')).digest('hex');
const log = [];
const say = (s) => { console.log(s); log.push(s); };

(async () => {
  let open = false;
  try {
    await run('PRAGMA busy_timeout = 60000');
    const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    const have = {};
    for (const k of Object.keys(COLS)) have[k] = (await all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [TABLES[k].table])).length > 0;
    say((CHECK ? 'CHECK ONLY - nothing is written.' : 'Loading the Logi-Sys duty lists.'));
    if (!CHECK) {
      await run('BEGIN IMMEDIATE'); open = true;
      for (const k of Object.keys(COLS)) { await run(TABLES[k].ddl); for (const c of TABLES[k].idx) await run(`CREATE INDEX IF NOT EXISTS ${TABLES[k].table.toLowerCase()}_${c.toLowerCase()} ON ${TABLES[k].table} (${c})`); }
    }
    const undo = [];
    for (const k of Object.keys(COLS)) {
      const t = TABLES[k].table, cols = COLS[k], rows = data[k] || [];
      const old = new Set(); let before = 0;
      if (have[k] || !CHECK) { (await all(`SELECT srcKey FROM ${t} WHERE source = 'LOGISYS'`)).forEach((r) => old.add(r.srcKey)); before = (await all(`SELECT count(*) n FROM ${t}`))[0].n; }
      let added = 0, skipped = 0, first = null, last = null;
      for (const row of rows) {
        const key = keyOf(row);
        if (old.has(key)) { skipped++; continue; }
        old.add(key); added++;
        if (CHECK) continue;
        const ts = now();
        const r = await run(`INSERT INTO ${t} (${cols.join(', ')}, source, srcKey, isActive, createdAt, updatedAt) VALUES (${cols.map(() => '?').join(', ')}, 'LOGISYS', ?, 1, ?, ?)`, [...row.map((x) => (x === '' ? null : x)), key, ts, ts]);
        if (first === null) first = r.lastID; last = r.lastID;
      }
      say(`${NAME[k]}: in the table now ${before}, in the file ${rows.length}, ${CHECK ? 'would add' : 'added'} ${added}, skipped (already there) ${skipped}.`);
      if (!CHECK && added) undo.push(`  DELETE FROM ${t} WHERE source = 'LOGISYS' AND id BETWEEN ${first} AND ${last};`);
    }
    if (!CHECK) { await run('COMMIT'); open = false; }
    if (undo.length) { say('Undo (only if needed):'); undo.forEach(say); }
    say('DONE');
  } catch (e) {
    if (open) { try { await run('ROLLBACK'); } catch (x) { /* nothing open */ } }
    say('FAILED - nothing was changed: ' + (e && e.message));
    process.exitCode = 1;
  } finally {
    try { fs.writeFileSync(LOG, log.join('\r\n')); console.log('Result file: ' + LOG); } catch (e) { /* ignore */ }
    db.close();
  }
})();
