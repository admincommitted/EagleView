import {
  createMasterRow,
  deleteMasterRow,
  describeMaster,
  listMasterKinds,
  listMasterRows,
  updateMasterRow,
} from './masters.service.js';

export const listMasters = (req, res) => res.json(listMasterKinds());

export const getMasterMeta = (req, res) => res.json(describeMaster(req.params.kind));

export async function listRows(req, res) {
  res.json(await listMasterRows(req.params.kind));
}

export async function createRow(req, res) {
  await createMasterRow(req.params.kind, req.body || {});
  res.status(201).json({ ok: true });
}

export async function updateRow(req, res) {
  await updateMasterRow(req.params.kind, req.params.id, req.body || {});
  res.json({ ok: true });
}

export async function deleteRow(req, res) {
  await deleteMasterRow(req.params.kind, req.params.id);
  res.json({ ok: true });
}
