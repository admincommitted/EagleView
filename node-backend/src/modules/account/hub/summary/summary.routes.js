import { Router } from 'express';
import { handleHubRoute } from '../shared/hubHttp.js';
import { getSummary } from './summary.controller.js';

const router = Router();

router.get('/summary', handleHubRoute(getSummary));

export default router;
