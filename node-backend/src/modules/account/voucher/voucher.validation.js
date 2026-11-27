import { z } from 'zod';

export const pendingBillsQuerySchema = z
  .any()
  .refine((query) => Boolean(parseInt(query.ledgerId, 10)), { message: 'ledgerId is required' });

export const documentListQuerySchema = z
  .any()
  .refine((query) => Boolean(query.voucherId || query.draftKey), { message: 'voucherId or draftKey is required' });

export const claimDocumentsBodySchema = z.any().refine((body) => Boolean(body && body.draftKey && body.voucherId), {
  message: 'draftKey and voucherId are both required',
});

export const voucherErrorBody = (message) => ({ success: false, error: message });
