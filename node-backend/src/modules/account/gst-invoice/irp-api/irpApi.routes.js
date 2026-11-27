import { Router } from 'express';
import { withErrorStatus, withServerError } from '../shared/invoiceRequest.js';
import { getSettings, postInvoicesToGstn, saveSettings } from './irpApi.controller.js';

const router = Router();

router.get('/einv-settings', withServerError(getSettings));
router.put('/einv-settings', withErrorStatus(saveSettings));
router.post('/post-gstn', withErrorStatus(postInvoicesToGstn));

export default router;
