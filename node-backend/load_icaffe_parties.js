// iCAFFE party masters (04-Nov-2026): Exporter, Consignee, Sub Agent, Oversea Agent, Shipline, IATA Agent, Bank BRO.
// Source: _tariff_load/icaffe_parties_load.json  { rows: [ {t, code, name, iec, pan, gstin, cls, city, state, pin, cc, phone,
//         email, addresses:[...], adCodes:[...], dbk:[...], extra:{...}} ] }
//   IcaffeParties : new table (party directory, searched from Masters > iCAFFE Party Directory). Rows are added / updated;
//                   the link to the Party master (importedPartyId) is kept. Nothing in the Party master is changed here.
//   IataAgents    : the iCAFFE IATA agents that are not there yet (by name) are added.
// One transaction; a full copy of the database is written to backups\ first.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = path.join(__dirname, 'database.sqlite');
const DATA = path.join(__dirname, '_tariff_load', 'icaffe_parties_load.json');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(__dirname, '..', 'backups', 'database_before_icaffe_parties_' + stamp + '.sqlite');
const LOG = path.join(__dirname, '_tariff_load', 'icaffe_parties_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const s = (v, n = 255) => { const t = v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); return t ? t.slice(0, n) : null; };
const j = (v) => (v && (Array.isArray(v) ? v.length : Object.keys(v).length) ? JSON.stringify(v) : null);

(async () => {
  try {
    await run('PRAGMA busy_timeout = 30000');
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    say('Backup: ' + BACKUP);
    await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'");
    const d = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    await run('BEGIN IMMEDIATE');
    await run(`CREATE TABLE IF NOT EXISTS IcaffeParties (id INTEGER PRIMARY KEY AUTOINCREMENT, partyType VARCHAR(20) NOT NULL, code VARCHAR(30) NOT NULL,
      name VARCHAR(255) NOT NULL, iec VARCHAR(20), pan VARCHAR(20), gstin VARCHAR(20), classType VARCHAR(5), city VARCHAR(100), state VARCHAR(100),
      pinCode VARCHAR(20), countryCode VARCHAR(5), phone VARCHAR(100), email VARCHAR(255), addresses TEXT, adCodes TEXT, dbkAccounts TEXT, extra TEXT,
      importedPartyId INTEGER, isActive TINYINT(1) DEFAULT 1, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, UNIQUE (partyType, code))`);
    await run('CREATE INDEX IF NOT EXISTS icaffe_parties_name ON IcaffeParties (name)');
    await run('CREATE INDEX IF NOT EXISTS icaffe_parties_iec ON IcaffeParties (iec)');
    await run('CREATE INDEX IF NOT EXISTS icaffe_parties_gstin ON IcaffeParties (gstin)');
    const t = now();
    const count = {};
    // country name (as iCAFFE writes it) -> code from the Country master
    const ctry = new Map((await all('SELECT code, name FROM Countries')).map(r => [String(r.name).toUpperCase().replace(/[^A-Z]/g, ''), r.code]));
    for (const [k, v] of [['USA', 'US'], ['UNITEDSTATESOFAMERICA', 'US'], ['UK', 'GB'], ['UNITEDKINGDOM', 'GB'], ['UAE', 'AE'], ['UNITEDARABEMIRATES', 'AE'], ['KOREA', 'KR'], ['SOUTHKOREA', 'KR'], ['RUSSIA', 'RU'], ['VIETNAM', 'VN']]) if (!ctry.has(k)) ctry.set(k, v);
    const ccOf = (r) => r.cc || ctry.get(String(((r.addresses || [])[0] || {}).country || '').toUpperCase().replace(/[^A-Z]/g, '')) || null;
    for (const r of d.rows) {
      const name = s(r.name);
      if (!r.t || !r.code || !name) continue;
      await run(`INSERT INTO IcaffeParties (partyType, code, name, iec, pan, gstin, classType, city, state, pinCode, countryCode, phone, email, addresses, adCodes,
                 dbkAccounts, extra, isActive, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)
                 ON CONFLICT(partyType, code) DO UPDATE SET name = excluded.name, iec = excluded.iec, pan = excluded.pan, gstin = excluded.gstin,
                 classType = excluded.classType, city = excluded.city, state = excluded.state, pinCode = excluded.pinCode, countryCode = excluded.countryCode,
                 phone = excluded.phone, email = excluded.email, addresses = excluded.addresses, adCodes = excluded.adCodes, dbkAccounts = excluded.dbkAccounts,
                 extra = excluded.extra, updatedAt = excluded.updatedAt`,
        [r.t, s(r.code, 30), name, s(r.iec, 20), s(r.pan, 20), s(r.gstin, 20), s(r.cls, 5), s(r.city, 100), s(r.state, 100), s(r.pin, 20), s(ccOf(r), 5),
          s(r.phone, 100), s(r.email), j(r.addresses), j(r.adCodes), j(r.dbk), j(r.extra), t, t]);
      count[r.t] = (count[r.t] || 0) + 1;
    }
    for (const k of Object.keys(count)) say('IcaffeParties ' + k + ': ' + count[k]);

    // IATA agents into the IATA Agent master (name not there yet)
    const nk = (v) => String(v || '').toUpperCase().replace(/\bLIMITED\b/g, 'LTD').replace(/\bPRIVATE\b/g, 'PVT').replace(/[^A-Z0-9]/g, '');
    const have = new Set((await all('SELECT name FROM IataAgents')).map(r => nk(r.name)));
    let ia = 0;
    for (const r of d.rows.filter(x => x.t === 'IATA_AGENT')) {
      const name = s(r.name); if (!name || have.has(nk(name))) continue;
      const a = (r.addresses || [])[0] || {};
      const br = (r.addresses || []).map((b, i) => ({ id: Date.now() + i, defaultAddress: i === 0, contactPerson: b.contactPerson || '', branchName: b.branchName || b.city || '',
        address1: b.address1 || '', address2: b.address2 || '', city: b.city || '', state: b.state || '', country: b.country || '', pinCode: b.pinCode || '',
        gstState: b.gstStateCode || '', gstNo: b.gstin || '', fax: b.fax || '', phone: b.phone || '', mobile: b.mobile || '', website: b.website || '',
        email1: b.email1 || '', email2: b.email2 || '', gstExempted: false }));
      await run(`INSERT INTO IataAgents (name, iataCode, panNumber, isDefault, contactPerson, branchName, address1, address2, city, state, country, pinCode, gstNo,
                 phone, mobile, email1, branches, commissionType, createdAt, updatedAt) VALUES (?,?,?,0,?,?,?,?,?,?,?,?,?,?,?,?,?,'PERCENT',?,?)`,
        [name, s((r.extra || {}).iataCode, 30), s(r.pan, 20), s(a.contactPerson), s(a.branchName), s(a.address1), s(a.address2), s(a.city), s(a.state),
          s(a.country), s(a.pinCode), s(a.gstin), s(a.phone), s(a.mobile), s(a.email1), JSON.stringify(br), t, t]);
      have.add(nk(name)); ia++;
    }
    say('IataAgents added: ' + ia);
    await run('COMMIT');
    const st = await all('SELECT partyType, count(*) n FROM IcaffeParties GROUP BY partyType');
    say('Check: ' + st.map(x => x.partyType + ' ' + x.n).join(', '));
    say('DONE');
  } catch (e) {
    try { await run('ROLLBACK'); } catch (x) { /* nothing open */ }
    say('FAILED - nothing was changed: ' + (e && e.message));
  } finally {
    try { fs.writeFileSync(LOG, log.join('\r\n')); } catch (e) { /* ignore */ }
    db.close();
  }
})();
