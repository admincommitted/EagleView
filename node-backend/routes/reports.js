const express = require('express');
const router  = express.Router();
const Airwaybill = require('../models/Airwaybill');
const HouseAWB   = require('../models/HouseAWB');
const Airline    = require('../models/Airline');
const Party      = require('../models/Party');
const { Op }     = require('sequelize');

// GET /api/reports/forwarder-transactions
router.get('/forwarder-transactions', async (req, res) => {
    try {
        const { fromDate, toDate, docType, airline, companyId } = req.query;

        let mawbWhere = {};
        let hawbWhere = {};

        if (fromDate && toDate) {
            mawbWhere.createdAt = { [Op.between]: [new Date(fromDate + 'T00:00:00Z'), new Date(toDate + 'T23:59:59Z')] };
            hawbWhere.createdAt = { [Op.between]: [new Date(fromDate + 'T00:00:00Z'), new Date(toDate + 'T23:59:59Z')] };
        } else if (fromDate) {
            mawbWhere.createdAt = { [Op.gte]: new Date(fromDate + 'T00:00:00Z') };
            hawbWhere.createdAt = { [Op.gte]: new Date(fromDate + 'T00:00:00Z') };
        } else if (toDate) {
            mawbWhere.createdAt = { [Op.lte]: new Date(toDate + 'T23:59:59Z') };
            hawbWhere.createdAt = { [Op.lte]: new Date(toDate + 'T23:59:59Z') };
        }

        const mawbAttrs = ['id','awbNumber','type','origin','destination','grossWeight','totalPieces','shipperName','consigneeName','flightNumber1','flightDate1','createdAt'];
        const hawbAttrs = ['id','awbNumber','masterAwbNumber','origin','destination','grossWeight','totalPieces','shipperName','consigneeName','createdAt'];

        // Fetch airlines and parties for dropdowns
        const airlinesList = await Airline.findAll({ attributes: ['id','name','code2','prefix'] });
        // 09-Nov-2026: the ~1.2 lakh iCAFFE consignees loaded in bulk (Parties.searchOnly = 1) are left out of this list, as in the
        // Party Master's full list - sending all 1.5 lakh parties froze the Search AWB screen (its shipper / consignee boxes)
        let partiesList;
        try {
            partiesList = await Party.sequelize.query("SELECT id, name, street, city, countryCode, partyType FROM Parties WHERE coalesce(searchOnly, 0) = 0 ORDER BY name", { type: require('sequelize').QueryTypes.SELECT });
            if (companyId && !partiesList.some(p => p.id == companyId)) partiesList.push(...await Party.sequelize.query('SELECT id, name, street, city, countryCode, partyType FROM Parties WHERE id = ?', { replacements: [companyId], type: require('sequelize').QueryTypes.SELECT }));
        } catch (e) { partiesList = await Party.findAll({ attributes: ['id','name','street','city','countryCode','partyType'], raw: true }); } // no searchOnly column yet

        let companyInfo = { name: 'ALL COMPANIES', address: '---' };
        let partyName   = null;

        if (companyId) {
            const party = partiesList.find(p => p.id == companyId);
            if (party) {
                companyInfo.name    = party.name;
                companyInfo.address = [party.street, party.city, party.countryCode].filter(Boolean).join(', ');
                partyName = party.name;
            }
        }

        // Party name filter
        if (partyName) {
            mawbWhere[Op.or] = [{ shipperName: partyName }, { consigneeName: partyName }];
            hawbWhere[Op.or] = [{ shipperName: partyName }, { consigneeName: partyName }];
        }

        // Airline prefix filter (only for MAWB/AWB — HAWB doesn't have prefix)
        if (airline) {
            const selectedAirline = airlinesList.find(a => a.code2 === airline);
            if (selectedAirline && selectedAirline.prefix) {
                mawbWhere.awbNumber = { [Op.like]: selectedAirline.prefix + '-%' };
            }
        }

        let mawbs = [];
        let hawbs = [];

        if (!docType || docType === 'All' || docType === 'MAWB') {
            mawbs = await Airwaybill.findAll({ where: mawbWhere, attributes: mawbAttrs, order: [['createdAt', 'DESC']] });
        }

        if (!docType || docType === 'All' || docType === 'HAWB') {
            hawbs = await HouseAWB.findAll({ where: hawbWhere, attributes: hawbAttrs, order: [['createdAt', 'DESC']] });
        }

        let results = [];

        mawbs.forEach(m => {
            // Find airline name from AWB prefix
            let airlineName = 'N/A';
            if (m.awbNumber) {
                const prefix = m.awbNumber.split('-')[0];
                const al     = airlinesList.find(a => a.prefix === prefix);
                if (al) airlineName = al.name;
            }
            results.push({
                docType:       m.type || 'MAWB',
                mawbNo:        m.awbNumber  || '-',
                hawbNo:        '',
                airline:       airlineName,
                origin:        m.origin     || '-',
                destination:   m.destination || '-',
                grossWeight:   m.grossWeight || 0,
                pieces:        m.totalPieces || 0,
                shipper:       m.shipperName || '-',
                consignee:     m.consigneeName || '-',
                flight:        m.flightNumber1 || '-',
                flightDate:    m.flightDate1   || '-',
                submittedDate: m.createdAt,
                submittedBy:   'Admin'
            });
        });

        hawbs.forEach(h => {
            results.push({
                docType:       'HAWB',
                mawbNo:        h.masterAwbNumber || '-',  // real master AWB number
                hawbNo:        h.awbNumber       || '-',
                airline:       'N/A',
                origin:        h.origin      || '-',
                destination:   h.destination || '-',
                grossWeight:   h.grossWeight || 0,
                pieces:        h.totalPieces || 0,
                shipper:       h.shipperName  || '-',
                consignee:     h.consigneeName || '-',
                flight:        '-',
                flightDate:    '-',
                submittedDate: h.createdAt,
                submittedBy:   'Admin'
            });
        });

        results.sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));
        results = results.map((r, i) => ({ ...r, sno: i + 1 }));

        res.json({
            success:     true,
            data:        results,
            airlines:    airlinesList,
            parties:     partiesList,
            companyInfo: companyInfo,
            summary: {
                totalMawb:    mawbs.length,
                totalHawb:    hawbs.length,
                totalRecords: results.length
            }
        });
    } catch (err) {
        console.error('Report error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});


// GET /api/reports/export-data  → Export CSV/Excel data
router.get('/export-data', async (req, res) => {
    try {
        const { fromDate, toDate, fileType } = req.query;

        let whereClause = {};
        if (fromDate && toDate) {
            whereClause.createdAt = { [Op.between]: [new Date(fromDate + 'T00:00:00Z'), new Date(toDate + 'T23:59:59Z')] };
        } else if (fromDate) {
            whereClause.createdAt = { [Op.gte]: new Date(fromDate + 'T00:00:00Z') };
        } else if (toDate) {
            whereClause.createdAt = { [Op.lte]: new Date(toDate + 'T23:59:59Z') };
        }

        const attrs = ['awbNumber','type','origin','destination','status','flightNumber1','flightDate1','shipperName','consigneeName','grossWeight','totalPieces','createdAt'];
        let results = [];

        if (!fileType || fileType === 'MAWB' || fileType === 'ALL') {
            const mawbs = await Airwaybill.findAll({ where: whereClause, attributes: attrs });
            mawbs.forEach(m => {
                const prefix = (m.awbNumber || '').split('-')[0];
                results.push({
                    type:    m.type || 'MAWB',
                    awb:     m.awbNumber,
                    status:  m.status || 'ACTIVE',
                    prefix,
                    origin:  m.origin,
                    dep:     m.flightDate1 || new Date(m.createdAt).toLocaleDateString(),
                    dst:     m.destination,
                    shipper: m.shipperName,
                    gw:      m.grossWeight,
                    pcs:     m.totalPieces,
                    awbDate: new Date(m.createdAt).toLocaleDateString()
                });
            });
        }

        if (!fileType || fileType === 'HAWB' || fileType === 'ALL') {
            const hawbs = await HouseAWB.findAll({ where: whereClause, attributes: ['awbNumber','masterAwbNumber','origin','destination','status','shipperName','grossWeight','totalPieces','createdAt'] });
            hawbs.forEach(h => {
                results.push({
                    type:    'HAWB',
                    awb:     h.awbNumber,
                    mawb:    h.masterAwbNumber,
                    status:  h.status || 'ACTIVE',
                    prefix:  'N/A',
                    origin:  h.origin,
                    dep:     new Date(h.createdAt).toLocaleDateString(),
                    dst:     h.destination,
                    shipper: h.shipperName,
                    gw:      h.grossWeight,
                    pcs:     h.totalPieces,
                    awbDate: new Date(h.createdAt).toLocaleDateString()
                });
            });
        }

        results.sort((a, b) => new Date(b.awbDate) - new Date(a.awbDate));

        res.json({ success: true, data: results });
    } catch (err) {
        console.error('Export data error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---- Air Export: Tonnage report and CSR statement (29-Oct-2026, utils/awbReports.js) ----
const awbReportModels = () => ({
    Airwaybill, HouseAWB, Airline,
    AwbRateLine: require('../models/AwbRateLine'),
    AwbOtherCharge: require('../models/AwbOtherCharge'),
});
// GET /api/reports/tonnage?from=2026-10-01&to=2026-10-31&groupBy=airline|destination|origin|customer|month|day&dateBasis=AWB|FLIGHT&airline=176&type=ALL|AWB|MAWB
router.get('/tonnage', async (req, res) => {
    try { res.json({ success: true, ...(await require('../utils/awbReports').buildTonnage({ ...awbReportModels(), scopeWhere: await require('../utils/awbBranch').where(req) }, req.query)) }); }
    catch (err) { res.status(err.status || 500).json({ success: false, error: err.message }); }
});
// GET /api/reports/csr?period=2026-10-1&airline=176|ALL   (CASS fortnight: -1 = 1st-15th, -2 = 16th-end)
router.get('/csr', async (req, res) => {
    try { res.json({ success: true, ...(await require('../utils/awbReports').buildCsr({ ...awbReportModels(), scopeWhere: await require('../utils/awbBranch').where(req) }, req.query)) }); }
    catch (err) { res.status(err.status || 500).json({ success: false, error: err.message }); }
});
// GET /api/reports/awb-agents - IATA agents for the report pickers: the IATA Agent master plus every agent written on an
// airline AWB (an agent typed on the AWB but missing in the master is still listed)
router.get('/awb-agents', async (req, res) => {
    try {
        const bare = (n) => String(n || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const out = new Map();
        const IataAgent = require('../models/IataAgent');
        (await IataAgent.findAll({ attributes: ['name', 'iataCode'] })).forEach((a) => { const k = bare(a.iataCode) || String(a.name || '').toUpperCase(); if (k) out.set(k, { name: a.name || '', iataCode: a.iataCode || '', inMaster: true }); });
        const rows = await Airwaybill.findAll({ attributes: ['agentName', 'agentCode'], where: { status: { [Op.or]: [{ [Op.ne]: 'VOID' }, null] } }, group: ['agentName', 'agentCode'] });
        rows.forEach((a) => { const k = bare(a.agentCode) || String(a.agentName || '').trim().toUpperCase(); if (k && !out.has(k)) out.set(k, { name: a.agentName || '', iataCode: a.agentCode || '', inMaster: false }); });
        res.json({ success: true, agents: [...out.values()].sort((x, y) => String(x.name).localeCompare(String(y.name))) });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/reports/csr-periods - last 24 CASS periods for the picker
router.get('/csr-periods', (req, res) => { res.json({ success: true, periods: require('../utils/awbReports').recentPeriods(24) }); });

// GET /api/reports/mis?from=YYYY-MM-DD&to=YYYY-MM-DD - the Director MIS, from the books. 30-Oct-2026
// The Director dashboard used to show invented figures (revenue "Rs 1.45 Cr", named clients, lane profit). Everything
// here is read: revenue = Sales vouchers, cost = Purchase vouchers, profit = the difference. Job-wise and lane-wise
// profit is only reported for jobs whose vouchers carry a job number (Voucher.jobNo) - a job with nothing booked
// against it is left out rather than filled with a guess.
router.get('/mis', async (req, res) => {
    try {
        const Voucher = require('../models/Voucher');
        const VoucherType = require('../models/VoucherType');
        const VoucherDetail = require('../models/VoucherDetail');
        const AccountLedger = require('../models/AccountLedger');
        const ImportJob = require('../models/ImportJob');
        const ExportJob = require('../models/ExportJob');

        const to = req.query.to || new Date().toISOString().slice(0, 10);
        const from = req.query.from || new Date(new Date(to).getFullYear(), 0, 1).toISOString().slice(0, 10);

        // 14-Nov-2026: added up in SQL. Before, every voucher of the period was read with all its lines and ledgers as
        // Sequelize objects (a year = 40,000+ vouchers, 5 lakh+ lines): one opening of Reports took the backend to 4-5 GB
        // of memory and the server was stopped by the system. Same figures; read on the read-only connection.
        const rq = require('../utils/readDb').q;
        const vrows = await rq(`SELECT v.id, v.jobNo, v.totalAmount, t.baseType FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId
            WHERE v.date BETWEEN ? AND ? AND t.baseType IN ('Sales', 'Purchase')`, [from, to]);
        // the party of a sales voucher: its largest Dr line
        const top = await rq(`SELECT voucherId, ledgerName FROM (SELECT d.voucherId, l.name ledgerName,
                row_number() OVER (PARTITION BY d.voucherId ORDER BY CAST(d.amount AS REAL) DESC, d.id) rn
              FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
              LEFT JOIN AccountLedgers l ON l.id = d.ledgerId
              WHERE v.date BETWEEN ? AND ? AND t.baseType = 'Sales' AND d.dc = 'Dr') x WHERE rn = 1`, [from, to]);
        const partyOf = new Map(top.map(r => [r.voucherId, r.ledgerName]));
        const amt = (v) => parseFloat(v.totalAmount) || 0;
        const sales = vrows.filter(v => v.baseType === 'Sales');
        const purch = vrows.filter(v => v.baseType === 'Purchase');
        const revenue = sales.reduce((a, v) => a + amt(v), 0);
        const cost = purch.reduce((a, v) => a + amt(v), 0);
        const profit = revenue - cost;

        // top clients: the party line of each sales voucher (the largest Dr line)
        const byClient = new Map();
        sales.forEach(v => {
            const name = partyOf.get(v.id) || 'Unallocated';
            byClient.set(name, (byClient.get(name) || 0) + amt(v));
        });
        const costByJob = new Map();
        purch.forEach(v => { if (v.jobNo) costByJob.set(v.jobNo, (costByJob.get(v.jobNo) || 0) + amt(v)); });
        const revByJob = new Map();
        sales.forEach(v => { if (v.jobNo) revByJob.set(v.jobNo, (revByJob.get(v.jobNo) || 0) + amt(v)); });

        const topClients = [...byClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
            .map(([name, rev]) => ({ name, revenue: Math.round(rev * 100) / 100 }));

        // jobs that actually have something booked against them
        const jobNos = [...new Set([...costByJob.keys(), ...revByJob.keys()])];
        let jobRows = [];
        if (jobNos.length) {
            // no attributes filter: the port boxes of a job are dynamic columns, so they are read off the row itself
            const imp = await ImportJob.findAll({ where: { jobNo: { [Op.in]: jobNos } } }).catch(() => []);
            const exp = await ExportJob.findAll({ where: { jobNo: { [Op.in]: jobNos } } }).catch(() => []);
            const pick = (j, keys) => { for (const k of keys) { const v = j[k] || (j.dataValues || {})[k]; if (v) return String(v); } return ''; };
            const meta = new Map();
            // the column names here are the ones the models actually declare (checked 30-Oct-2026), with the
            // screen's own dynamic columns as fallbacks - a key that does not exist just returns ''
            imp.forEach(j => meta.set(j.jobNo, { mode: pick(j, ['shipmentMode', 'transportMode', 'modeOfTransport']),
                lane: [pick(j, ['portOfOrigin', 'portOfShipment', 'portOfLoading', 'autoField_22']),
                    pick(j, ['portCode', 'portName', 'customHouseCode', 'autoField_2'])].filter(Boolean).join(' \u2192 ') }));
            exp.forEach(j => meta.set(j.jobNo, { mode: pick(j, ['shipmentMode', 'transportMode', 'modeOfTransport']),
                lane: [pick(j, ['loadingPortCode', 'customsPortCode', 'portCode', 'loadingPortName']),
                    pick(j, ['destPortCode', 'discPortCode', 'PortOfDischarge', 'destPortName', 'discPortName'])].filter(Boolean).join(' \u2192 ') }));
            jobRows = jobNos.map(no => {
                const r = revByJob.get(no) || 0, c = costByJob.get(no) || 0;
                const m = meta.get(no) || { mode: '', lane: '' };
                return { jobNo: no, revenue: Math.round(r * 100) / 100, cost: Math.round(c * 100) / 100,
                    profit: Math.round((r - c) * 100) / 100, mode: m.mode, lane: m.lane };
            }).sort((a, b) => b.profit - a.profit);
        }

        // lanes, only from jobs that have both a lane and something booked
        const byLane = new Map();
        jobRows.forEach(j => { if (!j.lane) return; const e = byLane.get(j.lane) || { lane: j.lane, revenue: 0, cost: 0, jobs: 0 };
            e.revenue += j.revenue; e.cost += j.cost; e.jobs += 1; byLane.set(j.lane, e); });
        const lanes = [...byLane.values()].map(l => ({ ...l, profit: Math.round((l.revenue - l.cost) * 100) / 100 }))
            .sort((a, b) => b.profit - a.profit).slice(0, 10);

        res.json({ success: true, from, to,
            kpis: {
                revenue: Math.round(revenue * 100) / 100,
                cost: Math.round(cost * 100) / 100,
                profit: Math.round(profit * 100) / 100,
                marginPct: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
                salesVouchers: sales.length, purchaseVouchers: purch.length,
            },
            topClients, jobs: jobRows.slice(0, 25), lanes,
            unlinked: {
                salesWithoutJob: sales.filter(v => !v.jobNo).length,
                purchasesWithoutJob: purch.filter(v => !v.jobNo).length,
            },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/unbilled-jobs?from&to&party&mode - jobs with no sales voucher against them. 30-Oct-2026
// Bulk Billing used to "find" four invented jobs (J-AE-1001 ... AWB-123-4567 to LHR). A job counts as billed when a
// Sales voucher carries its job number (Voucher.jobNo), which the billing screens now set.
router.get('/unbilled-jobs', async (req, res) => {
    try {
        const Voucher = require('../models/Voucher');
        const VoucherType = require('../models/VoucherType');
        const ImportJob = require('../models/ImportJob');
        const ExportJob = require('../models/ExportJob');
        const to = req.query.to || new Date().toISOString().slice(0, 10);
        const from = req.query.from || '1900-01-01';
        const party = String(req.query.party || '').trim().toLowerCase();
        const mode = String(req.query.mode || '').trim().toUpperCase();

        const billed = new Set();
        // 05-Nov-2026: only the job numbers of sales vouchers (all vouchers were read before - too slow with the iCAFFE history)
        const sales = await Voucher.sequelize.query("SELECT DISTINCT v.jobNo FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE t.baseType = 'Sales' AND v.jobNo IS NOT NULL AND v.jobNo <> ''", { type: require('sequelize').QueryTypes.SELECT });
        sales.forEach(v => billed.add(String(v.jobNo)));

        const inDates = (d) => { const x = String(d || '').slice(0, 10); return x && x >= from && x <= to; };
        const rows = [];
        const add = (j, kind) => {
            const g = (keys) => { for (const k of keys) { const v = j[k] || (j.dataValues || {})[k]; if (v) return String(v); } return ''; };
            const jobNo = g(['jobNo']);
            if (!jobNo || billed.has(jobNo)) return;
            const date = g(['jobDate', 'date']);
            // a job whose date box was never filled must NOT vanish from the "what have we not billed" list -
            // that is exactly the job most likely to be forgotten. It is kept and flagged instead.
            if (date && !inDates(date)) return;
            const client = g(['autoField_4', 'nameOfImporter', 'importerName', 'shipperName', 'exporterName', 'partyName']);
            if (party && !client.toLowerCase().includes(party)) return;
            const m = g(['shipmentMode', 'transportMode']);
            if (mode && !m.toUpperCase().startsWith(mode[0])) return;
            rows.push({ id: jobNo, jobNo, kind, date, client, mode: m, noDate: !date,
                refNo: g(['hawbNo', 'mawbNo', 'blNo', 'beNo', 'sbNo']),
                dest: g(['portCode', 'customHouseCode', 'portOfDestination', 'autoField_2']),
                weight: g(['grossWt', 'grossWeight']) });
        };
        (await ImportJob.findAll().catch(() => [])).forEach(j => add(j, 'IMPORT'));
        (await ExportJob.findAll().catch(() => [])).forEach(j => add(j, 'EXPORT'));
        rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
        res.json({ success: true, data: rows, from, to, undated: rows.filter(r => r.noDate).length,
            note: 'A job counts as billed when a Sales voucher carries its job number. Jobs with no date are listed too (noDate) so nothing silently drops out of the range.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ---------------------------------------------------------------------------
// GET /api/reports/expenses?from=&to=
// The Advanced Reports screen carried an "Expense & Purchase Register" built from
// three hardcoded rows (OOCL 3,90,000 / Delhivery 15,000 / SpaceWorks rent 85,000)
// under a comment that said "MOCK DATA FOR VARIOUS REPORTS". This reads the real
// Purchase and Payment vouchers. Whether a head is a direct cost or an overhead is
// taken from its account group's nature, not guessed from its name.
// Added 30-Oct-2026.
// ---------------------------------------------------------------------------
router.get('/expenses', async (req, res) => {
    try {
        const Voucher = require('../models/Voucher');
        const VoucherType = require('../models/VoucherType');
        const VoucherDetail = require('../models/VoucherDetail');
        const AccountLedger = require('../models/AccountLedger');
        const AccountGroup = require('../models/AccountGroup');
        const to = req.query.to || new Date().toISOString().slice(0, 10);
        const from = req.query.from || (new Date(to).getMonth() < 3 ? new Date(to).getFullYear() - 1 : new Date(to).getFullYear()) + '-04-01';

        const groups = await AccountGroup.findAll();
        const gById = new Map(groups.map(g => [g.id, g]));
        const chainOf = (gid) => { const out = []; let g = gById.get(gid), n = 0; while (g && n++ < 20) { out.push(g); g = g.parentId ? gById.get(g.parentId) : null; } return out; };
        const kindOf = (gid) => {
            const chain = chainOf(gid);
            const names = chain.map(g => g.name);
            // careful: "Indirect Expenses" contains the substring "direct Expense", so the overhead test
            // runs first and both are anchored to the whole group name. This was a real bug on 30-Oct-2026:
            // Office Rent under Indirect Expenses was being reported as a direct cost.
            if (names.some(n => /^\s*indirect\s+expense/i.test(n))) return 'Admin (overhead)';
            if (names.some(n => /^\s*(direct\s+expense|purchase\s+account)/i.test(n))) return 'Trade (direct cost)';
            const nature = chain.length ? chain[chain.length - 1].nature : '';
            return nature === 'Expenses' ? 'Expense (ungrouped)' : nature ? nature : 'Unclassified';
        };

        // 14-Nov-2026: read in SQL - only the Dr lines on expense heads, and the largest Cr line (the party) of each
        // voucher. Before, every voucher of the period was read with all lines and ledgers as Sequelize objects (GBs of
        // memory for a year). Same rows, same order; on the read-only connection.
        const rq = require('../utils/readDb').q;
        const expG = groups.filter(g => /cost|overhead|Expense/i.test(kindOf(g.id))).map(g => Number(g.id)).filter(Number.isFinite);
        const rows = [];
        if (expG.length) {
            const drs = await rq(`SELECT v.id, v.date, v.voucherNumber, v.jobNo, v.refNo, t.name tname, t.baseType, d.amount, d.remarks, l.name lname, l.groupId
                FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN VoucherDetails d ON d.voucherId = v.id JOIN AccountLedgers l ON l.id = d.ledgerId
                WHERE v.date BETWEEN ? AND ? AND t.baseType IN ('Purchase', 'Payment', 'Journal') AND d.dc = 'Dr' AND l.groupId IN (${expG.join(',')})
                ORDER BY v.date DESC, v.id DESC, d.id`, [from, to]);
            const party = new Map((await rq(`SELECT voucherId, lname FROM (SELECT d.voucherId, l.name lname,
                    row_number() OVER (PARTITION BY d.voucherId ORDER BY CAST(d.amount AS REAL) DESC, d.id) rn
                  FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN AccountLedgers l ON l.id = d.ledgerId
                  WHERE v.date BETWEEN ? AND ? AND t.baseType IN ('Purchase', 'Payment', 'Journal') AND d.dc = 'Cr') x WHERE rn = 1`, [from, to])).map(r => [r.voucherId, r.lname]));
            drs.forEach(d => {
                rows.push({
                    date: String(d.date || '').slice(0, 10),
                    vr: d.voucherNumber, voucherId: d.id, voucherKind: d.tname || d.baseType,
                    vendor: party.get(d.id) || '',
                    head: d.lname, amount: Math.round((parseFloat(d.amount) || 0) * 100) / 100,
                    type: kindOf(d.groupId), jobNo: d.jobNo || '', refNo: d.refNo || '', remarks: d.remarks || '',
                });
            });
        }

        const byHead = new Map();
        rows.forEach(r => byHead.set(r.head, (byHead.get(r.head) || 0) + r.amount));
        const r2 = (n) => Math.round(n * 100) / 100;
        res.json({
            success: true, from, to, data: rows,
            totals: {
                all: r2(rows.reduce((a, r) => a + r.amount, 0)),
                direct: r2(rows.filter(r => /direct/i.test(r.type)).reduce((a, r) => a + r.amount, 0)),
                overhead: r2(rows.filter(r => /overhead/i.test(r.type)).reduce((a, r) => a + r.amount, 0)),
                ungrouped: r2(rows.filter(r => /ungrouped/i.test(r.type)).reduce((a, r) => a + r.amount, 0)),
            },
            byHead: [...byHead.entries()].sort((a, b) => b[1] - a[1]).map(([head, amount]) => ({ head, amount: r2(amount) })),
            note: 'Direct cost vs overhead comes from each ledger’s account group (Direct Expenses / Purchase Accounts vs Indirect Expenses). ' +
                  'A head sitting directly under no expense group shows as "Expense (ungrouped)" rather than being guessed at.',
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------------
// GET /api/reports/collection?from=&to=&asOn=
// The "Client-wise Collection & Outstanding" report was three hardcoded rows.
// Billed and collected come from the Sales and Receipt vouchers; pending comes
// from the same FIFO open-item calculation the Outstanding report uses, so the
// two screens cannot disagree. lastFollowUp is the real follow-up log.
// Added 30-Oct-2026.
// ---------------------------------------------------------------------------
router.get('/collection', async (req, res) => {
    try {
        const Voucher = require('../models/Voucher');
        const VoucherType = require('../models/VoucherType');
        const VoucherDetail = require('../models/VoucherDetail');
        const AccountLedger = require('../models/AccountLedger');
        const CreditFollowUp = require('../models/CreditFollowUp');
        const { openItems } = require('../utils/openItems');

        const asOn = req.query.asOn || new Date().toISOString().slice(0, 10);
        const to = req.query.to || asOn;
        const from = req.query.from || (new Date(to).getMonth() < 3 ? new Date(to).getFullYear() - 1 : new Date(to).getFullYear()) + '-04-01';

        const { items, basis } = await openItems({ type: 'receivable', asOn });
        // 14-Nov-2026: billed / collected added up in SQL (before: every voucher of the period with all lines as
        // Sequelize objects - GBs of memory for a year); on the read-only connection
        const rq = require('../utils/readDb').q;
        const sums = await rq(`SELECT d.ledgerId, l.name, CASE WHEN t.baseType = 'Sales' THEN 'B' ELSE 'R' END k, sum(d.amount) amt
            FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN VoucherDetails d ON d.voucherId = v.id JOIN AccountLedgers l ON l.id = d.ledgerId
            WHERE v.date BETWEEN ? AND ? AND ((t.baseType = 'Sales' AND d.dc = 'Dr') OR (t.baseType IN ('Receipt', 'Contra') AND d.dc = 'Cr'))
            GROUP BY d.ledgerId, k`, [from, to]);
        const billed = new Map(), received = new Map(), names = new Map();
        sums.forEach(r => {
            names.set(r.ledgerId, r.name);
            (r.k === 'B' ? billed : received).set(r.ledgerId, parseFloat(r.amt) || 0);
        });

        const pendingBy = new Map(), oldestBy = new Map();
        items.forEach(i => {
            pendingBy.set(i.ledgerId, (pendingBy.get(i.ledgerId) || 0) + i.pending);
            oldestBy.set(i.ledgerId, Math.max(oldestBy.get(i.ledgerId) || -99999, i.overdueDays));
            names.set(i.ledgerId, i.party);
        });

        const fus = await CreditFollowUp.findAll({ order: [['createdAt', 'DESC']] });
        const lastFu = new Map();
        fus.forEach(f => { if (!lastFu.has(f.ledgerId)) lastFu.set(f.ledgerId, f); });

        const r2 = (n) => Math.round((n || 0) * 100) / 100;
        const bucketOf = (d) => d == null ? '-' : d <= 0 ? 'Within terms' : d <= 30 ? '1-30 days' : d <= 60 ? '31-60 days' : d <= 90 ? '61-90 days' : '90+ days';
        const ids = new Set([...billed.keys(), ...received.keys(), ...pendingBy.keys()]);
        const data = [...ids].map(id => {
            const f = lastFu.get(id);
            const pend = r2(pendingBy.get(id) || 0);
            return {
                ledgerId: id, client: names.get(id) || '',
                billed: r2(billed.get(id) || 0), collected: r2(received.get(id) || 0),
                pending: pend,
                bucket: pendingBy.has(id) ? bucketOf(oldestBy.get(id)) : 'Cleared',
                oldestOverdueDays: pendingBy.has(id) ? (oldestBy.get(id) || 0) : null,
                lastFollowUp: f && f.createdAt ? new Date(f.createdAt).toISOString().slice(0, 10) : '',
                lastFollowUpNote: f ? String(f.note).slice(0, 160) : '',
                nextPromise: f && f.promiseDate && f.promiseMet !== true ? f.promiseDate : '',
            };
        }).filter(r => r.billed || r.collected || r.pending)
          .sort((a, b) => b.pending - a.pending);

        res.json({
            success: true, from, to, asOn, data, basis,
            totals: {
                billed: r2(data.reduce((a, r) => a + r.billed, 0)),
                collected: r2(data.reduce((a, r) => a + r.collected, 0)),
                pending: r2(data.reduce((a, r) => a + r.pending, 0)),
                clientsWithNoFollowUp: data.filter(r => r.pending > 0 && !r.lastFollowUp).length,
            },
            note: 'Billed and collected are the Sales and Receipt vouchers in the period. Pending is the open-item balance as on ' + asOn +
                  ', which is a running balance and will not equal billed minus collected when the party owed money from before ' + from + '.',
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
