import { DsrTemplate } from '../../../models/index.js';

const NUMERIC_ID = /^\d+$/;

/** A saved template as the screen reads it: the config fields spread out, then the template's own columns. */
function templateForScreen(template) {
  let config = {};
  try {
    config = JSON.parse(template.config || '{}') || {};
  } catch {
    config = {};
  }
  return {
    ...config,
    id: template.id,
    name: template.name,
    module: template.module,
    client: template.client,
    clientRole: template.clientRole,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

export async function listTemplates() {
  const templates = await DsrTemplate.findAll({ order: [['id', 'ASC']] });
  return templates.map(templateForScreen);
}

/** A numeric id updates that template; a temporary id ('new_...') or none creates one. Other fields are its config. */
export async function saveTemplate(body) {
  const { id, name, module, client, clientRole, createdAt: _createdAt, updatedAt: _updatedAt, ...config } = body || {};
  const values = {
    name: String(name).trim(),
    module: module || 'IMPORT',
    client: client || 'ALL',
    clientRole: clientRole || null,
    config: JSON.stringify(config),
  };
  const existing = NUMERIC_ID.test(String(id || '')) ? await DsrTemplate.findByPk(id) : null;
  const template = existing ? await existing.update(values) : await DsrTemplate.create(values);
  return {
    success: true,
    message: existing ? 'Template updated' : 'Template saved',
    data: templateForScreen(template),
  };
}

export const deleteTemplate = (id) => DsrTemplate.destroy({ where: { id } });
