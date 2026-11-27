import { userNameOf } from '../shared/routeHandler.js';
import { budgetTargets, createBudget, deleteBudget, listBudgets, updateBudget } from './budget.service.js';

export async function getBudgets(req, res) {
  res.json(await listBudgets());
}

export async function getBudgetTargets(req, res) {
  res.json(await budgetTargets());
}

export async function addBudget(req, res) {
  res.json(await createBudget(req.body, userNameOf(req)));
}

export async function changeBudget(req, res) {
  res.json(await updateBudget(req.params.id, req.body));
}

export async function removeBudget(req, res) {
  res.json(await deleteBudget(req.params.id));
}
