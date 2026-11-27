import { Router } from 'express';
import { withErrorStatus } from '../shared/invoiceRequest.js';
import { getProvisionalSheet, putProvisionalSheet } from './provisionalSheet.controller.js';

const router = Router();

router.get('/provisional', withErrorStatus(getProvisionalSheet));
router.put('/provisional', withErrorStatus(putProvisionalSheet));

export default router;
