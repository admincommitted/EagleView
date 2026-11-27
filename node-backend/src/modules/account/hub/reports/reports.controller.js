import { companyHead, runReport } from './reports.service.js';

export async function getCompanyHead(req, res) {
  res.json(await companyHead());
}

export async function getReport(req, res) {
  res.json(await runReport(req.params.name, req.query));
}
