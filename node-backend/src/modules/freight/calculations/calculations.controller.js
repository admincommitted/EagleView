import { calculateDrawback } from './calculations.service.js';

export async function drawback(req, res) {
  res.json(await calculateDrawback(req.body));
}
