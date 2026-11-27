import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { UPLOADS_DIR } from '../../../config/env.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { adminOnly } from '../shared/adminOnly.middleware.js';
import { routeHandler } from '../shared/errorAnswers.js';
import { deleteKycDocument, listKycDocuments, setKycDocumentStatus, uploadKycDocuments } from './kyc.controller.js';
import { kycErrorBody, kycStatusSchema } from './kyc.validation.js';

const KYC_UPLOAD_DIR = path.join(UPLOADS_DIR, 'kyc');
const MAX_KYC_FILE_BYTES = 10 * 1024 * 1024;
const MAX_KYC_FILES = 10;
const KYC_FILE_TYPES = /^(application\/pdf|image\/(png|jpe?g|webp|gif|tiff))$/i;
const RANDOM_NAME_RANGE = 1e9;

// KYC uploads: PDF / images only, 10 MB each
const kycUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      if (!fs.existsSync(KYC_UPLOAD_DIR)) fs.mkdirSync(KYC_UPLOAD_DIR, { recursive: true });
      cb(null, KYC_UPLOAD_DIR);
    },
    filename(req, file, cb) {
      cb(null, `${Date.now()}-${Math.round(Math.random() * RANDOM_NAME_RANGE)}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: MAX_KYC_FILE_BYTES, files: MAX_KYC_FILES },
  fileFilter: (req, file, cb) => cb(null, KYC_FILE_TYPES.test(file.mimetype)),
});

const uploadFailedAnswer = (error) => {
  console.error(error);
  return { status: 500, body: { error: error.message } };
};

const router = Router();

router.post(
  '/party/:id/kyc',
  kycUpload.array('docs', MAX_KYC_FILES),
  routeHandler(uploadKycDocuments, uploadFailedAnswer),
);
router.get('/party/:id/kyc', routeHandler(listKycDocuments));
router.delete('/party/kyc/:docId', routeHandler(deleteKycDocument));
router.put(
  '/party/kyc/:docId/status',
  adminOnly('Only an admin can approve KYC'),
  validate({ body: kycStatusSchema }, { errorBody: kycErrorBody }),
  routeHandler(setKycDocumentStatus),
);

export default router;
