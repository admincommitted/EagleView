import * as tariffHeaderService from './tariffHeader.service.js';

const DELETED = { message: 'Deleted' };

export async function listTariffHeaders(req, res) {
  res.json(await tariffHeaderService.listTariffHeaders(req.query));
}

export async function createTariffHeader(req, res) {
  res.status(201).json(await tariffHeaderService.createTariffHeader(req.body));
}

export async function updateTariffHeader(req, res) {
  res.json(await tariffHeaderService.updateTariffHeader(req.params.id, req.body));
}

export async function deleteTariffHeader(req, res) {
  await tariffHeaderService.deleteTariffHeader(req.params.id);
  res.json(DELETED);
}

export async function createTariffComponent(req, res) {
  res.status(201).json(await tariffHeaderService.createTariffComponent(req.body));
}

export async function updateTariffComponent(req, res) {
  res.json(await tariffHeaderService.updateTariffComponent(req.params.id, req.body));
}

export async function deleteTariffComponent(req, res) {
  await tariffHeaderService.deleteTariffComponent(req.params.id);
  res.json(DELETED);
}
