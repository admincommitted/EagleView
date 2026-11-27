import { z } from 'zod';

/** POST /api/masters/parties - the Party Master form. Branches, AD codes and the other fields pass through. */
export const createPartySchema = z
  .object({
    partyType: z.string().optional().default('MULTI'),
    isShipper: z.boolean().optional().default(false),
    isConsignee: z.boolean().optional().default(false),
    isNotifyParty: z.boolean().optional().default(false),
    isBuyer: z.boolean().optional().default(false),
    isSubAgent: z.boolean().optional().default(false),
    isOverseasAgent: z.boolean().optional().default(false),
    name: z.string().min(1, 'Name is required').toUpperCase(),
    code: z.string().optional(),
    street: z.string().max(70, 'Street cannot exceed 70 characters').toUpperCase(),
    city: z.string().max(17, 'City cannot exceed 17 characters').toUpperCase(),
    stateProvince: z.string().toUpperCase().optional(),
    countryCode: z.string().length(2, 'Country must be exactly 2 characters').toUpperCase(),
    zipPostcode: z.string().max(9, 'Zip cannot exceed 9 characters').toUpperCase(),
    phoneNumber: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
  })
  .passthrough();

/** The form shows every problem as "FIELD: message", comma separated. */
export const partyFormErrorBody = (message, issues) => ({
  error: issues.map((issue) => `${issue.field.toUpperCase()}: ${issue.message}`).join(', '),
});
