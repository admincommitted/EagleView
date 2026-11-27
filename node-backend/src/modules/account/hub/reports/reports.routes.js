import { Router } from 'express';
import { handleHubRoute } from '../shared/hubHttp.js';
import { getCompanyHead, getReport } from './reports.controller.js';

const router = Router();

router.get('/company-head', handleHubRoute(getCompanyHead));
router.get('/reports/:name', handleHubRoute(getReport));

export default router;
