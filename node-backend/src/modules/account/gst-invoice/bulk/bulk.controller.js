import { bulkCostSheets, bulkDockets, existingInvoicesForDocket, jobsForBulkInvoice } from './bulk.service.js';

export async function getJobs(req, res) {
  res.json(await jobsForBulkInvoice(req.query));
}

export async function getBulkDockets(req, res) {
  res.json(await bulkDockets(req.query));
}

export async function getBulkCost(req, res) {
  res.json(await bulkCostSheets(req.body));
}

export async function getExisting(req, res) {
  res.json(await existingInvoicesForDocket(req.query));
}
