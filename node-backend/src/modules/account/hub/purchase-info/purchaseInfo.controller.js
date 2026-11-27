import { userNameOf } from '../shared/hubHttp.js';
import {
  getPurchaseInfo,
  listHeldBills,
  listVendorBills,
  savePurchaseInfo,
  setPaymentHold,
} from './purchaseInfo.service.js';

export async function getBillInfo(req, res) {
  res.json(await getPurchaseInfo(req.params.id));
}

export async function saveBillInfo(req, res) {
  await savePurchaseInfo(Number(req.params.id), req.body || {}, userNameOf(req));
  res.json({ success: true });
}

export async function holdOrReleasePayment(req, res) {
  const holdPayment = await setPaymentHold(Number(req.params.id), req.body, userNameOf(req));
  res.json({ success: true, holdPayment });
}

export async function getHeldBills(req, res) {
  res.json(await listHeldBills(Number(req.query.ledgerId)));
}

export async function getVendorBills(req, res) {
  res.json(await listVendorBills(Number(req.query.ledgerId)));
}
