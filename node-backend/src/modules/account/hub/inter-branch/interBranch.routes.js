import { Router } from 'express';
import { validate } from '../../../../middlewares/validate.middleware.js';
import { OLD_ERROR_SHAPE, handleHubRoute } from '../shared/hubHttp.js';
import { raiseTransferBody } from './interBranch.validation.js';
import { accept, getBranchBalances, getBranches, getTransfers, giveBack, raise } from './interBranch.controller.js';

const router = Router();

// 400 checks inside the posting (missing branch ledger, number series) keep their status
const KEEP_CHECK_STATUS = { useErrorStatus: true };

router.get('/ib/branches', handleHubRoute(getBranches));
router.get('/ib', handleHubRoute(getTransfers));
router.post('/ib', validate({ body: raiseTransferBody }, OLD_ERROR_SHAPE), handleHubRoute(raise, KEEP_CHECK_STATUS));
router.post('/ib/:id/accept', handleHubRoute(accept, KEEP_CHECK_STATUS));
router.post('/ib/:id/return', handleHubRoute(giveBack, KEEP_CHECK_STATUS));
router.get('/ib/balances', handleHubRoute(getBranchBalances));

export default router;
