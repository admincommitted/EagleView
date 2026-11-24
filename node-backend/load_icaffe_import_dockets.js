// iCAFFE Import dockets (Shipment Registration, Import Air / Import Sea) into EagleView Shipment Registration (08-Nov-2026).
// Source: _tariff_load\icaffe_dockets_<BRANCH>_<AI|SI>_*.json - read from iCAFFE docket by docket
//   (InfoAgent.FetchImportDocketByShipmentIdNew; containers with InfoAgent.GetImportContainerListByShipmentId for sea):
//   {"tag","kind":"air|sea","dockets":{"NDL/AI/1/2627":{DOCKETNO, ShipperName, SHIPPERID, ConsigneeName, MAWBNO, HAWBNO, ...}},
//    "containers":{"NDL/SI/1/2627":[{ContainerNumber, SealNumber, Nocont, CcontType, Packages, GrossWeight, Cbm}]}}
//   Several files may cover the same docket (a later read wins).
// What it does: one Shipments row per iCAFFE docket, with the iCAFFE docket no (NDL/AI/1/26) so the bills that carry that
//   docket no find it. The importer is the main party (linked to the Party Master by its iCAFFE code SHP/x), the overseas
//   supplier the other party; MAWB / HAWB with dates, airline (from the MAWB prefix), origin, destination, packages,
//   weights, IGM, sub agent, terms; containers for sea; the EDI job no = iCAFFE's Bill of Entry job for that docket (from
//   icaffe_be_joblist_*.json) with its BE no / date; everything iCAFFE sent is kept in dataJson.icaffe.
//   A docket already in EagleView that was made in EagleView (not from iCAFFE) is never changed; one loaded from iCAFFE
//   before is refreshed. Export dockets (AE / SE) are not in these files and are not touched.
// One transaction; a full copy of the database is written to backups\ first. --check = dry run, nothing saved.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const TL = path.join(__dirname, '_tariff_load');
const SRCS = process.env.EDI_SRC ? process.env.EDI_SRC.split(';') : (fs.existsSync(TL) ? fs.readdirSync(TL).filter(f => /^icaffe_dockets_[A-Z]+_(AI|SI)_.*\.json$/.test(f)).sort().map(f => path.join(TL, f)) : []);
const DRY = process.argv.includes('--check');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(path.dirname(DB), '..', 'backups', 'database_before_icaffe_import_dockets_' + stamp + '.sqlite');
const LOG = path.join(fs.existsSync(TL) ? TL : __dirname, 'icaffe_import_dockets_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const log = []; const say = (x) => { console.log(x); log.push(x); };
const t = (v, n = 255) => { const s = v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); return s && s !== '0' ? s.slice(0, n) : null; };
const num = (v) => { const n = parseFloat(v); return isNaN(n) || !n ? null : n; };
const ymd = (v) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(v || '').trim()); return m && m[3] > '1900' ? m[3] + '-' + m[2] + '-' + m[1] : null; };
const COLS = ['docketNo', 'division', 'branchCode', 'docketDate', 'clearanceDate', 'customsOnly', 'jobType', 'shipmentType', 'houseType', 'cargoType', 'freightTerm', 'nomination', 'shipmentTerm',
  'mainParty', 'mainPartyId', 'mainAddress', 'otherParty', 'overseasAgent', 'subAgent', 'billingType', 'billingParty', 'billingAddress', 'notifyParty', 'cha', 'mawbNo', 'mawbDate', 'hawbNo', 'hawbDate',
  'carrier', 'flightVessel', 'voyage', 'etd', 'eta', 'igmNo', 'igmDate', 'originPort', 'destinationPort', 'dischargePort', 'clearanceAt', 'pkgs', 'pkgUnit', 'grossWeight', 'chargeableWeight', 'volume',
  'goodsDesc', 'stage', 'currentStatus', 'docketOwner', 'referenceNo', 'remarks', 'marketingPerson', 'quotationNo', 'placeOfSupply', 'costCentre', 'ediJobNo', 'poNo'];
const NUMS = new Set(['pkgs', 'grossWeight', 'chargeableWeight', 'volume', 'customsOnly', 'mainPartyId']);
const JOB = { 1: 'CC-FF', 2: 'FF', 3: 'CC', 4: 'MISC', 5: 'GTA' };
const NOMINATION = { 0: 'Direct', 1: 'Nominated To Us', 2: 'Nominated To Others' };
const CARGO = { G: 'General', N: 'General', V: 'Valuable', H: 'Hazardous', P: 'Perishable', O: 'Others' };
const BILLING = { SH: 'Importer', CO: 'Supplier', OA: 'Overseas Agent', SA: 'SubAgent' };

(async () => {
  try {
    if (!SRCS.length) throw new Error('No _tariff_load\\icaffe_dockets_<branch>_<AI|SI>_*.json files');
    // read the files: a later file wins for the same docket
    const dk = new Map(), cont = new Map(); let files = 0;
    for (const f of SRCS) {
      const j = JSON.parse(fs.readFileSync(f, 'utf8')); files++;
      for (const [sid, r] of Object.entries(j.dockets || {})) if (r && r.DOCKETNO) dk.set(String(r.DOCKETNO).trim().toUpperCase(), r);
      for (const [sid, c] of Object.entries(j.containers || {})) if (Array.isArray(c)) cont.set(sid, c);
    }
    say('Source: ' + files + ' files, ' + dk.size + ' import dockets');
    // 08-Nov-2026: the EDI job no of a docket is iCAFFE's Bill of Entry job (EDI Operation > Bill Of Entry, JOB_NO), matched by
    // the docket no shown in its grid - from _tariff_load\icaffe_be_joblist_*.json; the BE no / date come from there too
    const beJob = new Map(); let beFiles = 0;
    for (const f of (fs.existsSync(TL) ? fs.readdirSync(TL) : []).filter(f => /^icaffe_be_joblist_.*\.json$/.test(f)).sort()) {
      const j = JSON.parse(fs.readFileSync(path.join(TL, f), 'utf8')); beFiles++;
      for (const r of j.rows || []) {
        const d = String(r.DOCKET_NO_TEXT || String(r.DOCKET_NO || '').replace(/<[^>]+>/g, '')).trim().toUpperCase();
        if (!d || /REGISTERED/.test(d) || String(r.VOID_JOB || '').trim() === 'Y') continue;
        const o = beJob.get(d); if (!o || +r.JOB_NO > +o.JOB_NO) beJob.set(d, r);
      }
    }
    say('Bill of Entry jobs with a docket no: ' + beJob.size + ' (' + beFiles + ' job list files)');
    // BE jobs not tied to a docket in iCAFFE ("Un-Registered") are matched to a docket that has no BE job by its HAWB, else
    // MAWB - only where exactly one such docket has it (by MAWB alone, also the importer's name must start the same)
    const nrm = (v) => String(v == null ? '' : v).replace(/<[^>]+>/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const unreg = [];
    for (const f of (fs.existsSync(TL) ? fs.readdirSync(TL) : []).filter(f => /^icaffe_be_joblist_.*\.json$/.test(f)).sort())
      for (const r of JSON.parse(fs.readFileSync(path.join(TL, f), 'utf8')).rows || []) {
        const d = String(r.DOCKET_NO_TEXT || String(r.DOCKET_NO || '').replace(/<[^>]+>/g, '')).trim().toUpperCase();
        if (String(r.VOID_JOB || '').trim() !== 'Y' && (!d || /REGISTERED/.test(d))) unreg.push(r);
      }
    const byH = new Map(), byM = new Map();
    for (const [no, r] of dk) { if (beJob.has(no)) continue; const h = nrm(r.HAWBNO), m = nrm(r.MAWBNO);
      if (h) byH.set(h, (byH.get(h) || []).concat(no)); if (m && m !== 'NOMAWB') byM.set(m, (byM.get(m) || []).concat(no)); }
    let matched = 0;
    for (const r of unreg) {
      const h = nrm(r.HAWB_STUFF), m = nrm(r.MAWB_STUFF);
      let c = h ? byH.get(h) : null; const viaH = !!(c && c.length === 1); if (!viaH && m && m !== 'NOMAWB') c = byM.get(m);
      if (!c || c.length !== 1 || beJob.has(c[0])) continue;
      // a HAWB is one shipment; a MAWB alone is trusted only when the importer's name starts the same
      const imp = nrm(dk.get(c[0]).ShipperName).slice(0, 6), bi = nrm(r.IMP_NAME).slice(0, 6);
      if (!viaH && imp && bi && imp !== bi) continue;
      beJob.set(c[0], r); matched++;
    }
    say('Un-registered BE jobs matched to a docket by HAWB / MAWB: ' + matched + ' of ' + unreg.length);
    await run('PRAGMA busy_timeout = 30000');
    if (!DRY) { fs.mkdirSync(path.dirname(BACKUP), { recursive: true }); say('Backup: ' + BACKUP); await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'"); }
    await run('BEGIN IMMEDIATE');
    // the table as routes/shipments.js makes it
    await run(`CREATE TABLE IF NOT EXISTS Shipments (id INTEGER PRIMARY KEY AUTOINCREMENT, ${COLS.map(c => c + (NUMS.has(c) ? ' REAL' : ' TEXT') + (c === 'docketNo' ? ' UNIQUE' : '')).join(', ')},
      containersJson TEXT, dimensionsJson TEXT, docsJson TEXT, dataJson TEXT, cancelReason TEXT, completedOn TEXT, createdBy TEXT, modifiedBy TEXT, createdAt DATETIME, updatedAt DATETIME)`);
    const have = new Set((await all('PRAGMA table_info(Shipments)')).map(c => c.name));
    for (const c of COLS) if (!have.has(c)) await run(`ALTER TABLE Shipments ADD COLUMN ${c} ${NUMS.has(c) ? 'REAL' : 'TEXT'}`);
    await run('CREATE INDEX IF NOT EXISTS idx_shipments_div ON Shipments (division, branchCode, docketDate)');
    await run('CREATE INDEX IF NOT EXISTS idx_shipments_mawb ON Shipments (mawbNo, hawbNo)');
    // lookups
    const br = new Map(); for (const b of await all('SELECT branchCode, icaffeCode FROM CompanyBranches').catch(() => [])) if (b.icaffeCode) br.set(String(b.icaffeCode).toUpperCase(), b.branchCode);
    const party = new Map(); for (const p of await all('SELECT id, code FROM Parties WHERE code IS NOT NULL')) if (!party.has(p.code)) party.set(p.code, p.id);
    const air = new Map(); for (const a of await all('SELECT name, prefix FROM Airlines WHERE prefix IS NOT NULL').catch(() => [])) { const k = String(a.prefix).replace(/\D/g, '').padStart(3, '0'); if (k !== '000' && !air.has(k)) air.set(k, a.name); }
    const old = new Map(); for (const s of await all('SELECT id, docketNo, createdBy FROM Shipments')) old.set(String(s.docketNo || '').trim().toUpperCase(), s);
    const S = new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00'); // 14-Nov-2026: the form Sequelize (SQLite) reads; 'T...Z' came back as null (job created time, timeline)
    const cnt = { added: 0, updated: 0, keptEagle: 0, linked: 0, carrier: 0, containers: 0, ediJob: 0 }; const byBr = {};
    for (const [no, r] of dk) {
      const m = /^([A-Z]+)\/(AI|SI)\//.exec(no); if (!m) continue;
      const div = m[2]; const sea = div === 'SI';
      const o = old.get(no);
      if (o && o.createdBy !== 'iCAFFE') { cnt.keptEagle++; continue; }
      const mawb = t(r.MAWBNO, 60) && !/^NO\s*MAWB$/i.test(String(r.MAWBNO).trim()) ? t(r.MAWBNO, 60) : null;
      let carrier = null;
      if (!sea && mawb) { const pre = String(mawb).replace(/\D/g, '').slice(0, 3); if (air.has(pre)) { carrier = air.get(pre); cnt.carrier++; } }
      if (sea) carrier = t(r.SHIPPINGLINE || r.SHIPPING_LINE || r.VESSELCODE, 120) || null;
      const pid = party.get(t(r.SHIPPERID)) || null; if (pid) cnt.linked++;
      const cs = (cont.get(r.SHIPMENTID) || []).filter(c => c && c.ContainerNumber).map(c => ({ no: String(c.ContainerNumber).trim().toUpperCase(), size: t(c.CcontType, 10) || '', type: '', seal: t(c.SealNumber, 40) || '', pkgs: num(c.Packages) || '', weight: num(c.GrossWeight) || '', cbm: num(c.Cbm) || '' }));
      cnt.containers += cs.length;
      const row = {
        docketNo: no, division: div, branchCode: br.get(m[1]) || m[1], docketDate: ymd(r.ReceivedDate), clearanceDate: ymd(r.CLEARANCE_DATE),
        customsOnly: String(r.ISCUSTOMCLEARANCEONLY).trim() === 'T' ? 1 : 0, jobType: JOB[r.JOBTYPE] || null,
        shipmentType: { C: 'Consol', N: 'Non Consol' }[String(r.SHIPMENT_TYPE || '').trim()] || t(r.SHIPMENT_TYPE, 20), houseType: { H: 'House', M: 'Master' }[String(r.TYPE || '').trim()] || null,
        cargoType: CARGO[String(r.CARGO_TYPE || '').trim()] || null, freightTerm: { P: 'Prepaid', C: 'Collect' }[String(r.NATURE || '').trim()] || null,
        nomination: NOMINATION[r.SHIPMENT_NOMINATE] || null, shipmentTerm: t(r.SHIPMENT_TERMS, 10),
        mainParty: t(r.ShipperName), mainPartyId: pid, mainAddress: t(r.SHIPPER_ADDRESS, 500), otherParty: t(r.ConsigneeName),
        overseasAgent: t(r.OVERSEAAGENT_IMP || r.TIEUP), subAgent: t(r.SUB_AGENT_NAME || r.SUBAGENTNAME), billingType: BILLING[String(r.BillingType || '').trim()] || null,
        billingParty: t(r.EXBILLINGCUSTOMER), notifyParty: t(r.NOTIFYNAME), cha: t(r.BROKERNAME),
        mawbNo: mawb, mawbDate: ymd(r.IMPMAWBNODATE), hawbNo: t(r.HAWBNO, 60), hawbDate: ymd(r.IMPHAWBNODATE),
        carrier, flightVessel: t(r.FLIGHTNO || r.VESSELCODE, 60), voyage: t(r.VOYAGE, 30), eta: null, etd: ymd(r.ATD),
        igmNo: t(r.IGM_NUMBER, 30), igmDate: ymd(r.IGM_DATE), originPort: t(r.ORIGINPORT, 80), destinationPort: t(r.DESTINATION, 80), dischargePort: t(r.DISCHARGEPORT, 80),
        clearanceAt: t(r.CLEARANCEAT, 20), pkgs: num(r.NOOFPKGS), pkgUnit: t(r.PKG_UNIT, 10), grossWeight: num(r.GROSS_WEIGHT), chargeableWeight: num(r.CHARGEABLE_WEIGHT),
        volume: null, goodsDesc: t(r.NATURE_OF_GOODS, 500), stage: 'Register', currentStatus: null, docketOwner: t(r.ENTERED_BY, 60), referenceNo: t(r.REFERENCENO, 60),
        remarks: null, marketingPerson: t(r.MARKETING_STAFF, 80), quotationNo: null, placeOfSupply: null, costCentre: null,
        ediJobNo: beJob.has(no) ? String(beJob.get(no).JOB_NO) : null, poNo: t(r.PONO, 40) && String(r.PONO).replace(/`/g, '').trim() || null
      };
      const data = {
        notifySame: String(r.NOTIFYSAMEASSHIPPER).trim() === 'T', sellerSame: String(r.SELLER_SAME_AS_SUPPLIER).trim() === 'T', seller: t(r.SELLER), subAgent2: t(r.SUBAGENTNAME2),
        subAgentAddress: t(r.SUB_AGENT_ADDRESS, 500), notifyAddress: t(r.NOTIFY_ADDRESS, 500), overseasAddress: t(r.OVERSEAAGENT_ADDREES_IMP || r.TIEUP_ADDRESS, 500), otherAddress: null,
        marks: t(r.MARKS, 500), netWeight: num(r.NETWEIGHT), grossUnit: t(r.GROSS_WEIGHT_UNIT, 10), value: num(r.AssessValue), totalDuty: num(r.TotalDuty), inwardDate: ymd(r.IGM_INWARD_DATE),
        grnNo: t(r.GRNNO, 40), destuffAt: t(r.DESTUFF, 60), clearance: t(r.CLEARANCE, 80),
        beNo: t((beJob.get(no) || {}).BENUMBER, 30) || t(r.BILLOFENTRY, 30), beDate: ymd((beJob.get(no) || {}).BEDATE) || ymd(r.BILLOFENTRYDATE),
        ediJobDate: beJob.has(no) ? ymd(beJob.get(no).JOB_DT) : null, beType: beJob.has(no) ? t(beJob.get(no).TYP, 5) : null,
        icaffeShipmentId: r.SHIPMENTID, icaffe: r
      };
      const cols = Object.keys(row).concat(['containersJson', 'dimensionsJson', 'docsJson', 'dataJson', 'createdBy', 'modifiedBy', 'updatedAt']);
      const vals = Object.values(row).concat([JSON.stringify(cs), '[]', '{}', JSON.stringify(data), 'iCAFFE', 'iCAFFE', S]);
      if (o) { await run('UPDATE Shipments SET ' + cols.map(c => c + ' = ?').join(', ') + ' WHERE id = ?', [...vals, o.id]); cnt.updated++; }
      else { await run('INSERT INTO Shipments (' + cols.join(', ') + ', createdAt) VALUES (' + cols.map(() => '?').join(', ') + ', ?)', [...vals, S]); cnt.added++; }
      if (row.ediJobNo) cnt.ediJob++;
      const k = row.branchCode + ' ' + div; byBr[k] = (byBr[k] || 0) + 1;
    }
    say('Dockets added: ' + cnt.added + ', refreshed (loaded from iCAFFE before): ' + cnt.updated + ', made in EagleView (left as they are): ' + cnt.keptEagle);
    say('  ' + Object.entries(byBr).sort().map(([k, v]) => k + ' ' + v).join(', '));
    say('Importer linked to the Party Master: ' + cnt.linked + '; airline found from the MAWB prefix: ' + cnt.carrier + '; containers: ' + cnt.containers + '; EDI (BE) job no set: ' + cnt.ediJob);
    say('Import dockets in EagleView now: ' + (await all("SELECT count(*) n FROM Shipments WHERE division IN ('AI','SI')"))[0].n);
    if (DRY) { await run('ROLLBACK'); say('Check only (--check) - nothing saved.'); } else { await run('COMMIT'); say('Done. Restart the backend.'); }
  } catch (e) {
    say('FAILED - nothing was changed: ' + (e && e.stack || e));
    try { await run('ROLLBACK'); } catch (e2) { /* ignore */ }
  } finally {
    try { fs.writeFileSync(LOG, log.join('\n')); console.log('Log: ' + LOG); } catch (e) { /* ignore */ }
    db.close();
  }
})();
