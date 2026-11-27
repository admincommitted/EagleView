import * as dutyListService from './dutyList.service.js';

export async function listCounts(req, res) {
  res.json(await dutyListService.listCounts());
}

export async function listRows(req, res) {
  res.json(await dutyListService.listRows(req.params.kind, req.query));
}

export async function addRow(req, res) {
  res.status(201).json(await dutyListService.addRow(req.params.kind, req.body || {}));
}

export async function setRowActive(req, res) {
  res.json(await dutyListService.setRowActive(req.params.kind, req.params.id, req.body && req.body.isActive));
}

export async function updateRow(req, res) {
  res.json(await dutyListService.updateRow(req.params.kind, req.params.id, req.body || {}));
}
