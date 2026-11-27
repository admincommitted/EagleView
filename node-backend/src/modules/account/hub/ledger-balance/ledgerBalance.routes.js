import { Router } from 'express';
import { handleHubRoute } from '../shared/hubHttp.js';
import { getLedgerBalance } from './ledgerBalance.controller.js';

const router = Router();

router.get('/ledger-balance/:id', handleHubRoute(getLedgerBalance));

export default router;
