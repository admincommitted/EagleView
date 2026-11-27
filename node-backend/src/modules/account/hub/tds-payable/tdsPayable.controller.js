import { userNameOf } from '../shared/hubHttp.js';
import { addTdsChallan, deleteTdsChallan, tdsMonthDetail, tdsPayableSummary } from './tdsPayable.service.js';

export async function getTdsPayable(req, res) {
  res.json(await tdsPayableSummary(req.query.fyId));
}

export async function getTdsMonthDetail(req, res) {
  res.json(await tdsMonthDetail(String(req.query.month || ''), req.query.section));
}

export async function addChallan(req, res) {
  await addTdsChallan(req.body, userNameOf(req));
  res.json({ success: true });
}

export async function removeChallan(req, res) {
  await deleteTdsChallan(req.params.id);
  res.json({ success: true });
}
