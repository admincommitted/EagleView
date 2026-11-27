import { Router } from 'express';
import chaRoutes from './cha/cha.routes.js';
import companyBranchRoutes from './company-branch/companyBranch.routes.js';
import coreMastersRoutes from './core-masters/coreMasters.routes.js';
import currencyRoutes from './currency/currency.routes.js';
import dutyNotificationRoutes from './duty-notification/dutyNotification.routes.js';
import financialYearRoutes from './financial-year/financialYear.routes.js';
import jobSequenceRoutes from './job-sequence/jobSequence.routes.js';
import kycRoutes from './kyc/kyc.routes.js';
import newsRoutes from './news/news.routes.js';
import { clearPartyCacheOnWrite } from './party/party.controller.js';
import partyRoutes from './party/party.routes.js';
import sphRoutes from './sph/sph.routes.js';
import tariffHeaderRoutes from './tariff-header/tariffHeader.routes.js';

/**
 * /api/masters. Express answers with the first matching route, so the sub-routers are mounted in this order: the
 * fixed paths (/parties/search, /company-branches, /job-sequences/status ...) before the generic /:category routes,
 * and POST /parties (inside coreMastersRoutes) before POST /:category.
 */
const router = Router();

router.use(clearPartyCacheOnWrite);
router.use(partyRoutes);
router.use(sphRoutes);
router.use(currencyRoutes);
router.use(dutyNotificationRoutes);
router.use(tariffHeaderRoutes);
router.use(newsRoutes);
router.use(companyBranchRoutes);
router.use(financialYearRoutes);
router.use(chaRoutes);
router.use(jobSequenceRoutes);
router.use(coreMastersRoutes);
router.use(kycRoutes);

export default router;
