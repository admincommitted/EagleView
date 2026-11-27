import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { UPLOADS_DIR } from '../../../config/env.js';
import { asyncHandler } from '../../../core/http/index.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import {
  attachBill, attachPhoto, createAsset, discardAsset, listAssets, listExpiringWarranties, updateAsset,
} from './assets.controller.js';
import { createAssetSchema } from './assets.validation.js';

/** /api/assets - Asset Management (AssetManagement page, Dashboard warranty alerts). */
const ASSET_UPLOADS_DIR = path.join(UPLOADS_DIR, 'assets');
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const IMAGE_OR_PDF_RE = /^(image\/|application\/pdf)/;

const assetFileName = (req, file) => `asset_${req.params.id}_${Date.now()}`
  + path.extname(file.originalname || '').toLowerCase().replace(/[^.a-z0-9]/g, '');

// a file that is not an image or PDF is skipped (no error); the route then says the file is missing
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(ASSET_UPLOADS_DIR, { recursive: true });
      cb(null, ASSET_UPLOADS_DIR);
    },
    filename: (req, file, cb) => cb(null, assetFileName(req, file)),
  }),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => cb(null, IMAGE_OR_PDF_RE.test(file.mimetype || '')),
});

const router = Router();

router.get('/', asyncHandler(listAssets));
router.get('/alerts/expiring', asyncHandler(listExpiringWarranties));
router.post('/', validate({ body: createAssetSchema }, { errorBody: (message) => ({ error: message }) }), asyncHandler(createAsset));
router.put('/:id', asyncHandler(updateAsset));
router.post('/:id/discard', upload.single('photo'), asyncHandler(discardAsset));
router.post('/:id/bill', upload.single('bill'), asyncHandler(attachBill));
router.post('/:id/photo', upload.single('photo'), asyncHandler(attachPhoto));

export default router;
