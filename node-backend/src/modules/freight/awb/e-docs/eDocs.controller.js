import * as eDocsService from './eDocs.service.js';

export async function uploadDocuments(req, res) {
  res.json(await eDocsService.saveUploadedDocuments(req.params.tempId, req.body, req.files));
}

export async function extractDocumentData(req, res) {
  res.json(await eDocsService.extractDocumentData(req.params.docId));
}

export async function listDocuments(req, res) {
  res.json(await eDocsService.listDocuments(req.params.tempId, req.query));
}

/** Plain-text answers: the pouch reads 'Deleted' / 'Not found'. */
export async function deleteDocument(req, res) {
  const deleted = await eDocsService.deleteDocument(req.params.id);
  if (!deleted) return res.status(404).send('Not found');
  return res.send('Deleted');
}
