import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { errorOnlyBody } from '../shared/orderedChecks.js';
import { drawback } from './calculations.controller.js';
import { drawbackBodySchema } from './calculations.validation.js';

const router = Router();

router.post(
  '/drawback',
  validate({ body: drawbackBodySchema }, errorOnlyBody),
  asyncHandler(drawback, { errorBody: () => ({ error: 'Server error' }) }),
);

export default router;
