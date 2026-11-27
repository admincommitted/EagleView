import { Router } from 'express';
import mastersRoutes from './masters/masters.routes.js';
import lookupsRoutes from './lookups/lookups.routes.js';
import summaryRoutes from './summary/summary.routes.js';
import reportsRoutes from './reports/reports.routes.js';
import monthClosingRoutes from './month-closing/monthClosing.routes.js';
import voucherDeskRoutes from './voucher-desk/voucherDesk.routes.js';
import groupsRoutes from './groups/groups.routes.js';
import ledgersRoutes from './ledgers/ledgers.routes.js';
import tdsScheduleRoutes from './tds-schedule/tdsSchedule.routes.js';
import chequeBooksRoutes from './cheque-books/chequeBooks.routes.js';
import jobClosingRoutes from './job-closing/jobClosing.routes.js';
import tdsPayableRoutes from './tds-payable/tdsPayable.routes.js';
import approvalsRoutes from './approvals/approvals.routes.js';
import ledgerReportRoutes from './ledger-report/ledgerReport.routes.js';
import voucherChangesRoutes from './voucher-changes/voucherChanges.routes.js';
import purchaseInfoRoutes from './purchase-info/purchaseInfo.routes.js';
import interBranchRoutes from './inter-branch/interBranch.routes.js';
import ocrBillRoutes from './ocr-bill/ocrBill.routes.js';
import bankReconciliationRoutes from './bank-reconciliation/bankReconciliation.routes.js';
import dashboardRoutes from './dashboard/dashboard.routes.js';
import ledgerBalanceRoutes from './ledger-balance/ledgerBalance.routes.js';
import searchRoutes from './search/search.routes.js';
import mergeLedgersRoutes from './merge-ledgers/mergeLedgers.routes.js';
import finStatementRoutes from './fin-statement/finStatement.routes.js';

// /api/accounts-hub (the branch / year scope middleware runs before it; /gst-invoice is mounted ahead of this router).
// The topics are mounted in the order their routes had in one file, so every request still meets the routes in the
// same order.
const router = Router();

router.use(mastersRoutes);
router.use(lookupsRoutes);
router.use(summaryRoutes);
router.use(reportsRoutes);
router.use(monthClosingRoutes);
router.use(voucherDeskRoutes);
router.use(groupsRoutes);
router.use(ledgersRoutes);
router.use(tdsScheduleRoutes);
router.use(chequeBooksRoutes);
router.use(jobClosingRoutes);
router.use(tdsPayableRoutes);
router.use(approvalsRoutes);
router.use(ledgerReportRoutes);
router.use(voucherChangesRoutes);
router.use(purchaseInfoRoutes);
router.use(interBranchRoutes);
router.use(ocrBillRoutes);
router.use(bankReconciliationRoutes);
router.use(dashboardRoutes);
router.use(ledgerBalanceRoutes);
router.use(searchRoutes);
router.use(mergeLedgersRoutes);
router.use(finStatementRoutes);

export default router;
