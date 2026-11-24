// Stage of an AWB / HAWB from its tracking row (29-Oct-2026) - shared by the dashboard, Track Shipments and Search.
// FNA = the airline / host rejected the message; it counts until an FMA (accepted) or a later milestone comes after it.
function stageOf(rec, tr) {
    tr = tr || {};
    if (rec.status === 'VOID') return 'VOID';
    if (tr.dlv) return 'DELIVERED';
    if (tr.dep || tr.arr || tr.rcf || tr.nfd || tr.tfd) return 'DEPARTED';
    if (tr.rcs || tr.foh) return 'READY_FOR_CARRIAGE';
    if (tr.fna && !(tr.fma && String(tr.fma) > String(tr.fna))) return 'REJECTED';
    if (tr.submittedToAirline || rec.status === 'TRANSMITTED' || tr.fma) return 'SUBMITTED';
    return 'SAVED';
}
const bare = (n) => String(n || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const trackKey = (awb, hawb) => bare(awb) + '|' + bare(hawb);
// all tracking rows of these master numbers, as a map trackKey -> row
async function trackingMap(masterNumbers) {
    const { Op } = require('sequelize');
    const AwbTracking = require('../models/AwbTracking');
    const nos = [...new Set(masterNumbers.filter(Boolean))];
    const variants = [...new Set(nos.flatMap((n) => { const b = bare(n); return [n, b, b.length === 11 ? `${b.slice(0, 3)}-${b.slice(3)}` : n]; }))];
    const rows = variants.length ? await AwbTracking.findAll({ where: { awbNumber: { [Op.in]: variants } } }) : [];
    const map = {};
    rows.forEach((t) => { map[trackKey(t.awbNumber, t.hawbNumber)] = t; });
    return map;
}
// a house flies with its master: movement milestones the house row does not have come from the master's row
// (FNA / FMA / submitted stay the house's own - they are about its FHL message)
const MOVE = ['foh', 'rcs', 'dep', 'arr', 'tfd', 'rcf', 'nfd', 'dlv'];
function houseTrack(own, master) {
    if (!master) return own;
    const o = own ? (own.toJSON ? own.toJSON() : { ...own }) : {};
    MOVE.forEach((k) => { if (!o[k] && master[k]) o[k] = master[k]; });
    return o;
}
module.exports = { stageOf, trackKey, trackingMap, bare, houseTrack };
