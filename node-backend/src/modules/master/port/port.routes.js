import { Router } from 'express';
import { answerWithStatus, routeHandler } from '../shared/errorAnswers.js';
import { createPort, deletePort, listPorts, updatePort } from './port.controller.js';

/** /api/masters/ports */
const router = Router();

router.get('/', routeHandler(listPorts));
router.post('/', routeHandler(createPort, answerWithStatus(400)));
router.put('/:id', routeHandler(updatePort, answerWithStatus(400)));
router.delete('/:id', routeHandler(deletePort));

export default router;
