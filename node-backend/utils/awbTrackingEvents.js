// One place that records a status event (from an FSU file or entered by hand) - 29-Oct-2026.
// 1. the event is kept in AwbTrackingEvents (full history, no duplicates of the same code + time);
// 2. the milestone column of the AwbTracking row is filled (first time; FNA / FMA keep the latest, so a new rejection
//    after an acceptance shows again) and the row status moves forward;
// 3. customer updates are sent if they are switched on (utils/awbNotify.js).
const AwbTracking = require('../models/AwbTracking');
const AwbTrackingEvent = require('../models/AwbTrackingEvent');

const CODES = ['FNA', 'FMA', 'FOH', 'RCS', 'DEP', 'ARR', 'TFD', 'RCF', 'NFD', 'DLV'];
const CODE_NAME = {
    FNA: 'Rejected by airline (FNA)', FMA: 'Accepted by airline (FMA)', FOH: 'Freight on hand', RCS: 'Received by airline (RCS)',
    DEP: 'Departed', ARR: 'Arrived', TFD: 'Transferred', RCF: 'Received at destination', NFD: 'Consignee notified', DLV: 'Delivered',
};
const STATUS_ORDER = ['PENDING', 'TRANSMITTED', 'BOOKED', 'RECEIVED', 'DEPARTED', 'ARRIVED', 'DELIVERED', 'FINISHED'];
const CODE_TO_STATUS = { RCS: 'RECEIVED', FOH: 'RECEIVED', DEP: 'DEPARTED', ARR: 'ARRIVED', RCF: 'ARRIVED', NFD: 'ARRIVED', DLV: 'FINISHED' };
const LATEST_WINS = ['FNA', 'FMA'];

const bare = (n) => String(n || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const normAwb = (n) => { const b = bare(n); return /^\d{11}$/.test(b) ? `${b.slice(0, 3)}-${b.slice(3)}` : String(n || '').trim(); };
// airline time text -> ISO; text that is not a date is kept as it came (the FSU text format can send 30JAN)
function toIso(v) {
    if (!v) return new Date().toISOString();
    const d = new Date(v);
    return isNaN(d) ? String(v).trim() : d.toISOString();
}

async function recordEvent(e, opts = {}) {
    const code = String(e.code || '').toUpperCase();
    if (!CODES.includes(code)) throw Object.assign(new Error(`Unknown milestone ${e.code}. Use one of ${CODES.join(', ')}`), { status: 400 });
    const awbNumber = normAwb(e.awbNumber);
    if (!awbNumber) throw Object.assign(new Error('AWB number is required'), { status: 400 });
    const hawbNumber = e.hawbNumber ? String(e.hawbNumber).trim() : null;
    const eventAt = toIso(e.eventAt);

    const dup = await AwbTrackingEvent.findOne({ where: { awbNumber, hawbNumber, code, eventAt } });
    if (dup) return { event: dup, duplicate: true };

    const event = await AwbTrackingEvent.create({
        awbNumber, hawbNumber, code, eventAt,
        station: e.station ? String(e.station).trim().toUpperCase().slice(0, 5) : null,
        flight: e.flight ? String(e.flight).replace(/\s+/g, '').toUpperCase().slice(0, 12) : null,
        pieces: Number.isFinite(parseInt(e.pieces, 10)) ? parseInt(e.pieces, 10) : null,
        weight: Number.isFinite(parseFloat(e.weight)) ? parseFloat(e.weight) : null,
        source: e.source === 'MANUAL' ? 'MANUAL' : 'FSU',
        note: e.note ? String(e.note).slice(0, 300) : null,
        user: e.user ? String(e.user).slice(0, 60) : null,
    });

    // tracking row: the master's own row (hawbNumber null) or the house's row
    const variants = [...new Set([awbNumber, bare(awbNumber)])];
    let row = await AwbTracking.findOne({ where: { awbNumber: variants, hawbNumber } });
    if (!row) row = await AwbTracking.create({ awbNumber, hawbNumber, documentType: hawbNumber ? 'HOUSE' : 'MASTER', saved: true, submittedToAirline: true, status: 'PENDING' });
    const col = code.toLowerCase();
    const upd = { submittedToAirline: true };
    if (!row[col] || (LATEST_WINS.includes(code) && String(eventAt) > String(row[col]))) upd[col] = eventAt;
    const next = CODE_TO_STATUS[code];
    if (next && STATUS_ORDER.indexOf(next) > STATUS_ORDER.indexOf(row.status || 'PENDING')) upd.status = next;
    await row.update(upd);

    if (!opts.skipNotify) {
        try {
            const { notifyEvent } = require('./awbNotify');
            const sent = await notifyEvent(event);
            if (sent) await event.update({ notified: sent });
        } catch (err) {
            await event.update({ notified: 'ERROR: ' + String(err.message || err).slice(0, 200) }).catch(() => {});
        }
    }
    return { event, duplicate: false };
}

// after a hand-entered event is deleted: the milestone column goes back to the latest remaining event of that code
async function refreshMilestone(awbNumber, hawbNumber, code) {
    const col = String(code).toLowerCase();
    const left = await AwbTrackingEvent.findAll({ where: { awbNumber: normAwb(awbNumber), hawbNumber: hawbNumber || null, code }, order: [['eventAt', 'ASC']] });
    const row = await AwbTracking.findOne({ where: { awbNumber: [normAwb(awbNumber), bare(awbNumber)], hawbNumber: hawbNumber || null } });
    if (!row) return;
    const value = left.length ? (LATEST_WINS.includes(code) ? left[left.length - 1].eventAt : left[0].eventAt) : null;
    await row.update({ [col]: value });
}

module.exports = { recordEvent, refreshMilestone, CODES, CODE_NAME, normAwb, toIso };
