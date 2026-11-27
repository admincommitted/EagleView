import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../../core/http/index.js';
import * as signerQueue from './signerQueue.controller.js';

// EagleView Signer, the DSC tool on each user's PC: what waits to be signed, the signed files back, e-Sanchit IRNs.
// Every call answers only for the divisions (Import / Export) the user has rights for.
const MAX_SIGNED_PDF_BYTES = 12 * 1024 * 1024;

const router = Router();
const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SIGNED_PDF_BYTES } });

const failure = (logLabel) => ({ errorBody: signerQueue.failureBody(logLabel) });

router.get('/queue', asyncHandler(signerQueue.listSigningQueue, failure('[signer queue]')));
router.post(
  '/esanchit',
  pdfUpload.single('pdf'),
  asyncHandler(signerQueue.saveSignedPdf, failure('[signer esanchit]')),
);
router.get('/amend/:id', asyncHandler(signerQueue.getAmendmentFileToSign, failure()));
router.post('/amend/:id', asyncHandler(signerQueue.saveSignedAmendment, failure()));
router.get('/upload-queue', asyncHandler(signerQueue.listUploadQueue, failure('[signer upload-queue]')));
router.post('/irn', asyncHandler(signerQueue.noteIrn, failure('[signer irn]')));
router.get('/jobs', asyncHandler(signerQueue.searchJobs, failure('[signer jobs]')));
router.get('/doc-codes', asyncHandler(signerQueue.listDocumentCodes, failure()));
router.post(
  '/add-doc',
  pdfUpload.single('pdf'),
  asyncHandler(signerQueue.addDocumentToJob, failure('[signer add-doc]')),
);
router.get('/job-docs', asyncHandler(signerQueue.listJobDocuments, failure('[signer job-docs]')));

export default router;
