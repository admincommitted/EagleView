import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { errorOnly, handleRoute } from '../shared/handleRoute.js';
import { deleteJob, getJob, jobLogs, listJobs, nextSequence, saveJob, updateSbNo } from './exportJob.controller.js';

const router = Router();

router.get('/next-sequence', handleRoute(nextSequence, { status: 200 }));
router.post('/', asyncHandler(saveJob));
router.get('/:id', handleRoute(getJob, { errorBody: errorOnly }));
router.get('/', handleRoute(listJobs, { errorBody: errorOnly }));
router.get('/:id/logs', handleRoute(jobLogs));
router.post('/:id/sb-no', handleRoute(updateSbNo));
router.delete('/:id', handleRoute(deleteJob, { errorBody: errorOnly }));

export default router;
