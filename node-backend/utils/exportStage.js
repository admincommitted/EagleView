// Export (shipping bill) job stage - one rule for the Export dashboard, the timeline and the job save. 29-Oct-2026
//
// Stages in order: DRAFT -> SUBMITTED (sent to ICEGATE / SB No received) -> TD_DONE -> XRAY_DONE -> LEO
// -> GATE_PASS -> DEPARTED -> DELIVERED; CANCELLED stands apart.
const ORDER = ['DRAFT', 'SUBMITTED', 'TD_DONE', 'XRAY_DONE', 'LEO', 'GATE_PASS', 'DEPARTED', 'DELIVERED'];
const rank = (s) => { const k = normStatus(s); if (k === 'CANCELLED') return 99; const i = ORDER.indexOf(k); return i < 0 ? 0 : i; };

// a status text (status master code, timeline remark, old values) -> export job status, or null
function exportStatusFor(text) {
    const t = String(text || '').toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return null;
    if (/CANCEL/.test(t)) return 'CANCELLED';
    if (/DELIVER/.test(t)) return 'DELIVERED';
    if (/DEPART|FLOWN|SAILED|HANDOVER|HAND OVER|LOADED/.test(t)) return 'DEPARTED';
    if (/GATE ?PASS|EGM/.test(t)) return 'GATE_PASS';
    if (/\bLEO\b|LET EXPORT/.test(t)) return 'LEO';
    if (/X ?RAY/.test(t)) return 'XRAY_DONE';
    if (/\bTD\b|TOUCH ?DOWN|CARTED|CARTING|GATE ?IN|GOODS ARRIVAL/.test(t)) return 'TD_DONE';
    if (/SUBMIT|FILED|SENT TO ICEGATE|PROCESSED|SB (NO|NUMBER)|ACK/.test(t)) return 'SUBMITTED';
    if (/^DRAFT$|JOB CREATED|^PENDING$/.test(t)) return 'DRAFT';
    return null;
}
function normStatus(s) { return exportStatusFor(s) || 'DRAFT'; }

// stage of a saved job (plain object with columns + additionalData merged)
function stageOf(j, opts = {}) {
    let st = normStatus(j.status);
    const up = (s) => { if (rank(s) > rank(st) && st !== 'CANCELLED') st = s; };
    if (opts.hasGatepass) up('GATE_PASS');
    if (j.leoDate || opts.hasLeoCopy) up('LEO');
    if (j.sbNo || j.sbNumber || /FILED|AMENDED/i.test(String(j.icegateStatus || ''))) up('SUBMITTED');
    return st;
}

module.exports = { ORDER, rank, exportStatusFor, normStatus, stageOf };
