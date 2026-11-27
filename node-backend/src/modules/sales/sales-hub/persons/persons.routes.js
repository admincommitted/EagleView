import { Router } from 'express';
import { asyncHandler } from '../../../../core/http/index.js';
import { onlyNumericParam, salesErrorBody } from '../../shared/salesHelpers.js';
import {
  addPersonsFromNames,
  createSalesPerson,
  listLoginUsers,
  listSalesPersons,
  listUnmatchedNames,
  moveCustomersToPerson,
  updateSalesPerson,
} from './persons.controller.js';

const router = Router();
const handle = (controller) => asyncHandler(controller, { errorBody: salesErrorBody });

router.param('id', onlyNumericParam);

router.get('/persons', handle(listSalesPersons));
router.get('/users', handle(listLoginUsers));
router.post('/persons', handle(createSalesPerson));
router.put('/persons/:id', handle(updateSalesPerson));
router.post('/persons/:id/move-customers', handle(moveCustomersToPerson));
router.post('/persons/from-names', handle(addPersonsFromNames));
router.get('/persons/unmatched-names', handle(listUnmatchedNames));

export default router;
