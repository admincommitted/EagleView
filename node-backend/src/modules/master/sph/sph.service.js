import { Op } from 'sequelize';
import { BadRequestError, ConflictError, NotFoundError } from '../../../core/http/index.js';
import { SphMaster } from '../../../models/index.js';
import { normaliseSphCode, normaliseSphDescription, sphProblem } from './sph.validation.js';

const notFound = () => new NotFoundError('SPH code not found', { body: { error: 'SPH code not found' } });
const alreadyExists = (code) =>
  new ConflictError(`SPH Code ${code} already exists`, { body: { error: `SPH Code ${code} already exists` } });

export const listSphMaster = () => SphMaster.findAll({ order: [['code', 'ASC']] });

/** The SPH list for the AWB screens: the active codes of the SPH master. */
export const listActiveSpecialHandlingCodes = () =>
  SphMaster.findAll({
    where: { isActive: true },
    attributes: ['id', 'code', 'description', 'category'],
    order: [['code', 'ASC']],
  });

/** body already checked by createSphSchema (code upper-cased, description trimmed). */
export async function createSph({ code, description, category, isActive }) {
  if (await SphMaster.findOne({ where: { code: code.toUpperCase() } })) throw alreadyExists(code);
  const item = await SphMaster.create({
    code: code.toUpperCase(),
    description: description.toUpperCase(),
    category: (category || '').toUpperCase(),
    isActive: isActive !== false,
  });
  return { message: 'SPH Code created', item };
}

/** A field left out of the body keeps its saved value. */
export async function updateSph(id, body) {
  const item = await SphMaster.findByPk(id);
  if (!item) throw notFound();
  const { category, isActive } = body;
  const code = normaliseSphCode(body.code || item.code);
  const description = normaliseSphDescription(body.description || item.description);
  const problem = sphProblem(code, description);
  if (problem) throw new BadRequestError(problem, { body: { error: problem } });
  if (await SphMaster.findOne({ where: { code, id: { [Op.ne]: item.id } } })) throw alreadyExists(code);
  await item.update({
    code,
    description: description.toUpperCase(),
    category: category !== undefined ? String(category || '').toUpperCase() : item.category,
    isActive: isActive !== undefined ? !!isActive : item.isActive,
  });
  return { message: 'SPH Code updated', item };
}

export async function deleteSph(id) {
  const item = await SphMaster.findByPk(id);
  if (!item) throw notFound();
  await item.destroy();
  return { message: 'SPH Code deleted' };
}
