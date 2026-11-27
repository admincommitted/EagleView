import {
  accountTree,
  createGroup,
  createLedger,
  deleteGroup,
  deleteLedger,
  seedGroups,
  updateGroup,
  updateLedger,
} from './accountList.service.js';

export async function seedDefaultGroups(req, res) {
  res.json(await seedGroups());
}

export async function getAccountTree(req, res) {
  res.json(await accountTree());
}

export async function addGroup(req, res) {
  res.json(await createGroup(req.body));
}

export async function addLedger(req, res) {
  res.json(await createLedger(req.body));
}

export async function changeGroup(req, res) {
  res.json(await updateGroup(req.params.id, req.body));
}

export async function removeGroup(req, res) {
  res.json(await deleteGroup(req.params.id));
}

export async function changeLedger(req, res) {
  res.json(await updateLedger(req.params.id, req.body));
}

export async function removeLedger(req, res) {
  res.json(await deleteLedger(req.params.id));
}
