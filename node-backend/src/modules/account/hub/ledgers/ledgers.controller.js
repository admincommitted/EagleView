import { userNameOf } from '../shared/hubHttp.js';
import { createLedger, deleteLedger, getLedger, listLedgers, updateLedger } from './ledgers.service.js';
import { addLedgerChildren, deleteLedgerChild, updateLedgerChild } from './ledgerChildren.service.js';

export async function getLedgers(req, res) {
  res.json(await listLedgers(req.query));
}

export async function getOneLedger(req, res) {
  res.json(await getLedger(req.params.id));
}

export async function addLedger(req, res) {
  res.json(await createLedger(req.body, userNameOf(req)));
}

export async function changeLedger(req, res) {
  await updateLedger(Number(req.params.id), req.body, userNameOf(req));
  res.json({ success: true });
}

export async function removeLedger(req, res) {
  await deleteLedger(Number(req.params.id), userNameOf(req));
  res.json({ success: true });
}

export async function addChildren(req, res) {
  const added = await addLedgerChildren(Number(req.params.id), req.params.kind, req.body);
  res.json({ success: true, added });
}

export async function changeChild(req, res) {
  await updateLedgerChild(req.params.id, req.params.kind, req.params.cid, req.body);
  res.json({ success: true });
}

export async function removeChild(req, res) {
  await deleteLedgerChild(req.params.id, req.params.kind, req.params.cid);
  res.json({ success: true });
}
