// 04-Nov-2026: ICEGATE drawback serial numbers carry a suffix - filed shipping bills (iCAFFE) send "62030307B",
// and iCAFFE's DBK schedule uses B for the main All Industry Rate schedule (77/2023-Cus (N.T.)) and D for the
// Table annexed to note 9(ii) (Special Advance Authorisation, Ch 61/62). EDI kept the bare code, so the SB carried
// "620303" - not an ICEGATE schedule number.
//   - every active main-schedule row: schemeCode + "B"
//   - the 158 Table rows made inactive this morning: schemeCode + "D", active again, labelled
//   - the other 310 Table rows of 77/2023 added as "...D"
// One transaction; a full copy of the database is written to backups\ first.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));
const DB = path.join(__dirname, 'database.sqlite');
const DATA = path.join(__dirname, '_tariff_load', 'dbk_suffix_load.json');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(__dirname, '..', 'backups', 'database_before_dbk_suffix_' + stamp + '.sqlite');
const LOG = path.join(__dirname, '_tariff_load', 'dbk_suffix_result_' + stamp + '.txt');
const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const TABLE = 'SPECIAL ADVANCE AUTHORISATION TABLE (CH 61/62) - 77/2023 NOTE 9(ii)';

(async () => {
  try {
    await run('PRAGMA busy_timeout = 30000');
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    say('Backup: ' + BACKUP);
    await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'");
    const d = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    await run('BEGIN IMMEDIATE');
    const b = await run("UPDATE Drawbacks SET schemeCode = schemeCode || 'B', updatedAt = ? WHERE isActive = 1 AND schemeCode GLOB '[0-9]*' AND schemeCode NOT GLOB '*[A-Z]'", [now()]);
    const t = await run("UPDATE Drawbacks SET schemeCode = schemeCode || 'D', isActive = 1, updatedAt = ? WHERE schemeDescription = ? AND schemeCode NOT GLOB '*[A-Z]'", [now(), TABLE]);
    const have = new Set((await all('SELECT schemeCode FROM Drawbacks')).map(r => r.schemeCode));
    let add = 0;
    for (const [code, desc, rate, cap, uqc] of d.addD) {
      if (have.has(code + 'D')) continue;
      await run("INSERT INTO Drawbacks (tariffItem, description, schemeDescription, schemeCode, drawbackRate, drawbackCap, uqc, dgftPolicy, isActive, drawbackRateSpec, drawbackFlag, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,'FREE',1,0,'',?,?)",
        [code.slice(0, 2), (desc || code).slice(0, 250), TABLE, code + 'D', rate || 0, cap || 0, String(uqc || '').toUpperCase().replace(/^PIECE$/, 'NOS').replace(/^KG$/, 'KGS'), now(), now()]);
      add++;
    }
    await run('COMMIT');
    say('Main schedule rows given suffix B: ' + b.changes + ' | Table rows given suffix D (active again): ' + t.changes + ' | Table rows added: ' + add);
    const s = (await all("SELECT sum(schemeCode GLOB '*B') b, sum(schemeCode GLOB '*D') d, sum(isActive) a FROM Drawbacks"))[0];
    say('Now: ' + s.b + ' B rows, ' + s.d + ' D rows, ' + s.a + ' active');
    say('DONE');
  } catch (e) {
    try { await run('ROLLBACK'); } catch (x) { /* nothing open */ }
    say('FAILED - nothing was changed: ' + (e && e.message));
  } finally {
    try { fs.writeFileSync(LOG, log.join('\r\n')); } catch (e) { /* ignore */ }
    db.close();
  }
})();
