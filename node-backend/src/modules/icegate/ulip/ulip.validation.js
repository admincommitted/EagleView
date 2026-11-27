import { z } from 'zod';

/** The old route answered a missing field with { success: false, error }. */
export const failureBody = (message) => ({ success: false, error: message });

export const dgftIecSchema = z.looseObject({
  iec: z.any().refine((value) => !!value, { message: 'IEC Number is required' }),
});
