// iCAFFE consignees / suppliers made after the 04-Nov party read, into the iCAFFE Party Directory (08-Nov-2026).
// Source: _tariff_load\icaffe_consignees_new_YYYYMMDD.json - {"consignees":{"CON/173711":{"name":"...","addresses":[{Street1,
//   Street2,City,PinCode,State,CountryName,PhoneNumbers,MobileNumber,Email1,Email2,Contactperson,RegistrationNo,AddressID,...}]}}}
//   (iCAFFE Supplier / Consignee Master: names from CSGateway.AutoSuggestConsignee, addresses from ConsigneeMaster.FetchAddress;
//   only each consignee's own addresses).
// What it does: adds them to IcaffeParties (partyType CONSIGNEE) exactly as load_icaffe_parties.js does for the 04-Nov read -
//   a code already there is updated (name, address), nothing else is changed. Consignees stay in the directory and are added to
//   the Party Master one by one with "Add to Party Master", as before.
// One transaction; a full copy of the database is written to backups\ first. --check = dry run, nothing saved.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const TL = path.join(__dirname, '_tariff_load');
const SRC = process.env.EDI_SRC || (fs.existsSync(TL) ? fs.readdirSync(TL).filter(f => /^icaffe_consignees_new_\d+.*\.json$/.test(f)).sort().map(f => path.join(TL, f)).pop() : null);
const DRY = process.argv.includes('--check');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(path.dirname(DB), '..', 'backups', 'database_before_icaffe_consignees_' + stamp + '.sqlite');
const LOG = path.join(SRC ? path.dirname(SRC) : TL, 'icaffe_consignees_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const log = []; const say = (x) => { console.log(x); log.push(x); };
const s = (v, n = 255) => { const t = v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); return t ? t.slice(0, n) : null; };

(async () => {
  try {
    if (!SRC) throw new Error('No _tariff_load\\icaffe_consignees_new_*.json file');
    const src = JSON.parse(fs.readFileSync(SRC, 'utf8')).consignees || {};
    say('Source: ' + SRC + ' - ' + Object.keys(src).length + ' consignees');
    await run('PRAGMA busy_timeout = 30000');
    if (!DRY) { fs.mkdirSync(path.dirname(BACKUP), { recursive: true }); say('Backup: ' + BACKUP); await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'"); }
    await run('BEGIN IMMEDIATE');
    const tbl = (await all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'IcaffeParties'")).length;
    if (!tbl) throw new Error('IcaffeParties table not found - run load_icaffe_parties.bat first');
    const ctry = new Map((await all('SELECT code, name FROM Countries').catch(() => [])).map(r => [String(r.name).toUpperCase().replace(/[^A-Z]/g, ''), r.code]));
    for (const [k, v] of [['USA', 'US'], ['UNITEDSTATES', 'US'], ['UNITEDSTATESOFAMERICA', 'US'], ['UK', 'GB'], ['UNITEDKINGDOM', 'GB'], ['UAE', 'AE'], ['UNITEDARABEMIRATES', 'AE'], ['KOREA', 'KR'], ['SOUTHKOREA', 'KR'], ['RUSSIA', 'RU'], ['VIETNAM', 'VN'], ['INDIA', 'IN']]) if (!ctry.has(k)) ctry.set(k, v);
    const have = new Set((await all("SELECT code FROM IcaffeParties WHERE partyType = 'CONSIGNEE'")).map(r => r.code));
    const t = now(); let added = 0, updated = 0, skipped = 0;
    for (const [code, c] of Object.entries(src)) {
      const name = s(c.name); if (!/^CON\/\d+$/.test(code) || !name) { skipped++; continue; }
      const ads = (c.addresses || []).filter(a => !a.TypeID || a.TypeID === code);
      const addresses = ads.map((a, i) => ({ address1: s(a.Street1) || '', address2: s(a.Street2) || '', city: s(a.City) || '', state: s(a.State || a.StateName) || '', pinCode: s(a.PinCode, 20) || '',
        country: s(a.CountryName) || '', phone: s(a.PhoneNumbers, 100) || '', mobile: s(a.MobileNumber, 50) || '', fax: s(a.FaxNumber1, 50) || '', email1: s(a.Email1) || '', email2: s(a.Email2) || '',
        contactPerson: s(a.Contactperson) || '', gstin: s(a.RegistrationNo || a.PartyGSTIN, 20) || '', addressId: a.AddressID || '', isDefault: i === 0 }));
      const a0 = addresses[0] || {};
      const cc = ctry.get(String(a0.country || '').toUpperCase().replace(/[^A-Z]/g, '')) || null;
      await run(`INSERT INTO IcaffeParties (partyType, code, name, gstin, city, state, pinCode, countryCode, phone, email, addresses, isActive, createdAt, updatedAt)
                 VALUES ('CONSIGNEE',?,?,?,?,?,?,?,?,?,?,1,?,?)
                 ON CONFLICT(partyType, code) DO UPDATE SET name = excluded.name, gstin = excluded.gstin, city = excluded.city, state = excluded.state,
                 pinCode = excluded.pinCode, countryCode = excluded.countryCode, phone = excluded.phone, email = excluded.email, addresses = excluded.addresses, updatedAt = excluded.updatedAt`,
        [code, name, s(a0.gstin, 20), s(a0.city, 100), s(a0.state, 100), s(a0.pinCode, 20), s(cc, 5), s(a0.phone || a0.mobile, 100), s(a0.email1), addresses.length ? JSON.stringify(addresses) : null, t, t]);
      if (have.has(code)) updated++; else { added++; have.add(code); }
    }
    say('Consignees added to the iCAFFE Party Directory: ' + added + '; already there (updated): ' + updated + '; skipped (no name): ' + skipped);
    say('Consignees in the directory now: ' + (await all("SELECT count(*) n FROM IcaffeParties WHERE partyType = 'CONSIGNEE'"))[0].n);
    if (DRY) { await run('ROLLBACK'); say('Check only (--check) - nothing saved.'); } else { await run('COMMIT'); say('Done.'); }
  } catch (e) {
    say('FAILED - nothing was changed: ' + (e && e.stack || e));
    try { await run('ROLLBACK'); } catch (e2) { /* ignore */ }
  } finally {
    try { fs.writeFileSync(LOG, log.join('\n')); console.log('Log: ' + LOG); } catch (e) { /* ignore */ }
    db.close();
  }
})();
