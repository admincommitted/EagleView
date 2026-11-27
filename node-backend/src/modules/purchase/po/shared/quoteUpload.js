import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { UPLOADS_DIR } from '../../../../config/env.js';

/** The vendor's quotation attached to a purchase order: documents and pictures only, up to 20 MB, in uploads/po. */
const PO_UPLOADS_DIR = path.join(UPLOADS_DIR, 'po');
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_FILE_RE = /\.(pdf|jpe?g|png|webp|gif|bmp|tiff?|docx?|xlsx?|csv|txt|zip|msg|eml)$/i;
const HTTP_BAD_REQUEST = 400;

if (!fs.existsSync(PO_UPLOADS_DIR)) fs.mkdirSync(PO_UPLOADS_DIR, { recursive: true });

const notAllowedFileError = () =>
  Object.assign(new Error('Only PDF, picture, Word, Excel, CSV, text or ZIP files can be attached'), {
    status: HTTP_BAD_REQUEST,
  });

export const quoteUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, PO_UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
  }),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => cb(ALLOWED_FILE_RE.test(file.originalname || '') ? null : notAllowedFileError(), true),
});

export const quoteFileUrl = (file) => (file ? '/uploads/po/' + file.filename : null);
