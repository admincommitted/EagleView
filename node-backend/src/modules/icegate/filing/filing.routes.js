import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import * as filing from './filing.controller.js';
import {
  billOfEntrySchema,
  failureBody as validationFailureBody,
  sbAmendmentSchema,
  shippingBillSchema,
  signBillOfEntrySchema,
  signShippingBillSchema,
} from './filing.validation.js';
import { archivePdfUpload, requirePdfContent, signPdfUpload, uploadErrorAnswer } from './esanchitUpload.middleware.js';

const router = Router();

const checkBody = (schema) => validate({ body: schema }, { errorBody: validationFailureBody });
const failure = { errorBody: filing.failureBody };
const loggedFailure = (label, options) => ({ errorBody: filing.loggedFailureBody(label, options) });

router.post('/test-auth', asyncHandler(filing.testAuthentication));
router.post('/file-submit', asyncHandler(filing.submitJsonFile));
router.post('/get-ack', asyncHandler(filing.getAcknowledgement));

router.post('/submit-be', checkBody(billOfEntrySchema), asyncHandler(filing.submitBillOfEntry));
router.post('/be-ack', asyncHandler(filing.checkBeAcknowledgement));
router.get('/be-ack/:jobId', asyncHandler(filing.getStoredBeAcknowledgement, failure));
router.post('/preview-be', checkBody(billOfEntrySchema), asyncHandler(filing.previewBillOfEntry, failure));
router.post('/sign-be-file', checkBody(signBillOfEntrySchema), asyncHandler(filing.signBillOfEntryFile, failure));
router.post(
  '/flat-be',
  checkBody(billOfEntrySchema),
  asyncHandler(filing.makeBeFlatFile, loggedFailure('[ICEGATE] flat-be error:')),
);
router.post('/amend-be-flat', checkBody(billOfEntrySchema), asyncHandler(filing.makeBeAmendmentFlatFile));
router.get('/be-amend-codes', asyncHandler(filing.listBeAmendmentCodes));

router.post('/submit-sb', asyncHandler(filing.submitShippingBill));
router.post('/sb-ack', asyncHandler(filing.checkSbAcknowledgement));
router.get('/sb-ack/:jobId', asyncHandler(filing.getStoredSbAcknowledgement, failure));
router.post('/sign-sb-file', checkBody(signShippingBillSchema), asyncHandler(filing.signShippingBillFile, failure));
router.post(
  '/flat-sb',
  checkBody(shippingBillSchema),
  asyncHandler(filing.makeSbFlatFile, loggedFailure('[ICEGATE] flat-sb error:')),
);
router.post('/preview-sb', checkBody(shippingBillSchema), asyncHandler(filing.previewShippingBill, failure));
router.post(
  '/amend-sb',
  checkBody(sbAmendmentSchema),
  asyncHandler(filing.makeSbAmendment, loggedFailure('Error generating amendment:', { wholeError: true })),
);

router.get('/signer-status', asyncHandler(filing.getSignerStatus));
router.post('/sign-pdf', signPdfUpload.single('pdf'), uploadErrorAnswer, asyncHandler(filing.signPdf, failure));
router.post(
  '/esanchit-archive',
  archivePdfUpload.single('pdf'),
  uploadErrorAnswer,
  requirePdfContent,
  asyncHandler(filing.archivePdf),
);
router.get('/esanchit-archive', asyncHandler(filing.listArchivedPdfs));
router.post(
  '/upload-esanchit',
  archivePdfUpload.single('pdf'),
  uploadErrorAnswer,
  requirePdfContent,
  asyncHandler(filing.uploadSignedPdf, loggedFailure('Error in /upload-esanchit:', { wholeError: true })),
);

router.post('/test-imap', asyncHandler(filing.testImap));

export default router;
