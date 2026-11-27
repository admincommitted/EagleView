import { invoiceUserName } from '../shared/invoiceRequest.js';
import {
  createInvoice,
  deleteInvoice,
  invoiceById,
  invoiceByNumber,
  invoiceByVoucher,
  previewInvoice,
  searchInvoices,
  updateInvoice,
  voidInvoice,
} from './salesInvoice.service.js';

export async function search(req, res) {
  const { more, rows } = await searchInvoices(req.query);
  if (more) res.set('X-More', '1');
  res.json(rows);
}

export async function getByVoucher(req, res) {
  res.json(await invoiceByVoucher(req.params.vid));
}

export async function getByNumber(req, res) {
  res.json(await invoiceByNumber(req.query.no));
}

export async function getInvoice(req, res) {
  res.json(await invoiceById(req.params.id));
}

export async function preview(req, res) {
  res.json(await previewInvoice(req.body));
}

export async function create(req, res) {
  res.json(await createInvoice(req.body, invoiceUserName(req)));
}

export async function update(req, res) {
  res.json(await updateInvoice(req.params.id, req.body, invoiceUserName(req)));
}

export async function remove(req, res) {
  res.json(await deleteInvoice(req.params.id, invoiceUserName(req)));
}

export async function markVoid(req, res) {
  res.json(await voidInvoice(req.params.id, req.body, invoiceUserName(req)));
}
