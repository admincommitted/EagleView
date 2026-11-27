import { userNameOf } from '../shared/hubHttp.js';
import { deleteVoucher, modifyVoucher, voucherAuditTrail } from './voucherChanges.service.js';

export async function changeVoucher(req, res) {
  await modifyVoucher(Number(req.params.id), req.body, userNameOf(req));
  res.json({ success: true, status: 'Pending' });
}

export async function removeVoucher(req, res) {
  await deleteVoucher(Number(req.params.id), userNameOf(req));
  res.json({ success: true });
}

export async function getVoucherAudit(req, res) {
  res.json(await voucherAuditTrail(req.params.id));
}
