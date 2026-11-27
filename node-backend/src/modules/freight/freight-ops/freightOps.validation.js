import { orderedChecks } from '../shared/orderedChecks.js';

const DASHBOARD_KINDS = ['sea-import', 'air-import', 'sea-export', 'air-export'];

/** Operational events of a job; IGM / VGM / MANIFEST / AMS leave the building and are recorded only. */
export const FREIGHT_EVENTS = {
  CONSOLE: { label: 'Console registered', internal: true },
  CAN: { label: 'Cargo Arrival Notice sent', internal: true },
  DO: { label: 'Delivery Order issued', internal: true },
  DESTUFF: { label: 'De-stuffing / CFS', internal: true },
  MBL: { label: 'MBL issued', internal: true },
  HBL: { label: 'HBL issued', internal: true },
  BOOKING: { label: 'Booking confirmed', internal: true },
  IGM: { label: 'IGM filing recorded', internal: false },
  VGM: { label: 'VGM submission recorded', internal: false },
  MANIFEST: { label: 'Manifest / AMS filing recorded', internal: false },
  AMS: { label: 'AMS filing recorded', internal: false },
  OTHER: { label: 'Other', internal: true },
};

export const upperText = (value) =>
  String(value || '')
    .trim()
    .toUpperCase();

export const dashboardKindOf = (query) => String(query.kind || 'sea-import').toLowerCase();

/** GET /dashboard?kind=sea-import */
export const dashboardQuerySchema = orderedChecks((query) =>
  DASHBOARD_KINDS.includes(dashboardKindOf(query)) ? '' : 'kind must be one of ' + DASHBOARD_KINDS.join(', '),
);

/** POST /events { eventType, jobNo, jobKind, eventDate, refNo, detail, allowRepeat } - the checks made before the job is read. */
export const recordEventBodySchema = orderedChecks((body) => {
  if (!FREIGHT_EVENTS[upperText(body.eventType)])
    return 'eventType must be one of ' + Object.keys(FREIGHT_EVENTS).join(', ');
  if (!String(body.jobNo || '').trim())
    return 'Which job is this for? An event with no job number cannot be found again.';
  return '';
});
