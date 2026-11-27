import * as chaService from './cha.service.js';

export async function listChas(req, res) {
  res.json({ success: true, data: await chaService.listChas() });
}

export async function createCha(req, res) {
  res.json({ success: true, data: await chaService.createCha(req.body) });
}

/** Kept for older screens: the save itself switches the default CHA. */
export function resetDefaultCha(req, res) {
  res.json({ success: true });
}

export async function updateCha(req, res) {
  res.json({ success: true, data: await chaService.updateCha(req.params.id, req.body || {}) });
}

export async function deleteCha(req, res) {
  await chaService.deleteCha(req.params.id);
  res.json({ success: true });
}
