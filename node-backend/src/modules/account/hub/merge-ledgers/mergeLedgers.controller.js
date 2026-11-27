import { userNameOf } from '../shared/hubHttp.js';
import { mergeLedgers } from './mergeLedgers.service.js';

export async function merge(req, res) {
  const role = req.user && req.user.role;
  const fromId = Number(req.body && req.body.fromId);
  const toId = Number(req.body && req.body.toId);
  const merged = await mergeLedgers(fromId, toId, { role, userName: userNameOf(req) });
  res.json({ ok: true, ...merged });
}
