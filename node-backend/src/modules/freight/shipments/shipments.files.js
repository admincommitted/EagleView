import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { UPLOADS_DIR } from '../../../config/env.js';
import { badRequest, docketNotFound, notFound } from './shipments.errors.js';
import { ensureShipmentTables, execute, selectRows } from './shipments.tables.js';

/**
 * Upload Docs (iCAFFE "Upload Docs" on the docket): the files land in uploads/shipments (behind the same login as the
 * other upload folders), a row each in ShipmentFiles. A removed file is moved to uploads/shipments/_removed, not erased.
 */
const SHIPMENT_UPLOAD_DIR = path.join(UPLOADS_DIR, 'shipments');
const REMOVED_FILES_DIR = path.join(SHIPMENT_UPLOAD_DIR, '_removed');
const MAX_FILE_SIZE_MB = 15;
const MAX_FILES = 10;
const MAX_DOC_TYPE_LENGTH = 60;
const ALLOWED_MIME_TYPES =
  /^(application\/pdf|image\/(png|jpe?g|webp|gif|tiff)|application\/vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)|application\/msword|application\/vnd\.ms-excel|text\/csv|text\/plain|message\/rfc822|application\/vnd\.ms-outlook)$/i;

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      if (!fs.existsSync(SHIPMENT_UPLOAD_DIR)) fs.mkdirSync(SHIPMENT_UPLOAD_DIR, { recursive: true });
      callback(null, SHIPMENT_UPLOAD_DIR);
    },
    filename: (req, file, callback) =>
      callback(
        null,
        Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname).toLowerCase(),
      ),
  }),
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, files: MAX_FILES },
  // a file of another type is left out (the answer then says no file came through)
  fileFilter: (req, file, callback) => callback(null, ALLOWED_MIME_TYPES.test(file.mimetype)),
});

/** The `files` of the Upload Docs window. */
export const shipmentFilesUpload = upload.array('files', MAX_FILES);

export async function listFiles(shipmentId) {
  await ensureShipmentTables();
  return selectRows('SELECT * FROM ShipmentFiles WHERE shipmentId = ? ORDER BY id DESC', [shipmentId]);
}

export async function saveUploadedFiles(shipmentId, body, files, user) {
  await ensureShipmentTables();
  const docket = (await selectRows('SELECT id FROM Shipments WHERE id = ?', [shipmentId]))[0];
  if (!docket) throw docketNotFound();
  const uploaded = files || [];
  if (!uploaded.length)
    throw badRequest('No file came through. PDF, image, Word, Excel, CSV, text or mail, up to 15 MB each.');
  const now = new Date().toISOString();
  const fields = body || {};
  for (const file of uploaded) {
    await execute(
      'INSERT INTO ShipmentFiles (shipmentId, docType, fileName, originalName, mimeType, filePath, size, remarks, uploadedBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [
        docket.id,
        String(fields.docType || 'OTHER')
          .toUpperCase()
          .slice(0, MAX_DOC_TYPE_LENGTH),
        file.filename,
        file.originalname,
        file.mimetype,
        '/uploads/shipments/' + file.filename,
        file.size,
        String(fields.remarks || '') || null,
        user,
        now,
        now,
      ],
    );
  }
  return { ok: true, count: uploaded.length };
}

function moveToRemoved(fileName) {
  try {
    if (!fs.existsSync(REMOVED_FILES_DIR)) fs.mkdirSync(REMOVED_FILES_DIR, { recursive: true });
    fs.renameSync(path.join(SHIPMENT_UPLOAD_DIR, fileName), path.join(REMOVED_FILES_DIR, fileName));
  } catch {
    /* already gone */
  }
}

export async function removeFile(shipmentId, fileId) {
  await ensureShipmentTables();
  const file = (
    await selectRows('SELECT * FROM ShipmentFiles WHERE id = ? AND shipmentId = ?', [Number(fileId), shipmentId])
  )[0];
  if (!file) throw notFound('File not found');
  moveToRemoved(file.fileName);
  await execute('DELETE FROM ShipmentFiles WHERE id = ?', [file.id]);
  return { ok: true };
}
