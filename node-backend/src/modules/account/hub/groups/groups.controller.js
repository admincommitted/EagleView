import { createGroup, deleteGroup, listGroupTree, updateGroup } from './groups.service.js';

export async function getGroupTree(req, res) {
  res.json(await listGroupTree());
}

export async function addGroup(req, res) {
  res.json(await createGroup(req.body));
}

export async function changeGroup(req, res) {
  await updateGroup(Number(req.params.id), req.body);
  res.json({ success: true });
}

export async function removeGroup(req, res) {
  await deleteGroup(Number(req.params.id));
  res.json({ success: true });
}
