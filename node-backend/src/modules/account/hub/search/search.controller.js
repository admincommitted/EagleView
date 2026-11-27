import { searchAccounts } from './search.service.js';

export async function search(req, res) {
  res.json(await searchAccounts(req.query.q));
}
