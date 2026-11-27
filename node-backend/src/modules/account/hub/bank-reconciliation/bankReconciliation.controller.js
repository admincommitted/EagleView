import { bankReconciliation } from './bankReconciliation.service.js';

export async function getBankReconciliation(req, res) {
  res.json(await bankReconciliation(req.query));
}
