import { orderedChecks } from '../../shared/orderedChecks.js';

const TEMPLATE_TYPES = ['AWB', 'MAWB', 'HAWB'];
const MAX_TEMPLATE_NAME = 60;
const TYPE_ERROR = 'type must be AWB, MAWB or HAWB';

/** 'mawb' -> 'MAWB'; '' when it is not an AWB screen type. */
export const templateTypeOf = (type) => {
  const upper = String(type || '').toUpperCase();
  return TEMPLATE_TYPES.includes(upper) ? upper : '';
};

/** Template names are kept in capitals with only a few punctuation marks, one space between words. */
export const templateNameOf = (name) =>
  String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9 _.&/()-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEMPLATE_NAME);

/** GET /templates/:type */
export const templateTypeParamsSchema = orderedChecks((params) => (templateTypeOf(params.type) ? '' : TYPE_ERROR));

/** PUT /templates/:type/:name */
export const templateNameParamsSchema = orderedChecks((params) => {
  if (!templateTypeOf(params.type)) return TYPE_ERROR;
  if (!templateNameOf(params.name)) return 'Give the template a name';
  return '';
});

/** PUT /templates/:type/:name { data: the screen fields } */
export const saveTemplateBodySchema = orderedChecks((body) => {
  const { data } = body;
  return !data || typeof data !== 'object' || Array.isArray(data) ? 'data (the screen fields) is missing' : '';
});
