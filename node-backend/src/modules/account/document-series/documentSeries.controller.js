import { createRule, deleteRule, listRules, takeNumber, updateRule } from './documentSeries.service.js';

export async function listDocumentSeries(req, res) {
  res.json(await listRules(req.query));
}

export async function addDocumentSeries(req, res) {
  res.status(201).json(await createRule(req.body));
}

export async function changeDocumentSeries(req, res) {
  res.json(await updateRule(req.params.id, req.body));
}

export async function removeDocumentSeries(req, res) {
  res.json(await deleteRule(req.params.id));
}

export async function takeDocumentNumber(req, res) {
  res.json(await takeNumber(req.body));
}
