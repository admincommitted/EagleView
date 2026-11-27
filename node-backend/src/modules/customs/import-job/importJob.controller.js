import {
  deleteImportJob,
  digitsOf,
  findJobsByBeNo,
  getFiledJson,
  getImportJob,
  getImportJobByJobNo,
  getImportJobLogs,
  readJobFromFile,
  searchImportJobs,
  suggestPins,
  updateDsrField,
} from './importJob.service.js';
import { saveImportJob } from './importJobSave.service.js';
import { patchImportItems } from './importJobItemsPatch.service.js';
import { listImportJobs } from './importJobList.service.js';
import { importItemHistory } from './importJobItemHistory.service.js';
import { buildSampleBeFile } from './importJobSample.service.js';

export async function saveJob(req, res) {
  res.json(await saveImportJob(req.body, { user: req.user }));
}

export async function patchItems(req, res) {
  res.json(await patchImportItems(req.params.id, req.body, req.user));
}

export async function filedJson(req, res) {
  res.json({ success: true, data: await getFiledJson(req.params.id) });
}

/**
 * A file that cannot be read answers 400; the save itself answers as POST / does (its errors are not turned into
 * 400s: they go on to the error handler).
 */
export async function importFromFile(req, res, next) {
  const { payload, allowNoInBond, importMessage } = await readJobFromFile(req.body);
  let answer;
  try {
    answer = await saveImportJob(payload, { user: req.user, allowNoInBond, importMessage });
  } catch (error) {
    return next(error);
  }
  return res.json(answer);
}

export async function listJobs(req, res) {
  res.json(await listImportJobs(req.query || {}));
}

export async function deleteJob(req, res) {
  await deleteImportJob(req.params.id);
  res.json({ success: true, message: 'Job deleted successfully' });
}

export async function jobLogs(req, res) {
  res.json(await getImportJobLogs(req.params.id));
}

export async function editDsrField(req, res) {
  const { field, value } = req.body || {};
  await updateDsrField(req.params.id, { field, value }, req.user);
  res.json({ success: true });
}

export async function searchJobs(req, res) {
  res.json({ success: true, data: await searchImportJobs(req.query.q) });
}

export async function downloadSample(req, res) {
  const sample = await buildSampleBeFile(req.params.kind);
  res.attachment(sample.fileName);
  res.type(sample.contentType).send(sample.content);
}

export async function pinSuggestions(req, res) {
  const { iec, branchSrNo, address1, jobId, state } = req.query;
  res.json({ success: true, data: await suggestPins({ iec, branchSrNo, address1, jobId, state }) });
}

export async function jobsByBeNo(req, res) {
  res.json({ success: true, data: await findJobsByBeNo(digitsOf(req.query.beNo), req.query.beDate) });
}

export async function itemHistory(req, res) {
  res.json(await importItemHistory(req.query));
}

export async function getJob(req, res) {
  res.json({ success: true, data: await getImportJob(req.params.id) });
}

export async function getJobByJobNo(req, res) {
  res.json({ success: true, data: await getImportJobByJobNo(req.params.jobNo) });
}
