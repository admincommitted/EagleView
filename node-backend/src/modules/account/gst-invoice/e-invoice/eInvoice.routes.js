import { Router } from 'express';
import { onlyNumericInvoiceId } from '../shared/invoiceIdParam.js';
import { withErrorStatus } from '../shared/invoiceRequest.js';
import { cancelInvoiceIrn, getEInvoiceJson, saveIrn } from './eInvoice.controller.js';

const router = onlyNumericInvoiceId(Router());

router.get('/einvoice', withErrorStatus(getEInvoiceJson));
router.post('/:id/irn', withErrorStatus(saveIrn));
router.post('/:id/irn-cancel', withErrorStatus(cancelInvoiceIrn));

export default router;
