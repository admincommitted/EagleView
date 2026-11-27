import {
  addStandardTdsSections,
  createTdsNature,
  deleteTdsNature,
  listTdsSchedule,
  updateTdsNature,
} from './tdsSchedule.service.js';

export async function getTdsSchedule(req, res) {
  res.json(await listTdsSchedule());
}

export async function addTdsNature(req, res) {
  await createTdsNature(req.body);
  res.json({ success: true });
}

export async function changeTdsNature(req, res) {
  await updateTdsNature(req.params.id, req.body);
  res.json({ success: true });
}

export async function removeTdsNature(req, res) {
  await deleteTdsNature(req.params.id);
  res.json({ success: true });
}

export async function addStandardSections(req, res) {
  res.json({ added: await addStandardTdsSections() });
}
