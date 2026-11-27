import { Router } from 'express';
import { handleHubRoute } from '../shared/hubHttp.js';
import {
  createTaxLedgers,
  getLedgersInGroups,
  getVoucher,
  getVoucherTypes,
  getVouchers,
} from './voucherDesk.controller.js';

const router = Router();

router.get('/voucher-types', handleHubRoute(getVoucherTypes));
router.get('/vouchers', handleHubRoute(getVouchers));
router.get('/vouchers/:id', handleHubRoute(getVoucher));
router.post('/tax-ledgers', handleHubRoute(createTaxLedgers));
router.get('/ledgers-in', handleHubRoute(getLedgersInGroups));

export default router;
