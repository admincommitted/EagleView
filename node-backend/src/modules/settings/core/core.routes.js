import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { requireAdmin } from '../../../middlewares/auth.middleware.js';
import * as coreController from './core.controller.js';
import {
  bulkSettingsSchema,
  companyProfileSchema,
  emailSettingsSchema,
  problemListBody,
  singleSettingSchema,
} from './core.validation.js';

/** Reading settings is open to every logged-in user; writing settings, keys and connections is for an admin only. */
const router = Router();
const errorOnly = { errorBody: (message) => ({ error: message }) };
const problemList = { errorBody: problemListBody };
const failure = { errorBody: (error) => ({ success: false, error: error.message, errors: error.errors }) };
const failedWith = (text) => ({ errorBody: (error) => ({ error: text, message: error.message }) });

router.get(
  '/',
  asyncHandler(coreController.getPublicSettings, { errorBody: () => ({ error: 'Internal server error' }) }),
);
router.post(
  '/',
  requireAdmin,
  validate({ body: singleSettingSchema }, errorOnly),
  asyncHandler(coreController.saveSetting, failure),
);
router.post(
  '/bulk',
  requireAdmin,
  validate({ body: bulkSettingsSchema }, errorOnly),
  asyncHandler(coreController.saveSettings, failure),
);

router.get('/security-check', coreController.securityCheck);

router.post(
  '/test-sftp',
  requireAdmin,
  asyncHandler(coreController.testSftpConnection, failedWith('Internal server error')),
);
router.post(
  '/export-private-key',
  requireAdmin,
  asyncHandler(coreController.exportPrivateKey, failedWith('Failed to export private key')),
);
router.post(
  '/export-public-key',
  requireAdmin,
  asyncHandler(coreController.exportPublicKey, failedWith('Failed to derive public key')),
);
router.post(
  '/generate-ssh-key',
  requireAdmin,
  asyncHandler(coreController.generateSshKey, failedWith('Failed to generate SSH key')),
);

router.get('/company/default-logo', asyncHandler(coreController.defaultCompanyLogo, failure));
router.get('/company', asyncHandler(coreController.getCompanyProfile, failure));
router.put(
  '/company',
  requireAdmin,
  validate({ body: companyProfileSchema }, problemList),
  asyncHandler(coreController.updateCompanyProfile, failure),
);

router.get('/sftp-status', coreController.sftpConnectionStatus);

router.get('/email', asyncHandler(coreController.getEmailSettings, failure));
router.put(
  '/email',
  requireAdmin,
  validate({ body: emailSettingsSchema }, problemList),
  asyncHandler(coreController.updateEmailSettings, failure),
);

router.post('/test-einvoice', requireAdmin, asyncHandler(coreController.testEinvoiceConnection, failure));

export default router;
