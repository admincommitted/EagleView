import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { requireAdmin } from '../../../middlewares/auth.middleware.js';
import { withFixedErrorStatus } from '../fixedErrorStatus.js';
import * as emailController from './email.controller.js';
import { sendMailSchema, testMailSchema } from './email.validation.js';

/** The SMTP test is for an admin; /send is the generic send other screens use. */
const router = Router();
const SERVER_ERROR = 500;
const errorOnly = { errorBody: (message) => ({ error: message }) };

router.post(
  '/test',
  requireAdmin,
  validate({ body: testMailSchema }, errorOnly),
  asyncHandler(emailController.sendTestMail),
);
router.post(
  '/send',
  validate({ body: sendMailSchema }, errorOnly),
  withFixedErrorStatus(emailController.sendMail, SERVER_ERROR, (error) => ({ error: error.message })),
);

export default router;
