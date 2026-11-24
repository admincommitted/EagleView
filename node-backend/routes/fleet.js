// Fleet & Transport (lorry receipts / trip sheets).
//
// 30-Oct-2026: the screen behind this listed two invented trips and its "Update Status" button did
// nothing; the Lorry Receipt form saved nothing and most of its boxes were not bound to anything.
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { sequelize } = require('../db');
const LorryReceipt = require('../models/LorryReceipt');
const Transporter = require('../models/Transporter');
const AccountLedger = require('../models/AccountLedger');
const Voucher = require('../models/Voucher');
const VoucherDetail = require('../models/VoucherDetail');
const VoucherType = require('../models/VoucherType');

const r2 = (n) => Math.round((n || 0) * 100) / 100;
const STATUS = ['PENDING_DISPATCH', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
const BASES = ['Per Ton', 'Per Trip', 'Per Km', 'Flat'];

async function nextLrNo() {
    const fy = (() => { const d = new Date(); const y = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear(); return String(y % 100); })();
    const like = 'LR/' + fy + '/%';
    const rows = await LorryReceipt.findAll({ where: { lrNo: { [Op.like]: like } }, attributes: ['lrNo'] });
    let max = 0;
    rows.forEach(r => { const m = /\/(\d+)$/.exec(String(r.lrNo || '')); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    return 'LR/' + fy + '/' + String(max + 1).padStart(4, '0');
}

// freight is derived from the basis, so a rate per ton cannot silently become the whole freight
function freightOf(b) {
    const rate = parseFloat(b.freightRate) || 0;
    const basis = String(b.freightBasis || 'Per Trip');
    if (!rate) return 0;
    if (basis === 'Per Ton') {
        const wt = parseFloat(b.chargedWeight) || parseFloat(b.actualWeight) || 0;
        return r2(rate * wt);
    }
    if (basis === 'Per Km') return r2(rate * (parseFloat(b.distanceKm) || 0));
    return r2(rate);                        // Per Trip / Flat
}

const validate = async (b, existing) => {
    const errors = [];
    const g = (k) => b[k] !== undefined ? b[k] : (existing ? existing[k] : undefined);
    if (!String(g('lrNo') || '').trim() && !existing) { /* generated below */ }
    const date = String(g('date') || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('Give the LR date');
    const basis = String(g('freightBasis') || 'Per Trip');
    if (!BASES.includes(basis)) errors.push('Freight basis must be one of ' + BASES.join(', '));
    if (basis === 'Per Ton' && (parseFloat(g('freightRate')) || 0) > 0 && !(parseFloat(g('chargedWeight')) || parseFloat(g('actualWeight')))) {
        errors.push('A per-ton rate needs the weight, otherwise the freight cannot be worked out');
    }
    if (basis === 'Per Km' && (parseFloat(g('freightRate')) || 0) > 0 && !(parseFloat(g('distanceKm')) || 0)) {
        errors.push('A per-km rate needs the distance');
    }
    const vn = String(g('vehicleNo') || '').trim();
    // Indian plates: 2 letters, 1-2 digits, 1-3 letters, 4 digits - spaces and dashes allowed
    if (vn && !/^[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{0,3}[\s-]?\d{1,4}$/i.test(vn)) {
        errors.push('Vehicle number does not look like a plate (e.g. HR38X4455 or HR 38 X 4455)');
    }
    const ph = String(g('driverPhone') || '').trim();
    if (ph && !/^[0-9+\-()\s]{6,20}$/.test(ph)) errors.push('Driver phone looks wrong');
    const eway = String(g('ewayBill') || '').trim();
    if (eway && !/^\d{12}$/.test(eway)) errors.push('An e-way bill number is 12 digits');
    const adv = parseFloat(g('advanceToDriver')) || 0;
    const fr = freightOf({ freightBasis: basis, freightRate: g('freightRate'), chargedWeight: g('chargedWeight'), actualWeight: g('actualWeight'), distanceKm: g('distanceKm') });
    if (adv && fr && adv > fr) errors.push('The driver advance (' + adv + ') is more than the whole freight (' + fr + ')');
    if (b.status !== undefined && !STATUS.includes(String(b.status).toUpperCase())) errors.push('Status must be one of ' + STATUS.join(', '));
    if (b.transporterId && !await Transporter.findByPk(b.transporterId)) errors.push('That transporter does not exist');
    if (b.billingLedgerId && !await AccountLedger.findByPk(b.billingLedgerId)) errors.push('That billing ledger does not exist');
    return errors;
};

// GET /api/fleet/lr
router.get('/lr', async (req, res) => {
    try {
        const where = {};
        if (req.query.status) where.status = String(req.query.status).toUpperCase();
        if (req.query.q) {
            const q = '%' + String(req.query.q) + '%';
            where[Op.or] = [{ lrNo: { [Op.like]: q } }, { vehicleNo: { [Op.like]: q } }, { driverName: { [Op.like]: q } },
                { consignor: { [Op.like]: q } }, { consignee: { [Op.like]: q } }, { origin: { [Op.like]: q } },
                { destination: { [Op.like]: q } }, { jobNo: { [Op.like]: q } }];
        }
        const rows = await LorryReceipt.findAll({ where, order: [['date', 'DESC'], ['id', 'DESC']], limit: 500 });
        const data = rows.map(l => {
            const o = l.toJSON();
            const freight = r2(parseFloat(o.freightAmount) || 0);
            const advance = r2(parseFloat(o.advanceToDriver) || 0);
            return { ...o, freightAmount: freight, advanceToDriver: advance, balance: r2(freight - advance),
                advancePosted: !!o.advanceVoucherId };
        });
        res.json({
            success: true, data,
            counts: STATUS.reduce((a, s) => ({ ...a, [s]: data.filter(x => x.status === s).length }), {}),
            totals: {
                freight: r2(data.reduce((a, x) => a + x.freightAmount, 0)),
                advance: r2(data.reduce((a, x) => a + x.advanceToDriver, 0)),
                advancesNotPosted: data.filter(x => x.advanceToDriver > 0 && !x.advanceVoucherId).length,
            },
            nextLrNo: await nextLrNo(),
            note: data.length ? 'Freight is computed from the rate and its basis. An advance only shows as posted when a voucher was actually created for it.'
                              : 'No lorry receipt yet. Use "New Trip / Lorry Receipt" to raise the first one.',
        });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/lr/next-no', async (req, res) => {
    try { res.json({ success: true, lrNo: await nextLrNo() }); }
    catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// the pickable masters for the form
router.get('/masters', async (req, res) => {
    try {
        const [transporters, ledgers, vtypes] = await Promise.all([
            Transporter.findAll({ order: [['transporterName', 'ASC']] }),
            AccountLedger.findAll({ order: [['name', 'ASC']] }),
            VoucherType.findAll({ where: { baseType: 'Payment' } }),
        ]);
        res.json({
            success: true,
            transporters: transporters.map(t => ({ id: t.id, name: t.transporterName, gstin: t.gstin, vehicleType: t.vehicleType })),
            ledgers: ledgers.map(l => ({ id: l.id, name: l.name })),
            paymentVoucherTypes: vtypes.map(v => ({ id: v.id, name: v.name })),
        });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/fleet/lr
router.post('/lr', async (req, res) => {
    try {
        const b = req.body || {};
        const errors = await validate(b, null);
        if (errors.length) return res.status(400).json({ success: false, error: errors.join('; '), errors });
        const freightAmount = freightOf(b);
        const num = (x) => (x === '' || x == null ? null : parseFloat(x));
        const row = await LorryReceipt.create({
            lrNo: String(b.lrNo || '').trim() || await nextLrNo(),
            date: String(b.date).slice(0, 10), jobNo: b.jobNo || null,
            consignor: b.consignor || null, consignee: b.consignee || null,
            billingParty: b.billingParty || null, billingLedgerId: b.billingLedgerId || null,
            transporterId: b.transporterId || null,
            origin: b.origin || null, destination: b.destination || null, distanceKm: num(b.distanceKm),
            vehicleNo: b.vehicleNo ? String(b.vehicleNo).toUpperCase().trim() : null,
            vehicleType: b.vehicleType || null, driverName: b.driverName || null,
            driverPhone: b.driverPhone || null, dlNumber: b.dlNumber ? String(b.dlNumber).toUpperCase() : null,
            ewayBill: b.ewayBill || null, invoiceValue: num(b.invoiceValue),
            packages: b.packages === '' || b.packages == null ? null : parseInt(b.packages, 10),
            actualWeight: num(b.actualWeight), chargedWeight: num(b.chargedWeight), commodity: b.commodity || null,
            freightBasis: b.freightBasis || 'Per Trip', freightRate: num(b.freightRate), freightAmount,
            advanceToDriver: num(b.advanceToDriver), paymentType: b.paymentType || 'To Pay',
            status: 'PENDING_DISPATCH', remarks: b.remarks || null,
            createdByName: (req.user && (req.user.fullName || req.user.username)) || null,
        });
        res.json({ success: true, data: { ...row.toJSON(), freightAmount, balance: r2(freightAmount - (parseFloat(b.advanceToDriver) || 0)) } });
    } catch (err) {
        if (String(err.message).includes('unique')) return res.status(400).json({ success: false, error: 'That LR number already exists' });
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/fleet/lr/:id  - also the real "Update Status"
router.put('/lr/:id', async (req, res) => {
    try {
        const row = await LorryReceipt.findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'Lorry receipt not found' });
        const b = req.body || {};
        const errors = await validate(b, row.toJSON());
        if (errors.length) return res.status(400).json({ success: false, error: errors.join('; '), errors });

        const v = {};
        ['consignor', 'consignee', 'billingParty', 'origin', 'destination', 'vehicleType', 'driverName',
         'driverPhone', 'commodity', 'freightBasis', 'paymentType', 'remarks', 'jobNo', 'ewayBill']
            .forEach(k => { if (b[k] !== undefined) v[k] = b[k] === '' ? null : b[k]; });
        ['distanceKm', 'invoiceValue', 'actualWeight', 'chargedWeight', 'freightRate', 'advanceToDriver']
            .forEach(k => { if (b[k] !== undefined) v[k] = b[k] === '' || b[k] == null ? null : parseFloat(b[k]); });
        if (b.vehicleNo !== undefined) v.vehicleNo = b.vehicleNo ? String(b.vehicleNo).toUpperCase().trim() : null;
        if (b.dlNumber !== undefined) v.dlNumber = b.dlNumber ? String(b.dlNumber).toUpperCase() : null;
        if (b.packages !== undefined) v.packages = b.packages === '' || b.packages == null ? null : parseInt(b.packages, 10);
        if (b.transporterId !== undefined) v.transporterId = b.transporterId || null;
        if (b.billingLedgerId !== undefined) v.billingLedgerId = b.billingLedgerId || null;
        if (b.podReceived !== undefined) v.podReceived = !!b.podReceived;

        if (b.status !== undefined) {
            const st = String(b.status).toUpperCase();
            if (row.status === 'DELIVERED' && st === 'PENDING_DISPATCH') {
                return res.status(400).json({ success: false, error: 'A delivered trip cannot go back to pending dispatch' });
            }
            if (st === 'IN_TRANSIT' && !String(b.vehicleNo || row.vehicleNo || '').trim()) {
                return res.status(400).json({ success: false, error: 'A trip cannot be in transit without a vehicle number' });
            }
            v.status = st;
            if (st === 'IN_TRANSIT' && !row.dispatchedAt) v.dispatchedAt = new Date();
            if (st === 'DELIVERED' && !row.deliveredAt) v.deliveredAt = new Date();
        }
        // recompute the freight whenever anything it depends on moved
        const merged = { ...row.toJSON(), ...v };
        if (['freightBasis', 'freightRate', 'chargedWeight', 'actualWeight', 'distanceKm'].some(k => v[k] !== undefined)) {
            v.freightAmount = freightOf(merged);
        }
        await row.update(v);
        const o = row.toJSON();
        res.json({ success: true, data: { ...o, balance: r2((parseFloat(o.freightAmount) || 0) - (parseFloat(o.advanceToDriver) || 0)) } });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ---------------------------------------------------------------------------
// POST /api/fleet/lr/:id/post-advance
// The screen's button said "Save Trip & Post Advance Voucher" but no voucher was
// ever posted. This posts a real payment voucher - and because that touches the
// ledger, it asks which ledgers to use rather than inventing or creating them.
// ---------------------------------------------------------------------------
router.post('/lr/:id/post-advance', async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const row = await LorryReceipt.findByPk(req.params.id);
        if (!row) { await t.rollback(); return res.status(404).json({ success: false, error: 'Lorry receipt not found' }); }
        if (row.advanceVoucherId) { await t.rollback(); return res.status(400).json({ success: false, error: 'The advance for this LR is already posted (voucher ' + row.advanceVoucherId + ')' }); }
        const amount = parseFloat(row.advanceToDriver) || 0;
        if (amount <= 0) { await t.rollback(); return res.status(400).json({ success: false, error: 'There is no driver advance on this LR to post' }); }

        const b = req.body || {};
        const { voucherTypeId, debitLedgerId, creditLedgerId } = b;
        if (!voucherTypeId || !debitLedgerId || !creditLedgerId) {
            await t.rollback();
            return res.status(400).json({ success: false, error: 'Posting an advance touches the ledger, so it needs the voucher type, the ledger to debit (the transporter / driver advance account) and the bank or cash ledger to credit. Nothing is guessed here.' });
        }
        const [vt, dr, cr] = await Promise.all([VoucherType.findByPk(voucherTypeId), AccountLedger.findByPk(debitLedgerId), AccountLedger.findByPk(creditLedgerId)]);
        if (!vt || !dr || !cr) { await t.rollback(); return res.status(400).json({ success: false, error: 'The voucher type or one of the ledgers does not exist' }); }
        if (String(debitLedgerId) === String(creditLedgerId)) { await t.rollback(); return res.status(400).json({ success: false, error: 'The debit and credit ledgers cannot be the same' }); }

        const count = await Voucher.count({ where: { voucherTypeId: vt.id } });
        const voucherNumber = String(b.voucherNumber || '').trim() || ((vt.prefix || '') + ((vt.startingNumber || 1) + count) + (vt.suffix || ''));
        const voucher = await Voucher.create({
            voucherTypeId: vt.id, voucherNumber, date: b.date || row.date,
            narration: 'Driver advance for ' + row.lrNo + (row.vehicleNo ? ' (' + row.vehicleNo + ')' : '') + (row.driverName ? ' - ' + row.driverName : ''),
            totalAmount: amount, refNo: row.lrNo, jobNo: row.jobNo || null,
            createdBy: (req.user && req.user.id) || null,
            createdByName: (req.user && (req.user.fullName || req.user.username)) || null,
        }, { transaction: t });
        await VoucherDetail.create({ voucherId: voucher.id, ledgerId: dr.id, dc: 'Dr', amount, remarks: 'Advance against ' + row.lrNo }, { transaction: t });
        await VoucherDetail.create({ voucherId: voucher.id, ledgerId: cr.id, dc: 'Cr', amount, remarks: 'Advance against ' + row.lrNo }, { transaction: t });
        await row.update({ advanceVoucherId: voucher.id }, { transaction: t });
        await t.commit();
        res.json({ success: true, data: { lr: row, voucher }, note: 'Posted ' + voucherNumber + ': ' + dr.name + ' Dr, ' + cr.name + ' Cr, ' + amount });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/lr/:id', async (req, res) => {
    try {
        const row = await LorryReceipt.findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'Lorry receipt not found' });
        if (row.advanceVoucherId) return res.status(400).json({ success: false, error: 'An advance voucher is posted against this LR - cancel the trip instead of deleting it, so the voucher keeps its reference' });
        if (row.status === 'DELIVERED') return res.status(400).json({ success: false, error: 'A delivered trip cannot be deleted' });
        await row.destroy();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
