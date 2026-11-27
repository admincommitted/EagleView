import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware.js';
import dutyListRoutes from '../duty-list/dutyList.routes.js';
import { failedMessageAnswer, routeHandler } from '../shared/errorAnswers.js';
import { antiDumpingDuties, bcdExemptions, ftaConcessions, tariffLookup } from './tariff.controller.js';
import { cthParamsSchema, exemptionParamsSchema, ritcParamsSchema, tariffErrorBody } from './tariff.validation.js';

const checkParams = (schema) => validate({ params: schema }, { errorBody: tariffErrorBody });

/** /api/tariff */
const router = Router();

// the Customs Duty Lists screen; mounted before '/:ritc'
router.use('/dutylists', dutyListRoutes);
router.get('/exemptions/:ritc', checkParams(exemptionParamsSchema), routeHandler(bcdExemptions, failedMessageAnswer));
router.get('/fta/:cth', checkParams(cthParamsSchema), routeHandler(ftaConcessions, failedMessageAnswer));
router.get('/add/:cth', checkParams(cthParamsSchema), routeHandler(antiDumpingDuties, failedMessageAnswer));
router.get('/:ritc', checkParams(ritcParamsSchema), routeHandler(tariffLookup, failedMessageAnswer));

export default router;
