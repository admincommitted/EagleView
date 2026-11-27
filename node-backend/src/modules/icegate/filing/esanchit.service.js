import fs from 'node:fs';
import path from 'node:path';
import { UPLOADS_DIR } from '../../../config/env.js';
import { BadRequestError } from '../../../core/http/index.js';
import { getIcegateConfig } from './filing.service.js';

export const ESANCHIT_ARCHIVE_DIR = path.join(UPLOADS_DIR, 'esanchit_archive');
const ARCHIVE_URL_PREFIX = '/uploads/esanchit_archive/';
const SAFE_NAME_LENGTH = 60;
const IRN_PATTERN = /^\d{16}$/;
const PDF_EXTENSION = '.pdf';

/** A file / folder name of letters, digits, . _ -; a name made only of dots / dashes ("..") is not a folder name. */
export function safeName(value, fallback) {
  const name = String(value || '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, SAFE_NAME_LENGTH);
  return !name || /^[._-]+$/.test(name) ? fallback : name;
}

/** PDFs are kept per job: uploads/esanchit_archive/<job no>/ */
export const archiveFolderName = (jobNo) => safeName(jobNo, 'misc');

/** <doc code>_<irn>_<time>_<original name>.pdf */
export function archiveFileName(formFields, originalName) {
  const fields = formFields || {};
  const original = safeName(path.basename(String(originalName || 'document.pdf'), PDF_EXTENSION), 'document');
  return `${safeName(fields.documentCode || fields.docCode, 'doc')}_${safeName(fields.irn, 'noirn')}_${Date.now()}_${original}.pdf`;
}

/** The name the signed copy of a PDF is downloaded with. */
export const signedDownloadName = (originalName) =>
  'signed_' +
  safeName(path.basename(String(originalName || 'document.pdf'), PDF_EXTENSION), 'document') +
  PDF_EXTENSION;

const archiveUrl = (formFields, fileName) =>
  ARCHIVE_URL_PREFIX + archiveFolderName(formFields && formFields.jobNo) + '/' + fileName;

/** POST /esanchit-archive: the PDF was kept with the job by the upload; answers where it is. */
export function describeArchivedPdf(uploadedFile, formFields) {
  if (!uploadedFile) throw new BadRequestError('PDF file is required');
  return { success: true, fileUrl: archiveUrl(formFields, uploadedFile.filename), fileName: uploadedFile.filename };
}

async function describeArchiveFile(folder, folderName, fileName) {
  const stats = await fs.promises.stat(path.join(folder, fileName));
  return {
    fileName,
    fileUrl: ARCHIVE_URL_PREFIX + folderName + '/' + fileName,
    size: stats.size,
    savedAt: stats.mtime,
  };
}

/** GET /esanchit-archive?jobNo=: the PDFs kept for a job. */
export async function listArchivedPdfs(jobNo) {
  const folderName = archiveFolderName(jobNo);
  const folder = path.join(ESANCHIT_ARCHIVE_DIR, folderName);
  let files;
  try {
    const pdfNames = (await fs.promises.readdir(folder)).filter((name) => /\.pdf$/i.test(name));
    files = await Promise.all(pdfNames.map((name) => describeArchiveFile(folder, folderName, name)));
  } catch {
    files = [];
  }
  return { success: true, data: files };
}

// the e-Sanchit portal upload (EsanchitUploader, Puppeteer) is not finished: unless ESANCHIT_AUTO_UPLOAD=1 the signed
// PDF is only kept in the archive and the user uploads it on e-Sanchit and types the real 16-digit IRN
const autoUploadEnabled = () => process.env.ESANCHIT_AUTO_UPLOAD === '1';

async function uploadThroughPortal(profileId, pdfPath, documentCode, fileUrl) {
  const config = await getIcegateConfig(profileId);
  // loaded only when used: it starts Puppeteer
  const { uploadToESanchit } = await import('../../../utils/customs/EsanchitUploader.js');
  const result = await uploadToESanchit(config.loginId, config.password, pdfPath, documentCode);
  if (result.success && IRN_PATTERN.test(String(result.irn || ''))) {
    return { success: true, irn: result.irn, drn: result.drn, message: result.message, fileUrl };
  }
  return {
    success: false,
    signedOnly: true,
    fileUrl,
    error:
      result.error || 'e-Sanchit did not return a 16-digit IRN - upload the signed PDF on the portal and enter the IRN',
  };
}

/** POST /upload-esanchit: the signed PDF stays in the job's archive; it goes to the portal only with auto upload on. */
export async function uploadSignedPdf(uploadedFile, formFields) {
  const { profileId, documentCode } = formFields;
  if (!documentCode) throw new BadRequestError('documentCode is required');
  if (!uploadedFile) throw new BadRequestError("Signed PDF file is required in 'pdf' field");
  const fileUrl = archiveUrl(formFields, uploadedFile.filename);
  if (!autoUploadEnabled()) {
    return {
      success: false,
      signedOnly: true,
      fileUrl,
      error:
        'Signed PDF saved. Upload it on the e-Sanchit portal (icegate.gov.in > e-Sanchit) and enter the IRN it gives.',
    };
  }
  return uploadThroughPortal(profileId, uploadedFile.path, documentCode, fileUrl);
}
