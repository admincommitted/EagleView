import { buildFinancialStatement } from './finStatement.service.js';

export async function getFinancialStatement(req, res) {
  res.json(await buildFinancialStatement(req.query));
}
