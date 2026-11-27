import { Router } from 'express';
import { withErrorStatus, withServerError } from '../shared/invoiceRequest.js';
import { getBulkCost, getBulkDockets, getExisting, getJobs } from './bulk.controller.js';

const router = Router();

router.get('/jobs', withServerError(getJobs));
router.get('/bulk-dockets', withErrorStatus(getBulkDockets));
router.post('/bulk-cost', withErrorStatus(getBulkCost));
router.get('/exists', withServerError(getExisting));

export default router;
