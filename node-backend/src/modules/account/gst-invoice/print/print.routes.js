import { Router } from 'express';
import { onlyNumericInvoiceId } from '../shared/invoiceIdParam.js';
import { withServerError } from '../shared/invoiceRequest.js';
import { getPrintData, getQr } from './print.controller.js';

const router = onlyNumericInvoiceId(Router());

router.get('/:id/print-data', withServerError(getPrintData));
router.get('/:id/qr', withServerError(getQr));

export default router;
