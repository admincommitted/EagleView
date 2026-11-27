import { z } from 'zod';

/** The old routes answered a missing field with { success: false, error }. */
export const failureBody = (message) => ({ success: false, error: message });

const required = (message) => z.any().refine((value) => !!value, { message });

const jobDataRequired = required('jobData is required');
const exportDataRequired = required('exportData is required');
const pinRequired = required('Enter the DSC token PIN');

export const billOfEntrySchema = z.looseObject({ jobData: jobDataRequired });

export const signBillOfEntrySchema = z.looseObject({ jobData: jobDataRequired, pin: pinRequired });

export const shippingBillSchema = z.looseObject({ exportData: exportDataRequired });

export const signShippingBillSchema = z.looseObject({ exportData: exportDataRequired, pin: pinRequired });

export const sbAmendmentSchema = z.looseObject({
  jobId: required('jobId is required'),
  amendReason: required('amendReason is required'),
});
