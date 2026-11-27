import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { downloadZip } from './bulkZip.controller.js';
import { bulkZipBodySchema } from './bulkZip.validation.js';

const router = Router();

router.post(
  '/',
  validate({ body: bulkZipBodySchema }, { errorBody: (message) => ({ error: message }) }),
  asyncHandler(downloadZip),
);

export default router;
