import { z } from 'zod';

const KYC_STATUSES = ['APPROVED', 'REJECTED', 'PENDING'];

const upperText = (value) => String(value || '').toUpperCase();

/** PUT /party/kyc/:docId/status { status } */
export const kycStatusSchema = z.looseObject({
  status: z.preprocess(upperText, z.enum(KYC_STATUSES, { error: 'status must be APPROVED, REJECTED or PENDING' })),
});

export const kycErrorBody = (message) => ({ error: message });
