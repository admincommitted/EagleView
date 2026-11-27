import { z } from 'zod';

const hasLedgerId = (body) => Boolean(parseInt((body || {}).ledgerId, 10));

// the bodies carry many free fields that the service reads one by one; only the ledger is checked up front
export const followUpBodySchema = z.any().refine(hasLedgerId, { message: 'Pick a customer first' });

export const ledgerMatchBodySchema = z.any().refine(hasLedgerId, { message: 'Pick the customer whose ledger this is' });

export const creditControlErrorBody = (message) => ({ success: false, error: message });
