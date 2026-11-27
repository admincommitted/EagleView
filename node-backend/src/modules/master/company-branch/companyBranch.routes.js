import { Router } from 'express';
import { companyMasterErrorAnswer, routeHandler } from '../shared/errorAnswers.js';
import {
  createCompanyBranch,
  deleteCompanyBranch,
  listCompanyBranches,
  resetDefaultBranch,
  updateCompanyBranch,
} from './companyBranch.controller.js';

const router = Router();

router.get('/company-branches', routeHandler(listCompanyBranches, companyMasterErrorAnswer));
router.post('/company-branches', routeHandler(createCompanyBranch, companyMasterErrorAnswer));
router.put('/company-branches/reset-default', resetDefaultBranch);
router.put('/company-branches/:id', routeHandler(updateCompanyBranch, companyMasterErrorAnswer));
router.delete('/company-branches/:id', routeHandler(deleteCompanyBranch, companyMasterErrorAnswer));

export default router;
