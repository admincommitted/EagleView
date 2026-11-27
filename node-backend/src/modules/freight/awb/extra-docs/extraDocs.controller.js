import * as extraDocsService from './extraDocs.service.js';

export async function readExtraDocument(req, res) {
  const { type, id, docType } = req.params;
  res.json(await extraDocsService.readExtraDocument(type, id, docType));
}

export async function saveExtraDocument(req, res) {
  const { type, id, docType } = req.params;
  res.json(await extraDocsService.saveExtraDocument(type, id, docType, req.body, req.user));
}
