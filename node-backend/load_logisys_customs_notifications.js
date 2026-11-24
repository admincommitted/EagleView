// Customs notifications read from Logi-Sys (System Directory > Customs Notification, read only, 21-Nov-2026) that the
// EagleView notification master did not have: 35 notifications of 2017-2026, 1,25,133 serial rows.
// Source: _tariff_load/logisys_customs_notif_20261121.json
//   [{ notifNo, effectiveDate | null, rows: [[serialNo, tariffHead | null, ratePercent | null, description]] }]
// Each row keeps what the duty is for in the description ("BCD", "AIDC", "Health Cess", "SAPTA" ...); a rate that is not
// a plain percentage ("10% or Rs 30/SQM whichever is higher") is kept as text in the description, with no rate figure.
// A blank rate in Logi-Sys is stored as no rate (not 0) - look it up in the notification.
// ADD ONLY, in one transaction: a notification already in the master (same number, type CUSTOM) is skipped whole;
// nothing is changed or deleted. The ids of the headers added are written to the result file with the undo statements.
// Running it again changes nothing.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const DATA = path.join(__dirname, '_tariff_load', 'logisys_customs_notif_20261121.json');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const LOG = path.join(__dirname, '_tariff_load', 'logisys_customs_notif_result_' + stamp + '.txt');
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
    const before = (await all('SELECT count(*) n FROM DutyNotifHeaders'))[0].n;
    const beforeD = (await all('SELECT count(*) n FROM DutyNotifDetails'))[0].n;
    say((CHECK ? 'CHECK ONLY - nothing is written. ' : '') + 'Master now: ' + before + ' notifications, ' + beforeD + ' serial rows.');
    if (!CHECK) { await run('BEGIN IMMEDIATE'); open = true; }
    const added = []; let rows = 0, skipped = 0;
    for (const n of data) {
      const found = await all("SELECT id FROM DutyNotifHeaders WHERE notifNo = ? AND upper(type) = 'CUSTOM'", [n.notifNo]);
      if (found.length) { skipped++; say(n.notifNo + ': already in the master - skipped'); continue; }
      if (CHECK) { say(n.notifNo + ': would add ' + n.rows.length + ' rows'); rows += n.rows.length; continue; }
      const t = now();
      const id = (await run("INSERT INTO DutyNotifHeaders (notifNo, type, effectiveDate, isActive, createdAt, updatedAt) VALUES (?, 'CUSTOM', ?, 1, ?, ?)", [n.notifNo, n.effectiveDate || null, t, t])).lastID;
      const st = db.prepare('INSERT INTO DutyNotifDetails (serialNo, tariffHead, specificSeries, effectiveDate, dutyRate, itemDescription, conditionNo, headerId, createdAt, updatedAt) VALUES (?,?,NULL,?,?,?,?,?,?,?)');
      for (const [serialNo, tariffHead, rate, desc] of n.rows) {
        await new Promise((ok, no) => st.run([serialNo, tariffHead, n.effectiveDate || null, rate, desc || '', '', id, t, t], (e) => (e ? no(e) : ok())));
        rows++;
      }
      await new Promise((ok, no) => st.finalize((e) => (e ? no(e) : ok())));
      added.push(id);
      say(n.notifNo + ': added, ' + n.rows.length + ' rows (header id ' + id + ')');
    }
    if (!CHECK) { await run('COMMIT'); open = false; }
    say((CHECK ? 'Would add: ' : 'Added: ') + (CHECK ? data.length - skipped : added.length) + ' notifications, ' + rows + ' serial rows. Skipped (already there): ' + skipped + '.');
    if (added.length) {
      say('Undo (only if needed), in this order:');
      say('  DELETE FROM DutyNotifDetails WHERE headerId IN (' + added.join(',') + ');');
      say('  DELETE FROM DutyNotifHeaders WHERE id IN (' + added.join(',') + ');');
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
