import { Router } from 'express';
import { asyncHandler } from '../../../../core/http/index.js';
import { onlyNumericParam, salesErrorBody } from '../../shared/salesHelpers.js';
import {
  createEnquiry,
  deleteEnquiry,
  getEnquiry,
  listEnquiries,
  setEnquiryStatus,
  updateEnquiry,
} from './enquiries.controller.js';

const router = Router();
const handle = (controller) => asyncHandler(controller, { errorBody: salesErrorBody });

router.param('eid', onlyNumericParam);

router.get('/enquiries', handle(listEnquiries));
router.get('/enquiries/:eid', handle(getEnquiry));
router.post('/enquiries', handle(createEnquiry));
router.put('/enquiries/:eid', handle(updateEnquiry));
router.post('/enquiries/:eid/status', handle(setEnquiryStatus));
router.delete('/enquiries/:eid', handle(deleteEnquiry));

export default router;
