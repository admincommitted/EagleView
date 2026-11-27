import { Router } from 'express';
import { asyncHandler } from '../../../../core/http/index.js';
import { onlyNumericParam, salesErrorBody } from '../../shared/salesHelpers.js';
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  getSalesDashboard,
  kamOfLedger,
  listCustomers,
  listDebtorLedgers,
  updateCustomer,
} from './customers.controller.js';

const router = Router();
const handle = (controller) => asyncHandler(controller, { errorBody: salesErrorBody });

router.param('id', onlyNumericParam);

router.get('/customers', handle(listCustomers));
router.get('/customers/:id', handle(getCustomer));
router.post('/customers', handle(createCustomer));
router.put('/customers/:id', handle(updateCustomer));
router.delete('/customers/:id', handle(deleteCustomer));
router.get('/ledgers', handle(listDebtorLedgers));
router.get('/dashboard', handle(getSalesDashboard));
router.get('/kam-of-ledger/:id', handle(kamOfLedger));

export default router;
