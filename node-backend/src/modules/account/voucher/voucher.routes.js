import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware.js';
import { handleRoute, successFalseBody } from '../shared/routeHandler.js';
import {
  changeVoucherStatus,
  claimVoucherDocuments,
  getBankReconciliation,
  getCashFlow,
  getDayBook,
  getGstReturns,
  getLedgerStatement,
  getLedgersByGroup,
  getNextNumber,
  getOutstanding,
  getPendingApprovals,
  getPendingBills,
  getVoucherDocuments,
  listRecentVouchers,
  matchGstr2bFile,
  removeVoucherDocument,
  saveBankReconciliation,
  saveVoucher,
  uploadVoucherDocuments,
} from './voucher.controller.js';
import { gstr2bUpload, MAX_VOUCHER_DOCUMENTS, voucherDocumentUpload } from './voucher.uploads.js';
import {
  claimDocumentsBodySchema,
  documentListQuerySchema,
  pendingBillsQuerySchema,
  voucherErrorBody,
} from './voucher.validation.js';

const router = Router();
const handle = (controller) => handleRoute(controller);
const handleWithSuccessFlag = (controller) => handleRoute(controller, { errorBody: successFalseBody });
const validateWith = (schemas) => validate(schemas, { errorBody: voucherErrorBody });

router.get('/next-number/:typeId', handle(getNextNumber));
router.post('/', handleRoute(saveVoucher, { status: 400 }));
router.get('/', handle(listRecentVouchers));
router.get('/daybook', handle(getDayBook));
router.get('/ledger-statement/:id', handle(getLedgerStatement));
router.get('/brs/:id', handle(getBankReconciliation));
router.post('/brs/reconcile', handle(saveBankReconciliation));
router.get('/gst-returns', handle(getGstReturns));
router.get('/pending-approvals', handle(getPendingApprovals));
router.post('/update-status/:id', handle(changeVoucherStatus));
router.get('/outstanding', handle(getOutstanding));
router.get('/cash-flow', handleWithSuccessFlag(getCashFlow));

router.post(
  '/documents',
  voucherDocumentUpload.array('files', MAX_VOUCHER_DOCUMENTS),
  handleWithSuccessFlag(uploadVoucherDocuments),
);
router.post(
  '/documents/claim',
  validateWith({ body: claimDocumentsBodySchema }),
  handleWithSuccessFlag(claimVoucherDocuments),
);
router.get('/documents', validateWith({ query: documentListQuerySchema }), handleWithSuccessFlag(getVoucherDocuments));
router.delete('/documents/:id', handleWithSuccessFlag(removeVoucherDocument));

router.post('/gstr2b-match', gstr2bUpload.single('file'), handleWithSuccessFlag(matchGstr2bFile));
router.get('/pending-bills', validateWith({ query: pendingBillsQuerySchema }), handleWithSuccessFlag(getPendingBills));
router.get('/ledgers-by-group', handleWithSuccessFlag(getLedgersByGroup));

export default router;
