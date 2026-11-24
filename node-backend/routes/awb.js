const express = require('express');
const router = express.Router();

const AwbTracking = require('../models/AwbTracking');
const HouseAWB = require('../models/HouseAWB');

// GET /api/awb/tracking  (Track Shipments screen) - rewritten 29-Oct-2026. Before:
// - status PENDING / FINISHED was compared with the tracking status word (RECEIVED, DEPARTED ... never matched FINISHED
//   until delivery, PENDING missed everything that had moved); date type (departure / arrival) was ignored and the
//   "to" date dropped flights on that day (2026-10-30T10:00 > 2026-10-30);
// - a HAWB number could not be searched; VOID AWBs were listed; an airline name that matched nothing returned all rows.
// Now the rows are the live AWB / MAWB / HAWB records with their tracking (same as the dashboard).
router.get('/tracking', async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const q = req.query;
        const Airline = require('../models/Airline');
        const airlines = await Airline.findAll({ attributes: ['id', 'name', 'code2', 'prefix', 'trackingUrl'] });
        const AB = require('../utils/awbBranch');
        const { rows } = await loadAwbRows({ [Op.and]: [{ status: { [Op.or]: [{ [Op.ne]: 'VOID' }, null] } }, await AB.where(req), await AB.fyWhere(req)] }); // 10-Nov-2026: branch + year
        const bare = (n) => String(n || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const DOC = { AWB: 'AIR WAYBILL', MAWB: 'MASTER', HAWB: 'HOUSE' };
        const day = (v) => { const s = String(v || ''); const m = s.match(/^(\d{4}-\d{2}-\d{2})/); if (m) return m[1]; const d = new Date(s); return isNaN(d) ? '' : d.toISOString().slice(0, 10); };

        let out = rows.map((r) => ({ ...r, documentType: DOC[r.type] || 'MASTER', departureDate: r.dep || r.flightDate || '', arrivalDate: r.arr || r.rcf || '' }));
        if (q.documentType && q.documentType !== 'ALL') out = out.filter((r) => r.documentType === String(q.documentType).toUpperCase());
        if (q.awbNumber && String(q.awbNumber).trim()) {
            const n = bare(q.awbNumber);
            out = out.filter((r) => bare(r.awbNumber).includes(n) || bare(r.hawbNumber).includes(n));
        }
        if (q.airline && String(q.airline).trim()) {
            const a = String(q.airline).trim().toLowerCase();
            let prefixes = airlines.filter((x) => (x.prefix && x.prefix === a) || (x.code2 && x.code2.toLowerCase() === a) || (x.name && x.name.toLowerCase().includes(a))).map((x) => String(x.prefix || ''));
            if (/^\d{3}$/.test(a)) prefixes.push(a);
            prefixes = [...new Set(prefixes.filter(Boolean))];
            out = out.filter((r) => prefixes.includes(bare(r.awbNumber).slice(0, 3)));
        }
        const st = q.status && q.status !== 'ALL' ? String(q.status).toUpperCase() : '';
        if (st === 'FINISHED') out = out.filter((r) => r.stage === 'DELIVERED');
        else if (st === 'PENDING') out = out.filter((r) => r.stage !== 'DELIVERED');
        else if (st) out = out.filter((r) => r.stage === st);
        if (q.shipper && String(q.shipper).trim()) { const s = String(q.shipper).trim().toUpperCase(); out = out.filter((r) => String(r.shipperName || '').toUpperCase().includes(s) || String(r.consigneeName || '').toUpperCase().includes(s)); }
        if (q.origin && String(q.origin).trim()) out = out.filter((r) => String(r.origin).toUpperCase().startsWith(String(q.origin).trim().toUpperCase()));
        if (q.destination && String(q.destination).trim()) out = out.filter((r) => String(r.destination).toUpperCase().startsWith(String(q.destination).trim().toUpperCase()));
        if (q.fromDate || q.toDate) {
            const pick = (r) => (q.dateType === 'ARRIVAL' ? day(r.arrivalDate) : q.dateType === 'DEPARTURE' ? day(r.departureDate) : day(r.departureDate) || day(r.createdAt));
            out = out.filter((r) => { const d = pick(r); if (!d) return false; if (q.fromDate && d < q.fromDate) return false; if (q.toDate && d > q.toDate) return false; return true; });
        }
        res.json({ success: true, data: out, total: out.length, airlines });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- event history, hand-entered milestones, customer updates (29-Oct-2026) ----
// GET /api/awb/tracking/events?awbNumber=176-12345675&hawbNumber=H1
// all events of the AWB (and, for a house, the master's events too: the house flies with its master)
router.get('/tracking/events', async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const AwbTrackingEvent = require('../models/AwbTrackingEvent');
        const { normAwb, CODE_NAME } = require('../utils/awbTrackingEvents');
        const awb = normAwb(req.query.awbNumber);
        const hawb = req.query.hawbNumber ? String(req.query.hawbNumber).trim() : null;
        if (!awb) return res.status(400).json({ error: 'awbNumber is required' });
        const b = awb.replace(/\D/g, '');
        const where = { awbNumber: [awb, b], [Op.or]: [{ hawbNumber: null }, ...(hawb ? [{ hawbNumber: hawb }] : [])] };
        const events = await AwbTrackingEvent.findAll({ where, order: [['eventAt', 'ASC'], ['id', 'ASC']] });
        const tr = await AwbTracking.findOne({ where: { awbNumber: [awb, b], hawbNumber: hawb } });
        const Airline = require('../models/Airline');
        const al = await Airline.findOne({ where: { prefix: b.slice(0, 3) } });
        const url = al && al.trackingUrl ? String(al.trackingUrl).replace(/\{awb\}/gi, b).replace(/\{prefix\}/gi, b.slice(0, 3)).replace(/\{serial\}/gi, b.slice(3)).replace(/\{awbdash\}/gi, awb) : null;
        const logs = await AwbLog.findAll({ where: { awbNumber: hawb ? [awb, hawb] : [awb] }, order: [['createdAt', 'ASC']], limit: 200 });
        res.json({
            success: true, awbNumber: awb, hawbNumber: hawb,
            events: events.map((e) => ({ ...e.toJSON(), name: CODE_NAME[e.code] || e.code, scope: e.hawbNumber ? 'HAWB' : 'MAWB' })),
            tracking: tr, airline: al ? { name: al.name, code2: al.code2, prefix: al.prefix } : null, airlineTrackingUrl: url,
            logs: logs.map((l) => ({ action: l.action, user: l.user, details: l.details, at: l.createdAt })),
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/awb/tracking/event { awbNumber, hawbNumber?, code, eventAt, station?, flight?, pieces?, weight?, note? }
// a milestone entered by hand (e.g. the airline told it on the phone)
router.post('/tracking/event', async (req, res) => {
    try {
        const { recordEvent, CODES } = require('../utils/awbTrackingEvents');
        const b = req.body || {};
        const code = String(b.code || '').toUpperCase();
        if (!CODES.includes(code)) return res.status(400).json({ error: `Pick a milestone: ${CODES.join(', ')}` });
        const when = new Date(b.eventAt);
        if (!b.eventAt || isNaN(when)) return res.status(400).json({ error: 'Give the date and time it happened' });
        if (when - Date.now() > 6 * 3600 * 1000) return res.status(400).json({ error: 'The time cannot be in the future' });
        if (b.station && !/^[A-Za-z]{3}$/.test(String(b.station).trim())) return res.status(400).json({ error: 'Station must be a 3-letter airport code' });
        if (b.pieces !== undefined && b.pieces !== '' && !(Number.isInteger(+b.pieces) && +b.pieces >= 0)) return res.status(400).json({ error: 'Pieces must be a whole number' });
        if (b.weight !== undefined && b.weight !== '' && !(+b.weight >= 0)) return res.status(400).json({ error: 'Weight must be 0 or more' });
        // the AWB / HAWB must exist and be live
        const { Op } = require('sequelize');
        const bare = String(b.awbNumber || '').replace(/[^A-Za-z0-9]/g, '');
        const dashed = /^\d{11}$/.test(bare) ? `${bare.slice(0, 3)}-${bare.slice(3)}` : b.awbNumber;
        const live = { [Op.or]: [{ [Op.ne]: 'VOID' }, null] };
        const found = b.hawbNumber
            ? await HouseAWB.findOne({ where: { awbNumber: String(b.hawbNumber).trim(), masterAwbNumber: [dashed, bare], status: live } })
            : await Airwaybill.findOne({ where: { awbNumber: [dashed, bare], status: live } });
        if (!found) return res.status(404).json({ error: b.hawbNumber ? `HAWB ${b.hawbNumber} of ${dashed} not found` : `AWB ${dashed} not found` });
        const user = req.user?.username || 'System';
        const r = await recordEvent({ ...b, code, eventAt: when.toISOString(), source: 'MANUAL', user });
        if (r.duplicate) return res.status(409).json({ error: `${code} at this time is already there` });
        await AwbLog.create({ awbNumber: b.hawbNumber || dashed, action: 'MILESTONE_ADDED', user, details: `${code} ${when.toISOString()}${b.station ? ' ' + String(b.station).toUpperCase() : ''}${b.note ? ' - ' + String(b.note).slice(0, 100) : ''}` }).catch(() => {});
        res.json({ success: true, event: r.event });
    } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// DELETE /api/awb/tracking/event/:id - only a hand-entered event can be removed (an airline FSU stays)
router.delete('/tracking/event/:id', async (req, res) => {
    try {
        const AwbTrackingEvent = require('../models/AwbTrackingEvent');
        const ev = await AwbTrackingEvent.findByPk(req.params.id);
        if (!ev) return res.status(404).json({ error: 'Event not found' });
        if (ev.source !== 'MANUAL') return res.status(409).json({ error: 'Only a milestone entered by hand can be removed' });
        const row = await AwbTracking.findOne({ where: { awbNumber: [ev.awbNumber, ev.awbNumber.replace(/\D/g, '')], hawbNumber: ev.hawbNumber } });
        const col = ev.code.toLowerCase();
        const wasShown = row && row[col] === ev.eventAt;
        await ev.destroy();
        if (wasShown) await require('../utils/awbTrackingEvents').refreshMilestone(ev.awbNumber, ev.hawbNumber, ev.code);
        await AwbLog.create({ awbNumber: ev.hawbNumber || ev.awbNumber, action: 'MILESTONE_REMOVED', user: req.user?.username || 'System', details: `${ev.code} ${ev.eventAt}` }).catch(() => {});
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET / PUT /api/awb/notify-settings - customer shipment updates (off by default; changing needs an admin)
router.get('/notify-settings', async (req, res) => {
    try { res.json({ success: true, settings: await require('../utils/awbNotify').getSettings(), canEdit: String(req.user?.role || '').toLowerCase() === 'admin' }); }
    catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/notify-settings', async (req, res) => {
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'admin') return res.status(403).json({ error: 'Only an admin can change customer updates' });
        const settings = await require('../utils/awbNotify').saveSettings(req.body || {});
        await AwbLog.create({ awbNumber: '-', action: 'NOTIFY_SETTINGS', user: req.user?.username || 'System', details: JSON.stringify(settings).slice(0, 250) }).catch(() => {});
        res.json({ success: true, settings });
    } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// POST /api/awb/tracking (For dummy/testing generation)
router.post('/tracking', async (req, res) => {
    try {
        const tracking = await AwbTracking.create(req.body);
        res.json(tracking);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const Airwaybill = require('../models/Airwaybill');
const AwbLog = require('../models/AwbLog');
const AwbRateLine = require('../models/AwbRateLine');
const AwbOtherCharge = require('../models/AwbOtherCharge');
const AwbOci = require('../models/AwbOci');
const AwbDimension = require('../models/AwbDimension');
const SpecialHandlingCode = require('../models/SpecialHandlingCode');
const { mainFields, writeChildren, validateAwb, ediReadyErrors } = require('../utils/awbSave');
const AwbExtraDoc = require('../models/AwbExtraDoc');
const CHILD_MODELS = { SpecialHandlingCode, AwbRateLine, AwbOtherCharge, AwbOci, AwbDimension, AwbExtraDoc };
const typesOf = (type) => (String(type).toUpperCase() === 'HAWB' ? ['HAWB'] : ['AWB', 'MAWB']);
const liveWhere = () => { const { Op } = require('sequelize'); return { [Op.or]: [{ [Op.ne]: 'VOID' }, null] }; };
// AWB number written the way the screens send it (176-12345675); HAWB numbers as typed
const normAwbNo = (no, type) => { const bare = String(no || '').replace(/[^A-Za-z0-9]/g, ''); return String(type).toUpperCase() !== 'HAWB' && /^\d{11}$/.test(bare) ? `${bare.slice(0, 3)}-${bare.slice(3)}` : String(no || '').trim(); };
async function numberTaken(Model, no, type, exceptId) {
    const { Op } = require('sequelize');
    const bare = String(no || '').replace(/[^A-Za-z0-9]/g, '');
    const where = { awbNumber: { [Op.in]: [...new Set([no, bare, normAwbNo(no, type)])] }, status: liveWhere() };
    if (exceptId) where.id = { [Op.ne]: exceptId };
    return Model.findOne({ where });
}
const iataSanitizer = require('../middleware/iataSanitizer');
const { awbSchema } = require('../utils/iataValidation');

const IataPayloadGenerator = require('../utils/IataPayloadGenerator');
const { generateXfwb, generateXfhl, generateXfzb, generateXffm, liveHousesOf, houseKg } = require('../utils/XmlPayloadGenerator');
// houses of a consol against their master (29-Oct-2026): every house ready for EDI, house totals within the master
function consolErrors(mawb, houses) {
    const errs = [];
    let pcs = 0, wt = 0;
    for (const h of houses) {
        for (const e of ediReadyErrors(h, 'HAWB')) errs.push(`HAWB ${h.awbNumber}: ${e}`);
        pcs += parseInt(h.totalPieces, 10) || 0; wt += houseKg(h); // pounds converted (needs the rate lines: liveHousesOf(.., true))
    }
    const mp = parseInt(mawb.totalPieces, 10) || 0, mw = parseFloat(mawb.grossWeight) || 0;
    if (mp && pcs > mp) errs.push(`Houses have ${pcs} pieces, more than the master's ${mp}`);
    if (mw && wt > mw + 0.5) errs.push(`Houses weigh ${wt.toFixed(1)} kg, more than the master's ${mw.toFixed(1)} kg`);
    return errs;
}
const { uploadWithRetry, getSftpConfigStatus } = require('../utils/SftpService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AWBDocument = require('../models/AWBDocument');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'awb');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + ext);
    }
});
// 29-Oct-2026: any file of any size was taken and then served from /uploads on the same site (an .html / .svg / .js
// upload would run in the user's browser). Now: documents and pictures only, 15 MB each, 10 per upload.
const DOC_EXT = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.gif', '.bmp', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.msg', '.eml'];
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024, files: 10 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (DOC_EXT.includes(ext)) return cb(null, true);
        const e = new Error(`${file.originalname}: file type ${ext || '(none)'} is not allowed (PDF, pictures, Word, Excel, CSV, text, e-mail)`); e.code = 'BAD_TYPE'; cb(e);
    } });
// upload errors as JSON for the window (before: the express error page)
const docsUpload = (req, res, next) => upload.array('docs', 10)(req, res, (err) => {
    if (!err) return next();
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'A file is larger than 15 MB' : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Up to 10 files at a time' : err.message;
    res.status(400).json({ error: msg });
});




// POST /api/awb/create
router.post('/create', async (req, res) => {
  try {
    const { type, formData, rateLines, otherCharges, sphCodes, ociRows, dimRows, ssr, osi, sci, branchId, financialYearId } = req.body;
    // 29-Oct-2026: server checks (number + check digit, airports, parties, rate lines ...) - before, anything was saved
    const errs = validateAwb(req.body, type, true);
    if (errs.length) return res.status(400).json({ error: errs.join('\n'), errors: errs });
    const awbNumber = normAwbNo(req.body.awbNumber, type);
    const masterAwbNumber = type === 'HAWB' ? normAwbNo(req.body.masterAwbNumber, 'MAWB') : (req.body.masterAwbNumber || null);
    if (type === 'HAWB') {
        const m = await Airwaybill.findOne({ where: { awbNumber: masterAwbNumber }, order: [['id', 'DESC']] });
        if (m && m.status === 'VOID' && !(await numberTaken(Airwaybill, masterAwbNumber, 'MAWB'))) return res.status(409).json({ error: `MAWB ${masterAwbNumber} is VOID - link the HAWB to a live MAWB` });
        // 11-Nov-2026: a house added to a master already sent to the airline - not after departure; before it, the
        // master's XFHL must be sent again (marked AMENDED after the house is saved)
        var createMaster = await masterOf(masterAwbNumber);
        if (createMaster && isSent(createMaster)) { const flown = await flownInfo(createMaster.awbNumber); if (flown) return res.status(409).json({ flown: true, error: `MAWB ${createMaster.awbNumber} has ${flown} - a house cannot be added to it now.` }); }
    }
    
    // all columns from the shared mapping (utils/awbSave.js, 29-Oct-2026)
    const payload = {
        ...mainFields(req.body, null),
        branchId, financialYearId,
        awbNumber,
        masterAwbNumber: masterAwbNumber || null, // HAWB linked to MAWB
        type: type,
        createdBy: req.user?.username || 'System',
    };

    // 10-Nov-2026: the branch picked in the top bar (the screens never sent one, so every AWB had no branch) and its year
    if (!payload.branchId) payload.branchId = (await require('../utils/awbBranch').scope(req)).saveId;
    // financial year from the AWB's own date (executed date, else today) - not from the year picked in the top bar
    { const fyD = await require('../utils/awbBranch').fyFor(payload.executedDate); if (fyD) payload.financialYearId = fyD; else if (!payload.financialYearId) { const fyH = parseInt(req.get('x-fy'), 10); if (fyH) payload.financialYearId = fyH; } }

    // Same AWB / HAWB number must not be saved twice (void ones can be reused)
    {
        const { Op } = require('sequelize');
        const Model = type === 'HAWB' ? HouseAWB : Airwaybill;
        const bare = String(awbNumber || '').replace(/[^A-Za-z0-9]/g, '');
        const dashed = type === 'HAWB' || bare.length !== 11 ? awbNumber : `${bare.slice(0, 3)}-${bare.slice(3)}`;
        const dup = awbNumber && await Model.findOne({ where: { awbNumber: { [Op.in]: [awbNumber, bare, dashed] }, status: { [Op.or]: [{ [Op.ne]: 'VOID' }, null] } } });
        if (dup) return res.status(409).json({ error: `${type === 'HAWB' ? 'HAWB' : 'AWB'} ${awbNumber} already exists (id ${dup.id}). Open it and update instead.`, existingId: dup.id });
    }

    // 10-Nov-2026: the airline's AWB number should come from the AWB stock (Stock Master). A number that is not in the
    // stock, or is already USED / VOID there, is saved only after the operator says so (_stockOk). HAWB: only a
    // number marked USED in the HAWB stock is asked about (house numbers are often not kept in a stock).
    if (!(req.body._stockOk === true || req.body._stockOk === 'true')) {
        const w = await stockWarning(type, awbNumber);
        if (w) return res.status(409).json({ stockWarning: true, okFlag: '_stockOk', error: w });
    }
    if (!(req.body._carrierOk === true || req.body._carrierOk === 'true')) {
        const w = await carrierWarning(type, awbNumber, formData);
        if (w) return res.status(409).json({ okFlag: '_carrierOk', error: w });
    }

    // Main record + SPH + rate lines + charges + OCI + dims are saved together or not at all
    const { sequelize } = require('../db');
    const t = await sequelize.transaction();
    let awbRecord;
    try {
    if (type === 'HAWB') {
        awbRecord = await HouseAWB.create(payload, { transaction: t });
    } else {
        awbRecord = await Airwaybill.create(payload, { transaction: t });
    }

    const awbId = awbRecord.id;
    await writeChildren(CHILD_MODELS, awbId, type, req.body, t, false);
    // e-documents uploaded before the first save (kept under the screen's temporary id) now belong to this AWB
    if (req.body.docTempId) {
        await AWBDocument.update({ awbId, awbType: type }, { where: { tempId: String(req.body.docTempId), awbId: null }, transaction: t });
    }

    await t.commit();
    } catch (saveErr) {
        await t.rollback().catch(() => {});
        throw saveErr;
    }
    const awbId = awbRecord.id;

    if (type === 'HAWB' && masterAwbNumber) {
        await recalculateMawbTotals(masterAwbNumber);
    }

    // Auto-create/update Tracking record so Track Shipments screen shows data immediately
    try {
        const docType = type === 'HAWB' ? 'HOUSE' : (payload.type === 'MAWB' ? 'MASTER' : 'AIR WAYBILL');
        const actualAwbNum = type === 'HAWB' ? (payload.masterAwbNumber || awbNumber) : awbNumber;
        const actualHawbNum = type === 'HAWB' ? awbNumber : null;
        await AwbTracking.findOrCreate({
            where: { awbNumber: actualAwbNum, hawbNumber: actualHawbNum },
            defaults: {
                awbNumber: actualAwbNum,
                hawbNumber: actualHawbNum,
                documentType: docType,
                saved: true,
                submittedToAirline: false,
                origin:         payload.origin       || '',
                destination:    payload.destination  || '',
                departureDate:  payload.flightDate1  || '',
                status:         'PENDING'
            }
        });
    } catch (trackErr) {
        console.warn('[Tracking] Could not create tracking record:', trackErr.message);
    }

    // --- Update Stock Master ---
    try {
        const pureNo = awbNumber.replace(/[^a-zA-Z0-9]/g, '');
        if (type === 'HAWB') {
            const HawbStock = require('../models/HawbStock');
            await HawbStock.update({ status: 'USED' }, { where: { fullHawbNumber: pureNo } });
        } else {
            const AwbStock = require('../models/AwbStock');
            await AwbStock.update({ status: 'USED' }, { where: { fullAwbNumber: pureNo } });
        }
    } catch(e) { console.error('Failed to update stock status', e); }
    
    if (type === 'HAWB' && typeof createMaster !== 'undefined' && createMaster) await markMasterAmended(createMaster, `HAWB ${awbNumber} added`, req.user?.username || 'System').catch(() => {});
    try { const AwbLog = require('../models/AwbLog'); await AwbLog.create({ awbNumber, action: 'AWB_CREATED', user: req.user?.username || req.body.user || 'System', details: 'AWB created via UI.' }); } catch(e){} res.status(201).json({ success: true, awbId: awbRecord.id, awbNumber });
  } catch (err) {

    console.error("Create AWB Error:", err);
    res.status(500).json({ error: err.message });
  }
});


// POST /api/awb/:id/transmit  (old stub — kept for backward compat, generates FWB text)
router.post('/:id/transmit', async (req, res) => {
    try {
        const payload = await IataPayloadGenerator.generateFwb(req.params.id);
        res.status(200).json({ success: true, payload });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── XFWB / XFHL XML Generation ────────────────────────────────────────────────

// GET /api/awb/:id/xfwb  → Generate XFWB XML (download)
router.get('/:id/xfwb', async (req, res) => {
    try {
        const xml = await generateXfwb(req.params.id, { companyOf: ourCompany }); // our address in the forwarder block (11-Nov-2026)
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="AWB_${req.params.id}_XFWB.xml"`);
        res.send(xml);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/awb/:id/xfwb-preview  → Preview XFWB XML in JSON
router.get('/:id/xfwb-preview', async (req, res) => {
    try {
        const xml = await generateXfwb(req.params.id, { companyOf: ourCompany });
        res.status(200).json({ success: true, xml });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/awb/:id/xfhl  → Generate XFHL XML (download)
router.get('/:id/xfhl', async (req, res) => {
    try {
        const xml = await generateXfhl(req.params.id);
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="AWB_${req.params.id}_XFHL.xml"`);
        res.send(xml);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/awb/:id/xfhl-preview  → Preview XFHL XML in JSON
router.get('/:id/xfhl-preview', async (req, res) => {
    try {
        const xml = await generateXfhl(req.params.id);
        res.status(200).json({ success: true, xml });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── SFTP Transmission to Descartes myVan ─────────────────────────────────────

// GET /api/awb/sftp-status  → Check SFTP config status
router.get('/sftp-status', async (req, res) => {
    try {
        const status = await getSftpConfigStatus();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/awb/fsu-poll  → Manually trigger FSU download from myVan
router.post('/fsu-poll', async (req, res) => {
    try {
        const { downloadAndProcessFsu } = require('../utils/FsuService');
        const result = await downloadAndProcessFsu();
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PATCH /api/awb/tracking/:id  → Manually update a tracking milestone
router.patch('/tracking/:id', async (req, res) => {
    try {
        const record = await AwbTracking.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Tracking record not found' });
        const allowed = ['fna','fma','foh','rcs','dep','arr','tfd','rcf','nfd','dlv','status','submittedToAirline'];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        await record.update(updates);
        res.json({ success: true, data: record });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/awb/:id/send-xfwb  → Generate + Upload XFWB to myVan
router.post('/:id/send-xfwb', async (req, res) => {
    try {
        const Airwaybill = require('../models/Airwaybill');
const AwbLog = require('../models/AwbLog');
        const awb = await Airwaybill.findByPk(req.params.id);
        if (!awb) return res.status(404).json({ error: 'AWB not found' });
        if (awb.status === 'VOID') return res.status(409).json({ success: false, error: `${awb.awbNumber} is VOID - it cannot be sent` });
        { const ready = ediReadyErrors(awb, 'AWB'); if (ready.length) return res.status(400).json({ success: false, error: 'Not ready for EDI: ' + ready.join('; '), errors: ready }); }

        const xml = await generateXfwb(req.params.id, { companyOf: ourCompany });
        const awbNo = awb.awbNumber || 'UNKNOWN'; // Keep dash: "020-12345678_XFWB.xml" per IATA naming
        const fileName = `${awbNo}_XFWB.xml`;

        const result = await uploadWithRetry(xml, fileName, 'xfwb');

        // Mark AWB as transmitted
        await awb.update({ status: 'TRANSMITTED' });
        // 29-Oct-2026: the dashboard never showed a sent FWB as submitted (only the XFHL route set the tracking row)
        try {
            const [tr] = await AwbTracking.findOrCreate({ where: { awbNumber: awb.awbNumber, hawbNumber: null },
                defaults: { awbNumber: awb.awbNumber, hawbNumber: null, documentType: awb.type === 'MAWB' ? 'MASTER' : 'AIR WAYBILL', saved: true, origin: awb.origin || '', destination: awb.destination || '', departureDate: awb.flightDate1 || '', status: 'PENDING' } });
            await tr.update({ submittedToAirline: true, saved: true, ...(tr.fna ? { fna: null } : {}) }); // a resent FWB clears the old rejection
        } catch (e) { console.warn('[Tracking] submit flag:', e.message); }
        try { await AwbLog.create({ awbNumber: awb.awbNumber, action: 'FWB_TRANSMITTED', user: req.body.user || 'System', details: 'FWB (XFWB) transmitted via SFTP' }); } catch(e){}

        res.json({
            success: true,
            message: result.message,
            fileName,
            awbNumber: awb.awbNumber,
            transmittedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[SFTP] send-xfwb error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/awb/:id/send-xfhl  → Generate + Upload XFHL to myVan
router.post('/:id/send-xfhl', async (req, res) => {
    try {
        const Airwaybill = require('../models/Airwaybill');
        const HouseAWB = require('../models/HouseAWB');
        const AwbLog = require('../models/AwbLog');
        let awb = await Airwaybill.findByPk(req.params.id);
        const awbModelType = awb ? 'MAWB' : 'HAWB';
        if (!awb) awb = await HouseAWB.findByPk(req.params.id);
        if (!awb) return res.status(404).json({ error: 'AWB not found' });
        if (awb.status === 'VOID') return res.status(409).json({ success: false, error: `${awb.awbNumber} is VOID - it cannot be sent` });
        { const ready = ediReadyErrors(awb, awbModelType === 'HAWB' ? 'HAWB' : 'MAWB'); if (ready.length) return res.status(400).json({ success: false, error: 'Not ready for EDI: ' + ready.join('; '), errors: ready }); }
        // 29-Oct-2026: the houses are the content of the FHL - check every live house too (before: a master without
        // houses sent "NO HOUSE WAYBILLS LINKED", and houses without consignee country / city went out)
        if (awbModelType === 'MAWB') {
            const houses = await liveHousesOf(awb, true);
            if (!houses.length) return res.status(400).json({ success: false, error: `No live HAWB is linked to ${awb.awbNumber}` });
            const bad = consolErrors(awb, houses);
            if (bad.length) return res.status(400).json({ success: false, error: 'Not ready for EDI: ' + bad.join('; '), errors: bad });
        }

        const xml = await generateXfhl(req.params.id);
        const awbNo = awb.awbNumber || 'UNKNOWN'; // Keep dash: "020-12345678_XFHL.xml" per IATA naming
        const fileName = `${awbNo}_XFHL.xml`;

        const result = await uploadWithRetry(xml, fileName, 'xfhl');

        // Mark AWB as transmitted
        await awb.update({ status: 'TRANSMITTED' });

        // Update tracking record
        try {
            await AwbTracking.update(
                { submittedToAirline: true, status: 'TRANSMITTED' },
                { where: { awbNumber: awb.awbNumber } }
            );
        } catch(e) { /* non-fatal */ }

        try { await AwbLog.create({ awbNumber: awb.awbNumber || 'UNKNOWN', action: 'FHL_TRANSMITTED', user: req.body?.user || 'SYSTEM', details: 'XFHL sent. File: ' + fileName + '. Type: ' + awbModelType }); } catch(e) {}

        res.json({
            success: true,
            message: result.message,
            fileName,
            awbNumber: awb.awbNumber,
            transmittedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[SFTP] send-xfhl error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// POST /api/awb/:id/send-xfzb  → Generate + Upload XFZB (CSD) to myVan
// Body: { securityStatus: "SPX"|"SCO"|"SHR", screeningMethod: "XRY"|"ETD"|"PHS"|"EDD"|"AOM", issuerName: "..." }
router.post('/:id/send-xfzb', async (req, res) => {
    try {
        const Airwaybill = require('../models/Airwaybill');
const AwbLog = require('../models/AwbLog');
        const awb = await Airwaybill.findByPk(req.params.id);
        if (!awb) return res.status(404).json({ error: 'AWB not found' });
        if (awb.status === 'VOID') return res.status(409).json({ success: false, error: `${awb.awbNumber} is VOID - it cannot be sent` });
        { const ready = ediReadyErrors(awb, 'AWB'); if (ready.length) return res.status(400).json({ success: false, error: 'Not ready for EDI: ' + ready.join('; '), errors: ready }); }

        const securityData = {
            securityStatus:  req.body.securityStatus  || 'SPX',
            screeningMethod: req.body.screeningMethod || 'XRY',
            issuerName:      req.body.issuerName      || awb.agentName || '',
            issuedAt:        new Date().toISOString()
        };

        void securityData; // XFZB is the house waybill (29-Oct-2026); security status goes in the OCI rows
        const houses = await liveHousesOf(awb, true);
        if (!houses.length) return res.status(400).json({ success: false, error: `No live HAWB is linked to ${awb.awbNumber}` });
        const bad = consolErrors(awb, houses);
        if (bad.length) return res.status(400).json({ success: false, error: 'Not ready for EDI: ' + bad.join('; '), errors: bad });
        // one XFZB per house (before: one file with every house, no consignee, house numbers cut to digits)
        const docs = await generateXfzb(req.params.id);
        const awbNo = (awb.awbNumber || 'UNKNOWN').replace(/\D/g, '');
        const files = [];
        for (const d of docs) {
            const fileName = `${awbNo}_${d.fileHawb}_XFZB.xml`;
            await uploadWithRetry(d.xml, fileName, 'xfzb');
            files.push(fileName);
            try { await AwbLog.create({ awbNumber: d.hawbNumber, action: 'FZB_TRANSMITTED', user: req.body.user || 'System', details: `FZB (XFZB) sent with master ${awb.awbNumber}` }); } catch (e) {}
        }
        try { await AwbLog.create({ awbNumber: awb.awbNumber, action: 'FZB_TRANSMITTED', user: req.body.user || 'System', details: `${files.length} house waybill(s) sent: ${docs.map(d => d.hawbNumber).join(', ')}` }); } catch (e) {}

        res.json({
            success: true,
            message: `${files.length} XFZB file(s) sent`,
            fileName: files.join(', '),
            files,
            awbNumber: awb.awbNumber,
            transmittedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[SFTP] send-xfzb error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/awb/:id/send-xffm  → Generate + Upload XFFM (Cargo Manifest) to myVan
router.post('/:id/send-xffm', async (req, res) => {
    try {
        const Airwaybill = require('../models/Airwaybill');
const AwbLog = require('../models/AwbLog');
        const awb = await Airwaybill.findByPk(req.params.id);
        if (!awb) return res.status(404).json({ error: 'AWB not found' });

        const xml = await generateXffm(req.params.id);
        const awbNo = (awb.awbNumber || 'UNKNOWN').replace('-', '');
        const fileName = `${awbNo}_XFFM.xml`;

        const result = await uploadWithRetry(xml, fileName, 'xffm');

        res.json({
            success: true,
            message: result.message,
            fileName,
            awbNumber: awb.awbNumber,
            transmittedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[SFTP] send-xffm error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// POST /api/awb/validate (DRY-RUN EDI VALIDATION)
router.post('/validate', iataSanitizer, (req, res) => {
    try {
        const { awbNumber, type, formData, rateLines, otherCharges } = req.body;
        
        // Extract fields exactly as we do for insertion
        const payload = {
            awbNumber: awbNumber || 'DRAFT',
            type: type === 'MAWB' ? 'XFWB' : (type === 'HAWB' ? 'XFHL' : type),
            origin: formData?.origin || formData?.dep || 'UNK',
            destination: formData?.destination || formData?.dest || 'UNK',
            totalPieces: parseInt(formData?.totalPieces, 10) || 1,
            grossWeight: parseFloat(formData?.grossWeight) || 0.1,
            shipperName: formData?.shipperName || 'UNKNOWN',
            consigneeName: formData?.consigneeName || 'UNKNOWN',
            shipperAddress: formData?.shipperAddress || 'UNKNOWN',
            consigneeAddress: formData?.consigneeAddress || 'UNKNOWN',
            shipperCity: formData?.shipperCity || 'UNKNOWN',
            consigneeCity: formData?.consigneeCity || 'UNKNOWN',
            currencyCode: formData?.currencyCode || 'USD',
            chargeCode: formData?.chargeCode || 'PP',
            totalVolume: parseFloat(formData?.totalVolume) || 0.0,
            shcList: formData?.shcList || [],
            dimLength: formData?.dimLength ? parseInt(formData.dimLength, 10) : undefined,
            dimWidth: formData?.dimWidth ? parseInt(formData.dimWidth, 10) : undefined,
            dimHeight: formData?.dimHeight ? parseInt(formData.dimHeight, 10) : undefined
        };

        // Strict Zod Validation (Dry Run - No DB interaction)
        const result = awbSchema.safeParse(payload);
        
        if (!result.success) {
            // Intercept Zod errors and format them for the UI modal
            const errs = (result.error.issues || result.error.errors || []).map(e => `${(e.path || []).join('.').toUpperCase()}: ${e.message}`); // 10-Nov-2026: zod 4 has .issues
            return res.status(400).json({ errors: errs });
        }

        res.status(200).json({ valid: true, message: "No errors found." });
    } catch (err) {
        res.status(500).json({ errors: [`SERVER ERROR: ${err.message}`] });
    }
});


// GET /api/awb/:id/preview-fwb
router.get('/:id/preview-fwb', async (req, res) => {
    try {
        const payload = await IataPayloadGenerator.generateFwb(req.params.id);
        res.status(200).json({ success: true, payload });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/awb/:id/preview-fhl
router.get('/:id/preview-fhl', async (req, res) => {
    try {
        const payload = await IataPayloadGenerator.generateFhl(req.params.id);
        res.status(200).json({ success: true, payload });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// GET HAWB by awbNumber for linking
// GET /api/awb/linked-hawbs/:masterAwbNumber
router.get('/linked-hawbs/:masterAwbNumber', async (req, res) => {
    try {
        const { masterAwbNumber } = req.params;
        if (!masterAwbNumber) return res.status(400).json({ error: "masterAwbNumber is required" });
        
        // live HAWBs of this MAWB, number with or without the dash (29-Oct-2026: VOID houses were listed too)
        const hawbs = await liveHousesOf({ awbNumber: masterAwbNumber }, false);
        res.json(hawbs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/awb/manifest/:masterAwbNumber - the consol (air cargo) manifest of a MAWB: the master's own details (airline,
// flight, consignee = the overseas agent, pieces / weight) and every live HAWB with its shipper, consignee, pieces, gross
// and chargeable weight, goods; totals against the master; our name / address from the company profile and the
// master's branch. 11-Nov-2026 - before, the manifest window read only the house list and left the master blank.
// who we are, for the AWB documents (manifest, SLI, DO ...): name from Settings > Company profile, address / GSTIN / phone
// from the AWB's branch (Settings > Branches). 11-Nov-2026: the company profile is still empty on the office PC, so the
// manifest showed no name - the iCAFFE invoice head is the fallback, as the GST invoice already does. Bank and
// e-invoice fields of the profile are never read here.
const HEAD_DEFAULT = { name: 'COMMITTED CARGO CARE LIMITED', address: 'A-406, Road No. 4, Street No. 8, Mahipalpur Extn., New Delhi - 110037, India', gstin: '07AAACC6689E1ZJ', phone: '011-46151111', email: 'contact@committedcargo.com', city: 'NEW DELHI' };
async function ourCompany(branchId) {
    const { QueryTypes } = require('sequelize');
    const { sequelize } = require('../db');
    const one = async (sql, p = []) => (await sequelize.query(sql, { replacements: p, type: QueryTypes.SELECT }).catch(() => []))[0] || null;
    const s = (v) => (v == null ? '' : String(v).trim());
    const cp = (await one('SELECT companyName, legalName, address1, address2, city, state, pincode, country, gstin, phone, email FROM CompanyProfile ORDER BY id LIMIT 1')) || {};
    const def = await one("SELECT id, branchCode, branchName, address, gstin, phone, email FROM CompanyBranches WHERE coalesce(status, 'Active') <> 'Inactive' ORDER BY isDefault DESC, id LIMIT 1");
    const br = (branchId ? await one('SELECT id, branchCode, branchName, address, gstin, phone, email FROM CompanyBranches WHERE id = ?', [branchId]) : null) || def || {};
    const isHead = !def || !br.id || br.id === def.id;
    const cpAddr = [cp.address1, cp.address2, cp.city, cp.state, cp.pincode, cp.country].map(s).filter(Boolean).join(', ');
    return {
        name: s(cp.companyName) || s(cp.legalName) || HEAD_DEFAULT.name,
        address: s(br.address) || (isHead ? cpAddr || HEAD_DEFAULT.address : ''),
        gstin: s(br.gstin) || (isHead ? s(cp.gstin) || HEAD_DEFAULT.gstin : ''),
        phone: s(br.phone) || (isHead ? s(cp.phone) || HEAD_DEFAULT.phone : ''),
        email: s(br.email) || (isHead ? s(cp.email) || HEAD_DEFAULT.email : ''),
        branch: s(br.branchName), city: s(cp.city) || (isHead ? HEAD_DEFAULT.city : s(br.branchName)),
    };
}

router.get('/manifest/:masterAwbNumber', async (req, res) => {
    try {
        const { Op, QueryTypes } = require('sequelize');
        const { sequelize } = require('../db');
        const bare = String(req.params.masterAwbNumber || '').replace(/\D/g, '').slice(0, 11);
        if (bare.length !== 11) return res.status(400).json({ error: 'Give the 11-digit MAWB number' });
        const dash = `${bare.slice(0, 3)}-${bare.slice(3)}`;
        const master = await Airwaybill.findOne({ where: { awbNumber: { [Op.in]: [bare, dash] }, status: { [Op.or]: [{ [Op.ne]: 'VOID' }, null] } }, include: [{ all: true }], order: [['id', 'DESC']] });
        const houses = await liveHousesOf({ awbNumber: master ? master.awbNumber : dash }, true);
        const str = (v) => (v == null ? '' : String(v).trim());
        const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
        const party = (o, k) => ({ name: str(o[k + 'Name']), address: str(o[k + 'Address']),
            place: [o[k + 'City'], o[k + 'State'], o[k + 'Zip'], o[k + 'Country']].map(str).filter(Boolean).join(', '), phone: str(o[k + 'Phone']) });
        const lines = (o) => (o && (o.AwbRateLines || o.awbRateLines)) || [];
        const chg = (o) => +lines(o).reduce((a, r) => a + num(r.chargeableWeight), 0).toFixed(2);
        const goodsOf = (o) => str(o.natureOfGoods) || str((lines(o).find(r => str(r.natureOfGoods)) || {}).natureOfGoods);
        const flightOf = (o) => [[o.flightNumber1, o.flightDate1], [o.flightNumber2, o.flightDate2]].filter(([f]) => str(f)).map(([f, d]) => ({ flight: str(f).toUpperCase(), date: str(d).slice(0, 10) }));
        const Airline = require('../models/Airline');
        const al = await Airline.findOne({ where: { prefix: bare.slice(0, 3) } }).catch(() => null);
        const rows = houses.map(h => {
            const gross = houseKg(h);
            return { id: h.id, hawb: str(h.awbNumber), origin: str(h.depAirport || h.origin), destination: str(h.destAirport || h.destination),
                shipper: party(h, 'shipper'), consignee: party(h, 'consignee'), pieces: parseInt(h.totalPieces, 10) || 0, gross, chargeable: chg(h) || gross,
                goods: goodsOf(h), chargeCode: str(h.chargeCode), handling: str(h.handlingInformation), volume: num(h.totalVolume) };
        });
        const tot = { houses: rows.length, pieces: rows.reduce((a, r) => a + r.pieces, 0), gross: +rows.reduce((a, r) => a + r.gross, 0).toFixed(2),
            chargeable: +rows.reduce((a, r) => a + r.chargeable, 0).toFixed(2), volume: +rows.reduce((a, r) => a + r.volume, 0).toFixed(3) };
        let m = null; const warnings = [];
        if (master) {
            m = { id: master.id, mawb: dash, date: str(master.executedDate).slice(0, 10), origin: str(master.depAirport || master.origin), destination: str(master.destAirport || master.destination),
                airline: al ? str(al.name) : '', airlineCode: al ? str(al.code2) : '', flights: flightOf(master), routing: [[master.to1, master.by1], [master.to2, master.by2], [master.to3, master.by3]].filter(([t]) => str(t)).map(([t, b]) => `${str(t)}${str(b) ? ' / ' + str(b) : ''}`),
                pieces: parseInt(master.totalPieces, 10) || 0, gross: num(master.grossWeight), chargeable: chg(master), shipper: party(master, 'shipper'), consignee: party(master, 'consignee'),
                goods: goodsOf(master), type: str(master.type) };
            if (m.type && m.type !== 'MAWB') warnings.push(`${dash} is a direct AWB (not a consol MAWB) - it has no house manifest.`);
            if (rows.length && m.pieces !== tot.pieces) warnings.push(`Pieces: houses ${tot.pieces}, MAWB ${m.pieces}.`);
            if (rows.length && Math.abs(m.gross - tot.gross) > 0.5) warnings.push(`Gross weight: houses ${tot.gross} kg, MAWB ${m.gross} kg.`);
        } else warnings.push(`MAWB ${dash} is not saved in EagleView - only its houses are shown.`);
        if (!rows.length) warnings.push('No live HAWB is linked to this MAWB.');
        // who we are: the company profile (name) and the master's branch (address), never the e-invoice / bank fields
        const company = { ...(await ourCompany(master && master.branchId)), iata: str((master && master.agentCode) || (houses[0] && houses[0].agentCode)) };
        res.json({ success: true, master: m, houses: rows, totals: tot, company, warnings, preparedBy: req.user ? (req.user.fullName || req.user.username || '') : '' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/awb/doc-data/:type/:id - one saved AWB / MAWB / HAWB in the shape the document windows need (SLI, DGD,
// labels, booking, CCA, DO, COO, lithium, live animals, temperature, security declaration). 11-Nov-2026: before, every
// window got only the AWB number and everything else was typed again. A HAWB brings its MAWB's airline / flights.
router.get('/doc-data/:type/:id', async (req, res) => {
    try {
        const { Op, QueryTypes } = require('sequelize');
        const { sequelize } = require('../db');
        const T = String(req.params.type || '').toUpperCase();
        const Model = T === 'HAWB' ? HouseAWB : Airwaybill;
        const rec = await Model.findByPk(req.params.id, { include: [{ all: true }] });
        if (!rec) return res.status(404).json({ error: 'AWB not found - save it first' });
        const a = rec.get({ plain: true });
        const str = (v) => (v == null ? '' : String(v).trim());
        const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
        let fd = a.formData; if (typeof fd === 'string') { try { fd = JSON.parse(fd); } catch (e) { fd = {}; } } fd = fd || {};
        const master = T === 'HAWB' ? await masterOf(a.masterAwbNumber) : null;
        const m = master ? master.get({ plain: true }) : null;
        const src = m || a; // airline / flights / routing: the master's for a house
        const party = (o, k) => ({ name: str(o[k + 'Name']), address: str(o[k + 'Address']), city: str(o[k + 'City']), state: str(o[k + 'State']), zip: str(o[k + 'Zip']), country: str(o[k + 'Country']), phone: str(o[k + 'Phone']), email: str(o[k + 'Email']) });
        const block = (p) => [p.name, p.address, [p.city, p.state, p.zip].filter(Boolean).join(' '), p.country, p.phone ? 'Ph: ' + p.phone : '', p.email].filter(Boolean).join('\n');
        const fdParty = (x) => (x && typeof x === 'object' ? { name: str(x.name), address: str(x.address), city: str(x.city), state: str(x.state), zip: str(x.zip || x.pinCode), country: str(x.country), phone: str(x.phone), email: str(x.email) } : null);
        const airportOf = async (code) => {
            const c = str(code).toUpperCase(); if (!c) return { code: '', name: '', country: '' };
            const r = (await sequelize.query('SELECT code, name, countryCode FROM Airports WHERE upper(code) = ? LIMIT 1', { replacements: [c], type: QueryTypes.SELECT }).catch(() => []))[0];
            return { code: c, name: r ? str(r.name) : '', country: r ? str(r.countryCode) : '' };
        };
        const awbDash = (no) => { const b = String(no || '').replace(/\D/g, ''); return b.length === 11 ? `${b.slice(0, 3)}-${b.slice(3)}` : str(no); };
        const mawbNo = T === 'HAWB' ? awbDash(a.masterAwbNumber) : awbDash(a.awbNumber);
        const Airline = require('../models/Airline');
        const al = await Airline.findOne({ where: { prefix: mawbNo.slice(0, 3) } }).catch(() => null);
        const lines = (a.AwbRateLines || []).map(r => ({ pieces: parseInt(r.pieces, 10) || 0, gross: num(r.grossWeight), unit: str(r.gwUnit) || 'K', rateClass: str(r.rateClass), chargeable: num(r.chargeableWeight), rate: num(r.rateCharge), total: num(r.total), goods: str(r.natureOfGoods), hs: str(r.harmonisedCode), volume: num(r.volume) }));
        const dims = (a.AwbDimensions || []).filter(d => num(d.length) && num(d.width) && num(d.height)).map(d => ({ pieces: parseInt(d.pieces, 10) || 0, l: num(d.length), w: num(d.width), h: num(d.height), unit: /in/i.test(str(d.cmIn)) ? 'IN' : 'CM' }));
        const other = (a.AwbOtherCharges || []).filter(c => str(c.chargeCode)).map(c => ({ code: str(c.chargeCode), amount: num(c.amount), due: /^c/i.test(str(c.entitlement)) ? 'C' : 'A', ppcc: str(c.ppcc) || 'P', description: str(c.description) }));
        const sumOther = (due, pc) => +other.filter(c => c.due === due && String(c.ppcc).toUpperCase().startsWith(pc)).reduce((x, c) => x + c.amount, 0).toFixed(2);
        const pieces = parseInt(a.totalPieces, 10) || lines.reduce((x, r) => x + r.pieces, 0);
        const gross = num(a.grossWeight) || lines.reduce((x, r) => x + r.gross, 0);
        const chargeable = +lines.reduce((x, r) => x + r.chargeable, 0).toFixed(2) || gross;
        const goods = str(a.natureOfGoods) || str((lines.find(r => r.goods) || {}).goods);
        const flights = [[src.flightNumber1, src.flightDate1], [src.flightNumber2, src.flightDate2], [src.flightNumber3, src.flightDate3]].filter(([f]) => str(f)).map(([f, d]) => ({ flight: str(f).toUpperCase(), date: str(d).slice(0, 10), time: str(d).slice(11, 16) }));
        let houses = [];
        if (T !== 'HAWB') houses = (await liveHousesOf({ awbNumber: a.awbNumber }, true)).map(h => ({ hawb: str(h.awbNumber), pieces: parseInt(h.totalPieces, 10) || 0, gross: houseKg(h), shipper: str(h.shipperName), consignee: str(h.consigneeName), origin: str(h.depAirport || h.origin), destination: str(h.destAirport || h.destination), goods: str(h.natureOfGoods) || str(((h.AwbRateLines || []).find(r => str(r.natureOfGoods)) || {}).natureOfGoods) }));
        const shipper = party(a, 'shipper'), consignee = party(a, 'consignee');
        const notify = fdParty(fd.notify1) || null;
        const company = await ourCompany(a.branchId || (m && m.branchId));
        res.json({ success: true, type: T, id: a.id, status: str(a.status),
            awbNo: mawbNo, mawbNo, hawbNo: T === 'HAWB' ? str(a.awbNumber) : '', date: str(a.executedDate).slice(0, 10),
            airline: { name: al ? str(al.name) : '', code: al ? str(al.code2) : '', prefix: mawbNo.slice(0, 3) },
            flights, routing: [[src.to1, src.by1], [src.to2, src.by2], [src.to3, src.by3]].filter(([t]) => str(t)).map(([t, b]) => ({ to: str(t).toUpperCase(), by: str(b).toUpperCase() })),
            origin: await airportOf(a.depAirport || a.origin), destination: await airportOf(a.destAirport || a.destination),
            shipper, consignee, notify, shipperBlock: block(shipper), consigneeBlock: block(consignee), notifyBlock: notify ? block(notify) : '',
            agent: { name: str(a.agentName || (m && m.agentName)), iata: str(a.agentCode || (m && m.agentCode)), account: str(a.agentAccountNo), place: str(a.agentPlace || a.agentCity) },
            pieces, gross, chargeable, volume: num(a.totalVolume) || +lines.reduce((x, r) => x + r.volume, 0).toFixed(3), lines, dims,
            dimsText: dims.map(d => `${d.pieces} x ${d.l} x ${d.w} x ${d.h} ${d.unit}`).join('\n'), goods,
            hsCodes: [...new Set(lines.map(r => r.hs).filter(Boolean))], shc: [...new Set((a.SpecialHandlingCodes || []).map(c => str(c.code).toUpperCase()).filter(Boolean))],
            handling: str(a.handlingInformation), ssr: str(a.ssr), osi: str(a.osi), sci: str(a.sci),
            currency: str(a.currencyCode) || 'INR', chargeCode: str(a.chargeCode), wtVal: str(a.wtVal), other: str(a.other),
            declared: { carriage: str(a.declaredValueCarriage) || 'NVD', customs: str(a.declaredValueCustoms) || 'NCV', insurance: str(a.amountOfInsurance) || 'XXX' },
            charges: { weightPP: num(a.weightChargePP), weightCC: num(a.weightChargeCC), valPP: num(a.valChargePP), valCC: num(a.valChargeCC), taxPP: num(a.taxPP), taxCC: num(a.taxCC),
                agentPP: sumOther('A', 'P'), agentCC: sumOther('A', 'C'), carrierPP: sumOther('C', 'P'), carrierCC: sumOther('C', 'C'), totalPP: num(a.totalChargePP), totalCC: num(a.totalChargeCC), other },
            executed: { date: str(a.executedDate).slice(0, 10), place: str(a.executedPlace) }, signatureShipper: str(a.signatureShipper), signatureCarrier: str(a.signatureCarrier),
            houses, company, user: req.user ? str(req.user.fullName || req.user.username) : '', today: new Date().toISOString().slice(0, 10) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/hawb', async (req, res) => {
    try {
        const { awbNumber } = req.query;
        if (!awbNumber) return res.status(400).json({ error: "awbNumber is required" });
        // 11-Nov-2026: the live house of that number first, newest first - findOne could return an old VOID one
        const all = await HouseAWB.findAll({ where: { awbNumber: String(awbNumber).trim().toUpperCase() }, order: [['id', 'DESC']] });
        const hawb = all.find(h => String(h.status || '').toUpperCase() !== 'VOID') || all[0];
        if (hawb) {
            res.json(hawb);
        } else {
            res.status(404).json({ error: "HAWB not found" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/awb/hawb/:id/link  → Link or unlink HAWB to a Master AWB
router.patch('/hawb/:id/link', async (req, res) => {
    try {
        const { id } = req.params;
        const { masterAwbNumber, masterAwbId } = req.body;

        const hawb = await HouseAWB.findByPk(id);
        if (!hawb) return res.status(404).json({ error: 'HAWB not found' });
        if (hawb.status === 'VOID') return res.status(409).json({ error: `HAWB ${hawb.awbNumber} is VOID` });
        if (masterAwbNumber) {
            const { awbNoError } = require('../utils/awbSave');
            const e = awbNoError(masterAwbNumber, 'MAWB'); if (e) return res.status(400).json({ error: e });
            if (!(await numberTaken(Airwaybill, masterAwbNumber, 'MAWB'))) return res.status(404).json({ error: `MAWB ${masterAwbNumber} is not saved (or is VOID)` });
        }

        const oldMaster = hawb.masterAwbNumber;
        const bareNo = (v) => String(v || '').replace(/\D/g, '');
        const moving = bareNo(oldMaster) !== bareNo(masterAwbNumber);
        if (!moving && (masterAwbId == null || String(hawb.masterAwbId || '') === String(masterAwbId))) return res.json({ success: true, message: 'Already on this master', unchanged: true, hawb }); // nothing to do (the MAWB save sends every house)
        // 11-Nov-2026: a house put on / taken off a sent master - before departure the master becomes AMENDED (its XFHL
        // must be sent again); after departure it is refused (unlink had this rule, link had none)
        const user = req.user?.username || 'System';
        const newM = masterAwbNumber ? await masterOf(masterAwbNumber) : null;
        const oldM = moving && oldMaster ? await masterOf(oldMaster) : null;
        for (const m of [newM, oldM]) if (m && isSent(m)) { const flown = await flownInfo(m.awbNumber); if (flown) return res.status(409).json({ flown: true, error: `MAWB ${m.awbNumber} has ${flown} - its houses cannot be changed now.` }); }
        await hawb.update({
            masterAwbNumber: masterAwbNumber || null,
            masterAwbId:     masterAwbId     || null
        });

        if (oldMaster && masterAwbNumber && oldMaster !== masterAwbNumber) await AwbTracking.update({ awbNumber: masterAwbNumber }, { where: { awbNumber: oldMaster, hawbNumber: hawb.awbNumber } }).catch(() => {});
        if (oldMaster) await recalculateMawbTotals(oldMaster);
        if (masterAwbNumber) await recalculateMawbTotals(masterAwbNumber);
        if (newM && moving) await markMasterAmended(newM, `HAWB ${hawb.awbNumber} put on the master`, user);
        if (oldM) await markMasterAmended(oldM, `HAWB ${hawb.awbNumber} moved to ${masterAwbNumber || 'no master'}`, user);
        if (moving) await AwbLog.create({ awbNumber: hawb.awbNumber, action: 'HAWB_LINKED', user, details: `${oldMaster || '-'} -> ${masterAwbNumber || '-'}` }).catch(() => {});

        res.json({ success: true, message: masterAwbNumber ? `Linked to ${masterAwbNumber}` : 'Unlinked', hawb });
    } catch (err) {
        console.error('HAWB link error:', err);
        res.status(500).json({ error: err.message });
    }
});



// ----------------- AUTO-CALCULATION LOGIC -----------------
// 10-Nov-2026: AWB number vs the AWB / HAWB stock (Stock Master)
// 11-Nov-2026: the airline of the AWB number (its 3-digit prefix) and the first carrier / first flight on the AWB should
// match - e.g. a 157 (Qatar Airways, QR) AWB with first carrier VS is usually a wrong prefix or carrier. It can be right
// (interline, the first leg on another airline), so it is a warning: saved after the operator says so (_carrierOk).
async function carrierWarning(type, awbNumber, fd) {
    if (type === 'HAWB') return '';
    const pure = String(awbNumber || '').replace(/\D/g, '');
    if (pure.length < 3) return '';
    const Airline = require('../models/Airline');
    const al = await Airline.findOne({ where: { prefix: pure.slice(0, 3) } }).catch(() => null);
    const code = String((al && al.code2) || '').trim().toUpperCase();
    if (!code) return '';
    const by1 = String((fd && fd.by1) || '').trim().toUpperCase();
    const fl = String((fd && (fd.flightNumber1 || fd.flight1)) || '').replace(/\s+/g, '').toUpperCase();
    const out = [];
    if (by1 && by1 !== code) out.push(`first carrier (By 1) is ${by1}`);
    if (fl && /^[A-Z0-9]{2}\d/.test(fl) && fl.slice(0, 2) !== code && fl.slice(0, 2) !== by1) out.push(`first flight is ${fl}`);
    else if (fl && /^[A-Z0-9]{2}\d/.test(fl) && fl.slice(0, 2) !== code && !by1) out.push(`first flight is ${fl}`);
    return out.length ? `AWB ${pure.slice(0, 3)} is an AWB of ${al.name} (${code}), but the ${out.join(' and the ')} - check the AWB prefix or the carrier.` : '';
}
async function stockWarning(type, awbNumber) {
    const pure = String(awbNumber || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!pure) return '';
    if (type === 'HAWB') {
        const HawbStock = require('../models/HawbStock');
        const h = await HawbStock.findOne({ where: { fullHawbNumber: pure } }).catch(() => null);
        return h && ['USED', 'VOID'].includes(String(h.status || '').toUpperCase()) ? `HAWB ${awbNumber} is marked ${h.status} in the HAWB stock.` : '';
    }
    const AwbStock = require('../models/AwbStock');
    const st = await AwbStock.findOne({ where: { fullAwbNumber: pure } });
    if (st && ['USED', 'VOID'].includes(String(st.status || '').toUpperCase())) return `AWB ${awbNumber} is marked ${st.status} in the AWB stock (Stock Master) - it may already be used.`;
    if (st) return '';
    const n = await AwbStock.count({ where: { airlinePrefix: pure.slice(0, 3) } });
    return n ? `AWB ${awbNumber} is not in the AWB stock of airline ${pure.slice(0, 3)} (Stock Master) - check the number given by the airline.`
             : `No AWB stock is entered for airline ${pure.slice(0, 3)} (Stock Master), so this number cannot be checked.`;
}
// a voided AWB / HAWB number goes back to AVAILABLE in its stock when no live record uses it any more
async function releaseStock(type, awbNumber, Model) {
    try {
        const pure = String(awbNumber || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (!pure || await numberTaken(Model, awbNumber, type)) return;
        if (type === 'HAWB') await require('../models/HawbStock').update({ status: 'AVAILABLE' }, { where: { fullHawbNumber: pure, status: 'USED' } });
        else await require('../models/AwbStock').update({ status: 'AVAILABLE' }, { where: { fullAwbNumber: pure, status: 'USED' } });
    } catch (e) { console.warn('[AWB void] stock:', e.message); }
}

async function recalculateMawbTotals(masterAwbNumber) {
    if (!masterAwbNumber) return;
    try {
        const Airwaybill = require('../models/Airwaybill');
const AwbLog = require('../models/AwbLog');
        const HouseAWB = require('../models/HouseAWB');
        
        // 29-Oct-2026: only live records - a voided house was still counted, and a voided master with the same number could be picked
        const { Op } = require('sequelize');
        const live = { [Op.or]: [{ [Op.ne]: 'VOID' }, null] };
        const mb = String(masterAwbNumber).replace(/\D/g, ''); const md = mb.length === 11 ? `${mb.slice(0, 3)}-${mb.slice(3)}` : masterAwbNumber;
        const mawb = await Airwaybill.findOne({ where: { awbNumber: [...new Set([masterAwbNumber, md, mb])], status: live }, order: [['id', 'DESC']] });
        if (!mawb) return;
        
        // live houses with the number written with or without the dash (a house saved as 17612345675 was left out)
        const hawbs = await liveHousesOf(mawb, true);
        // 29-Oct-2026: the master keeps ITS OWN pieces / weight when its rate lines have them (that is what goes to
        // the airline in the FWB); before, every house save overwrote them with the house sum, so the FWB header no
        // longer matched its rate lines. The house sum is used only for a master without weights; a difference is
        // shown by VALIDATE EDI and stops the FHL / FZB.
        if (hawbs.length) {
            const own = await AwbRateLine.findAll({ where: { awbId: mawb.id, awbType: ['AWB', 'MAWB'] } });
            const ownPcs = own.reduce((s, r) => s + (parseInt(r.pieces, 10) || 0), 0);
            const ownWt = own.reduce((s, r) => s + (parseFloat(r.grossWeight) || 0), 0);
            if (ownPcs > 0 && ownWt > 0) {
                if (Number(mawb.totalPieces) !== ownPcs || Math.abs((parseFloat(mawb.grossWeight) || 0) - ownWt) > 0.0005) await mawb.update({ totalPieces: ownPcs, grossWeight: +ownWt.toFixed(3) });
                return;
            }
        }
        if (hawbs.length === 0) {
            // last house unlinked / voided: the master goes back to its own rate lines (before, the old house totals stayed)
            const lines = await AwbRateLine.findAll({ where: { awbId: mawb.id, awbType: ['AWB', 'MAWB'] } });
            const pcs = lines.reduce((s, r) => s + (parseInt(r.pieces, 10) || 0), 0);
            const wt = lines.reduce((s, r) => s + (parseFloat(r.grossWeight) || 0), 0);
            if (pcs || wt) await mawb.update({ totalPieces: pcs || mawb.totalPieces, grossWeight: +(wt || mawb.grossWeight).toFixed(3) });
            return;
        }
        
        let totalPieces = 0;
        let totalGrossWeight = 0;
        let totalVolume = 0;
        
        for (const h of hawbs) {
            totalPieces += (parseInt(h.totalPieces, 10) || 0);
            totalGrossWeight += houseKg(h); // houses in pounds converted to kg
            totalVolume += (parseFloat(h.totalVolume) || 0);
        }
        
        await mawb.update({
            totalPieces: totalPieces,
            grossWeight: +totalGrossWeight.toFixed(3),
            totalVolume: +totalVolume.toFixed(4)
        });
        console.log(`[Auto-Calc] MAWB ${masterAwbNumber} updated: ${totalPieces} PCS, ${totalGrossWeight} KG, ${totalVolume} CBM`);
    } catch (e) {
        console.error('[Auto-Calc Error]', e.message);
    }
}

// ----------------- PDF GENERATION -----------------
const { chromium } = require('playwright');
let sharedBrowser = null;

// 11-Nov-2026: Playwright's own Chromium is only there after "npx playwright install" for this Playwright version
// (on the office PC it was missing - another project's install had left other versions), so the PDF failed. Now:
// Playwright's Chromium, else Microsoft Edge (always on Windows), else Google Chrome.
async function getBrowser() {
    if (sharedBrowser && sharedBrowser.isConnected()) return sharedBrowser;
    sharedBrowser = null;
    const tries = [{ headless: true }, { headless: true, channel: 'msedge' }, { headless: true, channel: 'chrome' }];
    let last = null;
    for (const opt of tries) {
        try { sharedBrowser = await chromium.launch(opt); return sharedBrowser; } catch (e) { last = e; }
    }
    throw last;
}

router.post('/generate-pdf', async (req, res) => {
    // 11-Nov-2026: only the AWB print page made by the AWB screens is turned into a PDF. Before, any HTML sent here was
    // opened in the server's browser - it could read other pages on the office network or local files into a PDF.
    // Now: an AWB page only (size limit, its own markers), no scripts, and nothing loaded from anywhere except the
    // Google fonts the page uses.
    let context = null;
    try {
        const { html, filename } = req.body || {};
        if (!html || typeof html !== 'string') return res.status(400).json({ error: "No HTML provided" });
        if (html.length > 3 * 1024 * 1024) return res.status(413).json({ error: 'The AWB page is too big for a PDF' });
        if (!/AIR WAYBILL/i.test(html) || !/class="awb-outer"/.test(html)) return res.status(400).json({ error: 'Only an Air Waybill print page can be made into a PDF here' });
        const safeName = String(filename || 'Airway_Bill.pdf').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'Airway_Bill.pdf';
        const clean = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<(iframe|object|embed|frame|frameset|base|meta\s+http-equiv)\b[^>]*>/gi, '');

        const browser = await getBrowser();
        context = await browser.newContext({ javaScriptEnabled: false });
        await context.route('**/*', (route) => {
            const u = route.request().url();
            if (/^(data:|about:)/i.test(u) || /^https:\/\/fonts\.(googleapis|gstatic)\.com\//i.test(u)) return route.continue();
            return route.abort();
        });
        const page = await context.newPage();
        await page.emulateMedia({ media: 'print' });
        await page.setContent(clean, { waitUntil: 'load', timeout: 30000 }).catch(() => {}); // fonts that do not load: the page is still printed
        
        const pdfBuffer = await page.pdf({ 
            format: 'A4', 
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' }
        });
        
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${safeName}"`,
            'Content-Length': pdfBuffer.length
        });
        
        res.send(pdfBuffer);
    } catch (err) {
        console.error("PDF Gen Error:", err);
        const noBrowser = /Executable doesn't exist|playwright install|Chromium distribution|is not found at/i.test(String(err && err.message));
        res.status(500).json({ noBrowser, error: noBrowser ? 'No browser on the server to make the PDF (Playwright Chromium / Edge / Chrome)' : 'PDF generation failed' });
        sharedBrowser = null; // Reset browser on error
    } finally {
        if (context) await context.close().catch(() => {});
    }
});
// --------------------------------------------------

// GET /api/awb/search/:awbNumber
// GET /api/awb/list  → Dashboard: all AWBs + HAWBs merged with tracking milestones
// Every AWB / MAWB / HAWB record with its tracking row and stage (used by /list and /tracking, 29-Oct-2026).
// Tracking is matched on (master number, house number) without dashes, so a house never takes the master's row.
async function loadAwbRows(where) {
    const { Op } = require('sequelize');
        const mawbs = await Airwaybill.findAll({ where, attributes: ['id', 'awbNumber', 'type', 'shipperName', 'consigneeName', 'origin', 'destination', 'status', 'totalPieces', 'grossWeight', 'flightNumber1', 'flightDate1', 'createdAt'] });
        const hawbs = await HouseAWB.findAll({ where, attributes: ['id', 'awbNumber', 'masterAwbNumber', 'type', 'shipperName', 'consigneeName', 'origin', 'destination', 'status', 'totalPieces', 'grossWeight', 'flightNumber1', 'flightDate1', 'createdAt'] });

        const bare = (n) => String(n || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const key = (awb, hawb) => bare(awb) + '|' + bare(hawb);
        const nos = [...new Set([...mawbs.map((m) => m.awbNumber), ...hawbs.map((h) => h.masterAwbNumber)].filter(Boolean))];
        const variants = [...new Set(nos.flatMap((n) => { const b = bare(n); return [n, b, b.length === 11 ? `${b.slice(0, 3)}-${b.slice(3)}` : n]; }))];
        const trackingRows = variants.length ? await AwbTracking.findAll({ where: { awbNumber: { [Op.in]: variants } } }) : [];
        const trackMap = {};
        trackingRows.forEach((t) => { trackMap[key(t.awbNumber, t.hawbNumber)] = t; });

        const { stageOf } = require('../utils/awbStage');
        const formatRow = (rec, isHawb) => {
            const tr = (isHawb ? require('../utils/awbStage').houseTrack(trackMap[key(rec.masterAwbNumber, rec.awbNumber)], trackMap[key(rec.masterAwbNumber, '')]) : trackMap[key(rec.awbNumber, '')]) || {};
            const stage = stageOf(rec, tr);
            return {
                id: rec.id,
                type: isHawb ? 'HAWB' : (rec.type || 'MAWB'),
                awbNumber: isHawb ? (rec.masterAwbNumber || '') : (rec.awbNumber || ''),
                hawbNumber: isHawb ? (rec.awbNumber || '') : '',
                shipperName: rec.shipperName || '', consigneeName: rec.consigneeName || '',
                origin: rec.origin || '', destination: rec.destination || '',
                status: rec.status || 'ACTIVE',
                totalPieces: rec.totalPieces || 0, grossWeight: rec.grossWeight || 0,
                flight: rec.flightNumber1 || '', flightDate: rec.flightDate1 || '',
                createdAt: rec.createdAt,
                saved: true,
                submittedToAirline: stage !== 'SAVED' && stage !== 'VOID',
                fna: tr.fna || null, fma: tr.fma || null, foh: tr.foh || null,
                rcs: tr.rcs || null, dep: tr.dep || null, arr: tr.arr || null,
                tfd: tr.tfd || null, rcf: tr.rcf || null, nfd: tr.nfd || null,
                dlv: tr.dlv || null,
                trackingStatus: tr.status || 'PENDING',
                stage,
            };
        };

    const masterFlight = {};
    mawbs.forEach((m) => { masterFlight[bare(m.awbNumber)] = m; });
    const rows = [...mawbs.map((m) => formatRow(m, false)), ...hawbs.map((h) => {
        const r = formatRow(h, true);
        // a house without its own flight shows the master's flight
        const m = masterFlight[bare(h.masterAwbNumber)];
        if (!r.flight && m) { r.flight = m.flightNumber1 || ''; r.flightDate = m.flightDate1 || ''; }
        return r;
    })].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id);
    return { rows, mawbs, hawbs };
}

router.get('/list', async (req, res) => {
    // Rewritten 29-Oct-2026 (Air Export dashboard check). Before:
    // - the KPI cards were wrong: "saved not submitted" = every record (submitted and VOID too), "rejected" = records
    //   not yet departed, "ready for carriage" = delivered;
    // - VOID records were listed; the two tables were each cut to 100 and then glued (not sorted together);
    // - tracking was matched on the number only, so a house could take the master's row (and the reverse).
    // Now every live record gets a stage from its tracking row, KPIs count all live records, the page is cut after sorting.
    try {
        const { Op } = require('sequelize');
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 1000);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
        const statusFilter = req.query.status ? String(req.query.status).toUpperCase() : null; // e.g. 'VOID'
        const stageFilter = req.query.stage ? String(req.query.stage).toUpperCase() : null;
        const live = { [Op.or]: [{ [Op.ne]: 'VOID' }, null] };
        const where = statusFilter ? { status: statusFilter } : (req.query.includeVoid ? {} : { status: live });

        // 10-Nov-2026: only the branch picked in the top bar (AWBs without a branch = default branch)
        const AB = require('../utils/awbBranch');
        const { rows, mawbs } = await loadAwbRows({ [Op.and]: [where, await AB.where(req), await AB.fyWhere(req)] }); // + year picked in the top bar
        const bare = (n) => String(n || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        let all = rows;
        const count = (st) => all.filter((d) => d.stage === st).length;
        const kpi = {
            total: all.length,
            savedNotSubmitted: count('SAVED'),
            submittedPendingRcs: count('SUBMITTED'),
            rejected: count('REJECTED'),
            readyForCarriage: count('READY_FOR_CARRIAGE'),
            departed: count('DEPARTED'),
            delivered: count('DELIVERED'),
        };
        kpi.submitted = all.filter((d) => d.submittedToAirline).length; // old keys kept for other screens
        kpi.pending = all.filter((d) => !d.dep && !d.dlv).length;

        // airline-wise count of this month's airline AWBs (direct AWB + MAWB, not houses)
        const now = new Date(); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const airlines = {};
        mawbs.filter((m) => m.status !== 'VOID' && new Date(m.createdAt) >= monthStart).forEach((m) => {
            const p = bare(m.awbNumber).slice(0, 3); if (p) airlines[p] = (airlines[p] || 0) + 1;
        });

        if (stageFilter) all = all.filter((d) => d.stage === stageFilter);
        res.json({
            success: true,
            data: all.slice(offset, offset + limit),
            total: all.length,
            kpi,
            airlinesThisMonth: Object.entries(airlines).map(([prefix, count]) => ({ prefix, count })).sort((a, b) => b.count - a.count),
        });
    } catch (err) {
        console.error('AWB list error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/awb/insights - Air Export dashboard alerts and numbers (utils/awbInsights.js, 29-Oct-2026)
router.get('/insights', async (req, res) => {
    try {
        const { buildInsights } = require('../utils/awbInsights');
        const data = await buildInsights({ Airwaybill, HouseAWB, AwbTracking, AwbRateLine, AwbLog: require('../models/AwbLog'), AwbStock: require('../models/AwbStock') }, { scope: await require('../utils/awbBranch').where(req) }); // 10-Nov-2026: branch
        res.json({ success: true, ...data });
    } catch (err) {
        console.error('AWB insights error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/search/:awbNumber', async (req, res) => {
    try {
        // a voided number can be used again: open the live record, not the void one (29-Oct-2026)
        const { Op } = require('sequelize');
        const raw = String(req.params.awbNumber || '').trim();
        const bare = raw.replace(/[^A-Za-z0-9]/g, '');
        const nos = [...new Set([raw, bare, /^\d{11}$/.test(bare) ? `${bare.slice(0, 3)}-${bare.slice(3)}` : raw])];
        req.params.awbNumber = { [Op.in]: nos };
        const live = { awbNumber: req.params.awbNumber, status: { [Op.or]: [{ [Op.ne]: 'VOID' }, null] } };
        let awb = await Airwaybill.findOne({ where: live, include: [{ all: true }], order: [['id', 'DESC']] });
        if (!awb) awb = await HouseAWB.findOne({ where: live, include: [{ all: true }], order: [['id', 'DESC']] });
        if (!awb) awb = await Airwaybill.findOne({ where: { awbNumber: req.params.awbNumber }, include: [{ all: true }], order: [['id', 'DESC']] })
            || await HouseAWB.findOne({ where: { awbNumber: req.params.awbNumber }, include: [{ all: true }], order: [['id', 'DESC']] });
        
        if (!awb) {
            return res.status(404).json({ error: 'AWB not found' });
        }
        // extra documents of this record (DG declaration, SLI ...) as { DGD: {...}, SLI: {...} }
        const out = awb.toJSON();
        const kind = awb.constructor === HouseAWB ? 'HAWB' : 'AWB';
        out.extraDocs = {};
        for (const x of await AwbExtraDoc.findAll({ where: { awbId: awb.id, awbType: typesOf(kind) } })) { try { out.extraDocs[x.docType] = JSON.parse(x.data); } catch (e) { /* bad row */ } }
        res.json(out);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/awb/update/:id
// ---- 11-Nov-2026: an AWB already sent to the airline (XFWB / XFHL -> status TRANSMITTED) ------------------------------
// Before: the screens refused to even open it (no reprint, no correction) while the server let anything change or void
// it. Now: it opens; a change is saved only as an AMENDMENT with a reason (status AMENDED = send XFWB / XFHL again, the
// airline keeps the last one it got); a HAWB change / new HAWB / void / unlink on a sent master makes the master
// AMENDED (FHL to be sent again); once the shipment has departed (tracking DEP / ARR / DLV) nothing is changed or
// voided here - the correction goes to the airline as a CCA.
const SENT_STATUS = ['TRANSMITTED', 'AMENDED'];
const isSent = (rec) => !!rec && SENT_STATUS.includes(String(rec.status || '').toUpperCase());
const noVariants = (no) => { const b = String(no || '').replace(/\D/g, ''); return [...new Set([String(no || ''), b, b.length === 11 ? `${b.slice(0, 3)}-${b.slice(3)}` : ''].filter(Boolean))]; };
async function masterOf(no) {
    if (!no) return null;
    const { Op } = require('sequelize');
    return Airwaybill.findOne({ where: { awbNumber: { [Op.in]: noVariants(no) }, status: { [Op.or]: [{ [Op.ne]: 'VOID' }, null] } }, order: [['id', 'DESC']] });
}
// "departed 12-11-2026" when the airline / we have recorded the flight leaving (or later), else ''
async function flownInfo(mawbNo) {
    if (!mawbNo) return '';
    const { Op } = require('sequelize');
    const tr = await AwbTracking.findOne({ where: { awbNumber: { [Op.in]: noVariants(mawbNo) }, hawbNumber: null } }).catch(() => null);
    if (tr) {
        const st = String(tr.status || '').toUpperCase();
        if (tr.dep || tr.arr || tr.dlv || ['DEPARTED', 'ARRIVED', 'DELIVERED', 'FINISHED'].includes(st)) return `departed${tr.dep ? ' (' + String(tr.dep).slice(0, 16).replace('T', ' ') + ')' : ''}`;
    }
    const AwbTrackingEvent = require('../models/AwbTrackingEvent');
    const ev = await AwbTrackingEvent.findOne({ where: { awbNumber: { [Op.in]: noVariants(mawbNo) }, code: { [Op.in]: ['DEP', 'ARR', 'RCF', 'NFD', 'DLV'] } }, order: [['eventAt', 'ASC']] }).catch(() => null);
    return ev ? `departed (${ev.code} ${String(ev.eventAt || '').slice(0, 16).replace('T', ' ')})` : '';
}
const reasonOf = (req, k) => String((req.body && req.body[k]) || '').trim().slice(0, 300);
async function markMasterAmended(master, why, user) {
    if (!master || String(master.status || '').toUpperCase() !== 'TRANSMITTED') return false;
    await master.update({ status: 'AMENDED', modifiedBy: user });
    await AwbLog.create({ awbNumber: master.awbNumber, action: 'FHL_RESEND_NEEDED', user, details: why.slice(0, 250) }).catch(() => {});
    return true;
}

router.put('/update/:id', async (req, res) => {
    try {
        const { type, formData, rateLines, otherCharges, sphCodes, ociRows, dimRows, ssr, osi, sci, branchId, financialYearId } = req.body;
        
        let Model = type === 'HAWB' ? HouseAWB : Airwaybill;
        const awb = await Model.findByPk(req.params.id);
        if (!awb) return res.status(404).json({ error: 'AWB not found' });
        if (awb.status === 'VOID') return res.status(409).json({ error: `${awb.awbNumber} is VOID and cannot be changed` });
        // 11-Nov-2026: sent to the airline -> amendment with a reason; departed -> not here (CCA)
        const userName = req.user?.username || 'System';
        const sentMaster = type === 'HAWB' ? await masterOf(req.body.masterAwbNumber || awb.masterAwbNumber) : null;
        const sentSelf = isSent(awb), viaMaster = !!sentMaster && isSent(sentMaster);
        let amendReason = '';
        if (sentSelf || viaMaster) {
            const mNo = type === 'HAWB' ? sentMaster.awbNumber : awb.awbNumber;
            const flown = await flownInfo(mNo);
            if (flown) return res.status(409).json({ flown: true, error: `${type === 'HAWB' ? 'MAWB ' + mNo : awb.awbNumber} has ${flown} - it cannot be changed here any more. Send the correction to the airline as a CCA (DOCS > CCA).` });
            amendReason = reasonOf(req, '_amendReason');
            if (!amendReason) return res.status(409).json({ needReason: true, reasonFlag: '_amendReason',
                error: sentSelf ? `${awb.awbNumber} has already been sent to the airline. The change will be saved as an amendment and XFWB${type !== 'HAWB' ? ' / XFHL' : ''} must be sent again.`
                    : `The XFWB / XFHL of MAWB ${mNo} has already been sent. This HAWB change will be saved as an amendment and the XFHL of the MAWB must be sent again.` });
        }
        const errs = validateAwb(req.body, type, false, awb);
        if (errs.length) return res.status(400).json({ error: errs.join('\n'), errors: errs });
        if (!(req.body._carrierOk === true || req.body._carrierOk === 'true')) {
            const w = await carrierWarning(type, req.body.awbNumber && req.body.awbNumber !== 'DRAFT' ? req.body.awbNumber : awb.awbNumber, formData);
            if (w) return res.status(409).json({ okFlag: '_carrierOk', error: w });
        }
        if (type === 'HAWB' && req.body.masterAwbNumber) req.body.masterAwbNumber = normAwbNo(req.body.masterAwbNumber, 'MAWB');
        const masterAwbNumber = req.body.masterAwbNumber;
        const oldMasterAwbNumber = awb.masterAwbNumber; // fix 28-Oct-2026: used below but was never defined
        // number from the form, else the saved value (parseFloat gives NaN, which ?? does not catch)
        const num = (v, fallback) => { const n = parseFloat(v); return Number.isFinite(n) ? n : (fallback ?? 0); };

        // AWB / HAWB number changed on the screen (29-Oct-2026: before, the update ignored it)
        let newNumber = null;
        if (req.body.awbNumber && req.body.awbNumber !== 'DRAFT') {
            const want = normAwbNo(req.body.awbNumber, type);
            if (want !== awb.awbNumber) {
                if (type !== 'HAWB') {
                    const bare = want.replace(/\D/g, '');
                    if (!/^\d{11}$/.test(bare)) return res.status(400).json({ error: 'AWB number must be 11 digits (3 + 8)' });
                    if (Number(bare.slice(3, 10)) % 7 !== Number(bare[10])) return res.status(400).json({ error: `AWB check digit is wrong: for ${bare.slice(3, 10)} it must be ${Number(bare.slice(3, 10)) % 7}` });
                }
                const clash = await numberTaken(Model, want, type, awb.id);
                if (clash) return res.status(409).json({ error: `${type === 'HAWB' ? 'HAWB' : 'AWB'} ${want} already exists (id ${clash.id})` });
                newNumber = want;
            }
        }
        // Update Main Table — all fields (shared mapping: a key sent by the screen is saved as sent, even empty)
        const { sequelize } = require('../db');
        const t = await sequelize.transaction();
        try {
          if (newNumber) {
              const oldNo = awb.awbNumber;
              await awb.update({ awbNumber: newNumber }, { transaction: t });
              // houses linked to this master follow the new master number
              if (type !== 'HAWB') await HouseAWB.update({ masterAwbNumber: newNumber }, { where: { masterAwbNumber: oldNo }, transaction: t });
              // tracking rows follow the number (master: its row and its houses' rows; house: its own row)
              if (type !== 'HAWB') await AwbTracking.update({ awbNumber: newNumber }, { where: { awbNumber: oldNo }, transaction: t });
              else await AwbTracking.update({ hawbNumber: newNumber }, { where: { hawbNumber: oldNo }, transaction: t });
              await AwbLog.create({ awbNumber: newNumber, action: 'AWB_NUMBER_CHANGED', user: req.user?.username || 'System', details: `Number changed from ${oldNo} to ${newNumber}` }, { transaction: t }).catch(() => {});
          }
          const mf = mainFields(req.body, awb.get({ plain: true }));
          const fyD = await require('../utils/awbBranch').fyFor(mf.executedDate || awb.executedDate); // 10-Nov-2026: year of the AWB date
          await awb.update({
              ...mf,
              branchId: branchId || awb.branchId || (await require('../utils/awbBranch').scope(req)).saveId, // 10-Nov-2026
              financialYearId: fyD || financialYearId || awb.financialYearId,
              masterAwbNumber: masterAwbNumber !== undefined ? masterAwbNumber : awb.masterAwbNumber,
              modifiedBy: req.user?.username || 'System',
          }, { transaction: t });
          await writeChildren(CHILD_MODELS, awb.id, type, req.body, t, true, awb.type);
          if (req.body.docTempId) {
              await AWBDocument.update({ awbId: awb.id, awbType: type }, { where: { tempId: String(req.body.docTempId), awbId: null }, transaction: t });
          }

          await t.commit();
        } catch (txErr) {
          await t.rollback();
          throw txErr;
        }

        // Master totals are recomputed only after the house is saved (fix 28-Oct-2026)
        if (type === 'HAWB' && masterAwbNumber && oldMasterAwbNumber && oldMasterAwbNumber !== masterAwbNumber) {
            await AwbTracking.update({ awbNumber: masterAwbNumber }, { where: { awbNumber: oldMasterAwbNumber, hawbNumber: awb.awbNumber } }).catch(() => {});
        }
        if (type === 'HAWB') {
            if (oldMasterAwbNumber && oldMasterAwbNumber !== masterAwbNumber) {
                await recalculateMawbTotals(oldMasterAwbNumber);
            }
            if (masterAwbNumber) {
                await recalculateMawbTotals(masterAwbNumber);
            }
        }

        let resend = '';
        if (amendReason) {
            if (sentSelf) {
                await awb.update({ status: 'AMENDED', modifiedBy: userName }).catch(() => {});
                resend = type === 'HAWB' ? 'XFHL of the MAWB' : 'XFWB (and XFHL if it has houses)';
            }
            if (viaMaster) { await markMasterAmended(sentMaster, `HAWB ${awb.awbNumber} changed: ${amendReason}`, userName); resend = resend || `XFHL of MAWB ${sentMaster.awbNumber}`; }
            await AwbLog.create({ awbNumber: awb.awbNumber, action: 'AWB_AMENDED', user: userName, details: `After sending to the airline: ${amendReason}`.slice(0, 250) }).catch(() => {});
        }
        try { const AwbLog = require('../models/AwbLog'); await AwbLog.create({ awbNumber: awb.awbNumber, action: 'AWB_UPDATED', user: req.user?.username || req.body.user || 'System', details: 'AWB updated via UI.' }); } catch(e){} res.json({ success: true, message: amendReason ? `AWB amended - send the ${resend} again` : 'AWB Updated', amended: !!amendReason, resend });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/awb/void/:id
router.put('/void/:id', async (req, res) => {
    try {
        const type = String(req.body.type || 'MAWB').toUpperCase();
        let Model = type === 'HAWB' ? HouseAWB : Airwaybill;
        const awb = await Model.findByPk(req.params.id);
        if (!awb) return res.status(404).json({ error: 'AWB not found' });
        if (awb.status === 'VOID') return res.json({ success: true, message: 'AWB already VOID' });
        // 11-Nov-2026: an AWB sent to the airline: not after departure; before it, only with a reason, and its number does
        // NOT go back to the stock (the airline has it). A HAWB of a sent master: the master's FHL must be sent again.
        const vUser = req.user?.username || 'System';
        const vMaster = type === 'HAWB' ? await masterOf(awb.masterAwbNumber) : null;
        const vSentSelf = isSent(awb), vViaMaster = !!vMaster && isSent(vMaster);
        let voidReason = '';
        if (vSentSelf || vViaMaster) {
            const mNo = type === 'HAWB' ? vMaster.awbNumber : awb.awbNumber;
            const flown = await flownInfo(mNo);
            if (flown) return res.status(409).json({ flown: true, error: `${type === 'HAWB' ? 'MAWB ' + mNo : awb.awbNumber} has ${flown} - it cannot be voided now.` });
            voidReason = reasonOf(req, '_voidReason');
            if (!voidReason) return res.status(409).json({ needReason: true, reasonFlag: '_voidReason',
                error: vSentSelf ? `${awb.awbNumber} has already been sent to the airline. Voiding it here does not cancel it with the airline - tell the airline too. Its number will not go back to the AWB stock.`
                    : `The XFHL of MAWB ${mNo} has already been sent. After voiding this HAWB the XFHL must be sent again.` });
        }
        // 29-Oct-2026: a master with live houses cannot be voided (the houses would point to a dead master)
        if (type !== 'HAWB') {
            const { Op } = require('sequelize');
            const live = (await liveHousesOf(awb, false)).length; // number with or without the dash
            if (live) return res.status(409).json({ error: `${live} HAWB(s) are linked to ${awb.awbNumber}. Unlink or void them first.` });
        }
        await awb.update({ status: 'VOID', modifiedBy: req.user?.username || 'System' });
        if (type === 'HAWB' && awb.masterAwbNumber) await recalculateMawbTotals(awb.masterAwbNumber);
        if (voidReason) {
            await AwbLog.create({ awbNumber: awb.awbNumber, action: 'AWB_VOIDED_AFTER_SEND', user: vUser, details: voidReason.slice(0, 250) }).catch(() => {});
            if (vViaMaster) await markMasterAmended(vMaster, `HAWB ${awb.awbNumber} voided: ${voidReason}`, vUser);
        }
        // 10-Nov-2026: the number goes back to AVAILABLE in the stock, and its tracking row stops showing as pending
        // (11-Nov-2026: not for an AWB already sent to the airline)
        if (!vSentSelf) await releaseStock(type, awb.awbNumber, Model);
        try {
            const tw = type === 'HAWB' ? { hawbNumber: awb.awbNumber, ...(awb.masterAwbNumber ? { awbNumber: awb.masterAwbNumber } : {}) } : { awbNumber: awb.awbNumber, hawbNumber: null };
            await AwbTracking.update({ status: 'VOID' }, { where: tw });
        } catch (e) { console.warn('[AWB void] tracking:', e.message); }
        try { const AwbLog = require('../models/AwbLog'); await AwbLog.create({ awbNumber: awb.awbNumber, action: 'AWB_VOIDED', user: req.user?.username || req.body.user || 'System', details: 'AWB was voided.' }); } catch(e){} res.json({ success: true, message: 'AWB Voided' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/awb/duplicate/:id — Create a copy of an AWB with a new AWB number
// POST /api/awb/duplicate/:id { type: 'AWB'|'MAWB'|'HAWB', newAwbNumber? }  (29-Oct-2026 rework)
// copies the record with ALL its rows (SPH, OCI, dimensions, rate lines, charges, extra documents) in one transaction.
// Without newAwbNumber an AWB gets the next serial with a valid check digit (before: suffix + 1, wrong check digit);
// a HAWB needs newAwbNumber. The number must not be in use.
router.post('/duplicate/:id', async (req, res) => {
    const type = String((req.body && req.body.type) || req.query.type || 'AWB').toUpperCase();
    const Model = type === 'HAWB' ? HouseAWB : Airwaybill;
    try {
        const original = await Model.findByPk(req.params.id);
        if (!original) return res.status(404).json({ error: 'AWB not found' });
        let newNo = req.body && req.body.newAwbNumber ? normAwbNo(req.body.newAwbNumber, type) : '';
        // a typed AWB number must be 11 digits with a good check digit (serial mod 7)
        if (newNo && type !== 'HAWB') {
            const b = newNo.replace(/\D/g, '');
            if (b.length !== 11) return res.status(400).json({ error: `${req.body.newAwbNumber}: an AWB number has 11 digits (3 prefix + 8 serial)` });
            if (Number(b.slice(3, 10)) % 7 !== Number(b[10])) return res.status(400).json({ error: `${newNo}: wrong check digit (should end in ${Number(b.slice(3, 10)) % 7})` });
        }
        if (!newNo) {
            if (type === 'HAWB') return res.status(400).json({ error: 'Give the new HAWB number (newAwbNumber)' });
            const bare = String(original.awbNumber || '').replace(/\D/g, '');
            if (bare.length !== 11) return res.status(400).json({ error: 'Give the new AWB number (newAwbNumber)' });
            // 10-Nov-2026: the next AVAILABLE number of this airline in the AWB stock first
            if (type !== 'HAWB') {
                const AwbStock = require('../models/AwbStock'); const { Op } = require('sequelize');
                const free = await AwbStock.findAll({ where: { airlinePrefix: bare.slice(0, 3), status: 'AVAILABLE' }, order: [['sequenceNumber', 'ASC'], ['id', 'ASC']], limit: 50 });
                for (const f of free) { const cand = `${f.fullAwbNumber.slice(0, 3)}-${f.fullAwbNumber.slice(3)}`; if (!(await numberTaken(Model, cand, type))) { newNo = cand; break; } }
            }
            let seq = Number(bare.slice(3, 10));
            for (let k = 0; k < 200 && !newNo; k++) {
                seq += 1;
                const cand = `${bare.slice(0, 3)}-${String(seq).padStart(7, '0')}${seq % 7}`;
                if (!(await numberTaken(Model, cand, type))) newNo = cand;
            }
            if (!newNo) return res.status(409).json({ error: 'No free AWB number found after this one' });
        } else if (await numberTaken(Model, newNo, type)) {
            return res.status(409).json({ error: `${newNo} already exists` });
        }
        const { sequelize } = require('../db');
        const strip = (row) => { const { id, createdAt, updatedAt, ...rest } = row.get({ plain: true }); return rest; };
        const types = typesOf(type);
        const copy = await sequelize.transaction(async (t) => {
            const { awbNumber, status, submittedToAirline, transmissionStatus, ...rest } = strip(original);
            // a copied HAWB stays on the same master only when asked (keepMaster); otherwise its weight would be
            // added to that master's totals without anyone choosing it
            if (type === 'HAWB' && !(req.body && req.body.keepMaster)) { if ('masterAwbNumber' in rest) rest.masterAwbNumber = null; if ('masterAwbId' in rest) rest.masterAwbId = null; }
            // 11-Nov-2026: a copy is a new shipment - executed today and no flight yet (the old executed date and the old
            // flight numbers / dates were copied). A HAWB kept on the same master keeps the master's flights.
            { const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              if ('executedDate' in rest) rest.executedDate = today;
              const keepFlights = type === 'HAWB' && req.body && req.body.keepMaster;
              if (!keepFlights) for (const k of ['flightNumber1', 'flightDate1', 'flightNumber2', 'flightDate2', 'flightNumber3', 'flightDate3']) if (k in rest) rest[k] = null;
              let fd = rest.formData; if (typeof fd === 'string') { try { fd = JSON.parse(fd); } catch (e) { fd = null; } }
              if (fd && typeof fd === 'object') { fd = { ...fd }; if ('executedDate' in fd) fd.executedDate = today; if (!keepFlights) for (const k of Object.keys(fd)) if (/^(flight|arrival)/i.test(k)) delete fd[k]; rest.formData = fd; } }
            const created = await Model.create({ ...rest, awbNumber: newNo, status: 'ACTIVE', submittedToAirline: false, createdBy: req.user?.username || 'System' }, { transaction: t });
            for (const M of [SpecialHandlingCode, AwbRateLine, AwbOtherCharge, AwbOci, AwbDimension, AwbExtraDoc]) {
                for (const row of await M.findAll({ where: { awbId: original.id, awbType: types }, transaction: t })) await M.create({ ...strip(row), awbId: created.id }, { transaction: t });
            }
            return created;
        });
        if (type === 'HAWB' && copy.masterAwbNumber) await recalculateMawbTotals(copy.masterAwbNumber);
        // 10-Nov-2026: the new number is USED in its stock (as a saved AWB is); say when it is not in the stock
        let stockNote = '';
        try {
            const pureNew = newNo.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            if (type === 'HAWB') await require('../models/HawbStock').update({ status: 'USED' }, { where: { fullHawbNumber: pureNew } });
            else {
                const AwbStock = require('../models/AwbStock');
                const [n] = await AwbStock.update({ status: 'USED' }, { where: { fullAwbNumber: pureNew } });
                if (!n) stockNote = ' (this number is not in the AWB stock - check it with the airline)';
            }
        } catch (e) { /* stock is optional */ }
        await AwbLog.create({ awbNumber: newNo, action: 'AWB_DUPLICATED', user: req.user?.username || 'System', details: `Copied from ${original.awbNumber}` }).catch(() => {});
        res.json({ success: true, id: copy.id, newAwbNumber: newNo, stockNote, message: `AWB duplicated as ${newNo}${stockNote}` });
    } catch (err) {
        console.error('[DUPLICATE AWB]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// AWB templates (SAVE AS TEMPLATE / TEMPLATE list on the AWB, MAWB and HAWB screens), 29-Oct-2026
// GET /api/awb/templates/:type -> [{ name, data, createdBy, updatedAt }]; PUT /api/awb/templates/:type/:name { data };
// DELETE /api/awb/templates/:type/:name
const AwbTemplate = require('../models/AwbTemplate');
const tplType = (t) => { const T = String(t || '').toUpperCase(); return ['AWB', 'MAWB', 'HAWB'].includes(T) ? T : ''; };
const tplName = (n) => String(n || '').toUpperCase().replace(/[^A-Z0-9 _.&\/()-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
router.get('/templates/:type', async (req, res) => {
    try {
        const T = tplType(req.params.type);
        if (!T) return res.status(400).json({ error: 'type must be AWB, MAWB or HAWB' });
        await AwbTemplate.sync();
        const rows = await AwbTemplate.findAll({ where: { awbType: T }, order: [['name', 'ASC']] });
        res.json({ success: true, data: rows.map(r => { let data = {}; try { data = JSON.parse(r.data || '{}'); } catch (e) { /* bad row */ } return { name: r.name, data, createdBy: r.createdBy, updatedAt: r.updatedAt }; }) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/templates/:type/:name', async (req, res) => {
    try {
        const T = tplType(req.params.type), name = tplName(req.params.name);
        if (!T) return res.status(400).json({ error: 'type must be AWB, MAWB or HAWB' });
        if (!name) return res.status(400).json({ error: 'Give the template a name' });
        const data = req.body && req.body.data;
        if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ error: 'data (the screen fields) is missing' });
        const text = JSON.stringify(data);
        if (text.length > 200000) return res.status(413).json({ error: 'Template is too big' });
        await AwbTemplate.sync();
        const row = await AwbTemplate.findOne({ where: { awbType: T, name } });
        if (row) await row.update({ data: text, createdBy: req.user?.username || row.createdBy || 'System' });
        else await AwbTemplate.create({ awbType: T, name, data: text, createdBy: req.user?.username || 'System' });
        res.json({ success: true, name, replaced: !!row });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
router.delete('/templates/:type/:name', async (req, res) => {
    try {
        const T = tplType(req.params.type), name = tplName(req.params.name);
        const n = await AwbTemplate.destroy({ where: { awbType: T, name } });
        if (!n) return res.status(404).json({ error: 'Template not found' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/awb/hawb/:id/unlink - take a house off its master (29-Oct-2026: removing it on the MAWB screen did not
// reach the database, so the house stayed linked and counted in the master totals)
router.post('/hawb/:id/unlink', async (req, res) => {
    try {
        const h = await HouseAWB.findByPk(req.params.id);
        if (!h) return res.status(404).json({ error: 'HAWB not found' });
        const master = h.masterAwbNumber;
        if (req.body && req.body.masterAwbNumber && master && String(req.body.masterAwbNumber).replace(/\D/g, '') !== String(master).replace(/\D/g, '')) return res.status(409).json({ error: `HAWB is linked to ${master}, not ${req.body.masterAwbNumber}` });
        // 11-Nov-2026: a sent master - not after departure; before it, the master's XFHL must be sent again
        const um = await masterOf(master);
        if (um && isSent(um)) { const flown = await flownInfo(um.awbNumber); if (flown) return res.status(409).json({ flown: true, error: `MAWB ${um.awbNumber} has ${flown} - its houses cannot be changed now.` }); }
        await h.update({ masterAwbNumber: null, masterAwbId: null, modifiedBy: req.user?.username || 'System' });
        if (master) await recalculateMawbTotals(master);
        if (um) await markMasterAmended(um, `HAWB ${h.awbNumber} taken off the master`, req.user?.username || 'System');
        await AwbLog.create({ awbNumber: h.awbNumber, action: 'HAWB_UNLINKED', user: req.user?.username || 'System', details: `Removed from master ${master || '-'}` }).catch(() => {});
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET / PUT /api/awb/extra/:type/:id/:docType - one extra document of a saved AWB (the windows save straight away
// when the AWB is already saved; for a new AWB they are sent with the AWB save as extraDocs)
router.get('/extra/:type/:id/:docType', async (req, res) => {
    try {
        const row = await AwbExtraDoc.findOne({ where: { awbId: req.params.id, awbType: typesOf(req.params.type), docType: String(req.params.docType).toUpperCase() } });
        let data = null; if (row) { try { data = JSON.parse(row.data); } catch (e) { data = null; } }
        res.json({ success: true, data, updatedAt: row ? row.updatedAt : null, updatedBy: row ? row.updatedBy : null });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/extra/:type/:id/:docType', async (req, res) => {
    try {
        const type = String(req.params.type).toUpperCase();
        const Model = type === 'HAWB' ? HouseAWB : Airwaybill;
        if (!(await Model.findByPk(req.params.id))) return res.status(404).json({ error: 'AWB not found - save the AWB first' });
        const docType = String(req.params.docType).toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 30);
        if (!docType) return res.status(400).json({ error: 'Bad document type' });
        const text = JSON.stringify(req.body && 'data' in req.body ? req.body.data : null);
        if (text.length > 200000) return res.status(413).json({ error: 'Document too large' });
        await AwbExtraDoc.destroy({ where: { awbId: req.params.id, awbType: typesOf(type), docType } });
        if (text !== 'null') await AwbExtraDoc.create({ awbId: req.params.id, awbType: type === 'HAWB' ? 'HAWB' : type, docType, data: text, updatedBy: req.user?.username || null });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// AWB E-Docs Routes
router.post('/docs/:tempId', docsUpload, async (req, res) => {
    try {
        const { tempId } = req.params;
        const { documentType, awbId, awbType } = req.body;
        
        let docs = [];
        if (req.files) {
            for (let file of req.files) {
                const doc = await AWBDocument.create({
                    tempId: tempId !== 'null' ? tempId : null,
                    awbId: awbId && awbId !== 'undefined' && awbId !== 'null' ? awbId : null,
                    awbType: awbType ? String(awbType).toUpperCase().slice(0, 10) : null,
                    fileName: file.filename,
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    filePath: `/uploads/awb/${file.filename}`,
                    documentType: documentType || 'OTHER'
                });
                docs.push(doc);
            }
        }
        res.json({ success: true, documents: docs });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


const { extractAwbDataFromFile } = require('../utils/geminiExtractor');

router.post('/docs/extract/:docId', async (req, res) => {
    console.log('--- EXTRACT ROUTE HIT ---', req.params.docId);
    try {
        const doc = await AWBDocument.findByPk(req.params.docId);
        if (!doc) return res.status(404).json({ error: 'Document not found' });
        
        const path = require('path');
        const absolutePath = path.join(__dirname, '..', doc.filePath);
        
        
        let extractedData = await extractAwbDataFromFile(absolutePath, doc.mimeType);
        
        // --- MDM Party Validation ---
        const Party = require('../models/Party');
        const mdmStatus = {
            shipperExists: false, shipperAddressMatch: false, dbShipperAddress: '',
            consigneeExists: false, consigneeAddressMatch: false, dbConsigneeAddress: '',
            buyerExists: false, buyerAddressMatch: false, dbBuyerAddress: ''
        };

        const checkAddressMatch = (extracted, dbStreet, dbCity) => {
            if (!extracted) return true;
            const dbStr = ((dbStreet||'') + ' ' + (dbCity||'')).toLowerCase().replace(/[^a-z0-9]/g, '');
            const exStr = extracted.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (dbStr.length < 5 || exStr.length < 5) return true;
            return exStr.includes(dbStr) || dbStr.includes(exStr);
        };

        if (extractedData.shipperName) {
            const shipper = await Party.findOne({ where: { name: extractedData.shipperName, isShipper: true } });
            if (shipper) {
                mdmStatus.shipperExists = true;
                mdmStatus.dbShipperAddress = `${shipper.street || ''}, ${shipper.city || ''}`;
                mdmStatus.shipperAddressMatch = checkAddressMatch(extractedData.shipperAddress, shipper.street, shipper.city);
            }
        }
        if (extractedData.consigneeName) {
            const consignee = await Party.findOne({ where: { name: extractedData.consigneeName, isConsignee: true } });
            if (consignee) {
                mdmStatus.consigneeExists = true;
                mdmStatus.dbConsigneeAddress = `${consignee.street || ''}, ${consignee.city || ''}`;
                mdmStatus.consigneeAddressMatch = checkAddressMatch(extractedData.consigneeAddress, consignee.street, consignee.city);
            }
        }
        if (extractedData.buyerName) {
            const buyer = await Party.findOne({ where: { name: extractedData.buyerName, isBuyer: true } });
            if (buyer) {
                mdmStatus.buyerExists = true;
                mdmStatus.dbBuyerAddress = `${buyer.street || ''}, ${buyer.city || ''}`;
                mdmStatus.buyerAddressMatch = checkAddressMatch(extractedData.buyerAddress, buyer.street, buyer.city);
            }
        }

        // --- Airport Master Validation ---
        if (extractedData.destination && extractedData.destination.length > 3) {
            const Airport = require('../models/Airport');
            const { Op } = require('sequelize');
            const airport = await Airport.findOne({ where: { name: { [Op.like]: `%${extractedData.destination}%` } } });
            if (airport) extractedData.destination = airport.code;
        }

        res.json({ success: true, data: extractedData, mdmStatus });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/docs/:tempId', async (req, res) => {
    try {
        const { tempId } = req.params;
        const awbId = req.query.awbId;
        
        let docs = [];
        if (awbId && awbId !== 'undefined' && awbId !== 'null') {
            // with the AWB type (AWB / MAWB rows and HAWB rows share id numbers); old rows have no type
            const { Op } = require('sequelize');
            const t = String(req.query.awbType || '').toUpperCase();
            const types = t === 'HAWB' ? ['HAWB'] : t ? ['AWB', 'MAWB'] : null;
            docs = await AWBDocument.findAll({ where: types ? { awbId, [Op.or]: [{ awbType: types }, { awbType: null }] } : { awbId } });
            // 29-Oct-2026: the unlinked documents of the screen's temporary id are no longer added here - those belonged to
            // an earlier draft (CLEAR / MODIFY) and showed up in the pouch of every AWB opened afterwards
        } else {
            docs = await AWBDocument.findAll({ where: { tempId } });
        }
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/docs/:id', async (req, res) => {
    try {
        const doc = await AWBDocument.findByPk(req.params.id);
        if (!doc) return res.status(404).send('Not found');
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, '..', doc.filePath);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        await doc.destroy();
        res.send('Deleted');
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// --- GET LOGS ---
router.get('/logs/:awbNumber', async (req, res) => {
    try {
        const logs = await AwbLog.findAll({
            where: { awbNumber: req.params.awbNumber },
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: logs });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

module.exports = router;

