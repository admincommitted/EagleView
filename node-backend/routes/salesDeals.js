// Sales module - Step 2 / 3: enquiries (RFQ) and quotations. 14-Nov-2026.
// Mounted inside /api/sales-hub (routes/salesHub.js), so the same login rights and "who sees what" apply.
// Uses the existing tables Leads (enquiries), Quotations and QuotationCharges - the Provisional Sheet already reads a
// docket's quotation from them (docket "Quotation" no. or job no.) - with the columns the new screens need added.
//   Enquiry: customer / prospect, contact, sales person, service, origin > destination, cargo (pkgs, weights, CBM,
//            containers, DG, temperature, value), dates (ready, quote by), status Open > Quoted > Won / Lost / Dropped.
//   Quotation: from an enquiry; charges from Accounts > GST Charges with basis (per shipment / kg / CBM / container /
//            package / document / % of value), buy and sell rate, minimum, currency + rate of exchange (Currency
//            master), margin; validity, transit, carrier, terms; Draft > Sent > Won / Lost, Revise (R1, R2 …), print,
//            PDF, mail; Won links the docket (Shipments.quotationNo) so the Provisional Sheet bills at the quoted rates.
const express = require('express');
const router = express.Router();
const S = require('../utils/salesHub');
const { q, x, today, clean, upper, numOrNull } = S;

const bad = (m, status = 400) => Object.assign(new Error(m), { status });
const send = (res, e) => res.status(e.status || 500).json({ success: false, error: e.message, ...(e.extra || {}) });
router.param('eid', (req, res, next, id) => (/^\d+$/.test(String(id)) ? next() : next('route')));
router.param('qid', (req, res, next, id) => (/^\d+$/.test(String(id)) ? next() : next('route')));
// Leads / Quotations / QuotationCharges are also Sequelize models: their dates must be in the form Sequelize reads
const dbNow = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fyCode = (d = today()) => { const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)); const s = m < 4 ? y - 1 : y; return String(s % 100).padStart(2, '0') + String((s + 1) % 100).padStart(2, '0'); };
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

const ENQ_STATUS = [['OPEN', 'Open'], ['QUOTED', 'Quoted'], ['WON', 'Won'], ['LOST', 'Lost'], ['DROPPED', 'Dropped / no shipment']];
const QT_STATUS = [['DRAFT', 'Draft'], ['SENT', 'Sent'], ['WON', 'Won'], ['LOST', 'Lost'], ['SUPERSEDED', 'Revised']];
const VIA = ['E-mail', 'Phone', 'WhatsApp', 'Visit', 'Portal / tender', 'Overseas agent', 'Walk-in'];
const PRIORITY = [['HIGH', 'High'], ['NORMAL', 'Normal'], ['LOW', 'Low']];
const BASIS = [['FLAT', 'Per shipment'], ['KG', 'Per kg (chargeable)'], ['CBM', 'Per CBM'], ['CONTAINER', 'Per container'], ['PKG', 'Per package'], ['DOC', 'Per document (B/L, AWB, B/E, S/B)'], ['PCT', '% of cargo value']];
const SECTIONS = [['FREIGHT', 'Freight'], ['ORIGIN', 'Origin charges'], ['DESTINATION', 'Destination charges'], ['CUSTOMS', 'Customs clearance'], ['TRANSPORT', 'Transport'], ['OTHER', 'Other charges']];
const DEFAULT_TERMS = [
  'Rates are valid till the date shown and subject to space and equipment availability at the time of booking.',
  'GST is extra as applicable on each charge (rate shown against the charge).',
  'Duty, taxes, demurrage, detention, storage, inspection and any charge not shown above are extra at actuals.',
  'Freight is on chargeable weight / volume as per the carrier; rates in foreign currency are billed at the rate of exchange on the date of the invoice.',
  'Cargo insurance is not included unless shown above. Our services are subject to our standard trading conditions.',
  'Payment as per the agreed credit terms.',
].join('\n');

// columns the new screens need, added to the old tables (nothing is removed)
const ADD = {
  Leads: { customerId: 'INTEGER', contactId: 'INTEGER', salesPersonId: 'INTEGER', branchCode: 'TEXT', receivedVia: 'TEXT', quoteBy: 'TEXT', priority: 'TEXT',
    pkgs: 'REAL', grossWt: 'REAL', chargeableWt: 'REAL', cbm: 'REAL', containers: 'TEXT', isDg: 'INTEGER', isTemp: 'INTEGER', hsCode: 'TEXT', cargoValue: 'REAL',
    cargoCurrency: 'TEXT', frequency: 'TEXT', pickupAt: 'TEXT', deliveryAt: 'TEXT', lostTo: 'TEXT', closedAt: 'TEXT', updatedBy: 'TEXT' },
  Quotations: { customerId: 'INTEGER', contactId: 'INTEGER', salesPersonId: 'INTEGER', branchCode: 'TEXT', serviceType: 'TEXT', incoterms: 'TEXT', quoteCurrency: 'TEXT',
    pkgs: 'REAL', grossWt: 'REAL', chargeableWt: 'REAL', cbm: 'REAL', containers: 'TEXT', cargoValue: 'REAL', cargoCurrency: 'TEXT', carrier: 'TEXT', routing: 'TEXT',
    transitTime: 'TEXT', frequency: 'TEXT', terms: 'TEXT', revision: 'INTEGER', parentId: 'INTEGER', rootNo: 'TEXT', docketNo: 'TEXT', wonAt: 'TEXT', lostTo: 'TEXT',
    lostRate: 'TEXT', marginInr: 'REAL', marginPct: 'REAL', updatedBy: 'TEXT' },
  QuotationCharges: { chargeId: 'INTEGER', sacCode: 'TEXT', gstRate: 'REAL', section: 'TEXT', minSell: 'REAL', minBuy: 'REAL', vendor: 'TEXT',
    sellAmount: 'REAL', buyAmount: 'REAL', sellInr: 'REAL', buyInr: 'REAL' },
};
let ready = null;
const ensure = () => (ready = ready || (async () => {
  await S.ensure();
  await x(`CREATE TABLE IF NOT EXISTS Leads (id INTEGER PRIMARY KEY AUTOINCREMENT, enquiryNo TEXT UNIQUE, date TEXT, partyLedgerId INTEGER, clientName TEXT, contactPerson TEXT,
    designation TEXT, email TEXT, phone TEXT, mode TEXT, serviceType TEXT, origin TEXT, destination TEXT, incoterms TEXT, readinessDate TEXT, commodity TEXT, containerType TEXT,
    weight REAL, volume REAL, targetRate TEXT, competitor TEXT, remarks TEXT, status TEXT, lostReason TEXT, createdBy INTEGER, createdByName TEXT, createdAt DATETIME, updatedAt DATETIME)`);
  await x(`CREATE TABLE IF NOT EXISTS Quotations (id INTEGER PRIMARY KEY AUTOINCREMENT, quoteNo TEXT NOT NULL UNIQUE, leadId INTEGER, date TEXT NOT NULL, validUntil TEXT, partyLedgerId INTEGER,
    clientName TEXT NOT NULL, contactPerson TEXT, email TEXT, origin TEXT, destination TEXT, mode TEXT, commodity TEXT, remarks TEXT, status TEXT NOT NULL DEFAULT 'DRAFT', sentAt DATETIME,
    sentTo TEXT, decidedAt DATETIME, rejectReason TEXT, jobNo TEXT, totalBuyInr REAL DEFAULT 0, totalSellInr REAL DEFAULT 0, createdBy INTEGER, createdByName TEXT, createdAt DATETIME, updatedAt DATETIME)`);
  await x(`CREATE TABLE IF NOT EXISTS QuotationCharges (id INTEGER PRIMARY KEY AUTOINCREMENT, quotationId INTEGER NOT NULL, head TEXT NOT NULL, buyRate REAL DEFAULT 0, sellRate REAL DEFAULT 0,
    currency TEXT DEFAULT 'INR', roe REAL DEFAULT 1, qty REAL DEFAULT 1, basis TEXT, remarks TEXT, sortOrder INTEGER DEFAULT 0, createdAt DATETIME, updatedAt DATETIME)`);
  for (const [t, cols] of Object.entries(ADD)) {
    const have = new Set((await q(`PRAGMA table_info("${t}")`)).map(c => c.name));
    for (const [c, type] of Object.entries(cols)) if (!have.has(c)) await x(`ALTER TABLE "${t}" ADD COLUMN "${c}" ${type}`);
  }
  await x('CREATE INDEX IF NOT EXISTS idx_leads_cust ON Leads (customerId, status)');
  await x('CREATE INDEX IF NOT EXISTS idx_quotes_lead ON Quotations (leadId, status)');
  await x('CREATE INDEX IF NOT EXISTS idx_qcharges_quote ON QuotationCharges (quotationId)');
})().catch(e => { ready = null; throw e; }));

// ---- who sees what: a sales person sees the deals he handles or of customers he / his team is KAM of ----
function dealWhere(v, a = 'e') {
  const w = []; const p = [];
  if (v.team) {
    const ids = [...v.team]; const qm = ids.map(() => '?').join(',');
    w.push(`(${a}.salesPersonId IN (${qm}) OR ${a}.customerId IN (SELECT c.id FROM SalesCustomers c WHERE c.kamId IN (${qm})))`); p.push(...ids, ...ids);
  } else if (v.branches && v.branches.length) {
    w.push(`(${a}.branchCode IS NULL OR ${a}.branchCode = '' OR upper(${a}.branchCode) IN (${v.branches.map(() => '?').join(',')}))`); p.push(...v.branches);
  }
  return { w, p };
}
async function canSeeRow(v, table, id) {
  const { w, p } = dealWhere(v, 'e');
  return !!(await q(`SELECT e.id FROM "${table}" e WHERE e.id = ?${w.length ? ' AND ' + w.join(' AND ') : ''}`, [id, ...p]))[0];
}
const svcLabel = (code) => (S.SERVICES.find(s => s[0] === code) || [code, code || ''])[1];
const modeOf = (svc) => { const s = String(svc || ''); return s.startsWith('AIR') ? 'AIR' : s.startsWith('SEA') ? 'SEA' : s.startsWith('CUSTOMS') ? 'CUSTOMS' : s === 'TRANSPORT' ? 'ROAD' : s || null; };

async function nextNo(table, field, prefix) {
  const fy = fyCode(); const like = `${prefix}/${fy}/%`;
  const rows = await q(`SELECT ${field} n FROM "${table}" WHERE ${field} LIKE ?`, [like]);
  let max = 0; rows.forEach(r => { const m = /^[A-Z]+\/\d{4}\/(\d+)/.exec(String(r.n || '')); if (m) max = Math.max(max, Number(m[1])); });
  return `${prefix}/${fy}/${String(max + 1).padStart(4, '0')}`;
}

// ------------------------------------------------------------------ meta
router.get('/deal-meta', async (req, res) => {
  try {
    await ensure();
    const charges = await q('SELECT id, chargeName, sacCode, gstRate FROM AccGstCharges WHERE coalesce(isActive, 1) = 1 ORDER BY chargeName').catch(() => []);
    const cur = await q('SELECT currencyCode code, importRate, exportRate FROM Currencies ORDER BY currencyCode').catch(() => []);
    const cp = (await q('SELECT companyName, legalName, address1, address2, city, state, pincode, country, gstin, pan, phone, email, website, logoDataUrl FROM CompanyProfile ORDER BY id LIMIT 1').catch(() => []))[0] || {};
    res.json({ success: true, enquiryStatus: ENQ_STATUS, quoteStatus: QT_STATUS, via: VIA, priority: PRIORITY, basis: BASIS, sections: SECTIONS, defaultTerms: DEFAULT_TERMS,
      charges, currencies: cur.map(c => ({ code: c.code, importRate: Number(c.importRate) || null, exportRate: Number(c.exportRate) || null })), company: cp, marginWarnPct: 10 });
  } catch (e) { send(res, e); }
});

// ------------------------------------------------------------------ summary (top of the Enquiries tab)
router.get('/deals/summary', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    const e = dealWhere(v, 'e'); const t = today();
    // the Sales dashboard passes the person picked there (only one the viewer may see)
    const pid = /^\d+$/.test(String(req.query.person || '')) ? Number(req.query.person) : null;
    if (pid && (!v.team || v.team.has(pid))) { e.w.push('(e.salesPersonId = ? OR e.customerId IN (SELECT c.id FROM SalesCustomers c WHERE c.kamId = ?))'); e.p.push(pid, pid); }
    const fy = (() => { const y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7)); return `${m < 4 ? y - 1 : y}-04-01`; })();
    const W = (extra) => [...e.w, ...extra].length ? 'WHERE ' + [...e.w, ...extra].join(' AND ') : '';
    const one = async (sql, p = []) => (await q(sql, p))[0] || {};
    const open = await one(`SELECT count(*) n, sum(CASE WHEN e.quoteBy IS NOT NULL AND e.quoteBy < ? THEN 1 ELSE 0 END) late FROM Leads e ${W(["e.status = 'OPEN'"])}`, [t, ...e.p]);
    const qt = await one(`SELECT count(*) n, sum(e.totalSellInr) v, sum(CASE WHEN e.validUntil IS NOT NULL AND e.validUntil < ? THEN 1 ELSE 0 END) expired,
      sum(CASE WHEN e.validUntil >= ? AND e.validUntil <= ? THEN 1 ELSE 0 END) expiring FROM Quotations e ${W(["e.status = 'SENT'"])}`, [t, t, addDays(t, 7), ...e.p]);
    const won = await one(`SELECT count(*) n, sum(e.totalSellInr) v, sum(e.marginInr) m FROM Quotations e ${W(["e.status = 'WON'", 'substr(e.wonAt, 1, 10) >= ?'])}`, [...e.p, t.slice(0, 8) + '01']);
    const fyWL = await one(`SELECT sum(CASE WHEN e.status = 'WON' THEN 1 ELSE 0 END) w, sum(CASE WHEN e.status = 'LOST' THEN 1 ELSE 0 END) l FROM Leads e ${W(['e.date >= ?'])}`, [...e.p, fy]);
    const draft = await one(`SELECT count(*) n FROM Quotations e ${W(["e.status = 'DRAFT'"])}`, e.p);
    res.json({ success: true, data: { openEnquiries: open.n || 0, lateEnquiries: open.late || 0, draftQuotes: draft.n || 0, sentQuotes: qt.n || 0, sentValue: qt.v || 0,
      expiredQuotes: qt.expired || 0, expiringQuotes: qt.expiring || 0, wonMonth: won.n || 0, wonMonthValue: won.v || 0, wonMonthMargin: won.m || 0,
      fyWon: fyWL.w || 0, fyLost: fyWL.l || 0, winRate: (fyWL.w || 0) + (fyWL.l || 0) ? Math.round(100 * (fyWL.w || 0) / ((fyWL.w || 0) + (fyWL.l || 0))) : null } });
  } catch (e) { send(res, e); }
});

// ------------------------------------------------------------------ enquiries
const ENQ_FIELDS = ['date', 'customerId', 'contactId', 'clientName', 'contactPerson', 'designation', 'email', 'phone', 'salesPersonId', 'branchCode', 'receivedVia', 'priority', 'serviceType', 'mode',
  'origin', 'destination', 'incoterms', 'readinessDate', 'quoteBy', 'commodity', 'hsCode', 'pkgs', 'grossWt', 'chargeableWt', 'cbm', 'weight', 'volume', 'containers', 'containerType',
  'isDg', 'isTemp', 'cargoValue', 'cargoCurrency', 'frequency', 'pickupAt', 'deliveryAt', 'targetRate', 'competitor', 'remarks'];
async function enquiryFields(b, v) {
  const f = {
    date: clean(b.date) || today(), customerId: numOrNull(b.customerId), contactId: numOrNull(b.contactId), salesPersonId: numOrNull(b.salesPersonId),
    branchCode: upper(b.branchCode), receivedVia: clean(b.receivedVia), priority: upper(b.priority) || 'NORMAL', serviceType: upper(b.serviceType),
    origin: upper(b.origin), destination: upper(b.destination), incoterms: upper(b.incoterms), readinessDate: clean(b.readinessDate), quoteBy: clean(b.quoteBy),
    commodity: clean(b.commodity), hsCode: clean(b.hsCode), pkgs: numOrNull(b.pkgs), grossWt: numOrNull(b.grossWt), chargeableWt: numOrNull(b.chargeableWt), cbm: numOrNull(b.cbm),
    containers: upper(b.containers), isDg: b.isDg ? 1 : 0, isTemp: b.isTemp ? 1 : 0, cargoValue: numOrNull(b.cargoValue), cargoCurrency: upper(b.cargoCurrency),
    frequency: clean(b.frequency), pickupAt: clean(b.pickupAt), deliveryAt: clean(b.deliveryAt), targetRate: clean(b.targetRate), competitor: clean(b.competitor), remarks: clean(b.remarks),
    contactPerson: clean(b.contactPerson), designation: clean(b.designation), email: clean(b.email), phone: clean(b.phone),
  };
  if (!f.customerId) throw bad('Pick the customer or prospect (or add a new prospect)');
  const c = (await q('SELECT id, name, kamId, branchCode, ledgerId, status FROM SalesCustomers WHERE id = ?', [f.customerId]))[0];
  if (!c) throw bad('Customer not found');
  if (c.status === 'BLOCKED') throw bad(`${c.name} is Blocked in Sales - do not quote. Change its status first if this is cleared.`);
  f.clientName = c.name; f.partyLedgerId = c.ledgerId || null;
  if (!f.serviceType || !S.SERVICES.some(s => s[0] === f.serviceType)) throw bad('Pick the service');
  f.mode = modeOf(f.serviceType);
  if (!/^CUSTOMS|WAREHOUSE|INSURANCE/.test(f.serviceType) && (!f.origin || !f.destination)) throw bad('Give the origin and the destination');
  if (/^CUSTOMS/.test(f.serviceType) && !f.origin) throw bad('Give the port / place of clearance (origin)');
  if (/_FCL$/.test(f.serviceType) && !f.containers) throw bad('Give the containers, e.g. 2x40HC');
  if (f.containers && !/^(\d+\s*[Xx×*]\s*[0-9A-Z]{2,5})(\s*[,+]\s*\d+\s*[Xx×*]\s*[0-9A-Z]{2,5})*$/.test(f.containers)) throw bad('Containers as count x type, e.g. 2x40HC, 1x20GP');
  if (f.email && !S.EMAIL_RE.test(f.email)) throw bad(`E-mail "${f.email}" is not valid`);
  for (const k of ['pkgs', 'grossWt', 'chargeableWt', 'cbm', 'cargoValue']) if (f[k] != null && f[k] < 0) throw bad(k + ' cannot be negative');
  if (f.grossWt && f.chargeableWt && f.chargeableWt < f.grossWt && f.mode === 'AIR') throw bad('Chargeable weight cannot be less than the gross weight');
  if (f.quoteBy && f.quoteBy < f.date) throw bad('"Quote by" is before the enquiry date');
  if (f.contactId) {
    const ct = (await q('SELECT name, designation, email, mobile, phone FROM SalesContacts WHERE id = ? AND customerId = ?', [f.contactId, c.id]))[0];
    if (!ct) throw bad('That contact is not of this customer');
    f.contactPerson = ct.name; f.designation = f.designation || ct.designation; f.email = f.email || ct.email; f.phone = f.phone || ct.mobile || ct.phone;
  }
  if (!f.salesPersonId) f.salesPersonId = c.kamId || (v.me && v.me.id) || null;
  if (v.team && f.salesPersonId && !v.team.has(f.salesPersonId)) throw bad('You can give an enquiry only to yourself or your team', 403);
  if (!f.branchCode) f.branchCode = c.branchCode || (v.branches && v.branches[0]) || null;
  f.weight = f.chargeableWt || f.grossWt; f.volume = f.cbm; f.containerType = f.containers;
  return f;
}
router.get('/enquiries', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    const { w, p } = dealWhere(v, 'e'); const Q = req.query;
    if (Q.status) { w.push('e.status = ?'); p.push(upper(Q.status)); }
    if (Q.spId) { w.push('e.salesPersonId = ?'); p.push(Number(Q.spId)); }
    if (Q.service) { w.push('e.serviceType = ?'); p.push(upper(Q.service)); }
    if (Q.customerId) { w.push('e.customerId = ?'); p.push(Number(Q.customerId)); }
    if (Q.from) { w.push('e.date >= ?'); p.push(Q.from); }
    if (Q.to) { w.push('e.date <= ?'); p.push(Q.to); }
    if (clean(Q.q)) { const t = '%' + clean(Q.q).toLowerCase() + '%'; w.push('(lower(e.enquiryNo) LIKE ? OR lower(e.clientName) LIKE ? OR lower(coalesce(e.origin, \'\')) LIKE ? OR lower(coalesce(e.destination, \'\')) LIKE ? OR lower(coalesce(e.commodity, \'\')) LIKE ?)'); p.push(t, t, t, t, t); }
    const rows = await q(`SELECT e.id, e.enquiryNo, e.date, e.customerId, e.clientName, e.contactPerson, e.salesPersonId, sp.name salesPerson, e.branchCode, e.serviceType, e.origin, e.destination,
        e.commodity, e.pkgs, e.grossWt, e.chargeableWt, e.cbm, e.containers, e.quoteBy, e.priority, e.status, e.lostReason, e.receivedVia,
        (SELECT count(*) FROM Quotations z WHERE z.leadId = e.id) quotes,
        (SELECT z.quoteNo || '|' || z.status || '|' || coalesce(z.totalSellInr, 0) || '|' || coalesce(z.marginPct, '') FROM Quotations z WHERE z.leadId = e.id AND z.status <> 'SUPERSEDED' ORDER BY z.id DESC LIMIT 1) lastQuote
      FROM Leads e LEFT JOIN SalesPersons sp ON sp.id = e.salesPersonId ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY e.date DESC, e.id DESC LIMIT ?`, [...p, Math.min(Number(Q.limit) || 500, 3000)]);
    const t = today();
    res.json({ success: true, data: rows.map(r => { const [no, st, sell, mp] = String(r.lastQuote || '').split('|'); return { ...r, serviceLabel: svcLabel(r.serviceType), late: r.status === 'OPEN' && r.quoteBy && r.quoteBy < t,
      lastQuoteNo: no || null, lastQuoteStatus: st || null, lastQuoteSell: sell ? Number(sell) : null, lastQuoteMarginPct: mp ? Number(mp) : null }; }) });
  } catch (e) { send(res, e); }
});
router.get('/enquiries/:eid', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    if (!(await canSeeRow(v, 'Leads', req.params.eid))) throw bad('Enquiry not found', 404);
    const e = (await q('SELECT e.*, sp.name salesPerson FROM Leads e LEFT JOIN SalesPersons sp ON sp.id = e.salesPersonId WHERE e.id = ?', [req.params.eid]))[0];
    const quotes = await q('SELECT id, quoteNo, date, validUntil, status, revision, totalSellInr, totalBuyInr, marginInr, marginPct, docketNo FROM Quotations WHERE leadId = ? ORDER BY id DESC', [e.id]);
    res.json({ success: true, data: { ...e, serviceLabel: svcLabel(e.serviceType), quotes } });
  } catch (e) { send(res, e); }
});
router.post('/enquiries', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    const f = await enquiryFields(req.body || {}, v);
    const enquiryNo = await nextNo('Leads', 'enquiryNo', 'ENQ');
    const k = Object.keys(f);
    await x(`INSERT INTO Leads (enquiryNo, status, ${k.join(', ')}, createdByName, updatedBy, createdAt, updatedAt) VALUES (?, 'OPEN', ${k.map(() => '?').join(', ')}, ?, ?, ?, ?)`,
      [enquiryNo, ...k.map(z => f[z]), v.user, v.user, dbNow(), dbNow()]);
    const id = (await q('SELECT id FROM Leads WHERE enquiryNo = ?', [enquiryNo]))[0].id;
    res.json({ success: true, id, enquiryNo });
  } catch (e) { send(res, e); }
});
router.put('/enquiries/:eid', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    if (!(await canSeeRow(v, 'Leads', req.params.eid))) throw bad('Enquiry not found', 404);
    const old = (await q('SELECT * FROM Leads WHERE id = ?', [req.params.eid]))[0];
    if (['WON', 'LOST', 'DROPPED'].includes(old.status)) throw bad(`Enquiry ${old.enquiryNo} is ${old.status.toLowerCase()} - reopen it to change it`);
    const f = await enquiryFields(req.body || {}, v);
    const k = Object.keys(f);
    await x(`UPDATE Leads SET ${k.map(z => z + ' = ?').join(', ')}, updatedBy = ?, updatedAt = ? WHERE id = ?`, [...k.map(z => f[z]), v.user, dbNow(), old.id]);
    res.json({ success: true });
  } catch (e) { send(res, e); }
});
// close (lost / dropped) or reopen
router.post('/enquiries/:eid/status', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    if (!(await canSeeRow(v, 'Leads', req.params.eid))) throw bad('Enquiry not found', 404);
    const e = (await q('SELECT * FROM Leads WHERE id = ?', [req.params.eid]))[0];
    const st = upper(req.body.status);
    if (st === 'OPEN') {
      const hasQuote = (await q("SELECT count(*) n FROM Quotations WHERE leadId = ? AND status IN ('DRAFT', 'SENT')", [e.id]))[0].n;
      await x('UPDATE Leads SET status = ?, lostReason = NULL, lostTo = NULL, closedAt = NULL, updatedBy = ?, updatedAt = ? WHERE id = ?', [hasQuote ? 'QUOTED' : 'OPEN', v.user, dbNow(), e.id]);
    } else if (st === 'LOST' || st === 'DROPPED') {
      const reason = clean(req.body.reason); if (!reason) throw bad('Give the reason');
      await x('UPDATE Leads SET status = ?, lostReason = ?, lostTo = ?, closedAt = ?, updatedBy = ?, updatedAt = ? WHERE id = ?', [st, reason, clean(req.body.lostTo), today(), v.user, dbNow(), e.id]);
      await x("UPDATE Quotations SET status = 'LOST', rejectReason = ?, lostTo = ?, decidedAt = ?, updatedAt = ? WHERE leadId = ? AND status IN ('DRAFT', 'SENT')", [reason, clean(req.body.lostTo), dbNow(), dbNow(), e.id]);
    } else throw bad('Status must be OPEN, LOST or DROPPED');
    res.json({ success: true });
  } catch (e) { send(res, e); }
});
router.delete('/enquiries/:eid', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    if (!(await canSeeRow(v, 'Leads', req.params.eid))) throw bad('Enquiry not found', 404);
    const n = (await q('SELECT count(*) n FROM Quotations WHERE leadId = ?', [req.params.eid]))[0].n;
    if (n) throw bad('This enquiry has quotations - mark it Lost / Dropped instead of deleting it');
    await x('DELETE FROM Leads WHERE id = ?', [req.params.eid]);
    res.json({ success: true });
  } catch (e) { send(res, e); }
});

// ------------------------------------------------------------------ quotations
const containerCount = (s) => String(s || '').split(/[,+]/).reduce((a, part) => { const m = /(\d+)\s*[Xx×*]/.exec(part); return a + (m ? Number(m[1]) : 0); }, 0);
// one charge line worked out: qty from the basis, amounts with the minimum, INR at the line's rate of exchange
function workLine(c, h, rates) {
  const basis = BASIS.some(b => b[0] === upper(c.basis)) ? upper(c.basis) : 'FLAT';
  let qty = numOrNull(c.qty);
  if (qty == null || c.autoQty) qty = basis === 'KG' ? (h.chargeableWt || h.grossWt || 0) : basis === 'CBM' ? (h.cbm || 0) : basis === 'CONTAINER' ? containerCount(h.containers)
    : basis === 'PKG' ? (h.pkgs || 0) : basis === 'PCT' ? (h.cargoValue || 0) : 1;
  const currency = upper(c.currency) || 'INR';
  let roe = currency === 'INR' ? 1 : numOrNull(c.roe);
  if (currency !== 'INR' && !(roe > 0)) { const r = rates.get(currency); roe = r || null; }
  if (!(roe > 0)) throw bad(`No rate of exchange for ${currency} - add it in the Currency master or type it on the line`);
  const sellRate = numOrNull(c.sellRate) || 0, buyRate = numOrNull(c.buyRate) || 0;
  const factor = basis === 'PCT' ? qty / 100 : qty;
  const sellAmount = r2(Math.max(sellRate * factor, numOrNull(c.minSell) || 0));
  const buyAmount = r2(Math.max(buyRate * factor, numOrNull(c.minBuy) || 0));
  return { basis, qty: r2(qty * 1000) / 1000, currency, roe, sellRate, buyRate, minSell: numOrNull(c.minSell), minBuy: numOrNull(c.minBuy), sellAmount, buyAmount,
    sellInr: r2(sellAmount * roe), buyInr: r2(buyAmount * roe) };
}
async function rateMap(serviceType) {
  const exp = /EXP/.test(String(serviceType || ''));
  const rows = await q('SELECT currencyCode code, importRate, exportRate FROM Currencies').catch(() => []);
  return new Map(rows.map(r => [String(r.code).toUpperCase(), Number(exp ? (r.exportRate || r.importRate) : (r.importRate || r.exportRate)) || null]));
}
const QT_HEAD = ['date', 'validUntil', 'contactId', 'contactPerson', 'email', 'salesPersonId', 'serviceType', 'mode', 'origin', 'destination', 'incoterms', 'commodity', 'quoteCurrency',
  'pkgs', 'grossWt', 'chargeableWt', 'cbm', 'containers', 'cargoValue', 'cargoCurrency', 'carrier', 'routing', 'transitTime', 'frequency', 'terms', 'remarks'];
function quoteHead(b, base) {
  const h = {
    date: clean(b.date) || base.date || today(), validUntil: clean(b.validUntil) || base.validUntil, contactId: numOrNull(b.contactId) ?? base.contactId ?? null,
    contactPerson: clean(b.contactPerson) ?? base.contactPerson ?? null, email: clean(b.email) ?? base.email ?? null, salesPersonId: numOrNull(b.salesPersonId) ?? base.salesPersonId ?? null,
    serviceType: upper(b.serviceType) || base.serviceType, origin: upper(b.origin) || base.origin, destination: upper(b.destination) || base.destination,
    incoterms: upper(b.incoterms) ?? base.incoterms ?? null, commodity: clean(b.commodity) ?? base.commodity ?? null, quoteCurrency: upper(b.quoteCurrency) || base.quoteCurrency || 'INR',
    pkgs: numOrNull(b.pkgs) ?? base.pkgs ?? null, grossWt: numOrNull(b.grossWt) ?? base.grossWt ?? null, chargeableWt: numOrNull(b.chargeableWt) ?? base.chargeableWt ?? null,
    cbm: numOrNull(b.cbm) ?? base.cbm ?? null, containers: upper(b.containers) ?? base.containers ?? null, cargoValue: numOrNull(b.cargoValue) ?? base.cargoValue ?? null,
    cargoCurrency: upper(b.cargoCurrency) ?? base.cargoCurrency ?? null, carrier: clean(b.carrier) ?? base.carrier ?? null, routing: clean(b.routing) ?? base.routing ?? null,
    transitTime: clean(b.transitTime) ?? base.transitTime ?? null, frequency: clean(b.frequency) ?? base.frequency ?? null, terms: b.terms !== undefined ? clean(b.terms) : (base.terms ?? DEFAULT_TERMS),
    remarks: b.remarks !== undefined ? clean(b.remarks) : (base.remarks ?? null),
  };
  h.mode = modeOf(h.serviceType);
  if (!h.validUntil) h.validUntil = addDays(h.date, 15);
  if (h.validUntil < h.date) throw bad('"Valid until" is before the quotation date');
  if (h.email && !S.EMAIL_RE.test(h.email)) throw bad(`E-mail "${h.email}" is not valid`);
  return h;
}
async function saveLines(qid, h, lines, t) {
  const charges = new Map((await q('SELECT id, chargeName, sacCode, gstRate FROM AccGstCharges', [], t).catch(() => [])).map(c => [c.id, c]));
  const rates = await rateMap(h.serviceType);
  const out = [];
  (lines || []).forEach((c, i) => {
    if (!c || (!c.chargeId && !clean(c.head))) return;
    const m = charges.get(numOrNull(c.chargeId));
    if (!m) throw bad(`Line ${i + 1}: pick the charge from the GST Charges list ("${c.head || ''}" is not in it)`);
    if (!(numOrNull(c.sellRate) > 0) && !(numOrNull(c.minSell) > 0)) throw bad(`Line ${i + 1} (${m.chargeName}): give the sell rate`);
    const w = workLine(c, h, rates);
    out.push({ ...w, chargeId: m.id, head: m.chargeName, sacCode: m.sacCode || null, gstRate: m.gstRate == null ? null : Number(m.gstRate),
      section: SECTIONS.some(s => s[0] === upper(c.section)) ? upper(c.section) : 'OTHER', vendor: clean(c.vendor), remarks: clean(c.remarks), sortOrder: i });
  });
  await x('DELETE FROM QuotationCharges WHERE quotationId = ?', [qid], t);
  for (const l of out) {
    await x(`INSERT INTO QuotationCharges (quotationId, head, chargeId, sacCode, gstRate, section, basis, qty, currency, roe, buyRate, sellRate, minBuy, minSell, buyAmount, sellAmount,
      buyInr, sellInr, vendor, remarks, sortOrder, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [qid, l.head, l.chargeId, l.sacCode, l.gstRate, l.section, l.basis, l.qty, l.currency, l.roe, l.buyRate, l.sellRate, l.minBuy, l.minSell, l.buyAmount, l.sellAmount,
      l.buyInr, l.sellInr, l.vendor, l.remarks, l.sortOrder, dbNow(), dbNow()], t);
  }
  const sell = r2(out.reduce((s, l) => s + l.sellInr, 0)), buy = r2(out.reduce((s, l) => s + l.buyInr, 0));
  const margin = r2(sell - buy);
  await x('UPDATE Quotations SET totalSellInr = ?, totalBuyInr = ?, marginInr = ?, marginPct = ? WHERE id = ?', [sell, buy, margin, sell ? r2(100 * margin / sell) : null, qid], t);
  return { sell, buy, margin, lines: out.length };
}
const tx = (fn) => require('../db').sequelize.transaction(fn);

router.get('/quotes', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    const { w, p } = dealWhere(v, 'e'); const Q = req.query; const t = today();
    if (Q.status === 'EXPIRED') { w.push("e.status = 'SENT' AND e.validUntil < ?"); p.push(t); }
    else if (Q.status) { w.push('e.status = ?'); p.push(upper(Q.status)); }
    else w.push("e.status <> 'SUPERSEDED'");
    if (Q.spId) { w.push('e.salesPersonId = ?'); p.push(Number(Q.spId)); }
    if (Q.service) { w.push('e.serviceType = ?'); p.push(upper(Q.service)); }
    if (Q.from) { w.push('e.date >= ?'); p.push(Q.from); }
    if (Q.to) { w.push('e.date <= ?'); p.push(Q.to); }
    if (clean(Q.q)) { const s = '%' + clean(Q.q).toLowerCase() + '%'; w.push("(lower(e.quoteNo) LIKE ? OR lower(e.clientName) LIKE ? OR lower(coalesce(e.origin, '')) LIKE ? OR lower(coalesce(e.destination, '')) LIKE ? OR lower(coalesce(e.docketNo, '')) LIKE ?)"); p.push(s, s, s, s, s); }
    const rows = await q(`SELECT e.id, e.quoteNo, e.revision, e.date, e.validUntil, e.leadId, l.enquiryNo, e.customerId, e.clientName, e.salesPersonId, sp.name salesPerson, e.serviceType, e.origin,
        e.destination, e.commodity, e.status, e.totalSellInr, e.totalBuyInr, e.marginInr, e.marginPct, e.sentAt, e.sentTo, e.docketNo, e.rejectReason
      FROM Quotations e LEFT JOIN Leads l ON l.id = e.leadId LEFT JOIN SalesPersons sp ON sp.id = e.salesPersonId ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
      ORDER BY e.date DESC, e.id DESC LIMIT ?`, [...p, Math.min(Number(Q.limit) || 500, 3000)]);
    res.json({ success: true, data: rows.map(r => ({ ...r, serviceLabel: svcLabel(r.serviceType), expired: r.status === 'SENT' && r.validUntil && r.validUntil < t })) });
  } catch (e) { send(res, e); }
});
async function fullQuote(id) {
  const h = (await q(`SELECT e.*, sp.name salesPerson, sp.mobile spMobile, sp.email spEmail, sp.designation spDesignation, l.enquiryNo, c.address custAddress, c.city custCity, c.state custState,
      c.gstin custGstin FROM Quotations e LEFT JOIN SalesPersons sp ON sp.id = e.salesPersonId LEFT JOIN Leads l ON l.id = e.leadId LEFT JOIN SalesCustomers c ON c.id = e.customerId WHERE e.id = ?`, [id]))[0];
  if (!h) return null;
  const lines = await q('SELECT * FROM QuotationCharges WHERE quotationId = ? ORDER BY sortOrder, id', [id]);
  const revisions = h.rootNo ? await q('SELECT id, quoteNo, revision, status, date FROM Quotations WHERE rootNo = ? ORDER BY revision', [h.rootNo]) : [];
  // the branch that quotes (its address / GSTIN go on the print when it has them)
  const branch = (await q("SELECT branchCode, branchName, address, gstin, phone, email FROM CompanyBranches WHERE upper(branchCode) = upper(?) OR (? IS NULL AND isDefault = 1) ORDER BY isDefault DESC LIMIT 1", [h.branchCode || '', h.branchCode || null]).catch(() => []))[0] || null;
  return { ...h, serviceLabel: svcLabel(h.serviceType), lines, revisions, branch, expired: h.status === 'SENT' && h.validUntil && h.validUntil < today() };
}
router.get('/quotes/:qid', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    if (!(await canSeeRow(v, 'Quotations', req.params.qid))) throw bad('Quotation not found', 404);
    res.json({ success: true, data: await fullQuote(req.params.qid) });
  } catch (e) { send(res, e); }
});
// new quotation from an enquiry (optionally with the charges of another quotation)
router.post('/quotes', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    const b = req.body || {};
    const eid = numOrNull(b.enquiryId); if (!eid) throw bad('A quotation is made from an enquiry');
    if (!(await canSeeRow(v, 'Leads', eid))) throw bad('Enquiry not found', 404);
    const e = (await q('SELECT * FROM Leads WHERE id = ?', [eid]))[0];
    if (['WON', 'LOST', 'DROPPED'].includes(e.status)) throw bad(`Enquiry ${e.enquiryNo} is ${String(e.status).toLowerCase()} - reopen it first`);
    let lines = b.lines || [];
    if (numOrNull(b.copyFromId)) {
      if (!(await canSeeRow(v, 'Quotations', b.copyFromId))) throw bad('Quotation to copy not found', 404);
      lines = (await q('SELECT * FROM QuotationCharges WHERE quotationId = ? ORDER BY sortOrder, id', [b.copyFromId])).map(l => ({ ...l, autoQty: true }));
    }
    const h = quoteHead(b, { ...e, salesPersonId: e.salesPersonId, contactId: e.contactId, contactPerson: e.contactPerson, email: e.email });
    const quoteNo = await nextNo('Quotations', 'quoteNo', 'QT');
    let id;
    await tx(async (t) => {
      const k = Object.keys(h);
      await x(`INSERT INTO Quotations (quoteNo, rootNo, revision, leadId, customerId, partyLedgerId, clientName, branchCode, status, ${k.join(', ')}, createdByName, updatedBy, createdAt, updatedAt)
        VALUES (?, ?, 0, ?, ?, ?, ?, ?, 'DRAFT', ${k.map(() => '?').join(', ')}, ?, ?, ?, ?)`, [quoteNo, quoteNo, e.id, e.customerId, e.partyLedgerId, e.clientName, e.branchCode, ...k.map(z => h[z]), v.user, v.user, dbNow(), dbNow()], t);
      id = (await q('SELECT id FROM Quotations WHERE quoteNo = ?', [quoteNo], t))[0].id;
      await saveLines(id, h, lines, t);
      if (e.status === 'OPEN') await x("UPDATE Leads SET status = 'QUOTED', updatedAt = ? WHERE id = ?", [dbNow(), e.id], t);
    });
    res.json({ success: true, id, quoteNo });
  } catch (e) { send(res, e); }
});
router.put('/quotes/:qid', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    if (!(await canSeeRow(v, 'Quotations', req.params.qid))) throw bad('Quotation not found', 404);
    const old = (await q('SELECT * FROM Quotations WHERE id = ?', [req.params.qid]))[0];
    if (old.status !== 'DRAFT') throw bad(`Quotation ${old.quoteNo} is ${String(old.status).toLowerCase()} - use Revise to change a quotation already sent`);
    const b = req.body || {};
    const h = quoteHead(b, old);
    if (h.salesPersonId && v.team && !v.team.has(h.salesPersonId)) throw bad('You can give a quotation only to yourself or your team', 403);
    let tot;
    await tx(async (t) => {
      const k = Object.keys(h);
      await x(`UPDATE Quotations SET ${k.map(z => z + ' = ?').join(', ')}, updatedBy = ?, updatedAt = ? WHERE id = ?`, [...k.map(z => h[z]), v.user, dbNow(), old.id], t);
      tot = await saveLines(old.id, h, b.lines || [], t);
    });
    res.json({ success: true, ...tot });
  } catch (e) { send(res, e); }
});
// a new revision (R1, R2 …) of a sent quotation; the old one is kept as "Revised"
router.post('/quotes/:qid/revise', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    if (!(await canSeeRow(v, 'Quotations', req.params.qid))) throw bad('Quotation not found', 404);
    const o = (await q('SELECT * FROM Quotations WHERE id = ?', [req.params.qid]))[0];
    if (!['SENT', 'LOST'].includes(o.status)) throw bad(o.status === 'DRAFT' ? 'A draft is changed directly - no revision needed' : `Quotation ${o.quoteNo} is ${String(o.status).toLowerCase()}`);
    const root = o.rootNo || o.quoteNo;
    const rev = ((await q('SELECT max(coalesce(revision, 0)) m FROM Quotations WHERE rootNo = ? OR quoteNo = ?', [root, root]))[0].m || 0) + 1;
    const quoteNo = `${root}-R${rev}`;
    let id;
    await tx(async (t) => {
      const cols = (await q('PRAGMA table_info(Quotations)', [], t)).map(c => c.name).filter(c => !['id', 'quoteNo', 'status', 'revision', 'parentId', 'rootNo', 'sentAt', 'sentTo', 'decidedAt', 'rejectReason',
        'wonAt', 'lostTo', 'lostRate', 'docketNo', 'jobNo', 'createdAt', 'updatedAt', 'date', 'validUntil', 'createdByName', 'updatedBy'].includes(c));
      await x(`INSERT INTO Quotations (quoteNo, status, revision, parentId, rootNo, date, validUntil, createdByName, updatedBy, createdAt, updatedAt, ${cols.join(', ')})
        SELECT ?, 'DRAFT', ?, id, ?, ?, ?, ?, ?, ?, ?, ${cols.join(', ')} FROM Quotations WHERE id = ?`, [quoteNo, rev, root, today(), addDays(today(), 15), v.user, v.user, dbNow(), dbNow(), o.id], t);
      id = (await q('SELECT id FROM Quotations WHERE quoteNo = ?', [quoteNo], t))[0].id;
      const lc = (await q('PRAGMA table_info(QuotationCharges)', [], t)).map(c => c.name).filter(c => !['id', 'quotationId', 'createdAt', 'updatedAt'].includes(c));
      await x(`INSERT INTO QuotationCharges (quotationId, createdAt, updatedAt, ${lc.join(', ')}) SELECT ?, ?, ?, ${lc.join(', ')} FROM QuotationCharges WHERE quotationId = ?`, [id, dbNow(), dbNow(), o.id], t);
      await x("UPDATE Quotations SET status = 'SUPERSEDED', updatedAt = ? WHERE id = ?", [dbNow(), o.id], t);
      if (o.leadId) await x("UPDATE Leads SET status = 'QUOTED', lostReason = NULL, closedAt = NULL, updatedAt = ? WHERE id = ? AND status IN ('OPEN', 'QUOTED', 'LOST')", [dbNow(), o.leadId], t);
    });
    res.json({ success: true, id, quoteNo });
  } catch (e) { send(res, e); }
});
router.delete('/quotes/:qid', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    if (!(await canSeeRow(v, 'Quotations', req.params.qid))) throw bad('Quotation not found', 404);
    const o = (await q('SELECT * FROM Quotations WHERE id = ?', [req.params.qid]))[0];
    if (o.status !== 'DRAFT') throw bad('Only a draft can be deleted - a sent quotation is kept (mark it Lost)');
    await tx(async (t) => {
      await x('DELETE FROM QuotationCharges WHERE quotationId = ?', [o.id], t);
      await x('DELETE FROM Quotations WHERE id = ?', [o.id], t);
      if (o.parentId) await x("UPDATE Quotations SET status = 'SENT', updatedAt = ? WHERE id = ? AND status = 'SUPERSEDED'", [dbNow(), o.parentId], t); // a deleted revision gives the last one back
      if (o.leadId) { const left = (await q("SELECT count(*) n FROM Quotations WHERE leadId = ? AND status IN ('DRAFT', 'SENT')", [o.leadId], t))[0].n; if (!left) await x("UPDATE Leads SET status = 'OPEN', updatedAt = ? WHERE id = ? AND status = 'QUOTED'", [dbNow(), o.leadId], t); }
    });
    res.json({ success: true });
  } catch (e) { send(res, e); }
});
async function markSent(o, to, v) {
  if (!['DRAFT', 'SENT'].includes(o.status)) throw bad(`Quotation ${o.quoteNo} is ${String(o.status).toLowerCase()}`);
  if (!(Number(o.totalSellInr) > 0)) throw bad('The quotation has no charges');
  await x('UPDATE Quotations SET status = ?, sentAt = ?, sentTo = ?, updatedBy = ?, updatedAt = ? WHERE id = ?', ['SENT', dbNow(), to || o.sentTo || null, v.user, dbNow(), o.id]);
  if (o.leadId) await x("UPDATE Leads SET status = 'QUOTED', updatedAt = ? WHERE id = ? AND status = 'OPEN'", [dbNow(), o.leadId]);
}
router.post('/quotes/:qid/sent', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    if (!(await canSeeRow(v, 'Quotations', req.params.qid))) throw bad('Quotation not found', 404);
    const o = (await q('SELECT * FROM Quotations WHERE id = ?', [req.params.qid]))[0];
    await markSent(o, clean(req.body.to), v);
    res.json({ success: true });
  } catch (e) { send(res, e); }
});
const pdfOf = (html) => { const g = require('./accountsGstInvoice'); if (!g.htmlToPdf) throw bad('PDF maker not available - restart the backend'); return g.htmlToPdf(html); };
const fileName = (no) => String(no).replace(/[\\/]+/g, '-') + '.pdf';
router.post('/quotes/:qid/pdf', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    if (!(await canSeeRow(v, 'Quotations', req.params.qid))) throw bad('Quotation not found', 404);
    const o = (await q('SELECT quoteNo FROM Quotations WHERE id = ?', [req.params.qid]))[0];
    if (!req.body.html) throw bad('Quotation print is missing');
    const pdf = await pdfOf(req.body.html);
    res.set('Content-Type', 'application/pdf'); res.set('Content-Disposition', `attachment; filename="${fileName(o.quoteNo)}"`); res.send(pdf);
  } catch (e) { send(res, e); }
});
router.post('/quotes/:qid/mail', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    if (!(await canSeeRow(v, 'Quotations', req.params.qid))) throw bad('Quotation not found', 404);
    const o = (await q('SELECT * FROM Quotations WHERE id = ?', [req.params.qid]))[0];
    const b = req.body || {}; const to = String(b.to || '').split(/[;,\s]+/).filter(Boolean);
    if (!to.length || to.some(e => !S.EMAIL_RE.test(e))) throw bad('Give a valid e-mail address (To)');
    const cc = String(b.cc || '').split(/[;,\s]+/).filter(Boolean); if (cc.some(e => !S.EMAIL_RE.test(e))) throw bad('A Cc address is not valid');
    if (!b.html) throw bad('Quotation print is missing');
    if (!['DRAFT', 'SENT'].includes(o.status)) throw bad(`Quotation ${o.quoteNo} is ${String(o.status).toLowerCase()}`);
    if (!(Number(o.totalSellInr) > 0)) throw bad('The quotation has no charges');
    const pdf = await pdfOf(b.html);
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    await require('../utils/mailer').sendMail({ to: to.join(', '), cc: cc.length ? cc.join(', ') : undefined, subject: clean(b.subject) || ('Quotation ' + o.quoteNo),
      text: b.body || '', html: '<div style="font-family:Arial,sans-serif;font-size:13px;white-space:pre-wrap">' + esc(b.body) + '</div>',
      attachments: [{ filename: fileName(o.quoteNo), content: pdf, contentType: 'application/pdf' }] });
    await markSent(o, to.join(', '), v);
    res.json({ success: true, to: to.join(', ') });
  } catch (e) { send(res, e); }
});
// won: the docket that carries the shipment gets the quotation no. (its Provisional Sheet then bills at these rates)
router.post('/quotes/:qid/won', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    if (!(await canSeeRow(v, 'Quotations', req.params.qid))) throw bad('Quotation not found', 404);
    const o = (await q('SELECT * FROM Quotations WHERE id = ?', [req.params.qid]))[0];
    if (!['SENT', 'WON'].includes(o.status)) throw bad(o.status === 'DRAFT' ? 'Send the quotation first (or mark it sent)' : `Quotation ${o.quoteNo} is ${String(o.status).toLowerCase()}`);
    const dk = upper(req.body.docketNo);
    let docket = null;
    if (dk) {
      docket = (await q('SELECT id, docketNo, quotationNo, mainParty FROM Shipments WHERE upper(docketNo) = ?', [dk]))[0];
      if (!docket) throw bad(`Docket ${dk} not found (Freight > Shipment Registration)`);
      if (docket.quotationNo && upper(docket.quotationNo) !== upper(o.quoteNo) && !req.body.replace) {
        throw Object.assign(bad(`Docket ${docket.docketNo} already carries quotation / contract ${docket.quotationNo}`), { status: 409, extra: { askReplace: true } });
      }
    }
    await tx(async (t) => {
      await x('UPDATE Quotations SET status = ?, wonAt = coalesce(wonAt, ?), decidedAt = ?, docketNo = coalesce(?, docketNo), updatedBy = ?, updatedAt = ? WHERE id = ?',
        ['WON', today(), dbNow(), docket ? docket.docketNo : null, v.user, dbNow(), o.id], t);
      if (docket) await x('UPDATE Shipments SET quotationNo = ? WHERE id = ?', [o.quoteNo, docket.id], t);
      // a docket carries one quotation: another quotation that pointed to it lets it go
      if (docket) await x('UPDATE Quotations SET docketNo = NULL WHERE upper(coalesce(docketNo, \'\')) = ? AND id <> ?', [upper(docket.docketNo), o.id], t);
      if (o.leadId) await x("UPDATE Leads SET status = 'WON', closedAt = ?, updatedAt = ? WHERE id = ?", [today(), dbNow(), o.leadId], t);
    });
    res.json({ success: true, docketNo: docket ? docket.docketNo : null });
  } catch (e) { send(res, e); }
});
router.post('/quotes/:qid/lost', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    if (!(await canSeeRow(v, 'Quotations', req.params.qid))) throw bad('Quotation not found', 404);
    const o = (await q('SELECT * FROM Quotations WHERE id = ?', [req.params.qid]))[0];
    if (!['SENT', 'DRAFT'].includes(o.status)) throw bad(`Quotation ${o.quoteNo} is ${String(o.status).toLowerCase()}`);
    const reason = clean(req.body.reason); if (!reason) throw bad('Give the reason it was lost');
    await tx(async (t) => {
      await x('UPDATE Quotations SET status = ?, rejectReason = ?, lostTo = ?, lostRate = ?, decidedAt = ?, updatedBy = ?, updatedAt = ? WHERE id = ?',
        ['LOST', reason, clean(req.body.lostTo), clean(req.body.lostRate), dbNow(), v.user, dbNow(), o.id], t);
      if (o.leadId) {
        const open = (await q("SELECT count(*) n FROM Quotations WHERE leadId = ? AND status IN ('DRAFT', 'SENT') AND id <> ?", [o.leadId, o.id], t))[0].n;
        if (!open) await x("UPDATE Leads SET status = 'LOST', lostReason = ?, lostTo = ?, closedAt = ?, updatedAt = ? WHERE id = ?", [reason, clean(req.body.lostTo), today(), dbNow(), o.leadId], t);
      }
    });
    res.json({ success: true });
  } catch (e) { send(res, e); }
});
// a won quotation back to sent (wrong click): the docket keeps its link only if the user says so
router.post('/quotes/:qid/reopen', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    if (!(await canSeeRow(v, 'Quotations', req.params.qid))) throw bad('Quotation not found', 404);
    const o = (await q('SELECT * FROM Quotations WHERE id = ?', [req.params.qid]))[0];
    if (!['WON', 'LOST'].includes(o.status)) throw bad('Only a won or lost quotation is reopened');
    await tx(async (t) => {
      if (o.docketNo) await x('UPDATE Shipments SET quotationNo = NULL WHERE upper(docketNo) = ? AND upper(coalesce(quotationNo, \'\')) = ?', [upper(o.docketNo), upper(o.quoteNo)], t);
      await x("UPDATE Quotations SET status = 'SENT', wonAt = NULL, docketNo = NULL, rejectReason = NULL, lostTo = NULL, lostRate = NULL, decidedAt = NULL, updatedAt = ? WHERE id = ?", [dbNow(), o.id], t);
      if (o.leadId) await x("UPDATE Leads SET status = 'QUOTED', lostReason = NULL, lostTo = NULL, closedAt = NULL, updatedAt = ? WHERE id = ?", [dbNow(), o.leadId], t);
    });
    res.json({ success: true });
  } catch (e) { send(res, e); }
});
// other quotations to copy charges from: this customer's first, then the same service / lane
router.get('/quotes-to-copy', async (req, res) => {
  try {
    await ensure();
    const v = await S.viewer(req);
    const { w, p } = dealWhere(v, 'e');
    const rows = await q(`SELECT e.id, e.quoteNo, e.date, e.clientName, e.serviceType, e.origin, e.destination, e.status, e.totalSellInr,
        (CASE WHEN e.customerId = ? THEN 2 ELSE 0 END) + (CASE WHEN e.serviceType = ? THEN 1 ELSE 0 END) + (CASE WHEN e.origin = ? AND e.destination = ? THEN 1 ELSE 0 END) score
      FROM Quotations e ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY score DESC, e.id DESC LIMIT 40`,
    [numOrNull(req.query.customerId) || 0, upper(req.query.service) || '', upper(req.query.origin) || '', upper(req.query.destination) || '', ...p]);
    res.json({ success: true, data: rows.map(r => ({ ...r, serviceLabel: svcLabel(r.serviceType) })) });
  } catch (e) { send(res, e); }
});

module.exports = router;
