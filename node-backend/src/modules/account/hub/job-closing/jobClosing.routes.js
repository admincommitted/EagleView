import { Router } from 'express';
import { validate } from '../../../../middlewares/validate.middleware.js';
import { OLD_ERROR_SHAPE, handleHubRoute } from '../shared/hubHttp.js';
import { closeJobBody } from './jobClosing.validation.js';
import { closeJob, getJobs } from './jobClosing.controller.js';

const router = Router();

router.get('/jobs', handleHubRoute(getJobs));
router.post('/jobs/close', validate({ body: closeJobBody }, OLD_ERROR_SHAPE), handleHubRoute(closeJob));

export default router;
