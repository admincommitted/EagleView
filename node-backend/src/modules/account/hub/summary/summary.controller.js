import { buildAccountsSummary } from './summary.service.js';

export async function getSummary(req, res) {
  res.json(await buildAccountsSummary(req.query.fyId));
}
