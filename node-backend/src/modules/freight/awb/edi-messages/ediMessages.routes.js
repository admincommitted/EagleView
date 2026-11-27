import { Router } from 'express';
import { asyncHandler } from '../../../../core/http/index.js';
import { sanitizeIataPayload } from '../../../../middlewares/iataSanitizer.middleware.js';
import {
  downloadXfhl,
  downloadXfwb,
  pollFsu,
  previewFhl,
  previewFwb,
  previewXfhl,
  previewXfwb,
  sendXffm,
  sendXfhl,
  sendXfwb,
  sendXfzb,
  sftpStatus,
  transmitFwbText,
  validateEdiDryRun,
} from './ediMessages.controller.js';

const router = Router();

const failureAnswer = { errorBody: (error) => ({ success: false, error: error.message }) };
const dryRunFailureAnswer = { errorBody: (error) => ({ errors: [`SERVER ERROR: ${error.message}`] }) };

router.post('/:id/transmit', asyncHandler(transmitFwbText));
router.get('/:id/xfwb', asyncHandler(downloadXfwb));
router.get('/:id/xfwb-preview', asyncHandler(previewXfwb));
router.get('/:id/xfhl', asyncHandler(downloadXfhl));
router.get('/:id/xfhl-preview', asyncHandler(previewXfhl));
router.get('/sftp-status', asyncHandler(sftpStatus));
router.post('/fsu-poll', asyncHandler(pollFsu, failureAnswer));
router.post('/:id/send-xfwb', asyncHandler(sendXfwb, failureAnswer));
router.post('/:id/send-xfhl', asyncHandler(sendXfhl, failureAnswer));
router.post('/:id/send-xfzb', asyncHandler(sendXfzb, failureAnswer));
router.post('/:id/send-xffm', asyncHandler(sendXffm, failureAnswer));
router.post('/validate', sanitizeIataPayload, asyncHandler(validateEdiDryRun, dryRunFailureAnswer));
router.get('/:id/preview-fwb', asyncHandler(previewFwb));
router.get('/:id/preview-fhl', asyncHandler(previewFhl));

export default router;
