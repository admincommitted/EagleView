import { listYearMonths, setMonthClosed } from './monthClosing.service.js';

const closerNameOf = (req) => (req.user && (req.user.name || req.user.username || req.user.email)) || '';

export async function listMonths(req, res) {
  res.json(await listYearMonths(req.query.fyId));
}

export async function changeMonthState(req, res) {
  await setMonthClosed(req.params.ym, req.params.action, closerNameOf(req));
  res.json({ ok: true });
}
