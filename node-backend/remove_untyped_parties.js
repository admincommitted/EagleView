// Removes the parties that have no party type at all (not exporter, consignee, notify, buyer, sub agent, overseas agent,
// shipline, IATA agent or bank) - 04-Nov-2026: the 3 demo rows COMMITTED EXPORTS / GLOBAL IMPORTS INC / IATA FREIGHT AGENT,
// not used by any job. Their addresses / AD codes / drawback accounts / KYC documents go with them.
// One transaction; a full copy of the database is written to backups\ first.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = path.join(__dirname, 'database.sqlite');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(__dirname, '..', 'backups', 'database_before_remove_untyped_parties_' + stamp + '.sqlite');
const LOG = path.join(__dirname, '_tariff_load', 'remove_untyped_parties_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const FLAGS = ['isShipper', 'isConsignee', 'isNotifyParty', 'isBuyer', 'isSubAgent', 'isOverseasAgent', 'isShipline', 'isIataAgent', 'isBank'];

(async () => {
  try {
    await run('PRAGMA busy_timeout = 30000');
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    say('Backup: ' + BACKUP);
    await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'");
    await run('BEGIN IMMEDIATE');
    const rows = await all('SELECT id, code, name FROM Parties WHERE ' + FLAGS.map(f => 'coalesce(' + f + ', 0) = 0').join(' AND '));
    const tables = new Set((await all("SELECT name FROM sqlite_master WHERE type = 'table'")).map(r => r.name));
    for (const p of rows) {
      for (const t of ['PartyBranches', 'PartyADCodes', 'PartyDrawbackAccounts', 'PartyDocuments']) if (tables.has(t)) await run('DELETE FROM ' + t + ' WHERE partyId = ?', [p.id]);
      if (tables.has('IcaffeParties')) await run('UPDATE IcaffeParties SET importedPartyId = NULL WHERE importedPartyId = ?', [p.id]);
      await run('DELETE FROM Parties WHERE id = ?', [p.id]);
      say('  removed: ' + (p.code || '') + ' ' + p.name);
    }
    await run('COMMIT');
    say('Parties without a type removed: ' + rows.length);
    say('DONE');
  } catch (e) {
    try { await run('ROLLBACK'); } catch (x) { /* nothing open */ }
    say('FAILED - nothing was changed: ' + (e && e.message));
  } finally {
    try { fs.writeFileSync(LOG, log.join('\r\n')); } catch (e) { /* ignore */ }
    db.close();
  }
})();
