import { Router } from 'express';
import { handleRoute } from '../shared/handleRoute.js';
import { getBalances, getExBonds, getWarehouseJob, listWarehouseBes } from './warehouseBe.controller.js';

const router = Router();

const logListError = (error) => console.error('[WH-BE] list error:', error.message);

router.get('/list', handleRoute(listWarehouseBes, { onError: logListError }));
router.get('/balances/:whJobId', handleRoute(getBalances));
router.get('/by-id/:id', handleRoute(getWarehouseJob));
router.get('/ex-bonds/:whJobId', handleRoute(getExBonds));

export default router;
