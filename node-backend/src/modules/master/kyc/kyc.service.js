import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { BACKEND_ROOT } from '../../../config/env.js';
import { NotFoundError } from '../../../core/http/index.js';
import { JWT_SECRET } from '../../../middlewares/auth.middleware.js';
import { Party, PartyDocument } from '../../../models/index.js';
import { sendMail } from '../../../utils/integrations/mailer.js';

/*
 * KYC approval:
 * - from the e-mail: GET /api/kyc-action/:docId?action=APPROVED|REJECTED&exp=...&sig=... (signed, no login, mounted
 *   before the login check); links are valid 14 days, links without exp only until KYC_LEGACY_UNTIL;
 * - from the screen: PUT /api/masters/party/kyc/:docId/status { status } (admin);
 * - the party's kycStatus / kycApproved follow its documents.
 */
const KYC_LINK_VALID_SECONDS = 14 * 86400;
const KYC_LEGACY_UNTIL = Date.parse('2026-12-01T00:00:00+05:30');
const SIGNATURE_LENGTH = 32;
const KYC_MAIL_FROM = '"EDI Automation System" <no-reply@committedcargo.com>';
const KYC_APPROVER_EMAIL = 'acctshead@committedgroup.com';
export const LINK_ACTIONS = ['APPROVED', 'REJECTED'];

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

/** HMAC of the link; old links had no expiry in the signed text. */
const kycSignature = (docId, action, expiresAt) =>
  crypto
    .createHmac('sha256', JWT_SECRET)
    .update(expiresAt ? `kyc:${docId}:${action}:${expiresAt}` : `kyc:${docId}:${action}`)
    .digest('hex')
    .slice(0, SIGNATURE_LENGTH);

/** All approved = APPROVED, any rejected = REJECTED, else (or no documents) PENDING; saved on the party. */
async function refreshKycStatus(partyId) {
  const documents = await PartyDocument.findAll({ where: { partyId } });
  const statuses = documents.map((document) => String(document.docStatus || 'PENDING').toUpperCase());
  let status = 'PENDING';
  if (documents.length && statuses.includes('REJECTED')) status = 'REJECTED';
  else if (documents.length && statuses.every((docStatus) => docStatus === 'APPROVED')) status = 'APPROVED';
  await Party.update({ kycStatus: status, kycApproved: status === 'APPROVED' }, { where: { id: partyId } });
  return status;
}

/** Sets one document's status; null when the document does not exist. */
export async function setKycDocumentStatus(docId, status) {
  const doc = await PartyDocument.findByPk(docId);
  if (!doc) return null;
  await doc.update({ docStatus: status });
  const partyStatus = await refreshKycStatus(doc.partyId);
  return { doc, partyStatus };
}

function kycApprovalMailHtml(party, uploadedDocs, kycLink) {
  return `
                        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                            <div style="background-color: #0284c7; padding: 25px; text-align: center; color: white;">
                                <h2 style="margin: 0; font-size: 24px; letter-spacing: 1px;">KYC Document Approval</h2>
                            </div>
                            <div style="padding: 30px; background-color: #ffffff;">
                                <p style="font-size: 16px;">Dear Anil Gupta,</p>
                                <p style="font-size: 15px; line-height: 1.5;">New KYC documents have been uploaded for the following party and require your review:</p>
                                
                                <table style="width: 100%; border-collapse: collapse; margin: 25px 0; background-color: #f8fafc; border-radius: 6px; overflow: hidden;">
                                    <tr>
                                        <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; color: #475569; width: 120px;"><strong>Party Name:</strong></td>
                                        <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a; font-size: 16px;">${escapeHtml(party.name)}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; color: #475569;"><strong>Country Code:</strong></td>
                                        <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${escapeHtml(party.countryCode || 'N/A')}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; color: #475569;"><strong>Uploaded Docs:</strong></td>
                                        <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${uploadedDocs.length} file(s)</td>
                                    </tr>
                                </table>
                                
                                <p style="font-size: 15px; line-height: 1.5; margin-bottom: 25px;">Please review the attached documents and approve/reject them individually below:</p>
                                
                                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                                    <tr style="background-color: #f1f5f9;">
                                        <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left;">Document Type</th>
                                        <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left;">File Name</th>
                                        <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">Action</th>
                                    </tr>
                                    ${uploadedDocs
                                      .map(
                                        (doc) => `
                                        <tr>
                                            <td style="padding: 10px; border: 1px solid #cbd5e1;">${escapeHtml(doc.documentType)}</td>
                                            <td style="padding: 10px; border: 1px solid #cbd5e1;">${escapeHtml(doc.originalName)}</td>
                                            <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">
                                                <a href="${kycLink(doc.id, 'APPROVED')}" style="background-color: #16a34a; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 12px; margin-right: 5px;">APPROVE</a>
                                                <a href="${kycLink(doc.id, 'REJECTED')}" style="background-color: #dc2626; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 12px;">REJECT</a>
                                            </td>
                                        </tr>
                                    `,
                                      )
                                      .join('')}
                                </table>
                            </div>
                            <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
                                <p style="margin: 0; line-height: 1.5;">This is an automated message from the EDI Automation System.<br/>Please do not reply to this email.</p>
                            </div>
                        </div>
                    `;
}

async function sendKycApprovalMail(mailOptions) {
  try {
    const info = await sendMail(mailOptions);
    console.log('KYC Email sent:', info.messageId);
  } catch (error) {
    console.error('Error sending KYC email:', error);
  }
}

/** Marks the party's KYC pending and mails the approver signed approve / reject links (not awaited). */
async function requestKycApproval(party, uploadedDocs, linkBase) {
  await Party.update({ kycStatus: 'PENDING', kycLastSentAt: new Date() }, { where: { id: party.id } });
  party.kycStatus = 'PENDING';

  const attachments = uploadedDocs.map((doc) => ({
    filename: doc.originalName,
    path: path.join(BACKEND_ROOT, doc.filePath),
  }));
  const base = linkBase();
  const expiresAt = Math.floor(Date.now() / 1000) + KYC_LINK_VALID_SECONDS;
  const kycLink = (docId, action) =>
    `${base}/api/kyc-action/${docId}?action=${action}&exp=${expiresAt}&sig=${kycSignature(docId, action, expiresAt)}`;

  sendKycApprovalMail({
    from: KYC_MAIL_FROM,
    to: KYC_APPROVER_EMAIL,
    subject: `Action Required: KYC Approval for ${party.name}`,
    html: kycApprovalMailHtml(party, uploadedDocs, kycLink),
    attachments,
  });
}

/**
 * POST /party/:id/kyc: saves the uploaded files as the party's KYC documents and asks for approval by e-mail.
 * A failure while preparing the e-mail is logged; the upload still answers success.
 */
export async function uploadKycDocuments(partyId, files, documentType, linkBase) {
  const party = await Party.findByPk(partyId);
  if (!party) throw new NotFoundError('Party not found', { body: { error: 'Party not found' } });

  const uploadedDocs = [];
  for (const file of files || []) {
    uploadedDocs.push(
      await PartyDocument.create({
        partyId,
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        filePath: `/uploads/kyc/${file.filename}`,
        size: file.size,
        documentType: documentType || 'OTHER',
      }),
    );
  }

  if (uploadedDocs.length > 0) {
    try {
      await requestKycApproval(party, uploadedDocs, linkBase);
    } catch (mailError) {
      console.error('Failed to prepare email:', mailError);
    }
  }
  return { success: true, documents: uploadedDocs };
}

export const listKycDocuments = (partyId) => PartyDocument.findAll({ where: { partyId } });

/** Deletes a KYC document and its file; the party's KYC status follows the remaining documents. */
export async function deleteKycDocument(docId) {
  const doc = await PartyDocument.findByPk(docId);
  if (!doc) throw new NotFoundError('Document not found', { body: { error: 'Document not found' } });

  const fullPath = path.join(BACKEND_ROOT, doc.filePath);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

  await doc.destroy();
  try {
    await refreshKycStatus(doc.partyId);
  } catch {
    // the status is set again at the next approval
  }
}

/** Why an e-mailed KYC link cannot be used ({ status, message }), or null when it is good. */
export function kycLinkProblem({ docId, action, expiresAt, signature }) {
  if (!LINK_ACTIONS.includes(action)) return { status: 400, message: 'Invalid action' };
  if (expiresAt && expiresAt * 1000 < Date.now()) {
    return { status: 410, message: 'This KYC link has expired. Please open the party in EagleView ERP.' };
  }
  if (!expiresAt && Date.now() > KYC_LEGACY_UNTIL) {
    return { status: 410, message: 'This KYC link is too old. Please open the party in EagleView ERP.' };
  }
  const expected = kycSignature(docId, action, expiresAt);
  const signatureMatches =
    signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!signatureMatches)
    return { status: 403, message: 'This KYC link is not valid. Please open the party in EagleView ERP.' };
  return null;
}

/** The page the approver sees after clicking approve / reject in the e-mail. */
export function kycResultPage(action, result) {
  const ok = action === 'APPROVED';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>KYC ${action}</title></head>
<body style="font-family:Arial,sans-serif;text-align:center;padding:50px;background:#f3f4f6">
<div style="background:#fff;display:inline-block;padding:36px 44px;border-radius:14px;box-shadow:0 10px 25px rgba(0,0,0,.08)">
<div style="font-size:60px;color:${ok ? '#16a34a' : '#dc2626'}">${ok ? '&#10004;' : '&#10008;'}</div>
<h1 style="color:${ok ? '#16a34a' : '#dc2626'}">Document ${ok ? 'Approved' : 'Rejected'}</h1>
<p style="font-size:16px;color:#333">${escapeHtml(result.doc.originalName)} is now <b>${action}</b>.</p>
<p style="color:#555">Party KYC status: <b>${result.partyStatus}</b></p>
<p style="color:#888;margin-top:24px">You can close this window.</p></div></body></html>`;
}
