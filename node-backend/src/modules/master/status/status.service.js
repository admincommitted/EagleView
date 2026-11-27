import { BadRequestError, ConflictError, NotFoundError } from '../../../core/http/index.js';
import { StatusMaster } from '../../../models/index.js';

const FIELDS = [
  'description',
  'macroBucket',
  'colorCode',
  'textColor',
  'module',
  'sequence',
  'disables',
  'enables',
  'bubbleStyle',
];
const COLOR_FIELDS = ['colorCode', 'textColor'];
const STATUS_CODE_PATTERN = /^[A-Z0-9_]{2,40}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
export const SAVE_MODES = { create: 'create', update: 'update' };

const failed = (ErrorClass, message) => new ErrorClass(message, { body: { success: false, message } });
const statusNotFound = () => failed(NotFoundError, 'Not found');

export const listStatuses = ({ module }) =>
  StatusMaster.findAll({
    where: module ? { module } : {},
    order: [
      ['module', 'ASC'],
      ['sequence', 'ASC'],
      ['code', 'ASC'],
    ],
  });

function statusValuesOf(code, body) {
  const values = { code };
  for (const field of FIELDS) if (body[field] !== undefined) values[field] = body[field];
  values.sequence = parseInt(values.sequence, 10) || 0;
  for (const field of COLOR_FIELDS) {
    if (values[field] && !COLOR_PATTERN.test(String(values[field])))
      throw failed(BadRequestError, `${field} must be a colour like #e2e8f0`);
  }
  return values;
}

/**
 * Creates or updates a status by its code. mode 'create' refuses an existing code (409) instead of overwriting it;
 * mode 'update' needs an existing one (404).
 */
export async function saveStatus(codeText, mode, body) {
  const code = String(codeText || '')
    .trim()
    .toUpperCase();
  if (!STATUS_CODE_PATTERN.test(code))
    throw failed(BadRequestError, 'Code: 2-40 letters, digits or _ (e.g. EXAM_SCHEDULED)');
  const values = statusValuesOf(code, body);
  const existing = await StatusMaster.findOne({ where: { code } });
  if (existing && mode === SAVE_MODES.create) {
    throw failed(ConflictError, `Status ${code} already exists - pick it from the list to edit`);
  }
  if (!existing && mode === SAVE_MODES.update) throw statusNotFound();
  const status = existing ? await existing.update(values) : await StatusMaster.create(values);
  return { success: true, data: status, message: existing ? 'Updated' : 'Created' };
}

export async function deleteStatus(code) {
  const deletedCount = await StatusMaster.destroy({ where: { code: String(code).toUpperCase() } });
  if (!deletedCount) throw statusNotFound();
}
