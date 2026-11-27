import { z } from 'zod';

export const timelineEntryBodySchema = z
  .any()
  .refine((body) => !!body.jobId && !!body.message && !!String(body.message).trim(), {
    message: 'jobId and message are required',
  });
