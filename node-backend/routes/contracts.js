// /api/contracts - Customer Contract & Quotation master. Added 28-Oct-2026.
//
// A contract = header (party, validity, currency, status, terms) + freight rate rows + charge rules + transport rates.
// Save replaces the rows of the contract in one transaction. Status flow: Draft -> Pending Approval -> Active
// (admin approves) or back to Draft (admin rejects). An Active contract can only be changed by an admin; changing it
// sends it back to Pending Approval. Contract numbers: CONT/<YY>/<0001>, given by the server.
const express = require('express');
const { Op, QueryTypes } = require('sequelize');
const { sequelize } = require('../db');
const { CustomerContract, ContractFreightRate, ContractCharge, ContractTransportRate } = require('../models/Contract');

const router = express.Router();
const isAdmin = (req) => String((req.user && req.user.role) || '').toLowerCase() === 'admin';
const who = (req) => (req.user && (req.user.username || req.user.email)) || 'user';
let synced = null;
const ready = () => (synced = synced || (async () => {
    await CustomerContract.sync(); await ContractFreightRate.sync(); await ContractCharge.sync(); await ContractTransportRate.sync();
    // 08-Nov-2026: sync() does not add columns to a table that already exists - and these tables were first made by an
    // older model (no rate / normal / +45... / amount columns), so the rates typed in were silently dropped on save.
    // Every column of the model that the table lacks is added here.
    for (const M of [CustomerContract, ContractFreightRate, ContractCharge, ContractTransportRate]) {
        const t = M.getTableName(); const have = new Set((await sequelize.query(`PRAGMA table_info(${t})`, { type: QueryTypes.SELECT })).map(x => x.name));
        for (const [k, a] of Object.entries(M.rawAttributes)) {
            const col = a.field || k; if (have.has(col)) continue;
            const key = String(a.type && a.type.key || '');
            const ty = /DECIMAL|FLOAT|DOUBLE|REAL/.test(key) ? 'REAL' : /INTEGER|BOOLEAN/.test(key) ? 'INTEGER' : /DATE/.test(key) ? 'TEXT' : 'TEXT';
            const def = a.defaultValue !== undefined && typeof a.defaultValue !== 'object' && typeof a.defaultValue !== 'function' ? ` DEFAULT ${typeof a.defaultValue === 'string' ? "'" + a.defaultValue.replace(/'/g, "''") + "'" : (a.defaultValue === true ? 1 : a.defaultValue === false ? 0 : a.defaultValue)}` : '';
            await sequelize.query(`ALTER TABLE ${t} ADD COLUMN ${col} ${ty}${def}`);
        }
    }
})().catch(e => { synced = null; throw e; }));
// 08-Nov-2026: a contract bills only the charges of the Accounts GST Charges master (name, SAC, GST rate)
const APPLIES = ['ALL', 'AE', 'AI', 'SE', 'SI'];
async function gstCharges() {
    return sequelize.query("SELECT id, chargeName name, sacCode sac, gstRate, coalesce(exempt, 0) exempt FROM AccGstCharges WHERE coalesce(isActive, 1) = 1 ORDER BY chargeName", { type: QueryTypes.SELECT }).catch(() => []);
}

const STATUSES = ['Draft', 'Pending Approval', 'Active', 'Rejected'];
const SERVICE = ['General', 'Valuable', 'Perishable', 'DGR', 'Re-Import', 'Re-Export'];
const BASIS = ['Flat', 'Per KG (ChW)', 'Per KG (GrW)', 'Per Shipment', 'Per Package', 'Per Container', 'Per Document', '% of Freight', '% of Value', 'Actuals'];
const CTYPES = ['Taxable', 'Non-Taxable', 'Reimbursement'];
const INCLUDE = [{ model: ContractFreightRate, as: 'freightRates' }, { model: ContractCharge, as: 'charges' }, { model: ContractTransportRate, as: 'transportRates' }];

class Bad extends Error { constructor(m, status = 400) { super(m); this.status = status; } }
const num = (v, label, row) => {
    if (v === '' || v == null) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1e10) throw new Bad(`${label} in row ${row} must be a number 0 or more`);
    return Math.round(n * 100) / 100;
};
const ymd = (v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(String(v).slice(0, 10)) ? String(v).slice(0, 10) : null);
const cur = (v) => { const c = String(v || 'INR').trim().toUpperCase(); if (!/^[A-Z]{3}$/.test(c)) throw new Bad('Currency must be a 3-letter code'); return c; };

async function clean(b) {
    const Party = require('../models/Party');
    const partyId = parseInt(b.partyId, 10);
    const party = Number.isInteger(partyId) ? await Party.findByPk(partyId, { attributes: ['id', 'name'] }) : null;
    if (!party) throw new Bad('Choose the customer / party');
    const validFrom = ymd(b.validFrom), validTo = ymd(b.validTo);
    if (!validTo) throw new Bad('Valid To date is required');
    if (validFrom && validFrom > validTo) throw new Bad('Valid From must be before Valid To');
    const head = { partyId, partyName: party.name, validFrom, validTo, currency: cur(b.currency), salesRep: String(b.salesRep || '').trim().slice(0, 100) || null, terms: String(b.terms || '').slice(0, 10000),
        splitInvoicing: !!b.splitInvoicing, consolidatedBilling: !!b.consolidatedBilling, autoEmailInvoices: b.autoEmailInvoices !== false, billingNotes: String(b.billingNotes || '').slice(0, 5000) || null };

    const gm = new Map((await gstCharges()).map(c => [String(c.name).trim().toUpperCase(), c.name]));
    const gst = (v, what, i, req) => { // the GST charge's name exactly as in the master, or an error
        const t = String(v || '').trim(); if (!t) { if (req) throw new Bad(`${what} row ${i + 1}: choose the charge from Accounts GST Charges`); return null; }
        const n = gm.get(t.toUpperCase()); if (!n) throw new Bad(`${what} row ${i + 1}: "${t}" is not in Accounts GST Charges - pick one from the list`); return n;
    };
    const freight = (Array.isArray(b.freightRates) ? b.freightRates : []).filter(r => r && (r.origin || r.destination || r.normal || r.min)).map((r, i) => {
        const o = String(r.origin || '').trim().toUpperCase(), d = String(r.destination || '').trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(o) || !/^[A-Z]{3}$/.test(d)) throw new Bad(`Freight row ${i + 1}: origin and destination must be 3-letter airport codes`);
        const st = SERVICE.includes(r.serviceType) ? r.serviceType : 'General';
        const out = { origin: o, destination: d, serviceType: st, carrier: String(r.carrier || '').trim().toUpperCase().slice(0, 10) || null, chargeName: gst(r.chargeName, 'Freight', i, false) };
        for (const k of ['min', 'normal', 'plus45', 'plus100', 'plus300', 'plus500', 'plus1000']) out[k] = num(r[k], k, i + 1);
        if (out.normal == null && out.min == null) throw new Bad(`Freight row ${i + 1}: give at least the Min or Normal rate`);
        return out;
    });
    const seen = new Set();
    for (const f of freight) { const k = [f.origin, f.destination, f.serviceType, f.carrier || ''].join('|'); if (seen.has(k)) throw new Bad(`Freight rate ${f.origin}-${f.destination} ${f.serviceType} ${f.carrier || ''} is entered twice`); seen.add(k); }

    const charges = (Array.isArray(b.charges) ? b.charges : []).filter(r => r && (r.printName || r.rate)).map((r, i) => {
        const name = gst(r.printName, 'Charge', i, true);
        const out = { printName: name.slice(0, 200), systemLedger: null, appliesTo: APPLIES.includes(String(r.appliesTo || 'ALL').toUpperCase()) ? String(r.appliesTo || 'ALL').toUpperCase() : 'ALL', basis: String(r.basis || 'Flat').trim().slice(0, 40) || 'Flat', rate: num(r.rate, 'Rate', i + 1), minAmt: num(r.minAmt, 'Min', i + 1), maxAmt: num(r.maxAmt, 'Max', i + 1), currency: cur(r.currency), mandatory: !!r.mandatory, type: CTYPES.includes(r.type) ? r.type : 'Taxable' };
        if (out.rate == null && out.basis !== 'Actuals') throw new Bad(`Charge row ${i + 1}: Rate is required`);
        if (out.minAmt != null && out.maxAmt != null && out.minAmt > out.maxAmt) throw new Bad(`Charge row ${i + 1}: Min is more than Max`);
        return out;
    });
    const transport = (Array.isArray(b.transportRates) ? b.transportRates : []).filter(r => r && (r.fromLoc || r.toLoc || r.amount)).map((r, i) => {
        const f = String(r.fromLoc || '').trim(), t = String(r.toLoc || '').trim();
        if (!f || !t) throw new Bad(`Transport row ${i + 1}: From and To are required`);
        const amount = num(r.amount, 'Amount', i + 1);
        if (amount == null) throw new Bad(`Transport row ${i + 1}: Amount is required`);
        return { fromLoc: f.slice(0, 100), toLoc: t.slice(0, 100), vehicle: String(r.vehicle || '').slice(0, 40) || null, amount, currency: cur(r.currency), chargeName: gst(r.chargeName, 'Transport', i, false) };
    });
    return { head, freight, charges, transport };
}

async function nextContractNo(t) {
    const yy = String(new Date().getFullYear()).slice(2);
    const last = await CustomerContract.findOne({ where: { contractNo: { [Op.like]: `CONT/${yy}/%` } }, order: [['id', 'DESC']], transaction: t });
    let n = last ? (parseInt(String(last.contractNo).split('/').pop(), 10) || 0) + 1 : 1;
    while (await CustomerContract.findOne({ where: { contractNo: `CONT/${yy}/${String(n).padStart(4, '0')}` }, transaction: t })) n++;
    return `CONT/${yy}/${String(n).padStart(4, '0')}`;
}

async function writeRows(id, c, t) {
    await ContractFreightRate.destroy({ where: { contractId: id }, transaction: t });
    await ContractCharge.destroy({ where: { contractId: id }, transaction: t });
    await ContractTransportRate.destroy({ where: { contractId: id }, transaction: t });
    if (c.freight.length) await ContractFreightRate.bulkCreate(c.freight.map(r => ({ ...r, contractId: id })), { transaction: t });
    if (c.charges.length) await ContractCharge.bulkCreate(c.charges.map(r => ({ ...r, contractId: id })), { transaction: t });
    if (c.transport.length) await ContractTransportRate.bulkCreate(c.transport.map(r => ({ ...r, contractId: id })), { transaction: t });
}
const fail = (res, e) => res.status(e.status || 500).json({ success: false, error: e.message });

// GET /api/contracts/gst-charges - the Accounts GST Charges a contract can use (08-Nov-2026)
router.get('/gst-charges', async (req, res) => { try { res.json({ success: true, data: await gstCharges() }); } catch (e) { fail(res, e); } });

// GET /api/contracts?partyId=&status=
router.get('/', async (req, res) => {
    try {
        await ready();
        const where = {};
        if (req.query.partyId) where.partyId = parseInt(req.query.partyId, 10) || 0;
        if (req.query.status) where.status = String(req.query.status);
        const rows = await CustomerContract.findAll({ where, attributes: { exclude: ['terms'] }, order: [['id', 'DESC']], limit: 500 });
        const today = new Date().toISOString().slice(0, 10);
        res.json({ success: true, data: rows.map(r => ({ ...r.toJSON(), expired: r.validTo < today })) });
    } catch (e) { fail(res, e); }
});

router.get('/:id', async (req, res) => {
    try {
        await ready();
        const row = await CustomerContract.findByPk(req.params.id, { include: INCLUDE });
        if (!row) return res.status(404).json({ success: false, error: 'Contract not found' });
        res.json({ success: true, data: row });
    } catch (e) { fail(res, e); }
});

// POST { partyId, validFrom, validTo, currency, salesRep, terms, freightRates, charges, transportRates, submit }
router.post('/', async (req, res) => {
    try {
        await ready();
        const c = await clean(req.body || {});
        const row = await sequelize.transaction(async (t) => {
            const h = await CustomerContract.create({ ...c.head, contractNo: await nextContractNo(t), status: req.body.submit ? 'Pending Approval' : 'Draft', createdBy: who(req) }, { transaction: t });
            await writeRows(h.id, c, t);
            return h;
        });
        res.status(201).json({ success: true, data: await CustomerContract.findByPk(row.id, { include: INCLUDE }) });
    } catch (e) { fail(res, e); }
});

router.put('/:id', async (req, res) => {
    try {
        await ready();
        const row = await CustomerContract.findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'Contract not found' });
        if (row.status === 'Active' && !isAdmin(req)) return res.status(403).json({ success: false, error: 'An Active contract can be changed only by an admin' });
        const c = await clean(req.body || {});
        // a changed Active contract goes back for approval; submit = send for approval
        const status = req.body.submit || row.status === 'Active' ? 'Pending Approval' : (row.status === 'Rejected' ? 'Draft' : row.status);
        await sequelize.transaction(async (t) => {
            await row.update({ ...c.head, status, ...(status !== 'Active' ? { approvedBy: null, approvedAt: null } : {}) }, { transaction: t });
            await writeRows(row.id, c, t);
        });
        res.json({ success: true, data: await CustomerContract.findByPk(row.id, { include: INCLUDE }) });
    } catch (e) { fail(res, e); }
});

// POST /api/contracts/:id/status { status: 'Active' | 'Rejected' | 'Draft' } - approve / reject (admin)
router.post('/:id/status', async (req, res) => {
    try {
        await ready();
        const status = String((req.body && req.body.status) || '');
        if (!STATUSES.includes(status) || status === 'Pending Approval') return res.status(400).json({ success: false, error: 'Status must be Active, Rejected or Draft' });
        if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Only an admin can approve or reject a contract' });
        const row = await CustomerContract.findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'Contract not found' });
        if (status === 'Active' && row.status !== 'Pending Approval') return res.status(400).json({ success: false, error: 'Only a contract sent for approval can be approved' });
        await row.update({ status, approvedBy: status === 'Active' ? who(req) : null, approvedAt: status === 'Active' ? new Date() : null });
        res.json({ success: true, data: row });
    } catch (e) { fail(res, e); }
});

router.delete('/:id', async (req, res) => {
    try {
        await ready();
        const row = await CustomerContract.findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'Contract not found' });
        if (row.status === 'Active' && !isAdmin(req)) return res.status(403).json({ success: false, error: 'An Active contract can be deleted only by an admin' });
        await sequelize.transaction(async (t) => {
            await writeRows(row.id, { freight: [], charges: [], transport: [] }, t);
            await row.destroy({ transaction: t });
        });
        res.json({ success: true });
    } catch (e) { fail(res, e); }
});

module.exports = router;
module.exports.BASIS = BASIS;
