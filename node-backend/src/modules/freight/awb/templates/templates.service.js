import { ApiError } from '../../../../core/http/index.js';
import { AwbTemplate } from '../../../../models/index.js';
import { notFound } from '../shared/awbErrors.js';
import { templateNameOf, templateTypeOf } from './templates.validation.js';

const MAX_TEMPLATE_TEXT = 200000;

function templateDataOf(row) {
  try {
    return JSON.parse(row.data || '{}');
  } catch {
    return {}; // a row that is not JSON opens empty
  }
}

/** SAVE AS TEMPLATE / TEMPLATE list on the AWB, MAWB and HAWB screens. */
export async function listTemplates(typeParam) {
  const type = templateTypeOf(typeParam);
  await AwbTemplate.sync();
  const rows = await AwbTemplate.findAll({ where: { awbType: type }, order: [['name', 'ASC']] });
  return {
    success: true,
    data: rows.map((row) => ({
      name: row.name,
      data: templateDataOf(row),
      createdBy: row.createdBy,
      updatedAt: row.updatedAt,
    })),
  };
}

export async function saveTemplate(typeParam, nameParam, data, user) {
  const type = templateTypeOf(typeParam);
  const name = templateNameOf(nameParam);
  const text = JSON.stringify(data);
  if (text.length > MAX_TEMPLATE_TEXT) {
    throw new ApiError(413, 'Template is too big', { body: { error: 'Template is too big' } });
  }
  await AwbTemplate.sync();
  const existing = await AwbTemplate.findOne({ where: { awbType: type, name } });
  if (existing) await existing.update({ data: text, createdBy: user?.username || existing.createdBy || 'System' });
  else await AwbTemplate.create({ awbType: type, name, data: text, createdBy: user?.username || 'System' });
  return { success: true, name, replaced: !!existing };
}

export async function deleteTemplate(typeParam, nameParam) {
  const deleted = await AwbTemplate.destroy({
    where: { awbType: templateTypeOf(typeParam), name: templateNameOf(nameParam) },
  });
  if (!deleted) throw notFound({ error: 'Template not found' });
  return { success: true };
}
