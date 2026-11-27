import { Port } from '../../../models/index.js';

/** Job screens get the active ports only; the Port master screen asks for ?all=1 to show and re-activate the rest. */
export const listPorts = ({ all }) =>
  Port.findAll({ where: all ? {} : { isActive: true }, order: [['createdAt', 'DESC']] });

export const createPort = (body) => Port.create(body);

/** The port after the change (null when there is no such port). */
export async function updatePort(id, body) {
  await Port.update(body, { where: { id } });
  return Port.findByPk(id);
}

export const deletePort = (id) => Port.destroy({ where: { id } });
