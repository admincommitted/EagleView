const express = require('express');
const Airport = require('../models/Airport');
const Airline = require('../models/Airline');
const Currency = require('../models/Currency');
const Country = require('../models/Country');
const Charge = require('../models/Charge');
const Party = require('../models/Party');
const PartyDocument = require('../models/PartyDocument');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { sequelize } = require('../db');

// 28-Oct-2026: a Gmail address + app password were written here in the code. Mail now goes through
// Settings > Email (utils/mailer.js). That app password must be revoked in the Google account.
const transporter = require('../utils/mailer').lazyTransport();
const path = require('path');
const fs = require('fs');

// Configure Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/kyc');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});
// KYC uploads: PDF / images only, 10 MB each (there was no limit). 28-Oct-2026
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024, files: 10 },
    fileFilter: (req, file, cb) => cb(null, /^(application\/pdf|image\/(png|jpe?g|webp|gif|tiff))$/i.test(file.mimetype)) });
const crypto = require('crypto');
const { JWT_SECRET } = require('../middleware/auth');
// 14-Nov-2026 (security check): links valid 14 days (older links without exp until 01-Dec-2026); the address in the
// e-mail is a configured one or the office LAN host - never a Host header a stranger can send
const kycSig = (docId, action, exp) => crypto.createHmac('sha256', JWT_SECRET).update(exp ? `kyc:${docId}:${action}:${exp}` : `kyc:${docId}:${action}`).digest('hex').slice(0, 32);
const KYC_LEGACY_UNTIL = Date.parse('2026-12-01T00:00:00+05:30');
const appBase = (req) => (process.env.PUBLIC_API_URL || require('../utils/webSecurity').publicBase(req) || 'http://localhost:' + (process.env.PORT || 5001)).replace(/\/$/, '');
// party KYC status from its documents: all approved = APPROVED, any rejected = REJECTED, else PENDING
async function refreshKycStatus(partyId) {
    const docs = await PartyDocument.findAll({ where: { partyId } });
    const st = docs.map(d => String(d.docStatus || 'PENDING').toUpperCase());
    const status = !docs.length ? 'PENDING' : st.includes('REJECTED') ? 'REJECTED' : st.every(s => s === 'APPROVED') ? 'APPROVED' : 'PENDING';
    await Party.update({ kycStatus: status, kycApproved: status === 'APPROVED' }, { where: { id: partyId } });
    return status;
}
const PartyBranch = require('../models/PartyBranch');

const router = express.Router();
// 22-Nov-2026: Vessel / Transporter / Warehouse / IATA Agent / Item Template got an isActive column (switch off instead of
// delete). The models are loaded here so the add-only column check at server start (utils/ensureColumns) sees them.
const SWITCHABLE = { vessels: require('../models/Vessel'), transporters: require('../models/Transporter'), warehouses: require('../models/Warehouse'), iataagents: require('../models/IataAgent'), itemtemplates: require('../models/ItemTemplate') };
const switchReady = {}; // the column is also checked before the first read / write of such a master
const ensureSwitch = (cat) => { if (!SWITCHABLE[cat]) return Promise.resolve(); if (!switchReady[cat]) switchReady[cat] = require('../utils/ensureColumns').ensureColumns(SWITCHABLE[cat]).catch(() => {}); return switchReady[cat]; };

// 04-Nov-2026: the Party master holds ~28,000 parties (iCAFFE exporters / agents) with ~42,000 addresses. The full list
// (GET /api/masters/parties, loaded by the job screens) is built once, kept in memory and sent gzip-compressed; any
// change to a party clears it.
const zlib = require('zlib');
let partyCache = null; // { json, gz, at }
// 17-Nov-2026: saving a party took up to ~50 s on the office PC. Every party write threw the cache away and the next
// GET rebuilt it: three big SELECTs (about 28,000 parties, 42,000 branches) on Sequelize's one SQLite connection, then
// JSON.stringify + gzipSync of ~50 MB twice - all while every other request (the party POST itself included) waited.
// Now: the list is read on its own read-only SQLite connection (WAL: writes go on), compressed with async gzip,
// several GETs share one build, and after a write the cache is rebuilt in the background (generation counter so a
// build that started before the write is not kept).
let partyGen = 0, partyBuild = null, partyWarm = null;
const clearPartyCache = () => {
    partyCache = null; partyGen++;
    if (partyWarm) clearTimeout(partyWarm);
    partyWarm = setTimeout(() => { partyWarm = null; partyCacheReady().catch(() => {}); }, 1500);
    if (partyWarm.unref) partyWarm.unref();
};
const gzipA = (s) => new Promise((ok, no) => zlib.gzip(s, { level: 6 }, (e, b) => (e ? no(e) : ok(b))));
async function partyCacheReady() {
    if (partyCache && Date.now() - partyCache.at <= 10 * 60 * 1000) return partyCache;
    if (!partyBuild) {
        const gen = partyGen;
        partyBuild = (async () => {
            let c;
            try { c = await buildPartyListInWorker(); }
            catch (e) {
                console.warn('[parties] worker build failed, building here:', e.message);
                const b = await buildPartyJson();
                const [gz, cgz] = await Promise.all([gzipA(b.json), gzipA(b.compact)]);
                c = { json: b.json, gz, cjson: b.compact, cgz };
            }
            c.at = Date.now();
            if (gen === partyGen) partyCache = c;
            return { c, stale: gen !== partyGen };
        })().finally(() => { partyBuild = null; });
    }
    const r = await partyBuild;
    return r.stale ? partyCacheReady() : r.c; // a party was saved while it was being read: read once more
}
// the whole list built in a worker thread (utils/partyListWorker.js) - SQLite only; other databases build it here
async function buildPartyListInWorker() {
    if (sequelize.getDialect() !== 'sqlite' || !sequelize.options.storage) throw new Error('not SQLite');
    const so = await partySearchOnlyCol();
    const spec = {};
    const models = { Parties: Party, PartyBranches: require('../models/PartyBranch'), PartyADCodes: require('../models/PartyADCode'), PartyDrawbackAccounts: require('../models/PartyDrawbackAccount') };
    for (const [t, M] of Object.entries(models)) {
        const s = { bools: [], dates: [] };
        for (const [k, a] of Object.entries(M.rawAttributes)) { const key = a.type && a.type.key; if (key === 'BOOLEAN') s.bools.push(k); else if (key === 'DATE') s.dates.push(k); }
        spec[t] = s;
    }
    const { Worker } = require('worker_threads');
    return new Promise((resolve, reject) => {
        const w = new Worker(path.join(__dirname, '../utils/partyListWorker.js'), { workerData: { storage: sequelize.options.storage, so, spec }, resourceLimits: { maxOldGenerationSizeMb: 2048 } });
        let done = false;
        w.once('message', (m) => {
            done = true;
            if (m.error) return reject(new Error(m.error));
            resolve({ json: Buffer.from(m.json), cjson: Buffer.from(m.compact), gz: Buffer.from(m.gz), cgz: Buffer.from(m.cgz) });
        });
        w.once('error', (e) => { if (!done) { done = true; reject(e); } });
        w.once('exit', (code) => { if (!done) { done = true; reject(new Error('worker stopped (' + code + ')')); } });
    });
}
// the big list SELECTs on their own read-only connection (SQLite), so they do not hold up writes and other reads
function readAllSeparately(sqls) {
    const { QueryTypes } = require('sequelize');
    const viaSequelize = () => Promise.all(sqls.map(s => sequelize.query(s, { type: QueryTypes.SELECT })));
    if (sequelize.getDialect() !== 'sqlite' || !sequelize.options.storage) return viaSequelize();
    let sqlite3; try { sqlite3 = require('sqlite3'); } catch (e) { return viaSequelize(); }
    return new Promise((resolve) => {
        const db = new sqlite3.Database(sequelize.options.storage, sqlite3.OPEN_READONLY, (err) => {
            if (err) return resolve(viaSequelize());
            db.configure('busyTimeout', 15000);
            Promise.all(sqls.map(s => new Promise((ok, no) => db.all(s, (e, rows) => (e ? no(e) : ok(rows))))))
                .then((r) => { db.close(); resolve(r); }, () => { db.close(); resolve(viaSequelize()); });
        });
    });
}
// Built with plain SQL (Sequelize instances for ~28,000 parties + ~42,000 addresses took about a minute and held up
// every other request); the shape is the same as findAll({ include: branches, adCodes, drawbackAccounts }).
let soCol = false;
async function partySearchOnlyCol() {
    if (soCol) return true;
    const { QueryTypes } = require('sequelize');
    soCol = (await sequelize.query("SELECT 1 FROM pragma_table_info('Parties') WHERE name = 'searchOnly'", { type: QueryTypes.SELECT }).catch(() => [])).length > 0;
    return soCol;
}
async function buildPartyJson() {
    const { QueryTypes } = require('sequelize');
    // 08-Nov-2026: the iCAFFE consignees loaded in bulk (Parties.searchOnly = 1, ~1.2 lakh) are left out of this full list -
    // they are found by /parties/find and join the list once opened in the Party Master or used in a shipment
    const so = await partySearchOnlyCol();
    const W = { Parties: so ? ' WHERE coalesce(searchOnly, 0) = 0' : '' };
    const WP = so ? ' WHERE partyId IN (SELECT id FROM Parties WHERE coalesce(searchOnly, 0) = 0)' : '';
    const sql = (t) => 'SELECT * FROM ' + t + (t in W ? W[t] : WP);
    void QueryTypes;
    const models = { Parties: Party, PartyBranches: require('../models/PartyBranch'), PartyADCodes: require('../models/PartyADCode'), PartyDrawbackAccounts: require('../models/PartyDrawbackAccount') };
    const fix = (Model) => {
        const bools = [], dates = [];
        for (const [k, a] of Object.entries(Model.rawAttributes)) {
            const key = a.type && a.type.key;
            if (key === 'BOOLEAN') bools.push(k); else if (key === 'DATE') dates.push(k);
        }
        return (r) => {
            for (const k of bools) if (k in r) r[k] = r[k] == null ? r[k] : !!r[k];
            for (const k of dates) if (r[k]) { const d = new Date(String(r[k]).replace(' ', 'T').replace(' +00:00', 'Z')); if (!isNaN(d)) r[k] = d.toISOString(); }
            return r;
        };
    };
    const [ps, br, ad, dbk] = await readAllSeparately(['Parties', 'PartyBranches', 'PartyADCodes', 'PartyDrawbackAccounts'].map(sql));
    const group = (rows, f) => { const m = new Map(); for (const r of rows) { f(r); if (!m.has(r.partyId)) m.set(r.partyId, []); m.get(r.partyId).push(r); } return m; };
    const gb = group(br, fix(models.PartyBranches)), ga = group(ad, fix(models.PartyADCodes)), gd = group(dbk, fix(models.PartyDrawbackAccounts));
    const fp = fix(models.Parties);
    for (const p of ps) { fp(p); p.branches = gb.get(p.id) || []; p.adCodes = ga.get(p.id) || []; p.drawbackAccounts = gd.get(p.id) || []; }
    // 09-Nov-2026: a compact copy for the job / report screens (?compact=1, frontend utils/partiesCache): the same
    // parties and fields, without the null values and the createdAt / updatedAt stamps - about 56 MB -> 37 MB
    // for the browser to read. The Party Master screen keeps the full list.
    const drop = new Set(['createdAt', 'updatedAt']);
    const slim = (o) => { const r = {}; for (const k in o) { const v = o[k]; if (v === null || v === undefined || drop.has(k)) continue; /* '' kept: code may call string methods on it */ r[k] = Array.isArray(v) ? v.map(x => (x && typeof x === 'object' ? slim(x) : x)) : v; } return r; };
    // 17-Nov-2026: written out in slices with a pause every 2,000 parties, so other requests are served meanwhile
    // (one JSON.stringify of the whole ~50 MB list held the server for seconds)
    const out = async (map) => { const parts = ['[']; for (let i = 0; i < ps.length; i++) { if (i) parts.push(','); parts.push(JSON.stringify(map ? map(ps[i]) : ps[i])); if (i % 2000 === 1999) await new Promise(r => setImmediate(r)); } parts.push(']'); return parts.join(''); };
    const json = await out(null);
    const compact = await out(slim);
    return { json, compact };
}
router.use((req, res, next) => {
    if (req.method !== 'GET' && /part|kyc/i.test(req.path)) clearPartyCache();
    next();
});
const { z } = require('zod');

const partySchema = z.object({
    partyType: z.string().optional().default('MULTI'),
    isShipper: z.boolean().optional().default(false),
    isConsignee: z.boolean().optional().default(false),
    isNotifyParty: z.boolean().optional().default(false),
    isBuyer: z.boolean().optional().default(false),
    isSubAgent: z.boolean().optional().default(false),
    isOverseasAgent: z.boolean().optional().default(false),
    name: z.string().min(1, "Name is required").toUpperCase(),
    code: z.string().optional(),
    street: z.string().max(70, "Street cannot exceed 70 characters").toUpperCase(),
    city: z.string().max(17, "City cannot exceed 17 characters").toUpperCase(),
    stateProvince: z.string().toUpperCase().optional(),
    countryCode: z.string().length(2, "Country must be exactly 2 characters").toUpperCase(),
    zipPostcode: z.string().max(9, "Zip cannot exceed 9 characters").toUpperCase(),
    phoneNumber: z.string().optional(),
    email: z.string().email().optional().or(z.literal(''))
}).passthrough();


// Clean a body before create / update (28-Oct-2026):
// - id '' from a "new" form was sent to SQLite as the key -> "datatype mismatch", so Add never saved on UQC, Bond,
//   License, RSP, e-Sanchit, tariff / notification headers;
// - '' in a date column was stored as the text "Invalid date", '' in a number column failed or stored '';
// - createdAt / updatedAt from the browser are ignored.
function cleanBody(Model, body, { keepPk = false } = {}) {
    const out = { ...(body || {}) };
    delete out.createdAt; delete out.updatedAt;
    const pk = Model.primaryKeyAttribute || 'id';
    for (const [k, a] of Object.entries(Model.rawAttributes)) {
        if (!(k in out)) continue;
        const v = out[k];
        if (k === pk && a.autoIncrement && !keepPk) { delete out[k]; continue; }
        if (k === pk && a.autoIncrement && (v === '' || v == null)) { delete out[k]; continue; }
        const t = a.type && a.type.key;
        if (v === '' && a.unique) { out[k] = null; continue; } // '' in a unique code clashed with the next empty one (Party code)
        if (v === '' || (typeof v === 'string' && v.trim() === '' && ['DATE', 'DATEONLY', 'INTEGER', 'BIGINT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'REAL'].includes(t))) {
            if (['DATE', 'DATEONLY'].includes(t)) out[k] = null;
            else if (['INTEGER', 'BIGINT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'REAL'].includes(t)) out[k] = a.allowNull === false ? (a.defaultValue != null ? a.defaultValue : 0) : null;
            else if (t === 'BOOLEAN') out[k] = a.allowNull === false ? !!a.defaultValue : null;
        } else if (['DATE', 'DATEONLY'].includes(t) && typeof v === 'string' && isNaN(new Date(v).getTime())) {
            const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(v.trim()); // dd/mm/yyyy from Excel
            out[k] = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
        }
    }
    return out;
}
const sendErr = (res, err, code = 400) => {
    if (err && err.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'Already exists: ' + (err.errors || []).map(e => e.path + ' ' + e.value).join(', ') });
    if (err && err.name === 'SequelizeForeignKeyConstraintError') return res.status(409).json({ error: 'This record is used elsewhere and cannot be changed / deleted' });
    res.status(err.status || code).json({ error: err.errors ? err.errors.map(e => e.message).join(', ') : err.message });
};

const getModel = (category) => {
    switch(category.toLowerCase()) {
        case 'airports': return Airport;
        case 'airlines': return Airline;
        case 'iataagents': return require('../models/IataAgent');
        case 'currencies': return Currency;
        case 'specialhandlingcodes': return require('../models/SpecialHandlingCode');
        case 'countries': return Country;
        case 'charges': return Charge;
        case 'parties': return Party;
        case 'shippers': return Party; // Handled below with filter
        case 'consignees': return Party;
        case 'agents': return Party;
        case 'subagents': return Party;
        case 'ports': return require('../models/Port');
        case 'vessels': return require('../models/Vessel');
          case 'transporters': return require('../models/Transporter');
          case 'itemtemplates': return require('../models/ItemTemplate');
          // 'systemconfigurations' removed 28-Oct-2026: old ICEGATE credential screen, not used by any filing code
          // (ICEGATE Profiles are), and it sent the ICEGATE password / API key to the browser.
          case 'tariffdutycomponents': return require('../models/TariffDutyComponent');
        case 'warehouses': return require('../models/Warehouse');
        case 'states': return require('../models/State');
        case 'cities': return require('../models/City');
        case 'uqcs': return require('../models/Uqc');
          case 'bonds': return require('../models/Bond');
          case 'shippinglines': return require('../models/ShippingLine'); // 04-Nov-2026
          case 'licenses': return require('../models/License');
        case 'aeomasters': return require('../models/AeoMaster');
          case 'drawbacks': return require('../models/Drawback');
          case 'rodteps': return require('../models/Rodtep');
          case 'rosctls': return require('../models/Rosctl');
          case 'exportpolicies': return require('../models/ExportPolicy');
          case 'rspabatements': return require('../models/RspAbatement');
          case 'esanchits': return require('../models/ESanchit');
          case 'schemecodes': return require('../models/SchemeCode');
        default: return null;
    }
};

// GET /api/masters/parties/search
router.get('/parties/search', async (req, res) => {
    try {
        const { q, type } = req.query;
        if (!q) return res.json([]);
        const { Op } = require('sequelize');
        const whereClause = { name: { [Op.like]: `%${q}%` } };
        if (type) {
            const t = type.toUpperCase();
            if (t.includes('SHIPPER')) whereClause.isShipper = true;
            else if (t.includes('CONSIGNEE')) whereClause.isConsignee = true;
            else if (t.includes('BUYER')) whereClause.isBuyer = true;
            else if (t.includes('SUB AGENT') || t.includes('SUBAGENT')) whereClause.isSubAgent = true;
            else if (t.includes('OVERSEAS AGENT')) whereClause.isOverseasAgent = true;
            else if (t.includes('NOTIFY')) whereClause.isNotifyParty = true;
        }
        const results = await Party.findAll({
            where: whereClause, limit: 20,
            include: [
                { model: require('../models/PartyBranch'), as: 'branches' },
                { model: require('../models/PartyADCode'), as: 'adCodes' },
                { model: require('../models/PartyDrawbackAccount'), as: 'drawbackAccounts' }
            ]
        });
        res.json(results);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 08-Nov-2026: GET /api/masters/parties/find?q=&type=&limit= - every party in the master, including the search-only iCAFFE
// consignees that are not in the full list (name, code, IEC, PAN or GSTIN)
router.get('/parties/find', async (req, res) => {
    try {
        const { QueryTypes } = require('sequelize');
        const text = String(req.query.q || '').trim();
        const flag = { EXPORTER: 'isShipper', CONSIGNEE: 'isConsignee', SUBAGENT: 'isSubAgent', OVERSEAS_AGENT: 'isOverseasAgent', SHIPLINE: 'isShipline', BANK: 'isBank' }[String(req.query.type || '').toUpperCase()];
        if (!text && !flag) return res.json([]);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
        const so = await partySearchOnlyCol();
        const where = [], p = [];
        if (flag) where.push('p.' + flag + ' = 1');
        if (text) {
            where.push('(p.name LIKE ? OR p.code = ? OR p.taxId = ? OR p.panNumber = ? OR p.id IN (SELECT partyId FROM PartyBranches WHERE gstin = ? OR regNo = ?))');
            const u = text.toUpperCase(); p.push('%' + text + '%', u, u, u, u, u);
        }
        const rows = await sequelize.query('SELECT p.id, p.code, p.name, p.partyType, p.city, p.countryCode, ' + (so ? 'coalesce(p.searchOnly, 0)' : '0') + ' searchOnly FROM Parties p' +
            (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY CASE WHEN p.name LIKE ? THEN 0 ELSE 1 END, ltrim(p.name, \'#"\'\'([{.|&\\,%*-_/ \') LIMIT ?', { replacements: [...p, text + '%', limit], type: QueryTypes.SELECT });
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 08-Nov-2026: POST /api/masters/parties/:id/activate - a search-only party is put into the full party list and returned in full
router.post('/parties/:id/activate', async (req, res) => {
    try {
        if (await partySearchOnlyCol()) await sequelize.query('UPDATE Parties SET searchOnly = 0 WHERE id = ? AND coalesce(searchOnly, 0) = 1', { replacements: [Number(req.params.id)] });
        clearPartyCache();
        const party = await Party.findByPk(Number(req.params.id), { include: [
            { model: require('../models/PartyBranch'), as: 'branches' },
            { model: require('../models/PartyADCode'), as: 'adCodes' },
            { model: require('../models/PartyDrawbackAccount'), as: 'drawbackAccounts' }
        ] });
        if (!party) return res.status(404).json({ error: 'Party not found' });
        res.json(party);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== SPH MASTER CRUD ROUTES =====
const SphMaster = require('../models/SphMaster');

// GET all SPH codes from master table
router.get('/sph-master', async (req, res) => {
    try {
        const data = await SphMaster.findAll({ order: [['code', 'ASC']] });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/masters/specialhandlingcodes - SPH list for the AWB screens. 28-Oct-2026: it returned the codes saved on
// AWBs (table SpecialHandlingCode: repeated codes, no description) instead of this master; now the active master codes
router.get('/specialhandlingcodes', async (req, res) => {
    try {
        res.json(await SphMaster.findAll({ where: { isActive: true }, attributes: ['id', 'code', 'description', 'category'], order: [['code', 'ASC']] }));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// SPH code: 3 letters (IATA, e.g. PER, DGR, AVI)
const sphCheck = (code, description) => {
    if (!/^[A-Z]{3}$/.test(code)) return 'SPH code must be 3 letters (e.g. PER, DGR)';
    if (!description || description.length > 500) return 'Description is mandatory (max 500 characters)';
    return null;
};

// POST create new SPH code
router.post('/sph-master', async (req, res) => {
    try {
        const { category, isActive } = req.body;
        const code = String(req.body.code || '').trim().toUpperCase();
        const description = String(req.body.description || '').trim();
        const problem = sphCheck(code, description);
        if (problem) return res.status(400).json({ error: problem });
        const exists = await SphMaster.findOne({ where: { code: code.toUpperCase() } });
        if (exists) return res.status(409).json({ error: `SPH Code ${code} already exists` });
        const item = await SphMaster.create({ code: code.toUpperCase(), description: description.toUpperCase(), category: (category || '').toUpperCase(), isActive: isActive !== false });
        res.json({ message: 'SPH Code created', item });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update SPH code
router.put('/sph-master/:id', async (req, res) => {
    try {
        const item = await SphMaster.findByPk(req.params.id);
        if (!item) return res.status(404).json({ error: 'SPH code not found' });
        const { category, isActive } = req.body;
        const code = String(req.body.code || item.code).trim().toUpperCase();
        const description = String(req.body.description || item.description).trim();
        const problem = sphCheck(code, description);
        if (problem) return res.status(400).json({ error: problem });
        const { Op } = require('sequelize');
        if (await SphMaster.findOne({ where: { code, id: { [Op.ne]: item.id } } })) return res.status(409).json({ error: `SPH Code ${code} already exists` });
        await item.update({ code, description: description.toUpperCase(), category: category !== undefined ? String(category || '').toUpperCase() : item.category, isActive: isActive !== undefined ? !!isActive : item.isActive });
        res.json({ message: 'SPH Code updated', item });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE SPH code
router.delete('/sph-master/:id', async (req, res) => {
    try {
        const item = await SphMaster.findByPk(req.params.id);
        if (!item) return res.status(404).json({ error: 'SPH code not found' });
        await item.destroy();
        res.json({ message: 'SPH Code deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// ===== END SPH MASTER =====

// POST /api/masters/currencies/sync-live
// 28-Oct-2026: admin only (it overwrites every rate); these are MARKET rates, not the CBIC customs rates, so the
// rows are marked "MARKET RATE <date>"; 4 decimals; effective date set
router.post('/currencies/sync-live', async (req, res) => {
    if (String((req.user && req.user.role) || '').toLowerCase() !== 'admin') return res.status(403).json({ error: 'Only an admin can sync currency rates' });
    try {
        const CurrencyModel = require('../models/Currency');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        let response;
        try {
            response = await fetch('https://open.er-api.com/v6/latest/INR', { signal: controller.signal });
            clearTimeout(timeoutId);
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                return res.status(504).json({ error: 'Exchange rate API timed out after 10 seconds' });
            }
            throw err;
        }
        if (!response.ok) return res.status(502).json({ error: `Exchange rate API answered HTTP ${response.status}` });
        const data = await response.json();
        const rates = data.rates || {};
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const label = 'MARKET RATE ' + today.toLocaleDateString('en-GB');
        const currencies = await CurrencyModel.findAll();
        let updatedCount = 0;
        for (let currency of currencies) {
            const code = currency.currencyCode;
            if (rates[code] && rates[code] > 0) {
                const inr_value = 1 / rates[code];
                await currency.update({
                    importRate: parseFloat((inr_value * 1.01).toFixed(4)),
                    exportRate: parseFloat((inr_value * 0.99).toFixed(4)),
                    effectiveDate: today,
                    notificationNo: label
                });
                updatedCount++;
            }
        }
        res.json({ success: true, updatedCount });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to sync live rates' }); }
});

// 29-Oct-2026: CBIC customs exchange rates (the ones that go in the BE / SB) from ICEGATE 2.0 - see utils/cbicExchangeRates.js
// GET  /api/masters/currencies/cbic-status  -> notification in force on ICEGATE, what the master has, auto on/off
// POST /api/masters/currencies/sync-cbic    -> put the notification in force today into the master ({ force: true } re-applies)
// POST /api/masters/currencies/cbic-auto    -> { enabled: true|false }
const cbic = require('../utils/cbicExchangeRates');
const isAdmin = (req) => String((req.user && req.user.role) || '').toLowerCase() === 'admin';
// 18-Nov-2026: "current" is the notification IN FORCE today (from the history of notifications read from ICEGATE),
// "next" one published and coming into force later (applied on its own at its date). Before, "current" was the newest
// one PUBLISHED, which is the next day's.
router.get('/currencies/cbic-status', async (req, res) => {
    try {
        const [last, auto] = await Promise.all([cbic.lastSync(), cbic.autoEnabled()]);
        let current = null, next = null, error = null;
        try { current = await cbic.notificationInForce(); next = await cbic.nextNotification(); } catch (e) { error = e.message; }
        if (!current) { try { current = await cbic.notificationFor(); } catch (e) { error = error || e.message; } }
        res.json({ success: true, last, auto, current, next, today: cbic.todayIST(), upToDate: !!(last && current && last.number === current.number), error });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// GET /api/masters/currencies/in-force?date=YYYY-MM-DD -> the CBIC rates in force on that date (default today, India),
// one row per currency: { currencyCode, currencyName, importRate, exportRate (per 1 unit), effectiveDate, notificationNo }.
// No history yet: the Currency master. Used by the Invoices tab (job date) - 18-Nov-2026
router.get('/currencies/in-force', async (req, res) => {
    try {
        const d = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? String(req.query.date) : cbic.todayIST();
        const r = await cbic.ratesInForce(d);
        if (r.rates.length) return res.json({ success: true, date: r.date, source: 'history', rates: r.rates.map(x => ({ currencyCode: x.currencyCode, currencyName: x.currencyName, importRate: Number(x.importRate), exportRate: Number(x.exportRate), effectiveDate: x.effectiveDate, notificationNo: x.notificationNo })) });
        const rows = await Currency.findAll({ raw: true });
        res.json({ success: true, date: d, source: 'master', rates: rows.map(x => ({ currencyCode: x.currencyCode, currencyName: x.currencyName, importRate: Number(x.importRate), exportRate: Number(x.exportRate), effectiveDate: x.effectiveDate, notificationNo: x.notificationNo })) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// GET /api/masters/currencies/history?code=HKD -> the notifications kept (newest first), or one currency's rates
router.get('/currencies/history', async (req, res) => {
    try {
        const code = String(req.query.code || '').trim().toUpperCase();
        if (code) { const m = await cbic.historyOf([code]); return res.json({ success: true, code, rows: m.get(code) || [] }); }
        res.json({ success: true, notifications: await cbic.historyNotifications(), today: cbic.todayIST() });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/currencies/sync-cbic', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Only an admin can sync currency rates' });
    try {
        const r = await cbic.syncNow({ force: !!(req.body && req.body.force), user: (req.user && (req.user.username || req.user.name)) || 'Admin' });
        res.json({ success: true, ...r });
    } catch (err) { res.status(502).json({ error: err.message }); }
});
router.post('/currencies/cbic-auto', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Only an admin can change this' });
    try {
        const AppSetting = require('../models/AppSetting');
        const enabled = !(req.body && (req.body.enabled === false || req.body.enabled === 0 || req.body.enabled === '0'));
        const [row] = await AppSetting.findOrCreate({ where: { key: 'cbic_exrate_auto' }, defaults: { key: 'cbic_exrate_auto', value: '1', group: 'icegate', label: 'Auto-sync CBIC exchange rates from ICEGATE' } });
        await row.update({ value: enabled ? '1' : '0' });
        res.json({ success: true, auto: enabled });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 04-Nov-2026: with the iCAFFE customs / IGST / ADD notifications there are 200,000+ serial rows - the master screen
// now asks for the headers only (?lite=1, with a detail count) and loads one notification's rows when it is opened.
router.get('/dutynotifs/:id/details', async (req, res) => {
    try {
        const DutyNotifDetail = require('../models/DutyNotifDetail');
        res.json(await DutyNotifDetail.findAll({ where: { headerId: req.params.id }, order: [['id', 'ASC']] }));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/dutynotifs/all', async (req, res) => {
    try {
        if (req.query.lite) {
            const { QueryTypes } = require('sequelize');
            const rows = await sequelize.query('SELECT h.*, (SELECT count(*) FROM DutyNotifDetails d WHERE d.headerId = h.id) AS detailCount FROM DutyNotifHeaders h ORDER BY h.type, h.notifNo', { type: QueryTypes.SELECT });
            return res.json(rows.map(r => ({ ...r, isActive: r.isActive === 1 || r.isActive === true })));
        }
        const DutyNotifHeader = require('../models/DutyNotifHeader');
        const DutyNotifDetail = require('../models/DutyNotifDetail');
        const data = await DutyNotifHeader.findAll({ include: [{ model: DutyNotifDetail, as: 'details' }] });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/dutynotifs/bulk-upload', async (req, res) => {
    try {
        const DutyNotifHeader = require('../models/DutyNotifHeader');
        const DutyNotifDetail = require('../models/DutyNotifDetail');
        
        const data = req.body; // Array of objects
        if (!Array.isArray(data)) return res.status(400).json({error: "Expected array of data"});
        
        // 28-Oct-2026: the same file uploaded twice doubled every serial no - now a serial no already in the
        // notification is updated; the header's type / date are updated too; dates checked (dd/mm/yyyy accepted).
        const day = (v) => { const s = String(v || '').trim(); let m; if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return `${m[1]}-${m[2]}-${m[3]}`; if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return null; };
        const seen = new Set(); let created = 0, updated = 0;
        await sequelize.transaction(async (t) => {
            for (const item of data) {
                const notifNo = String(item.notifNo || '').trim();
                if (!notifNo) continue;
                // 04-Nov-2026: a notification no. is unique per type (IGST 001/2017 and ADD 001/2017 differ)
                let [header] = await DutyNotifHeader.findOrCreate({
                    where: { notifNo, type: (item.type || 'CUSTOM').toUpperCase() },
                    defaults: { type: (item.type || 'CUSTOM').toUpperCase(), effectiveDate: day(item.headerDate), isActive: true },
                    transaction: t
                });
                if (!seen.has(header.id)) {
                    seen.add(header.id);
                    const hv = {};
                    if (item.type) hv.type = String(item.type).toUpperCase();
                    if (day(item.headerDate)) hv.effectiveDate = day(item.headerDate);
                    if (Object.keys(hv).length) await header.update(hv, { transaction: t });
                }
                const serialNo = String(item.serialNo || '').trim();
                if (serialNo) {
                    const vals = {
                        tariffHead: String(item.tariffHead || '').trim(),
                        specificSeries: item.specificSeries || '',
                        dutyRate: parseFloat(item.dutyRate) || 0,
                        itemDescription: item.itemDescription || '',
                        conditionNo: item.conditionNo || '',
                        effectiveDate: day(item.detailDate),
                    };
                    const old = await DutyNotifDetail.findOne({ where: { headerId: header.id, serialNo }, transaction: t });
                    if (old) { await old.update(vals, { transaction: t }); updated++; }
                    else { await DutyNotifDetail.create({ ...vals, serialNo, headerId: header.id }, { transaction: t }); created++; }
                }
            }
        });
        res.json({ message: 'Bulk upload successful', headers: seen.size, created, updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/dutynotifs', async (req, res) => {
    try {
        const DutyNotifHeader = require('../models/DutyNotifHeader');
        const newItem = await DutyNotifHeader.create(cleanBody(DutyNotifHeader, req.body));
        res.status(201).json(newItem);
    } catch (err) {
        sendErr(res, err);
    }
});

router.put('/dutynotifs/:id', async (req, res) => {
    try {
        const DutyNotifHeader = require('../models/DutyNotifHeader');
        await DutyNotifHeader.update(cleanBody(DutyNotifHeader, req.body), { where: { id: req.params.id } });
        const updatedItem = await DutyNotifHeader.findByPk(req.params.id);
        if (!updatedItem) return res.status(404).json({ error: 'Notification not found' });
        res.json(updatedItem);
    } catch (err) {
        sendErr(res, err);
    }
});

router.delete('/dutynotifs/:id', async (req, res) => {
    try {
        const DutyNotifHeader = require('../models/DutyNotifHeader');
        const DutyNotifDetail = require('../models/DutyNotifDetail');
        await sequelize.transaction(async (t) => { // its serial numbers go with it
            await DutyNotifDetail.destroy({ where: { headerId: req.params.id }, transaction: t });
            await DutyNotifHeader.destroy({ where: { id: req.params.id }, transaction: t });
        });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/dutynotifdetails', async (req, res) => {
    try {
        const DutyNotifDetail = require('../models/DutyNotifDetail');
        const b = cleanBody(DutyNotifDetail, req.body);
        if (!b.headerId) return res.status(400).json({ error: 'Choose the notification first' });
        if (!String(b.serialNo || '').trim()) return res.status(400).json({ error: 'Serial no is required' });
        const dup = await DutyNotifDetail.findOne({ where: { headerId: b.headerId, serialNo: String(b.serialNo).trim() } });
        if (dup) return res.status(409).json({ error: `Serial no ${b.serialNo} already exists in this notification` });
        const newItem = await DutyNotifDetail.create(b);
        res.status(201).json(newItem);
    } catch (err) {
        sendErr(res, err);
    }
});

router.put('/dutynotifdetails/:id', async (req, res) => {
    try {
        const DutyNotifDetail = require('../models/DutyNotifDetail');
        await DutyNotifDetail.update(cleanBody(DutyNotifDetail, req.body), { where: { id: req.params.id } });
        const updatedItem = await DutyNotifDetail.findByPk(req.params.id);
        if (!updatedItem) return res.status(404).json({ error: 'Serial no not found' });
        res.json(updatedItem);
    } catch (err) {
        sendErr(res, err);
    }
});

router.delete('/dutynotifdetails/:id', async (req, res) => {
    try {
        const DutyNotifDetail = require('../models/DutyNotifDetail');
        await DutyNotifDetail.destroy({ where: { id: req.params.id } });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// END DUTY NOTIF ROUTES

// TARIFF ROUTES
router.get('/tariffheaders/all', async (req, res) => {
    try {
        // ?q= (HSN or description) and ?limit= so a full tariff (~12,000 lines) is not sent every time. 28-Oct-2026
        const { Op } = require('sequelize');
        const TariffHeader = require('../models/TariffHeader');
        const TariffComponent = require('../models/TariffComponent');
        const q = String(req.query.q || '').trim();
        const limit = Math.min(parseInt(req.query.limit, 10) || 5000, 20000);
        const where = q ? { [Op.or]: [{ hsnCode: { [Op.like]: q.replace(/\D/g, '') ? q.replace(/[^0-9]/g, '') + '%' : '__none__' } }, { description: { [Op.like]: '%' + q + '%' } }] } : undefined;
        const data = await TariffHeader.findAll({ where, include: [{ model: TariffComponent, as: 'components' }], order: [['hsnCode', 'ASC']], limit });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/tariffheaders', async (req, res) => {
    try {
        const TariffHeader = require('../models/TariffHeader');
        const b = cleanBody(TariffHeader, req.body);
        if (!/^\d{8}$/.test(String(b.hsnCode || '').trim())) return res.status(400).json({ error: 'HSN / CTH must be 8 digits' });
        const newItem = await TariffHeader.create(b);
        res.status(201).json(newItem);
    } catch (err) {
        sendErr(res, err);
    }
});

router.put('/tariffheaders/:id', async (req, res) => {
    try {
        const TariffHeader = require('../models/TariffHeader');
        const b = cleanBody(TariffHeader, req.body);
        if (b.hsnCode !== undefined && !/^\d{8}$/.test(String(b.hsnCode).trim())) return res.status(400).json({ error: 'HSN / CTH must be 8 digits' });
        delete b.components;
        await TariffHeader.update(b, { where: { id: req.params.id } });
        const updatedItem = await TariffHeader.findByPk(req.params.id);
        if (!updatedItem) return res.status(404).json({ error: 'Tariff line not found' });
        res.json(updatedItem);
    } catch (err) {
        sendErr(res, err);
    }
});

router.delete('/tariffheaders/:id', async (req, res) => {
    try {
        const TariffHeader = require('../models/TariffHeader');
        const TariffComponent = require('../models/TariffComponent');
        await sequelize.transaction(async (t) => { // its duty lines go with it
            await TariffComponent.destroy({ where: { tariffHeaderId: req.params.id }, transaction: t });
            await TariffHeader.destroy({ where: { id: req.params.id }, transaction: t });
        });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/tariffcomponents', async (req, res) => {
    try {
        const TariffComponent = require('../models/TariffComponent');
        const b = cleanBody(TariffComponent, req.body);
        if (!b.tariffHeaderId) return res.status(400).json({ error: 'Choose the tariff line first' });
        const newItem = await TariffComponent.create(b);
        res.status(201).json(newItem);
    } catch (err) {
        sendErr(res, err);
    }
});

// edit a duty line (there was no way to change one, only delete and add again). 28-Oct-2026
router.put('/tariffcomponents/:id', async (req, res) => {
    try {
        const TariffComponent = require('../models/TariffComponent');
        const row = await TariffComponent.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: 'Duty line not found' });
        await row.update(cleanBody(TariffComponent, req.body));
        res.json(row);
    } catch (err) {
        sendErr(res, err);
    }
});

router.delete('/tariffcomponents/:id', async (req, res) => {
    try {
        const TariffComponent = require('../models/TariffComponent');
        await TariffComponent.destroy({ where: { id: req.params.id } });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// END TARIFF ROUTES

// LIVE AVIATION NEWS FETCH
router.get('/live-news', async (req, res) => {
    try {
        const response = await fetch('https://www.aircargonews.net/feed/', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const xml = await response.text();
        
        // Simple regex XML parse to avoid adding heavy dependencies
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
            const itemBlock = match[1];
            const titleMatch = itemBlock.match(/<title>([\s\S]*?)<\/title>/);
            const linkMatch = itemBlock.match(/<link>([\s\S]*?)<\/link>/);
            
            if (titleMatch && linkMatch) {
                let title = titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
                let link = linkMatch[1].trim();
                let dateMatch = itemBlock.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
                  let pubDate = dateMatch ? dateMatch[1].trim() : '';
                  items.push({ title, link, pubDate });
            }
        }
        res.json({ success: true, data: items });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


const SPH_CODES = [
  { code: 'ACT', description: 'Active Temperature Controlled System' },
  { code: 'AOG', description: 'Aircraft on Ground' },
  { code: 'ATT', description: 'Goods Attached to Air Waybill' },
  { code: 'AVI', description: 'Live Animal' },
  { code: 'BIG', description: 'Outsized Cargo' },
  { code: 'BUP', description: 'Bulk Unitization Programme' },
  { code: 'CAO', description: 'Cargo Aircraft Only' },
  { code: 'CAT', description: 'Cargo Attendant Accompanying' },
  { code: 'COL', description: 'Cool Goods' },
  { code: 'COM', description: 'Company Mail' },
  { code: 'CRT', description: 'Control Room Temperature' },
  { code: 'DGD', description: 'Dangerous Goods Declaration' },
  { code: 'DIP', description: 'Diplomatic Mail' },
  { code: 'EAP', description: 'e-Freight with Paper Documents' },
  { code: 'EAT', description: 'Foodstuffs' },
  { code: 'EAW', description: 'e-Freight without Paper Documents' },
  { code: 'FIL', description: 'Undeveloped Film' },
  { code: 'FRI', description: 'Freezing Cargo' },
  { code: 'GEN', description: 'General Cargo' },
  { code: 'HEG', description: 'Hatching Eggs' },
  { code: 'HUM', description: 'Human Remains' },
  { code: 'LHO', description: 'Living Human Organs' },
  { code: 'MAG', description: 'Magnetized Material' },
  { code: 'MUW', description: 'Munitions of War' },
  { code: 'OBX', description: 'Obnoxious Cargo' },
  { code: 'OHG', description: 'Overhang Cargo' },
  { code: 'PAC', description: 'Passenger and Cargo' },
  { code: 'PEF', description: 'Flowers' },
  { code: 'PEM', description: 'Meat' },
  { code: 'PER', description: 'Perishable Cargo' },
  { code: 'PES', description: 'Seafood' },
  { code: 'PIL', description: 'Pharmaceuticals' },
  { code: 'QTA', description: 'High Risk Cargo' },
  { code: 'RAC', description: 'Reserved Air Cargo' },
  { code: 'RDS', description: 'Radioactive Material' },
  { code: 'SAL', description: 'Surface Mail' },
  { code: 'SEC', description: 'Security Cargo' },
  { code: 'SHL', description: 'Save Human Life' },
  { code: 'SOC', description: 'Shipper Owned Container' },
  { code: 'SPX', description: 'Secure for Passenger & Cargo' },
  { code: 'VAL', description: 'Valuable Cargo' },
  { code: 'VOL', description: 'Volume Cargo' },
  { code: 'VUN', description: 'Vulnerable Cargo' },
  { code: 'WET', description: 'Wet Cargo' }
];

// COMPANY BRANCH ROUTES
const CompanyBranch = require('../models/CompanyBranch');

// 28-Oct-2026: Branch / CHA / Financial Year checked before saving (code + name required, codes unique, a branch
// or FY that jobs use cannot be deleted), clear messages instead of raw SQL errors, CHA delete added (it fell to the
// generic route, which does not know cha-master, so delete never worked).
const masterErr = (res, err) => {
    if (err && err.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, error: 'This code already exists' });
    res.status(err.status || 500).json({ success: false, error: err.message });
};
const bad = (msg) => { const e = new Error(msg); e.status = 400; return e; };
// GST state code (first two digits of a GSTIN) -> state short code used on the branches
const GST_STATE = { '01': 'JK', '02': 'HP', '03': 'PB', '04': 'CH', '05': 'UK', '06': 'HR', '07': 'DL', '08': 'RJ', '09': 'UP', '10': 'BR', '11': 'SK', '12': 'AR',
    '13': 'NL', '14': 'MN', '15': 'MZ', '16': 'TR', '17': 'ML', '18': 'AS', '19': 'WB', '20': 'JH', '21': 'OR', '22': 'CG', '23': 'MP', '24': 'GJ', '26': 'DN',
    '27': 'MH', '28': 'AP', '29': 'KA', '30': 'GA', '31': 'LD', '32': 'KL', '33': 'TN', '34': 'PY', '35': 'AN', '36': 'TS', '37': 'AP', '38': 'LA', '97': 'OT' };
function branchBody(b) {
    const v = {};
    if (b.branchCode !== undefined) v.branchCode = String(b.branchCode || '').trim().toUpperCase();
    if (b.branchName !== undefined) v.branchName = String(b.branchName || '').trim().toUpperCase();
    if (b.address !== undefined) v.address = String(b.address || '').trim();
    if (b.status !== undefined) v.status = b.status === 'Inactive' ? 'Inactive' : 'Active';
    if (b.isDefault !== undefined) v.isDefault = !!b.isDefault;
    // 07-Nov-2026: branch GSTIN, phone, e-mail. The GSTIN's first two digits give the branch's GST state.
    if (b.gstin !== undefined) {
        const g = String(b.gstin || '').toUpperCase().replace(/\s/g, '');
        if (g && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(g)) throw bad('GSTIN must be 15 characters, e.g. 07AAACC1234D1Z5');
        v.gstin = g || null;
        if (g) {
            const st = GST_STATE[g.slice(0, 2)];
            if (!st) throw bad('GSTIN state code ' + g.slice(0, 2) + ' is not a valid GST state');
            const want = String(b.stateCode || '').trim().toUpperCase();
            if (want && want !== st) throw bad('GSTIN ' + g + ' is of state ' + st + ' but the branch state is ' + want);
            v.stateCode = st;
        }
    }
    if (b.phone !== undefined) {
        const ph = String(b.phone || '').trim();
        if (ph && !/^[0-9+()\-\s,/]{6,60}$/.test(ph)) throw bad('Phone: digits, + - ( ) and commas only (several numbers can be given, comma separated)');
        v.phone = ph || null;
    }
    if (b.email !== undefined) {
        const em = String(b.email || '').trim().toLowerCase().replace(/\s*[,;]\s*/g, ', ');
        if (em && !em.split(', ').every(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))) throw bad('E-mail is not valid (several addresses can be given, comma separated)');
        v.email = em || null;
    }
    if (b.website !== undefined) {
        let w = String(b.website || '').trim().toLowerCase();
        if (w && !/^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/.test(w)) throw bad('Website is not valid, e.g. www.company.com');
        v.website = w || null;
    }
    if (v.branchCode !== undefined && !/^[A-Z0-9]{2,10}$/.test(v.branchCode)) throw bad('Branch code: 2-10 letters / numbers (e.g. DEL)');
    if (v.branchName !== undefined && !v.branchName) throw bad('Branch name is required');
    if (v.isDefault && v.status === 'Inactive') throw bad('An inactive branch cannot be the default');
    return v;
}

router.get('/company-branches', async (req, res) => {
    try {
        const branches = await CompanyBranch.findAll({ order: [['isDefault', 'DESC'], ['branchCode', 'ASC']] });
        res.json({ success: true, data: branches });
    } catch (err) { masterErr(res, err); }
});

// 16-Nov-2026: two branches with the same name showed as two same entries (e.g. JAIPUR twice in Purchase > Branch)
async function sameNameBranch(name, exceptId, t) {
    const n = String(name || '').trim().toUpperCase();
    if (!n) return null;
    return (await CompanyBranch.findAll({ attributes: ['id', 'branchCode', 'branchName'], transaction: t }))
        .find(b => String(b.id) !== String(exceptId || '') && String(b.branchName || '').trim().toUpperCase() === n) || null;
}

router.post('/company-branches', async (req, res) => {
    try {
        const v = branchBody({ status: 'Active', ...req.body, branchCode: req.body.branchCode || '', branchName: req.body.branchName || '' });
        const branch = await sequelize.transaction(async (t) => {
            const twin = await sameNameBranch(v.branchName, null, t);
            if (twin) throw bad(`Branch name ${v.branchName} is already used by branch ${twin.branchCode}`);
            const first = !(await CompanyBranch.count({ transaction: t }));
            if (v.isDefault || first) { v.isDefault = true; await CompanyBranch.update({ isDefault: false }, { where: {}, transaction: t }); }
            return CompanyBranch.create(v, { transaction: t });
        });
        res.json({ success: true, data: branch });
    } catch (err) { masterErr(res, err); }
});

// kept for old screens: the default is now switched by the save itself (clearing it first left no default when the save failed)
router.put('/company-branches/reset-default', async (req, res) => res.json({ success: true }));

router.put('/company-branches/:id', async (req, res) => {
    try {
        const v = branchBody(req.body || {});
        const branch = await sequelize.transaction(async (t) => {
            const br = await CompanyBranch.findByPk(req.params.id, { transaction: t });
            if (!br) { const e = new Error('Branch not found'); e.status = 404; throw e; }
            if (v.branchName && String(v.branchName).trim().toUpperCase() !== String(br.branchName || '').trim().toUpperCase()) {
                const twin = await sameNameBranch(v.branchName, br.id, t);
                if (twin) throw bad(`Branch name ${v.branchName} is already used by branch ${twin.branchCode}`);
            }
            if (v.branchCode && v.branchCode !== br.branchCode) {
                // job numbers and counters use the code: renaming would split them
                const JobSequence = require('../models/JobSequence');
                if (await JobSequence.count({ where: { branchCode: br.branchCode }, transaction: t })) throw bad(`Branch code ${br.branchCode} is used by the job sequences - it cannot be changed`);
            }
            if (v.isDefault) await CompanyBranch.update({ isDefault: false }, { where: {}, transaction: t });
            if (br.isDefault && v.isDefault === false) throw bad('Make another branch the default first');
            if (br.isDefault && v.status === 'Inactive') throw bad('The default branch cannot be made inactive');
            await br.update(v, { transaction: t });
            return br;
        });
        res.json({ success: true, data: branch });
    } catch (err) { masterErr(res, err); }
});

router.delete('/company-branches/:id', async (req, res) => {
    try {
        const branch = await CompanyBranch.findByPk(req.params.id);
        if (!branch) return res.status(404).json({ success: false, error: 'Branch not found' });
        if (branch.isDefault) return res.status(400).json({ success: false, error: 'The default branch cannot be deleted - make another branch the default first' });
        const used = [];
        try { const { Op } = require('sequelize'); const ImportJob = require('../models/ImportJob'), ExportJob = require('../models/ExportJob');
            const by = (M, codeCol) => [...(M.rawAttributes.branchId ? [{ branchId: branch.id }] : []), ...(M.rawAttributes[codeCol] ? [{ [codeCol]: branch.branchCode }] : [])];
            const n1 = by(ImportJob, 'branchCode').length ? await ImportJob.count({ where: { [Op.or]: by(ImportJob, 'branchCode') } }).catch(() => 0) : 0;
            const n2 = by(ExportJob, 'branchCode').length ? await ExportJob.count({ where: { [Op.or]: by(ExportJob, 'branchCode') } }).catch(() => 0) : 0;
            if (n1 + n2) used.push(`${n1 + n2} job(s)`);
        } catch (e) { /* job tables not there */ }
        if (used.length) return res.status(400).json({ success: false, error: `Branch ${branch.branchCode} is used by ${used.join(', ')} - make it Inactive instead` });
        await branch.destroy();
        res.json({ success: true });
    } catch (err) { masterErr(res, err); }
});

// FINANCIAL YEAR ROUTES
const FinancialYear = require('../models/FinancialYear');

router.get('/financial-years', async (req, res) => {
    try {
        const years = await FinancialYear.findAll({ where: { isDeleted: false }, include: [{ model: require('../models/FinancialPeriod'), as: 'periods', where: { isDeleted: false }, required: false }], order: [['startDate', 'DESC']] });
        res.json({ success: true, data: years });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 28-Oct-2026: dates checked (end after start, at most 12 months, no overlap with another year of the same type),
// month periods built from plain dates (toISOString moved every period one day back on an IST server: 01-Apr became
// 31-Mar) and rebuilt when the dates change, a deleted code can be used again.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ymdOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayOf = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
async function fyCheck(v, selfId) {
    const s = dayOf(v.startDate), e = dayOf(v.endDate);
    if (!s || !e) throw bad('Start and end date are required');
    if (e <= s) throw bad('End date must be after the start date');
    if ((e - s) / 86400000 > 366) throw bad('A year cannot be longer than 12 months');
    const { Op } = require('sequelize');
    const clash = await FinancialYear.findOne({ where: { isDeleted: false, yearType: v.yearType || 'FINANCIAL', id: { [Op.ne]: selfId || 0 }, startDate: { [Op.lte]: ymdOf(e) }, endDate: { [Op.gte]: ymdOf(s) } } });
    if (clash) throw bad(`Dates overlap year ${clash.code} (${clash.startDate} to ${clash.endDate})`);
}
async function buildPeriods(fy, t) {
    const FinancialPeriod = require('../models/FinancialPeriod');
    const closed = new Set((await FinancialPeriod.findAll({ where: { financialYearId: fy.id, isClosed: true }, transaction: t })).map(p => p.periodName)); // keep months locked
    await FinancialPeriod.destroy({ where: { financialYearId: fy.id }, transaction: t });
    const start = dayOf(fy.startDate), end = dayOf(fy.endDate);
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    for (let no = 1; cur <= end && no <= 12; no++) {
        const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        const pStart = cur < start ? start : cur;
        const last = new Date(next.getFullYear(), next.getMonth(), 0);
        const pEnd = last > end ? end : last;
        await FinancialPeriod.create({ financialYearId: fy.id, periodName: `${MON[pStart.getMonth()]}-${pStart.getFullYear()}`, periodNo: no, startDate: ymdOf(pStart), endDate: ymdOf(pEnd), isClosed: closed.has(`${MON[pStart.getMonth()]}-${pStart.getFullYear()}`) }, { transaction: t });
        cur = next;
    }
}
function fyBody(b) {
    const v = {};
    for (const f of ['code', 'name', 'startDate', 'endDate', 'yearType']) if (b[f] !== undefined) v[f] = String(b[f] || '').trim();
    for (const f of ['isActive', 'isDefault', 'isClosed']) if (b[f] !== undefined) v[f] = !!b[f];
    if (v.code !== undefined) { v.code = v.code.toUpperCase(); if (!/^[A-Z0-9/-]{2,12}$/.test(v.code)) throw bad('Code: 2-12 letters / numbers, e.g. 26-27'); }
    if (v.name !== undefined && !v.name) throw bad('Name is required');
    if (v.yearType !== undefined && !v.yearType) v.yearType = 'FINANCIAL';
    if (v.isDefault && v.isClosed) throw bad('A closed year cannot be the default');
    if (v.isDefault) v.isActive = true;
    return v;
}

router.post('/financial-years', async (req, res) => {
    try {
        const v = fyBody({ yearType: 'FINANCIAL', isActive: true, ...req.body, code: req.body.code || '', name: req.body.name || '' });
        await fyCheck(v);
        const fy = await sequelize.transaction(async (t) => {
            const old = await FinancialYear.findOne({ where: { code: v.code }, transaction: t });
            if (old && !old.isDeleted) throw bad(`Year code ${v.code} already exists`);
            const first = !(await FinancialYear.count({ where: { isDeleted: false }, transaction: t }));
            if (v.isDefault || first) { v.isDefault = true; await FinancialYear.update({ isDefault: false }, { where: {}, transaction: t }); }
            let row;
            if (old) { await old.update({ ...v, isDeleted: false }, { transaction: t }); row = old; } // a deleted year with this code: use it again
            else row = await FinancialYear.create(v, { transaction: t });
            await buildPeriods(row, t);
            return row;
        });
        res.json({ success: true, data: fy });
    } catch (err) { masterErr(res, err); }
});

router.put('/financial-years/:id', async (req, res) => {
    try {
        const fy = await FinancialYear.findByPk(req.params.id);
        if (!fy || fy.isDeleted) return res.status(404).json({ success: false, error: 'Financial year not found' });
        const v = fyBody(req.body || {});
        const merged = { startDate: fy.startDate, endDate: fy.endDate, yearType: fy.yearType, ...v };
        await fyCheck(merged, fy.id);
        if (fy.isDefault && v.isDefault === false) throw bad('Make another year the default first');
        if (fy.isDefault && v.isClosed) throw bad('The default year cannot be closed - make another year the default first');
        const datesChanged = String(merged.startDate) !== String(fy.startDate) || String(merged.endDate) !== String(fy.endDate);
        await sequelize.transaction(async (t) => {
            if (v.isDefault) await FinancialYear.update({ isDefault: false }, { where: {}, transaction: t });
            await fy.update(v, { transaction: t });
            if (datesChanged) await buildPeriods(fy, t);
        });
        res.json({ success: true, data: fy });
    } catch (err) { masterErr(res, err); }
});

router.delete('/financial-years/:id', async (req, res) => {
    try {
        const fy = await FinancialYear.findByPk(req.params.id);
        if(!fy || fy.isDeleted) return res.status(404).json({ success: false, error: 'Financial year not found' });
        if (fy.isDefault) return res.status(400).json({ success: false, error: 'The default year cannot be deleted - make another year the default first' });
        try {
            const ExportJob = require('../models/ExportJob'), ImportJob = require('../models/ImportJob');
            const n = (ExportJob.rawAttributes.financialYearId ? await ExportJob.count({ where: { financialYearId: fy.id } }) : 0)
                + (ImportJob.rawAttributes.financialYearId ? await ImportJob.count({ where: { financialYearId: fy.id } }) : 0);
            if (n) return res.status(400).json({ success: false, error: `${n} job(s) are in year ${fy.code} - close the year instead of deleting it` });
        } catch (e) { /* job tables not there */ }
        
        await fy.update({ isDeleted: true });
        
        const FinancialPeriod = require('../models/FinancialPeriod');
        await FinancialPeriod.update({ isDeleted: true }, { where: { financialYearId: fy.id } });
        
        res.json({ success: true });
    } catch (err) { masterErr(res, err); }
});





// CHA MASTER ROUTES
const ChaMaster = require('../models/ChaMaster');
function chaBody(b) {
    const v = {};
    for (const f of ['chaCode', 'chaLicense', 'chaName', 'chaAddress', 'chaCity', 'chaPin', 'chaGstin', 'chaPhone', 'chaEmail']) if (b[f] !== undefined) v[f] = String(b[f] == null ? '' : b[f]).trim();
    for (const f of ['chaCode', 'chaLicense', 'chaName', 'chaCity', 'chaGstin']) if (v[f]) v[f] = v[f].toUpperCase();
    if (b.isDefault !== undefined) v.isDefault = !!b.isDefault;
    // CHA code as filed in ICEGATE: PAN-based, e.g. AAACC1234DCH001 (letters / numbers, up to 15)
    if (v.chaCode !== undefined && !/^[A-Z0-9]{3,15}$/.test(v.chaCode)) throw bad('CHA code: up to 15 letters / numbers (e.g. AAACC1234DCH001)');
    if (v.chaName !== undefined && !v.chaName) throw bad('CHA name is required');
    if (v.chaPin && !/^\d{6}$/.test(v.chaPin)) throw bad('PIN code must be 6 digits');
    if (v.chaGstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v.chaGstin)) throw bad('GSTIN must be 15 characters like 07AAACC1234D1Z5');
    if (v.chaEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.chaEmail)) throw bad('Email is not valid');
    return v;
}
router.get('/cha-master', async (req, res) => {
    try { res.json({ success: true, data: await ChaMaster.findAll({ order: [['isDefault', 'DESC'], ['chaName', 'ASC']] }) }); }
    catch (err) { masterErr(res, err); }
});
router.post('/cha-master', async (req, res) => {
    try {
        const v = chaBody({ ...req.body, chaCode: req.body.chaCode || '', chaName: req.body.chaName || '' });
        const row = await sequelize.transaction(async (t) => {
            const first = !(await ChaMaster.count({ transaction: t }));
            if (v.isDefault || first) { v.isDefault = true; await ChaMaster.update({ isDefault: false }, { where: {}, transaction: t }); }
            return ChaMaster.create(v, { transaction: t });
        });
        res.json({ success: true, data: row });
    } catch (err) { masterErr(res, err); }
});
router.put('/cha-master/reset-default', async (req, res) => res.json({ success: true })); // the save switches the default (28-Oct-2026)
router.put('/cha-master/:id', async (req, res) => {
    try {
        const v = chaBody(req.body || {});
        const cha = await ChaMaster.findByPk(req.params.id);
        if (!cha) return res.status(404).json({ success: false, error: 'CHA not found' });
        await sequelize.transaction(async (t) => {
            if (v.isDefault) await ChaMaster.update({ isDefault: false }, { where: {}, transaction: t });
            await cha.update(v, { transaction: t });
        });
        res.json({ success: true, data: cha });
    } catch (err) { masterErr(res, err); }
});
router.delete('/cha-master/:id', async (req, res) => {
    try {
        const cha = await ChaMaster.findByPk(req.params.id);
        if (!cha) return res.status(404).json({ success: false, error: 'CHA not found' });
        await cha.destroy();
        if (cha.isDefault) { const next = await ChaMaster.findOne({ order: [['id', 'ASC']] }); if (next) await next.update({ isDefault: true }); }
        res.json({ success: true });
    } catch (err) { masterErr(res, err); }
});

// JOB SEQUENCE ROUTES
const JobSequence = require('../models/JobSequence');
const jobSeq = require('../utils/jobSequence');
router.get('/job-sequences', async (req, res) => {
    try { res.json({ success: true, data: await JobSequence.findAll() }); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /job-sequences/status?branchCode=DEL&financialYearId=3 - per job mode: the counter, the next job no (numbers
// already used are skipped) and the last job no given with this prefix. Used by Settings > Sequence Config. 28-Oct-2026
router.get('/job-sequences/status', async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const ImportJob = require('../models/ImportJob'), ExportJob = require('../models/ExportJob');
        const branchCode = await jobSeq.branchCodeOf({ branchCode: req.query.branchCode });
        const fy = await jobSeq.fyOf(req.query.financialYearId);
        const out = [];
        for (const jobMode of jobSeq.MODES) {
            const row = await jobSeq.findRow(branchCode, jobMode, req.query.financialYearId);
            const p = await jobSeq.peek({ branchCode, jobMode, financialYearId: req.query.financialYearId });
            const pre = jobSeq.render(p.prefix, '', { branchCode, fy });
            const M = jobMode.endsWith('EXPORT') ? ExportJob : ImportJob;
            const last = pre ? await M.findOne({ where: { jobNo: { [Op.like]: pre + '%' } }, order: [['id', 'DESC']], attributes: ['jobNo', 'createdAt'] }) : null;
            out.push({ jobMode, configured: !!row, legacy: !!(row && row.jobMode !== jobMode), prefix: p.prefix, startNumber: row ? row.startNumber : 1001,
                nextNumber: p.nextNumber, nextJobNo: p.nextJobNo, lastJobNo: last ? last.jobNo : null, lastAt: last ? last.createdAt : null });
        }
        res.json({ success: true, branchCode, fyCode: fy ? fy.code : null, data: out });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /job-sequences [{ branchCode, jobMode, prefix, startNumber }] - checked first, then all saved together.
// A start number whose job no is already used is refused (it would give duplicate job numbers). 28-Oct-2026
router.post('/job-sequences', async (req, res) => {
    try {
        const list = Array.isArray(req.body) ? req.body : (req.body && Array.isArray(req.body.sequences) ? req.body.sequences : null);
        if (!list || !list.length) return res.status(400).json({ success: false, message: 'Nothing to save' });
        const fy = await jobSeq.fyOf(req.query.financialYearId || (req.body && req.body.financialYearId));
        const errors = [], clean = [];
        for (const s of list) {
            const branchCode = String(s.branchCode || '').trim().toUpperCase();
            const jobMode = String(s.jobMode || '').trim().toUpperCase();
            const prefix = String(s.prefix || '').trim();
            const n = Number(s.startNumber);
            if (!branchCode) { errors.push('Branch is missing'); continue; }
            if (!jobSeq.MODES.includes(jobMode)) { errors.push(`${jobMode || '?'}: unknown job mode`); continue; }
            if (!prefix) errors.push(`${jobMode}: prefix is empty`);
            else if (prefix.length > 20) errors.push(`${jobMode}: prefix is longer than 20 characters`);
            else if (!/^[A-Za-z0-9/\-_.{}]+$/.test(prefix)) errors.push(`${jobMode}: prefix can have only letters, numbers, / - _ . and {BR} {FY} {YY}`);
            if (!Number.isInteger(n) || n < 1 || n > 99999999) errors.push(`${jobMode}: start number must be a whole number from 1 to 99999999`);
            clean.push({ branchCode, jobMode, prefix, startNumber: n });
        }
        if (errors.length) return res.status(400).json({ success: false, message: errors.join('; '), errors });
        // the same prefix on two modes would give the same job numbers
        const seen = {};
        for (const c of clean) {
            const k = c.branchCode + '|' + jobSeq.render(c.prefix, '', { branchCode: c.branchCode, fy }).toUpperCase();
            if (seen[k]) errors.push(`${c.jobMode} and ${seen[k]} have the same prefix`); else seen[k] = c.jobMode;
        }
        for (const c of clean) {
            const ctx = { branchCode: c.branchCode, fy };
            const cur = await jobSeq.findRow(c.branchCode, c.jobMode, null);
            if (cur && cur.jobMode === c.jobMode && cur.prefix === c.prefix && Number(cur.startNumber) === c.startNumber) continue; // not changed: used numbers are skipped anyway
            const jn = jobSeq.render(c.prefix, c.startNumber, ctx);
            if (await jobSeq.jobNoTaken(jn)) errors.push(`${c.jobMode}: job no ${jn} is already used - next free number is ${await jobSeq.firstFree(c.prefix, c.startNumber, ctx)}`);
        }
        if (errors.length) return res.status(409).json({ success: false, message: errors.join('; '), errors });
        const { sequelize } = require('../db');
        await sequelize.transaction(async (t) => {
            for (const c of clean) {
                const row = await jobSeq.findRow(c.branchCode, c.jobMode, null, { transaction: t });
                if (row && row.jobMode === c.jobMode) await row.update({ prefix: c.prefix, startNumber: c.startNumber }, { transaction: t });
                else await JobSequence.create(c, { transaction: t });
            }
        });
        res.json({ success: true, saved: clean.length });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:category', async (req, res) => {

  try {
    const category = req.params.category.toLowerCase();
    if (category === 'specialhandlingcodes') return res.json(SPH_CODES);
    await ensureSwitch(category);
    const Model = getModel(category);
    if (!Model) return res.status(404).json({ error: 'Master category not found' });

    let data;
    const includeOptions = Model.name === 'Party' ? [
        { model: require('../models/PartyBranch'), as: 'branches' },
        { model: require('../models/PartyADCode'), as: 'adCodes' },
        { model: require('../models/PartyDrawbackAccount'), as: 'drawbackAccounts' }
    ] : [];
    if (category === 'parties' && !req.query.type && !req.query.q) {
        const pc = await partyCacheReady();
        const compact = req.query.compact === '1';
        res.set('Content-Type', 'application/json; charset=utf-8');
        res.set('Cache-Control', 'no-store');
        if (/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) { res.set('Content-Encoding', 'gzip'); res.set('Vary', 'Accept-Encoding'); return res.send(compact ? pc.cgz : pc.gz); }
        return res.send(compact ? pc.cjson : pc.json);
    }
    if (category === 'shippers') {
        data = await Model.findAll({ where: { isShipper: true }, include: includeOptions });
    } else if (category === 'consignees') {
        data = await Model.findAll({ where: { isConsignee: true }, include: includeOptions });
    } else if (category === 'agents') {
        data = await Model.findAll({ where: { isOverseasAgent: true }, include: includeOptions });
    } else if (category === 'subagents') {
        data = await Model.findAll({ where: { isSubAgent: true }, include: includeOptions });
    } else if (['rodteps', 'rosctls', 'drawbacks', 'licenses', 'shippinglines'].includes(category) && !req.query.all) {
        // 04-Nov-2026: job screens get active rows only (old RoDTEP codes, the Special-AA drawback table, demo
        // licences are inactive); the master screens ask for ?all=1
        data = await Model.findAll({ where: { isActive: true } });
    } else if (category === 'airlines' && !req.query.all) {
        // 04-Nov-2026: job / AWB screens get airlines not marked INACTIVE (duplicate prefixes were switched off);
        // the Airline master screen and the reports ask for ?all=1
        const { Op } = require('sequelize');
        data = await Model.findAll({ where: { [Op.or]: [{ status: null }, { status: { [Op.ne]: 'INACTIVE' } }] } });
    } else if (SWITCHABLE[category] && !req.query.all) {
        // 22-Nov-2026: job / AWB screens get the rows not switched off; the master screens ask for ?all=1
        const { Op } = require('sequelize');
        data = await Model.findAll({ where: { [Op.or]: [{ isActive: null }, { isActive: true }] } });
    } else if (category === 'ports' && !req.query.all) {
        // 04-Nov-2026: job screens get active ports only; the Port master screen asks for ?all=1
        data = await Model.findAll({ where: { isActive: true } });
    } else {
        data = await Model.findAll({ include: includeOptions });
    }
      res.json(data);
    } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seed basic masters for testing
router.post('/seed', async (req, res) => {
    try {
        const AeoMaster = require('../models/AeoMaster');
        await AeoMaster.bulkCreate([
            { aeoCode: 'AEOIN12345678', aeoRole: 'EX', countryCode: 'IN', countryName: 'INDIA' },
            { aeoCode: 'AEOUS99999999', aeoRole: 'IM', countryCode: 'US', countryName: 'UNITED STATES' },
            { aeoCode: 'AEOGB11111111', aeoRole: 'CH', countryCode: 'GB', countryName: 'UNITED KINGDOM' }
        ], {});

        await Airport.bulkCreate([
            { code: 'DEL', name: 'Indira Gandhi International Airport', countryCode: 'IN' },
            { code: 'JFK', name: 'John F. Kennedy International Airport', countryCode: 'US' },
            { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj', countryCode: 'IN' }
        ], {});

        await Airline.bulkCreate([
            { code: 'AM', name: 'AEROMEXICO', prefix: '139' },
            { code: 'EK', name: 'EMIRATES', prefix: '176' }
        ], {});

        await Currency.bulkCreate([
            { code: 'INR', name: 'Indian Rupee' },
            { code: 'USD', name: 'US Dollar' }
        ], {});

        await Country.bulkCreate([
            { code: 'IN', name: 'India' },
            { code: 'US', name: 'United States' }
        ], {});

        await Party.bulkCreate([
            { partyType: 'SHIPPER', code: 'SHP001', name: 'COMMITTED EXPORTS', street: 'Phase 1', city: 'Delhi', state: 'DL', country: 'IN', zip: '110020' },
            { partyType: 'CONSIGNEE', code: 'CON001', name: 'GLOBAL IMPORTS INC', street: '5th Ave', city: 'New York', state: 'NY', country: 'US', zip: '10001' },
            { partyType: 'AGENT', code: 'AGT001', name: 'IATA FREIGHT AGENT', city: 'Delhi', country: 'IN' }
        ], {});

        res.json({ message: 'All dedicated Master data seeded successfully!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});




// Explicit POST /api/masters/parties with Zod validation
router.post('/parties', async (req, res) => {
    try {
        // Run Zod validation
        const validatedData = partySchema.parse(req.body);
        
        // Save to Unified Party Master via Sequelize
        if (validatedData.code === '') validatedData.code = null;
          
        // Check for duplicates
        const existingParty = await Party.findOne({ where: { name: validatedData.name } });
        if (existingParty) {
            return res.status(400).json({ error: 'DUPLICATE_PARTY', message: 'A party with this name already exists in the database!' });
        }

        const newParty = await Party.create(validatedData);
          
          const PartyBranch = require('../models/PartyBranch');
          if (PartyBranch) {
              if (req.body.branches && Array.isArray(req.body.branches) && req.body.branches.length > 0) {
                  const branchesToInsert = req.body.branches.map(({ id, createdAt, updatedAt, ...b }) => ({
                      ...b,
                      partyId: newParty.id,
                      isDefault: b.isDefault !== undefined ? !!b.isDefault : !!b.default,
                      branchSrNo: b.branchSrNo || '1',
                      branchName: b.branchName || b.branch || 'DEFAULT',
                      address1: b.address1 || '',
                      address2: b.address2 || '',
                      city: b.city || '',
                      state: b.state || '',
                      country: b.countryCode || b.country || 'IN',
                        email1: b.email1 || b.email || '',
                      pinCode: b.pinCode || b.zip || '',
                      phone: b.phone || '',
                      regNo: b.regNo || b.gstin || '',
                        ctxType: b.ctxType || null,
                        ctxState: b.ctxState || null
                  }));
                  await PartyBranch.bulkCreate(branchesToInsert);
              } else {
                  await PartyBranch.create({
                      partyId: newParty.id,
                      branchSrNo: '1',
                      branchName: 'DEFAULT',
                      address1: newParty.street || '',
                      address2: '',
                      city: newParty.city || '',
                      state: newParty.stateProvince || '',
                      country: newParty.countryCode || 'IN', // fix 28-Oct-2026: PartyBranch column is 'country'
                      pinCode: newParty.zipPostcode || '',
                      phone: newParty.phoneNumber || '',
                      regNo: newParty.taxId || ''
                  });
              }
            }

            if (req.body.adCodes && Array.isArray(req.body.adCodes) && req.body.adCodes.length > 0) {
                const PartyADCode = require('../models/PartyADCode');
                const adCodesToInsert = req.body.adCodes.map(a => ({ ...a, partyId: newParty.id }));
                await PartyADCode.bulkCreate(adCodesToInsert);
            }

            if (req.body.drawbackAccounts && Array.isArray(req.body.drawbackAccounts) && req.body.drawbackAccounts.length > 0) {
                const PartyDrawbackAccount = require('../models/PartyDrawbackAccount');
                const dbkToInsert = req.body.drawbackAccounts.map(d => ({ ...d, partyId: newParty.id }));
                await PartyDrawbackAccount.bulkCreate(dbkToInsert);
            }
            
            const fullParty = await Party.findByPk(newParty.id, { 
                include: [
                    { model: PartyBranch, as: 'branches' },
                    { model: require('../models/PartyADCode'), as: 'adCodes' },
                    { model: require('../models/PartyDrawbackAccount'), as: 'drawbackAccounts' }
                ] 
            });
            res.status(201).json({ success: true, data: fullParty });
    } catch (err) {
        if (err.name === 'ZodError') {
            const errs = (err.issues || err.errors || []).map(e => `${(e.path || []).join('.').toUpperCase()}: ${e.message}`);
            return res.status(400).json({ error: errs.join(', ') });
        }
        if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
              const errs = err.errors.map(e => e.message);
              return res.status(400).json({ error: errs.join(', ') });
          }
          res.status(400).json({ error: err.errors ? err.errors.map(e=>e.message).join(', ') : err.message });
    }
});

// POST /api/masters/:category
router.post('/:category', async (req, res) => {
  try {
    const category = req.params.category.toLowerCase();
    await ensureSwitch(category);
    const Model = getModel(category);
    if (!Model) return res.status(404).json({ error: 'Master category not found' });
    if (category === 'parties') {
        const reqd = req.body.iecNoReqd;
        if (reqd === true || reqd === 'true') {
            const iec = req.body.taxId;
            if (!iec || iec.length !== 10 || !/^[a-zA-Z0-9]{10}$/.test(iec)) {
                return res.status(400).json({ error: "IEC Number must be exactly 10 alphanumeric characters when IEC NO. REQD. is checked." });
            }
        }
    }

    let payload = cleanBody(Model, req.body);
    if (category === 'shippers') payload.isShipper = true;
    if (category === 'consignees') payload.isConsignee = true;
    if (category === 'agents') payload.isOverseasAgent = true;
    if (category === 'subagents') payload.isSubAgent = true;
    
    const newItem = await Model.create(payload);
    res.status(201).json(newItem);
  } catch (err) {
    sendErr(res, err);
  }
});

// PUT /api/masters/:category/:id
router.put('/:category/:id', async (req, res) => {
  try {
    const category = req.params.category.toLowerCase();
    await ensureSwitch(category);
    const Model = getModel(category);
    if (!Model) return res.status(404).json({ error: 'Master category not found' });
    if (category === 'parties') {
        const reqd = req.body.iecNoReqd;
        if (reqd === true || reqd === 'true') {
            const iec = req.body.taxId;
            if (!iec || iec.length !== 10 || !/^[a-zA-Z0-9]{10}$/.test(iec)) {
                return res.status(400).json({ error: "IEC Number must be exactly 10 alphanumeric characters when IEC NO. REQD. is checked." });
            }
        }
    }

    const pk = Model.primaryKeyAttribute || 'id';
    const upd = cleanBody(Model, req.body, { keepPk: false });
    if (category === 'parties') { delete upd.kycStatus; delete upd.kycApproved; delete upd.kycLastSentAt; } // only through KYC approval (28-Oct-2026)
    const updated = await Model.update(upd, { where: { [pk]: req.params.id } });
    if (updated[0] === 0) return res.status(404).json({ error: 'Item not found' });
    
    // Check if updating parties with branches
    if (category === 'parties' && req.body.branches && Array.isArray(req.body.branches)) {
        const PartyBranch = require('../models/PartyBranch');
        await PartyBranch.destroy({ where: { partyId: req.params.id } });
        const branchesToInsert = req.body.branches.map(({ id, createdAt, updatedAt, ...b }) => ({
            ...b,
              partyId: req.params.id,
            branchSrNo: b.branchSrNo || '1',
            branchName: b.branchName || b.branch || 'DEFAULT',
            address1: b.address1 || '',
            address2: b.address2 || '',
            city: b.city || '',
            state: b.state || '',
            country: b.country || b.countryCode || 'IN',
              email1: b.email1 || b.email || '',
            pinCode: b.pinCode || b.zip || '', // 28-Oct-2026: the old zip copy won over the edited PIN
            isDefault: b.isDefault !== undefined ? !!b.isDefault : !!b.default,
            phone: b.phone || '',
            regNo: b.regNo || b.gstin || ''
        }));
        await PartyBranch.bulkCreate(branchesToInsert);
    }
    
    // Check if updating parties with adCodes
    if (category === 'parties' && req.body.adCodes && Array.isArray(req.body.adCodes)) {
        const PartyADCode = require('../models/PartyADCode');
        await PartyADCode.destroy({ where: { partyId: req.params.id } });
        const adCodesToInsert = req.body.adCodes.map(a => ({ ...a, partyId: req.params.id }));
        await PartyADCode.bulkCreate(adCodesToInsert);
    }
    
    // Check if updating parties with drawbackAccounts
    if (category === 'parties' && req.body.drawbackAccounts && Array.isArray(req.body.drawbackAccounts)) {
        const PartyDrawbackAccount = require('../models/PartyDrawbackAccount');
        await PartyDrawbackAccount.destroy({ where: { partyId: req.params.id } });
        const dbkToInsert = req.body.drawbackAccounts.map(d => ({ ...d, partyId: req.params.id }));
        await PartyDrawbackAccount.bulkCreate(dbkToInsert);
    }
    
    const includeConfig = category === 'parties' ? [
        { model: require('../models/PartyBranch'), as: 'branches' },
        { model: require('../models/PartyADCode'), as: 'adCodes' },
        { model: require('../models/PartyDrawbackAccount'), as: 'drawbackAccounts' }
    ] : undefined;
    const updatedItem = await Model.findByPk(req.params.id, { include: includeConfig });
    res.json(updatedItem);
  } catch (err) {
    sendErr(res, err);
  }
});

// DELETE /api/masters/:category/:id
router.delete('/:category/:id', async (req, res) => {
  try {
    const category = req.params.category.toLowerCase();
    await ensureSwitch(category);
    const Model = getModel(category);
    if (!Model) return res.status(404).json({ error: 'Master category not found' });

    const pk = Model.primaryKeyAttribute || 'id';
    const deleted = await Model.destroy({ where: { [pk]: req.params.id } });
    if (!deleted) return res.status(404).json({ error: 'Item not found' });
    
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    sendErr(res, err, 500);
  }
});


// POST /api/masters/party/:id/kyc
router.post('/party/:id/kyc', upload.array('docs', 10), async (req, res) => {
    try {
        const partyId = req.params.id;
        const party = await Party.findByPk(partyId);
        if (!party) return res.status(404).json({ error: 'Party not found' });

        const uploadedDocs = [];
        if (req.files) {
            for (let file of req.files) {
                const doc = await PartyDocument.create({
                    partyId: partyId,
                    fileName: file.filename,
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    filePath: `/uploads/kyc/${file.filename}`,
                    size: file.size,
                    documentType: req.body.documentType || 'OTHER'
                });
                uploadedDocs.push(doc);
            }
        }

        if (uploadedDocs.length > 0) {
            try {
                // Update party status to pending whenever new docs are uploaded
                await Party.update({ kycStatus: 'PENDING', kycLastSentAt: new Date() }, { where: { id: partyId } });
                party.kycStatus = 'PENDING';
                
                let attachments = uploadedDocs.map(doc => ({
                    filename: doc.originalName,
                    path: path.join(__dirname, '..', doc.filePath)
                }));
                
                // signed links that work from the e-mail without login (they pointed to localhost, behind login). 28-Oct-2026
                const base = appBase(req);
                const kexp = Math.floor(Date.now() / 1000) + 14 * 86400;
                const kycLink = (docId, action) => `${base}/api/kyc-action/${docId}?action=${action}&exp=${kexp}&sig=${kycSig(docId, action, kexp)}`;

                let mailOptions = {
                    from: '"EDI Automation System" <no-reply@committedcargo.com>',
                    to: 'acctshead@committedgroup.com',
                    subject: `Action Required: KYC Approval for ${party.name}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                            <div style="background-color: #0284c7; padding: 25px; text-align: center; color: white;">
                                <h2 style="margin: 0; font-size: 24px; letter-spacing: 1px;">KYC Document Approval</h2>
                            </div>
                            <div style="padding: 30px; background-color: #ffffff;">
                                <p style="font-size: 16px;">Dear Anil Gupta,</p>
                                <p style="font-size: 15px; line-height: 1.5;">New KYC documents have been uploaded for the following party and require your review:</p>
                                
                                <table style="width: 100%; border-collapse: collapse; margin: 25px 0; background-color: #f8fafc; border-radius: 6px; overflow: hidden;">
                                    <tr>
                                        <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; color: #475569; width: 120px;"><strong>Party Name:</strong></td>
                                        <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a; font-size: 16px;">${party.name}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; color: #475569;"><strong>Country Code:</strong></td>
                                        <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${party.countryCode || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; color: #475569;"><strong>Uploaded Docs:</strong></td>
                                        <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${uploadedDocs.length} file(s)</td>
                                    </tr>
                                </table>
                                
                                <p style="font-size: 15px; line-height: 1.5; margin-bottom: 25px;">Please review the attached documents and approve/reject them individually below:</p>
                                
                                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                                    <tr style="background-color: #f1f5f9;">
                                        <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left;">Document Type</th>
                                        <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left;">File Name</th>
                                        <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">Action</th>
                                    </tr>
                                    ${uploadedDocs.map(doc => `
                                        <tr>
                                            <td style="padding: 10px; border: 1px solid #cbd5e1;">${doc.documentType}</td>
                                            <td style="padding: 10px; border: 1px solid #cbd5e1;">${doc.originalName}</td>
                                            <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">
                                                <a href="${kycLink(doc.id, 'APPROVED')}" style="background-color: #16a34a; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 12px; margin-right: 5px;">APPROVE</a>
                                                <a href="${kycLink(doc.id, 'REJECTED')}" style="background-color: #dc2626; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 12px;">REJECT</a>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </table>
                            </div>
                            <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
                                <p style="margin: 0; line-height: 1.5;">This is an automated message from the EDI Automation System.<br/>Please do not reply to this email.</p>
                            </div>
                        </div>
                    `,
                    attachments: attachments
                };
                
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('Error sending KYC email:', error);
                    } else {
                        console.log('KYC Email sent:', info.messageId);
                    }
                });
            } catch (mailErr) {
                console.error("Failed to prepare email:", mailErr);
            }
        }
        res.json({ success: true, documents: uploadedDocs });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/masters/party/:id/kyc
router.get('/party/:id/kyc', async (req, res) => {
    try {
        const docs = await PartyDocument.findAll({ where: { partyId: req.params.id } });
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/masters/party/kyc/:docId
router.delete('/party/kyc/:docId', async (req, res) => {
    try {
        const doc = await PartyDocument.findByPk(req.params.docId);
        if (!doc) return res.status(404).json({ error: 'Document not found' });
        
        const fullPath = path.join(__dirname, '../', doc.filePath);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        
        await doc.destroy();
        await refreshKycStatus(doc.partyId).catch(() => {});
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// KYC APPROVAL (28-Oct-2026)
// - from the e-mail: GET /api/kyc-action/:docId?action=APPROVED|REJECTED&sig=... (signed, no login; mounted in
//   server.js before the login check). The old links were behind login (401) and pointed to localhost;
// - from the screen: PUT /api/masters/party/kyc/:docId/status { status } (admin);
// - the party's kycStatus / kycApproved follow its documents.
const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function setKycDoc(docId, status) {
    const doc = await PartyDocument.findByPk(docId);
    if (!doc) return null;
    await doc.update({ docStatus: status });
    const partyStatus = await refreshKycStatus(doc.partyId);
    return { doc, partyStatus };
}
async function publicKycAction(req, res) {
    try {
        const action = String(req.query.action || '').toUpperCase();
        const sig = String(req.query.sig || '');
        if (!['APPROVED', 'REJECTED'].includes(action)) return res.status(400).send('Invalid action');
        const exp = parseInt(req.query.exp, 10) || 0;
        if (exp && exp * 1000 < Date.now()) return res.status(410).send('This KYC link has expired. Please open the party in EagleView ERP.');
        if (!exp && Date.now() > KYC_LEGACY_UNTIL) return res.status(410).send('This KYC link is too old. Please open the party in EagleView ERP.');
        const good = kycSig(req.params.docId, action, exp);
        if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return res.status(403).send('This KYC link is not valid. Please open the party in EagleView ERP.');
        const r = await setKycDoc(req.params.docId, action);
        if (!r) return res.status(404).send('Document not found');
        const ok = action === 'APPROVED';
        res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>KYC ${action}</title></head>
<body style="font-family:Arial,sans-serif;text-align:center;padding:50px;background:#f3f4f6">
<div style="background:#fff;display:inline-block;padding:36px 44px;border-radius:14px;box-shadow:0 10px 25px rgba(0,0,0,.08)">
<div style="font-size:60px;color:${ok ? '#16a34a' : '#dc2626'}">${ok ? '&#10004;' : '&#10008;'}</div>
<h1 style="color:${ok ? '#16a34a' : '#dc2626'}">Document ${ok ? 'Approved' : 'Rejected'}</h1>
<p style="font-size:16px;color:#333">${escHtml(r.doc.originalName)} is now <b>${action}</b>.</p>
<p style="color:#555">Party KYC status: <b>${r.partyStatus}</b></p>
<p style="color:#888;margin-top:24px">You can close this window.</p></div></body></html>`);
    } catch (err) {
        res.status(500).send('Error updating status');
    }
}
router.put('/party/kyc/:docId/status', async (req, res) => {
    try {
        if (String((req.user && req.user.role) || '').toLowerCase() !== 'admin') return res.status(403).json({ error: 'Only an admin can approve KYC' });
        const status = String((req.body && req.body.status) || '').toUpperCase();
        if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) return res.status(400).json({ error: 'status must be APPROVED, REJECTED or PENDING' });
        const r = await setKycDoc(req.params.docId, status);
        if (!r) return res.status(404).json({ error: 'Document not found' });
        res.json({ success: true, document: r.doc, partyKycStatus: r.partyStatus });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
module.exports.publicKycAction = publicKycAction;
module.exports.cleanBody = cleanBody;
module.exports.clearPartyCache = clearPartyCache;

