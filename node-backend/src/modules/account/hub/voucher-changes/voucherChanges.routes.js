import { Router } from 'express';
import { handleHubRoute } from '../shared/hubHttp.js';
import { changeVoucher, getVoucherAudit, removeVoucher } from './voucherChanges.controller.js';

const router = Router();

router.put('/vouchers/:id', handleHubRoute(changeVoucher, { useErrorStatus: true }));
router.delete('/vouchers/:id', handleHubRoute(removeVoucher));
router.get('/vouchers/:id/audit', handleHubRoute(getVoucherAudit));

export default router;
