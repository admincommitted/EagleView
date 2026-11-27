import { Router } from 'express';
import { onlyNumericInvoiceId } from '../shared/invoiceIdParam.js';
import { withErrorStatus, withServerError } from '../shared/invoiceRequest.js';
import {
  create,
  getByNumber,
  getByVoucher,
  getInvoice,
  markVoid,
  preview,
  remove,
  search,
  update,
} from './salesInvoice.controller.js';

const router = onlyNumericInvoiceId(Router());

router.get('/', withServerError(search));
router.get('/by-voucher/:vid', withServerError(getByVoucher));
router.get('/by-no', withServerError(getByNumber));
router.get('/:id', withServerError(getInvoice));
router.post('/preview', withErrorStatus(preview));
router.post('/', withErrorStatus(create));
router.put('/:id', withErrorStatus(update));
router.delete('/:id', withErrorStatus(remove));
router.post('/:id/void', withErrorStatus(markVoid));

export default router;
