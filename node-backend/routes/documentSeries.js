// /api/document-series - Document Series & Numbering Master. Added 28-Oct-2026.
//
// One rule per document type + branch + department + financial year ("ALL" = any branch / department).
// format tokens: {BRANCH} branch code, {DEPT} department short code, {FY} FY code (26-27), {YY} {MM} {DD} of the
// document date. nextNumber is the NEXT number to give; POST /take gives it and moves the counter by one in a
// single conditional update, so two users never get the same number.
// Job numbers are NOT here: they come from Settings > Sequence Config (utils/jobSequence.js).
const express = require('express');
const { Op } = require('sequelize');
const DocumentSeries = require('../models/DocumentSeries');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const DOC_TYPES = ['Tax Invoice', 'Proforma Invoice', 'Payment Voucher', 'Receipt Voucher', 'Journal Voucher', 'Credit Note', 'Debit Note', 'Consolidated Bill'];
const DEPTS = { 'ALL': 'GEN', 'Air Export': 'AE', 'Air Import': 'AI', 'Sea Export': 'SE', 'Sea Import': 'SI', 'Customs': 'CUS', 'Accounts': 'ACC', 'HR': 'HR' };
const TOKEN = /\{(BRANCH|DEPT|FY|YY|MM|DD)\}/g;
let synced = null;
const ready = () => (synced = synced || DocumentSeries.sync().catch(e => { synced = null; throw e; }));

const bad = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

function render(row, num, date = new Date(), branchCode, dept) {
    const d = date instanceof Date && !isNaN(date) ? date : new Date();
    const br = branchCode || (row.branchCode !== 'ALL' ? row.branchCode : 'HO');
    const dp = DEPTS[dept || row.dept] || 'GEN';
    const prefix = String(row.format || '').replace(TOKEN, (m, t) => ({
        BRANCH: br, DEPT: dp, FY: row.fyCode,
        YY: String(d.getFullYear()).slice(2), MM: String(d.getMonth() + 1).padStart(2, '0'), DD: String(d.getDate()).padStart(2, '0'),
    })[t]);
    return prefix + String(num).padStart(Number(row.pad) || 1, '0');
}

async function validate(b, id) {
    const v = {
        docType: String(b.docType || '').trim(),
        branchCode: String(b.branchCode || 'ALL').trim().toUpperCase() || 'ALL',
        dept: String(b.dept || 'ALL').trim() || 'ALL',
        fyCode: String(b.fyCode || '').trim(),
        format: String(b.format || '').trim(),
        pad: parseInt(b.pad, 10),
        nextNumber: parseInt(b.nextNumber, 10),
        isActive: b.isActive !== false,
    };
    if (!DOC_TYPES.includes(v.docType)) throw new Error(/job/i.test(v.docType) ? 'Job numbers are set in Settings > Sequence Config' : 'Choose a document type');
    if (!(v.dept in DEPTS)) throw new Error('Unknown department');
    if (v.branchCode !== 'ALL') {
        const CompanyBranch = require('../models/CompanyBranch');
        if (!(await CompanyBranch.findOne({ where: { branchCode: v.branchCode } }))) throw new Error(`Branch ${v.branchCode} not found in Company Branches`);
    }
    const FinancialYear = require('../models/FinancialYear');
    if (!v.fyCode || !(await FinancialYear.findOne({ where: { code: v.fyCode } }))) throw new Error('Choose a financial year from the FY master');
    if (!v.format || v.format.length > 60) throw new Error('Format is required (max 60 characters)');
    const unknown = (v.format.match(/\{[^}]*\}/g) || []).filter(t => !t.match(/^\{(BRANCH|DEPT|FY|YY|MM|DD)\}$/));
    if (unknown.length) throw new Error('Unknown tag in format: ' + unknown.join(', '));
    if (/[\\?#%"'<>|*\s]/.test(v.format.replace(TOKEN, ''))) throw new Error('Format may contain letters, digits, / - _ . and tags only');
    if (!Number.isInteger(v.pad) || v.pad < 1 || v.pad > 8) throw new Error('Padding must be 1 - 8');
    if (!Number.isInteger(v.nextNumber) || v.nextNumber < 1 || v.nextNumber > 99999999) throw new Error('Next number must be 1 or more');
    const clash = await DocumentSeries.findOne({ where: { docType: v.docType, branchCode: v.branchCode, dept: v.dept, fyCode: v.fyCode, ...(id ? { id: { [Op.ne]: id } } : {}) } });
    if (clash) { const e = new Error('A rule for this document type, branch, department and year already exists'); e.status = 409; throw e; }
    return v;
}

// GET /api/document-series?docType=&branchCode=&fyCode=
router.get('/', async (req, res) => {
    try {
        await ready();
        const where = {};
        for (const k of ['docType', 'branchCode', 'fyCode', 'dept']) if (req.query[k]) where[k] = String(req.query[k]);
        const rows = await DocumentSeries.findAll({ where, order: [['fyCode', 'DESC'], ['docType', 'ASC'], ['branchCode', 'ASC'], ['dept', 'ASC']] });
        res.json({ success: true, data: rows.map(r => ({ ...r.toJSON(), example: render(r, r.nextNumber) })), docTypes: DOC_TYPES, depts: Object.keys(DEPTS) });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/', requireAdmin, async (req, res) => {
    try {
        await ready();
        let v; try { v = await validate(req.body || {}); } catch (e) { return bad(res, e.message, e.status || 400); }
        const row = await DocumentSeries.create(v);
        res.status(201).json({ success: true, data: row });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.put('/:id', requireAdmin, async (req, res) => {
    try {
        await ready();
        const row = await DocumentSeries.findByPk(req.params.id);
        if (!row) return bad(res, 'Rule not found', 404);
        let v; try { v = await validate({ ...row.toJSON(), ...(req.body || {}) }, row.id); } catch (e) { return bad(res, e.message, e.status || 400); }
        // moving the counter back can give numbers that were already used
        if (v.nextNumber < row.nextNumber && !req.body.allowBack) return bad(res, `Next number cannot go back from ${row.nextNumber} (numbers already given would repeat). Send allowBack to force.`);
        await row.update(v);
        res.json({ success: true, data: row });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        await ready();
        const n = await DocumentSeries.destroy({ where: { id: req.params.id } });
        if (!n) return bad(res, 'Rule not found', 404);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// best rule for a document: exact branch + dept, then branch + ALL, then ALL + dept, then ALL + ALL
async function findRule({ docType, branchCode, dept, fyCode }) {
    const tries = [[branchCode, dept], [branchCode, 'ALL'], ['ALL', dept], ['ALL', 'ALL']];
    for (const [b, d] of tries) {
        if (!b || !d) continue;
        const row = await DocumentSeries.findOne({ where: { docType, fyCode, branchCode: String(b).toUpperCase(), dept: d, isActive: true } });
        if (row) return row;
    }
    return null;
}

// POST /api/document-series/take { docType, branchCode, dept, fyCode, date } -> { number }
router.post('/take', async (req, res) => {
    try {
        await ready();
        const q = req.body || {};
        if (!q.docType || !q.fyCode) return bad(res, 'docType and fyCode are required');
        const date = q.date ? new Date(q.date) : new Date();
        for (let attempt = 0; attempt < 5; attempt++) {
            const row = await findRule(q);
            if (!row) return bad(res, `No active numbering rule for ${q.docType} (${q.branchCode || 'ALL'} / ${q.dept || 'ALL'} / ${q.fyCode})`, 404);
            const num = row.nextNumber;
            const [n] = await DocumentSeries.update({ nextNumber: num + 1 }, { where: { id: row.id, nextNumber: num } });
            if (n === 1) return res.json({ success: true, number: render(row, num, date, q.branchCode && row.branchCode === 'ALL' ? String(q.branchCode).toUpperCase() : undefined, q.dept && row.dept === 'ALL' ? q.dept : undefined), ruleId: row.id });
        }
        bad(res, 'Numbering is busy, please try again', 409);
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
module.exports.render = render;
module.exports.DOC_TYPES = DOC_TYPES;
