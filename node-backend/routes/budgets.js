// Budgets & Variance.
//
// 30-Oct-2026: the screen behind this was four hardcoded budgets with invented utilisation.
// Utilisation here is computed from the vouchers every time, against whatever the budget is
// set on - an expense ledger, an account group, or a cost centre.
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const Budget = require('../models/Budget');
const Voucher = require('../models/Voucher');
const VoucherDetail = require('../models/VoucherDetail');
const AccountLedger = require('../models/AccountLedger');
const AccountGroup = require('../models/AccountGroup');
const CostCentre = require('../models/CostCentre');

const r2 = (n) => Math.round((n || 0) * 100) / 100;
const BASES = ['LEDGER', 'GROUP', 'COST_CENTRE'];

// every group id under (and including) one group
async function groupFamily(rootId) {
    const all = await AccountGroup.findAll();
    const ids = new Set([rootId]);
    let grew = true;
    while (grew) { grew = false; all.forEach(g => { if (g.parentId && ids.has(g.parentId) && !ids.has(g.id)) { ids.add(g.id); grew = true; } }); }
    return [...ids];
}
// every cost centre under (and including) one centre
async function centreFamily(rootId) {
    const all = await CostCentre.findAll();
    const ids = new Set([rootId]);
    let grew = true;
    while (grew) { grew = false; all.forEach(c => { if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) { ids.add(c.id); grew = true; } }); }
    return [...ids];
}

// what has actually been spent against this budget in its own period
async function utilisationOf(b) {
    const vouchers = await Voucher.findAll({
        where: { date: { [Op.between]: [b.fromDate, b.toDate] } }, attributes: ['id'],
    });
    const vIds = vouchers.map(v => v.id);
    if (!vIds.length) return { used: 0, lines: 0, target: '' };

    let where = { voucherId: { [Op.in]: vIds } };
    let targetName = '';
    if (b.basis === 'COST_CENTRE') {
        const ids = await centreFamily(b.targetId);
        where.costCentreId = { [Op.in]: ids };
        const c = await CostCentre.findByPk(b.targetId);
        targetName = c ? c.name : '(cost centre ' + b.targetId + ' no longer exists)';
    } else if (b.basis === 'GROUP') {
        const gIds = await groupFamily(b.targetId);
        const ledgers = await AccountLedger.findAll({ where: { groupId: { [Op.in]: gIds } }, attributes: ['id'] });
        if (!ledgers.length) {
            const g = await AccountGroup.findByPk(b.targetId);
            return { used: 0, lines: 0, target: g ? g.name : '(group ' + b.targetId + ' no longer exists)' };
        }
        where.ledgerId = { [Op.in]: ledgers.map(l => l.id) };
        const g = await AccountGroup.findByPk(b.targetId);
        targetName = g ? g.name : '(group ' + b.targetId + ' no longer exists)';
    } else {
        where.ledgerId = b.targetId;
        const l = await AccountLedger.findByPk(b.targetId);
        targetName = l ? l.name : '(ledger ' + b.targetId + ' no longer exists)';
    }
    const lines = await VoucherDetail.findAll({ where });
    // spend is the Dr side; a credit back to the head reduces it
    const used = lines.reduce((a, d) => a + (parseFloat(d.amount) || 0) * (d.dc === 'Dr' ? 1 : -1), 0);
    return { used: r2(used), lines: lines.length, target: targetName };
}

// GET /api/budgets
router.get('/', async (req, res) => {
    try {
        const budgets = await Budget.findAll({ order: [['fromDate', 'DESC'], ['name', 'ASC']] });
        const data = [];
        for (const b of budgets) {
            const u = await utilisationOf(b);
            const allocated = r2(parseFloat(b.allocated) || 0);
            const pct = allocated > 0 ? Math.round((u.used / allocated) * 1000) / 10 : null;
            data.push({
                id: b.id, name: b.name, basis: b.basis, targetId: b.targetId, target: u.target,
                fromDate: b.fromDate, toDate: b.toDate,
                allocated, utilized: u.used, variance: r2(allocated - u.used),
                utilisedPct: pct, warnAtPct: b.warnAtPct,
                state: allocated <= 0 ? 'No allocation set'
                     : u.used > allocated ? 'Over budget'
                     : pct >= b.warnAtPct ? 'Near the limit' : 'Within budget',
                voucherLines: u.lines, notes: b.notes || '', createdByName: b.createdByName || '',
            });
        }
        res.json({
            success: true, data,
            totals: {
                allocated: r2(data.reduce((a, x) => a + x.allocated, 0)),
                utilized: r2(data.reduce((a, x) => a + x.utilized, 0)),
                overBudget: data.filter(x => x.state === 'Over budget').length,
            },
            note: data.length
                ? 'Utilisation is the Dr total on each budget’s own ledger / group / cost centre inside its own dates. It is computed fresh every time, never stored, so it cannot drift from the books.'
                : 'No budget has been created yet. A budget is set against one ledger, an account group or a cost centre so that utilisation can actually be measured.',
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// the pickable targets, so the create form is not a free-text box
router.get('/targets', async (req, res) => {
    try {
        const [groups, ledgers, centres] = await Promise.all([
            AccountGroup.findAll({ order: [['name', 'ASC']] }),
            AccountLedger.findAll({ order: [['name', 'ASC']] }),
            CostCentre.findAll({ order: [['name', 'ASC']] }),
        ]);
        const gById = new Map(groups.map(g => [g.id, g]));
        res.json({
            success: true,
            groups: groups.map(g => ({ id: g.id, name: g.name, nature: g.nature })),
            ledgers: ledgers.map(l => ({ id: l.id, name: l.name, group: (gById.get(l.groupId) || {}).name || '' })),
            costCentres: centres.map(c => ({ id: c.id, name: c.name })),
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const validate = async (b, partial) => {
    const errors = [];
    const basis = String(b.basis || 'LEDGER').toUpperCase();
    if (!partial || b.basis !== undefined) {
        if (!BASES.includes(basis)) errors.push('Basis must be LEDGER, GROUP or COST_CENTRE');
    }
    if (!partial || b.name !== undefined) {
        if (!String(b.name || '').trim()) errors.push('Give the budget a name');
    }
    if (!partial || b.targetId !== undefined) {
        const id = parseInt(b.targetId, 10);
        if (!id) errors.push('Pick what the budget is set against');
        else {
            const found = basis === 'GROUP' ? await AccountGroup.findByPk(id)
                : basis === 'COST_CENTRE' ? await CostCentre.findByPk(id)
                : await AccountLedger.findByPk(id);
            if (!found) errors.push('That ' + basis.toLowerCase().replace('_', ' ') + ' does not exist');
        }
    }
    if (!partial || b.fromDate !== undefined || b.toDate !== undefined) {
        const f = String(b.fromDate || '').slice(0, 10), t = String(b.toDate || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) errors.push('Give a from and to date');
        else if (f > t) errors.push('The from date is after the to date');
    }
    if (!partial || b.allocated !== undefined) {
        const a = parseFloat(b.allocated);
        if (!Number.isFinite(a) || a < 0) errors.push('Allocated amount must be a number, zero or more');
    }
    if (b.warnAtPct !== undefined) {
        const w = parseInt(b.warnAtPct, 10);
        if (!(w >= 1 && w <= 200)) errors.push('Warn-at percentage must be between 1 and 200');
    }
    return errors;
};

// POST /api/budgets
router.post('/', async (req, res) => {
    try {
        const b = req.body || {};
        const errors = await validate(b, false);
        if (errors.length) return res.status(400).json({ success: false, error: errors.join('; '), errors });
        const row = await Budget.create({
            name: String(b.name).trim(), basis: String(b.basis || 'LEDGER').toUpperCase(),
            targetId: parseInt(b.targetId, 10), fromDate: String(b.fromDate).slice(0, 10), toDate: String(b.toDate).slice(0, 10),
            allocated: parseFloat(b.allocated), warnAtPct: b.warnAtPct !== undefined ? parseInt(b.warnAtPct, 10) : 80,
            notes: b.notes ? String(b.notes) : null,
            createdByName: (req.user && (req.user.fullName || req.user.username)) || null,
        });
        res.json({ success: true, data: row });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/budgets/:id
router.put('/:id', async (req, res) => {
    try {
        const row = await Budget.findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'Budget not found' });
        const b = { ...row.toJSON(), ...req.body };
        const errors = await validate(b, true);
        if (errors.length) return res.status(400).json({ success: false, error: errors.join('; '), errors });
        const v = {};
        ['name', 'basis', 'notes'].forEach(k => { if (req.body[k] !== undefined) v[k] = req.body[k] == null ? null : String(req.body[k]); });
        if (v.basis) v.basis = v.basis.toUpperCase();
        if (req.body.targetId !== undefined) v.targetId = parseInt(req.body.targetId, 10);
        if (req.body.fromDate !== undefined) v.fromDate = String(req.body.fromDate).slice(0, 10);
        if (req.body.toDate !== undefined) v.toDate = String(req.body.toDate).slice(0, 10);
        if (req.body.allocated !== undefined) v.allocated = parseFloat(req.body.allocated);
        if (req.body.warnAtPct !== undefined) v.warnAtPct = parseInt(req.body.warnAtPct, 10);
        await row.update(v);
        res.json({ success: true, data: row });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/budgets/:id
router.delete('/:id', async (req, res) => {
    try {
        const row = await Budget.findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'Budget not found' });
        await row.destroy();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
