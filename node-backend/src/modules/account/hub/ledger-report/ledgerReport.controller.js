import { buildLedgerReport } from './ledgerReport.service.js';

export async function getLedgerReport(req, res) {
  res.json(await buildLedgerReport(req.query));
}
