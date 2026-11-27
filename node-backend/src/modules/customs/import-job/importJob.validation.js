import { z } from 'zod';
import { digitsOf, isEditableDsrFieldName, isValidBeNoText } from './importJob.service.js';

// z.any(): the body is passed on untouched (the save writes every key of it); only the checks below are made
const checkedValue = (isValid, message) => z.any().refine(isValid, { message });

export const importFileBodySchema = checkedValue((body) => String(body.jsonText || '').trim() !== '', 'File is empty');

export const dsrFieldBodySchema = checkedValue(
  (body) => isEditableDsrFieldName(body.field),
  'This field cannot be edited here',
);

export const byBeQuerySchema = checkedValue((query) => isValidBeNoText(digitsOf(query.beNo)), 'BE No must be numeric');
