import { z } from 'zod';

export const bulkZipBodySchema = z
  .any()
  .refine((body) => Array.isArray(body.files) && body.files.length > 0, { message: 'No files provided for zipping' });
