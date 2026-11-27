import * as printDocumentsService from './printDocuments.service.js';

const fullNameOf = (user) => (user ? String(user.fullName || user.username || '').trim() : '');

export async function consolManifest(req, res) {
  const preparedBy = req.user ? req.user.fullName || req.user.username || '' : '';
  res.json(await printDocumentsService.buildConsolManifest(req.params.masterAwbNumber, preparedBy));
}

export async function documentData(req, res) {
  res.json(await printDocumentsService.buildDocumentData(req.params.type, req.params.id, fullNameOf(req.user)));
}

export async function generateAwbPdf(req, res) {
  const { fileName, pdf } = await printDocumentsService.renderAwbPdf(req.body || {});
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Content-Length': pdf.length,
  });
  res.send(pdf);
}
