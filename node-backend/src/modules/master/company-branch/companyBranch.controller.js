import * as companyBranchService from './companyBranch.service.js';

export async function listCompanyBranches(req, res) {
  res.json({ success: true, data: await companyBranchService.listCompanyBranches() });
}

export async function createCompanyBranch(req, res) {
  res.json({ success: true, data: await companyBranchService.createCompanyBranch(req.body) });
}

/** Kept for older screens: the save itself switches the default branch. */
export function resetDefaultBranch(req, res) {
  res.json({ success: true });
}

export async function updateCompanyBranch(req, res) {
  res.json({ success: true, data: await companyBranchService.updateCompanyBranch(req.params.id, req.body || {}) });
}

export async function deleteCompanyBranch(req, res) {
  await companyBranchService.deleteCompanyBranch(req.params.id);
  res.json({ success: true });
}
