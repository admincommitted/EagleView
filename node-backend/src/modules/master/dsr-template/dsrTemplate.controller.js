import * as dsrTemplateService from './dsrTemplate.service.js';

export async function listTemplates(req, res) {
  res.json({ success: true, data: await dsrTemplateService.listTemplates() });
}

export async function saveTemplate(req, res) {
  res.json(await dsrTemplateService.saveTemplate(req.body));
}

export async function deleteTemplate(req, res) {
  const deletedCount = await dsrTemplateService.deleteTemplate(req.params.id);
  res.status(deletedCount ? 200 : 404).json({ success: !!deletedCount });
}
