import { getAccountsDashboard } from './dashboard.service.js';

export async function getDashboard(req, res) {
  res.json(await getAccountsDashboard({ fyId: req.query.fyId, refresh: req.query.refresh, user: req.user }));
}
