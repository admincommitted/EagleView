import { Router } from 'express';
import { handleHubRoute } from '../shared/hubHttp.js';
import { getFinancialStatement } from './finStatement.controller.js';

const router = Router();

router.get('/fin-statement', handleHubRoute(getFinancialStatement));

export default router;
