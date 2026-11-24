const express = require('express');
const router = express.Router();
const { sequelize } = require('../db');
const Voucher = require('../models/Voucher');
const VoucherDetail = require('../models/VoucherDetail');
const VoucherType = require('../models/VoucherType');
const AccountLedger = require('../models/AccountLedger');

// 1. Get next auto-generated voucher number
router.get('/next-number/:typeId', async (req, res) => {
    try {
        const type = await VoucherType.findByPk(req.params.typeId);
        if (!type) return res.status(404).json({ error: 'Voucher type not found' });
        
        // 05-Nov-2026: with iCAFFE number series the number is given on Save (from the branch + division series)
        try {
            const ns = require('../utils/numberSeries'); await ns.ensure();
            if (type.baseType !== 'Sales') {
                const own = String(req.query.branch || '').toUpperCase() || await ns.defaultBranch();
                const div = ns.divOf(req.query.division || req.query.jobNo);
                const doc = await ns.voucherDoc(type.baseType, String(req.query.ledgers || '').split(',').filter(Boolean));
                if (await sequelize.query('SELECT 1 FROM NumberSeries WHERE docType = ? AND branchCode = ? LIMIT 1', { replacements: [doc, own], type: require('sequelize').QueryTypes.SELECT }).then(r => r.length)) {
                    const no = div ? await ns.peek(doc, { branchCode: own, division: div, date: req.query.date }) : null;
                    return res.json({ success: true, isAuto: true, icaffe: true, nextNumber: no ? no + ' (on Save)' : '', note: div ? '' : 'Choose the division - the number is given on Save' });
                }
            }
        } catch (e) { /* fall back to the old numbering */ }
        if (type.numberingMethod !== 'Automatic') {
            return res.json({ success: true, isAuto: false, nextNumber: '' });
        }

        // Find the latest voucher of this type to determine the next sequential number
        const count = await Voucher.count({ where: { voucherTypeId: type.id } });
        const seq = (type.startingNumber || 1) + count;
        
        const prefix = type.prefix || '';
        const suffix = type.suffix || '';
        const nextNumber = `${prefix}${seq}${suffix}`;

        res.json({ success: true, isAuto: true, nextNumber, seq });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Save a new voucher
router.post('/', async (req, res) => {
    // 04-Nov-2026: Trade Invoice "Hold Payment" - no payment may be set against a bill that is on hold
    try {
        const al = Array.isArray(req.body && req.body.allocations) ? req.body.allocations : [];
        const ids = al.map(a => a && a.againstVoucherId).filter(Boolean);
        if (ids.length) {
            const vt = await VoucherType.findByPk(req.body.voucherTypeId);
            if (vt && vt.baseType === 'Payment') {
                const held = await require('./accountsHub').heldBills(ids);
                if (held.length) return res.status(400).json({ error: 'Payment is on hold for bill ' + held.map(h => (h.billNo || h.voucherNumber) + (h.holdReason ? ' (' + h.holdReason + ')' : '')).join(', ') + ' - release it in the bill first' });
            }
        }
    } catch (e) { /* the check never stops a voucher for its own errors */ }
    const t = await sequelize.transaction();
    try {
        const { voucherTypeId, voucherNumber, date, narration, details, jobNo, branchCode, refNo, allocations } = req.body;
        // 04-Nov-2026: Accounts > Month Closing - no voucher in a closed month
        if (await require('./accountsHub').isMonthClosed(date)) throw new Error('Month ' + String(date).slice(0, 7) + ' is closed (Accounts > Month Closing). Re-open it to post this voucher.');
        // 04-Nov-2026: Accounts > Job Closing - no new voucher for a closed job
        if (jobNo && await require('./accountsHub').isJobClosed(jobNo)) throw new Error('Job ' + jobNo + ' is closed (Accounts > Job Closing). Re-open the job to post this voucher.');
        
        // Validate Dr/Cr totals
        let totalDr = 0;
        let totalCr = 0;
        details.forEach(d => {
            if (d.dc === 'Dr') totalDr += parseFloat(d.amount || 0);
            if (d.dc === 'Cr') totalCr += parseFloat(d.amount || 0);
        });

        if (Math.abs(totalDr - totalCr) > 0.01) {
            throw new Error('Total Debit must equal Total Credit');
        }

        if (totalDr <= 0) {
            throw new Error('Voucher must have a non-zero amount');
        }

        // 06-Nov-2026: ledger mix-up guard - every line an active ledger; a bill set-off only for this voucher's party,
        // against a bill of that same party
        {
            const lg = require('../utils/ledgerGuard');
            const lineIds = (details || []).map(d => d.ledgerId);
            if (lineIds.some(i => !i)) throw new Error('Every line needs a ledger - pick one from the list');
            await lg.checkLines(lineIds, t);
            if (Array.isArray(allocations) && allocations.length) await lg.checkAllocations(allocations.filter(a => parseFloat(a && a.amount) || 0), lineIds, null, t);
        }

        // 05-Nov-2026: iCAFFE numbering - bank book BA/NDL/AE/15931, cash book CA/NDL/AE/814, everything else JN/NDL/AE/10527,
        // from Settings > Number Series (iCAFFE) for our branch + division + year. The number is given on Save.
        const ns = require('../utils/numberSeries');
        let vno = voucherNumber; let division = null;
        {
            const vt = await VoucherType.findByPk(voucherTypeId, { transaction: t });
            const base = vt ? vt.baseType : '';
            if (base && base !== 'Sales') {
                await ns.ensure();
                const own = String(req.body.ownBranch || '').trim().toUpperCase() || await ns.defaultBranch(t);
                division = ns.divOf(req.body.division) || ns.divOf(jobNo) || null;
                const doc = await ns.voucherDoc(base, (details || []).map(d => d.ledgerId), t);
                const any = await sequelize.query('SELECT division FROM NumberSeries WHERE docType = ? AND branchCode = ? AND coalesce(isActive, 1) = 1', { replacements: [doc, own], type: require('sequelize').QueryTypes.SELECT, transaction: t });
                if (any.length) {
                    if (!division) throw new Error('Choose the Division (AE / AI / SE / SI) - the voucher no comes from that division\'s series, as in iCAFFE');
                    if (!any.some(r => r.division === division || r.division === '')) throw new Error('Number series not set for ' + doc + ', branch ' + own + ', division ' + division + ' - set it in Settings > Number Series (iCAFFE)');
                    vno = await ns.take(doc, { branchCode: own, division, date }, t);
                }
            }
        }

        // Create Header
        const voucher = await Voucher.create({
            voucherTypeId,
            voucherNumber: vno,
            date,
            narration,
            totalAmount: totalDr,
            // who raised it - the approvals screen shows this instead of a made-up name (30-Oct-2026)
            jobNo: jobNo || null,
            branchCode: branchCode || null,
            refNo: refNo || null,
            createdBy: (req.user && req.user.id) || null,
            createdByName: (req.user && (req.user.fullName || req.user.username)) || null
        }, { transaction: t });

        // Create Details
        const num = (x) => { const n = parseFloat(x); return Number.isFinite(n) ? n : null; };
        for (let d of details) {
            if (!d.ledgerId) throw new Error('Every line needs a ledger - pick one from the list');
            await VoucherDetail.create({
                voucherId: voucher.id,
                ledgerId: d.ledgerId,
                dc: d.dc,
                amount: parseFloat(d.amount || 0),
                // 30-Oct-2026: stored instead of dropped, so cost-centre and forex reports have something real to read
                costCentreId: d.costCentreId || null,
                currency: d.currency ? String(d.currency).toUpperCase().slice(0, 3) : null,
                roe: num(d.roe),
                amountFcy: num(d.amountFcy),
                remarks: d.remarks ? String(d.remarks).slice(0, 300) : null
            }, { transaction: t });
        }

        // 30-Oct-2026: bill-wise knock-off. Until now no receipt carried a bill reference, so every
        // outstanding figure had to fall back to FIFO. These rows make the allocation exact; the ones
        // nobody allocates still go through FIFO, so old data behaves as before.
        if (Array.isArray(allocations) && allocations.length) {
            const VoucherAllocation = require('../models/VoucherAllocation');
            const allocTotal = allocations.reduce((a2, x) => a2 + (parseFloat(x.amount) || 0), 0);
            if (allocTotal - totalDr > 0.01) {
                throw new Error('Allocated ' + allocTotal.toFixed(2) + ' but the voucher is only ' + totalDr.toFixed(2) + ' - allocation cannot exceed the voucher');
            }
            for (const al of allocations) {
                const amt = parseFloat(al.amount) || 0;
                if (!amt) continue;
                if (!al.ledgerId) throw new Error('Every allocation row needs the party ledger');
                const rt = String(al.refType || 'AGAINST').toUpperCase();
                if (!['AGAINST', 'ADVANCE', 'ON_ACCOUNT'].includes(rt)) throw new Error('Allocation type must be AGAINST, ADVANCE or ON_ACCOUNT');
                if (rt === 'AGAINST' && !al.againstVoucherId && !al.refNo) {
                    throw new Error('An "against bill" allocation needs the bill it is set against');
                }
                await VoucherAllocation.create({
                    voucherId: voucher.id, ledgerId: al.ledgerId,
                    againstVoucherId: rt === 'AGAINST' ? (al.againstVoucherId || null) : null,
                    refNo: al.refNo ? String(al.refNo).slice(0, 80) : null,
                    refType: rt, amount: amt,
                    amountFcy: al.amountFcy != null && al.amountFcy !== '' ? parseFloat(al.amountFcy) : null,
                }, { transaction: t });
            }
        }

        // RCM Auto-Journal Logic
        const { isRcm } = req.body;
        if (isRcm) {
            // Find Journal Voucher Type
            const journalType = await VoucherType.findOne({ where: { baseType: 'Journal' } });
            
            // Setup or Find RCM Ledgers (Basic matching by name)
            // fix 28-Oct-2026: AccountLedger.groupId is required; new RCM ledgers go under 'Duties & Taxes'
            const AccountGroup = require('../models/AccountGroup');
            const taxGroup = await AccountGroup.findOne({ where: { name: 'Duties & Taxes' } }) || await AccountGroup.findOne({ where: { nature: 'Liabilities' } });
            if (!taxGroup) throw new Error("Account group 'Duties & Taxes' not found. Open Accounts once to create the default groups.");
            let rcmInputLedger = await AccountLedger.findOne({ where: { name: 'RCM Input Tax A/c' } });
            if (!rcmInputLedger) {
                rcmInputLedger = await AccountLedger.create({ name: 'RCM Input Tax A/c', groupId: taxGroup.id, balanceType: 'Dr' }, { transaction: t });
            }
            
            let rcmPayableLedger = await AccountLedger.findOne({ where: { name: 'RCM Tax Payable A/c' } });
            if (!rcmPayableLedger) {
                rcmPayableLedger = await AccountLedger.create({ name: 'RCM Tax Payable A/c', groupId: taxGroup.id, balanceType: 'Cr' }, { transaction: t });
            }

            // Assume standard 5% for GTA or 18% as flat standard. For demonstration, we'll use 5% typical for Transport RCM.
            // This can be linked to Item tax rate in advanced implementation.
            const rcmTaxAmount = parseFloat((totalDr * 0.05).toFixed(2));

            if (rcmTaxAmount > 0) {
                const rcmVoucher = await Voucher.create({
                    voucherTypeId: journalType ? journalType.id : voucherTypeId, // fallback to current if Journal is missing
                    voucherNumber: voucherNumber ? `RCM-${voucherNumber}` : `RCM-AUTO-${voucher.id}`,
                    date,
                    narration: `Auto-generated RCM Liability for Voucher: ${voucherNumber || voucher.id}`,
                    totalAmount: rcmTaxAmount
                }, { transaction: t });

                await VoucherDetail.create({
                    voucherId: rcmVoucher.id,
                    ledgerId: rcmInputLedger.id,
                    dc: 'Dr',
                    amount: rcmTaxAmount
                }, { transaction: t });

                await VoucherDetail.create({
                    voucherId: rcmVoucher.id,
                    ledgerId: rcmPayableLedger.id,
                    dc: 'Cr',
                    amount: rcmTaxAmount
                }, { transaction: t });
            }
        }

        if (division) await sequelize.query('UPDATE Vouchers SET division = ? WHERE id = ?', { replacements: [division, voucher.id], transaction: t });
        await t.commit();
        res.json({ success: true, data: voucher });

    } catch(err) {
        await t.rollback();
        res.status(400).json({ error: err.message });
    }
});

// 3. List recent vouchers
router.get('/', async (req, res) => {
    try {
        const vouchers = await Voucher.findAll({
            include: [
                { model: VoucherType, as: 'voucherType', attributes: ['name', 'baseType'] },
                { 
                    model: VoucherDetail, 
                    as: 'details',
                    include: [{ model: AccountLedger, as: 'ledger', attributes: ['name'] }]
                }
            ],
            order: [['date', 'DESC'], ['createdAt', 'DESC']],
            limit: 50
        });
        res.json({ success: true, data: vouchers });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});


const { Op } = require('sequelize');

// 4. Get Daybook
router.get('/daybook', async (req, res) => {
    try {
        const { startDate, endDate, voucherTypeId } = req.query;
        let whereClause = {};
        
        if (startDate && endDate) {
            whereClause.date = { [Op.between]: [startDate, endDate] };
        } else if (startDate) {
            whereClause.date = { [Op.gte]: startDate };
        } else if (endDate) {
            whereClause.date = { [Op.lte]: endDate };
        }

        if (voucherTypeId) {
            whereClause.voucherTypeId = voucherTypeId;
        }

        const vouchers = await Voucher.findAll({
            where: whereClause,
            include: [
                { model: VoucherType, as: 'voucherType', attributes: ['name', 'baseType'] },
                { 
                    model: VoucherDetail, 
                    as: 'details',
                    include: [{ model: AccountLedger, as: 'ledger', attributes: ['name'] }]
                }
            ],
            order: [['date', 'DESC'], ['createdAt', 'DESC']]
        });
        res.json({ success: true, data: vouchers });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Get Ledger Statement
router.get('/ledger-statement/:id', async (req, res) => {
    try {
        const ledgerId = req.params.id;
        const { startDate, endDate } = req.query;

        const ledger = await AccountLedger.findByPk(ledgerId);
        if (!ledger) return res.status(404).json({ error: 'Ledger not found' });

        // Calculate Initial Opening
        // 06-Nov-2026: the opening is company-wide - it counts under the default branch only (utils/branchScope)
        const opOn = require('../utils/branchScope').openingOn();
        let openingDr = opOn && ledger.balanceType === 'Dr' ? parseFloat(ledger.openingBalance || 0) : 0;
        let openingCr = opOn && ledger.balanceType === 'Cr' ? parseFloat(ledger.openingBalance || 0) : 0;

        // Calculate past transactions before startDate
        if (startDate) {
            const pastDetails = await VoucherDetail.findAll({
                where: { ledgerId },
                include: [{
                    model: Voucher,
                    attributes: [],
                    where: { date: { [Op.lt]: startDate } }
                }]
            });
            pastDetails.forEach(d => {
                if (d.dc === 'Dr') openingDr += parseFloat(d.amount);
                if (d.dc === 'Cr') openingCr += parseFloat(d.amount);
            });
        }

        // Net Opening
        let netOpening = openingDr - openingCr; // Positive is Dr, Negative is Cr
        let opBalanceType = netOpening >= 0 ? 'Dr' : 'Cr';
        let opBalanceAmt = Math.abs(netOpening);

        // Fetch Transactions in period
        let vchWhere = {};
        if (startDate && endDate) {
            vchWhere.date = { [Op.between]: [startDate, endDate] };
        } else if (startDate) {
            vchWhere.date = { [Op.gte]: startDate };
        } else if (endDate) {
            vchWhere.date = { [Op.lte]: endDate };
        }

        const transactions = await VoucherDetail.findAll({
            where: { ledgerId },
            include: [{
                model: Voucher,
                where: Object.keys(vchWhere).length > 0 ? vchWhere : undefined,
                include: [{ model: VoucherType, as: 'voucherType', attributes: ['name', 'baseType'] }]
            }],
            order: [[{ model: Voucher }, 'date', 'ASC'], [{ model: Voucher }, 'createdAt', 'ASC']]
        });

        // Map and calculate running balance
        let runningBal = netOpening;
        const result = transactions.map(t => {
            let amt = parseFloat(t.amount);
            if (t.dc === 'Dr') runningBal += amt;
            if (t.dc === 'Cr') runningBal -= amt;
            
            return {
                id: t.id,
                voucherId: t.voucherId,
                date: t.Voucher.date,
                voucherNumber: t.Voucher.voucherNumber,
                voucherType: t.Voucher.voucherType.name,
                narration: t.Voucher.narration,
                dc: t.dc,
                amount: amt,
                runningBalance: Math.abs(runningBal),
                runningBalanceType: runningBal >= 0 ? 'Dr' : 'Cr'
            };
        });

        res.json({
            success: true,
            data: {
                ledger: { id: ledger.id, name: ledger.name },
                openingBalance: opBalanceAmt,
                openingBalanceType: opBalanceType,
                transactions: result,
                closingBalance: Math.abs(runningBal),
                closingBalanceType: runningBal >= 0 ? 'Dr' : 'Cr'
            }
        });

    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});


// 6. Get BRS Details
router.get('/brs/:id', async (req, res) => {
    try {
        const ledgerId = req.params.id;
        const ledger = await AccountLedger.findByPk(ledgerId);
        if (!ledger) return res.status(404).json({ error: 'Ledger not found' });

        const transactions = await VoucherDetail.findAll({
            where: { ledgerId },
            include: [{
                model: Voucher,
                include: [{ model: VoucherType, as: 'voucherType', attributes: ['name', 'baseType'] }]
            }],
            order: [[{ model: Voucher }, 'date', 'ASC']]
        });

        const result = transactions.map(t => ({
            id: t.id,
            voucherId: t.voucherId,
            date: t.Voucher.date,
            voucherNumber: t.Voucher.voucherNumber,
            voucherType: t.Voucher.voucherType.name,
            narration: t.Voucher.narration,
            dc: t.dc,
            amount: parseFloat(t.amount),
            clearanceDate: t.clearanceDate
        }));

        res.json({ success: true, data: { ledger, transactions: result } });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Update BRS (Reconcile)
router.post('/brs/reconcile', async (req, res) => {
    try {
        const { updates } = req.body; // Array of { id, clearanceDate }
        if (!updates || !Array.isArray(updates)) return res.status(400).json({ error: 'Invalid updates format' });

        for (let u of updates) {
            if (u.id) {
                await VoucherDetail.update(
                    { clearanceDate: u.clearanceDate || null },
                    { where: { id: u.id } }
                );
            }
        }
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});


// 8. GST Returns (Basic Aggregation)
router.get('/gst-returns', async (req, res) => {
    try {
        const { startDate, endDate, type } = req.query; // type = 'GSTR1', 'GSTR2', 'GSTR3B'
        
        // 14-Nov-2026: only the Sales / Purchase vouchers the return needs, read in SQL with just the columns used
        // (before: every voucher of the period, of every type, with all lines and full ledgers as Sequelize objects -
        // GBs of memory for a year). Same figures; on the read-only connection.
        const rq = require('../utils/readDb').q;
        const want = type === 'GSTR1' ? ['Sales'] : type === 'GSTR2' ? ['Purchase'] : type === 'GSTR3B' ? ['Sales', 'Purchase'] : [];
        let vouchers = [];
        if (want.length) {
            const inT = want.map(t => `'${t}'`).join(', ');
            const vs = await rq(`SELECT v.id, v.date, v.voucherNumber, v.narration, v.totalAmount, t.baseType FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId
                WHERE v.date BETWEEN ? AND ? AND t.baseType IN (${inT}) ORDER BY v.date, v.id`, [startDate, endDate]);
            const ds = await rq(`SELECT d.voucherId, d.amount, l.name lname, l.gstin, l.state FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
                JOIN VoucherTypes t ON t.id = v.voucherTypeId LEFT JOIN AccountLedgers l ON l.id = d.ledgerId
                WHERE v.date BETWEEN ? AND ? AND t.baseType IN (${inT}) ORDER BY d.voucherId, d.id`, [startDate, endDate]);
            const by = new Map();
            for (const d of ds) { if (!by.has(d.voucherId)) by.set(d.voucherId, []); by.get(d.voucherId).push({ amount: d.amount, ledger: d.lname == null ? null : { name: d.lname, gstin: d.gstin, state: d.state } }); }
            vouchers = vs.map(v => ({ ...v, voucherType: { baseType: v.baseType }, details: by.get(v.id) || [] }));
        }

        // 30-Oct-2026: GSTR-3B used to ASSUME every sales voucher was 18% GST (totalAmount x 0.82 / x 0.09 / x 0.09)
        // and called it "Dummy aggregation" in the code. A return filed from that would be wrong. The tax is read
        // from the voucher's own lines now: whatever sits on a CGST / SGST / IGST / Cess ledger is the tax, and the
        // rest of the voucher is the taxable value. Nothing is assumed; a voucher with no tax line shows no tax.
        const taxKind = (name) => {
            const n = String(name || '').toUpperCase();
            if (/\bIGST\b/.test(n)) return 'igst';
            if (/\bCGST\b/.test(n)) return 'cgst';
            if (/\bSGST\b|\bUTGST\b/.test(n)) return 'sgst';
            if (/\bCESS\b/.test(n)) return 'cess';
            return null;
        };
        const split = (v) => {
            const out = { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, total: parseFloat(v.totalAmount) || 0 };
            let taxSeen = 0;
            (v.details || []).forEach(d => {
                const amt = parseFloat(d.amount) || 0;
                const k = taxKind(d.ledger && d.ledger.name);
                if (k) { out[k] += amt; taxSeen += amt; }
            });
            out.taxable = Math.round((out.total - taxSeen) * 100) / 100;
            return out;
        };
        const partyOf = (v) => {
            // the party line of a sales / purchase voucher is the one on a ledger that carries a GSTIN
            const d = (v.details || []).find(x => x.ledger && x.ledger.gstin);
            return d ? { name: d.ledger.name, gstin: d.ledger.gstin, state: d.ledger.state || '' } : { name: '', gstin: '', state: '' };
        };
        const rowsFor = (baseType) => vouchers
            .filter(v => v.voucherType && v.voucherType.baseType === baseType)
            .map(v => { const p = partyOf(v); const t = split(v);
                return { id: v.id, date: v.date, voucherNumber: v.voucherNumber, narration: v.narration || '',
                    partyName: p.name, gstin: p.gstin, placeOfSupply: p.state, ...t }; });
        const totalsOf = (rows) => rows.reduce((a, r) => ({
            taxable: a.taxable + r.taxable, cgst: a.cgst + r.cgst, sgst: a.sgst + r.sgst,
            igst: a.igst + r.igst, cess: a.cess + r.cess, total: a.total + r.total,
        }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0 });

        if (type === 'GSTR1') {
            const rows = rowsFor('Sales');
            res.json({ success: true, data: rows, totals: totalsOf(rows), withoutGstin: rows.filter(r => !r.gstin).length });
        } else if (type === 'GSTR2') {
            const rows = rowsFor('Purchase');
            res.json({ success: true, data: rows, totals: totalsOf(rows), withoutGstin: rows.filter(r => !r.gstin).length });
        } else if (type === 'GSTR3B') {
            const sales = rowsFor('Sales');
            const purchases = rowsFor('Purchase');
            res.json({ success: true, data: {
                outwardSupplies: totalsOf(sales),
                itcAvailable: totalsOf(purchases),
                counts: { sales: sales.length, purchases: purchases.length },
                // a voucher with no CGST / SGST / IGST line at all - the figures cannot include tax that was never posted
                salesWithoutTaxLine: sales.filter(r => !(r.cgst || r.sgst || r.igst)).length,
                purchasesWithoutTaxLine: purchases.filter(r => !(r.cgst || r.sgst || r.igst)).length,
            } });
        } else {
            res.json({ success: true, data: [] });
        }

    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 9. Get Pending Approvals
router.get('/pending-approvals', async (req, res) => {
    try {
        const vouchers = await Voucher.findAll({
            where: { status: 'Pending' },
            include: [
                { model: VoucherType, as: 'voucherType', attributes: ['name', 'baseType'] },
                { 
                    model: VoucherDetail, 
                    as: 'details',
                    include: [{ model: AccountLedger, as: 'ledger', attributes: ['name'] }]
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: vouchers });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 10. Update Voucher Status (Approve/Reject)
router.post('/update-status/:id', async (req, res) => {
    try {
        const { status, rejectionReason, userId } = req.body;
        const voucher = await Voucher.findByPk(req.params.id);
        if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
        
        voucher.status = status; // 'Approved' or 'Rejected'
        if (status === 'Rejected' || status === 'Returned') voucher.rejectionReason = rejectionReason;
        if (status === 'Approved') voucher.approvedBy = userId || 1; // Default fallback ID
        
        await voucher.save();
        res.json({ success: true, data: voucher });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 30-Oct-2026: Outstanding (receivables / payables). The Outstanding Reports screen used to show four invented
// parties ("ABC Logistics Ltd. - INV/2026/101 - Rs 45,000, 8 days overdue"). This reads the real ledgers.
//   receivable = ledgers under Sundry Debtors, payable = ledgers under Sundry Creditors (the seeded groups).
//   A voucher line has no bill reference in this database, so a bill-by-bill match is not possible. What is honest
//   and is what every ledger-based system falls back to: each voucher that increases the balance is an open item,
//   and the ones that reduce it are applied oldest-first (FIFO). The answer says so in `basis`.
//   Due date = the item's own date + the ledger's credit days.
router.get('/outstanding', async (req, res) => {
    try {
        // 30-Oct-2026: the FIFO open-item computation moved to utils/openItems.js so the Credit Control
        // screen reads exactly the same figures with its own ageing buckets. Output here is unchanged.
        const { openItems, buckets30 } = require('../utils/openItems');
        const r = await openItems({ type: req.query.type, asOn: req.query.asOn });
        // 08-Nov-2026: the GST invoice behind each bill (when there is one) so the screen can open it
        const links = await require('../utils/invoiceLinks').invoiceLinks(r.items.map(i => i.voucherId));
        const out = r.items.map(i => ({
            id: i.id, ledgerId: i.ledgerId, party: i.party, refNo: i.refNo, narration: i.narration,
            date: i.date, dueDate: i.dueDate, amount: i.amount, pending: i.pending, overdueDays: i.overdueDays,
            voucherId: i.voucherId || null, gst: links.get(Number(i.voucherId)) || null,
        }));
        const body = { success: true, data: out, buckets: buckets30(r.items), asOn: r.asOn, basis: r.basis };
        if (r.note) body.note = r.note;
        res.json(body);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ---------------------------------------------------------------------------
// GET /api/vouchers/cash-flow?from=&to=
// The Cash Flow screen used to print an invented statement (4,50,000 operating,
// -2,00,000 investing ...) from a hardcoded array, and its Print button worked.
// This builds the statement from the ledger itself: every voucher line that moves
// a Cash-in-Hand or Bank Accounts ledger is real cash, and the other side of that
// same voucher decides which activity it belongs to.
//   Fixed Assets / Investments            -> Investing
//   Capital Account / any Loan group      -> Financing
//   everything else                       -> Operating
// Opening + net must equal closing; the response carries all three so the screen
// can show the check rather than asking anyone to trust the total.
// Added 30-Oct-2026.
// ---------------------------------------------------------------------------
router.get('/cash-flow', async (req, res) => {
    try {
        const AccountGroup = require('../models/AccountGroup');
        const to = req.query.to || new Date().toISOString().slice(0, 10);
        const from = req.query.from || new Date(new Date(to).getFullYear(), 0, 1).toISOString().slice(0, 10);

        const groups = await AccountGroup.findAll();
        const gById = new Map(groups.map(g => [g.id, g]));
        // the chain of group names from a ledger's own group up to its primary group
        const chainOf = (groupId) => {
            const names = []; let g = gById.get(groupId); let guard = 0;
            while (g && guard++ < 20) { names.push(g.name); g = g.parentId ? gById.get(g.parentId) : null; }
            return names;
        };
        const CASH_GROUPS = ['Cash-in-Hand', 'Bank Accounts', 'Bank OD A/c', 'Bank OCC A/c'];
        const INVEST_GROUPS = ['Fixed Assets', 'Investments'];
        const FINANCE_GROUPS = ['Capital Account', 'Loans (Liability)', 'Secured Loans', 'Unsecured Loans', 'Bank OD A/c'];

        const ledgers = await AccountLedger.findAll();
        const info = new Map();
        ledgers.forEach(l => {
            const chain = chainOf(l.groupId);
            const isCash = chain.some(n => CASH_GROUPS.includes(n));
            const activity = chain.some(n => INVEST_GROUPS.includes(n)) ? 'investing'
                : chain.some(n => FINANCE_GROUPS.includes(n)) ? 'financing' : 'operating';
            info.set(l.id, { name: l.name, isCash, activity, chain });
        });

        // 05-Nov-2026: with the iCAFFE history (lakhs of vouchers) loading every voucher took minutes. Same result:
        // the opening is summed in SQL; only vouchers of the period that touch a cash / bank ledger are read.
        const cashIds = [...info.entries()].filter(([, i]) => i.isCash).map(([id]) => Number(id)).filter(Number.isFinite);
        const cashIn = cashIds.join(',') || '0';
        const sq = (sql, p) => Voucher.sequelize.query(sql, { replacements: p, type: require('sequelize').QueryTypes.SELECT });
        const op0 = (await sq(`SELECT sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) m FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
            WHERE d.ledgerId IN (${cashIn}) AND substr(v.date, 1, 10) < ?`, [from]))[0] || {};
        const lines = await sq(`SELECT d.voucherId, d.ledgerId, d.dc, d.amount, v.date FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
            WHERE substr(v.date, 1, 10) >= ? AND substr(v.date, 1, 10) <= ? AND d.voucherId IN (SELECT voucherId FROM VoucherDetails WHERE ledgerId IN (${cashIn}))
            ORDER BY v.date, v.id, d.id`, [from, to]);
        const vmap = new Map();
        for (const l of lines) { if (!vmap.has(l.voucherId)) vmap.set(l.voucherId, { date: l.date, details: [] }); vmap.get(l.voucherId).details.push(l); }
        const all = [...vmap.values()];

        // cash movement of one voucher: Dr on a cash ledger brings cash in, Cr takes it out
        const cashMove = (v) => (v.details || []).reduce((a, d) => {
            const i = info.get(d.ledgerId); if (!i || !i.isCash) return a;
            const amt = parseFloat(d.amount) || 0;
            return a + (d.dc === 'Dr' ? amt : -amt);
        }, 0);

        let opening = parseFloat(op0.m) || 0;
        const buckets = { operating: new Map(), investing: new Map(), financing: new Map() };
        let unclassified = 0;
        const addRow = (activity, name, amt) => {
            const m = buckets[activity];
            m.set(name, (m.get(name) || 0) + amt);
        };

        all.forEach(v => {
            const d = String(v.date || '').slice(0, 10);
            const move = cashMove(v);
            if (!move) return;                       // a voucher that never touches cash is not a cash flow
            if (d < from) { opening += move; return; }
            if (d > to) return;
            // split the cash movement across the non-cash lines of the same voucher, by their own share
            const others = (v.details || []).filter(x => { const i = info.get(x.ledgerId); return i && !i.isCash; });
            const tot = others.reduce((a, x) => a + Math.abs(parseFloat(x.amount) || 0), 0);
            if (!others.length || !tot) { unclassified += move; addRow('operating', 'Unclassified (no contra ledger on the voucher)', move); return; }
            let placed = 0;
            others.forEach((x, idx) => {
                const i = info.get(x.ledgerId);
                const share = idx === others.length - 1
                    ? move - placed                                   // last line absorbs the rounding
                    : Math.round(move * (Math.abs(parseFloat(x.amount) || 0) / tot) * 100) / 100;
                placed += share;
                addRow(i.activity, i.name, share);
            });
        });

        const r2 = (n) => Math.round(n * 100) / 100;
        const sectionOf = (key, label) => {
            const children = [...buckets[key].entries()]
                .map(([name, amount]) => ({ id: key + '-' + name, name, amount: r2(amount) }))
                .filter(c => c.amount !== 0)
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
            const amount = r2(children.reduce((a, c) => a + c.amount, 0));
            return { id: key, name: label, amount, type: amount < 0 ? 'outflow' : 'inflow', children };
        };
        const data = [
            sectionOf('operating', 'Operating Activities'),
            sectionOf('investing', 'Investing Activities'),
            sectionOf('financing', 'Financing Activities'),
        ];
        const net = r2(data.reduce((a, g) => a + g.amount, 0));
        const closing = r2(opening + net);
        const cashLedgers = [...info.values()].filter(i => i.isCash).map(i => i.name);

        res.json({
            success: true, from, to, data,
            net, opening: r2(opening), closing,
            // the screen prints this: a statement nobody can check is worse than no statement
            check: { opening: r2(opening), net, closing, balances: Math.abs(r2(opening) + net - closing) < 0.01 },
            cashLedgers, unclassified: r2(unclassified),
            note: cashLedgers.length
                ? 'Built from every voucher line that moves ' + cashLedgers.length + ' cash / bank ledger(s).'
                : 'No ledger sits under Cash-in-Hand or Bank Accounts yet, so there is no cash to report. Create your bank and cash ledgers under those groups first.',
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// ---------------------------------------------------------------------------
// Voucher supporting documents. The "Attach Supporting Docs" button on Voucher
// Entry used to do nothing. Files land in uploads/vouchers (served behind the
// same auth as the other upload folders) with a row in VoucherDocuments.
// A voucher that has not been saved yet parks its files under draftKey and
// claims them with POST /documents/claim once the voucher id exists.
// Added 30-Oct-2026.
// ---------------------------------------------------------------------------
const vdMulter = require('multer');
const vdPath = require('path');
const vdFs = require('fs');
const VoucherDocument = require('../models/VoucherDocument');

const vdUpload = vdMulter({
    storage: vdMulter.diskStorage({
        destination: (req, file, cb) => {
            const dir = vdPath.join(__dirname, '../uploads/vouchers');
            if (!vdFs.existsSync(dir)) vdFs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + vdPath.extname(file.originalname)),
    }),
    limits: { fileSize: 10 * 1024 * 1024, files: 10 },
    fileFilter: (req, file, cb) => cb(null, /^(application\/pdf|image\/(png|jpe?g|webp|gif|tiff)|application\/vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)|application\/msword|application\/vnd\.ms-excel|text\/csv|text\/plain)$/i.test(file.mimetype)),
});

router.post('/documents', vdUpload.array('files', 10), async (req, res) => {
    try {
        const voucherId = req.body.voucherId ? parseInt(req.body.voucherId, 10) : null;
        const draftKey = req.body.draftKey ? String(req.body.draftKey).slice(0, 60) : null;
        if (!voucherId && !draftKey) return res.status(400).json({ success: false, error: 'Either a voucher id or a draft key is needed' });
        if (voucherId) {
            const v = await Voucher.findByPk(voucherId);
            if (!v) return res.status(404).json({ success: false, error: 'Voucher ' + voucherId + ' not found' });
        }
        const files = req.files || [];
        if (!files.length) return res.status(400).json({ success: false, error: 'No file came through. PDF, image, Word, Excel, CSV or text, up to 10 MB each.' });
        const rows = [];
        for (const f of files) {
            rows.push(await VoucherDocument.create({
                voucherId, draftKey,
                fileName: f.filename, originalName: f.originalname, mimeType: f.mimetype,
                filePath: '/uploads/vouchers/' + f.filename, size: f.size,
                documentType: String(req.body.documentType || 'SUPPORTING').toUpperCase().slice(0, 40),
                uploadedBy: (req.user && req.user.id) || null,
                uploadedByName: (req.user && (req.user.fullName || req.user.username)) || null,
            }));
        }
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// hand a draft's files to the voucher that was just saved
router.post('/documents/claim', async (req, res) => {
    try {
        const { draftKey, voucherId } = req.body || {};
        if (!draftKey || !voucherId) return res.status(400).json({ success: false, error: 'draftKey and voucherId are both required' });
        const v = await Voucher.findByPk(voucherId);
        if (!v) return res.status(404).json({ success: false, error: 'Voucher ' + voucherId + ' not found' });
        const [n] = await VoucherDocument.update({ voucherId, draftKey: null }, { where: { draftKey: String(draftKey) } });
        res.json({ success: true, claimed: n });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/documents', async (req, res) => {
    try {
        const where = {};
        if (req.query.voucherId) where.voucherId = parseInt(req.query.voucherId, 10);
        else if (req.query.draftKey) where.draftKey = String(req.query.draftKey);
        else return res.status(400).json({ success: false, error: 'voucherId or draftKey is required' });
        const rows = await VoucherDocument.findAll({ where, order: [['id', 'ASC']] });
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/documents/:id', async (req, res) => {
    try {
        const d = await VoucherDocument.findByPk(req.params.id);
        if (!d) return res.status(404).json({ success: false, error: 'Attachment not found' });
        const abs = vdPath.join(__dirname, '..', d.filePath.replace(/^\//, ''));
        try { if (vdFs.existsSync(abs)) vdFs.unlinkSync(abs); } catch (e) { /* the row must go even if the file is already gone */ }
        await d.destroy();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// ---------------------------------------------------------------------------
// POST /api/vouchers/gstr2b-match
// The GSTR-2B Reconciliation screen used to ignore the file completely: it ran a
// 2.5 second timer and then showed four invented rows (Delhivery, Maersk, CONCOR
// and a rent bill) with "145 matched". Claiming ITC off that is a real tax risk.
// This parses the actual GSTR-2B JSON downloaded from the GST portal and matches
// it against the Purchase vouchers in the books. Nothing is assumed: a row the
// matcher cannot pair is reported as unmatched, not quietly dropped.
//
// Accepts the portal's own shape (data.docdata.b2b[].inv[] / cdnr[].nt[]) and the
// bare docdata variant. Anything else is refused with what was expected.
// Added 30-Oct-2026.
// ---------------------------------------------------------------------------
const g2bUpload = vdMulter({ storage: vdMulter.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } });

function parseGstr2b(root) {
    const out = { period: '', gstin: '', rows: [], shape: '' };
    const obj = (x) => x && typeof x === 'object' ? x : {};
    // The portal's own download is {gstin, rtnprd, docdata}. The GSTN API nests it twice
    // ({status, data:{chksum, data:{gstin, rtnprd, docdata}}}) and some GSPs once. Descend
    // through .data until the body with docdata / rtnprd shows up, max 5 levels.
    let d = obj(root), guard = 0;
    while (guard++ < 5 && !d.docdata && !d.doc_data && !d.rtnprd && obj(d).data) d = obj(d.data);
    out.period = String(d.rtnprd || d.retperiod || obj(root).rtnprd || '');
    out.gstin = String(d.gstin || obj(root).gstin || '');
    const docdata = obj(d.docdata || d.doc_data || d);
    const num = (x) => { const n = parseFloat(x); return Number.isFinite(n) ? n : 0; };
    const sumItems = (items) => (Array.isArray(items) ? items : []).reduce((a, it) => ({
        taxable: a.taxable + num(it.txval), igst: a.igst + num(it.igst), cgst: a.cgst + num(it.cgst),
        sgst: a.sgst + num(it.sgst), cess: a.cess + num(it.cess),
    }), { taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 });

    const pushDocs = (suppliers, listKey, numKey, kind, sign) => {
        (Array.isArray(suppliers) ? suppliers : []).forEach(sup => {
            const ctin = String(sup.ctin || sup.gstin || '').toUpperCase();
            const trdnm = String(sup.trdnm || sup.tradeName || sup.name || '');
            (Array.isArray(sup[listKey]) ? sup[listKey] : []).forEach(doc => {
                const t = sumItems(doc.items);
                // when a document carries no item breakup, the header total is all there is
                const tax = t.igst + t.cgst + t.sgst + t.cess;
                const value = num(doc.val) || (t.taxable + tax);
                out.rows.push({
                    kind, ctin, supplier: trdnm,
                    // field names differ between the portal download, the GSTN API and GSP wrappers
                    docNo: String(doc[numKey] || doc.inum || doc.ntnum || doc.nt_num || doc.boenum || doc.bnum || doc.num || '').trim(),
                    docDate: String(doc.dt || doc.ntdt || doc.nt_dt || doc.boedt || doc.bdt || doc.date || '').trim(),
                    portalValue: Math.round(value * sign * 100) / 100,
                    taxable: Math.round(t.taxable * sign * 100) / 100,
                    igst: Math.round(t.igst * sign * 100) / 100, cgst: Math.round(t.cgst * sign * 100) / 100,
                    sgst: Math.round(t.sgst * sign * 100) / 100, cess: Math.round(t.cess * sign * 100) / 100,
                    itcAvailable: String(doc.itcavl || doc.itc_avl || '').toUpperCase() !== 'N',
                });
            });
        });
    };
    pushDocs(docdata.b2b, 'inv', 'inum', 'B2B invoice', 1);
    pushDocs(docdata.b2ba, 'inv', 'inum', 'B2B amendment', 1);
    pushDocs(docdata.cdnr, 'nt', 'ntnum', 'Credit / debit note', -1);
    pushDocs(docdata.cdnra, 'nt', 'ntnum', 'CDN amendment', -1);
    pushDocs(docdata.impg, 'boe', 'boenum', 'Import BoE', 1);
    out.shape = out.rows.length ? 'ok' : 'empty';
    return out;
}

// 11/09/2026, 11-09-2026 and 2026-09-11 all appear in portal files and ERP exports
const g2bDate = (s) => {
    const t = String(s || '').trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(t);
    if (m) return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
    return '';
};
// invoice numbers are compared without the punctuation and leading zeros that differ between portal and books
const g2bKey = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '');

router.post('/gstr2b-match', g2bUpload.single('file'), async (req, res) => {
    try {
        let json = null;
        if (req.file && req.file.buffer) {
            try { json = JSON.parse(req.file.buffer.toString('utf8')); }
            catch (e) { return res.status(400).json({ success: false, error: 'That file is not valid JSON: ' + e.message + '. Download the GSTR-2B JSON from the GST portal (not the Excel).' }); }
        } else if (req.body && req.body.json) {
            json = typeof req.body.json === 'string' ? JSON.parse(req.body.json) : req.body.json;
        } else if (req.body && (req.body.data || req.body.docdata)) {
            json = req.body;
        }
        if (!json) return res.status(400).json({ success: false, error: 'No GSTR-2B JSON came through. Attach the JSON file downloaded from the GST portal.' });

        const parsed = parseGstr2b(json);
        if (!parsed.rows.length) {
            return res.status(400).json({ success: false, error:
                'No documents found in that file. A GSTR-2B JSON has data.docdata.b2b (and optionally cdnr / impg) inside it - this file has ' +
                Object.keys(json || {}).slice(0, 8).join(', ') + '. Make sure it is the GSTR-2B JSON and not GSTR-1 or an ITC summary.' });
        }

        // the books: every Purchase voucher, with its party GSTIN and its bill number
        const AccountGroupM = require('../models/AccountGroup');
        // 14-Nov-2026: only the Purchase vouchers, in SQL (before: every voucher since 2022 of every type with all its
        // lines - 3 lakh vouchers / 42 lakh lines as Sequelize objects - which the server could not hold in memory).
        // Same matching: the party is the first line on a ledger with a GSTIN, else the largest Cr line.
        const rq = require('../utils/readDb').q;
        const pv = await rq(`SELECT v.id, v.date, v.voucherNumber, v.refNo, v.totalAmount FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId
            WHERE t.baseType = 'Purchase' ORDER BY v.id`);
        const gst = new Map((await rq(`SELECT voucherId, name, gstin FROM (SELECT d.voucherId, l.name, l.gstin, row_number() OVER (PARTITION BY d.voucherId ORDER BY d.id) rn
              FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN AccountLedgers l ON l.id = d.ledgerId
              WHERE t.baseType = 'Purchase' AND coalesce(l.gstin, '') <> '') x WHERE rn = 1`)).map(r => [r.voucherId, r]));
        const crTop = new Map((await rq(`SELECT voucherId, name FROM (SELECT d.voucherId, l.name, row_number() OVER (PARTITION BY d.voucherId ORDER BY CAST(d.amount AS REAL) DESC, d.id) rn
              FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId LEFT JOIN AccountLedgers l ON l.id = d.ledgerId
              WHERE t.baseType = 'Purchase' AND d.dc = 'Cr') x WHERE rn = 1`)).map(r => [r.voucherId, r.name]));
        const books = pv.map(v => {
                const party = gst.get(v.id);
                return {
                    id: v.id, date: String(v.date || '').slice(0, 10),
                    voucherNumber: v.voucherNumber,
                    billNo: v.refNo || '',
                    gstin: party && party.gstin ? String(party.gstin).toUpperCase() : '',
                    vendor: (party && party.name) || crTop.get(v.id) || '',
                    amount: Math.round((parseFloat(v.totalAmount) || 0) * 100) / 100,
                    used: false,
                };
            });

        const records = [];
        const tol = Math.max(0, parseFloat(req.query.tolerance || req.body?.tolerance || 1));   // rupees
        parsed.rows.forEach(p => {
            const pk = g2bKey(p.docNo);
            // first choice: same GSTIN and same bill number. second: same GSTIN and the amount inside tolerance.
            let b = books.find(x => !x.used && x.gstin && x.gstin === p.ctin && pk && g2bKey(x.billNo) === pk);
            let how = b ? 'GSTIN + bill no' : '';
            if (!b) {
                b = books.find(x => !x.used && x.gstin && x.gstin === p.ctin && Math.abs(x.amount - p.portalValue) <= tol);
                if (b) how = 'GSTIN + amount';
            }
            if (!b && pk) {
                b = books.find(x => !x.used && pk && g2bKey(x.billNo) === pk && Math.abs(x.amount - p.portalValue) <= tol);
                if (b) how = 'bill no + amount (GSTIN differs or missing in books)';
            }
            if (b) b.used = true;
            const bookAmt = b ? b.amount : 0;
            const diff = Math.round((p.portalValue - bookAmt) * 100) / 100;
            const status = !b ? 'Missing in Books' : Math.abs(diff) <= tol ? 'Matched' : 'Mismatched';
            records.push({
                id: b ? b.voucherNumber : 'N/A', voucherId: b ? b.id : null,
                vendor: p.supplier || (b && b.vendor) || p.ctin || 'Unknown supplier',
                gstin: p.ctin, invoice: p.docNo, docKind: p.kind,
                date: g2bDate(p.docDate), bookDate: b ? b.date : '',
                portalAmt: p.portalValue, bookAmt,
                taxable: p.taxable, igst: p.igst, cgst: p.cgst, sgst: p.sgst, cess: p.cess,
                itcAvailable: p.itcAvailable,
                diff: Math.abs(diff) > 0.009 ? diff : 0,
                matchedOn: how || '', status,
            });
        });
        // purchases in the books that the portal does not show at all - the vendor has not filed
        books.filter(b => !b.used).forEach(b => {
            records.push({
                id: b.voucherNumber, voucherId: b.id, vendor: b.vendor || 'Unknown vendor', gstin: b.gstin,
                invoice: b.billNo || '(no bill no on the voucher)', docKind: 'Books only',
                date: b.date, bookDate: b.date, portalAmt: 0, bookAmt: b.amount,
                taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0, itcAvailable: false,
                diff: Math.round(-b.amount * 100) / 100, matchedOn: '', status: 'Missing on Portal',
            });
        });

        const count = (st) => records.filter(r => r.status === st).length;
        const sum = (rows, k) => Math.round(rows.reduce((a, r) => a + (r[k] || 0), 0) * 100) / 100;
        const matched = records.filter(r => r.status === 'Matched');
        res.json({
            success: true,
            period: parsed.period, portalGstin: parsed.gstin,
            summary: {
                matched: count('Matched'), mismatched: count('Mismatched'),
                missingInBooks: count('Missing in Books'), missingOnPortal: count('Missing on Portal'),
                portalDocuments: parsed.rows.length, purchaseVouchers: books.length,
                // ITC you can actually claim: only what matched and is flagged available on the portal
                itcSafe: sum(matched.filter(r => r.itcAvailable), 'igst') + sum(matched.filter(r => r.itcAvailable), 'cgst')
                       + sum(matched.filter(r => r.itcAvailable), 'sgst'),
                portalTaxTotal: sum(records.filter(r => r.docKind !== 'Books only'), 'igst')
                              + sum(records.filter(r => r.docKind !== 'Books only'), 'cgst')
                              + sum(records.filter(r => r.docKind !== 'Books only'), 'sgst'),
            },
            records,
            note: 'Matched on GSTIN + bill number first, then GSTIN + amount within ' + tol +
                  ' rupee(s). Only "Matched" rows with ITC available on the portal are safe to claim; a voucher with no Reference / Bill No. can only match on amount.',
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// ---------------------------------------------------------------------------
// GET /api/vouchers/pending-bills?ledgerId=&type=receivable&asOn=
// Feeds the Bill-by-Bill Allocation grid on the Payment / Receipt screen, which
// used to hold one hardcoded row (INV/26/1022, 1,71,100) and a "Current Balance"
// line that was painted on. Same open-item calculation as the Outstanding report.
// Added 30-Oct-2026.
// ---------------------------------------------------------------------------
router.get('/pending-bills', async (req, res) => {
    try {
        const ledgerId = parseInt(req.query.ledgerId, 10);
        if (!ledgerId) return res.status(400).json({ success: false, error: 'ledgerId is required' });
        const { openItems } = require('../utils/openItems');
        const { items, basis, asOn } = await openItems({ type: req.query.type || 'receivable', asOn: req.query.asOn, ledgerId });
        const mine = items.filter(i => i.ledgerId === ledgerId);
        const led = await AccountLedger.findByPk(ledgerId);
        res.json({
            success: true, asOn, basis,
            ledger: led ? { id: led.id, name: led.name, creditDays: parseInt(led.creditDays, 10) || 0, creditLimit: parseFloat(led.creditLimit) || 0 } : null,
            balance: Math.round(mine.reduce((a, i) => a + i.pending, 0) * 100) / 100,
            balanceSide: String(req.query.type || 'receivable').toLowerCase() === 'payable' ? 'Cr' : 'Dr',
            // on-account lines (iCAFFE receipts not set against a bill) count in the balance but are not bills to settle
            onAccount: Math.round(mine.filter(i => i.onAccount).reduce((a, i) => a + i.pending, 0) * 100) / 100,
            bills: mine.filter(i => !i.onAccount).map(i => ({
                voucherId: i.voucherId, refNo: i.refNo, billNo: i.billNo, jobNo: i.jobNo,
                date: i.date, dueDate: i.dueDate, amount: i.amount, pending: i.pending, overdueDays: i.overdueDays,
            })),
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/vouchers/ledgers-by-group?groups=Bank Accounts,Cash-in-Hand
// The Payment / Receipt screen's bank dropdown listed three invented accounts
// ("HDFC Bank - 5020001234"). This returns the real ledgers under the named
// groups, including everything nested below them.
router.get('/ledgers-by-group', async (req, res) => {
    try {
        const AccountGroup = require('../models/AccountGroup');
        const wanted = String(req.query.groups || 'Bank Accounts,Cash-in-Hand')
            .split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
        const all = await AccountGroup.findAll();
        const roots = all.filter(g => wanted.includes(String(g.name).toLowerCase()));
        if (!roots.length) {
            return res.json({ success: true, data: [], note: 'No group named ' + req.query.groups + ' in the chart of accounts yet.' });
        }
        const ids = new Set(roots.map(g => g.id));
        let grew = true;
        while (grew) { grew = false; all.forEach(g => { if (g.parentId && ids.has(g.parentId) && !ids.has(g.id)) { ids.add(g.id); grew = true; } }); }
        const byId = new Map(all.map(g => [g.id, g]));
        const ledgers = await AccountLedger.findAll({ where: { groupId: { [Op.in]: [...ids] } }, order: [['name', 'ASC']] });
        res.json({
            success: true,
            data: ledgers.map(l => ({
                id: l.id, name: l.name, group: (byId.get(l.groupId) || {}).name || '',
                bankAccount: l.bankAccount || '', bankIfsc: l.bankIfsc || '',
                gstin: l.gstin || '', email: l.email || '', phone: l.phone || '',
                creditDays: parseInt(l.creditDays, 10) || 0, creditLimit: parseFloat(l.creditLimit) || 0,
            })),
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
