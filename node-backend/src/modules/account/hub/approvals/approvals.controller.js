import { listApprovals } from './approvals.service.js';

export async function getApprovals(req, res) {
  res.json(await listApprovals(String(req.query.state || 'pending')));
}
