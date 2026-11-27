import { Router } from 'express';
import { handleRoute, successFalseBody } from '../shared/routeHandler.js';
import {
  costCategoryHandlers,
  costCentreHandlers,
  currencyHandlers,
  getAllMasters,
  getCostCentreReport,
  seedMasters,
  tdsNatureHandlers,
  voucherTypeHandlers,
} from './accountingMaster.controller.js';

const router = Router();
const BAD_REQUEST = { status: 400 };

router.post('/seed', handleRoute(seedMasters));
router.get('/all', handleRoute(getAllMasters));

router.post('/vouchertypes', handleRoute(voucherTypeHandlers.add, BAD_REQUEST));
router.post('/categories', handleRoute(costCategoryHandlers.add, BAD_REQUEST));
router.post('/centres', handleRoute(costCentreHandlers.add, BAD_REQUEST));

router.put('/vouchertypes/:id', handleRoute(voucherTypeHandlers.change, BAD_REQUEST));
router.delete('/vouchertypes/:id', handleRoute(voucherTypeHandlers.remove, BAD_REQUEST));
router.put('/categories/:id', handleRoute(costCategoryHandlers.change, BAD_REQUEST));
router.delete('/categories/:id', handleRoute(costCategoryHandlers.remove, BAD_REQUEST));
router.put('/centres/:id', handleRoute(costCentreHandlers.change, BAD_REQUEST));
router.delete('/centres/:id', handleRoute(costCentreHandlers.remove, BAD_REQUEST));

router.get('/currencies', handleRoute(currencyHandlers.list));
router.post('/currencies', handleRoute(currencyHandlers.add, BAD_REQUEST));
router.put('/currencies/:id', handleRoute(currencyHandlers.change, BAD_REQUEST));
router.delete('/currencies/:id', handleRoute(currencyHandlers.remove, BAD_REQUEST));

router.get('/tds-natures', handleRoute(tdsNatureHandlers.list));
router.post('/tds-natures', handleRoute(tdsNatureHandlers.add, BAD_REQUEST));
router.put('/tds-natures/:id', handleRoute(tdsNatureHandlers.change, BAD_REQUEST));
router.delete('/tds-natures/:id', handleRoute(tdsNatureHandlers.remove, BAD_REQUEST));

router.get('/cost-centre-report', handleRoute(getCostCentreReport, { errorBody: successFalseBody }));

export default router;
