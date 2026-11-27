import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { UPLOADS_DIR } from '../../../../config/env.js';

const AWB_UPLOAD_DIR = path.join(UPLOADS_DIR, 'awb');
const MAX_FILE_SIZE_MB = 15;
const MAX_FILES = 10;

/**
 * Documents and pictures only, 15 MB each, 10 per upload: the files are served from /uploads on the same site, so an
 * .html / .svg / .js upload would run in the user's browser.
 */
const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.tif',
  '.tiff',
  '.gif',
  '.bmp',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.txt',
  '.msg',
  '.eml',
];

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    if (!fs.existsSync(AWB_UPLOAD_DIR)) fs.mkdirSync(AWB_UPLOAD_DIR, { recursive: true });
    callback(null, AWB_UPLOAD_DIR);
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + extension);
  },
});

function fileFilter(req, file, callback) {
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(extension)) return callback(null, true);
  const error = new Error(
    `${file.originalname}: file type ${extension || '(none)'} is not allowed (PDF, pictures, Word, Excel, CSV, text, e-mail)`,
  );
  error.code = 'BAD_TYPE';
  return callback(error);
}

const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, files: MAX_FILES }, fileFilter });

function uploadErrorMessage(error) {
  if (error.code === 'LIMIT_FILE_SIZE') return 'A file is larger than 15 MB';
  if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') return 'Up to 10 files at a time';
  return error.message;
}

/** The `docs` files of the e-documents pouch; upload problems answer 400 { error } for the window. */
export const awbDocsUpload = (req, res, next) =>
  upload.array('docs', MAX_FILES)(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({ error: uploadErrorMessage(error) });
  });
