// 04-Nov-2026 clean-up after the iCAFFE master load.
//   Airlines: one row per IATA AWB prefix - duplicates with a wrong prefix are set INACTIVE (not deleted), two renamed.
//   Ports   : 4 more codes that are not ICEGATE locations are made inactive.
// One transaction; a full copy of the database is written to backups\ first.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));
const DB = path.join(__dirname, 'database.sqlite');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(__dirname, '..', 'backups', 'database_before_airline_port_fix_' + stamp + '.sqlite');
const LOG = path.join(__dirname, '_tariff_load', 'airline_port_fix_result_' + stamp + '.txt');
const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const log = [];
const say = (s) => { console.log(s); log.push(s); };

// [name, wrong prefix] - the same airline is kept under its right prefix
const OFF = [
  ['AEROFLOT', '301'], ['AIR ALGERIE', '097'], ['AIR MACAU', '145'], ['AIR NIUGINI', '144'], ['AIR VANUATU', '120'],
  ['BIMAN BANGLADESH', '099'], ['COPA AIRLINES', '604'], ['KUWAIT AIRWAYS', '266'], ['NEPAL AIRLINES', '345'],
  ['PHILIPPINE AIRLINES', '302'], ['ROYAL AIR MAROC', '270'], ['SRILANKAN AIRLINES', '064'], ['VISTARA', '858']
];
// exact duplicate rows (same name + prefix): the row with fewer details goes
const DUP = [['EMIRATES', '176'], ['AEROMEXICO', '139']];
// [prefix, old name, new name, code2]
const RENAME = [['020', 'LUFTHANSA', 'LUFTHANSA CARGO', 'LH'], ['288', 'EVA AIR', 'AIR HONG KONG', 'LD'], ['507', 'AEROFLOT', 'AEROFLOT CARGO', 'SU']];
const PORTS_OFF = ['INMRT6', 'INEKX6', 'INBDQ6', 'INSUR6'];

(async () => {
  try {
    await run('PRAGMA busy_timeout = 30000');
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    say('Backup: ' + BACKUP);
    await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'");
    await run('BEGIN IMMEDIATE');
    for (const [name, pfx] of OFF) {
      const r = await run("UPDATE Airlines SET status = 'INACTIVE', updatedAt = ? WHERE upper(trim(name)) = ? AND prefix = ? AND (status IS NULL OR status <> 'INACTIVE')", [now(), name, pfx]);
      say('airline ' + pfx + ' ' + name + ': ' + (r.changes ? 'INACTIVE' : 'not found / already inactive'));
    }
    for (const [name, pfx] of DUP) {
      const rows = await all("SELECT id, code2, code3, accountNo, address1 FROM Airlines WHERE upper(trim(name)) = ? AND prefix = ? AND (status IS NULL OR status <> 'INACTIVE')", [name, pfx]);
      if (rows.length < 2) { say('airline ' + pfx + ' ' + name + ': no duplicate'); continue; }
      const score = (r) => ['code2', 'code3', 'accountNo', 'address1'].filter(k => r[k]).length;
      rows.sort((a, b) => score(b) - score(a) || a.id - b.id);
      for (const r of rows.slice(1)) await run("UPDATE Airlines SET status = 'INACTIVE', updatedAt = ? WHERE id = ?", [now(), r.id]);
      say('airline ' + pfx + ' ' + name + ': kept id ' + rows[0].id + ', ' + (rows.length - 1) + ' duplicate(s) INACTIVE');
    }
    for (const [pfx, oldName, newName, c2] of RENAME) {
      const r = await run('UPDATE Airlines SET name = ?, code2 = ?, updatedAt = ? WHERE prefix = ? AND upper(trim(name)) = ?', [newName, c2, now(), pfx, oldName]);
      say('airline ' + pfx + ': ' + oldName + ' -> ' + newName + (r.changes ? '' : ' (not found)'));
    }
    for (const code of PORTS_OFF) {
      const r = await run('UPDATE Ports SET isActive = 0, updatedAt = ? WHERE upper(portCode) = ? AND isActive <> 0', [now(), code]);
      say('port ' + code + ': ' + (r.changes ? 'made inactive' : 'not found / already inactive'));
    }
    await run('COMMIT');
    const a = (await all("SELECT count(*) n, sum(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) off FROM Airlines"))[0];
    say('Airlines now: ' + a.n + ' rows, ' + a.off + ' inactive');
    say('DONE');
  } catch (e) {
    try { await run('ROLLBACK'); } catch (x) { /* nothing open */ }
    say('FAILED - nothing was changed: ' + (e && e.message));
  } finally {
    try { fs.writeFileSync(LOG, log.join('\r\n')); } catch (e) { /* ignore */ }
    db.close();
  }
})();
