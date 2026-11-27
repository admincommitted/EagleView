import { z } from 'zod';

const TRADES = ['IMPORT', 'EXPORT', 'BOTH'];
const MODES = ['SEA', 'AIR', 'ALL'];
const CODE_PATTERN = /^[A-Z_]{3,40}$/;
const MAX_FREE_DAYS = 365;
const MAX_SLAB_RATE = 99999999;
const FREE_DAYS_MESSAGE = 'Free days must be a whole number 0 - 365';

const upperText = (value) =>
  String(value == null ? '' : value)
    .trim()
    .toUpperCase();
const upperOrDefault = (fallback) => (value) => upperText(value || fallback);
const blankAsZero = (value) => (value === '' || value == null ? 0 : Number(value));
const roundToPaise = (amount) => Math.round(amount * 100) / 100;

const slabRate = (name) => {
  const message = `${name} must be a number 0 or more`;
  return z
    .preprocess(blankAsZero, z.number({ error: message }).min(0, message).max(MAX_SLAB_RATE, message))
    .transform(roundToPaise);
};

/**
 * POST / PUT a penalty rule. Only these columns are saved. The keys are in the order the screen expects the
 * problems to be reported (trade, mode, type, basis, free days, slabs).
 */
export const penaltyRuleSchema = z.object({
  tradeType: z.preprocess(
    upperOrDefault('IMPORT'),
    z.enum(TRADES, { error: 'Trade type must be IMPORT, EXPORT or BOTH' }),
  ),
  mode: z.preprocess(upperText, z.enum(MODES, { error: 'Mode must be SEA, AIR or ALL' })),
  type: z.preprocess(upperText, z.string().regex(CODE_PATTERN, 'Penalty type is required')),
  basis: z.preprocess(upperText, z.string().regex(CODE_PATTERN, 'Calculation basis is required')),
  rateUom: z.preprocess(upperOrDefault('PER_SHIPMENT_PER_DAY'), z.string()),
  freeDays: z.preprocess(
    Number,
    z
      .number({ error: FREE_DAYS_MESSAGE })
      .int({ error: FREE_DAYS_MESSAGE })
      .min(0, FREE_DAYS_MESSAGE)
      .max(MAX_FREE_DAYS, FREE_DAYS_MESSAGE),
  ),
  slab1Rate: slabRate('slab1Rate'),
  slab2Rate: slabRate('slab2Rate'),
  slab3Rate: slabRate('slab3Rate'),
});

export const penaltyRuleErrorBody = (message) => ({ success: false, message });
