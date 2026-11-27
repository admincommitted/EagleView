import { Router } from 'express';
import { failedMessageAnswer, routeHandler } from '../shared/errorAnswers.js';
import { jobSequenceStatus, listJobSequences, saveJobSequences } from './jobSequence.controller.js';

const router = Router();

router.get('/job-sequences', routeHandler(listJobSequences));
router.get('/job-sequences/status', routeHandler(jobSequenceStatus, failedMessageAnswer));
router.post('/job-sequences', routeHandler(saveJobSequences, failedMessageAnswer));

export default router;
