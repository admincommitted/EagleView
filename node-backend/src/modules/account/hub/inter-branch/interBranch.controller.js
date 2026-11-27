import { userNameOf } from '../shared/hubHttp.js';
import {
  acceptTransfer,
  branchBalances,
  listActiveBranches,
  listTransfers,
  raiseTransfer,
  returnTransfer,
} from './interBranch.service.js';

export async function getBranches(req, res) {
  res.json(await listActiveBranches());
}

export async function getTransfers(req, res) {
  res.json(await listTransfers(req.query));
}

export async function raise(req, res) {
  const raised = await raiseTransfer(req.body || {}, userNameOf(req));
  res.json({ success: true, ...raised });
}

export async function accept(req, res) {
  const accepted = await acceptTransfer(req.params.id, req.body || {}, userNameOf(req));
  res.json({ success: true, ...accepted });
}

export async function giveBack(req, res) {
  const reversed = await returnTransfer(req.params.id, req.body, userNameOf(req));
  res.json({ success: true, ...reversed });
}

export async function getBranchBalances(req, res) {
  res.json(await branchBalances());
}
