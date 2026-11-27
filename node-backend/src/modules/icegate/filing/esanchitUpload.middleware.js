import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { ESANCHIT_ARCHIVE_DIR, archiveFileName, archiveFolderName } from './esanchit.service.js';

const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024;
const PDF_MAGIC = '%PDF-';

const looksLikePdf = (file) =>
  /pdf$/i.test(String(file.mimetype || '')) || /\.pdf$/i.test(String(file.originalname || ''));

const pdfFilter = (refusal) => (req, file, callback) => {
  const accepted = looksLikePdf(file);
  callback(accepted ? null : new Error(refusal), accepted);
};

// the form fields jobNo / docCode / irn must come BEFORE the pdf part: multer reads them in stream order
const archiveStorage = multer.diskStorage({
  destination(req, file, callback) {
    const folder = path.join(ESANCHIT_ARCHIVE_DIR, archiveFolderName(req.body && req.body.jobNo));
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    callback(null, folder);
  },
  filename(req, file, callback) {
    callback(null, archiveFileName(req.body, file.originalname));
  },
});

/** A document PDF kept with the job in uploads/esanchit_archive/<job no>/. */
export const archivePdfUpload = multer({
  storage: archiveStorage,
  limits: { fileSize: MAX_PDF_SIZE_BYTES },
  fileFilter: pdfFilter('Only PDF files can be attached (e-Sanchit takes PDF only)'),
});

/** The signing relay keeps the PDF in memory: nothing written, no stray folder in the archive. */
export const signPdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_SIZE_BYTES },
  fileFilter: pdfFilter('Only PDF files can be signed (e-Sanchit takes PDF only)'),
});

/** multer's own refusals (type / size) as a JSON answer. */
export function uploadErrorAnswer(error, req, res, next) {
  if (!error) return next();
  return res.status(400).json({ success: false, error: error.message || 'Upload failed' });
}

function startsWithPdfMagic(filePath) {
  const descriptor = fs.openSync(filePath, 'r');
  const head = Buffer.alloc(PDF_MAGIC.length);
  fs.readSync(descriptor, head, 0, PDF_MAGIC.length, 0);
  fs.closeSync(descriptor);
  return head.toString('latin1') === PDF_MAGIC;
}

/** The written file must really be a PDF (%PDF- header); anything else is deleted again. */
export function requirePdfContent(req, res, next) {
  if (!req.file) return next();
  try {
    if (!startsWithPdfMagic(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // already gone
      }
      return res.status(400).json({ success: false, error: 'The file is not a PDF (header check failed)' });
    }
  } catch {
    return res.status(400).json({ success: false, error: 'Could not read the uploaded file' });
  }
  return next();
}
