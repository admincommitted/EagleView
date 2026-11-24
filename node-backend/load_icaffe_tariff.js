// Loads duty rates exported from iCAFFE (04-Nov-2026) into the EDI tariff master.
//   node load_icaffe_tariff.js            -> backup, then load
// Source data: _tariff_load/tariff_load.json (per CTH: BCD / IGST / Health cess) and
//              _tariff_load/ritc_desc.json   (CTH -> [description, unit]) for codes the EDI master does not have yet.
// What it changes, in ONE transaction:
//   - TariffHeaders: adds missing 8-digit codes; sets isGstApplicable (iCAFFE CETH "N" -> false); fills an empty description/uqc.
//   - TariffComponents: for every loaded code, replaces only its BCD, IGST and HEALTH rows. SWS / AIDC / other rows are kept.
// Nothing is deleted from TariffHeaders. A full copy of the database is written first to backups\.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = path.join(__dirname, 'database.sqlite');
const DATA = path.join(__dirname, '_tariff_load', 'tariff_load.json');
const DESC = path.join(__dirname, '_tariff_load', 'ritc_desc.json');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(__dirname, '..', 'backups', 'database_before_tariff_load_' + stamp + '.sqlite');
const LOG = path.join(__dirname, '_tariff_load', 'load_result_' + stamp + '.txt');

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
    const desc = fs.existsSync(DESC) ? JSON.parse(fs.readFileSync(DESC, 'utf8')) : {};
    const heads = new Map((await all('SELECT id, hsnCode, description, uqc FROM TariffHeaders')).map(h => [h.hsnCode, h]));
    say('Codes in file: ' + data.length + ' | headers in EDI before: ' + heads.size);

    let added = 0, comps = 0, gstOff = 0, descFilled = 0;
    await run('BEGIN IMMEDIATE');
    for (const r of data) {
      let h = heads.get(r.cth);
      const [d0, u] = desc[r.cth] || ['', ''];
      const d = String(d0 || '').replace(/\s+/g, ' ').trim(); // iCAFFE text carries non-breaking spaces
      const gstOk = r.gst === 'N' ? 0 : 1;
      if (!gstOk) gstOff++;
      if (!h) {
        const res = await run('INSERT INTO TariffHeaders (hsnCode, dutyType, description, isGstApplicable, uqc, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)',
          [r.cth, 'STANDARD', (d || '').toUpperCase().slice(0, 255) || null, gstOk, (u || '').trim().toUpperCase() || 'KGS', now(), now()]);
        h = { id: res.lastID, hsnCode: r.cth };
        heads.set(r.cth, h);
        added++;
      } else {
        const setDesc = !h.description && d;
        await run('UPDATE TariffHeaders SET isGstApplicable = ?' + (setDesc ? ', description = ?' : '') + ', updatedAt = ? WHERE id = ?',
          setDesc ? [gstOk, d.toUpperCase().slice(0, 255), now(), h.id] : [gstOk, now(), h.id]);
        if (setDesc) descFilled++;
      }
      await run("DELETE FROM TariffComponents WHERE tariffHeaderId = ? AND upper(dutyCategory) IN ('BCD','IGST','HEALTH')", [h.id]);
      for (const [cat, flag, rate, amount, uqc] of r.comps) {
        await run('INSERT INTO TariffComponents (dutyCategory, calculationFlag, rate, amount, uqc, createdAt, updatedAt, tariffHeaderId) VALUES (?,?,?,?,?,?,?,?)',
          [cat, flag, rate, amount, uqc || '', now(), now(), h.id]);
        comps++;
      }
    }
    await run('COMMIT');
    const withRates = (await all("SELECT count(DISTINCT tariffHeaderId) n FROM TariffComponents WHERE dutyCategory = 'BCD'"))[0].n;
    say('Headers added: ' + added + ' | descriptions filled: ' + descFilled + ' | GST not applicable: ' + gstOff);
    say('Duty rows written: ' + comps + ' | headers with BCD now: ' + withRates);
    say('DONE');
  } catch (e) {
    try { await run('ROLLBACK'); } catch (x) { /* nothing open */ }
    say('FAILED - nothing was changed: ' + (e && e.message));
  } finally {
    try { fs.writeFileSync(LOG, log.join('\r\n')); } catch (e) { /* ignore */ }
    db.close();
  }
})();
