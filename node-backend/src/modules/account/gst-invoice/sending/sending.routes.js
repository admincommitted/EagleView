import { Router } from 'express';
import { onlyNumericInvoiceId } from '../shared/invoiceIdParam.js';
import { withErrorStatus, withServerError } from '../shared/invoiceRequest.js';
import { getContact, sendMail, sendPdf, sendWhatsapp } from './sending.controller.js';

const router = onlyNumericInvoiceId(Router());

router.post('/:id/pdf', withErrorStatus(sendPdf));
router.get('/:id/contact', withServerError(getContact));
router.post('/:id/mail', withErrorStatus(sendMail));
router.post('/:id/whatsapp', withErrorStatus(sendWhatsapp));

export default router;
