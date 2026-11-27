import { Router } from 'express';
import { asyncHandler } from '../../../../core/http/index.js';
import { validate } from '../../../../middlewares/validate.middleware.js';
import { errorOnlyBody } from '../../shared/orderedChecks.js';
import {
  addManualEvent,
  createTrackingRow,
  listTrackedShipments,
  listTrackingEvents,
  readNotifySettings,
  removeManualEvent,
  updateNotifySettings,
  updateTrackingMilestones,
} from './tracking.controller.js';
import { manualEventBodySchema, trackingEventsQuerySchema } from './tracking.validation.js';

const router = Router();

router.get('/tracking', asyncHandler(listTrackedShipments));
router.get(
  '/tracking/events',
  validate({ query: trackingEventsQuerySchema }, errorOnlyBody),
  asyncHandler(listTrackingEvents),
);
router.post('/tracking/event', validate({ body: manualEventBodySchema }, errorOnlyBody), asyncHandler(addManualEvent));
router.delete('/tracking/event/:id', asyncHandler(removeManualEvent));
router.get('/notify-settings', asyncHandler(readNotifySettings));
router.put('/notify-settings', asyncHandler(updateNotifySettings));
router.post('/tracking', asyncHandler(createTrackingRow));
router.patch('/tracking/:id', asyncHandler(updateTrackingMilestones));

export default router;
