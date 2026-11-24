// iCAFFE parties into the Unified Party Master (04-Nov-2026). Source: table IcaffeParties (load_icaffe_parties.bat first).
//   Parties        : new columns isShipline / isIataAgent / isBank.
//   Exporters, Sub Agents, Overseas Agents, Shiplines and IATA Agents from the directory are added as parties
//   (code = iCAFFE code SHP/123, AGT/12 ...), with their addresses (PartyBranches) and exporter AD codes (PartyADCodes).
//   A party that is already there (same iCAFFE code, or same name) is not added again: it gets the type flag and the link.
//   Consignees stay in the iCAFFE Party Directory (1.2 lakh rows; they are added one by one with "Add to Party Master").
//   Junk names ("..", "(VOID) ...", names without letters) are left out.
// One transaction; a full copy of the database is written to backups\ first.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = path.join(__dirname, 'database.sqlite');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(__dirname, '..', 'backups', 'database_before_party_master_load_' + stamp + '.sqlite');
const LOG = path.join(__dirname, '_tariff_load', 'party_master_load_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const parse = (s, d) => { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } };
const t0 = (v, n = 255) => { const t = v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); return t ? t.slice(0, n) : null; };
const key = (v) => String(v || '').toUpperCase().replace(/\bLIMITED\b/g, 'LTD').replace(/\bPRIVATE\b/g, 'PVT').replace(/[^A-Z0-9]/g, '');

const TYPES = { EXPORTER: ['isShipper', 'SHIPPER'], SUBAGENT: ['isSubAgent', 'SUBAGENT'], OVERSEAS_AGENT: ['isOverseasAgent', 'AGENT'], SHIPLINE: ['isShipline', 'SHIPLINE'] }; // IATA agents: IATA Agent Master

(async () => {
  try {
    await run('PRAGMA busy_timeout = 30000');
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    say('Backup: ' + BACKUP);
    await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'");
    await run('BEGIN IMMEDIATE');
    const cols = new Set((await all('PRAGMA table_info(Parties)')).map(c => c.name));
    for (const c of ['isShipline', 'isIataAgent', 'isBank']) if (!cols.has(c)) { await run('ALTER TABLE Parties ADD COLUMN ' + c + ' TINYINT(1) DEFAULT 0'); say('Parties: column added ' + c); }

    const parties = await all('SELECT id, code, name FROM Parties');
    const byCode = new Map(parties.filter(p => p.code).map(p => [String(p.code).toUpperCase(), p.id]));
    const byName = new Map();
    for (const p of parties) { const k = key(p.name); if (k && !byName.has(k)) byName.set(k, p.id); }

    const rows = await all("SELECT * FROM IcaffeParties WHERE partyType IN ('EXPORTER','SUBAGENT','OVERSEAS_AGENT','SHIPLINE') ORDER BY partyType, id");
    const t = now();
    const stat = {};
    const st = (k) => { stat[k] = (stat[k] || 0) + 1; };
    for (const r of rows) {
      const [flag, ptype] = TYPES[r.partyType];
      const name = t0(r.name);
      if (!name || !/[A-Za-z]{2}/.test(name) || /^\(?\s*VOID\b/i.test(name) || /^[\W_]*\(VOID/i.test(name)) { st(r.partyType + ' skipped (junk name)'); continue; }
      let id = r.importedPartyId || byCode.get(String(r.code).toUpperCase()) || byName.get(key(name));
      if (id) {
        await run('UPDATE Parties SET ' + flag + ' = 1, updatedAt = ? WHERE id = ? AND (' + flag + ' IS NULL OR ' + flag + ' = 0)', [t, id]);
        await run('UPDATE IcaffeParties SET importedPartyId = ?, updatedAt = ? WHERE id = ?', [id, t, r.id]);
        st(r.partyType + ' already there (linked)');
        continue;
      }
      const addrs = parse(r.addresses, []);
      const extra = parse(r.extra, {});
      const a = addrs.find(x => x.isDefault) || addrs[0] || {};
      const res = await run(`INSERT INTO Parties (partyType, code, name, street, city, stateProvince, zipPostcode, countryCode, phoneNumber, email, taxId, panNumber,
          classType, iecNoReqd, extendedName, rbiNumber, mercManuf, remarks, isShipper, isConsignee, isNotifyParty, isBuyer, isSubAgent, isOverseasAgent,
          isShipline, isIataAgent, isBank, paymentDeferred, blackList, kycApproved, kycStatus, createdAt, updatedAt)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,?,?,?,?,0,0,0,0,'PENDING',?,?)`,
        [ptype, t0(r.code, 30), name, t0([a.address1, a.address2].filter(Boolean).join(', '), 255), t0(a.city || r.city, 100), t0(a.state || r.state, 100),
          t0(a.pinCode || r.pinCode, 20), t0(r.countryCode, 5), t0(a.phone || a.mobile || r.phone, 100), t0(a.email1 || r.email), t0(r.iec, 20), t0(r.pan, 20),
          t0(r.classType, 5), r.iec ? 1 : 0, t0(extra.extendedName), t0(extra.rbiNumber), t0(extra.mercManuf), 'From iCAFFE ' + r.code,
          flag === 'isShipper' ? 1 : 0, 0, flag === 'isSubAgent' ? 1 : 0, flag === 'isOverseasAgent' ? 1 : 0, flag === 'isShipline' ? 1 : 0, flag === 'isIataAgent' ? 1 : 0, t, t]);
      id = res.lastID;
      let n = 0;
      for (const b of addrs) {
        n++;
        await run(`INSERT INTO PartyBranches (partyId, branchSrNo, isDefault, branchName, contactPerson, address1, address2, city, state, country, pinCode, phone, mobile, fax,
            email1, email2, website, tanNo, gstin, regNo, ctxState, disabled, sez, gstExempted, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,0,?,?)`,
          [id, String(n), (b === a) ? 1 : 0, t0(b.branchName) || 'DEFAULT', t0(b.contactPerson), t0(b.address1) || '', t0(b.address2) || '', t0(b.city) || '', t0(b.state) || '',
            t0(r.countryCode) || t0(b.country) || '', t0(b.pinCode) || '', t0(b.phone) || '', t0(b.mobile) || '', t0(b.fax) || '', t0(b.email1) || '', t0(b.email2) || '',
            t0(b.website) || '', t0(b.tanNo) || '', t0(b.gstin) || '', t0(b.gstin) || '', t0(b.gstStateCode) || '', t, t]);
      }
      for (const c of parse(r.adCodes, [])) {
        if (!c.adCode) continue;
        await run('INSERT INTO PartyADCodes (partyId, adCode, bankName, serialNo, branchAddress, forexCode, bankAddress, loadingPort, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [id, t0(c.adCode, 20), t0(c.bankName) || '', '', '', t0(c.forexCode) || '', t0(c.bankAddress) || '', t0(c.port) || '', t, t]);
      }
      await run('UPDATE IcaffeParties SET importedPartyId = ?, updatedAt = ? WHERE id = ?', [id, t, r.id]);
      byCode.set(String(r.code).toUpperCase(), id);
      byName.set(key(name), id);
      st(r.partyType + ' added');
    }
    await run('COMMIT');
    for (const k of Object.keys(stat).sort()) say(k + ': ' + stat[k]);
    const c = (await all('SELECT count(*) n, sum(isShipper) s, sum(isSubAgent) sa, sum(isOverseasAgent) oa, sum(isShipline) sl, sum(isIataAgent) ia FROM Parties'))[0];
    say('Check: Parties ' + c.n + ' (exporters ' + c.s + ', sub agents ' + c.sa + ', overseas agents ' + c.oa + ', shiplines ' + c.sl + ', IATA agents ' + c.ia + ')');
    say('DONE');
  } catch (e) {
    try { await run('ROLLBACK'); } catch (x) { /* nothing open */ }
    say('FAILED - nothing was changed: ' + (e && e.message));
  } finally {
    try { fs.writeFileSync(LOG, log.join('\r\n')); } catch (e) { /* ignore */ }
    db.close();
  }
})();
