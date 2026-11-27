import { z } from 'zod';

const GST_STATE_CODE = /^\d{2}$/;
const IATA_CODE = /^[A-Z]{3}$/;
const NO_IATA_CODE = '-';

const hasValidTaxCode = (body) => !body?.taxCode || GST_STATE_CODE.test(String(body.taxCode));

function hasValidIataCode(body) {
  const iataCode = body?.iataCode ? String(body.iataCode).trim().toUpperCase() : body?.iataCode;
  return !iataCode || iataCode === NO_IATA_CODE || IATA_CODE.test(iataCode);
}

/** POST / PUT /states: the GST state code (tax code) is 2 digits. The body itself passes on unchanged. */
export const stateSchema = z.unknown().refine(hasValidTaxCode, 'GST state code (tax code) must be 2 digits, e.g. 07');

/** POST / PUT /cities: the IATA code is 3 letters ('-' = none). The body itself passes on unchanged. */
export const citySchema = z.unknown().refine(hasValidIataCode, 'IATA code must be 3 letters');

export const locationErrorBody = (message) => ({ error: message });
