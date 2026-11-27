import * as tariffService from './tariff.service.js';

export async function bcdExemptions(req, res) {
  res.json(await tariffService.bcdExemptions(req.validated.params.ritc, req.query.origin));
}

export async function ftaConcessions(req, res) {
  res.json(await tariffService.ftaConcessions(req.validated.params.cth, req.query.origin));
}

export async function antiDumpingDuties(req, res) {
  res.json(await tariffService.antiDumpingDuties(req.validated.params.cth, req.query.origin));
}

export async function tariffLookup(req, res) {
  res.json(await tariffService.tariffLookup(req.validated.params.ritc));
}
