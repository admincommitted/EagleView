import { orderedChecks } from '../../shared/orderedChecks.js';

const AWB_DIGITS = 11;

/** GET /manifest/:masterAwbNumber - the 11-digit MAWB number, dash or not. */
export const manifestParamsSchema = orderedChecks((params) => {
  const digits = String(params.masterAwbNumber || '')
    .replace(/\D/g, '')
    .slice(0, AWB_DIGITS);
  return digits.length === AWB_DIGITS ? '' : 'Give the 11-digit MAWB number';
});
