import { Router } from 'express';
import { companyMasterErrorAnswer, routeHandler } from '../shared/errorAnswers.js';
import {
  createFinancialYear,
  deleteFinancialYear,
  listFinancialYears,
  updateFinancialYear,
} from './financialYear.controller.js';

const router = Router();

router.get('/financial-years', routeHandler(listFinancialYears));
router.post('/financial-years', routeHandler(createFinancialYear, companyMasterErrorAnswer));
router.put('/financial-years/:id', routeHandler(updateFinancialYear, companyMasterErrorAnswer));
router.delete('/financial-years/:id', routeHandler(deleteFinancialYear, companyMasterErrorAnswer));

export default router;
