import { z } from 'zod';

const RITC_DIGITS = 8;
const MIN_CODE_DIGITS = 4;

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

/** GET /exemptions/:ritc - an 8-digit RITC (spaces / dots dropped) */
export const exemptionParamsSchema = z.object({
  ritc: z.preprocess(digitsOnly, z.string().length(RITC_DIGITS, '8-digit RITC required')),
});

/** GET /fta/:cth and /add/:cth - at least a 4-digit heading */
export const cthParamsSchema = z.object({
  cth: z.preprocess(digitsOnly, z.string().min(MIN_CODE_DIGITS, 'CTH required')),
});

/** GET /:ritc - at least a 4-digit code */
export const ritcParamsSchema = z.object({
  ritc: z.preprocess(digitsOnly, z.string().min(MIN_CODE_DIGITS, 'Valid RITC / HS code required')),
});

export const tariffErrorBody = (message) => ({ success: false, message });
