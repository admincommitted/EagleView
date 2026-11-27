import { Router } from 'express';
import { handleHubRoute } from '../shared/hubHttp.js';
import { merge } from './mergeLedgers.controller.js';

const router = Router();

router.post('/merge-ledgers', handleHubRoute(merge));

export default router;
