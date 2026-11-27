import { Router } from 'express';
import { asyncHandler } from '../../../../core/http/index.js';
import { onlyNumericParam, salesErrorBody } from '../../shared/salesHelpers.js';
import {
  createQuotation,
  deleteQuotation,
  downloadQuotationPdf,
  getQuotation,
  listQuotations,
  mailQuotation,
  markQuotationLost,
  markQuotationSent,
  markQuotationWon,
  quotationsToCopy,
  reopenQuotation,
  reviseQuotation,
  updateQuotation,
} from './quotations.controller.js';

const router = Router();
const handle = (controller) => asyncHandler(controller, { errorBody: salesErrorBody });

router.param('qid', onlyNumericParam);

router.get('/quotes', handle(listQuotations));
router.get('/quotes/:qid', handle(getQuotation));
router.post('/quotes', handle(createQuotation));
router.put('/quotes/:qid', handle(updateQuotation));
router.post('/quotes/:qid/revise', handle(reviseQuotation));
router.delete('/quotes/:qid', handle(deleteQuotation));
router.post('/quotes/:qid/sent', handle(markQuotationSent));
router.post('/quotes/:qid/pdf', handle(downloadQuotationPdf));
router.post('/quotes/:qid/mail', handle(mailQuotation));
router.post('/quotes/:qid/won', handle(markQuotationWon));
router.post('/quotes/:qid/lost', handle(markQuotationLost));
router.post('/quotes/:qid/reopen', handle(reopenQuotation));
router.get('/quotes-to-copy', handle(quotationsToCopy));

export default router;
