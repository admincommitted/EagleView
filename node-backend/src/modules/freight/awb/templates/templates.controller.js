import * as templatesService from './templates.service.js';

export async function listTemplates(req, res) {
  res.json(await templatesService.listTemplates(req.params.type));
}

export async function saveTemplate(req, res) {
  const { type, name } = req.params;
  res.json(await templatesService.saveTemplate(type, name, req.body.data, req.user));
}

export async function deleteTemplate(req, res) {
  res.json(await templatesService.deleteTemplate(req.params.type, req.params.name));
}
