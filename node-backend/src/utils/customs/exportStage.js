// Export (shipping bill) job stage - one rule for the Export dashboard, the timeline and the job save.
//
// Stages in order: DRAFT -> SUBMITTED (sent to ICEGATE / SB No received) -> TD_DONE -> XRAY_DONE -> LEO
// -> GATE_PASS -> DEPARTED -> DELIVERED; CANCELLED stands apart.
const ORDER = ['DRAFT', 'SUBMITTED', 'TD_DONE', 'XRAY_DONE', 'LEO', 'GATE_PASS', 'DEPARTED', 'DELIVERED'];
const CANCELLED_RANK = 99;

const rank = (status) => {
  const stage = normStatus(status);
  if (stage === 'CANCELLED') return CANCELLED_RANK;
  const index = ORDER.indexOf(stage);
  return index < 0 ? 0 : index;
};

// a status text (status master code, timeline remark, old values) -> export job status, or null
function exportStatusFor(text) {
  const t = String(text || '')
    .toUpperCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function normStatus(status) {
  return exportStatusFor(status) || 'DRAFT';
}

// stage of a saved job (plain object with columns + additionalData merged)
function stageOf(job, opts = {}) {
  let stage = normStatus(job.status);
  const raiseTo = (next) => {
    if (rank(next) > rank(stage) && stage !== 'CANCELLED') stage = next;
  };
  if (opts.hasGatepass) raiseTo('GATE_PASS');
  if (job.leoDate || opts.hasLeoCopy) raiseTo('LEO');
  if (job.sbNo || job.sbNumber || /FILED|AMENDED/i.test(String(job.icegateStatus || ''))) raiseTo('SUBMITTED');
  return stage;
}

export { ORDER, rank, exportStatusFor, stageOf };
