import { z } from 'zod';

const MIN_PHONE_DIGITS = 10;

/** A body check that gives `message` when `isMissing(body)` is true. */
const requires = (isMissing, message) =>
  z.any().superRefine((body, ctx) => {
    if (isMissing(body)) ctx.addIssue({ code: 'custom', message });
  });

export const testNumberSchema = requires((body) => !body.toNumber, 'toNumber is required');

export const internalMessageSchema = requires((body) => !body.userId, 'userId is required');

export const statusMessageSchema = z.any().superRefine((body, ctx) => {
  if (!body.mobileNumber) return ctx.addIssue({ code: 'custom', message: 'mobileNumber is required' });
  if (!body.statusText) ctx.addIssue({ code: 'custom', message: 'statusText is required' });
});

/** Module-wise WhatsApp number: the name trimmed, the number keeping only digits and +. */
const moduleNumberOf = (body) => ({
  moduleName: String((body && body.moduleName) || '').trim(),
  phoneNumber: String((body && body.phoneNumber) || '').replace(/[^\d+]/g, ''),
});

export const moduleNumberSchema = z
  .any()
  .superRefine((body, ctx) => {
    const { moduleName, phoneNumber } = moduleNumberOf(body);
    if (!moduleName || phoneNumber.replace(/\D/g, '').length < MIN_PHONE_DIGITS) {
      ctx.addIssue({ code: 'custom', message: 'Module name and a valid phone number are required' });
    }
  })
  .transform(moduleNumberOf);
