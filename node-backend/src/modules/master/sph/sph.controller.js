import * as sphService from './sph.service.js';

export async function listSphMaster(req, res) {
  res.json(await sphService.listSphMaster());
}

export async function listSpecialHandlingCodes(req, res) {
  res.json(await sphService.listActiveSpecialHandlingCodes());
}

export async function createSph(req, res) {
  res.json(await sphService.createSph(req.validated.body));
}

export async function updateSph(req, res) {
  res.json(await sphService.updateSph(req.params.id, req.body));
}

export async function deleteSph(req, res) {
  res.json(await sphService.deleteSph(req.params.id));
}
