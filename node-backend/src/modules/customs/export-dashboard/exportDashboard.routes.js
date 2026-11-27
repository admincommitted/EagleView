import { Router } from 'express';
import { handleRoute } from '../shared/handleRoute.js';
import { liveTracking } from './exportDashboard.controller.js';

const router = Router();

const logError = (error) => console.error('Export Dashboard error:', error);

router.get('/live-tracking', handleRoute(liveTracking, { onError: logError }));

export default router;
