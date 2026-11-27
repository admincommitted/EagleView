import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { salesErrorBody } from '../shared/salesHelpers.js';
import {
  convertQuoteToJob,
  createLead,
  createQuote,
  deleteQuote,
  listLeads,
  listQuotes,
  listRates,
  nextEnquiryNumber,
  nextQuoteNumber,
  recordQuoteSent,
  updateLead,
  updateQuote,
} from './core.controller.js';

/** /api/sales - Sales & CRM: leads, quotations, and conversion to a job. */
const router = Router();
const handle = (controller) => asyncHandler(controller, { errorBody: salesErrorBody });

router.get('/leads', handle(listLeads));
router.get('/leads/next-no', handle(nextEnquiryNumber));
router.post('/leads', handle(createLead));
router.put('/leads/:id', handle(updateLead));
router.get('/quotes', handle(listQuotes));
router.get('/quotes/next-no', handle(nextQuoteNumber));
router.get('/rates', handle(listRates));
router.post('/quotes', handle(createQuote));
router.put('/quotes/:id', handle(updateQuote));
router.post('/quotes/:id/send', handle(recordQuoteSent));
router.post('/quotes/:id/convert', handle(convertQuoteToJob));
router.delete('/quotes/:id', handle(deleteQuote));

export default router;
