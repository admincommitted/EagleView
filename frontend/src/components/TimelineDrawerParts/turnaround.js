import { isValidTime } from './timelineFormat';

const CLEARED_MARKERS = ['GATE PASS', 'DELIVERED', 'OOC ISSUED', 'OOC COPY RECEIVED'];
const DELAYED_AFTER_HOURS = 48;
const HOUR_MS = 60 * 60 * 1000;

// An import job counts from its inward date (IGM) when it has one
function inwardDateOf(job, module) {
  if (!job || module === 'EXPORT') return null;
  let inward = job.inwardDate || job.autoField_17;
  if (!inward) {
    try {
      const igmRows = typeof job._igmRows === 'string' ? JSON.parse(job._igmRows) : job._igmRows;
      inward = (igmRows || []).find((row) => row?.inwardDate)?.inwardDate;
    } catch {
      // no IGM rows
    }
  }
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(inward || ''));
  return ymd ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3]) : null;
}

function elapsedText(elapsedMs) {
  const hours = Math.floor(elapsedMs / HOUR_MS);
  const minutes = Math.floor((elapsedMs % HOUR_MS) / (60 * 1000));
  const days = Math.floor(hours / 24);
  const parts = [days > 0 && `${days}d`, hours % 24 > 0 && `${hours % 24}h`, days === 0 && `${minutes}m`].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Just now';
}

function titleOf(state, hasInward, module) {
  if (state === 'cleared') return hasInward ? 'Clearance time from inward:' : 'Total Clearance Time:';
  if (state === 'delayed') return hasInward ? 'Delayed since inward by:' : 'Clearance Delayed By:';
  if (hasInward) return 'Time since inward:';
  return module === 'EXPORT' ? 'Time Elapsed:' : 'Time since job created:';
}

// Turnaround time of the job -> { state: cleared | delayed | running, title, elapsed }, or null without any time.
// Rows without a time are left out. Without an inward date an import job only shows the time since it was made and is
// never "delayed" (a draft is not a delayed clearance).
export function turnaroundOf(logs, job, module) {
  const timedLogs = logs.filter((log) => isValidTime(log.timestamp)).sort((first, second) => new Date(first.timestamp) - new Date(second.timestamp));
  const inward = inwardDateOf(job, module);
  if (!timedLogs.length && !inward) return null;
  const clearedLog = [...timedLogs].reverse().find((log) => CLEARED_MARKERS.some((marker) => (log.message || '').toUpperCase().includes(marker)));
  const start = inward || new Date(timedLogs[0].timestamp);
  const end = clearedLog ? new Date(clearedLog.timestamp) : new Date();
  const elapsedMs = Math.max(0, end - start);
  const countsDelay = module === 'EXPORT' || !!inward;
  const state = clearedLog ? 'cleared' : (countsDelay && Math.floor(elapsedMs / HOUR_MS) > DELAYED_AFTER_HOURS ? 'delayed' : 'running');
  return { state, title: titleOf(state, !!inward, module), elapsed: elapsedText(elapsedMs) };
}
