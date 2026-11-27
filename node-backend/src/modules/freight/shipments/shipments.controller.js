import { docketOfJob, registerDocketFromJob, syncDocketWithJob } from './shipments.customs.js';
import { listFiles, removeFile, saveUploadedFiles } from './shipments.files.js';
import { lookup, partyFromDirectory } from './shipments.lookup.js';
import { sendStatusMail, statusMail } from './shipments.mail.js';
import * as shipmentsService from './shipments.service.js';

/** Who did it: the signed-in user's name, else the X-User-Name header; null when neither. */
const actorOf = (req) =>
  (req.user && (req.user.fullName || req.user.name || req.user.username)) || req.headers['x-user-name'] || null;

export async function meta(req, res) {
  res.json(await shipmentsService.meta());
}

export async function nextNumber(req, res) {
  res.json(await shipmentsService.nextNumber(req.query));
}

export async function updateSeries(req, res) {
  res.json(await shipmentsService.updateSeries(req.body || {}));
}

export async function lookupMaster(req, res) {
  res.json(await lookup(req.params.what, req.query));
}

export async function copyPartyFromDirectory(req, res) {
  res.json(await partyFromDirectory((req.body || {}).icaffeId));
}

export async function searchDockets(req, res) {
  const { dockets, hasMore } = await shipmentsService.searchDockets(req.query);
  if (hasMore) res.set('X-More', '1');
  res.json(dockets);
}

export async function docketByNumber(req, res) {
  res.json(await shipmentsService.docketByNumber(req.query.no));
}

export async function docketWithInvoices(req, res) {
  res.json(await shipmentsService.docketWithInvoices(req.params.id));
}

export async function createDocket(req, res) {
  res.json(await shipmentsService.createDocket(req.body || {}, actorOf(req)));
}

export async function updateDocket(req, res) {
  res.json(await shipmentsService.updateDocket(req.params.id, req.body || {}, actorOf(req)));
}

export async function deleteDocket(req, res) {
  res.json(await shipmentsService.deleteDocket(req.params.id, req.body, actorOf(req)));
}

export async function duplicateDocket(req, res) {
  res.json(await shipmentsService.duplicateDocket(req.params.id));
}

export async function changeStage(req, res) {
  res.json(await shipmentsService.changeStage(req.body || {}, actorOf(req)));
}

export async function listEvents(req, res) {
  res.json(await shipmentsService.listEvents(req.params.id));
}

export async function saveEvent(req, res) {
  res.json(await shipmentsService.saveEvent(req.params.id, req.body || {}, actorOf(req)));
}

export async function deleteEvent(req, res) {
  res.json(await shipmentsService.deleteEvent(req.params.id, req.params.eid));
}

export async function saveDocumentList(req, res) {
  res.json(await shipmentsService.saveDocumentList(req.params.id, req.body, actorOf(req)));
}

export async function dueDates(req, res) {
  res.json(await shipmentsService.dueDates(req.query));
}

export async function listDocketFiles(req, res) {
  res.json(await listFiles(req.params.id));
}

export async function uploadDocketFiles(req, res) {
  res.json(await saveUploadedFiles(req.params.id, req.body, req.files, actorOf(req)));
}

export async function removeDocketFile(req, res) {
  res.json(await removeFile(req.params.id, req.params.fid));
}

export async function readStatusMail(req, res) {
  res.json(await statusMail(req.params.id));
}

export async function sendDocketStatusMail(req, res) {
  res.json(await sendStatusMail(req.params.id, req.body || {}, actorOf(req)));
}

export async function docketOfCustomsJob(req, res) {
  res.json(await docketOfJob(req.query.jobNo));
}

export async function registerFromCustomsJob(req, res) {
  res.json(await registerDocketFromJob(req.body || {}, actorOf(req)));
}

export async function syncCustomsMilestones(req, res) {
  res.json(await syncDocketWithJob(req.params.id, actorOf(req)));
}
