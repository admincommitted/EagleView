import { Router } from 'express';
import { asyncHandler } from '../../core/http/index.js';
import * as reports from './reports.controller.js';

const router = Router();

const failure = (logLabel) => ({ errorBody: reports.failureBody(logLabel) });

router.get('/forwarder-transactions', asyncHandler(reports.forwarderTransactions, failure('Report error:')));
router.get('/export-data', asyncHandler(reports.exportData, failure('Export data error:')));
router.get('/tonnage', asyncHandler(reports.tonnageReport, failure()));
router.get('/csr', asyncHandler(reports.csrReport, failure()));
router.get('/awb-agents', asyncHandler(reports.listAwbAgents, failure()));
router.get('/csr-periods', asyncHandler(reports.listCsrPeriods));
router.get('/mis', asyncHandler(reports.directorMis));
router.get('/unbilled-jobs', asyncHandler(reports.unbilledJobs));
router.get('/expenses', asyncHandler(reports.expenseRegister, failure()));
router.get('/collection', asyncHandler(reports.collectionReport, failure()));

export default router;
