import {
  amendmentChanges,
  amendmentCodes,
  amendmentFileDownload,
  createAmendment,
  ensureAmendmentStore,
  getAmendment,
  getAmendmentSettings,
  listAmendments,
  listAmendmentsOfJob,
  makeAmendmentFile,
  markAmendmentSubmitted,
  recordIcegateReply,
  saveAmendmentMailTo,
  sendAmendmentFile,
  signAmendmentFile,
  updateAmendment,
  voidAmendment,
} from './beAmendment.service.js';

const whoIs = (req) => (req.user && (req.user.username || req.user.email)) || '';
const bodyOf = (req) => req.body || {};

/** Every route needs the BeAmendments table and its number series. */
export async function ensureAmendmentTable(req, res, next) {
  await ensureAmendmentStore();
  next();
}

export function listCodes(req, res) {
  res.json({ success: true, data: amendmentCodes() });
}

export async function getSettings(req, res) {
  res.json(await getAmendmentSettings());
}

export async function saveSettings(req, res) {
  res.json({ success: true, mailTo: await saveAmendmentMailTo(bodyOf(req).mailTo) });
}

export async function listRegister(req, res) {
  res.json(await listAmendments(req.query || {}));
}

export async function listOfJob(req, res) {
  res.json(await listAmendmentsOfJob(req.params.jobId));
}

export async function getOne(req, res) {
  res.json({ success: true, data: await getAmendment(req.params.id) });
}

export async function create(req, res) {
  res.json(await createAmendment(bodyOf(req), whoIs(req)));
}

export async function update(req, res) {
  res.json({ success: true, data: await updateAmendment(req.params.id, bodyOf(req), whoIs(req)) });
}

export async function changes(req, res) {
  res.json(await amendmentChanges(req.params.id));
}

export async function makeFile(req, res) {
  res.json(await makeAmendmentFile(req.params.id, bodyOf(req), whoIs(req)));
}

export async function downloadFile(req, res) {
  const file = await amendmentFileDownload(req.params.id, req.query.kind);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
  res.send(file.content);
}

export async function signFile(req, res) {
  res.json(await signAmendmentFile(req.params.id, String(bodyOf(req).pin || ''), whoIs(req)));
}

export async function sendFile(req, res) {
  res.json(await sendAmendmentFile(req.params.id, whoIs(req)));
}

export async function markSubmitted(req, res) {
  res.json({ success: true, data: await markAmendmentSubmitted(req.params.id, bodyOf(req).mode, whoIs(req)) });
}

export async function recordReply(req, res) {
  const { status, text } = bodyOf(req);
  res.json({ success: true, data: await recordIcegateReply(req.params.id, { status, text }, whoIs(req)) });
}

export async function voidOne(req, res) {
  res.json({ success: true, data: await voidAmendment(req.params.id, bodyOf(req).reason, whoIs(req)) });
}
