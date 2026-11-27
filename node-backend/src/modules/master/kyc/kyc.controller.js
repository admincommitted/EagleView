import { publicBase } from '../../../utils/security/webSecurity.js';
import * as kycService from './kyc.service.js';

const FALLBACK_PORT = 5001;

/** The address in the e-mailed links: a configured one or the office LAN host, never a Host header a stranger sent. */
const kycLinkBase = (req) =>
  (process.env.PUBLIC_API_URL || publicBase(req) || `http://localhost:${process.env.PORT || FALLBACK_PORT}`).replace(
    /\/$/,
    '',
  );

export async function uploadKycDocuments(req, res) {
  const answer = await kycService.uploadKycDocuments(req.params.id, req.files, req.body?.documentType, () =>
    kycLinkBase(req),
  );
  res.json(answer);
}

export async function listKycDocuments(req, res) {
  res.json(await kycService.listKycDocuments(req.params.id));
}

export async function deleteKycDocument(req, res) {
  await kycService.deleteKycDocument(req.params.docId);
  res.json({ success: true });
}

export async function setKycDocumentStatus(req, res) {
  const result = await kycService.setKycDocumentStatus(req.params.docId, req.validated.body.status);
  if (!result) return res.status(404).json({ error: 'Document not found' });
  return res.json({ success: true, document: result.doc, partyKycStatus: result.partyStatus });
}

/** GET /api/kyc-action/:docId - the signed approve / reject link from the e-mail (no login); answers a small page. */
export async function publicKycAction(req, res) {
  try {
    const action = String(req.query.action || '').toUpperCase();
    const problem = kycService.kycLinkProblem({
      docId: req.params.docId,
      action,
      expiresAt: parseInt(req.query.exp, 10) || 0,
      signature: String(req.query.sig || ''),
    });
    if (problem) return res.status(problem.status).send(problem.message);
    const result = await kycService.setKycDocumentStatus(req.params.docId, action);
    if (!result) return res.status(404).send('Document not found');
    return res.send(kycService.kycResultPage(action, result));
  } catch {
    return res.status(500).send('Error updating status');
  }
}
