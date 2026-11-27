import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { UPLOADS_DIR } from '../../../config/env.js';

const MB = 1024 * 1024;
const MAX_FILES = 10;
const VOUCHER_DOCUMENTS_DIR = path.join(UPLOADS_DIR, 'vouchers');
const ALLOWED_DOCUMENT_TYPES =
  /^(application\/pdf|image\/(png|jpe?g|webp|gif|tiff)|application\/vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)|application\/msword|application\/vnd\.ms-excel|text\/csv|text\/plain)$/i;

const documentStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    if (!fs.existsSync(VOUCHER_DOCUMENTS_DIR)) fs.mkdirSync(VOUCHER_DOCUMENTS_DIR, { recursive: true });
    callback(null, VOUCHER_DOCUMENTS_DIR);
  },
  filename: (req, file, callback) => {
    callback(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname));
  },
});

/** Supporting documents of a voucher: PDF, images, Word, Excel, CSV or text, up to 10 files of 10 MB. */
export const voucherDocumentUpload = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * MB, files: MAX_FILES },
  fileFilter: (req, file, callback) => callback(null, ALLOWED_DOCUMENT_TYPES.test(file.mimetype)),
});

/** The GSTR-2B JSON file, kept in memory. */
export const gstr2bUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * MB, files: 1 } });

export const MAX_VOUCHER_DOCUMENTS = MAX_FILES;
