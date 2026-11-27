import { invoiceUserName } from '../shared/invoiceRequest.js';
import { invoiceContact, invoicePdf, mailInvoice, whatsappInvoice } from './sending.service.js';

export async function sendPdf(req, res) {
  const { pdf, fileName } = await invoicePdf(req.params.id, req.body);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', 'inline; filename="' + fileName + '"');
  res.send(pdf);
}

export async function getContact(req, res) {
  res.json(await invoiceContact(req.params.id));
}

export async function sendMail(req, res) {
  res.json(await mailInvoice(req.params.id, req.body, invoiceUserName(req)));
}

export async function sendWhatsapp(req, res) {
  res.json(await whatsappInvoice(req.params.id, req.body, invoiceUserName(req)));
}
