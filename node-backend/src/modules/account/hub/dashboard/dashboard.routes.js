import { Router } from 'express';
import { handleHubRoute } from '../shared/hubHttp.js';
import { getDashboard } from './dashboard.controller.js';

const router = Router();

router.get('/dashboard', handleHubRoute(getDashboard));

export default router;
