import { Router } from 'express';
import { handleHubRoute } from '../shared/hubHttp.js';
import {
  addChildren,
  addLedger,
  changeChild,
  changeLedger,
  getLedgers,
  getOneLedger,
  removeChild,
  removeLedger,
} from './ledgers.controller.js';

const router = Router();

// 400 checks of the ledger master keep their status
const KEEP_CHECK_STATUS = { useErrorStatus: true };

router.get('/ledgers', handleHubRoute(getLedgers));
router.get('/ledgers/:id', handleHubRoute(getOneLedger));
router.post('/ledgers', handleHubRoute(addLedger, KEEP_CHECK_STATUS));
router.put('/ledgers/:id', handleHubRoute(changeLedger, KEEP_CHECK_STATUS));
router.delete('/ledgers/:id', handleHubRoute(removeLedger));
router.post('/ledgers/:id/:kind', handleHubRoute(addChildren, KEEP_CHECK_STATUS));
router.put('/ledgers/:id/:kind/:cid', handleHubRoute(changeChild, KEEP_CHECK_STATUS));
router.delete('/ledgers/:id/:kind/:cid', handleHubRoute(removeChild));

export default router;
