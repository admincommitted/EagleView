import { orderedChecks } from '../shared/orderedChecks.js';

const MAX_BATCH = 5000;
const MAX_SERIAL = 9999999;

/** IATA rule: the check digit is the 7-digit serial modulo 7. */
export const checkDigitOf = (serial7) => Number(serial7) % 7;

/** "176-1234 5675", "17612345675" -> "17612345675" */
export const pureAwbNumber = (value) => String(value || '').replace(/\D/g, '');

/** Selected stock row ids (whole numbers above 0). */
export const stockIdsOf = (ids) =>
  Array.isArray(ids) ? ids.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];

function awbNumberProblem(number) {
  if (!/^\d{11}$/.test(number)) return 'AWB number must be 11 digits (3-digit prefix + 8-digit serial)';
  const expected = checkDigitOf(number.slice(3, 10));
  if (expected !== Number(number[10]))
    return `Check digit is wrong: for serial ${number.slice(3, 10)} it must be ${expected}`;
  return '';
}

/** POST /generate { airlinePrefix, startSerialNumber (7 digits, or 8 with check digit), count, stockDate } */
export const generateAwbStockSchema = orderedChecks((body) => {
  const prefix = String(body.airlinePrefix || '').trim();
  const start = String(body.startSerialNumber || '').replace(/\s/g, '');
  const count = parseInt(body.count, 10);
  if (!/^\d{3}$/.test(prefix)) return 'Airline prefix must be 3 digits (e.g. 176)';
  if (!/^\d{7,8}$/.test(start)) return 'Starting AWB serial must be 7 digits (or 8 with the check digit)';
  if (start.length === 8 && checkDigitOf(start.slice(0, 7)) !== Number(start[7])) {
    return `Check digit of the first AWB is wrong: for ${start.slice(0, 7)} it must be ${checkDigitOf(start.slice(0, 7))}`;
  }
  if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH) return `Count must be between 1 and ${MAX_BATCH}`;
  if (parseInt(start.slice(0, 7), 10) + count - 1 > MAX_SERIAL)
    return 'The series goes past serial 9999999 - reduce the count';
  return '';
});

/** GET /next/:prefix */
export const airlinePrefixParamsSchema = orderedChecks((params) =>
  /^\d{3}$/.test(String(params.prefix || '').trim()) ? '' : 'Airline prefix must be 3 digits',
);

/** POST /hawb/generate { prefix, startSerialNumber, count, partyType, partyId, stockDate } */
export const generateHawbStockSchema = orderedChecks((body) => {
  const prefix = String(body.prefix || '')
    .trim()
    .toUpperCase();
  const start = String(body.startSerialNumber || '').trim();
  const count = parseInt(body.count, 10);
  if (prefix && !/^[A-Z0-9/-]{1,10}$/.test(prefix)) return 'HAWB prefix: up to 10 letters / digits';
  if (!/^\d{1,12}$/.test(start)) return 'Starting HAWB number must be digits only';
  if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH) return `Count must be between 1 and ${MAX_BATCH}`;
  return '';
});

/** POST /unallocate | /void | /delete { ids, type: 'AWB'|'HAWB' } */
export const stockIdsBodySchema = orderedChecks((body) =>
  stockIdsOf(body.ids).length ? '' : 'Select at least one stock row',
);

/** GET /verify/:awb */
export const verifyAwbParamsSchema = orderedChecks((params) => awbNumberProblem(pureAwbNumber(params.awb)));

/** POST /return { awbNumber, action: 'UNUSED'|'VOID' } */
export const returnAwbBodySchema = orderedChecks((body) => {
  const problem = awbNumberProblem(pureAwbNumber(body.awbNumber));
  if (problem) return problem;
  return ['UNUSED', 'VOID'].includes(String(body.action || '').toUpperCase()) ? '' : 'Action must be UNUSED or VOID';
});
