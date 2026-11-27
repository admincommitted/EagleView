import * as partyService from './party.service.js';

export { publicKycAction } from '../kyc/kyc.controller.js';

const PARTY_OR_KYC_PATH = /part|kyc/i;

/** Any write to a party / KYC path of /api/masters throws the cached full party list away. */
export function clearPartyCacheOnWrite(req, res, next) {
  if (req.method !== 'GET' && PARTY_OR_KYC_PATH.test(req.path)) partyService.clearPartyCache();
  next();
}

export async function searchParties(req, res) {
  res.json(await partyService.searchParties(req.query));
}

export async function findParties(req, res) {
  res.json(await partyService.findParties(req.query));
}

export async function activateParty(req, res) {
  res.json(await partyService.activateParty(req.params.id));
}

export async function createParty(req, res) {
  const party = await partyService.createParty(req.validated.body, req.body);
  res.status(201).json({ success: true, data: party });
}
