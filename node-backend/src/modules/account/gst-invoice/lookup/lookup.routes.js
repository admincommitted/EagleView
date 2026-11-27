import { Router } from 'express';
import { withServerError } from '../shared/invoiceRequest.js';
import {
  getCharges,
  getExpenses,
  getJob,
  getMeta,
  getNextInvoiceNumber,
  getPartyAccount,
  getParties,
} from './lookup.controller.js';

const router = Router();

router.get('/meta', withServerError(getMeta));
router.get('/parties', withServerError(getParties));
router.get('/party-account', withServerError(getPartyAccount));
router.get('/job', withServerError(getJob));
router.get('/charges', withServerError(getCharges));
router.get('/expenses', withServerError(getExpenses));
router.get('/next-no', withServerError(getNextInvoiceNumber));

export default router;
