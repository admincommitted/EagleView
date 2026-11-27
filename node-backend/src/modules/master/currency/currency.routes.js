import { Router } from 'express';
import { adminOnly } from '../shared/adminOnly.middleware.js';
import { answerWithStatus, routeHandler } from '../shared/errorAnswers.js';
import {
  cbicStatus,
  rateHistory,
  ratesInForce,
  setCbicAutoSync,
  syncCbicRates,
  syncLiveRates,
} from './currency.controller.js';

const SYNC_ADMIN_MESSAGE = 'Only an admin can sync currency rates';

const liveSyncFailedAnswer = (error) => {
  console.error(error);
  return { status: 500, body: { error: 'Failed to sync live rates' } };
};

const router = Router();

router.post('/currencies/sync-live', adminOnly(SYNC_ADMIN_MESSAGE), routeHandler(syncLiveRates, liveSyncFailedAnswer));
router.get('/currencies/cbic-status', routeHandler(cbicStatus));
router.get('/currencies/in-force', routeHandler(ratesInForce));
router.get('/currencies/history', routeHandler(rateHistory));
router.post('/currencies/sync-cbic', adminOnly(SYNC_ADMIN_MESSAGE), routeHandler(syncCbicRates, answerWithStatus(502)));
router.post('/currencies/cbic-auto', adminOnly('Only an admin can change this'), routeHandler(setCbicAutoSync));

export default router;
