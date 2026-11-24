const express  = require('express');
const router   = express.Router();
const Party    = require('../models/Party');
const Airwaybill = require('../models/Airwaybill');
const HouseAWB = require('../models/HouseAWB');
const { Op, Sequelize } = require('sequelize');

// GET /api/search/global-search  (used by top search bar)
router.get('/global-search', async (req, res) => {
    try {
        const q = req.query.q || '';
        if (q.length < 2) return res.json({ parties: [], awbs: [] });

        const parties = await Party.findAll({
            where: { name: { [Op.like]: `%${q}%` } },
            limit: 5,
            attributes: ['id', 'name', 'partyType']
        });

        const mawbs = await Airwaybill.findAll({
            where: { awbNumber: { [Op.like]: `%${q}%` }, type: 'MAWB' },
            limit: 5,
            attributes: ['id', 'awbNumber']
        });

        const hawbs = await HouseAWB.findAll({
            where: { awbNumber: { [Op.like]: `%${q}%` } },
            limit: 5,
            attributes: ['id', 'awbNumber']
        });

        const awbs = [
            ...mawbs.map(m => ({ id: m.id, no: m.awbNumber, type: 'MAWB' })),
            ...hawbs.map(h => ({ id: h.id, no: h.awbNumber, type: 'HAWB' }))
        ];

        let results = [];
        const likeQuery = `%${q}%`;
        // fix 28-Oct-2026: models/JobTimeline does not exist, which made every global search fail.
        // Remarks are searched only if that model is present.
        let timelines = [];
        try {
            const JobTimeline = require('../models/JobTimeline');
            timelines = await JobTimeline.findAll({ where: { message: { [Op.like]: likeQuery } } });
        } catch (e) { timelines = []; }

        timelines.forEach(log => {
            results.push({
                type: 'REMARK',
                id: log.jobId,
                title: 'Remark in Job #' + log.jobId + ': ' + (log.message ? log.message.substring(0, 30) : ''),
                link: '/job/' + log.jobId
            });
        });

        if (results.length >= 10) return res.json(results.slice(0, 10));

        res.json({
            parties: parties.map(p => ({ id: p.id, name: p.name, type: p.partyType })),
            awbs,
            results
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Search failed' });
    }
});


// GET /api/search/awb-query  (Search Air Waybill screen) - rewritten 29-Oct-2026. Before:
// - DIRECT AWB and MASTER gave the same rows (no type filter); a HAWB number was ignored unless HOUSE was picked;
// - the airline filter got the airline NAME and compared it with the AWB prefix, so it never matched, and it replaced
//   the AWB number filter; an AWB number typed without the dash was not found;
// - routing FINISHED meant every status (ACTIVE included); HAWBs ignored it;
// - chargeable weight was always empty, freight showed PP or CC (not both), sub-agent / tie-up / cargo were never read.
// Routing now means: FINISHED = flight number and date filled in, PENDING = not yet.
router.get('/awb-query', async (req, res) => {
    try {
        const q = req.query;
        const awbType = String(q.awbType || 'ALL').toUpperCase();
        const like = (v) => `%${String(v).trim()}%`;
        const noDash = (col, v) => Sequelize.where(Sequelize.fn('REPLACE', Sequelize.col(col), '-', ''), { [Op.like]: like(String(v).replace(/[^A-Za-z0-9]/g, '')) });
        const bare = (n) => String(n || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

        // airline: name / 2-letter code / 3-digit prefix -> prefixes
        let prefixes = null;
        if (q.airline && String(q.airline).trim()) {
            const a = String(q.airline).trim().toLowerCase();
            const Airline = require('../models/Airline');
            const list = await Airline.findAll({ attributes: ['name', 'code2', 'prefix'] });
            prefixes = list.filter((x) => (x.prefix && x.prefix === a) || (x.code2 && x.code2.toLowerCase() === a) || (x.name && x.name.toLowerCase().includes(a))).map((x) => String(x.prefix || '')).filter(Boolean);
            if (/^\d{3}$/.test(a)) prefixes.push(a);
            if (!prefixes.length) return res.json({ success: true, data: [], total: 0, message: `No airline matches "${q.airline}"` });
        }

        const common = [{ status: { [Op.or]: [{ [Op.ne]: 'VOID' }, null] } }];
        // 10-Nov-2026: only the branch picked in the top bar (AWBs without a branch = default branch)
        common.push(await require('../utils/awbBranch').where(req));
        // the year picked in the top bar, unless dates or an AWB / HAWB number are given (those find any year)
        if (!q.fromDate && !q.toDate && !String(q.awbNo || '').trim() && !String(q.hawbNo || '').trim()) common.push(await require('../utils/awbBranch').fyWhere(req));
        // dates: AWB date (created) by default, or the flight date (dateBasis=FLIGHT, checked after the house gets its master's flight)
        const byFlight = String(q.dateBasis || '').toUpperCase() === 'FLIGHT';
        if (!byFlight && q.fromDate) common.push({ createdAt: { [Op.gte]: new Date(q.fromDate + 'T00:00:00') } });
        if (!byFlight && q.toDate) common.push({ createdAt: { [Op.lte]: new Date(q.toDate + 'T23:59:59') } });
        if (q.origin && String(q.origin).trim()) common.push({ origin: { [Op.like]: String(q.origin).trim().toUpperCase() + '%' } });
        if (q.destination && String(q.destination).trim()) common.push({ destination: { [Op.like]: String(q.destination).trim().toUpperCase() + '%' } });
        if (q.awbNature && q.awbNature !== 'BOTH') common.push({ chargeCode: { [Op.like]: (q.awbNature === 'PREPAID' ? 'P' : 'C') + '%' } });
        if (q.shipper && String(q.shipper).trim()) common.push({ shipperName: { [Op.like]: like(q.shipper) } });
        if (q.consignee && String(q.consignee).trim()) common.push({ consigneeName: { [Op.like]: like(q.consignee) } });
        // flight: on the AWB / MAWB itself; a house is matched on its own flight or its master's (checked after the rows are built)
        const flightNo = String(q.flightNo || q.docketNo || '').replace(/\s+/g, '').toUpperCase();

        const wantAwb = !q.hawbNo && ['ALL', 'NORMAL', 'MASTER'].includes(awbType);
        const wantHouse = !!q.hawbNo || ['ALL', 'HOUSE'].includes(awbType);
        const rows = [];

        let masters = [];
        if (wantAwb) {
            const and = [...common];
            if (awbType === 'NORMAL') and.push({ type: 'AWB' });
            if (awbType === 'MASTER') and.push({ [Op.or]: [{ type: 'MAWB' }, { type: null }, { type: '' }] });
            if (q.awbNo && String(q.awbNo).trim()) and.push(noDash('awbNumber', q.awbNo));
            if (prefixes) and.push({ [Op.or]: prefixes.map((p) => ({ awbNumber: { [Op.like]: `${p}%` } })) });
            if (flightNo) and.push({ flightNumber1: { [Op.like]: like(flightNo) } });
            masters = await Airwaybill.findAll({ where: { [Op.and]: and }, order: [['createdAt', 'DESC']], limit: 3000 });
        }
        let houses = [];
        if (wantHouse) {
            const and = [...common];
            if (q.hawbNo && String(q.hawbNo).trim()) and.push(noDash('awbNumber', q.hawbNo));
            if (q.awbNo && String(q.awbNo).trim()) and.push(noDash('masterAwbNumber', q.awbNo));
            if (prefixes) and.push({ [Op.or]: prefixes.map((p) => ({ masterAwbNumber: { [Op.like]: `${p}%` } })) });
            houses = await HouseAWB.findAll({ where: { [Op.and]: and }, order: [['createdAt', 'DESC']], limit: 3000 });
        }

        // chargeable weight from the rate lines
        const AwbRateLine = require('../models/AwbRateLine');
        const cw = {};
        const addCw = async (ids, types, tag) => {
            if (!ids.length) return;
            for (const l of await AwbRateLine.findAll({ where: { awbId: ids, awbType: types }, attributes: ['awbId', 'chargeableWeight'] })) {
                const k = tag + l.awbId; cw[k] = (cw[k] || 0) + (parseFloat(l.chargeableWeight) || 0);
            }
        };
        await addCw(masters.map((m) => m.id), ['AWB', 'MAWB'], 'A');
        await addCw(houses.map((h) => h.id), ['HAWB'], 'H');
        // flight of the master for houses saved without one
        const masterNos = [...new Set(houses.map((h) => h.masterAwbNumber).filter(Boolean))];
        const mFlight = {};
        if (masterNos.length) {
            const ms = await Airwaybill.findAll({ where: { [Op.or]: masterNos.map((n) => noDash('awbNumber', n)) }, attributes: ['id', 'awbNumber', 'flightNumber1', 'flightDate1'] });
            ms.forEach((m) => { mFlight[bare(m.awbNumber)] = m; });
        }

        const { stageOf, trackKey, trackingMap, houseTrack } = require('../utils/awbStage');
        const tracks = await trackingMap([...masters.map((m) => m.awbNumber), ...masterNos]);
        const fdOf = (r) => { let f = r.formData; if (typeof f === 'string') { try { f = JSON.parse(f); } catch (e) { f = {}; } } return f || {}; };
        const money = (r) => (parseFloat(r.totalChargePP) || 0) + (parseFloat(r.totalChargeCC) || 0);
        const toRow = (r, isHouse) => {
            const fd = fdOf(r);
            const mf = isHouse ? mFlight[bare(r.masterAwbNumber)] : null;
            const flight = r.flightNumber1 || (mf && mf.flightNumber1) || '';
            const flightDate = r.flightDate1 || (mf && mf.flightDate1) || '';
            const c = cw[(isHouse ? 'H' : 'A') + r.id];
            const tr = isHouse ? houseTrack(tracks[trackKey(r.masterAwbNumber, r.awbNumber)], tracks[trackKey(r.masterAwbNumber, '')]) : tracks[trackKey(r.awbNumber, '')];
            return {
                id: r.id,
                masterId: isHouse && mf ? mf.id : null,
                stage: stageOf(r, tr),
                type: isHouse ? 'HAWB' : (r.type || 'MAWB'),
                docketNo: flight,
                flight, flightDate,
                awbDate: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '',
                createdAt: r.createdAt,
                awbNo: isHouse ? (r.masterAwbNumber || '') : (r.awbNumber || ''),
                hawbNo: isHouse ? (r.awbNumber || '') : '',
                shipper: r.shipperName || '', consignee: r.consigneeName || '',
                origin: r.origin || '', dstn: r.destination || '',
                pc: r.chargeCode || '',
                pkgs: r.totalPieces || 0,
                grWt: (parseFloat(r.grossWeight) || 0).toFixed(2),
                chgWt: c ? c.toFixed(2) : '',
                totalFreight: money(r).toFixed(2),
                currency: r.currencyCode || '',
                subagt: (fd.subAgent && fd.subAgent.name) || '',
                tieup: (fd.overseasAgent && fd.overseasAgent.name) || '',
                routingStatus: flight && flightDate ? 'FINISHED' : 'PENDING',
                status: r.status || 'ACTIVE',
                cargoType: r.natureOfGoods || '',
                remarks: r.handlingInformation || '',
            };
        };
        rows.push(...masters.map((m) => toRow(m, false)), ...houses.map((h) => toRow(h, true)));
        let data = rows;
        const routing = String(q.routing || 'ALL').toUpperCase();
        if (routing === 'FINISHED' || routing === 'PENDING') data = data.filter((r) => r.routingStatus === routing);
        if (flightNo) data = data.filter((r) => String(r.flight || '').toUpperCase().replace(/\s+/g, '').includes(flightNo));
        const stage = String(q.stage || q.status || 'ALL').toUpperCase();
        if (stage !== 'ALL') data = data.filter((r) => r.stage === stage);
        if (byFlight && (q.fromDate || q.toDate)) {
            data = data.filter((r) => { const d = String(r.flightDate || '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false; return (!q.fromDate || d >= q.fromDate) && (!q.toDate || d <= q.toDate); });
        }
        data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id);
        res.json({ success: true, data, total: data.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Query failed: ' + err.message });
    }
});

module.exports = router;
