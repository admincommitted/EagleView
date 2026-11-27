import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware.js';
import { handleRoute, successFalseBody } from '../shared/routeHandler.js';
import {
  changeFollowUp,
  changePolicy,
  createFollowUp,
  getAgeing,
  getPartyCredit,
  matchLedger,
} from './creditControl.controller.js';
import { creditControlErrorBody, followUpBodySchema, ledgerMatchBodySchema } from './creditControl.validation.js';

const router = Router();
const handle = (controller) => handleRoute(controller, { errorBody: successFalseBody });
const validateBody = (body) => validate({ body }, { errorBody: creditControlErrorBody });

router.get('/ageing', handle(getAgeing));
router.get('/party/:ledgerId', handle(getPartyCredit));
router.post('/followups', validateBody(followUpBodySchema), handle(createFollowUp));
router.put('/followups/:id', handle(changeFollowUp));
router.put('/policy/:ledgerId', handle(changePolicy));
router.post('/ledger-match', validateBody(ledgerMatchBodySchema), handle(matchLedger));

export default router;
