import { invoiceUserName } from '../shared/invoiceRequest.js';
import { provisionalSheet, saveProvisionalSheet } from './provisionalSheet.service.js';

export async function getProvisionalSheet(req, res) {
  res.json(await provisionalSheet(req.query.jobNo));
}

export async function putProvisionalSheet(req, res) {
  res.json(await saveProvisionalSheet(req.body, invoiceUserName(req)));
}
