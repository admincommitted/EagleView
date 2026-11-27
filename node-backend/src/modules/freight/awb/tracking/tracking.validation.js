import { CODES } from '../../../../utils/awb/awbTrackingEvents.js';
import { orderedChecks } from '../../shared/orderedChecks.js';

const SIX_HOURS_MS = 6 * 3600 * 1000;
const isBlank = (value) => value === undefined || value === '';

function manualEventProblem(body) {
  const code = String(body.code || '').toUpperCase();
  if (!CODES.includes(code)) return `Pick a milestone: ${CODES.join(', ')}`;
  const happenedAt = new Date(body.eventAt);
  if (!body.eventAt || isNaN(happenedAt)) return 'Give the date and time it happened';
  if (happenedAt - Date.now() > SIX_HOURS_MS) return 'The time cannot be in the future';
  if (body.station && !/^[A-Za-z]{3}$/.test(String(body.station).trim()))
    return 'Station must be a 3-letter airport code';
  if (!isBlank(body.pieces) && !(Number.isInteger(+body.pieces) && +body.pieces >= 0))
    return 'Pieces must be a whole number';
  if (!isBlank(body.weight) && !(+body.weight >= 0)) return 'Weight must be 0 or more';
  return '';
}

/** POST /tracking/event { awbNumber, hawbNumber?, code, eventAt, station?, flight?, pieces?, weight?, note? } */
export const manualEventBodySchema = orderedChecks(manualEventProblem);

/** GET /tracking/events?awbNumber=176-12345675&hawbNumber=H1 */
export const trackingEventsQuerySchema = orderedChecks((query) =>
  String(query.awbNumber || '').trim() ? '' : 'awbNumber is required',
);
