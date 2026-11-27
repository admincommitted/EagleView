import { Router } from 'express';
import { validate } from '../../../../middlewares/validate.middleware.js';
import { OLD_ERROR_SHAPE, handleHubRoute } from '../shared/hubHttp.js';
import { ledgerReportQuery } from './ledgerReport.validation.js';
import { getLedgerReport } from './ledgerReport.controller.js';

const router = Router();

router.get('/ledger-report', validate({ query: ledgerReportQuery }, OLD_ERROR_SHAPE), handleHubRoute(getLedgerReport));

export default router;
