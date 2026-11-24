// All iCAFFE directory parties into the EagleView Party Master (08-Nov-2026).
// Source: the IcaffeParties table (the iCAFFE Party Directory, filled by load_icaffe_parties.js / load_icaffe_consignees_new.js).
// What it does, for every directory row not yet in the Party Master (importedPartyId empty) of type CONSIGNEE, EXPORTER,
//   SUBAGENT, OVERSEAS_AGENT or SHIPLINE - the same as "Add to Party Master" (routes/icaffeParties.js), for all rows at once:
//   - a party already in the master with the same iCAFFE code or the same name is linked and gets the type tick
//     (e.g. Consignee) - nothing else in it is changed;
//   - otherwise a new party is made with its addresses (PartyBranches) and AD codes; a second iCAFFE code with the same name
//     becomes extra addresses of that party (an address already there is not repeated);
//   - the directory row is marked with the party id (importedPartyId). The directory rows themselves are kept as they are.
//   Names marked VOID in iCAFFE, or with fewer than 2 letters / digits, are not added (they stay in the directory only).
//   New consignees are marked searchOnly = 1: they are in the Party Master and found by every search, but are not in the full
//   party list that the job screens download (1.25 lakh more parties would make that list five times bigger). A consignee
//   joins that list the first time it is opened in the Party Master or used in a shipment.
// One transaction; a full copy of the database is written to backups\ first. --check = dry run, nothing saved.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const TL = path.join(__dirname, '_tariff_load');
const DRY = process.argv.includes('--check');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(path.dirname(DB), '..', 'backups', 'database_before_icaffe_parties_to_master_' + stamp + '.sqlite');
const LOG = path.join(fs.existsSync(TL) ? TL : __dirname, 'icaffe_parties_to_master_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const prep = (sql) => { const st = db.prepare(sql); return { run: (p) => new Promise((ok, no) => st.run(p, function (e) { e ? no(e) : ok(this); })), done: () => new Promise((ok) => st.finalize(ok)) }; };
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const log = []; const say = (x) => { console.log(x); log.push(x); };
const parse = (s, d) => { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } };
const nm = (v) => String(v || '').replace(/\s+/g, ' ').trim();
const key = (v) => nm(v).toUpperCase();
const v0 = (v) => { const t = v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); return t || null; };
const addrKey = (b) => [b.address1, b.city, b.pinCode].map(x => String(x || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()).join('|');

const FLAG = { EXPORTER: 'isShipper', CONSIGNEE: 'isConsignee', SUBAGENT: 'isSubAgent', OVERSEAS_AGENT: 'isOverseasAgent', SHIPLINE: 'isShipline' };
const PTYPE = { EXPORTER: 'SHIPPER', CONSIGNEE: 'CONSIGNEE', SUBAGENT: 'SUBAGENT', OVERSEAS_AGENT: 'AGENT', SHIPLINE: 'SHIPLINE' };

(async () => {
  try {
    await run('PRAGMA busy_timeout = 30000');
    if (!DRY) { fs.mkdirSync(path.dirname(BACKUP), { recursive: true }); say('Backup: ' + BACKUP); await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'"); }
    await run('BEGIN IMMEDIATE');
    if (!(await all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'IcaffeParties'")).length) throw new Error('IcaffeParties table not found');
    const pcols = new Set((await all('PRAGMA table_info(Parties)')).map(c => c.name));
    if (!pcols.has('searchOnly')) { await run('ALTER TABLE Parties ADD COLUMN searchOnly TINYINT(1) DEFAULT 0'); say('Column Parties.searchOnly added'); }
    await run('CREATE INDEX IF NOT EXISTS idx_parties_searchonly ON Parties (searchOnly)');
    say('Party Master before: ' + (await all('SELECT count(*) n FROM Parties'))[0].n + ' parties, ' + (await all('SELECT count(*) n FROM PartyBranches'))[0].n + ' addresses');

    // what the master has now
    const byCode = new Map(), byName = new Map(), flags = new Map();
    for (const p of await all('SELECT id, code, name, isShipper, isConsignee, isSubAgent, isOverseasAgent, isShipline FROM Parties')) {
      if (p.code && !byCode.has(p.code)) byCode.set(p.code, p.id);
      const k = key(p.name); if (k && !byName.has(k)) byName.set(k, p.id);
      flags.set(p.id, p);
    }
    const madeHere = new Map(); // party id -> { srNo, addrKeys:Set } for parties made in this run (extra addresses go there)

    const rows = await all(`SELECT * FROM IcaffeParties WHERE importedPartyId IS NULL AND coalesce(isActive, 1) = 1
                            AND partyType IN ('CONSIGNEE','EXPORTER','SUBAGENT','OVERSEAS_AGENT','SHIPLINE') ORDER BY partyType, id`);
    say('Directory rows not yet in the Party Master: ' + rows.length);

    const T = now();
    const insP = prep(`INSERT INTO Parties (partyType, code, name, extendedName, street, city, stateProvince, zipPostcode, countryCode, phoneNumber, email, taxId, panNumber,
      classType, iecNoReqd, rbiNumber, mercManuf, remarks, isShipper, isConsignee, isNotifyParty, isBuyer, isSubAgent, isOverseasAgent, isShipline, isIataAgent, isBank,
      paymentDeferred, blackList, kycApproved, kycStatus, searchOnly, createdAt, updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,?,?,?,0,0,0,0,0,'PENDING',?,?,?)`);
    const insB = prep(`INSERT INTO PartyBranches (partyId, branchSrNo, isDefault, branchName, contactPerson, address1, address2, city, state, country, pinCode, phone, mobile, fax,
      email1, email2, website, tanNo, gstin, regNo, ctxState, disabled, sez, gstExempted, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,0,?,?)`);
    const insA = prep(`INSERT INTO PartyADCodes (partyId, adCode, bankName, serialNo, forexCode, bankAddress, branchAddress, loadingPort, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    const mark = prep('UPDATE IcaffeParties SET importedPartyId = ?, updatedAt = ? WHERE id = ?');

    const cnt = { made: 0, branches: 0, adCodes: 0, linkedCode: 0, linkedName: 0, sameNameMerged: 0, extraAddr: 0, flagSet: 0, skipped: 0 };
    const byType = {}; const skippedList = [];
    const addBranch = async (pid, srNo, b, cc, isDef) => {
      await insB.run([pid, String(srNo), isDef ? 1 : 0, v0(b.branchName) || 'DEFAULT', v0(b.contactPerson), b.address1 || '', b.address2 || '', b.city || '', b.state || '',
        cc || b.country || '', b.pinCode || '', b.phone || '', b.mobile || '', b.fax || '', b.email1 || '', b.email2 || '', b.website || '', b.tanNo || '', b.gstin || '', b.gstin || '', b.gstStateCode || '', T, T]);
      cnt.branches++;
    };

    for (const r of rows) {
      const flag = FLAG[r.partyType];
      const name = nm(r.name);
      byType[r.partyType] = byType[r.partyType] || { made: 0, linked: 0, skipped: 0 };
      if (/^VOID\b/i.test(name) || (name.match(/[A-Z0-9]/gi) || []).length < 2) { cnt.skipped++; byType[r.partyType].skipped++; if (skippedList.length < 300) skippedList.push(r.partyType + ' ' + r.code + ' "' + name + '"'); continue; }
      const addresses = parse(r.addresses, []); const adCodes = parse(r.adCodes, []); const extra = parse(r.extra, {});
      let pid = (r.code && byCode.get(r.code)) || null; let how = pid ? 'code' : null;
      if (!pid) { pid = byName.get(key(name)) || null; if (pid) how = 'name'; }
      if (pid) {
        const p = flags.get(pid);
        if (p && !p[flag]) { await run('UPDATE Parties SET ' + flag + ' = 1, updatedAt = ? WHERE id = ?', [T, pid]); p[flag] = 1; cnt.flagSet++; }
        const m = madeHere.get(pid);
        if (m) { // a second iCAFFE code with the same name: its addresses join the party made a moment ago
          cnt.sameNameMerged++;
          for (const b of addresses) { const k = addrKey(b); if (!k.replace(/\|/g, '') || m.keys.has(k)) continue; m.keys.add(k); m.sr++; await addBranch(pid, m.sr, b, r.countryCode, false); cnt.extraAddr++; }
        } else if (how === 'code') cnt.linkedCode++; else cnt.linkedName++;
        byType[r.partyType].linked++;
      } else {
        const a = addresses[0] || {};
        const code = r.code && !byCode.has(r.code) ? r.code : null;
        const f = { isShipper: 0, isConsignee: 0, isSubAgent: 0, isOverseasAgent: 0, isShipline: 0 }; f[flag] = 1;
        const res = await insP.run([PTYPE[r.partyType], code, name, v0(extra.extendedName), [a.address1, a.address2].map(v0).filter(Boolean).join(', ') || null,
          v0(a.city || r.city), v0(a.state || r.state), v0(a.pinCode || r.pinCode), v0(r.countryCode), v0(a.phone || r.phone), v0(a.email1 || r.email),
          v0(r.iec), v0(r.pan), v0(r.classType), r.iec ? 1 : 0, v0(extra.rbiNumber), v0(extra.mercManuf), 'From iCAFFE ' + r.code,
          f.isShipper, f.isConsignee, f.isSubAgent, f.isOverseasAgent, f.isShipline, r.partyType === 'CONSIGNEE' ? 1 : 0, T, T]);
        pid = res.lastID; cnt.made++; byType[r.partyType].made++;
        if (code) byCode.set(code, pid); byName.set(key(name), pid); flags.set(pid, { id: pid, ...f });
        const m = { sr: 0, keys: new Set() }; madeHere.set(pid, m);
        for (const b of addresses) { m.sr++; m.keys.add(addrKey(b)); await addBranch(pid, m.sr, b, r.countryCode, m.sr === 1); }
        for (const c of adCodes) {
          if (!c || !c.adCode) continue;
          await insA.run([pid, c.adCode, c.bankName || '', c.serialNo || '', c.forexCode || '', c.bankAddress || '', c.branchAddress || '', c.port || '', T, T]); cnt.adCodes++;
        }
      }
      await mark.run([pid, T, r.id]);
    }
    await insP.done(); await insB.done(); await insA.done(); await mark.done();

    say('New parties made: ' + cnt.made + ' (with ' + cnt.branches + ' addresses, ' + cnt.adCodes + ' AD codes)');
    say('Linked to a party already in the master: by iCAFFE code ' + cnt.linkedCode + ', by name ' + cnt.linkedName + '; type tick added on ' + cnt.flagSet);
    say('Same name under another iCAFFE code (joined to one party): ' + cnt.sameNameMerged + ' (' + cnt.extraAddr + ' extra addresses added)');
    say('Not added (VOID / no real name - kept in the directory only): ' + cnt.skipped);
    for (const [k, v] of Object.entries(byType)) say('  ' + k + ': made ' + v.made + ', linked ' + v.linked + ', not added ' + v.skipped);
    say('Party Master now: ' + (await all('SELECT count(*) n FROM Parties'))[0].n + ' parties (' + (await all('SELECT count(*) n FROM Parties WHERE searchOnly = 1'))[0].n +
      ' search-only consignees), ' + (await all('SELECT count(*) n FROM PartyBranches'))[0].n + ' addresses');
    say('Consignees in the Party Master: ' + (await all('SELECT count(*) n FROM Parties WHERE isConsignee = 1'))[0].n);
    say('Directory rows still not in the Party Master: ' + (await all("SELECT partyType, count(*) n FROM IcaffeParties WHERE importedPartyId IS NULL GROUP BY partyType")).map(x => x.partyType + ' ' + x.n).join(', '));
    if (skippedList.length) say('Not added:\n  ' + skippedList.join('\n  '));
    if (DRY) { await run('ROLLBACK'); say('Check only (--check) - nothing saved.'); } else { await run('COMMIT'); say('Done. Restart the backend.'); }
  } catch (e) {
    say('FAILED - nothing was changed: ' + (e && e.stack || e));
    try { await run('ROLLBACK'); } catch (e2) { /* ignore */ }
  } finally {
    try { fs.writeFileSync(LOG, log.join('\n')); console.log('Log: ' + LOG); } catch (e) { /* ignore */ }
    db.close();
  }
})();
