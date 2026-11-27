import { Router } from 'express';
import { handleRoute, successFalseBody } from '../shared/routeHandler.js';
import { addBudget, changeBudget, getBudgetTargets, getBudgets, removeBudget } from './budget.controller.js';

const router = Router();
const handle = (controller) => handleRoute(controller, { errorBody: successFalseBody });

router.get('/', handle(getBudgets));
router.get('/targets', handle(getBudgetTargets));
router.post('/', handle(addBudget));
router.put('/:id', handle(changeBudget));
router.delete('/:id', handle(removeBudget));

export default router;
