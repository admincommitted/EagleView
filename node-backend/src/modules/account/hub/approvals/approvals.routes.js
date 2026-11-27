import { Router } from 'express';
import { handleHubRoute } from '../shared/hubHttp.js';
import { getApprovals } from './approvals.controller.js';

const router = Router();

router.get('/approvals', handleHubRoute(getApprovals));

export default router;
