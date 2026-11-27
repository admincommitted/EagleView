import { invoiceUserName } from '../shared/invoiceRequest.js';
import { cancelIrn, eInvoiceJsonFor, recordIrn } from './eInvoice.service.js';

export async function getEInvoiceJson(req, res) {
  res.json(await eInvoiceJsonFor(req.query.ids));
}

export async function saveIrn(req, res) {
  res.json(await recordIrn(req.params.id, req.body, invoiceUserName(req)));
}

export async function cancelInvoiceIrn(req, res) {
  res.json(await cancelIrn(req.params.id, req.body, invoiceUserName(req)));
}
