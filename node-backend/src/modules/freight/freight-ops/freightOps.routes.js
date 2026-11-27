import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { failureBody } from '../shared/orderedChecks.js';
import { dashboard, deleteEvent, listEvents, recordEvent } from './freightOps.controller.js';
import { dashboardQuerySchema, recordEventBodySchema } from './freightOps.validation.js';

const router = Router();

const failureAnswer = { errorBody: (error) => ({ success: false, error: error.message }) };

router.get(
  '/dashboard',
  validate({ query: dashboardQuerySchema }, failureBody),
  asyncHandler(dashboard, failureAnswer),
);
router.post(
  '/events',
  validate({ body: recordEventBodySchema }, failureBody),
  asyncHandler(recordEvent, failureAnswer),
);
router.get('/events', asyncHandler(listEvents, failureAnswer));
router.delete('/events/:id', asyncHandler(deleteEvent, failureAnswer));

export default router;
