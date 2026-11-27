import { Op } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { BadRequestError, NotFoundError } from '../../../core/http/index.js';
import { TariffComponent, TariffHeader } from '../../../models/index.js';
import { cleanBody } from '../shared/cleanBody.js';

const DEFAULT_LIST_LIMIT = 5000;
const MAX_LIST_LIMIT = 20000;
const HSN_PATTERN = /^\d{8}$/;
const HSN_MESSAGE = 'HSN / CTH must be 8 digits';
// a search text without digits must not match every HSN code
const NO_HSN_MATCH = '__none__';

const failed = (ErrorClass, message) => new ErrorClass(message, { body: { error: message } });

function tariffSearchWhere(text) {
  if (!text) return undefined;
  const digits = text.replace(/\D/g, '');
  return {
    [Op.or]: [
      { hsnCode: { [Op.like]: digits ? `${text.replace(/[^0-9]/g, '')}%` : NO_HSN_MATCH } },
      { description: { [Op.like]: `%${text}%` } },
    ],
  };
}

/** GET /tariffheaders/all?q=&limit= (HSN or description), so a full tariff (~12,000 lines) is not sent every time. */
export function listTariffHeaders({ q, limit }) {
  const text = String(q || '').trim();
  return TariffHeader.findAll({
    where: tariffSearchWhere(text),
    include: [{ model: TariffComponent, as: 'components' }],
    order: [['hsnCode', 'ASC']],
    limit: Math.min(parseInt(limit, 10) || DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT),
  });
}

export async function createTariffHeader(body) {
  const header = cleanBody(TariffHeader, body);
  if (!HSN_PATTERN.test(String(header.hsnCode || '').trim())) throw failed(BadRequestError, HSN_MESSAGE);
  return TariffHeader.create(header);
}

export async function updateTariffHeader(id, body) {
  const changes = cleanBody(TariffHeader, body);
  if (changes.hsnCode !== undefined && !HSN_PATTERN.test(String(changes.hsnCode).trim()))
    throw failed(BadRequestError, HSN_MESSAGE);
  delete changes.components;
  await TariffHeader.update(changes, { where: { id } });
  const header = await TariffHeader.findByPk(id);
  if (!header) throw failed(NotFoundError, 'Tariff line not found');
  return header;
}

/** A tariff line goes with its duty lines. */
export async function deleteTariffHeader(id) {
  await sequelize.transaction(async (transaction) => {
    await TariffComponent.destroy({ where: { tariffHeaderId: id }, transaction });
    await TariffHeader.destroy({ where: { id }, transaction });
  });
}

export async function createTariffComponent(body) {
  const component = cleanBody(TariffComponent, body);
  if (!component.tariffHeaderId) throw failed(BadRequestError, 'Choose the tariff line first');
  return TariffComponent.create(component);
}

export async function updateTariffComponent(id, body) {
  const component = await TariffComponent.findByPk(id);
  if (!component) throw failed(NotFoundError, 'Duty line not found');
  await component.update(cleanBody(TariffComponent, body));
  return component;
}

export const deleteTariffComponent = (id) => TariffComponent.destroy({ where: { id } });
