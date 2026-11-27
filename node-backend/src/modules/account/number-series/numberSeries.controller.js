import { userNameOf } from '../shared/routeHandler.js';
import {
  createSeries,
  listNumberSeries,
  peekNextNumber,
  updateBranchCodes,
  updateSeries,
} from './numberSeries.service.js';

export async function listSeries(req, res) {
  res.json(await listNumberSeries(req.query.date));
}

export async function peekNumber(req, res) {
  res.json(await peekNextNumber(req.query));
}

export async function addSeries(req, res) {
  res.json(await createSeries(req.body, userNameOf(req)));
}

export async function changeSeries(req, res) {
  res.json(await updateSeries(req.params.id, req.body, userNameOf(req)));
}

export async function saveBranchCodes(req, res) {
  res.json(await updateBranchCodes(req.body));
}
