// Sales & CRM: leads, quotations, and conversion to a job.
//
// 30-Oct-2026: the Sales & CRM screen, the New Lead / Enquiry form and the quotation form all saved
// nothing. The screen listed two invented leads with invented contact people and phone numbers, two
// invented quotes, and three hardcoded charge lines; "Send Quotation" printed "Generating PDF and
// sending via SMTP" without doing either, and USD was converted at a hardcoded 84.
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const Lead = require('../models/Lead');
const Quotation = require('../models/Quotation');
const QuotationCharge = require('../models/QuotationCharge');
const Currency = require('../models/Currency');
const AccountLedger = require('../models/AccountLedger');

const r2 = (n) => Math.round((n || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const LEAD_STATUS = ['NEW', 'QUOTED', 'WON', 'LOST'];
const QUOTE_STATUS = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CONVERTED'];

// the next number in a series, from what is already stored - no counter to drift
async function nextNo(model, field, prefix) {
    const fy = (() => { const d = new Date(); const y = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear(); return String(y % 100); })();
    const like = prefix + '/' + fy + '/%';
    const rows = await model.findAll({ where: { [field]: { [Op.like]: like } }, attributes: [field] });
    let max = 0;
    rows.forEach(r => { const m = /\/(\d+)$/.exec(String(r[field] || '')); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    return prefix + '/' + fy + '/' + String(max + 1).padStart(4, '0');
}

// the exchange rate actually on file for a currency - never a hardcoded guess
async function roeFor(code) {
    const c = String(code || 'INR').toUpperCase();
    if (c === 'INR') return { roe: 1, source: 'INR' };
    const row = await Currency.findOne({ where: { currencyCode: c } });
    if (row && parseFloat(row.importRate) > 0) return { roe: parseFloat(row.importRate), source: 'Currency master' };
    return { roe: null, source: 'not on file' };
}

// ---------------------------------------------------------------- leads
router.get('/leads', async (req, res) => {
    try {
        const where = {};
        if (req.query.status) where.status = String(req.query.status).toUpperCase();
        if (req.query.q) {
            const q = '%' + String(req.query.q) + '%';
            where[Op.or] = [{ clientName: { [Op.like]: q } }, { enquiryNo: { [Op.like]: q } },
                { contactPerson: { [Op.like]: q } }, { origin: { [Op.like]: q } }, { destination: { [Op.like]: q } },
                { commodity: { [Op.like]: q } }];
        }
        const leads = await Lead.findAll({ where, order: [['date', 'DESC'], ['id', 'DESC']], limit: 500 });
        const quotes = await Quotation.findAll({ attributes: ['id', 'quoteNo', 'leadId', 'status', 'totalSellInr'] });
        const byLead = new Map();
        quotes.forEach(q => { if (q.leadId) { if (!byLead.has(q.leadId)) byLead.set(q.leadId, []); byLead.get(q.leadId).push(q); } });
        res.json({
            success: true,
            data: leads.map(l => ({ ...l.toJSON(), quotes: (byLead.get(l.id) || []).map(q => ({ id: q.id, quoteNo: q.quoteNo, status: q.status, value: r2(parseFloat(q.totalSellInr) || 0) })) })),
            counts: LEAD_STATUS.reduce((a, s) => ({ ...a, [s]: leads.filter(l => l.status === s).length }), {}),
            nextEnquiryNo: await nextNo(Lead, 'enquiryNo', 'ENQ'),
        });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/leads/next-no', async (req, res) => {
    try { res.json({ success: true, enquiryNo: await nextNo(Lead, 'enquiryNo', 'ENQ') }); }
    catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/leads', async (req, res) => {
    try {
        const b = req.body || {};
        const errors = [];
        if (!String(b.clientName || '').trim()) errors.push('Client name is required');
        if (b.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.email))) errors.push('Email is not valid');
        if (b.phone && !/^[0-9+\-()\s]{6,20}$/.test(String(b.phone))) errors.push('Phone number looks wrong');
        if (b.partyLedgerId && !await AccountLedger.findByPk(b.partyLedgerId)) errors.push('That customer ledger does not exist');
        const date = String(b.date || today()).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('Date is not valid');
        const numOrNull = (x) => { if (x === '' || x == null) return null; const n = parseFloat(x); return Number.isFinite(n) ? n : NaN; };
        const w = numOrNull(b.weight), v = numOrNull(b.volume);
        if (Number.isNaN(w)) errors.push('Weight must be a number');
        if (Number.isNaN(v)) errors.push('Volume must be a number');
        if (errors.length) return res.status(400).json({ success: false, error: errors.join('; '), errors });

        const row = await Lead.create({
            enquiryNo: String(b.enquiryNo || '').trim() || await nextNo(Lead, 'enquiryNo', 'ENQ'),
            date, partyLedgerId: b.partyLedgerId || null,
            clientName: String(b.clientName).trim(), contactPerson: b.contactPerson || null, designation: b.designation || null,
            email: b.email || null, phone: b.phone || null,
            mode: b.mode || null, serviceType: b.serviceType || null,
            origin: b.origin || null, destination: b.destination || null,
            incoterms: b.incoterms || null, commodity: b.commodity || null,
            readinessDate: b.readinessDate ? String(b.readinessDate).slice(0, 10) : null,
            containerType: b.containerType || null, weight: w, volume: v,
            targetRate: b.targetRate || null, competitor: b.competitor || null, remarks: b.remarks || null,
            status: 'NEW',
            createdBy: (req.user && req.user.id) || null,
            createdByName: (req.user && (req.user.fullName || req.user.username)) || null,
        });
        res.json({ success: true, data: row });
    } catch (err) {
        if (String(err.message).includes('unique')) return res.status(400).json({ success: false, error: 'That enquiry number already exists' });
        res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/leads/:id', async (req, res) => {
    try {
        const row = await Lead.findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'Lead not found' });
        const b = req.body || {};
        if (b.status !== undefined) {
            const st = String(b.status).toUpperCase();
            if (!LEAD_STATUS.includes(st)) return res.status(400).json({ success: false, error: 'Status must be one of ' + LEAD_STATUS.join(', ') });
            if (st === 'LOST' && !String(b.lostReason || row.lostReason || '').trim()) {
                return res.status(400).json({ success: false, error: 'Say why the lead was lost - that is the only part of it worth keeping' });
            }
        }
        const v = {};
        ['clientName', 'contactPerson', 'designation', 'email', 'phone', 'mode', 'serviceType', 'origin', 'destination',
         'incoterms', 'commodity', 'containerType', 'targetRate', 'competitor', 'remarks', 'lostReason']
            .forEach(k => { if (b[k] !== undefined) v[k] = b[k] === '' ? null : b[k]; });
        if (b.status !== undefined) v.status = String(b.status).toUpperCase();
        if (b.weight !== undefined) v.weight = b.weight === '' ? null : parseFloat(b.weight);
        if (b.volume !== undefined) v.volume = b.volume === '' ? null : parseFloat(b.volume);
        if (b.readinessDate !== undefined) v.readinessDate = b.readinessDate ? String(b.readinessDate).slice(0, 10) : null;
        await row.update(v);
        res.json({ success: true, data: row });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ---------------------------------------------------------------- quotations
const totalsOf = (lines) => {
    let buy = 0, sell = 0;
    lines.forEach(l => {
        const q = parseFloat(l.qty) || 0, roe = parseFloat(l.roe) || 1;
        buy += (parseFloat(l.buyRate) || 0) * q * roe;
        sell += (parseFloat(l.sellRate) || 0) * q * roe;
    });
    return { buy: r2(buy), sell: r2(sell) };
};

router.get('/quotes', async (req, res) => {
    try {
        const where = {};
        if (req.query.status) where.status = String(req.query.status).toUpperCase();
        if (req.query.leadId) where.leadId = parseInt(req.query.leadId, 10);
        const quotes = await Quotation.findAll({ where, order: [['date', 'DESC'], ['id', 'DESC']], limit: 500 });
        const ids = quotes.map(q => q.id);
        const charges = ids.length ? await QuotationCharge.findAll({ where: { quotationId: { [Op.in]: ids } }, order: [['sortOrder', 'ASC'], ['id', 'ASC']] }) : [];
        const byQ = new Map();
        charges.forEach(c => { if (!byQ.has(c.quotationId)) byQ.set(c.quotationId, []); byQ.get(c.quotationId).push(c); });
        res.json({
            success: true,
            data: quotes.map(q => {
                const lines = byQ.get(q.id) || [];
                const t = totalsOf(lines);
                const sell = r2(parseFloat(q.totalSellInr) || 0);
                return {
                    ...q.toJSON(), charges: lines,
                    totalBuyInr: r2(parseFloat(q.totalBuyInr) || 0), totalSellInr: sell,
                    marginInr: r2(sell - (parseFloat(q.totalBuyInr) || 0)),
                    marginPct: sell > 0 ? Math.round(((sell - (parseFloat(q.totalBuyInr) || 0)) / sell) * 1000) / 10 : null,
                    // the stored totals must agree with the lines; if they do not, say so rather than hide it
                    totalsMatchLines: Math.abs(t.sell - sell) < 0.02,
                    expired: q.validUntil ? String(q.validUntil) < today() : false,
                };
            }),
            counts: QUOTE_STATUS.reduce((a, s) => ({ ...a, [s]: quotes.filter(q => q.status === s).length }), {}),
            nextQuoteNo: await nextNo(Quotation, 'quoteNo', 'QT'),
        });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/quotes/next-no', async (req, res) => {
    try { res.json({ success: true, quoteNo: await nextNo(Quotation, 'quoteNo', 'QT') }); }
    catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// the rates on file, so the quote form converts with real numbers
router.get('/rates', async (req, res) => {
    try {
        const list = await Currency.findAll({ order: [['currencyCode', 'ASC']] });
        res.json({
            success: true,
            data: list.map(c => ({ code: c.currencyCode, name: c.currencyName, roe: parseFloat(c.importRate) || null, effectiveDate: c.effectiveDate })),
            note: list.length ? 'Rates are the import rates on the Currency master.'
                              : 'No currency is on file, so only INR can be quoted. Add currencies and their rates in Accounting Masters.',
        });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

async function saveCharges(quotationId, charges) {
    await QuotationCharge.destroy({ where: { quotationId } });
    const out = [];
    let i = 0;
    for (const c of (charges || [])) {
        const head = String(c.head || '').trim();
        if (!head) continue;
        const code = String(c.currency || 'INR').toUpperCase();
        // the rate comes from the master unless the user typed one for this line
        const typed = parseFloat(c.roe);
        let roe = Number.isFinite(typed) && typed > 0 ? typed : null;
        if (roe == null) {
            const r = await roeFor(code);
            if (r.roe == null) throw new Error('No exchange rate on file for ' + code + ' - add it in Accounting Masters, or type the rate on the line. A quote must not be priced off a guessed rate.');
            roe = r.roe;
        }
        out.push(await QuotationCharge.create({
            quotationId, head,
            buyRate: parseFloat(c.buyRate) || 0, sellRate: parseFloat(c.sellRate) || 0,
            currency: code, roe, qty: parseFloat(c.qty) || 1,
            basis: c.basis ? String(c.basis).slice(0, 40) : null,
            remarks: c.remarks ? String(c.remarks).slice(0, 200) : null,
            sortOrder: i++,
        }));
    }
    return out;
}

router.post('/quotes', async (req, res) => {
    try {
        const b = req.body || {};
        const errors = [];
        if (!String(b.clientName || '').trim()) errors.push('Client name is required');
        if (!Array.isArray(b.charges) || !b.charges.filter(c => String(c.head || '').trim()).length) errors.push('A quotation needs at least one charge line');
        const date = String(b.date || today()).slice(0, 10);
        if (b.validUntil && String(b.validUntil).slice(0, 10) < date) errors.push('Valid-until is before the quote date');
        if (b.leadId && !await Lead.findByPk(b.leadId)) errors.push('That lead does not exist');
        if (errors.length) return res.status(400).json({ success: false, error: errors.join('; '), errors });

        const row = await Quotation.create({
            quoteNo: String(b.quoteNo || '').trim() || await nextNo(Quotation, 'quoteNo', 'QT'),
            leadId: b.leadId || null, date, validUntil: b.validUntil ? String(b.validUntil).slice(0, 10) : null,
            partyLedgerId: b.partyLedgerId || null, clientName: String(b.clientName).trim(),
            contactPerson: b.contactPerson || null, email: b.email || null,
            origin: b.origin || null, destination: b.destination || null,
            mode: b.mode || null, commodity: b.commodity || null, remarks: b.remarks || null,
            status: 'DRAFT',
            createdBy: (req.user && req.user.id) || null,
            createdByName: (req.user && (req.user.fullName || req.user.username)) || null,
        });
        let lines;
        try { lines = await saveCharges(row.id, b.charges); }
        catch (e) { await row.destroy(); return res.status(400).json({ success: false, error: e.message }); }
        const t = totalsOf(lines);
        await row.update({ totalBuyInr: t.buy, totalSellInr: t.sell });
        if (row.leadId) {
            const lead = await Lead.findByPk(row.leadId);
            if (lead && lead.status === 'NEW') await lead.update({ status: 'QUOTED' });
        }
        res.json({ success: true, data: { ...row.toJSON(), charges: lines, marginInr: r2(t.sell - t.buy) } });
    } catch (err) {
        if (String(err.message).includes('unique')) return res.status(400).json({ success: false, error: 'That quote number already exists' });
        res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/quotes/:id', async (req, res) => {
    try {
        const row = await Quotation.findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'Quotation not found' });
        const b = req.body || {};
        if (b.status !== undefined) {
            const st = String(b.status).toUpperCase();
            if (!QUOTE_STATUS.includes(st)) return res.status(400).json({ success: false, error: 'Status must be one of ' + QUOTE_STATUS.join(', ') });
            if (st === 'REJECTED' && !String(b.rejectReason || row.rejectReason || '').trim()) {
                return res.status(400).json({ success: false, error: 'Record why it was rejected' });
            }
            if (row.status === 'CONVERTED' && st !== 'CONVERTED') {
                return res.status(400).json({ success: false, error: 'This quote is already a job - its status cannot be moved back' });
            }
        }
        const v = {};
        ['clientName', 'contactPerson', 'email', 'origin', 'destination', 'mode', 'commodity', 'remarks', 'rejectReason']
            .forEach(k => { if (b[k] !== undefined) v[k] = b[k] === '' ? null : b[k]; });
        if (b.validUntil !== undefined) v.validUntil = b.validUntil ? String(b.validUntil).slice(0, 10) : null;
        if (b.status !== undefined) {
            v.status = String(b.status).toUpperCase();
            if (['APPROVED', 'REJECTED'].includes(v.status)) v.decidedAt = new Date();
        }
        await row.update(v);
        if (Array.isArray(b.charges)) {
            let lines;
            try { lines = await saveCharges(row.id, b.charges); }
            catch (e) { return res.status(400).json({ success: false, error: e.message }); }
            const t = totalsOf(lines);
            await row.update({ totalBuyInr: t.buy, totalSellInr: t.sell });
        }
        // an approved quote decides the lead
        if (row.leadId && v.status) {
            const lead = await Lead.findByPk(row.leadId);
            if (lead) {
                if (v.status === 'APPROVED' && lead.status !== 'WON') await lead.update({ status: 'WON' });
                if (v.status === 'REJECTED' && lead.status === 'QUOTED') await lead.update({ status: 'LOST', lostReason: v.rejectReason || 'Quotation rejected' });
            }
        }
        const charges = await QuotationCharge.findAll({ where: { quotationId: row.id }, order: [['sortOrder', 'ASC']] });
        res.json({ success: true, data: { ...row.toJSON(), charges } });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/sales/quotes/:id/send  - records that it went out, and to whom
router.post('/quotes/:id/send', async (req, res) => {
    try {
        const row = await Quotation.findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'Quotation not found' });
        const to = String((req.body && req.body.to) || row.email || '').trim();
        if (!to) return res.status(400).json({ success: false, error: 'No email address for this client - add one on the quote or the lead' });
        await row.update({ status: row.status === 'DRAFT' ? 'SENT' : row.status, sentAt: new Date(), sentTo: to });
        res.json({ success: true, data: row, note: 'Recorded as sent to ' + to + '. The mail itself goes through /api/email/send.' });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/sales/quotes/:id/convert  - turn an approved quote into a job
router.post('/quotes/:id/convert', async (req, res) => {
    try {
        const row = await Quotation.findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'Quotation not found' });
        if (row.status === 'CONVERTED') return res.status(400).json({ success: false, error: 'Already converted to job ' + row.jobNo });
        if (row.status !== 'APPROVED') return res.status(400).json({ success: false, error: 'Only an approved quotation can become a job - this one is ' + row.status });
        const jobNo = String((req.body && req.body.jobNo) || '').trim();
        if (!jobNo) return res.status(400).json({ success: false, error: 'Give the job number this quote becomes, so the two can be matched later' });
        await row.update({ status: 'CONVERTED', jobNo });
        if (row.leadId) {
            const lead = await Lead.findByPk(row.leadId);
            if (lead) await lead.update({ status: 'WON' });
        }
        res.json({ success: true, data: row });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/quotes/:id', async (req, res) => {
    try {
        const row = await Quotation.findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'Quotation not found' });
        if (row.status === 'CONVERTED') return res.status(400).json({ success: false, error: 'This quote is already job ' + row.jobNo + ' - it cannot be deleted' });
        await QuotationCharge.destroy({ where: { quotationId: row.id } });
        await row.destroy();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
