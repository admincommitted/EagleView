// The three freight dashboards: Air Import, Sea Import, Sea Export.
//
// 30-Oct-2026: all three listed invented shipments ("CMAU999888777 on CMA CGM MARCO POLO V.42",
// "176-99887766 on EK 512") with hardcoded KPI numbers, and every action button was dead. The rows
// come from the real import / export jobs now, and the buttons record real operational events.
//
// What is honestly NOT here: filing an IGM to SCMTR / ICEGATE, submitting a VGM to the shipping
// line's portal, and filing AMS to US customs all talk to outside systems that need their own
// credentials and channel. Those are recorded as events with isInternal = false, and the screen
// says plainly that recording is not transmitting.
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const ImportJob = require('../models/ImportJob');
const ExportJob = require('../models/ExportJob');
const FreightEvent = require('../models/FreightEvent');
// Most job fields (autoField_*, the IGM / container grids, the CTX block) have no column of their own -
// they live as JSON in extendedData and only come back through unpackExtra. Without this the dashboards
// would show a blank importer and a blank MBL for every job, because those two are among them.
const { unpackExtra } = require('../utils/extraFields');

const U = (v) => String(v || '').trim().toUpperCase();
const r2 = (n) => Math.round((n || 0) * 100) / 100;
const KINDS = ['sea-import', 'air-import', 'sea-export', 'air-export'];
const EVENTS = {
    CONSOLE: { label: 'Console registered', internal: true },
    CAN: { label: 'Cargo Arrival Notice sent', internal: true },
    DO: { label: 'Delivery Order issued', internal: true },
    DESTUFF: { label: 'De-stuffing / CFS', internal: true },
    MBL: { label: 'MBL issued', internal: true },
    HBL: { label: 'HBL issued', internal: true },
    BOOKING: { label: 'Booking confirmed', internal: true },
    // these three leave the building - this software does not send them
    IGM: { label: 'IGM filing recorded', internal: false },
    VGM: { label: 'VGM submission recorded', internal: false },
    MANIFEST: { label: 'Manifest / AMS filing recorded', internal: false },
    AMS: { label: 'AMS filing recorded', internal: false },
    OTHER: { label: 'Other', internal: true },
};
const EXTERNAL_NOTE = {
    IGM: 'Recorded in this system only. An IGM is filed to SCMTR / ICEGATE through the carrier or your own ICEGATE channel - this software has not been given those credentials, so it did not transmit anything.',
    VGM: 'Recorded in this system only. A VGM goes to the shipping line’s own portal or by EDI - this software has no line portal credentials, so it did not transmit anything.',
    MANIFEST: 'Recorded in this system only. A manifest / AMS filing goes to the destination customs system (for the USA, AMS through an approved filer) - this software has no such channel, so it did not transmit anything.',
    AMS: 'Recorded in this system only. AMS is filed to US customs through an approved filer - this software has no such channel, so it did not transmit anything.',
};

const isAir = (j) => /AIR/.test(U(j.shipmentMode || j.transportMode || j.modeOfTransport));
const isSea = (j) => /SEA|OCEAN|VESSEL/.test(U(j.shipmentMode || j.transportMode || j.modeOfTransport));
const pick = (j, keys) => { for (const k of keys) { const v = j[k] != null ? j[k] : (j.dataValues || {})[k]; if (v) return String(v); } return ''; };

// This system keeps the master document in one field for both modes - mawbNo / mawbblNo holds the
// MAWB for air and the MBL for sea, and hawbNo / hawbhblNo the house document. That is the
// convention the BE builder and the IGM rows already use, so the dashboards read the same keys
// instead of inventing an mblNo that nothing writes.
const rowsOf = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };

function rowOf(j, kind) {
    const igm = rowsOf(j._igmRows)[0] || {};
    const from = (keys) => pick(j, keys) || pick(igm, keys);
    return {
        id: j.id, jobNo: j.jobNo || '',
        jobKind: kind.endsWith('import') ? 'IMPORT' : 'EXPORT',
        docNo: from(['mawbNo', 'mawbblNo', 'masterBlNo', 'mblNo', 'blNo', 'oblNo']),
        houseNo: from(['hawbNo', 'hawbhblNo', 'hblNo']),
        igmNo: from(['igmNumber', 'igmNo']),
        party: pick(j, ['autoField_4', 'nameOfImporter', 'importerName', 'exporterName', 'shipperName', 'partyName']),
        origin: pick(j, ['portOfOrigin', 'portOfShipment', 'loadingPortCode', 'loadingPortName', 'portOfLoading']),
        destination: pick(j, ['portCode', 'portName', 'destPortCode', 'destPortName', 'discPortCode', 'PortOfDischarge']),
        carrier: from(['vessel', 'flightVoyage', 'vesselName', 'carrierName', 'shippingLine']),
        eta: from(['eta', 'etaDate', 'arrivalDate', 'inwardDate']),
        etd: pick(j, ['etd', 'etdDate', 'sailingDate']),
        mode: pick(j, ['shipmentMode', 'transportMode', 'modeOfTransport']),
        grossWt: pick(j, ['grossWt', 'grossWeight']),
        grossWtUnit: pick(j, ['grossWtUnit']),
        status: U(j.status) || 'DRAFT',
        icegateStatus: U(j.icegateStatus) || '',
        beNo: pick(j, ['beNo']), sbNo: pick(j, ['sbNo']),
        jobDate: pick(j, ['jobDate', 'date']),
    };
}

// GET /api/freight/dashboard?kind=sea-import
router.get('/dashboard', async (req, res) => {
    try {
        const kind = String(req.query.kind || 'sea-import').toLowerCase();
        if (!KINDS.includes(kind)) return res.status(400).json({ success: false, error: 'kind must be one of ' + KINDS.join(', ') });
        const wantImport = kind.endsWith('import');
        const wantAir = kind.startsWith('air');

        const raw = wantImport
            ? await ImportJob.findAll({ order: [['id', 'DESC']], limit: 2000 })
            : await ExportJob.findAll({ order: [['id', 'DESC']], limit: 2000 });
        const all = raw.map(j => unpackExtra(j, 'extendedData'));

        // a job with no mode recorded is shown in both, flagged, rather than hidden from both
        const matching = all.filter(j => (wantAir ? isAir(j) : isSea(j)));
        const unknownMode = all.filter(j => !isAir(j) && !isSea(j));
        const rows = [...matching, ...unknownMode].map(j => {
            const r = rowOf(j, kind);
            r.modeUnknown = !isAir(j) && !isSea(j);
            return r;
        });

        const jobNos = rows.map(r => r.jobNo).filter(Boolean);
        const events = jobNos.length
            ? await FreightEvent.findAll({ where: { jobNo: { [Op.in]: jobNos } }, order: [['eventDate', 'DESC'], ['id', 'DESC']] })
            : [];
        const byJob = new Map();
        events.forEach(e => { if (!byJob.has(e.jobNo)) byJob.set(e.jobNo, []); byJob.get(e.jobNo).push(e); });
        rows.forEach(r => {
            const mine = byJob.get(r.jobNo) || [];
            r.events = mine.map(e => ({ id: e.id, eventType: e.eventType, eventDate: e.eventDate, refNo: e.refNo, detail: e.detail, isInternal: e.isInternal }));
            r.has = {};
            Object.keys(EVENTS).forEach(t => { r.has[t] = mine.some(e => e.eventType === t); });
        });

        const n = (x) => rows.filter(x).length;
        const kpis = wantImport ? {
            total: rows.length,
            arrivingNoBe: n(r => !r.beNo && !['OOC', 'DELIVERED'].includes(r.status)),
            pendingDo: n(r => !r.has.DO),
            customsHold: n(r => /QUERY/.test(r.status) || /QUERY/.test(r.icegateStatus)),
            consoleBreak: n(r => r.has.CONSOLE && !r.has.DESTUFF),
            igmNotRecorded: wantAir ? null : n(r => !r.has.IGM),
        } : {
            total: rows.length,
            booked: n(r => r.has.BOOKING),
            pendingVgm: wantAir ? null : n(r => !r.has.VGM),
            blIssued: n(r => r.has.MBL || r.has.HBL),
            sailed: n(r => /SAILED|SHIPPED|GATED|LEO/.test(r.status)),
        };

        res.json({
            success: true, kind, data: rows, kpis,
            eventTypes: Object.entries(EVENTS).map(([k, v]) => ({ type: k, label: v.label, internal: v.internal })),
            externalNotes: EXTERNAL_NOTE,
            counts: { matchedByMode: matching.length, modeNotRecorded: unknownMode.length, totalJobs: all.length },
            note: rows.length
                ? 'Rows are the real ' + (wantImport ? 'import' : 'export') + ' jobs. ' +
                  (unknownMode.length ? unknownMode.length + ' job(s) have no shipment mode recorded, so they are listed here and flagged rather than hidden. ' : '') +
                  'IGM, VGM and manifest / AMS are recorded here only - this software does not transmit them to the portal.'
                : 'No ' + (wantAir ? 'air' : 'sea') + ' ' + (wantImport ? 'import' : 'export') + ' job yet. Create one in ' + (wantImport ? 'Import' : 'Export') + ' Entry and set its shipment mode.',
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/freight/events
router.post('/events', async (req, res) => {
    try {
        const b = req.body || {};
        const type = U(b.eventType);
        if (!EVENTS[type]) return res.status(400).json({ success: false, error: 'eventType must be one of ' + Object.keys(EVENTS).join(', ') });
        const jobNo = String(b.jobNo || '').trim();
        if (!jobNo) return res.status(400).json({ success: false, error: 'Which job is this for? An event with no job number cannot be found again.' });
        const kindIn = U(b.jobKind) === 'EXPORT' ? 'EXPORT' : 'IMPORT';
        const job = kindIn === 'EXPORT'
            ? await ExportJob.findOne({ where: { jobNo } })
            : await ImportJob.findOne({ where: { jobNo } });
        if (!job) return res.status(404).json({ success: false, error: 'No ' + kindIn.toLowerCase() + ' job ' + jobNo });

        const date = String(b.eventDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ success: false, error: 'Give a valid date' });

        // these three produce a document number that has to be recorded, or the row is useless later
        if (['DO', 'MBL', 'HBL', 'IGM', 'VGM'].includes(type) && !String(b.refNo || '').trim()) {
            return res.status(400).json({ success: false, error: 'A ' + EVENTS[type].label + ' needs its reference / document number' });
        }
        const dup = await FreightEvent.findOne({ where: { jobNo, eventType: type } });
        if (dup && !b.allowRepeat) {
            return res.status(400).json({ success: false, error: EVENTS[type].label + ' is already recorded on ' + jobNo + ' (' + (dup.refNo || dup.eventDate) + '). Send allowRepeat to record another one.' });
        }

        const row = await FreightEvent.create({
            jobNo, jobKind: kindIn, jobId: job.id,
            eventType: type, eventDate: date,
            refNo: b.refNo ? String(b.refNo).trim().slice(0, 60) : null,
            detail: b.detail ? String(b.detail) : null,
            isInternal: EVENTS[type].internal,
            createdBy: (req.user && req.user.id) || null,
            createdByName: (req.user && (req.user.fullName || req.user.username)) || null,
        });
        res.json({
            success: true, data: row,
            note: EVENTS[type].internal
                ? EVENTS[type].label + ' recorded on ' + jobNo + '.'
                : EXTERNAL_NOTE[type] || (EVENTS[type].label + ' recorded on ' + jobNo + ' - this system did not transmit it.'),
            transmitted: false,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/events', async (req, res) => {
    try {
        const where = {};
        if (req.query.jobNo) where.jobNo = String(req.query.jobNo);
        if (req.query.eventType) where.eventType = U(req.query.eventType);
        const rows = await FreightEvent.findAll({ where, order: [['eventDate', 'DESC'], ['id', 'DESC']], limit: 500 });
        res.json({ success: true, data: rows, eventTypes: Object.entries(EVENTS).map(([k, v]) => ({ type: k, label: v.label, internal: v.internal })) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/events/:id', async (req, res) => {
    try {
        const row = await FreightEvent.findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'Event not found' });
        await row.destroy();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
