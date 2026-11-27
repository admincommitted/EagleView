import { Router } from 'express';
import { handleRoute } from '../shared/handleRoute.js';
import { liveTracking } from './importDashboard.controller.js';

const router = Router();

const logError = (error) => console.error('Import Dashboard error:', error);

router.get('/live-tracking', handleRoute(liveTracking, { onError: logError }));

export default router;
