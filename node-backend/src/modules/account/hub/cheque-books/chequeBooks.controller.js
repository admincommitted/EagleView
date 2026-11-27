import { userNameOf } from '../shared/hubHttp.js';
import { listChequeBooks, listChequeLeaves, markChequeLeaf } from './chequeBooks.service.js';

export async function getChequeBooks(req, res) {
  res.json(await listChequeBooks());
}

export async function getChequeLeaves(req, res) {
  res.json(await listChequeLeaves(req.params.id));
}

export async function changeChequeLeaf(req, res) {
  await markChequeLeaf(req.params.id, req.params.no, req.body, userNameOf(req));
  res.json({ success: true });
}
