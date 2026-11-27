import * as statusService from './status.service.js';

export async function listStatuses(req, res) {
  res.json({ success: true, data: await statusService.listStatuses(req.query) });
}

/** POST { code, mode?, ... } creates or updates by code ({ mode: 'create' } refuses an existing code). */
export async function saveStatus(req, res) {
  res.json(await statusService.saveStatus(req.body && req.body.code, req.body && req.body.mode, req.body));
}

export async function updateStatus(req, res) {
  res.json(await statusService.saveStatus(req.params.code, statusService.SAVE_MODES.update, req.body));
}

export async function deleteStatus(req, res) {
  await statusService.deleteStatus(req.params.code);
  res.json({ success: true });
}
