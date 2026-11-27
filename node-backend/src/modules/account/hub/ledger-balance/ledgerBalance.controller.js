import { ledgerWithBalance } from './ledgerBalance.service.js';

export async function getLedgerBalance(req, res) {
  res.json(await ledgerWithBalance(req.params.id));
}
