import { readVendorBill } from './ocrBill.service.js';

export async function readBill(req, res) {
  res.json(await readVendorBill(req.file));
}
