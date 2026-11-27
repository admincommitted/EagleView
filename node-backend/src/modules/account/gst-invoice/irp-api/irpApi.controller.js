import { invoiceUserName } from '../shared/invoiceRequest.js';
import { eInvoiceSettings, postToGstn, saveEInvoiceSettings } from './irpApi.service.js';

export async function getSettings(req, res) {
  res.json(await eInvoiceSettings());
}

export async function saveSettings(req, res) {
  res.json(await saveEInvoiceSettings(req.body));
}

export async function postInvoicesToGstn(req, res) {
  res.json(await postToGstn(req.body, invoiceUserName(req)));
}
