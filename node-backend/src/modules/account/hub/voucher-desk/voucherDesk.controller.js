import {
  ensureTaxLedgers,
  getVoucherDetails,
  listLedgersInGroups,
  listVoucherTypes,
  listVouchers,
} from './voucherDesk.service.js';

export async function getVoucherTypes(req, res) {
  res.json(await listVoucherTypes());
}

// X-More: 1 tells the screen the list was cut at 500
export async function getVouchers(req, res) {
  const { rows, hasMore } = await listVouchers(req.query);
  if (hasMore) res.set('X-More', '1');
  res.json(rows);
}

export async function getVoucher(req, res) {
  res.json(await getVoucherDetails(req.params.id));
}

export async function createTaxLedgers(req, res) {
  res.json(await ensureTaxLedgers());
}

export async function getLedgersInGroups(req, res) {
  res.json(await listLedgersInGroups(req.query));
}
