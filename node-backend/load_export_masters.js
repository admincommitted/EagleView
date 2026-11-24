// Export masters from official sources (04-Nov-2026). Source: _tariff_load/export_masters_load.json
//   RoDTEP  : DGFT Appendix 4R w.e.f. 10.10.2024 (Notfn 32), + tariff-item changes w.e.f. 01.05.2025 (Notfn 10/2025-26)
//             + w.e.f. 01.05.2026 (Notfn 15/2026-27). Rate/cap stored = what can be claimed now: 50% of the notified
//             rate and cap (Notfn 60/2025-26 dt 23.02.2026) except ITC-HS Chapters 01-24, which keep the full rate.
//             Rows: [cth, description, uqc, notifiedRate, notifiedCap, rate, cap]. Codes no longer in 4R -> inactive.
//   Drawback: Notfn 77/2023-Customs (N.T.) Schedule - 343 missing tariff items added, 821201 corrected, the 158 rows of
//             the Special Advance Authorisation Table (Ch 61/62) made inactive and labelled, jewellery 711301/711302/711401
//             per Notfn 85/2026-Customs (N.T.) dt 15.10.2026 (Rs per gram / kg of metal content).
//   Licences: the 5 demo licences (Reliance, Tata Motors, Maruti, Infosys, Mando) made inactive; AD code 1234567 removed.
// One transaction; a full copy of the database is written to backups\ first.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));
const DB = path.join(__dirname, 'database.sqlite');
const DATA = path.join(__dirname, '_tariff_load', 'export_masters_load.json');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(__dirname, '..', 'backups', 'database_before_export_masters_' + stamp + '.sqlite');
const LOG = path.join(__dirname, '_tariff_load', 'export_masters_result_' + stamp + '.txt');
const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const DEMO_LICENCES = ['0510008432', '0310084920', '0710093847', '0129384756', '0834958271'];

(async () => {
  try {
    await run('PRAGMA busy_timeout = 30000');
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    say('Backup: ' + BACKUP);
    await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'");
    const d = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    await run('BEGIN IMMEDIATE');

    // ---- RoDTEP
    const have = new Map((await all('SELECT id, tariffItem FROM Rodteps')).map(r => [String(r.tariffItem).trim(), r.id]));
    const keep = new Set();
    let rAdd = 0, rUpd = 0, rOff = 0;
    for (const [cth, desc, uqc, nRate, nCap, rate, cap] of d.rodtep) {
      keep.add(cth);
      const text = (desc || cth).slice(0, 250);
      if (have.has(cth)) {
        await run('UPDATE Rodteps SET description = ?, rate = ?, cap = ?, uqc = coalesce(?, uqc), isActive = 1, updatedAt = ? WHERE id = ?', [text, rate, cap || 0, uqc, now(), have.get(cth)]);
        rUpd++;
      } else {
        await run('INSERT INTO Rodteps (tariffItem, description, rate, cap, uqc, isActive, createdAt, updatedAt) VALUES (?,?,?,?,?,1,?,?)', [cth, text, rate, cap || 0, uqc, now(), now()]);
        rAdd++;
      }
    }
    for (const [cth, id] of have) if (!keep.has(cth)) { await run('UPDATE Rodteps SET isActive = 0, updatedAt = ? WHERE id = ? AND isActive <> 0', [now(), id]); rOff++; }
    say('RoDTEP: updated ' + rUpd + ', added ' + rAdd + ', not in Appendix 4R (inactive) ' + rOff);

    // ---- Drawback
    let dAdd = 0;
    const dHave = new Set((await all('SELECT schemeCode FROM Drawbacks')).map(r => String(r.schemeCode)));
    for (const [code, desc, rate, cap, uqc] of d.adds) {
      if (dHave.has(code)) continue;
      await run("INSERT INTO Drawbacks (tariffItem, description, schemeDescription, schemeCode, drawbackRate, drawbackCap, uqc, dgftPolicy, isActive, drawbackRateSpec, drawbackFlag, createdAt, updatedAt) VALUES (?,?,'',?,?,?,?,'FREE',1,0,'',?,?)",
        [code.slice(0, 2), (desc || code).slice(0, 250), code, rate, cap || 0, String(uqc || '').toUpperCase().replace(/^PIECE$/, 'NOS').replace(/^KG$/, 'KGS'), now(), now()]);
      dAdd++;
    }
    let tOff = 0;
    for (const id of d.tableIds) {
      const r = await run("UPDATE Drawbacks SET isActive = 0, schemeDescription = 'SPECIAL ADVANCE AUTHORISATION TABLE (CH 61/62) - 77/2023 NOTE 9(ii)', updatedAt = ? WHERE id = ?", [now(), id]);
      tOff += r.changes;
    }
    for (const [code, rate, cap] of d.fix) await run('UPDATE Drawbacks SET drawbackRate = ?, drawbackCap = ?, updatedAt = ? WHERE schemeCode = ? AND isActive = 1', [rate, cap || 0, now(), code]);
    for (const [code, amt, uqc] of d.jewellery) await run("UPDATE Drawbacks SET drawbackRate = 0, drawbackCap = 0, drawbackRateSpec = ?, uqc = ?, schemeDescription = 'NOTFN 85/2026-CUS(NT) DT 15.10.2026', updatedAt = ? WHERE schemeCode = ?", [amt, uqc, now(), code]);
    say('Drawback: added ' + dAdd + ', Special-AA table rows inactive ' + tOff + ', 821201 corrected, jewellery 711301/711302/711401 updated');

    // ---- Licences / AD code
    let lOff = 0;
    for (const no of DEMO_LICENCES) lOff += (await run('UPDATE Licenses SET isActive = 0, updatedAt = ? WHERE licenseNumber = ? AND isActive <> 0', [now(), no])).changes;
    const ad = await run("DELETE FROM PartyADCodes WHERE adCode = '1234567'");
    say('Demo licences inactive: ' + lOff + ' | fake AD code removed: ' + ad.changes);

    await run('COMMIT');
    const c = async (sql) => (await all(sql))[0].n;
    say('Now: RoDTEP active ' + await c('SELECT count(*) n FROM Rodteps WHERE isActive = 1') + ' (with rate ' + await c('SELECT count(*) n FROM Rodteps WHERE isActive = 1 AND rate > 0') + ') | Drawback active ' + await c('SELECT count(*) n FROM Drawbacks WHERE isActive = 1'));
    say('DONE');
  } catch (e) {
    try { await run('ROLLBACK'); } catch (x) { /* nothing open */ }
    say('FAILED - nothing was changed: ' + (e && e.message));
  } finally {
    try { fs.writeFileSync(LOG, log.join('\r\n')); } catch (e) { /* ignore */ }
    db.close();
  }
})();
