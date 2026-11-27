import {
  deleteExportJob,
  getExportJob,
  getExportJobLogs,
  listExportJobs,
  peekNextExportJobNo,
  saveExportJob,
  saveSbNo,
} from './exportJob.service.js';

export async function nextSequence(req, res) {
  const { branchId, shipmentMode, financialYearId } = req.query;
  res.json({ success: true, nextJobNo: await peekNextExportJobNo({ branchId, shipmentMode, financialYearId }) });
}

export async function saveJob(req, res) {
  res.json(await saveExportJob(req.body, req.user));
}

export async function getJob(req, res) {
  res.json({ success: true, data: await getExportJob(req.params.id) });
}

export async function listJobs(req, res) {
  res.json(await listExportJobs(req.query));
}

export async function jobLogs(req, res) {
  res.json(await getExportJobLogs(req.params.id));
}

export async function updateSbNo(req, res) {
  res.json({ success: true, data: await saveSbNo(req.params.id, req.body) });
}

export async function deleteJob(req, res) {
  await deleteExportJob(req.params.id, { force: req.query.force, user: req.user });
  res.json({ success: true, message: 'Job deleted successfully' });
}
