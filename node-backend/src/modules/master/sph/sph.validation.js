import { z } from 'zod';

// SPH code: 3 letters (IATA, e.g. PER, DGR, AVI)
const SPH_CODE_PATTERN = /^[A-Z]{3}$/;
const MAX_DESCRIPTION_LENGTH = 500;
const CODE_MESSAGE = 'SPH code must be 3 letters (e.g. PER, DGR)';
const DESCRIPTION_MESSAGE = 'Description is mandatory (max 500 characters)';

export const normaliseSphCode = (value) =>
  String(value || '')
    .trim()
    .toUpperCase();
export const normaliseSphDescription = (value) => String(value || '').trim();

/** The first problem with an SPH code + description, or null. */
export function sphProblem(code, description) {
  if (!SPH_CODE_PATTERN.test(code)) return CODE_MESSAGE;
  if (!description || description.length > MAX_DESCRIPTION_LENGTH) return DESCRIPTION_MESSAGE;
  return null;
}

/** POST /sph-master */
export const createSphSchema = z.looseObject({
  code: z.preprocess(normaliseSphCode, z.string().regex(SPH_CODE_PATTERN, CODE_MESSAGE)),
  description: z.preprocess(
    normaliseSphDescription,
    z.string().min(1, DESCRIPTION_MESSAGE).max(MAX_DESCRIPTION_LENGTH, DESCRIPTION_MESSAGE),
  ),
});

export const sphErrorBody = (message) => ({ error: message });
