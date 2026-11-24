// Credit Control & Ageing.
//
// 30-Oct-2026: the screen behind this route was entirely invented - four hardcoded customers
// ("Apex Global Logistics  12,50,000", "TechCorp Exports  34,00,000"), hardcoded KPI cards, a
// hardcoded pending-invoice table, two made-up "Communication History" entries, an invented
// reconciliation result and three read-only switches. Every figure here now comes from the
// ledger, the follow-ups are stored, and the switches are saved.
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const AccountLedger = require('../models/AccountLedger');
const CreditFollowUp = require('../models/CreditFollowUp');
const CreditPolicy = require('../models/CreditPolicy');
const { openItems, buckets15, buckets30 } = require('../utils/openItems');

const r2 = (n) => Math.round((n || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

// Risk is derived, never guessed: it is stated with the reason so nobody has to wonder.
function riskOf({ overLimit, b60, b90, total }) {
    if (overLimit) return { risk: 'High', why: 'Outstanding is over the credit limit' };
    if (b90 > 0) return { risk: 'High', why: 'Money outstanding beyond 60 days' };
    if (b60 > 0) return { risk: 'Medium', why: 'Money outstanding 31-60 days' };
    if (total > 0) return { risk: 'Low', why: 'Nothing older than 30 days' };
    return { risk: 'None', why: 'Nothing outstanding' };
}

// GET /api/credit-control/ageing?type=receivable&asOn=
router.get('/ageing', async (req, res) => {
    try {
        const asOn = req.query.asOn || today();
        const type = req.query.type || 'receivable';
        const { items, ledgers, basis, note } = await openItems({ type, asOn });

        const byLedger = new Map();
        items.forEach(i => {
            if (!byLedger.has(i.ledgerId)) byLedger.set(i.ledgerId, []);
            byLedger.get(i.ledgerId).push(i);
        });

        const policies = await CreditPolicy.findAll();
        const polBy = new Map(policies.map(p => [p.ledgerId, p]));

        // open promises to pay, from the follow-up log - this is what "expected" means here
        const in7 = new Date(new Date(asOn).getTime() + 7 * 86400000).toISOString().slice(0, 10);
        const promises = await CreditFollowUp.findAll({
            where: { promiseDate: { [Op.ne]: null }, promiseMet: { [Op.or]: [null, false] } },
            order: [['promiseDate', 'ASC']],
        });

        const clients = [];
        ledgers.forEach(led => {
            const mine = byLedger.get(led.id) || [];
            if (!mine.length) return;                                  // nothing outstanding - not a credit case
            const total = r2(mine.reduce((a, i) => a + i.pending, 0));
            const b = buckets15(mine);
            const creditLimit = r2(parseFloat(led.creditLimit) || 0);
            const overLimit = creditLimit > 0 && total > creditLimit;
            const { risk, why } = riskOf({ overLimit, b60: b.b60, b90: b.b90, total });
            const pol = polBy.get(led.id);
            const myPromises = promises.filter(p => p.ledgerId === led.id);
            clients.push({
                id: led.id, ledgerId: led.id, name: led.name,
                totalOut: total, buckets: b,
                creditLimit, creditDays: parseInt(led.creditDays, 10) || 0,
                utilisationPct: creditLimit > 0 ? Math.round((total / creditLimit) * 1000) / 10 : null,
                overLimit, risk, riskWhy: why,
                phone: led.phone || '', email: led.email || '', contactPerson: led.contactPerson || '',
                gstin: led.gstin || '', billCount: mine.length,
                oldestOverdueDays: Math.max(0, ...mine.map(i => i.overdueDays)),
                nextPromise: myPromises.length ? { date: myPromises[0].promiseDate, amount: r2(parseFloat(myPromises[0].promiseAmount) || 0) } : null,
                policy: pol ? {
                    autoSendLedger: pol.autoSendLedger, autoSendDays: pol.autoSendDays,
                    overdueReminders: pol.overdueReminders, reminderAfterDays: pol.reminderAfterDays,
                    autoHoldDelivery: pol.autoHoldDelivery,
                } : null,
            });
        });
        clients.sort((a, b2) => b2.totalOut - a.totalOut);

        const all30 = buckets30(items);
        const expectedThisWeek = r2(promises
            .filter(p => String(p.promiseDate) >= asOn && String(p.promiseDate) <= in7)
            .reduce((a, p) => {
                const amt = parseFloat(p.promiseAmount) || 0;
                if (amt) return a + amt;
                // no amount promised: fall back to what that party actually owes
                const c = clients.find(x => x.ledgerId === p.ledgerId);
                return a + (c ? c.totalOut : 0);
            }, 0));

        res.json({
            success: true, asOn, type, basis, note,
            clients,
            kpis: {
                totalOutstanding: r2(items.reduce((a, i) => a + i.pending, 0)),
                notDue: all30.notDue,
                overdue1to30: all30.days30,
                overdue31to60: all30.days60,
                critical60plus: r2(all30.days90 + all30.over90),
                expectedThisWeek,
                promisesCounted: promises.filter(p => String(p.promiseDate) >= asOn && String(p.promiseDate) <= in7).length,
                partiesOverLimit: clients.filter(c => c.overLimit).length,
                partiesWithoutLimit: clients.filter(c => !c.creditLimit).length,
            },
            noteExpected: 'Expected this week is the sum of open Promise-to-Pay dates in the follow-up log between ' +
                asOn + ' and ' + in7 + '. With no promises logged it is zero - it is not a forecast.',
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/credit-control/party/:ledgerId?asOn=
router.get('/party/:ledgerId', async (req, res) => {
    try {
        const id = parseInt(req.params.ledgerId, 10);
        const led = await AccountLedger.findByPk(id);
        if (!led) return res.status(404).json({ success: false, error: 'Ledger not found' });
        const asOn = req.query.asOn || today();
        const { items, basis } = await openItems({ type: req.query.type || 'receivable', asOn });
        const mine = items.filter(i => i.ledgerId === id);
        const followUps = await CreditFollowUp.findAll({ where: { ledgerId: id }, order: [['createdAt', 'DESC']], limit: 100 });
        let policy = await CreditPolicy.findOne({ where: { ledgerId: id } });
        res.json({
            success: true, asOn, basis,
            party: {
                id: led.id, name: led.name, phone: led.phone || '', email: led.email || '',
                contactPerson: led.contactPerson || '', gstin: led.gstin || '', address: led.address || '',
                creditLimit: r2(parseFloat(led.creditLimit) || 0), creditDays: parseInt(led.creditDays, 10) || 0,
            },
            bills: mine, buckets: buckets15(mine), total: r2(mine.reduce((a, i) => a + i.pending, 0)),
            followUps, policy,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/credit-control/followups
router.post('/followups', async (req, res) => {
    try {
        const b = req.body || {};
        const ledgerId = parseInt(b.ledgerId, 10);
        if (!ledgerId) return res.status(400).json({ success: false, error: 'Pick a customer first' });
        if (!await AccountLedger.findByPk(ledgerId)) return res.status(404).json({ success: false, error: 'Ledger ' + ledgerId + ' not found' });
        const note = String(b.note || '').trim();
        if (!note) return res.status(400).json({ success: false, error: 'Write what was said - a follow-up with no note is no record' });
        const channel = String(b.channel || 'CALL').toUpperCase();
        if (!['CALL', 'EMAIL', 'VISIT', 'WHATSAPP', 'SYSTEM'].includes(channel)) {
            return res.status(400).json({ success: false, error: 'Channel must be CALL, EMAIL, VISIT, WHATSAPP or SYSTEM' });
        }
        let promiseDate = b.promiseDate ? String(b.promiseDate).slice(0, 10) : null;
        if (promiseDate && !/^\d{4}-\d{2}-\d{2}$/.test(promiseDate)) return res.status(400).json({ success: false, error: 'Promise date must be a date' });
        const amt = b.promiseAmount === '' || b.promiseAmount == null ? null : parseFloat(b.promiseAmount);
        if (amt != null && !Number.isFinite(amt)) return res.status(400).json({ success: false, error: 'Promised amount must be a number' });
        const row = await CreditFollowUp.create({
            ledgerId, note, channel, promiseDate, promiseAmount: amt,
            refNo: b.refNo ? String(b.refNo).slice(0, 80) : null,
            createdBy: (req.user && req.user.id) || null,
            createdByName: (req.user && (req.user.fullName || req.user.username)) || null,
        });
        res.json({ success: true, data: row });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/credit-control/followups/:id  - mark a promise kept or broken
router.put('/followups/:id', async (req, res) => {
    try {
        const row = await CreditFollowUp.findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'Follow-up not found' });
        const v = {};
        if (req.body.promiseMet !== undefined) v.promiseMet = req.body.promiseMet === null ? null : !!req.body.promiseMet;
        if (req.body.note !== undefined && String(req.body.note).trim()) v.note = String(req.body.note).trim();
        await row.update(v);
        res.json({ success: true, data: row });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/credit-control/policy/:ledgerId
router.put('/policy/:ledgerId', async (req, res) => {
    try {
        const ledgerId = parseInt(req.params.ledgerId, 10);
        if (!await AccountLedger.findByPk(ledgerId)) return res.status(404).json({ success: false, error: 'Ledger not found' });
        const b = req.body || {};
        const v = { ledgerId };
        ['autoSendLedger', 'overdueReminders', 'autoHoldDelivery'].forEach(k => { if (b[k] !== undefined) v[k] = !!b[k]; });
        if (b.autoSendDays !== undefined) {
            const days = String(b.autoSendDays || '').split(',').map(x => parseInt(x, 10)).filter(x => x >= 1 && x <= 31);
            v.autoSendDays = days.length ? days.join(',') : null;
        }
        if (b.reminderAfterDays !== undefined) {
            const n = parseInt(b.reminderAfterDays, 10);
            if (!(n >= 0 && n <= 365)) return res.status(400).json({ success: false, error: 'Reminder-after days must be between 0 and 365' });
            v.reminderAfterDays = n;
        }
        if (b.notes !== undefined) v.notes = b.notes ? String(b.notes) : null;
        v.updatedByName = (req.user && (req.user.fullName || req.user.username)) || null;
        let row = await CreditPolicy.findOne({ where: { ledgerId } });
        if (row) await row.update(v); else row = await CreditPolicy.create(v);
        res.json({ success: true, data: row });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------------
// POST /api/credit-control/ledger-match
// The "Upload Client's Ledger" box claimed an AI engine would read the statement
// and showed an invented result. There is no AI here and none is needed: the
// browser reads the Excel / CSV (it already has the xlsx library) and posts the
// rows, and this matches them against our own open items by bill number and amount.
// A PDF cannot be matched reliably, so it is refused rather than guessed at.
// body: { ledgerId, rows: [ { ref, date, debit, credit, amount } ] }
// ---------------------------------------------------------------------------
router.post('/ledger-match', async (req, res) => {
    try {
        const b = req.body || {};
        const ledgerId = parseInt(b.ledgerId, 10);
        if (!ledgerId) return res.status(400).json({ success: false, error: 'Pick the customer whose ledger this is' });
        const led = await AccountLedger.findByPk(ledgerId);
        if (!led) return res.status(404).json({ success: false, error: 'Ledger not found' });
        const rows = Array.isArray(b.rows) ? b.rows : [];
        if (!rows.length) return res.status(400).json({ success: false, error: 'No rows came through. The file needs a column with the invoice / reference number and a column with the amount.' });
        const tol = Math.max(0, parseFloat(b.tolerance != null ? b.tolerance : 1));

        const { items } = await openItems({ type: 'receivable', asOn: b.asOn || today() });
        const ours = items.filter(i => i.ledgerId === ledgerId).map(i => ({ ...i, used: false }));

        const key = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '');
        const num = (x) => { const n = parseFloat(String(x == null ? '' : x).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };

        const matched = [], variances = [], theirsOnly = [];
        rows.forEach((row, idx) => {
            const ref = String(row.ref || row.reference || row.invoice || row.docNo || row.particulars || '').trim();
            // in a customer's ledger OUR invoice is a credit to them; accept either column
            const amt = row.amount != null ? Math.abs(num(row.amount)) : Math.abs(num(row.credit)) || Math.abs(num(row.debit));
            if (!ref && !amt) return;                                         // a blank or heading row
            const rk = key(ref);
            let mine = rk ? ours.find(o => !o.used && (key(o.refNo) === rk || key(o.billNo) === rk)) : null;
            let how = mine ? 'reference' : '';
            if (!mine && amt) { mine = ours.find(o => !o.used && Math.abs(o.pending - amt) <= tol); if (mine) how = 'amount'; }
            if (!mine) { theirsOnly.push({ line: idx + 1, ref, amount: r2(amt), date: row.date || '' }); return; }
            mine.used = true;
            const diff = r2(mine.pending - amt);
            if (Math.abs(diff) <= tol) {
                matched.push({ ref: mine.refNo, billNo: mine.billNo, date: mine.date, ours: mine.pending, theirs: r2(amt), matchedOn: how });
            } else {
                variances.push({ ref: mine.refNo, billNo: mine.billNo, date: mine.date, ours: mine.pending, theirs: r2(amt), diff, matchedOn: how,
                    hint: diff > 0 ? 'They show less - TDS deducted, a credit note we have not booked, or a part payment' : 'They show more - a payment we have booked that they have not, or a double entry' });
            }
        });
        const oursOnly = ours.filter(o => !o.used).map(o => ({ ref: o.refNo, billNo: o.billNo, date: o.date, ours: o.pending, overdueDays: o.overdueDays }));

        const sum = (arr, k) => r2(arr.reduce((a, x) => a + (x[k] || 0), 0));
        res.json({
            success: true, party: led.name, ledgerId,
            matched, variances, oursOnly, theirsOnly,
            totals: {
                ourBooks: sum(ours, 'pending'),
                theirLedger: r2(sum(matched, 'theirs') + sum(variances, 'theirs') + sum(theirsOnly, 'amount')),
                matchedValue: sum(matched, 'ours'),
                varianceValue: sum(variances, 'diff'),
                inOurBooksOnly: sum(oursOnly, 'ours'),
                inTheirLedgerOnly: sum(theirsOnly, 'amount'),
            },
            counts: { rowsRead: rows.length, matched: matched.length, variances: variances.length, oursOnly: oursOnly.length, theirsOnly: theirsOnly.length },
            note: 'Matched on reference first, then on amount within ' + tol + ' rupee(s). Rows we could not pair are listed as-is, not dropped. ' +
                  'Open items are FIFO because no receipt in this database carries a bill-wise reference.',
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
