import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { salesErrorBody } from '../shared/salesHelpers.js';
import {
  createContract,
  deleteContract,
  getContract,
  listContracts,
  listGstCharges,
  setContractStatus,
  updateContract,
} from './contracts.controller.js';

/** /api/contracts - Customer Contract & Quotation master. */
const router = Router();
const handle = (controller) => asyncHandler(controller, { errorBody: salesErrorBody });

router.get('/gst-charges', handle(listGstCharges));
router.get('/', handle(listContracts));
router.get('/:id', handle(getContract));
router.post('/', handle(createContract));
router.put('/:id', handle(updateContract));
router.post('/:id/status', handle(setContractStatus));
router.delete('/:id', handle(deleteContract));

export default router;
