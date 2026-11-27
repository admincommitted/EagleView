import * as financialYearService from './financialYear.service.js';

export async function listFinancialYears(req, res) {
  res.json({ success: true, data: await financialYearService.listFinancialYears() });
}

export async function createFinancialYear(req, res) {
  res.json({ success: true, data: await financialYearService.createFinancialYear(req.body) });
}

export async function updateFinancialYear(req, res) {
  res.json({ success: true, data: await financialYearService.updateFinancialYear(req.params.id, req.body || {}) });
}

export async function deleteFinancialYear(req, res) {
  await financialYearService.deleteFinancialYear(req.params.id);
  res.json({ success: true });
}
