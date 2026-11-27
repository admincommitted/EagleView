import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import * as cbicWatchController from './cbicWatch.controller.js';
import { watchSettingsSchema } from './cbicWatch.validation.js';

/**
 * Customs and trade updates by e-mail (CBIC, ICEGATE, DGFT, own pages). Mounted at /api/settings/cbic-watch, so the
 * "Settings" rights apply (view free, saving needs edit).
 */
const router = Router();
const failure = { errorBody: (error) => ({ success: false, error: error.message }) };

router.get('/', asyncHandler(cbicWatchController.watchStatus));
router.get('/latest', asyncHandler(cbicWatchController.latestEntries));
router.post(
  '/',
  validate({ body: watchSettingsSchema }, { errorBody: (message) => ({ success: false, error: message }) }),
  asyncHandler(cbicWatchController.saveWatchSettings, failure),
);
router.post('/check', asyncHandler(cbicWatchController.checkNow));
router.post('/test', asyncHandler(cbicWatchController.sendTestMail));

export default router;
