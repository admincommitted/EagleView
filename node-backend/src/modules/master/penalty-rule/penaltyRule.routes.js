import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware.js';
import { failedMessageAnswer, routeHandler } from '../shared/errorAnswers.js';
import { createPenaltyRule, deletePenaltyRule, listPenaltyRules, updatePenaltyRule } from './penaltyRule.controller.js';
import { penaltyRuleErrorBody, penaltyRuleSchema } from './penaltyRule.validation.js';

const checkRule = validate({ body: penaltyRuleSchema }, { errorBody: penaltyRuleErrorBody });

/** /api/penalty-rules */
const router = Router();

router.get('/', routeHandler(listPenaltyRules, failedMessageAnswer));
router.post('/', checkRule, routeHandler(createPenaltyRule, failedMessageAnswer));
router.put('/:id', checkRule, routeHandler(updatePenaltyRule, failedMessageAnswer));
router.delete('/:id', routeHandler(deletePenaltyRule, failedMessageAnswer));

export default router;
