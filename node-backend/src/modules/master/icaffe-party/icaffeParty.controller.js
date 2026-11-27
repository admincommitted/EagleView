import * as icaffePartyService from './icaffeParty.service.js';

export async function directoryStats(req, res) {
  res.json(await icaffePartyService.directoryStats());
}

export async function searchDirectory(req, res) {
  res.json(await icaffePartyService.searchDirectory(req.query));
}

export async function directoryEntry(req, res) {
  res.json(await icaffePartyService.directoryEntry(req.params.id));
}

export async function importIntoPartyMaster(req, res) {
  res.json(await icaffePartyService.importIntoPartyMaster(req.params.id));
}
