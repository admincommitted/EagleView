// Open receivable / payable items, FIFO.
//
// 30-Oct-2026: this was inline in routes/vouchers.js GET /outstanding. The Credit Control screen needs
// exactly the same figures with different ageing buckets, and two copies of this would drift apart, so it
// lives here and both read it. The behaviour is unchanged - the outstanding regression test proves that.
//
// This database keeps no bill-wise reference on a receipt, so payments are applied oldest-bill-first.
// That is stated on every screen that shows these numbers rather than being hidden.
const { Op, QueryTypes } = require('sequelize');
const Voucher = require('../models/Voucher');
const VoucherDetail = require('../models/VoucherDetail');
const AccountLedger = require('../models/AccountLedger');
const AccountGroup = require('../models/AccountGroup');
const VoucherAllocation = require('../models/VoucherAllocation');
const bs = require('./branchScope'); // 06-Nov-2026: top-bar branch scope

const BASIS_FIFO = 'FIFO by voucher date (no bill-wise allocation on these receipts)';
const BASIS_MIXED = 'Bill-wise where the receipt was allocated, FIFO for the rest';
const BASIS_ALLOC = 'Bill-wise, from the allocation recorded on each receipt';
const BASIS_ICAFFE = 'Bill-wise as in iCAFFE\'s outstanding report on its date (on-account amounts set against the oldest bills only for receipts after it)';
// kept for callers that only want a label
const BASIS = BASIS_FIFO;

async function openItems({ type = 'receivable', asOn = null, ledgerId = null } = {}) {
    const on = asOn || new Date().toISOString().slice(0, 10);
    const wantDr = String(type).toLowerCase() !== 'payable';   // debtors carry a Dr balance, creditors a Cr one
    const groupName = wantDr ? 'Sundry Debtors' : 'Sundry Creditors';

    const root = await AccountGroup.findOne({ where: { name: groupName } });
    if (!root) return { items: [], ledgers: [], asOn: on, basis: BASIS, note: 'No "' + groupName + '" group in the chart of accounts yet' };

    // the group and everything under it
    const all = await AccountGroup.findAll();
    const ids = new Set([root.id]);
    let grew = true;
    while (grew) { grew = false; all.forEach(g => { if (g.parentId && ids.has(g.parentId) && !ids.has(g.id)) { ids.add(g.id); grew = true; } }); }

    // ledgerId: just that party (the Payment / Receipt screen's due bills)
    const ledgers = await AccountLedger.findAll({ where: ledgerId ? { groupId: { [Op.in]: [...ids] }, id: Number(ledgerId) } : { groupId: { [Op.in]: [...ids] } } });
    if (!ledgers.length) return { items: [], ledgers: [], asOn: on, basis: BASIS };

    // 05-Nov-2026: plain query + lines grouped per ledger - with the iCAFFE history (lakhs of lines) the model
    // include and the per-ledger filter took minutes. Same rows, same fields as before.
    const ledIds = ledgers.map(l => Number(l.id)).filter(Number.isFinite);
    const raw = await VoucherDetail.sequelize.query(
        `SELECT d.ledgerId, d.dc, d.amount, v.id vid, v.voucherNumber, v.date, v.narration, v.refNo, v.jobNo
           FROM AccountLedgers l CROSS JOIN VoucherDetails d ON d.ledgerId = l.id JOIN Vouchers v ON v.id = d.voucherId
          WHERE l.id IN (${ledIds.join(',') || '0'}) AND v.date <= ?`,
        { replacements: [on], type: QueryTypes.SELECT });
    const linesBy = new Map();
    for (const r of raw) {
        const x = { ledgerId: r.ledgerId, dc: r.dc, amount: r.amount, Voucher: { id: r.vid, voucherNumber: r.voucherNumber, date: r.date, narration: r.narration, refNo: r.refNo, jobNo: r.jobNo } };
        if (!linesBy.has(r.ledgerId)) linesBy.set(r.ledgerId, []); linesBy.get(r.ledgerId).push(x);
    }

    // 30-Oct-2026: receipts can now carry a bill-wise allocation. Where one exists it is used
    // exactly; only the unallocated remainder falls back to FIFO. Before this, everything was FIFO.
    const allocs = await VoucherAllocation.findAll({ where: { ledgerId: { [Op.in]: ledgers.map(l => l.id) } } });
    const allocByLedger = new Map();
    const allocatedVoucherIds = new Set();
    allocs.forEach(a => {
        if (!allocByLedger.has(a.ledgerId)) allocByLedger.set(a.ledgerId, []);
        allocByLedger.get(a.ledgerId).push(a);
        allocatedVoucherIds.add(a.voucherId);
    });

    // 06-Nov-2026: iCAFFE's bill-wise outstanding, read party by party (load_icaffe_outstanding). Where a party has
    // it, its open bills and on-account amounts as at that date are taken exactly as iCAFFE shows them; only what
    // happens after that date (new bills, receipts, set-offs made here) is worked out below.
    const snapBy = new Map();
    try {
        const snap = await VoucherDetail.sequelize.query(
            // a bill shows for the branch of its voucher (the Vouchers read is limited to the branches in scope);
            // a bill with no voucher here (before Apr-2022) belongs with the opening, i.e. the default branch
            `SELECT s.* FROM AccOutstandingSnapshot s LEFT JOIN Vouchers v ON v.id = s.voucherId
              WHERE s.side = ? AND s.ledgerId IN (${ledIds.join(',') || '0'}) AND (v.id IS NOT NULL OR (s.voucherId IS NULL AND ${bs.openingOn() ? 1 : 0} = 1))
              ORDER BY s.billDate, s.id`,
            { replacements: [wantDr ? 'R' : 'P'], type: QueryTypes.SELECT });
        for (const r of snap) { if (!snapBy.has(r.ledgerId)) snapBy.set(r.ledgerId, []); snapBy.get(r.ledgerId).push(r); }
    } catch (e) { /* no snapshot table yet */ }
    let usedSnapshot = false;

    const items = [];
    let usedAllocation = false, usedFifo = false, usedMatch = false;
    for (const led of ledgers) {
        const mine0 = linesBy.get(led.id) || [];
        const snap = snapBy.get(led.id);
        // used only for an as-on date on or after the snapshot's own date
        const snapOn = snap && snap.length && String(snap[0].asOn || '').slice(0, 10) <= on ? String(snap[0].asOn).slice(0, 10) : null;
        // with a snapshot only the lines after its date count; everything up to it is in the snapshot
        const mine = snapOn ? mine0.filter(d => String((d.Voucher || {}).date || '').slice(0, 10) > snapOn) : mine0;
        const bills = [], payments = []; const onAccSnap = []; const payBy = new Map(); // voucher -> one receipt / note
        if (snapOn) {
            usedSnapshot = true;
            for (const r of snap) {
                const bal = parseFloat(r.balance) || 0;
                // balance is signed the party's way: + the party owes (receivable Dr / payable Cr), - an advance.
                // An on-account entry that the party owes (a debit note or journal not raised as a bill) is an open item.
                if (r.kind === 'ONACC' && bal < -0.009) { onAccSnap.push(r); continue; }
                if (bal <= 0.009) continue;
                bills.push({ date: r.billDate, voucherNumber: r.billNo || r.voucherNo || '', narration: r.narration || '', refNo: r.voucherNo || r.billNo || '', jobNo: r.docket || '', voucherId: r.voucherId || null, amount: bal, original: parseFloat(r.amount) || bal });
            }
        }
        // the opening balance is the oldest open item when it is on the side that owes
        const ob = snapOn || !bs.openingOn() ? 0 : parseFloat(led.openingBalance || 0); // opening = default branch only
        if (ob > 0 && ((wantDr && led.balanceType === 'Dr') || (!wantDr && led.balanceType === 'Cr'))) {
            bills.push({ date: null, voucherNumber: 'Opening balance', narration: '', refNo: '', jobNo: '', voucherId: null, amount: ob });
        } else if (ob > 0) { payments.push({ amount: ob }); }
        mine.forEach(d => {
            const amt = parseFloat(d.amount) || 0;
            const v = d.Voucher || {};
            const increases = wantDr ? d.dc === 'Dr' : d.dc === 'Cr';
            if (increases) bills.push({ date: v.date, voucherNumber: v.voucherNumber, narration: v.narration || '', refNo: v.refNo || '', jobNo: v.jobNo || '', voucherId: v.id || null, amount: amt });
            // a receipt that was allocated bill-wise is applied below, not thrown into the FIFO pool
            else if (!(v.id && allocatedVoucherIds.has(v.id))) {
                // 09-Nov-2026: one entry per voucher (a receipt split into TDS + bank lines is one payment)
                const key = v.id ? 'v' + v.id : 'x' + payments.length;
                if (payBy.has(key)) payBy.get(key).amount += amt;
                else { const p = { amount: amt, date: v.date, narration: v.narration || '', voucherNumber: v.voucherNumber || '' }; payBy.set(key, p); payments.push(p); }
            }
        });
        bills.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

        // apply the explicit allocations first
        const knockedOff = new Map();     // billVoucherId -> amount, and refNo -> amount for older rows
        const onAccount = [];
        (allocByLedger.get(led.id) || []).forEach(a => {
            const amt = parseFloat(a.amount) || 0;
            if (!amt) return;
            usedAllocation = true;
            if (a.againstVoucherId) knockedOff.set('v' + a.againstVoucherId, (knockedOff.get('v' + a.againstVoucherId) || 0) + amt);
            else if (a.refNo) knockedOff.set('r' + String(a.refNo).toUpperCase(), (knockedOff.get('r' + String(a.refNo).toUpperCase()) || 0) + amt);
            else onAccount.push(amt);     // an advance / on-account receipt behaves like a FIFO payment
        });
        // 09-Nov-2026: before FIFO, a receipt / credit note goes to the bill it names (its bill no in the narration) and
        // then to a bill of exactly the same amount (the oldest such bill on or before it). iCAFFE's history keeps no
        // bill-wise reference for many receipts; FIFO alone set e.g. a receipt of 6,25,086 that paid bill T011 of
        // 6,25,086 against an older bill and left T011 open. Whatever is not matched this way still goes FIFO.
        const left0 = bills.map(b => { const d = (knockedOff.get('v' + b.voucherId) || 0) + (knockedOff.get('r' + String(b.refNo || '').toUpperCase()) || 0); return Math.max(0, b.amount - Math.min(d, b.amount)); });
        const matched = bills.map(() => 0);
        const pays = payments.filter(p => p.voucherNumber !== undefined);
        if (pays.length) {
            const byNo = new Map(), byAmt = new Map();
            bills.forEach((b, i) => {
                const no = String(b.voucherNumber || '').toUpperCase().trim(); if (no.length >= 6) { if (!byNo.has(no)) byNo.set(no, []); byNo.get(no).push(i); }
                const k = Math.round(b.amount); if (!byAmt.has(k)) byAmt.set(k, []); byAmt.get(k).push(i);
            });
            // bill nos named in the narration, e.g. "INV#DL/26/SI/T006", "AGAINST DL/26/AI/0005041"
            const RX = /[A-Z]{2,3}\/\d{2}\/[A-Z]{1,4}\/[A-Z]{0,2}\d{2,7}(?![A-Z0-9])/g;
            for (const p of pays) {
                const own = String(p.voucherNumber || '').toUpperCase();
                for (const m of String(p.narration || '').toUpperCase().match(RX) || []) {
                    if (p.amount <= 0.009 || m === own) continue;
                    for (const i of byNo.get(m) || []) {
                        const free = left0[i] - matched[i]; if (free <= 0.009) continue;
                        const u = Math.min(free, p.amount); matched[i] += u; p.amount -= u; usedMatch = true;
                    }
                }
            }
            for (const p of pays) { // a bill of exactly the same amount, still fully open, dated on or before the receipt
                if (p.amount <= 0.009) continue;
                for (const i of byAmt.get(Math.round(p.amount)) || []) {
                    const free = left0[i] - matched[i];
                    if (Math.abs(free - p.amount) < 0.5 && Math.abs(bills[i].amount - free) < 0.5 && (!bills[i].date || !p.date || String(bills[i].date).slice(0, 10) <= String(p.date).slice(0, 10))) { matched[i] += p.amount; p.amount = 0; usedMatch = true; break; }
                }
            }
        }
        let pool = payments.reduce((a, b) => a + b.amount, 0) + onAccount.reduce((a, b) => a + b, 0);
        if (pool > 0.009) usedFifo = true;
        for (let bi = 0; bi < bills.length; bi++) {
            const b = bills[bi];
            const direct = (knockedOff.get('v' + b.voucherId) || 0) + (knockedOff.get('r' + String(b.refNo || '').toUpperCase()) || 0) + matched[bi];
            let used = Math.min(direct, b.amount);
            const left = b.amount - used;
            // whatever the allocation did not cover is still open to the FIFO pool
            const fromPool = Math.min(pool, left);
            pool -= fromPool;
            used += fromPool;
            const pending = Math.round((b.amount - used) * 100) / 100;
            if (pending <= 0.009) continue;
            const days = parseInt(led.creditDays, 10) || 0;
            const due = b.date ? new Date(new Date(b.date).getTime() + days * 86400000).toISOString().slice(0, 10) : null;
            const overdueDays = due ? Math.floor((new Date(on) - new Date(due)) / 86400000) : 0;
            items.push({
                id: led.id + '-' + (b.voucherNumber || '') + '-' + (b.date || ''), ledgerId: led.id,
                party: led.name, refNo: b.voucherNumber || '', billNo: b.refNo || '', jobNo: b.jobNo || '',
                voucherId: b.voucherId, narration: b.narration,
                date: b.date, dueDate: due, amount: Math.round((b.original || b.amount) * 100) / 100, pending, overdueDays,
            });
        }
        // iCAFFE's on-account amounts (receipts / payments not set against any bill) stay as they are, shown as minus
        // lines, so the party total is the same as iCAFFE's; the receipt can still be set off here later
        for (const r of onAccSnap) {
            const bal = -Math.round((parseFloat(r.balance) || 0) * 100) / 100;
            items.push({
                id: led.id + '-onacc-' + (r.voucherNo || r.billNo || '') + '-' + (r.billDate || ''), ledgerId: led.id,
                party: led.name, refNo: r.voucherNo || r.billNo || 'On account', billNo: 'On account', jobNo: '', voucherId: r.voucherId || null,
                narration: 'On account (not set against a bill in iCAFFE)', date: r.billDate, dueDate: r.billDate,
                amount: -bal, pending: -bal, overdueDays: 0, onAccount: true,
            });
        }
    }
    items.sort((a, b) => b.overdueDays - a.overdueDays);
    let basis = usedAllocation && usedFifo ? BASIS_MIXED : usedAllocation ? BASIS_ALLOC : BASIS_FIFO;
    if (usedSnapshot) basis = BASIS_ICAFFE + (usedAllocation ? '; set-offs made here after that date applied' : '');
    if (usedMatch) basis += '; receipts without a set-off go to the bill they name or a bill of the same amount, the rest FIFO';
    return { items, ledgers, asOn: on, basis };
}

// the 30 / 60 / 90 buckets used by the Outstanding report
function buckets30(items) {
    const b = { notDue: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    items.forEach(i => {
        if (i.overdueDays <= 0) b.notDue += i.pending;
        else if (i.overdueDays <= 30) b.days30 += i.pending;
        else if (i.overdueDays <= 60) b.days60 += i.pending;
        else if (i.overdueDays <= 90) b.days90 += i.pending;
        else b.over90 += i.pending;
    });
    Object.keys(b).forEach(k => { b[k] = Math.round(b[k] * 100) / 100; });
    return b;
}

// The Credit Control ageing bar. notDue is kept separate from the 0-15 overdue band on purpose:
// money still within the customer's credit days is not a collection problem, and lumping the two
// together (which the old hardcoded screen did) makes a healthy account look overdue.
function buckets15(items) {
    const b = { notDue: 0, b15: 0, b30: 0, b60: 0, b90: 0 };
    items.forEach(i => {
        const d = i.overdueDays;
        if (d <= 0) b.notDue += i.pending;
        else if (d <= 15) b.b15 += i.pending;
        else if (d <= 30) b.b30 += i.pending;
        else if (d <= 60) b.b60 += i.pending;
        else b.b90 += i.pending;
    });
    Object.keys(b).forEach(k => { b[k] = Math.round(b[k] * 100) / 100; });
    return b;
}

module.exports = { openItems, buckets30, buckets15, BASIS, BASIS_FIFO, BASIS_MIXED, BASIS_ALLOC };
