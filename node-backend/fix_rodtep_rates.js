// RoDTEP master: full notified rates + Appendix 4RE (12-Nov-2026). Data: _tariff_load/rodtep_full_load.json
//
// On 04-Nov-2026 the RoDTEP master was loaded at 50% of the notified rate and cap (Notfn 60/2025-26 dt 23.02.2026).
// That cut was withdrawn by Notfn 66/2025-26 (restored from 23.03.2026) and the extensions up to 31.12.2026 keep the
// rates unchanged; iCAFFE checklists of Aug / Sep 2026 use the full rates (83071000 0.5%, 33030090 0.7%). 50 rows of
// that load were also misread from the PDF (e.g. 04014000 6% instead of 0.5%, 52071000 85% instead of 3.4%).
// This sets, for every active RoDTEP row:
//   rate / cap           = DGFT Appendix 4R  (DTA exports)
//   rateAA / capAA       = DGFT Appendix 4RE (exports under Advance Authorisation / EOU / SEZ) - new columns
//   rsPerUqc / AA        = entries notified as "Rs. x" per UQC (Ch 44 logs / wood), rate 0
// Source: Appendix 4R and 4RE w.e.f. 10.10.2024 (Notfn 32 dt 30.09.2024) + tariff changes w.e.f. 01.05.2025 /
// 01.06.2025 (Notfn 10 and 11/2025-26) and 01.05.2026 (Notfn 15/2026-27), read by column from the DGFT PDFs.
//
//   node fix_rodtep_rates.js           -> shows what will change, writes nothing
//   node fix_rodtep_rates.js --apply   -> full copy of the database to backups\ first, then one transaction
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));
const DB = path.join(__dirname, 'database.sqlite');
const DATA = path.join(__dirname, '_tariff_load', 'rodtep_full_load.json');
const APPLY = process.argv.includes('--apply');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(__dirname, '..', 'backups', 'database_before_rodtep_rates_' + stamp + '.sqlite');
const LOG = path.join(__dirname, '_tariff_load', 'rodtep_rates_result_' + stamp + '.txt');
const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const n = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const same = (a, b) => Math.abs((n(a) || 0) - (n(b) || 0)) < 1e-9;

(async () => {
  try {
    await run('PRAGMA busy_timeout = 30000');
    const d = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    say('Source: ' + d.source);
    const cols = (await all('PRAGMA table_info(Rodteps)')).map((c) => c.name);
    const NEW = ['rateAA', 'capAA', 'rsPerUqc', 'rsPerUqcAA'];
    const missing = NEW.filter((c) => !cols.includes(c));
    const have = new Map((await all('SELECT * FROM Rodteps WHERE isActive = 1')).map((r) => [String(r.tariffItem).trim(), r]));
    let chRate = 0, chCap = 0, found = 0, notFound = [];
    for (const [cth, , r4, c4, rs4] of d.rows) {
      const r = have.get(cth);
      if (!r) { notFound.push(cth); continue; }
      found++;
      if (!same(r.rate, r4)) chRate++;
      if (!same(r.cap, c4)) chCap++;
    }
    say(`Active RoDTEP rows: ${have.size} | in the file: ${d.rows.length} | matched: ${found} | not in the master: ${notFound.length}${notFound.length ? ' (' + notFound.slice(0, 10).join(', ') + ')' : ''}`);
    say(`Appendix 4R rate changes: ${chRate} | cap changes: ${chCap} | Appendix 4RE (AA / EOU / SEZ) rates: ${found} rows${missing.length ? ' | new columns: ' + missing.join(', ') : ''}`);
    for (const k of ['83071000', '73079990', '33030090', '29372200', '84211100', '04014000']) {
      const r = have.get(k), x = d.rows.find((y) => y[0] === k);
      if (r && x) say(`  ${k}: 4R ${r.rate}% -> ${x[2]}%   4RE -> ${x[5]}%`);
    }
    if (!APPLY) { say('Nothing written. Run with --apply to update.'); return; }

    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    say('Backup: ' + BACKUP);
    await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'");
    await run('BEGIN IMMEDIATE');
    for (const c of missing) await run(`ALTER TABLE Rodteps ADD COLUMN ${c} FLOAT`);
    let upd = 0;
    for (const [cth, uqc, r4, c4, rs4, r4e, c4e, rs4e] of d.rows) {
      const r = have.get(cth);
      if (!r) continue;
      // the unit is kept; rows loaded without one get the schedule's (needed for the Rs-per-unit entries)
      const res = await run("UPDATE Rodteps SET rate = ?, cap = ?, rsPerUqc = ?, rateAA = ?, capAA = ?, rsPerUqcAA = ?, uqc = CASE WHEN uqc IS NULL OR trim(uqc) = '' THEN ? ELSE uqc END, updatedAt = ? WHERE id = ?",
        [n(r4) || 0, n(c4) || 0, n(rs4), n(r4e), n(r4e) === null ? null : (n(c4e) || 0), n(rs4e), uqc || null, now(), r.id]);
      upd += res.changes;
    }
    await run('COMMIT');
    say('Updated rows: ' + upd);
    const chk = await all("SELECT tariffItem, rate, cap, rateAA, capAA FROM Rodteps WHERE isActive = 1 AND tariffItem IN ('83071000','33030090','29372200','03022100')");
    chk.forEach((r) => say(`  now ${r.tariffItem}: 4R ${r.rate}% cap ${r.cap} | 4RE ${r.rateAA}% cap ${r.capAA}`));
    say('DONE');
  } catch (e) {
    say('ERROR: ' + e.message);
    try { await run('ROLLBACK'); } catch (x) { /* nothing open */ }
  } finally {
    try { fs.writeFileSync(LOG, log.join('\r\n')); } catch (e) { /* log only */ }
    db.close();
  }
})();
