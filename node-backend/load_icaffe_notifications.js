// Loads IGST notifications read from iCAFFE (04-Nov-2026) into the EDI notification master.
//   IGST rate notifications 009/2025 + 014/2025 (GST 2.0) and IGST exemption notifications (010/2025, 009/2018, ...).
// Source: _tariff_load/notif_load.json  [{ notifNo, type, effectiveDate, kind, rows: [[serialNo, tariffHead, specificSeries, rate, description]] }]
// One transaction. A notification already in EDI with the same number + type gets its serial rows replaced;
// every other notification is left as it is. A full copy of the database is written to backups\ first.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = path.join(__dirname, 'database.sqlite');
const DATA = path.join(__dirname, '_tariff_load', 'notif_load.json');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(__dirname, '..', 'backups', 'database_before_notification_load_' + stamp + '.sqlite');
const LOG = path.join(__dirname, '_tariff_load', 'notif_load_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const log = [];
const say = (s) => { console.log(s); log.push(s); };

(async () => {
  try {
    await run('PRAGMA busy_timeout = 30000');
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    say('Backup: ' + BACKUP);
    await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'");

    const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    await run('BEGIN IMMEDIATE');
    let rows = 0;
    for (const n of data) {
      const found = await all('SELECT id FROM DutyNotifHeaders WHERE notifNo = ? AND upper(type) = ?', [n.notifNo, n.type]);
      let id;
      if (found.length) {
        id = found[0].id;
        await run('UPDATE DutyNotifHeaders SET effectiveDate = ?, isActive = 1, updatedAt = ? WHERE id = ?', [n.effectiveDate, now(), id]);
        await run('DELETE FROM DutyNotifDetails WHERE headerId = ?', [id]);
      } else {
        id = (await run('INSERT INTO DutyNotifHeaders (notifNo, type, effectiveDate, isActive, createdAt, updatedAt) VALUES (?,?,?,1,?,?)',
          [n.notifNo, n.type, n.effectiveDate, now(), now()])).lastID;
      }
      for (const [serialNo, tariffHead, spec, rate, desc] of n.rows) {
        await run('INSERT INTO DutyNotifDetails (serialNo, tariffHead, specificSeries, effectiveDate, dutyRate, itemDescription, conditionNo, headerId, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [serialNo, tariffHead, spec || null, n.effectiveDate, rate, desc || null, null, id, now(), now()]);
        rows++;
      }
      say(n.notifNo + ' ' + n.type + ' (' + n.kind + '): ' + n.rows.length + ' rows' + (found.length ? ' (replaced)' : ' (new)'));
    }
    await run('COMMIT');
    say('Serial rows written: ' + rows);
    say('DONE');
  } catch (e) {
    try { await run('ROLLBACK'); } catch (x) { /* nothing open */ }
    say('FAILED - nothing was changed: ' + (e && e.message));
  } finally {
    try { fs.writeFileSync(LOG, log.join('\r\n')); } catch (e) { /* ignore */ }
    db.close();
  }
})();
