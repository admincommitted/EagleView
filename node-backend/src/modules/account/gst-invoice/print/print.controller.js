import { invoiceQr, printData } from './print.service.js';

export async function getPrintData(req, res) {
  res.json(await printData(req.params.id));
}

export async function getQr(req, res) {
  res.json(await invoiceQr(req.params.id));
}
