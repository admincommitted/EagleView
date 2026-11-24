// iCAFFE ledger addresses into EagleView ledgers (08-Nov-2026).
// Source: _tariff_load\icaffe_ledger_addresses_YYYYMMDD.json - iCAFFE Account Master, read account by account
//   (InfoAgent.FetchAddressByAccountIdAsString): {"accounts":{"ACC/673":{"own":[{Street1,Street2,City,PinCode,State,CountryName,
//   PhoneNumbers,MobileNumber,Email1,Email2,Email3,Contactperson,RegistrationNo,AddDefault,PartyAccId,...}],"bank":null}}}
//   iCAFFE also sends a default address (ADD/25229 of ACC/2875) with every account; the reader kept only the account's OWN
//   addresses (PartyAccId = that account) in "own" - the default one is never loaded.
// What it does: for each EagleView ledger with that iCAFFE id (AccountLedgers.icaffeId) and an own address in iCAFFE, the
//   default address (AddDefault = 1, else the first) fills address, state, pin code, country, GSTIN, phone, e-mail and
//   contact person - ONLY where that field is empty in EagleView. Nothing filled in EagleView is overwritten.
//   Ledgers whose GSTIN in EagleView differs from iCAFFE's are listed in icaffe_ledger_gstin_differs_<stamp>.csv (not changed).
// One transaction; a full copy of the database is written to backups\ first. --check = dry run, nothing saved.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const TL = path.join(__dirname, '_tariff_load');
const SRC = process.env.EDI_SRC || (fs.existsSync(TL) ? fs.readdirSync(TL).filter(f => /^icaffe_ledger_addresses_\d+.*\.json$/.test(f)).sort().map(f => path.join(TL, f)).pop() : null);
const DRY = process.argv.includes('--check');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(path.dirname(DB), '..', 'backups', 'database_before_icaffe_ledger_addresses_' + stamp + '.sqlite');
const LOG = path.join(SRC ? path.dirname(SRC) : TL, 'icaffe_ledger_addresses_result_' + stamp + '.txt');
const CSV = path.join(SRC ? path.dirname(SRC) : TL, 'icaffe_ledger_gstin_differs_' + stamp + '.csv');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const log = []; const say = (s) => { console.log(s); log.push(s); };
const t = (v, n = 500) => { const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); return s && s !== '0' ? s.slice(0, n) : null; };
const empty = (v) => v == null || String(v).trim() === '';
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const COUNTRY = { INDIA: 'IN' };
const cq = (v) => (/[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v == null ? '' : v));

(async () => {
  try {
    if (!SRC) throw new Error('No _tariff_load\\icaffe_ledger_addresses_*.json file');
    const src = JSON.parse(fs.readFileSync(SRC, 'utf8')).accounts || {};
    say('Source: ' + SRC + ' - ' + Object.keys(src).length + ' iCAFFE accounts, ' + Object.values(src).filter(a => (a.own || []).length).length + ' with their own address');
    await run('PRAGMA busy_timeout = 30000');
    if (!DRY) { fs.mkdirSync(path.dirname(BACKUP), { recursive: true }); say('Backup: ' + BACKUP); await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'"); }
    await run('BEGIN IMMEDIATE');
    const cols = new Set((await all('PRAGMA table_info(AccountLedgers)')).map(c => c.name));
    for (const [c, ty] of [['address', 'TEXT'], ['state', 'VARCHAR(255)'], ['pinCode', 'VARCHAR(50)'], ['country', 'VARCHAR(255)'], ['gstin', 'VARCHAR(50)'], ['phone', 'VARCHAR(50)'], ['email', 'VARCHAR(150)'], ['contactPerson', 'VARCHAR(150)']])
      if (!cols.has(c)) await run('ALTER TABLE AccountLedgers ADD COLUMN ' + c + ' ' + ty);
    const leds = await all('SELECT l.id, l.name, l.icaffeId, l.address, l.state, l.pinCode, l.country, l.gstin, l.phone, l.email, l.contactPerson, g.name groupName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId WHERE l.icaffeId IS NOT NULL');
    const S = new Date().toISOString();
    const cnt = { ledgers: 0, address: 0, state: 0, pinCode: 0, country: 0, gstin: 0, phone: 0, email: 0, contactPerson: 0, creditors: 0 };
    const diff = []; let badGst = 0;
    for (const l of leds) {
      const own = ((src[l.icaffeId] || {}).own || []).filter(x => !x.PartyAccId || x.PartyAccId === l.icaffeId);
      if (!own.length) continue;
      const a = own.find(x => String(x.AddDefault) === '1') || own[0];
      const street = t([a.Street1, a.Street2, a.City].map(x => t(x)).filter(Boolean).join(', '));
      let g = t(a.RegistrationNo || a.PartyGSTIN, 20); if (g) { g = g.toUpperCase(); if (!GSTIN.test(g)) { badGst++; g = null; } }
      const phone = t([t(a.MobileNumber), t(a.PhoneNumbers)].filter(Boolean).join(', '), 50);
      const email = t([a.Email1, a.Email2, a.Email3].map(x => t(x)).filter(Boolean).join(', ').toLowerCase(), 150);
      const ctry = t(a.CountryName, 60); const country = ctry ? (COUNTRY[ctry.toUpperCase()] || ctry) : null;
      const want = { address: street, state: t(a.State || a.StateName, 100) && t(a.State || a.StateName, 100).toUpperCase(), pinCode: t(a.PinCode, 20), country, gstin: g, phone, email, contactPerson: t(a.Contactperson, 150) };
      if (!empty(l.gstin) && g && String(l.gstin).trim().toUpperCase() !== g) diff.push([l.icaffeId, l.name, l.groupName, l.gstin, g]);
      const set = [], val = [];
      for (const k of Object.keys(want)) if (empty(l[k]) && want[k]) { set.push(k + ' = ?'); val.push(want[k]); cnt[k]++; }
      if (!set.length) continue;
      await run('UPDATE AccountLedgers SET ' + set.join(', ') + ', updatedAt = ? WHERE id = ?', [...val, S, l.id]);
      cnt.ledgers++; if (empty(l.address) && want.address && /creditor/i.test(l.groupName || '')) cnt.creditors++;
    }
    say('Ledgers updated: ' + cnt.ledgers + ' (only empty fields filled)');
    say('  address ' + cnt.address + ' (of which Sundry Creditors ' + cnt.creditors + '), state ' + cnt.state + ', pin ' + cnt.pinCode + ', country ' + cnt.country);
    say('  GSTIN ' + cnt.gstin + ', phone ' + cnt.phone + ', e-mail ' + cnt.email + ', contact person ' + cnt.contactPerson);
    if (badGst) say('iCAFFE GSTINs not in the right format (not used): ' + badGst);
    fs.writeFileSync(CSV, ['iCAFFE A/c,Ledger,Group,GSTIN in EagleView (kept),GSTIN in iCAFFE', ...diff.map(r => r.map(cq).join(','))].join('\n'));
    say('Ledgers whose GSTIN differs from iCAFFE (not changed - for the accounts team): ' + diff.length + ' - ' + CSV);
    if (DRY) { await run('ROLLBACK'); say('Check only (--check) - nothing saved.'); } else { await run('COMMIT'); say('Done.'); }
  } catch (e) {
    say('FAILED - nothing was changed: ' + (e && e.stack || e));
    try { await run('ROLLBACK'); } catch (e2) { /* ignore */ }
  } finally {
    try { fs.writeFileSync(LOG, log.join('\n')); console.log('Log: ' + LOG); } catch (e) { /* ignore */ }
    db.close();
  }
})();
