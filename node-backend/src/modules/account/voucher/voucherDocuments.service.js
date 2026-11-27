import fs from 'node:fs';
import path from 'node:path';
import { BACKEND_ROOT } from '../../../config/env.js';
import { BadRequestError, NotFoundError } from '../../../core/http/index.js';
import { Voucher, VoucherDocument } from '../../../models/index.js';

const MAX_DRAFT_KEY_LENGTH = 60;
const MAX_DOCUMENT_TYPE_LENGTH = 40;
const PUBLIC_FOLDER = '/uploads/vouchers/';

const failure = (ErrorClass, message) => new ErrorClass(message, { body: { success: false, error: message } });
const voucherNotFound = (voucherId) => failure(NotFoundError, 'Voucher ' + voucherId + ' not found');

/**
 * Stores the uploaded supporting documents of a voucher. A voucher not saved yet parks its files under a draft key
 * and claims them once it has an id.
 */
export async function saveVoucherDocuments(body, files, uploader) {
  const voucherId = body.voucherId ? parseInt(body.voucherId, 10) : null;
  const draftKey = body.draftKey ? String(body.draftKey).slice(0, MAX_DRAFT_KEY_LENGTH) : null;
  if (!voucherId && !draftKey) throw failure(BadRequestError, 'Either a voucher id or a draft key is needed');
  if (voucherId && !(await Voucher.findByPk(voucherId))) throw voucherNotFound(voucherId);
  const uploaded = files || [];
  if (!uploaded.length) {
    throw failure(BadRequestError, 'No file came through. PDF, image, Word, Excel, CSV or text, up to 10 MB each.');
  }
  const rows = [];
  for (const file of uploaded) {
    rows.push(
      await VoucherDocument.create({
        voucherId,
        draftKey,
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        filePath: PUBLIC_FOLDER + file.filename,
        size: file.size,
        documentType: String(body.documentType || 'SUPPORTING')
          .toUpperCase()
          .slice(0, MAX_DOCUMENT_TYPE_LENGTH),
        uploadedBy: uploader.id,
        uploadedByName: uploader.name,
      }),
    );
  }
  return { success: true, data: rows };
}

// hands a draft's files to the voucher that was just saved
export async function claimDraftDocuments({ draftKey, voucherId }) {
  const voucher = await Voucher.findByPk(voucherId);
  if (!voucher) throw voucherNotFound(voucherId);
  const [claimed] = await VoucherDocument.update(
    { voucherId, draftKey: null },
    { where: { draftKey: String(draftKey) } },
  );
  return { success: true, claimed };
}

export async function listVoucherDocuments(query) {
  const where = {};
  if (query.voucherId) where.voucherId = parseInt(query.voucherId, 10);
  else where.draftKey = String(query.draftKey);
  const rows = await VoucherDocument.findAll({ where, order: [['id', 'ASC']] });
  return { success: true, data: rows };
}

export async function deleteVoucherDocument(id) {
  const document = await VoucherDocument.findByPk(id);
  if (!document) throw failure(NotFoundError, 'Attachment not found');
  const absolutePath = path.join(BACKEND_ROOT, document.filePath.replace(/^\//, ''));
  try {
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
  } catch {
    // the row must go even if the file is already gone
  }
  await document.destroy();
  return { success: true };
}
