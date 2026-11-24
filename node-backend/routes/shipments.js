// 05-Nov-2026: Shipment Registration (iCAFFE Operation > Shipment Registration) - the freight docket.
// Four divisions, each branch-wise: AI Import Air, SI Import Sea, AE Export Air, SE Export Sea.
// Docket no: <branch>/<division>/<serial>/<yy>, e.g. DEL/AI/1001/26 - one series per branch, division and financial year.
// Tabs as on iCAFFE: Shipment, Search, Receiving Documents, Shipment Status, Complete/Cancel, Activity Details,
// Provisional Cost Sheet (the one GST Invoice uses), Due Dates, Document List.
// Tables are made on first use: Shipments, ShipmentEvents (status, activities, received papers, due dates), ShipmentSeries.
const express = require('express');
const router = express.Router();
const { sequelize } = require('../db');
const { QueryTypes } = require('sequelize');

const q = (sql, p = [], t) => sequelize.query(sql, { replacements: p, type: QueryTypes.SELECT, transaction: t });
const x = (sql, p = [], t) => sequelize.query(sql, { replacements: p, transaction: t });
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const today = () => new Date().toISOString().slice(0, 10);
const bad = (m) => Object.assign(new Error(m), { status: 400 });
const userOf = (req) => (req.user && (req.user.fullName || req.user.name || req.user.username)) || req.headers['x-user-name'] || '';
// /:id is a number only (Express 5 has no '(\d+)' in paths)
router.param('id', (req, res, next, id) => (/^\d+$/.test(String(id)) ? next() : next('route')));

const DIVS = {
  AI: { label: 'Import Air', side: 'Import', mode: 'Air' }, SI: { label: 'Import Sea', side: 'Import', mode: 'Sea' },
  AE: { label: 'Export Air', side: 'Export', mode: 'Air' }, SE: { label: 'Export Sea', side: 'Export', mode: 'Sea' },
};
// milestones of the Shipment Status tab, per division
const STATUS_LEVELS = {
  AI: ['Pre-alert received', 'Flight arrived', 'IGM filed', 'Documents received', 'BE filed', 'Assessment', 'Duty paid', 'Examination', 'Out of charge', 'DO collected', 'Cargo delivered', 'Docket closed'],
  SI: ['Pre-alert received', 'Vessel arrived', 'IGM filed', 'Documents received', 'BE filed', 'Assessment', 'Duty paid', 'Examination', 'Out of charge', 'DO collected', 'Container delivered', 'Empty returned', 'Docket closed'],
  AE: ['Booking received', 'Documents received', 'Cargo received at terminal', 'SB filed', 'Examination', 'Let export order', 'Handed over to airline', 'Flight departed', 'Pre-alert sent', 'Docket closed'],
  SE: ['Booking confirmed', 'Empty container picked', 'Stuffing done', 'Documents received', 'SB filed', 'Let export order', 'Gated in at port', 'Vessel sailed', 'BL released', 'Pre-alert sent', 'Docket closed'],
};
const DOC_LIST = {
  Import: ['CWC RECEIPT', 'TC RECEIPT', 'BC RECEIPT', 'AAI RECEIPT', 'E.P. COPY', 'EXPORTER COPY', 'CERTIFICATE OF ORIGIN', 'BOND BG', 'D.O. RECEIPT', 'IMPORT DUTY RECEIPT', 'COMMERCIAL INVOICE', 'PACKING LIST', 'AWB / BL COPY', 'INSURANCE COPY', 'LICENCE / PERMIT'],
  Export: ['COMMERCIAL INVOICE', 'PACKING LIST', 'SHIPPING BILL', 'LEO COPY', 'CERTIFICATE OF ORIGIN', 'AWB / BL COPY', 'GSP / PHYTO CERTIFICATE', 'ARE-1 / LUT', 'VGM', 'CARTING ORDER', 'MATE RECEIPT', 'INSURANCE COPY'],
};
const DUE_TYPES = ['BOE Filing', 'Duty Payment', 'DO Validity', 'Free Days (Detention)', 'Warehouse Free Time', 'SB Filing', 'Cut-off (Cargo)', 'Cut-off (Documents)', 'Invoice', 'Pre-alert', 'Other'];
const STAGES = ['Register', 'Hand Over To Carrier', 'Complete', 'Cancelled'];

// searchable columns; everything else of the form is kept in dataJson
const COLS = ['docketNo', 'division', 'branchCode', 'docketDate', 'clearanceDate', 'customsOnly', 'jobType', 'shipmentType', 'houseType', 'cargoType', 'freightTerm', 'nomination', 'shipmentTerm',
  'mainParty', 'mainPartyId', 'mainAddress', 'otherParty', 'overseasAgent', 'subAgent', 'billingType', 'billingParty', 'billingAddress', 'notifyParty', 'cha', 'mawbNo', 'mawbDate', 'hawbNo', 'hawbDate',
  'carrier', 'flightVessel', 'voyage', 'etd', 'eta', 'igmNo', 'igmDate', 'originPort', 'destinationPort', 'dischargePort', 'clearanceAt', 'pkgs', 'pkgUnit', 'grossWeight', 'chargeableWeight', 'volume',
  'goodsDesc', 'stage', 'currentStatus', 'docketOwner', 'referenceNo', 'remarks', 'marketingPerson', 'quotationNo', 'placeOfSupply', 'costCentre', 'ediJobNo', 'poNo'];
const NUMS = new Set(['pkgs', 'grossWeight', 'chargeableWeight', 'volume', 'customsOnly', 'mainPartyId']);
let ready = null;
const ensure = () => (ready = ready || (async () => {
  await x(`CREATE TABLE IF NOT EXISTS Shipments (id INTEGER PRIMARY KEY AUTOINCREMENT, ${COLS.map(c => c + (NUMS.has(c) ? ' REAL' : ' TEXT') + (c === 'docketNo' ? ' UNIQUE' : '')).join(', ')},
    containersJson TEXT, dimensionsJson TEXT, docsJson TEXT, dataJson TEXT, cancelReason TEXT, completedOn TEXT, createdBy TEXT, modifiedBy TEXT, createdAt DATETIME, updatedAt DATETIME)`);
  const have = new Set((await q('PRAGMA table_info(Shipments)')).map(c => c.name));
  for (const c of COLS) if (!have.has(c)) await x(`ALTER TABLE Shipments ADD COLUMN ${c} ${NUMS.has(c) ? 'REAL' : 'TEXT'}`);
  await x('CREATE INDEX IF NOT EXISTS idx_shipments_div ON Shipments (division, branchCode, docketDate)');
  await x(`CREATE TABLE IF NOT EXISTS ShipmentEvents (id INTEGER PRIMARY KEY AUTOINCREMENT, shipmentId INTEGER, kind TEXT, title TEXT, eventDate TEXT, eventTime TEXT, doneDate TEXT, doneTime TEXT,
    status TEXT, remarks TEXT, dataJson TEXT, createdBy TEXT, modifiedBy TEXT, createdAt DATETIME, updatedAt DATETIME)`);
  await x('CREATE INDEX IF NOT EXISTS idx_shipev ON ShipmentEvents (shipmentId, kind)');
  await x('CREATE INDEX IF NOT EXISTS idx_shipments_edijob ON Shipments (ediJobNo)');
  await x('CREATE TABLE IF NOT EXISTS ShipmentsDeleted (id INTEGER PRIMARY KEY AUTOINCREMENT, shipmentId INTEGER, docketNo TEXT, dataJson TEXT, eventsJson TEXT, reason TEXT, deletedBy TEXT, createdAt DATETIME, updatedAt DATETIME)');
  // 19-Nov-2026: the deleted copy also keeps the provisional sheet and the uploaded files' rows
  const delCols = new Set((await q('PRAGMA table_info(ShipmentsDeleted)')).map(c => c.name));
  for (const c of ['provisionalJson', 'filesJson']) if (!delCols.has(c)) await x(`ALTER TABLE ShipmentsDeleted ADD COLUMN ${c} TEXT`);
  await x('CREATE INDEX IF NOT EXISTS idx_shipments_mawb ON Shipments (mawbNo, hawbNo)');
  await x(`CREATE TABLE IF NOT EXISTS ShipmentFiles (id INTEGER PRIMARY KEY AUTOINCREMENT, shipmentId INTEGER, docType TEXT, fileName TEXT, originalName TEXT, mimeType TEXT, filePath TEXT, size INTEGER,
    remarks TEXT, uploadedBy TEXT, createdAt DATETIME, updatedAt DATETIME)`);
  await x('CREATE INDEX IF NOT EXISTS idx_shipfiles ON ShipmentFiles (shipmentId)');
  await x('CREATE TABLE IF NOT EXISTS ShipmentSeries (id INTEGER PRIMARY KEY AUTOINCREMENT, branchCode TEXT, division TEXT, fy TEXT, nextNo INTEGER, createdAt DATETIME, updatedAt DATETIME, UNIQUE (branchCode, division, fy))');
})().catch(e => { ready = null; throw e; }));

const fyStartYear = (d) => { const y = Number(String(d || today()).slice(0, 4)), m = Number(String(d || today()).slice(5, 7)); return m < 4 ? y - 1 : y; };
const yy = (d) => String(fyStartYear(d)).slice(2);
const fyKey = (d) => { const s = fyStartYear(d); return String(s).slice(2) + String(s + 1).slice(2); };
const docketOf = (br, div, n, d) => `${String(br).toUpperCase()}/${div}/${n}/${yy(d)}`;
async function seriesRow(br, div, d, t) {
  const r = (await q('SELECT * FROM ShipmentSeries WHERE branchCode = ? AND division = ? AND fy = ?', [br, div, fyKey(d)], t))[0];
  if (r) return r;
  const s = new Date().toISOString();
  await x('INSERT OR IGNORE INTO ShipmentSeries (branchCode, division, fy, nextNo, createdAt, updatedAt) VALUES (?,?,?,?,?,?)', [br, div, fyKey(d), 1001, s, s], t);
  return (await q('SELECT * FROM ShipmentSeries WHERE branchCode = ? AND division = ? AND fy = ?', [br, div, fyKey(d)], t))[0];
}
async function nextDocket(br, div, d, t, take) {
  // 05-Nov-2026: iCAFFE docket numbers (NDL/AE/13848/26) from Settings > Number Series (iCAFFE) when the branch has that series
  const ns = require('../utils/numberSeries');
  if (await ns.has('DOCKET', br, div, t)) return take ? ns.take('DOCKET', { branchCode: br, division: div, date: d }, t) : ns.peek('DOCKET', { branchCode: br, division: div, date: d }, t);
  const r = await seriesRow(br, div, d, t); let n = Number(r.nextNo) || 1001;
  for (let i = 0; i < 5000; i++) { const no = docketOf(br, div, n, d); if (!(await q('SELECT id FROM Shipments WHERE docketNo = ?', [no], t)).length) break; n++; }
  if (take) await x('UPDATE ShipmentSeries SET nextNo = ?, updatedAt = ? WHERE id = ?', [n + 1, new Date().toISOString(), r.id], t);
  return docketOf(br, div, n, d);
}
// 19-Nov-2026: the iCAFFE dockets carry iCAFFE's branch code (NDL, MUM ...), the screen sends the Branch Master code (DEL ...).
// A branch also takes its iCAFFE code (Settings > Number Series), and the default branch iCAFFE's head office NDL - as the
// accounts dashboard does. Before, Search with DEL did not show the NDL dockets.
async function branchCodes(br) {
  const c = String(br || '').trim().toUpperCase(); const out = new Set([c]);
  for (const r of await q('SELECT branchCode, icaffeCode, isDefault FROM CompanyBranches').catch(() => [])) {
    if (String(r.branchCode || '').trim().toUpperCase() !== c) continue;
    if (r.icaffeCode) out.add(String(r.icaffeCode).trim().toUpperCase().replace(/^OFF\/?/, ''));
    if (Number(r.isDefault) === 1) out.add('NDL');
  }
  return [...out].filter(Boolean);
}
async function defaultBranch() { const b = (await q("SELECT branchCode FROM CompanyBranches WHERE coalesce(status, 'Active') = 'Active' ORDER BY isDefault DESC, id LIMIT 1").catch(() => []))[0]; return b ? b.branchCode : 'DEL'; }

// ------------------------------------------------------------------ set-up and lookups
router.get('/meta', async (req, res) => {
  try {
    await ensure();
    const branches = await q("SELECT branchCode code, branchName name, isDefault FROM CompanyBranches WHERE coalesce(status, 'Active') = 'Active' ORDER BY isDefault DESC, branchCode").catch(() => []);
    res.json({ divisions: DIVS, statusLevels: STATUS_LEVELS, docList: DOC_LIST, dueTypes: DUE_TYPES, stages: STAGES, branches });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/next-no', async (req, res) => {
  try { await ensure(); const div = String(req.query.division || '').toUpperCase(); if (!DIVS[div]) throw bad('Division?');
    res.json({ no: await nextDocket(String(req.query.branch || await defaultBranch()).toUpperCase(), div, req.query.date || today()), series: await seriesRow(String(req.query.branch || await defaultBranch()).toUpperCase(), div, req.query.date || today()) }); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
// change the next serial of a series (like Sequence Config)
router.put('/series', async (req, res) => {
  try {
    await ensure(); const b = req.body || {}; const div = String(b.division || '').toUpperCase(); if (!DIVS[div]) throw bad('Division?');
    const n = Math.floor(num(b.nextNo)); if (n < 1 || n > 9999999) throw bad('Next number should be 1 or more');
    const r = await seriesRow(String(b.branch || await defaultBranch()).toUpperCase(), div, b.date || today());
    await x('UPDATE ShipmentSeries SET nextNo = ?, updatedAt = ? WHERE id = ?', [n, new Date().toISOString(), r.id]);
    res.json({ ok: true });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
// 05-Nov-2026: every field of the docket reads its master (Master Directory): parties (with the iCAFFE party directory
// as a fallback), party addresses, airports / ports, airlines / lines, vessels, users, cost centres, CHA, warehouses / CFS,
// UQC, countries, states (place of supply), currencies, quotations and the customs jobs.
const addrOf = (b) => [b.address1, b.address2, b.city, b.state, b.pinCode, b.country && !/^(IN|INDIA)$/i.test(b.country) ? b.country : ''].filter(Boolean).join(', ');
// 08-Nov-2026: notify party and buyer also look in the directory's consignees (foreign buyers / suppliers)
const ICAFFE_TYPE = { shipper: ['EXPORTER'], consignee: ['EXPORTER', 'CONSIGNEE'], foreign: ['CONSIGNEE'], overseas: ['OVERSEAS_AGENT'], subagent: ['SUBAGENT'], carrier: ['SHIPLINE'], iata: ['IATA_AGENT'], notify: ['CONSIGNEE', 'EXPORTER'], buyer: ['CONSIGNEE'] };
router.get('/lookup/:what', async (req, res) => {
  try {
    const s = String(req.query.q || '').trim(); const like = '%' + s + '%'; const w = req.params.what; const S = s.toUpperCase();
    let rows = [];
    if (w === 'party') {
      const flag = { shipper: 'isShipper = 1', consignee: '(isConsignee = 1 OR isShipper = 1)', foreign: '(isConsignee = 1 OR isBuyer = 1 OR coalesce(countryCode, \'IN\') <> \'IN\')', overseas: 'isOverseasAgent = 1',
        subagent: 'isSubAgent = 1', notify: '(isNotifyParty = 1 OR isConsignee = 1 OR isShipper = 1)', buyer: '(isBuyer = 1 OR isConsignee = 1)', cha: '1 = 1', carrier: 'isShipline = 1', iata: 'isIataAgent = 1' }[req.query.type] || '1 = 1';
      const ps = await q(`SELECT id, code, name, email, marketingPerson1, countryCode FROM Parties WHERE ${flag} AND coalesce(blackList, 0) = 0 AND name LIKE ? ORDER BY (name LIKE ?) DESC, name LIMIT 20`, [like, s + '%']).catch(() => []);
      const ids = ps.map(p => p.id);
      // 11-Nov-2026: the customer's KAM in the Sales module is the docket's marketing person
      const kamOf = new Map();
      if (ids.length) for (const r of await q(`SELECT c.partyId, upper(trim(c.name)) nm, l.partyId lp, sp.name kam FROM SalesCustomers c JOIN SalesPersons sp ON sp.id = c.kamId LEFT JOIN AccountLedgers l ON l.id = c.ledgerId
          WHERE c.partyId IN (${ids.join(',')}) OR l.partyId IN (${ids.join(',')}) OR upper(trim(c.name)) IN (${ps.map(() => '?').join(',')})`, ps.map(p => String(p.name).trim().toUpperCase())).catch(() => [])) {
        if (r.partyId) kamOf.set(r.partyId, r.kam); if (r.lp) kamOf.set(r.lp, r.kam); kamOf.set(r.nm, r.kam);
      }
      const br = ids.length ? await q(`SELECT id, partyId, branchName, address1, address2, city, state, country, pinCode, gstin, email1 FROM PartyBranches WHERE partyId IN (${ids.join(',')}) AND coalesce(disabled, 0) = 0 ORDER BY isDefault DESC, id`).catch(() => []) : [];
      rows = ps.map(p => { const bs = br.filter(x2 => x2.partyId === p.id); const b = bs[0] || {};
        return { id: p.id, partyCode: p.code || '', name: p.name, address: addrOf(b), gstin: b.gstin || '', state: b.state || '', email: b.email1 || p.email || '', marketingPerson: kamOf.get(p.id) || kamOf.get(String(p.name).trim().toUpperCase()) || p.marketingPerson1 || '', branches: bs.length, src: 'Party Master' }; });
      // not in the party master yet: the iCAFFE party directory (imported, 1.5 lakh names)
      if (rows.length < 20 && s.length >= 2) {
        const types = ICAFFE_TYPE[req.query.type]; const seen = new Set(rows.map(r => r.name.toUpperCase()));
        const ic = await q(`SELECT id, code, name, partyType, email, gstin, addresses, city, countryCode FROM IcaffeParties WHERE importedPartyId IS NULL AND coalesce(isActive, 1) = 1 AND name LIKE ?${types ? ` AND partyType IN (${types.map(() => '?').join(',')})` : ''} ORDER BY (name LIKE ?) DESC, name LIMIT ?`,
          [like, ...(types || []), s + '%', 20 - rows.length]).catch(() => []);
        for (const r of ic) { if (seen.has(String(r.name).toUpperCase())) continue; let a = []; try { a = JSON.parse(r.addresses || '[]'); } catch (e) { a = []; }
          const b = a.find(x2 => x2.isDefault) || a[0] || { city: r.city, country: r.countryCode };
          rows.push({ id: null, icaffeId: r.id, partyCode: r.code || '', name: r.name, address: addrOf(b), gstin: r.gstin || b.gstin || '', state: b.state || '', email: r.email || '', branches: a.length, src: 'iCAFFE directory - ' + String(r.partyType || '').replace('_', ' ').toLowerCase() }); }
      }
    } else if (w === 'branches') {
      // the party's addresses, for the address picker next to each party
      const pid = Number(req.query.partyId) || (req.query.name ? ((await q('SELECT id FROM Parties WHERE upper(name) = upper(?) LIMIT 1', [String(req.query.name).trim()]))[0] || {}).id : null);
      if (pid) rows = (await q('SELECT id, branchName, address1, address2, city, state, country, pinCode, gstin, email1, phone, contactPerson, isDefault FROM PartyBranches WHERE partyId = ? AND coalesce(disabled, 0) = 0 ORDER BY isDefault DESC, id', [pid]).catch(() => []))
        .map(b => ({ id: b.id, name: b.branchName || 'Address', address: addrOf(b), gstin: b.gstin || '', email: b.email1 || '', phone: b.phone || '', contact: b.contactPerson || '', state: b.state || '', isDefault: !!b.isDefault }));
      else if (req.query.icaffeId) { const r = (await q('SELECT addresses FROM IcaffeParties WHERE id = ?', [Number(req.query.icaffeId)]))[0]; let a = []; try { a = JSON.parse((r && r.addresses) || '[]'); } catch (e) { a = []; }
        rows = a.map((b, i) => ({ id: i, name: b.branchName || b.city || 'Address ' + (i + 1), address: addrOf(b), phone: b.phone || '', isDefault: !!b.isDefault })); }
    } else if (w === 'airport') rows = await q(`SELECT code, name, countryCode country FROM Airports WHERE code LIKE ? OR name LIKE ? ORDER BY (code = ?) DESC, name LIMIT 20`, [like, like, S]).catch(() => []);
    else if (w === 'port') rows = [...await q(`SELECT portCode code, portName name, country FROM Ports WHERE coalesce(isActive, 1) = 1 AND (portCode LIKE ? OR portName LIKE ?) ORDER BY (portCode = ?) DESC LIMIT 12`, [like, like, S]).catch(() => []),
      ...await q(`SELECT code, name, countryCode country FROM ForeignPorts WHERE coalesce(isActive, 1) = 1 AND (code LIKE ? OR name LIKE ?) ORDER BY (code = ?) DESC LIMIT 15`, [like, like, S]).catch(() => [])];
    else if (w === 'airline') rows = await q(`SELECT name, code2 code, prefix FROM Airlines WHERE coalesce(status, 'ACTIVE') <> 'INACTIVE' AND (name LIKE ? OR code2 LIKE ? OR prefix LIKE ? OR code3 LIKE ?) ORDER BY (code2 = ? OR prefix = ?) DESC, name LIMIT 20`, [like, like, like, like, S, S]).catch(() => []);
    else if (w === 'line') rows = await q(`SELECT name, code FROM ShippingLines WHERE coalesce(isActive, 1) = 1 AND (name LIKE ? OR code LIKE ?) ORDER BY name LIMIT 20`, [like, like]).catch(() => []);
    else if (w === 'vessel') rows = await q(`SELECT vesselName name, imoNumber code, carrierAgent country FROM Vessels WHERE vesselName LIKE ? OR imoNumber LIKE ? ORDER BY vesselName LIMIT 20`, [like, like]).catch(() => []);
    // 11-Nov-2026: marketing person = a sales person of the Sales module (then the users, as before)
    else if (w === 'salesperson') rows = [...await q(`SELECT name, coalesce(role, '') || CASE WHEN coalesce(branchCodes, '') <> '' THEN ' - ' || branchCodes ELSE '' END country FROM SalesPersons WHERE coalesce(isActive, 1) = 1 AND (name LIKE ? OR coalesce(aliases, '') LIKE ? OR coalesce(code, '') LIKE ?) ORDER BY name LIMIT 20`, [like, like, like]).catch(() => []),
      ...await q(`SELECT coalesce(nullif(fullName, ''), username) name, coalesce(designation, '') country FROM Users WHERE (coalesce(fullName, '') || ' ' || coalesce(username, '')) LIKE ? ORDER BY 1 LIMIT 10`, [like]).catch(() => [])];
    else if (w === 'user') rows = [...await q(`SELECT coalesce(nullif(fullName, ''), username) name, coalesce(designation, '') || CASE WHEN coalesce(branch, '') <> '' THEN ' - ' || branch ELSE '' END country FROM Users WHERE coalesce(fullName, '') || ' ' || coalesce(username, '') LIKE ? ORDER BY 1 LIMIT 20`, [like]).catch(() => []),
      ...await q(`SELECT trim(coalesce(firstName, '') || ' ' || coalesce(lastName, '')) name, coalesce(designation, '') country FROM EmployeeMasters WHERE coalesce(status, 'Active') <> 'Inactive' AND coalesce(firstName, '') || ' ' || coalesce(lastName, '') LIKE ? LIMIT 20`, [like]).catch(() => [])];
    else if (w === 'costcentre') rows = await q(`SELECT name FROM CostCentres WHERE name LIKE ? ORDER BY name LIMIT 20`, [like]).catch(() => []);
    else if (w === 'cha') rows = [...await q(`SELECT chaName name, chaCode code, chaAddress address FROM ChaMasters WHERE chaName LIKE ? OR chaCode LIKE ? ORDER BY isDefault DESC, chaName LIMIT 10`, [like, like]).catch(() => [])];
    else if (w === 'warehouse') rows = await q(`SELECT warehouseCode code, warehouseName name, coalesce(linkedPortCode, '') || CASE WHEN coalesce(address, '') <> '' THEN ' - ' || address ELSE '' END country FROM Warehouses WHERE warehouseCode LIKE ? OR warehouseName LIKE ? OR linkedPortCode LIKE ? ORDER BY (linkedPortCode = ?) DESC, warehouseName LIMIT 20`, [like, like, like, S]).catch(() => []);
    else if (w === 'uqc') rows = await q(`SELECT uqcCode code, description name FROM Uqcs WHERE coalesce(isActive, 1) = 1 AND (uqcCode LIKE ? OR description LIKE ?) ORDER BY (uqcCode = ?) DESC, uqcCode LIMIT 20`, [like, like, S]).catch(() => []);
    else if (w === 'country') rows = await q(`SELECT code, name FROM Countries WHERE code LIKE ? OR name LIKE ? ORDER BY (code = ?) DESC, name LIMIT 20`, [like, like, S]).catch(() => []);
    else if (w === 'state') rows = await q(`SELECT taxCode code, stateName name FROM States WHERE countryId = 1 AND (stateName LIKE ? OR taxCode = ? OR stateCode = ?) ORDER BY stateName LIMIT 40`, [like, s, S]).catch(() => []);
    else if (w === 'currency') rows = (await q(`SELECT currencyCode code, currencyName name, importRate, exportRate FROM Currencies WHERE currencyCode LIKE ? OR currencyName LIKE ? ORDER BY (currencyCode = ?) DESC, standard DESC, currencyCode LIMIT 20`, [like, like, S]).catch(() => []))
      .map(c => ({ ...c, country: 'Import ' + (c.importRate || '-') + ' / Export ' + (c.exportRate || '-') }));
    // 08-Nov-2026: Active customer contracts too (Customer Contract & Quotation Master) - the Provisional Sheet bills at its rates
    else if (w === 'quotation') rows = [...await q(`SELECT contractNo code, coalesce(partyName, '') name, 'Contract, valid to ' || coalesce(validTo, '') country FROM CustomerContracts WHERE status = 'Active' AND (contractNo LIKE ? OR partyName LIKE ?) ORDER BY id DESC LIMIT 20`, [like, like]).catch(() => []),
      ...await q(`SELECT quoteNo code, coalesce(clientName, '') name, coalesce(origin, '') || ' > ' || coalesce(destination, '') || ' ' || coalesce(status, '') country FROM Quotations WHERE quoteNo LIKE ? OR clientName LIKE ? ORDER BY id DESC LIMIT 20`, [like, like]).catch(() => [])];
    else if (w === 'edijob') rows = [...await q(`SELECT jobNo code, coalesce(nameOfImporter, '') name, 'Import' dir FROM ImportJobs WHERE jobNo LIKE ? LIMIT 10`, [like]).catch(() => []),
      ...await q(`SELECT jobNo code, coalesce(shipperName, '') name, 'Export' dir FROM ExportJobs WHERE jobNo LIKE ? LIMIT 10`, [like]).catch(() => [])];
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// iCAFFE directory name picked on the docket: copy it into the party master (with its addresses) so it can be billed
router.post('/party-from-directory', async (req, res) => {
  try {
    const r = (await q('SELECT * FROM IcaffeParties WHERE id = ?', [Number((req.body || {}).icaffeId)]))[0]; if (!r) throw bad('Party not found in the iCAFFE directory');
    if (r.importedPartyId) return res.json({ id: r.importedPartyId, name: r.name, already: true });
    const have = (await q('SELECT id FROM Parties WHERE upper(name) = upper(?) LIMIT 1', [r.name]))[0];
    if (have) { await x('UPDATE IcaffeParties SET importedPartyId = ? WHERE id = ?', [have.id, r.id]); return res.json({ id: have.id, name: r.name, already: true }); }
    const t = r.partyType; const now = new Date().toISOString(); let a = [];
    const code = r.code && !(await q('SELECT id FROM Parties WHERE code = ?', [r.code])).length ? r.code : null; // code is unique
    // 08-Nov-2026: the addresses were never read (the parse sat behind the comment above) - every party came over with one blank address
    try { a = JSON.parse(r.addresses || '[]'); } catch (e) { a = []; }
    await x(`INSERT INTO Parties (partyType, code, name, city, email, taxId, stateProvince, zipPostcode, countryCode, phoneNumber, isShipper, isConsignee, isNotifyParty, isBuyer, isSubAgent, isOverseasAgent, isShipline, isIataAgent, panNumber, blackList, createdAt, updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,0,?,?,?,?,?,0,?,?)`, [t, code, r.name, r.city || '', r.email || '', r.gstin || r.iec || '', r.state || '', r.pinCode || '', r.countryCode || 'IN', r.phone || '',
      t === 'EXPORTER' ? 1 : 0, t === 'CONSIGNEE' ? 1 : 0, t === 'SUBAGENT' ? 1 : 0, t === 'OVERSEAS_AGENT' ? 1 : 0, t === 'SHIPLINE' ? 1 : 0, t === 'IATA_AGENT' ? 1 : 0, r.pan || '', now, now]);
    const pid = (await q('SELECT id FROM Parties WHERE name = ? ORDER BY id DESC LIMIT 1', [r.name]))[0].id;
    let i = 0; for (const b of (a.length ? a : [{ city: r.city, pinCode: r.pinCode, country: r.countryCode, phone: r.phone, isDefault: true }])) { i++;
      await x(`INSERT INTO PartyBranches (partyId, branchName, address1, address2, city, state, country, pinCode, phone, branchSrNo, isDefault, gstin, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [pid, b.branchName || b.city || 'HEAD OFFICE', b.address1 || '', b.address2 || '', b.city || '', b.state || '', b.country || r.countryCode || '', b.pinCode || '', b.phone || b.mobile || '', String(i), b.isDefault || i === 1 ? 1 : 0, b.gstin || (i === 1 ? r.gstin : null) || null, now, now]); }
    await x('UPDATE IcaffeParties SET importedPartyId = ? WHERE id = ?', [pid, r.id]);
    res.json({ id: pid, name: r.name });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ------------------------------------------------------------------ dockets
const clean = (b) => {
  const o = {};
  for (const c of COLS) { if (c === 'docketNo' || c === 'division' || c === 'stage') continue; let v = b[c]; if (v === undefined) continue;
    if (typeof v === 'boolean') v = v ? 1 : 0; if (NUMS.has(c)) v = v === '' || v == null ? null : num(v); else v = v == null ? null : String(v).trim() || null;
    if (v && ['mawbNo', 'hawbNo', 'igmNo', 'originPort', 'destinationPort', 'dischargePort', 'clearanceAt', 'ediJobNo'].includes(c)) v = v.toUpperCase();
    o[c] = v; }
  return o;
};
function validate(div, b) {
  if (!DIVS[div]) throw bad('Division?');
  if (!b.docketDate || !/^\d{4}-\d{2}-\d{2}$/.test(b.docketDate)) throw bad('Docket Date is required');
  if (!b.jobType) throw bad('Job Type is required');
  if (!String(b.mainParty || '').trim()) throw bad((DIVS[div].side === 'Import' ? 'Importer' : 'Shipper') + ' is required');
  if (!b.customsOnly) {
    if (!String(b.mawbNo || '').trim()) throw bad((DIVS[div].mode === 'Air' ? 'MAWB No' : 'MBL No') + ' is required');
    if (!String(b.originPort || '').trim() || !String(b.destinationPort || '').trim()) throw bad('Origin and Destination port are required');
  }
  if (DIVS[div].mode === 'Air' && b.mawbNo && !/^\d{3}-?\d{8}$/.test(String(b.mawbNo).replace(/\s/g, '')) && !b.allowOddMawb) throw bad('MAWB No should be 11 digits (3-digit airline prefix + 8), e.g. 176-12345675');
  if (num(b.chargeableWeight) && num(b.grossWeight) && num(b.chargeableWeight) < num(b.grossWeight) && DIVS[div].mode === 'Air') throw bad('Chargeable weight cannot be less than gross weight');
}
const rowOut = (r) => r && ({ ...r, data: r.dataJson ? JSON.parse(r.dataJson) : {}, containers: r.containersJson ? JSON.parse(r.containersJson) : [], dimensions: r.dimensionsJson ? JSON.parse(r.dimensionsJson) : [],
  docs: r.docsJson ? JSON.parse(r.docsJson) : {}, dataJson: undefined, containersJson: undefined, dimensionsJson: undefined, docsJson: undefined });

router.get('/', async (req, res) => {
  try {
    await ensure();
    const one = (v) => (Array.isArray(v) ? v[v.length - 1] : v); const f = Object.fromEntries(Object.entries(req.query).map(([k, v]) => [k, one(v)]));
    const w = ['1 = 1']; const p = [];
    if (f.division) { w.push('division = ?'); p.push(String(f.division).toUpperCase()); }
    if (f.branch) { const bc = await branchCodes(f.branch); w.push(`(upper(trim(coalesce(branchCode, ''))) IN (${bc.map(() => '?').join(',')}) OR coalesce(branchCode, '') = '')`); p.push(...bc); }
    if (f.from) { w.push('docketDate >= ?'); p.push(f.from); }
    if (f.to) { w.push('docketDate <= ?'); p.push(f.to); }
    if (f.stage) { w.push("coalesce(stage, 'Register') = ?"); p.push(f.stage); }
    const like = { docketNo: 'docketNo', ediJobNo: 'ediJobNo', mainParty: 'mainParty', otherParty: 'otherParty', subAgent: 'subAgent', overseasAgent: 'overseasAgent', originPort: 'originPort',
      destinationPort: 'destinationPort', referenceNo: 'referenceNo', mawbNo: 'mawbNo', hawbNo: 'hawbNo', docketOwner: 'docketOwner', createdBy: 'createdBy', poNo: 'poNo', any: null };
    // 19-Nov-2026: MAWB / HAWB with or without the dash or spaces (iCAFFE keeps 17612345675, the screen 176-12345675)
    for (const [k, col] of Object.entries(like)) if (f[k]) { if (col === 'mawbNo' || col === 'hawbNo') { w.push(`replace(replace(coalesce(${col}, ''), '-', ''), ' ', '') LIKE ?`); p.push('%' + String(f[k]).replace(/[-\s]/g, '') + '%'); } else if (col) { w.push(`${col} LIKE ?`); p.push('%' + f[k] + '%'); } else { w.push('(docketNo LIKE ? OR mainParty LIKE ? OR mawbNo LIKE ? OR hawbNo LIKE ? OR remarks LIKE ?)'); p.push(...Array(5).fill('%' + f[k] + '%')); } }
    const rows = await q(`SELECT * FROM Shipments WHERE ${w.join(' AND ')} ORDER BY docketDate DESC, id DESC LIMIT 501`, p);
    if (rows.length > 500) res.set('X-More', '1');
    // 08-Nov-2026: the Bill of Entry / Shipping Bill no. and date (kept in data) go to the search grid too
    const out = rows.slice(0, 500).map(r => { const o = rowOut(r); const d = o.data || {}; return { ...o, beNo: d.beNo || '', beDate: d.beDate || '', sbNo: d.sbNo || '', sbDate: d.sbDate || '', data: undefined, docs: undefined }; });
    await fillBeSb(out);
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// 19-Nov-2026: only the iCAFFE dockets carry the BE / SB no; for the others it comes from the EDI job (BE / SB no and date),
// else from the last BOE / SB of Receiving Documents
async function fillBeSb(out) {
  const need = out.filter(o => !o.beNo && !o.sbNo); if (!need.length) return;
  const side = (o) => (/I$/.test(o.division) ? 'I' : 'E'); const key = (v) => String(v || '').trim().toUpperCase();
  const jobs = new Map();
  for (const [sd, sql] of [['I', "SELECT upper(trim(jobNo)) j, coalesce(nullif(trim(beNo), ''), beNumber) no, beDate d FROM ImportJobs WHERE upper(trim(jobNo)) IN "],
    ['E', "SELECT upper(trim(jobNo)) j, coalesce(nullif(trim(sbNo), ''), sbNumber) no, sbDate d FROM ExportJobs WHERE upper(trim(jobNo)) IN "]]) {
    const nos = [...new Set(need.filter(o => side(o) === sd && o.ediJobNo).map(o => key(o.ediJobNo)))];
    if (nos.length) for (const r of await q(sql + '(' + nos.map(() => '?').join(',') + ')', nos).catch(() => [])) if (r.no) jobs.set(sd + r.j, r);
  }
  const recv = new Map();
  for (const e of await q(`SELECT shipmentId, title, dataJson FROM ShipmentEvents WHERE kind = 'recv_boe' AND shipmentId IN (${need.map(() => '?').join(',')}) ORDER BY id`, need.map(o => o.id)).catch(() => [])) recv.set(e.shipmentId, e);
  for (const o of need) {
    const j = o.ediJobNo && jobs.get(side(o) + key(o.ediJobNo)); const e = recv.get(o.id); let no = '', d = '';
    if (j) { no = String(j.no); d = j.d; } else if (e) { no = e.title || ''; try { d = JSON.parse(e.dataJson || '{}').docDate || ''; } catch (x2) { d = ''; } }
    if (!no) continue; const dt = ymd(d) || String(d || '');
    if (side(o) === 'I') { o.beNo = no; o.beDate = dt; } else { o.sbNo = no; o.sbDate = dt; }
  }
}
router.get('/by-no', async (req, res) => { try { await ensure(); res.json(rowOut((await q('SELECT * FROM Shipments WHERE upper(docketNo) = upper(?)', [String(req.query.no || '').trim()]))[0]) || null); } catch (e) { res.status(500).json({ error: e.message }); } });
router.get('/:id', async (req, res) => {
  try {
    await ensure(); const r = rowOut((await q('SELECT * FROM Shipments WHERE id = ?', [req.params.id]))[0]); if (!r) return res.status(404).json({ error: 'Docket not found' });
    const inv = await q("SELECT invoiceNo, kind, total, status FROM AccSalesInvoices WHERE (upper(jobNo) = upper(?) OR dockets LIKE ?) AND coalesce(status, '') <> 'Void'", [r.docketNo, '%"' + r.docketNo + '"%']).catch(() => []);
    res.json({ ...r, invoices: inv });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// tie the docket to the party master: the main party's id, and the names typed that are not in the master (shown as a warning)
async function linkMasters(b) {
  const out = [];
  if (b.mainParty && !Number(b.mainPartyId)) { const p = (await q('SELECT id FROM Parties WHERE upper(name) = upper(?) LIMIT 1', [String(b.mainParty).trim()]).catch(() => []))[0]; if (p) b.mainPartyId = p.id; }
  for (const [k, l] of [['mainParty', 'main party'], ['otherParty', 'other party'], ['billingParty', 'billing party'], ['overseasAgent', 'overseas agent'], ['subAgent', 'sub agent']]) {
    const v = String(b[k] || '').trim(); if (!v) continue;
    if (!(await q('SELECT 1 FROM Parties WHERE upper(name) = upper(?) LIMIT 1', [v]).catch(() => [1])).length) out.push(l + ' "' + v + '"'); }
  // 08-Nov-2026: an iCAFFE consignee kept search-only in the Party Master joins the full party list once used in a shipment
  try {
    const names = ['mainParty', 'otherParty', 'billingParty', 'overseasAgent', 'subAgent', 'consignee', 'shipper', 'notifyParty', 'buyer'].map(k => String(b[k] || '').trim().toUpperCase()).filter(Boolean);
    const ids = names.length ? (await q(`SELECT id FROM Parties WHERE searchOnly = 1 AND upper(name) IN (${names.map(() => '?').join(',')})`, names)).map(r => r.id) : [];
    if (ids.length) { await x(`UPDATE Parties SET searchOnly = 0 WHERE id IN (${ids.map(() => '?').join(',')})`, ids); require('./masters').clearPartyCache(); }
  } catch (e) { /* column not there before the bulk load */ }
  return out;
}
router.post('/', async (req, res) => {
  let t;
  try {
    await ensure(); const b = req.body || {}; const div = String(b.division || '').toUpperCase(); validate(div, b);
    const br = String(b.branchCode || await defaultBranch()).toUpperCase(); const notInMaster = await linkMasters(b);
    t = await sequelize.transaction();
    const docketNo = await nextDocket(br, div, b.docketDate, t, true);
    const s = new Date().toISOString(); const row = { ...clean(b), branchCode: br, docketNo, division: div, stage: 'Register', currentStatus: null,
      containersJson: JSON.stringify(b.containers || []), dimensionsJson: JSON.stringify(b.dimensions || []), docsJson: JSON.stringify(b.docs || {}), dataJson: JSON.stringify(b.data || {}), createdBy: userOf(req) || null, createdAt: s, updatedAt: s };
    const keys = Object.keys(row);
    await x(`INSERT INTO Shipments (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(',')})`, keys.map(k => row[k]), t);
    const id = (await q('SELECT id FROM Shipments WHERE docketNo = ?', [docketNo], t))[0].id;
    await x('INSERT INTO ShipmentEvents (shipmentId, kind, title, eventDate, status, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)', [id, 'activity', 'Docket registered', b.docketDate, 'Done', userOf(req) || null, s, s], t);
    await t.commit(); res.json({ id, docketNo, notInMaster });
  } catch (e) { if (t) await t.rollback().catch(() => {}); res.status(e.status || 500).json({ error: e.message }); }
});
router.put('/:id', async (req, res) => {
  try {
    await ensure(); const old = (await q('SELECT * FROM Shipments WHERE id = ?', [req.params.id]))[0]; if (!old) return res.status(404).json({ error: 'Docket not found' });
    if (old.stage === 'Cancelled') throw bad('A cancelled docket cannot be modified');
    const b = req.body || {}; validate(old.division, b); const notInMaster = await linkMasters(b);
    const row = { ...clean(b), containersJson: JSON.stringify(b.containers || []), dimensionsJson: JSON.stringify(b.dimensions || []), docsJson: JSON.stringify(b.docs || {}), dataJson: JSON.stringify(b.data || {}), modifiedBy: userOf(req) || null, updatedAt: new Date().toISOString() };
    delete row.branchCode;
    const keys = Object.keys(row);
    await x(`UPDATE Shipments SET ${keys.map(k => k + ' = ?').join(', ')} WHERE id = ?`, [...keys.map(k => row[k]), old.id]);
    res.json({ id: old.id, docketNo: old.docketNo, notInMaster });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
// Delete: only a docket with no GST invoice and no voucher (cost / bill).
// The docket, its status / activity / papers, its provisional sheet and its uploaded files' rows are copied to ShipmentsDeleted first
// (19-Nov-2026: the sheet was deleted with no copy). The uploaded files stay in uploads/shipments.
router.delete('/:id', async (req, res) => {
  let t;
  try {
    await ensure(); const r = (await q('SELECT * FROM Shipments WHERE id = ?', [req.params.id]))[0]; if (!r) return res.status(404).json({ error: 'Docket not found' });
    const inv = await q("SELECT invoiceNo FROM AccSalesInvoices WHERE (upper(jobNo) = upper(?) OR dockets LIKE ? OR linesJson LIKE ?) AND coalesce(status, '') <> 'Void'", [r.docketNo, '%"' + r.docketNo + '"%', '%"jobNo":"' + r.docketNo + '"%']).catch(() => []);
    if (inv.length) throw bad('GST invoice(s) made on this docket: ' + inv.map(i => i.invoiceNo).join(', ') + ' - void / delete them first, or Cancel the docket instead');
    const vch = await q("SELECT voucherNumber FROM Vouchers WHERE upper(trim(jobNo)) = upper(?) AND coalesce(status, '') <> 'Rejected' LIMIT 5", [r.docketNo]).catch(() => []);
    if (vch.length) throw bad('Vouchers are booked on this docket: ' + vch.map(v => v.voucherNumber).join(', ') + ' - use Cancel (Complete/Cancel tab) instead');
    const ps = (await q('SELECT * FROM AccProvisionalSheets WHERE upper(jobNo) = upper(?)', [r.docketNo]).catch(() => []))[0];
    const files = await q('SELECT * FROM ShipmentFiles WHERE shipmentId = ?', [r.id]).catch(() => []);
    t = await sequelize.transaction(); const s = new Date().toISOString();
    const ev = await q('SELECT * FROM ShipmentEvents WHERE shipmentId = ?', [r.id], t);
    await x('INSERT INTO ShipmentsDeleted (shipmentId, docketNo, dataJson, eventsJson, provisionalJson, filesJson, reason, deletedBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [r.id, r.docketNo, JSON.stringify(r), JSON.stringify(ev), ps ? JSON.stringify(ps) : null, files.length ? JSON.stringify(files) : null, String((req.body || {}).reason || '') || null, userOf(req) || null, s, s], t);
    await x('DELETE FROM ShipmentEvents WHERE shipmentId = ?', [r.id], t);
    if (ps) await x('DELETE FROM AccProvisionalSheets WHERE id = ?', [ps.id], t);
    await x('DELETE FROM Shipments WHERE id = ?', [r.id], t);
    // the last docket of a series gives its number back
    const ser = (await q('SELECT * FROM ShipmentSeries WHERE branchCode = ? AND division = ? AND fy = ?', [r.branchCode, r.division, fyKey(r.docketDate)], t))[0];
    const m = String(r.docketNo).split('/'); const nUsed = Number(m[2]);
    if (ser && nUsed && Number(ser.nextNo) === nUsed + 1) await x('UPDATE ShipmentSeries SET nextNo = ?, updatedAt = ? WHERE id = ?', [nUsed, s, ser.id], t);
    await t.commit(); res.json({ ok: true, docketNo: r.docketNo, sheet: !!ps, files: files.length });
  } catch (e) { if (t) await t.rollback().catch(() => {}); res.status(e.status || 500).json({ error: e.message }); }
});
// Duplicate (iCAFFE): same parties / ports / goods, new number, today's date, no MAWB / HAWB
// 19-Nov-2026: also blank - flight / vessel and its dates, DO / LR / GRN, IGM rotation, containers, BE / SB, values and the
// Document List ticks (the papers of the new shipment are not received yet); the iCAFFE source record is not copied
const ONE_SHIPMENT = ['doNo', 'doDate', 'doCollected', 'lrNo', 'lrDate', 'grnNo', 'inwardDate', 'atd', 'ata', 'sobDate', 'rotationNo', 'cutOff', 'beNo', 'beDate', 'beType', 'sbNo', 'sbDate',
  'ediJobDate', 'assValue', 'totalDuty', 'value', 'icaffeShipmentId', 'icaffe'];
router.post('/:id/duplicate', async (req, res) => {
  try {
    await ensure(); const r = rowOut((await q('SELECT * FROM Shipments WHERE id = ?', [req.params.id]))[0]); if (!r) return res.status(404).json({ error: 'Docket not found' });
    const data = { ...(r.data || {}) }; for (const k of ONE_SHIPMENT) delete data[k];
    res.json({ ...r, id: null, docketNo: '', docketDate: today(), mawbNo: '', mawbDate: '', hawbNo: '', hawbDate: '', stage: 'Register', currentStatus: '', ediJobNo: '', igmNo: '', igmDate: '', clearanceDate: '',
      flightVessel: '', voyage: '', etd: '', eta: '', containers: [], docs: {}, data, cancelReason: null, completedOn: null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Complete / Cancel (also many at once from the tab)
router.post('/stage', async (req, res) => {
  try {
    await ensure(); const b = req.body || {}; const ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter(Boolean); if (!ids.length) throw bad('Tick the dockets');
    if (!STAGES.includes(b.stage)) throw bad('Operation Type?'); if (b.stage === 'Cancelled' && !String(b.reason || '').trim()) throw bad('Give the reason for cancelling');
    const s = new Date().toISOString(); const by = userOf(req) || null; const done = []; const skipped = [];
    for (const r of await q(`SELECT id, docketNo, docketDate FROM Shipments WHERE id IN (${ids.join(',')})`)) {
      if (b.stage === 'Cancelled') {
        const inv = await q("SELECT invoiceNo FROM AccSalesInvoices WHERE (upper(jobNo) = upper(?) OR dockets LIKE ?) AND coalesce(status, '') <> 'Void'", [r.docketNo, '%"' + r.docketNo + '"%']).catch(() => []);
        const vch = await q("SELECT voucherNumber FROM Vouchers WHERE upper(jobNo) = upper(?) AND coalesce(status, '') <> 'Rejected' LIMIT 3", [r.docketNo]).catch(() => []);
        if (inv.length || vch.length) { skipped.push(r.docketNo + ' (billed / costed: ' + [...inv.map(i => i.invoiceNo), ...vch.map(v => v.voucherNumber)].join(', ') + ')'); continue; }
      }
      await x('UPDATE Shipments SET stage = ?, cancelReason = ?, completedOn = ?, modifiedBy = ?, updatedAt = ? WHERE id = ?', [b.stage, b.stage === 'Cancelled' ? b.reason : null, b.stage === 'Complete' ? (b.date || today()) : null, by, s, r.id]);
      await x('INSERT INTO ShipmentEvents (shipmentId, kind, title, eventDate, status, remarks, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)', [r.id, 'activity', 'Stage: ' + b.stage, b.date || today(), 'Done', b.reason || null, by, s, s]);
      done.push(r.docketNo);
    }
    res.json({ done, skipped });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ------------------------------------------------------------------ events: status, activities, received papers, due dates
const EV_KINDS = ['status', 'activity', 'recv_invoice', 'recv_boe', 'recv_doc', 'duedate', 'mail'];
router.get('/:id/events', async (req, res) => {
  try { await ensure(); const rows = await q('SELECT * FROM ShipmentEvents WHERE shipmentId = ? ORDER BY coalesce(eventDate, createdAt), id', [req.params.id]); res.json(rows.map(r => ({ ...r, data: r.dataJson ? JSON.parse(r.dataJson) : {}, dataJson: undefined }))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/:id/events', async (req, res) => {
  try {
    await ensure(); const b = req.body || {}; if (!EV_KINDS.includes(b.kind)) throw bad('Kind?'); if (!String(b.title || '').trim()) throw bad('Name / title is required');
    const sh = (await q('SELECT id, docketNo FROM Shipments WHERE id = ?', [req.params.id]))[0]; if (!sh) return res.status(404).json({ error: 'Docket not found' });
    if ((b.kind === 'status' || b.kind === 'duedate') && !b.eventDate) throw bad('Date is required');
    const s = new Date().toISOString(); const by = userOf(req) || null;
    const vals = [b.title, b.eventDate || null, b.eventTime || null, b.doneDate || null, b.doneTime || null, b.status || null, b.remarks || null, JSON.stringify(b.data || {})];
    if (b.id) await x('UPDATE ShipmentEvents SET title = ?, eventDate = ?, eventTime = ?, doneDate = ?, doneTime = ?, status = ?, remarks = ?, dataJson = ?, modifiedBy = ?, updatedAt = ? WHERE id = ? AND shipmentId = ?', [...vals, by, s, b.id, sh.id]);
    else await x('INSERT INTO ShipmentEvents (shipmentId, kind, title, eventDate, eventTime, doneDate, doneTime, status, remarks, dataJson, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [sh.id, b.kind, ...vals, by, s, s]);
    if (b.kind === 'status') { // the latest milestone is the docket's current status
      const last = (await q("SELECT title, eventDate FROM ShipmentEvents WHERE shipmentId = ? AND kind = 'status' ORDER BY eventDate DESC, coalesce(eventTime, '') DESC, id DESC LIMIT 1", [sh.id]))[0];
      await x('UPDATE Shipments SET currentStatus = ?, updatedAt = ? WHERE id = ?', [last ? last.title : null, s, sh.id]);
      if (/handed over|sailed|departed/i.test(b.title)) await x("UPDATE Shipments SET stage = 'Hand Over To Carrier' WHERE id = ? AND coalesce(stage, 'Register') = 'Register'", [sh.id]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
router.delete('/:id/events/:eid', async (req, res) => {
  try {
    await ensure(); await x('DELETE FROM ShipmentEvents WHERE id = ? AND shipmentId = ?', [req.params.eid, req.params.id]);
    const last = (await q("SELECT title FROM ShipmentEvents WHERE shipmentId = ? AND kind = 'status' ORDER BY eventDate DESC, id DESC LIMIT 1", [req.params.id]))[0];
    await x('UPDATE Shipments SET currentStatus = ? WHERE id = ?', [last ? last.title : null, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Document List: received / pending tick per document
router.put('/:id/doclist', async (req, res) => {
  try {
    await ensure(); const sh = (await q('SELECT id FROM Shipments WHERE id = ?', [req.params.id]))[0]; if (!sh) return res.status(404).json({ error: 'Docket not found' });
    const docs = (req.body || {}).docs || {}; await x('UPDATE Shipments SET docsJson = ?, modifiedBy = ?, updatedAt = ? WHERE id = ?', [JSON.stringify(docs), userOf(req) || null, new Date().toISOString(), sh.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// due dates across dockets (the Due Dates tab lists what is coming up)
router.get('/due', async (req, res) => {
  try {
    await ensure(); const p = [req.query.to || '2999-12-31']; let w = "e.kind = 'duedate' AND coalesce(e.status, '') <> 'Done' AND e.eventDate <= ?";
    if (req.query.division) { w += ' AND s.division = ?'; p.push(String(req.query.division).toUpperCase()); }
    if (req.query.branch) { const bc = await branchCodes(req.query.branch); w += ` AND (upper(trim(coalesce(s.branchCode, ''))) IN (${bc.map(() => '?').join(',')}) OR coalesce(s.branchCode, '') = '')`; p.push(...bc); }
    res.json(await q(`SELECT e.*, s.docketNo, s.mainParty FROM ShipmentEvents e JOIN Shipments s ON s.id = e.shipmentId WHERE ${w} ORDER BY e.eventDate LIMIT 300`, p));
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ================================================================== docket straight from a customs (EDI) job - as on iCAFFE
// Button "Generate Docket No" on the Import BE / Export SB job: makes the docket of the right division from the job's
// data (parties, MAWB / HAWB, packages, weight, ports, IGM) and links it (EDI Job No). One docket per job.
const ymd = (v) => { const s = String(v || '').trim(); if (/^\d{8}$/.test(s)) return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8); if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
const nz = (...v) => { for (const x2 of v) if (x2 != null && String(x2).trim() !== '') return String(x2).trim(); return ''; };
const portTxt = (code, name) => [nz(code), nz(name)].filter(Boolean).join(' - ');
async function customsJob(side, b) {
  const tbl = side === 'Export' ? 'ExportJobs' : 'ImportJobs';
  const r = b.jobId ? (await q(`SELECT * FROM ${tbl} WHERE id = ?`, [b.jobId]))[0] : (await q(`SELECT * FROM ${tbl} WHERE upper(trim(jobNo)) = upper(?)`, [String(b.jobNo || '').trim()]))[0];
  return r || null;
}
function fromCustoms(side, j) {
  const modeTxt = String(nz(j.shipmentMode, j.modeOfTransport, j.trans)).toUpperCase();
  const air = /^A|AIR|COURIER/.test(modeTxt); const land = /^L|LAND|ROAD|RAIL/.test(modeTxt);
  if (land) throw bad('This is a land (ICD / road) job - Shipment Registration has Air and Sea dockets only');
  if (side === 'Import') {
    return { division: air ? 'AI' : 'SI', branchCode: nz(j.branchCode), mainParty: nz(j.nameOfImporter, j.autoField_4), mainAddress: [j.address1, j.address2, j.city, j.state, j.pin].filter(Boolean).join(', '),
      otherParty: nz(j.supplierName), mawbNo: nz(j.mawbNo, j.mawbblNo), mawbDate: ymd(j.mawbDate), hawbNo: nz(j.hawbNo, j.hawbhblNo), hawbDate: ymd(j.hawbDate), igmNo: nz(j.igmNumber, j.igmNo, j.gatewayIgmNo),
      igmDate: ymd(nz(j.igmDate, j.gatewayIgmDate)), originPort: portTxt(nz(j.portOfOrigin, j.portOfShipment), j.portOfOriginName), destinationPort: nz(j.portCode, j.customHouseCode, j.customsPort),
      clearanceAt: portTxt(nz(j.portCode, j.customHouseCode), j.locationName), carrier: nz(j.lineName), flightVessel: nz(j.flightVoyage, j.vessel), pkgs: num(nz(j.totalNoOfPackages, j.totalPkg)) || null,
      pkgUnit: nz(j.packageCode, j.pkg) || 'PKG', grossWeight: num(nz(j.grossWeight, j.grossWt)) || null, chargeableWeight: num(j.chargableWeight) || null, goodsDesc: nz(j.headDesc), cha: nz(j.chaName), subAgent: nz(j.subagentName),
      data: { inwardDate: ymd(j.inwardDate), marks: [j.marksAndNumbers1, j.marksAndNumbers2, j.marksAndNumbers3].filter(Boolean).join(' '), grossUnit: nz(j.grossWtUnit, j.unitOfMeasurement) || 'KGS' } };
  }
  return { division: air ? 'AE' : 'SE', branchCode: nz(j.branchCode), mainParty: nz(j.shipperName), mainAddress: [j.shipperAddress1, j.shipperAddress2, j.shipperCity, j.shipperState, j.shipperPin].filter(Boolean).join(', '),
    otherParty: nz(j.consigneeName), mawbNo: nz(j.mawbNo), mawbDate: ymd(j.mawbDate), hawbNo: nz(j.hawbNo), hawbDate: ymd(j.hawbDate), originPort: portTxt(j.loadingPortCode, j.loadingPortName),
    destinationPort: portTxt(j.destPortCode, j.destPortName), dischargePort: portTxt(j.discPortCode, j.discPortName), clearanceAt: portTxt(j.customsPortCode, j.customsPortName), carrier: nz(j.carrierName),
    pkgs: num(j.totalPackages) || null, pkgUnit: nz(j.pkgsUnit) || 'PKG', grossWeight: num(j.grossWeight) || null, goodsDesc: nz(j.headDesc), cha: nz(j.chaName), subAgent: nz(j.subAgentName), data: { grossUnit: 'KGS' } };
}
// customs milestones -> Shipment Status of the docket
async function syncStatus(sid, side, j, by, t) {
  const map = side === 'Import' ? [['BE filed', j.beDate, j.beNo || j.beNumber], ['Assessment', j.assessmentDate], ['Duty paid', j.dutyPaidDate, j.challanNo], ['Out of charge', j.oocDate]]
    : [['SB filed', j.sbDate, j.sbNo || j.sbNumber], ['Let export order', j.leoDate]];
  const s = new Date().toISOString(); let n = 0;
  for (const [title, d, ref] of map) {
    const dt = ymd(d); if (!dt) continue;
    const have = (await q("SELECT id FROM ShipmentEvents WHERE shipmentId = ? AND kind = 'status' AND title = ?", [sid, title], t))[0];
    if (have) await x('UPDATE ShipmentEvents SET eventDate = ?, remarks = ?, updatedAt = ? WHERE id = ?', [dt, ref ? 'From customs job: ' + ref : 'From customs job', s, have.id], t);
    else await x("INSERT INTO ShipmentEvents (shipmentId, kind, title, eventDate, remarks, createdBy, createdAt, updatedAt) VALUES (?, 'status', ?, ?, ?, ?, ?, ?)", [sid, title, dt, ref ? 'From customs job: ' + ref : 'From customs job', by, s, s], t);
    n++;
  }
  const last = (await q("SELECT title FROM ShipmentEvents WHERE shipmentId = ? AND kind = 'status' ORDER BY eventDate DESC, id DESC LIMIT 1", [sid], t))[0];
  if (last) await x('UPDATE Shipments SET currentStatus = ? WHERE id = ?', [last.title, sid], t);
  return n;
}
// ------------------------------------------------------------------ Upload Docs (iCAFFE "Upload Docs" on the docket)
// files land in uploads/shipments (behind the same login as the other upload folders), a row each in ShipmentFiles
const shMulter = require('multer'); const shPath = require('path'); const shFs = require('fs');
const shUpload = shMulter({
  storage: shMulter.diskStorage({
    destination: (req, file, cb) => { const dir = shPath.join(__dirname, '../uploads/shipments'); if (!shFs.existsSync(dir)) shFs.mkdirSync(dir, { recursive: true }); cb(null, dir); },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + shPath.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => cb(null, /^(application\/pdf|image\/(png|jpe?g|webp|gif|tiff)|application\/vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)|application\/msword|application\/vnd\.ms-excel|text\/csv|text\/plain|message\/rfc822|application\/vnd\.ms-outlook)$/i.test(file.mimetype)),
});
router.get('/:id/files', async (req, res) => {
  try { await ensure(); res.json(await q('SELECT * FROM ShipmentFiles WHERE shipmentId = ? ORDER BY id DESC', [req.params.id])); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/:id/files', shUpload.array('files', 10), async (req, res) => {
  try {
    await ensure(); const sh = (await q('SELECT id FROM Shipments WHERE id = ?', [req.params.id]))[0]; if (!sh) return res.status(404).json({ error: 'Docket not found' });
    const files = req.files || []; if (!files.length) throw bad('No file came through. PDF, image, Word, Excel, CSV, text or mail, up to 15 MB each.');
    const s = new Date().toISOString();
    for (const f of files) await x('INSERT INTO ShipmentFiles (shipmentId, docType, fileName, originalName, mimeType, filePath, size, remarks, uploadedBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [sh.id, String((req.body || {}).docType || 'OTHER').toUpperCase().slice(0, 60), f.filename, f.originalname, f.mimetype, '/uploads/shipments/' + f.filename, f.size, String((req.body || {}).remarks || '') || null, userOf(req) || null, s, s]);
    res.json({ ok: true, count: files.length });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
router.delete('/:id/files/:fid', async (req, res) => {
  try {
    await ensure(); const f = (await q('SELECT * FROM ShipmentFiles WHERE id = ? AND shipmentId = ?', [Number(req.params.fid), req.params.id]))[0]; if (!f) return res.status(404).json({ error: 'File not found' });
    // the file is moved to uploads/shipments/_removed, not erased
    try { const dir = shPath.join(__dirname, '../uploads/shipments/_removed'); if (!shFs.existsSync(dir)) shFs.mkdirSync(dir, { recursive: true });
      shFs.renameSync(shPath.join(__dirname, '../uploads/shipments', f.fileName), shPath.join(dir, f.fileName)); } catch (e) { /* already gone */ }
    await x('DELETE FROM ShipmentFiles WHERE id = ?', [f.id]); res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ------------------------------------------------------------------ Send Mail (Shipment Status tab)
// the status mail to the customer: to = the party's e-mail from the party master; the docket's milestones in a table
const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function mailDraft(sh) {
  const D = DIVS[sh.division] || {}; const air = D.mode === 'Air'; const d = sh.dataJson ? JSON.parse(sh.dataJson) : {};
  const ev = await q("SELECT title, eventDate, eventTime, remarks FROM ShipmentEvents WHERE shipmentId = ? AND kind = 'status' ORDER BY eventDate, coalesce(eventTime, ''), id", [sh.id]);
  const mails = [];
  for (const nm of [sh.billingParty, sh.mainParty]) { if (!nm) continue;
    const p = (await q('SELECT id, email FROM Parties WHERE upper(name) = upper(?) LIMIT 1', [nm]).catch(() => []))[0]; if (!p) continue;
    const b = await q("SELECT email1, email2 FROM PartyBranches WHERE partyId = ? ORDER BY isDefault DESC, id LIMIT 3", [p.id]).catch(() => []);
    for (const e of [p.email, ...b.flatMap(r => [r.email1, r.email2])]) String(e || '').split(/[;,\s]+/).filter(m => /@/.test(m)).forEach(m => mails.includes(m.toLowerCase()) || mails.push(m.toLowerCase())); }
  const fd = (v) => (v ? String(v).slice(8, 10) + '-' + String(v).slice(5, 7) + '-' + String(v).slice(0, 4) : '');
  const facts = [['Docket No', sh.docketNo], [D.side === 'Import' ? 'Importer' : 'Shipper', sh.mainParty], [D.side === 'Import' ? 'Supplier' : 'Consignee', sh.otherParty],
    [(air ? 'MAWB' : 'MBL') + ' No', [sh.mawbNo, fd(sh.mawbDate)].filter(Boolean).join(' dt ')], [(air ? 'HAWB' : 'HBL') + ' No', [sh.hawbNo, fd(sh.hawbDate)].filter(Boolean).join(' dt ')],
    [air ? 'Airline / Flight' : 'Line / Vessel', [sh.carrier, sh.flightVessel, sh.voyage].filter(Boolean).join(' / ')], ['Origin > Destination', [sh.originPort, sh.destinationPort].filter(Boolean).join('  >  ')],
    ['Pkgs / Gross Wt', [sh.pkgs ? sh.pkgs + ' ' + (sh.pkgUnit || '') : '', sh.grossWeight ? sh.grossWeight + ' ' + (d.grossUnit || 'KGS') : ''].filter(Boolean).join(' / ')],
    ['ETD / ETA', [fd(sh.etd), fd(sh.eta)].filter(Boolean).join(' / ')], [D.side === 'Import' ? 'IGM' : 'EGM', [sh.igmNo, fd(sh.igmDate)].filter(Boolean).join(' dt ')], ['Reference / PO', [sh.referenceNo, sh.poNo].filter(Boolean).join(' / ')]].filter(f => f[1]);
  const td = 'style="border:1px solid #cbd5e1;padding:4px 8px;font-size:12px"';
  const html = `<p>Dear Sir / Madam,</p><p>Please find below the status of your ${esc(D.label || '')} shipment.</p>
<table style="border-collapse:collapse;margin:8px 0">${facts.map(f => `<tr><td ${td}><b>${esc(f[0])}</b></td><td ${td}>${esc(f[1])}</td></tr>`).join('')}</table>
<table style="border-collapse:collapse;margin:8px 0"><tr><th ${td}>Status</th><th ${td}>Date</th><th ${td}>Time</th><th ${td}>Remarks</th></tr>
${ev.length ? ev.map(e => `<tr><td ${td}>${esc(e.title)}</td><td ${td}>${fd(e.eventDate)}</td><td ${td}>${esc(e.eventTime || '')}</td><td ${td}>${esc(e.remarks || '')}</td></tr>`).join('') : `<tr><td ${td} colspan="4">No status updated yet</td></tr>`}</table>
<p>Current status: <b>${esc(sh.currentStatus || 'Registered')}</b></p><p>Regards</p>`;
  return { to: mails.join(', '), subject: `Shipment status - ${sh.docketNo}${sh.hawbNo ? ' - ' + (air ? 'HAWB ' : 'HBL ') + sh.hawbNo : ''}${sh.currentStatus ? ' - ' + sh.currentStatus : ''}`, html, note: '' };
}
router.get('/:id/mail', async (req, res) => {
  try { await ensure(); const sh = (await q('SELECT * FROM Shipments WHERE id = ?', [req.params.id]))[0]; if (!sh) return res.status(404).json({ error: 'Docket not found' });
    const log = await q("SELECT title, eventDate, eventTime, remarks, createdBy FROM ShipmentEvents WHERE shipmentId = ? AND kind = 'mail' ORDER BY id DESC LIMIT 20", [sh.id]);
    res.json({ ...await mailDraft(sh), log }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/:id/mail', async (req, res) => {
  try {
    await ensure(); const sh = (await q('SELECT * FROM Shipments WHERE id = ?', [req.params.id]))[0]; if (!sh) return res.status(404).json({ error: 'Docket not found' });
    const b = req.body || {}; const to = String(b.to || '').split(/[;,\s]+/).filter(Boolean);
    if (!to.length || to.some(m => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m))) throw bad('Enter the e-mail address(es) to send to');
    const dr = await mailDraft(sh); const extra = String(b.message || '').trim();
    const html = (extra ? '<p>' + esc(extra).replace(/\n/g, '<br>') + '</p>' : '') + dr.html;
    const { sendMail } = require('../utils/mailer');
    await sendMail({ to: to.join(', '), cc: b.cc || undefined, subject: String(b.subject || dr.subject), html });
    const s = new Date().toISOString();
    await x('INSERT INTO ShipmentEvents (shipmentId, kind, title, eventDate, eventTime, status, remarks, dataJson, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [sh.id, 'mail', String(b.subject || dr.subject), s.slice(0, 10), new Date().toTimeString().slice(0, 5), 'Sent', 'To ' + to.join(', ') + (b.cc ? '; cc ' + b.cc : ''), '{}', userOf(req) || null, s, s]);
    res.json({ ok: true, to });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

router.get('/by-job', async (req, res) => {
  try {
    await ensure(); const no = String(req.query.jobNo || '').trim(); if (!no || /^draft$/i.test(no)) return res.json(null);
    const r = (await q("SELECT id, docketNo, division, stage, currentStatus FROM Shipments WHERE upper(trim(ediJobNo)) = upper(?) AND coalesce(stage, '') <> 'Cancelled' ORDER BY id LIMIT 1", [no]))[0];
    res.json(r || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/from-job', async (req, res) => {
  let t;
  try {
    await ensure(); const b = req.body || {}; const side = b.side === 'Export' ? 'Export' : 'Import';
    const j = await customsJob(side, b); if (!j) throw bad('Save the ' + (side === 'Export' ? 'shipping bill' : 'BE') + ' job first - the docket is made from the saved job');
    if (!j.jobNo || /^draft$/i.test(j.jobNo)) throw bad('Save the job first (it has no job no yet)');
    const ex = (await q("SELECT id, docketNo, division FROM Shipments WHERE upper(trim(ediJobNo)) = upper(?) AND coalesce(stage, '') <> 'Cancelled' LIMIT 1", [j.jobNo]))[0];
    if (ex) return res.json({ ...ex, created: false, message: 'Shipment is already registered for job ' + j.jobNo + ' - Docket No. ' + ex.docketNo });
    // iCAFFE: no shipment is registered for a job without an invoice
    const invN = (await q(side === 'Export' ? 'SELECT count(*) n FROM ExportInvoices WHERE exportJobId = ?' : 'SELECT count(*) n FROM ImportInvoices WHERE importJobId = ?', [j.id]).catch(() => [{ n: 1 }]))[0].n;
    if (!Number(invN)) throw bad('There is no invoice in this job (' + j.jobNo + '). Kindly check the details - save the invoice first, then register the shipment');
    const d = fromCustoms(side, j);
    if (!d.mainParty) throw bad((side === 'Import' ? 'Importer' : 'Exporter') + ' name is empty on the job - fill it and save the job first');
    // "Change Branch" in the popup wins over the job's branch
    const br = String(b.branchCode || d.branchCode || await defaultBranch()).toUpperCase(); const by = userOf(req) || null; const date = today();
    t = await sequelize.transaction();
    const docketNo = await nextDocket(br, d.division, date, t, true); const s = new Date().toISOString();
    const row = { docketNo, division: d.division, branchCode: br, docketDate: date, jobType: 'CC', shipmentType: 'Consol', houseType: d.hawbNo ? 'House' : 'Master', cargoType: 'General', freightTerm: 'Prepaid',
      customsOnly: d.mawbNo ? 0 : 1, stage: 'Register', ediJobNo: j.jobNo, remarks: 'Made from customs job ' + j.jobNo, createdBy: by, createdAt: s, updatedAt: s,
      containersJson: '[]', dimensionsJson: '[]', docsJson: '{}', dataJson: JSON.stringify(d.data || {}) };
    for (const k of ['mainParty', 'mainAddress', 'otherParty', 'mawbNo', 'mawbDate', 'hawbNo', 'hawbDate', 'igmNo', 'igmDate', 'originPort', 'destinationPort', 'dischargePort', 'clearanceAt', 'carrier', 'flightVessel',
      'pkgs', 'pkgUnit', 'grossWeight', 'chargeableWeight', 'goodsDesc', 'cha', 'subAgent']) if (d[k] != null && d[k] !== '') row[k] = typeof d[k] === 'string' ? d[k].slice(0, 500) : d[k];
    const keys = Object.keys(row);
    await x(`INSERT INTO Shipments (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(',')})`, keys.map(k => row[k]), t);
    const id = (await q('SELECT id FROM Shipments WHERE docketNo = ?', [docketNo], t))[0].id;
    await x("INSERT INTO ShipmentEvents (shipmentId, kind, title, eventDate, status, remarks, createdBy, createdAt, updatedAt) VALUES (?, 'activity', ?, ?, 'Done', ?, ?, ?, ?)", [id, 'Docket made from customs job', date, j.jobNo, by, s, s], t);
    await syncStatus(id, side, j, by, t);
    await t.commit();
    res.json({ id, docketNo, division: d.division, created: true, message: 'Shipment registered successfully. Docket No. ' + docketNo + ' generated for job ' + j.jobNo });
  } catch (e) { if (t) await t.rollback().catch(() => {}); res.status(e.status || 500).json({ error: e.message }); }
});
// refresh the customs milestones (BE / SB, assessment, duty, OOC / LEO) of a docket from its EDI job
router.post('/:id/sync-customs', async (req, res) => {
  try {
    await ensure(); const sh = (await q('SELECT id, ediJobNo, division FROM Shipments WHERE id = ?', [req.params.id]))[0]; if (!sh) return res.status(404).json({ error: 'Docket not found' });
    if (!sh.ediJobNo) throw bad('No EDI Job No on this docket');
    const side = /I$/.test(sh.division) ? 'Import' : 'Export'; const j = await customsJob(side, { jobNo: sh.ediJobNo });
    if (!j) throw bad('Customs job ' + sh.ediJobNo + ' not found in ' + side + ' jobs');
    res.json({ ok: true, milestones: await syncStatus(sh.id, side, j, userOf(req) || null) });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

router.STATUS_LEVELS = STATUS_LEVELS;
// 05-Nov-2026: tables are made when the backend starts (not only when the screen is first used)
setTimeout(() => ensure().then(() => console.log('[shipments] tables ready: Shipments, ShipmentEvents, ShipmentSeries')).catch(e => console.error('[shipments] tables not made:', e.message)), 4000);
module.exports = router;
