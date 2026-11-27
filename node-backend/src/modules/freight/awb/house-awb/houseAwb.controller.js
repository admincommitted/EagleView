import * as houseAwbService from './houseAwb.service.js';

export async function listLinkedHouses(req, res) {
  res.json(await houseAwbService.linkedHouses(req.params.masterAwbNumber));
}

export async function findHouseByNumber(req, res) {
  res.json(await houseAwbService.findHouseByNumber(req.query.awbNumber));
}

export async function linkHouseToMaster(req, res) {
  res.json(await houseAwbService.linkHouseToMaster(req.params.id, req.body, req.user));
}

export async function unlinkHouse(req, res) {
  res.json(await houseAwbService.unlinkHouse(req.params.id, req.body, req.user));
}
