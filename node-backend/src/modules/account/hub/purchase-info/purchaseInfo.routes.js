import { Router } from 'express';
import { validate } from '../../../../middlewares/validate.middleware.js';
import { OLD_ERROR_SHAPE, handleHubRoute } from '../shared/hubHttp.js';
import { paymentHoldBody, vendorBillsQuery } from './purchaseInfo.validation.js';
import {
  getBillInfo,
  getHeldBills,
  getVendorBills,
  holdOrReleasePayment,
  saveBillInfo,
} from './purchaseInfo.controller.js';

const router = Router();

router.get('/purchase-info/:id', handleHubRoute(getBillInfo));
router.post('/purchase-info/:id', handleHubRoute(saveBillInfo));
router.post(
  '/purchase-info/:id/hold',
  validate({ body: paymentHoldBody }, OLD_ERROR_SHAPE),
  handleHubRoute(holdOrReleasePayment),
);
router.get('/held-bills', handleHubRoute(getHeldBills));
router.get('/vendor-bills', validate({ query: vendorBillsQuery }, OLD_ERROR_SHAPE), handleHubRoute(getVendorBills));

export default router;
