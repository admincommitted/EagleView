import { z } from 'zod';
import { isEmailOrBlank } from './beAmendment.service.js';

export const settingsBodySchema = z
  .any()
  .refine((body) => isEmailOrBlank(body.mailTo), { message: 'Not an e-mail address' });
