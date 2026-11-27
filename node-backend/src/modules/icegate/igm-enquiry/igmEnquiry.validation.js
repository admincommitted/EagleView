import { z } from 'zod';

/** The old route answered a wrong field with { success: false, error }. */
export const failureBody = (message) => ({ success: false, error: message });

const MAX_DOCUMENT_NO_LENGTH = 20;

/** Upper case letters / digits only, as ICEGATE keeps the codes and numbers. */
export const cleanCode = (value) =>
  String(value == null ? '' : value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const code = () => z.any().optional().transform(cleanCode);
const locationCode = (example) =>
  code().refine((value) => /^[A-Z0-9]{6}$/.test(value), {
    message: `Port / location code must be 6 characters, like ${example}.`,
  });
const documentNumber = (message) =>
  code().refine((value) => value.length > 0 && value.length <= MAX_DOCUMENT_NO_LENGTH, { message });

export const airIgmSchema = z.looseObject({
  location: locationCode('INDEL4'),
  mawb: documentNumber('Enter the MAWB number (letters / digits, up to 20).'),
  hawb: code(),
});

export const seaIgmSchema = z.looseObject({
  location: locationCode('INNSA1'),
  bl: documentNumber('Enter the BL number (letters / digits, up to 20).'),
  hbl: code(),
});
