import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import * as preferencesController from './preferences.controller.js';
import { preferenceKeyParams } from './preferences.validation.js';

/** /api/user-prefs/:key - the logged-in user's own preferences. */
const router = Router();
const failure = { errorBody: (message) => ({ success: false, error: message }) };
const checkKey = validate({ params: preferenceKeyParams }, failure);
const unexpectedFailure = { errorBody: (error) => ({ success: false, error: error.message }) };

router.get('/:key', checkKey, asyncHandler(preferencesController.getPreference, unexpectedFailure));
router.put('/:key', checkKey, asyncHandler(preferencesController.savePreference, unexpectedFailure));

export default router;
