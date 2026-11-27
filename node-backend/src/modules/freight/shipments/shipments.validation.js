import { DIVISIONS } from './shipments.constants.js';
import { badRequest } from './shipments.errors.js';

/**
 * The docket checks run after the docket tables are made and (on change) after the saved docket is read, so they stay
 * plain checks called by the service rather than a request schema - the screens get the same first message as always.
 */
const toNumber = (value) => {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

export function assertDivision(division) {
  if (!DIVISIONS[division]) throw badRequest('Division?');
}

export function assertValidDocket(division, body) {
  assertDivision(division);
  const { side, mode } = DIVISIONS[division];
  const isAir = mode === 'Air';
  if (!body.docketDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.docketDate)) throw badRequest('Docket Date is required');
  if (!body.jobType) throw badRequest('Job Type is required');
  if (!String(body.mainParty || '').trim())
    throw badRequest((side === 'Import' ? 'Importer' : 'Shipper') + ' is required');
  if (!body.customsOnly) {
    if (!String(body.mawbNo || '').trim()) throw badRequest((isAir ? 'MAWB No' : 'MBL No') + ' is required');
    if (!String(body.originPort || '').trim() || !String(body.destinationPort || '').trim())
      throw badRequest('Origin and Destination port are required');
  }
  if (isAir && body.mawbNo && !/^\d{3}-?\d{8}$/.test(String(body.mawbNo).replace(/\s/g, '')) && !body.allowOddMawb) {
    throw badRequest('MAWB No should be 11 digits (3-digit airline prefix + 8), e.g. 176-12345675');
  }
  const chargeable = toNumber(body.chargeableWeight);
  const gross = toNumber(body.grossWeight);
  if (chargeable && gross && chargeable < gross && isAir)
    throw badRequest('Chargeable weight cannot be less than gross weight');
}
