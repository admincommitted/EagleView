import { userNameOf } from '../shared/hubHttp.js';
import { closeOrReopenJob, listJobs } from './jobClosing.service.js';

export async function getJobs(req, res) {
  res.json(await listJobs(req.query.q));
}

export async function closeJob(req, res) {
  await closeOrReopenJob(req.body, userNameOf(req));
  res.json({ success: true });
}
