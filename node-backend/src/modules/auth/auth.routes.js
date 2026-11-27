import { Router } from 'express';
import { asyncHandler } from '../../core/http/index.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, requireAdmin } from '../../middlewares/auth.middleware.js';
import * as authController from './auth.controller.js';
import { appSettingsSchema, forgotPasswordSchema, loginSchema, resetPasswordSchema } from './auth.validation.js';

const router = Router();
const errorOnly = { errorBody: (message) => ({ error: message }) };

router.post('/login', validate({ body: loginSchema }, errorOnly), asyncHandler(authController.login));
router.post(
  '/login/otp',
  asyncHandler(authController.verifyLoginCode, {
    errorBody: (error) => ({ error: 'Could not check the code: ' + error.message }),
  }),
);
router.post('/logout', asyncHandler(authController.logout));

router.get('/profile', authenticate, asyncHandler(authController.getProfile));
router.put('/profile', authenticate, asyncHandler(authController.updateProfile));

router.get('/settings', authenticate, asyncHandler(authController.getAppSettings));
router.put(
  '/settings',
  authenticate,
  validate({ body: appSettingsSchema }, errorOnly),
  asyncHandler(authController.updateAppSettings),
);

router.post('/init', asyncHandler(authController.createFirstAdmin));

router.post(
  '/forgot-password',
  validate({ body: forgotPasswordSchema }, errorOnly),
  asyncHandler(authController.forgotPassword),
);
router.post(
  '/reset-password',
  validate({ body: resetPasswordSchema }, errorOnly),
  asyncHandler(authController.resetPassword, {
    errorBody: () => ({ error: 'Could not reset the password. Please contact admin.' }),
  }),
);

router.post('/system-backup', authenticate, requireAdmin, asyncHandler(authController.createSystemBackup));

export default router;
