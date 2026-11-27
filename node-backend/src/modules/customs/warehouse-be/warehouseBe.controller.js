import {
  getWarehouseBalances,
  getWarehouseJobWithBalances,
  listExBondJobs,
  listWarehouseJobs,
} from './warehouseBe.service.js';

export async function listWarehouseBes(req, res) {
  const { iecCode, importerName, customsPort, excludeJobId } = req.query;
  const data = await listWarehouseJobs({ iecCode, importerName, customsPort, excludeJobId });
  res.json({ success: true, count: data.length, data });
}

export async function getBalances(req, res) {
  const data = await getWarehouseBalances(req.params.whJobId, req.query.excludeJobId);
  res.json({ success: true, data });
}

export async function getWarehouseJob(req, res) {
  const data = await getWarehouseJobWithBalances(req.params.id, req.query.excludeJobId);
  res.json({ success: true, data });
}

export async function getExBonds(req, res) {
  const data = await listExBondJobs(req.params.whJobId);
  res.json({ success: true, data });
}
