import * as portService from './port.service.js';

export async function listPorts(req, res) {
  res.json(await portService.listPorts(req.query));
}

export async function createPort(req, res) {
  res.status(201).json(await portService.createPort(req.body));
}

export async function updatePort(req, res) {
  res.json(await portService.updatePort(req.params.id, req.body));
}

export async function deletePort(req, res) {
  await portService.deletePort(req.params.id);
  res.json({ success: true });
}
