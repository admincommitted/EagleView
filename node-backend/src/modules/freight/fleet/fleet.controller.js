import * as fleetService from './fleet.service.js';

export async function listLorryReceipts(req, res) {
  res.json(await fleetService.listLorryReceipts(req.query));
}

export async function nextLrNo(req, res) {
  res.json({ success: true, lrNo: await fleetService.nextLrNo() });
}

export async function formMasters(req, res) {
  res.json(await fleetService.formMasters());
}

export async function createLorryReceipt(req, res) {
  res.json(await fleetService.createLorryReceipt(req.body || {}, req.user));
}

export async function updateLorryReceipt(req, res) {
  res.json(await fleetService.updateLorryReceipt(req.params.id, req.body || {}));
}

export async function postDriverAdvance(req, res) {
  res.json(await fleetService.postDriverAdvance(req.params.id, req.body || {}, req.user));
}

export async function deleteLorryReceipt(req, res) {
  res.json(await fleetService.deleteLorryReceipt(req.params.id));
}
