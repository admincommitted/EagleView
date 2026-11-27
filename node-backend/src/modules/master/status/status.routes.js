import { Router } from 'express';
import { failedMessageAnswer, routeHandler } from '../shared/errorAnswers.js';
import { deleteStatus, listStatuses, saveStatus, updateStatus } from './status.controller.js';

/** /api/status-master (MDM > Status Master, Timeline drawer) */
const router = Router();

router.get('/', routeHandler(listStatuses, failedMessageAnswer));
router.post('/', routeHandler(saveStatus, failedMessageAnswer));
router.put('/:code', routeHandler(updateStatus, failedMessageAnswer));
router.delete('/:code', routeHandler(deleteStatus, failedMessageAnswer));

export default router;
