import { Router } from 'express';
import multer from 'multer';
import { asyncHandler, BadRequestError } from '../../../core/http/index.js';
import { extractInvoiceData, testModel } from './aiExtractor.controller.js';

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

const isPdfOrPicture = (file) =>
  /\.(pdf|jpe?g|png|webp)$/i.test(file.originalname || '') || /^(application\/pdf|image\/)/.test(file.mimetype || '');

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_BYTES },
  fileFilter: (req, file, callback) =>
    callback(isPdfOrPicture(file) ? null : new BadRequestError('Only a PDF or a picture can be read'), true),
});

const router = Router();

router.post('/extract-invoice', documentUpload.single('pdf'), asyncHandler(extractInvoiceData));
router.post('/test', documentUpload.single('pdf'), asyncHandler(testModel));

export default router;
