import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware.js';
import { handleRoute, successFalseMessage } from '../shared/handleRoute.js';
import { addEntry, deleteEntry, listTimeline } from './timeline.controller.js';
import { timelineEntryBodySchema } from './timeline.validation.js';

const router = Router();

const timelineRoute = (controller) => handleRoute(controller, { errorBody: successFalseMessage });

router.get('/:module/:jobId', timelineRoute(listTimeline));
router.post(
  '/',
  validate({ body: timelineEntryBodySchema }, { errorBody: (message) => ({ success: false, message }) }),
  timelineRoute(addEntry),
);
router.delete('/:id', timelineRoute(deleteEntry));

export default router;
