import { sequelize } from '../../../config/database.js';
import { NotFoundError } from '../../../core/http/index.js';
import { ChaMaster } from '../../../models/index.js';
import { companyMasterBadRequest as badRequest } from '../shared/errorAnswers.js';

const TEXT_FIELDS = [
  'chaCode',
  'chaLicense',
  'chaName',
  'chaAddress',
  'chaCity',
  'chaPin',
  'chaGstin',
  'chaPhone',
  'chaEmail',
];
const UPPER_CASE_FIELDS = ['chaCode', 'chaLicense', 'chaName', 'chaCity', 'chaGstin'];
// CHA code as filed in ICEGATE: PAN-based, e.g. AAACC1234DCH001 (letters / numbers, up to 15)
const CHA_CODE_PATTERN = /^[A-Z0-9]{3,15}$/;
const PIN_PATTERN = /^\d{6}$/;
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const chaNotFound = () => new NotFoundError('CHA not found', { body: { success: false, error: 'CHA not found' } });

/** The CHA fields sent (only those), cleaned and checked. */
function chaValuesOf(body) {
  const values = {};
  for (const field of TEXT_FIELDS) {
    if (body[field] !== undefined) values[field] = String(body[field] == null ? '' : body[field]).trim();
  }
  for (const field of UPPER_CASE_FIELDS) if (values[field]) values[field] = values[field].toUpperCase();
  if (body.isDefault !== undefined) values.isDefault = !!body.isDefault;
  if (values.chaCode !== undefined && !CHA_CODE_PATTERN.test(values.chaCode)) {
    throw badRequest('CHA code: up to 15 letters / numbers (e.g. AAACC1234DCH001)');
  }
  if (values.chaName !== undefined && !values.chaName) throw badRequest('CHA name is required');
  if (values.chaPin && !PIN_PATTERN.test(values.chaPin)) throw badRequest('PIN code must be 6 digits');
  if (values.chaGstin && !GSTIN_PATTERN.test(values.chaGstin))
    throw badRequest('GSTIN must be 15 characters like 07AAACC1234D1Z5');
  if (values.chaEmail && !EMAIL_PATTERN.test(values.chaEmail)) throw badRequest('Email is not valid');
  return values;
}

const clearDefaultCha = (transaction) => ChaMaster.update({ isDefault: false }, { where: {}, transaction });

export const listChas = () =>
  ChaMaster.findAll({
    order: [
      ['isDefault', 'DESC'],
      ['chaName', 'ASC'],
    ],
  });

/** The first CHA is the default; a new default replaces the old one in the same transaction. */
export async function createCha(body) {
  const values = chaValuesOf({ ...body, chaCode: body.chaCode || '', chaName: body.chaName || '' });
  return sequelize.transaction(async (transaction) => {
    const isFirstCha = !(await ChaMaster.count({ transaction }));
    if (values.isDefault || isFirstCha) {
      values.isDefault = true;
      await clearDefaultCha(transaction);
    }
    return ChaMaster.create(values, { transaction });
  });
}

export async function updateCha(id, body) {
  const values = chaValuesOf(body);
  const cha = await ChaMaster.findByPk(id);
  if (!cha) throw chaNotFound();
  await sequelize.transaction(async (transaction) => {
    if (values.isDefault) await clearDefaultCha(transaction);
    await cha.update(values, { transaction });
  });
  return cha;
}

/** Deleting the default CHA makes the oldest remaining one the default. */
export async function deleteCha(id) {
  const cha = await ChaMaster.findByPk(id);
  if (!cha) throw chaNotFound();
  await cha.destroy();
  if (!cha.isDefault) return;
  const nextCha = await ChaMaster.findOne({ order: [['id', 'ASC']] });
  if (nextCha) await nextCha.update({ isDefault: true });
}
