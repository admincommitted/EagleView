// Customs locations read from Logi-Sys (Administration > Custom House, read only, 21-Nov-2026) that the EagleView
// Port master (customs locations) does not have. Source: _tariff_load/logisys_custom_house_20261121.json
//   [[portCode, name, category (SEA / AIR / ICD / SEZ / LCS), isSez]]
// Category comes from the last character of the code: 1 sea, 4 air, 6 ICD (SEZ when the name says SEZ), B land border.
// The 5 rail stations (code ending 2) are left out: EagleView has no rail category.
// ADD ONLY, in one transaction: a code already in the master is skipped; nothing is changed or deleted.
// New rows are added active, country INDIA (IN), division BOTH (IMP/EXP), no CHA code.
// The ids added are written to the result file with the undo statement. Running it again changes nothing.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const DATA = path.join(__dirname, '_tariff_load', 'logisys_custom_house_20261121.json');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const LOG = path.join(__dirname, '_tariff_load', 'logisys_custom_house_result_' + stamp + '.txt');
const CHECK = process.argv.includes('--check');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const log = [];
const say = (s) => { console.log(s); log.push(s); };

(async () => {
  let open = false;
  try {
    await run('PRAGMA busy_timeout = 60000');
    const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    const before = (await all('SELECT count(*) n FROM Ports'))[0].n;
    say((CHECK ? 'CHECK ONLY - nothing is written. ' : '') + 'Port master now: ' + before + ' rows.');
    if (!CHECK) { await run('BEGIN IMMEDIATE'); open = true; }
    const added = []; let skipped = 0; const byCat = {};
    for (const [code, name, category, isSez] of data) {
      const found = await all('SELECT id FROM Ports WHERE upper(portCode) = ?', [code]);
      if (found.length) { skipped++; continue; }
      byCat[category] = (byCat[category] || 0) + 1;
      if (CHECK) { added.push(code); continue; }
      const t = now();
      const id = (await run("INSERT INTO Ports (portCode, portName, country, category, isSez, chaCode, chaName, division, isActive, createdAt, updatedAt) VALUES (?, ?, 'INDIA (IN)', ?, ?, NULL, NULL, 'BOTH (IMP/EXP)', 1, ?, ?)", [code, name, category, isSez ? 1 : 0, t, t])).lastID;
      added.push(id);
    }
    if (!CHECK) { await run('COMMIT'); open = false; }
    say((CHECK ? 'Would add: ' : 'Added: ') + added.length + ' locations (' + Object.keys(byCat).sort().map((k) => k + ' ' + byCat[k]).join(', ') + '). Skipped (already there): ' + skipped + '.');
    if (!CHECK && added.length) {
      say('Undo (only if needed):');
      say('  DELETE FROM Ports WHERE id IN (' + added.join(',') + ');');
    }
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
