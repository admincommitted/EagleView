import * as penaltyRuleService from './penaltyRule.service.js';

export async function listPenaltyRules(req, res) {
  res.json({ success: true, data: await penaltyRuleService.listPenaltyRules() });
}

export async function createPenaltyRule(req, res) {
  const rule = await penaltyRuleService.createPenaltyRule(req.validated.body);
  res.json({ success: true, data: rule, message: 'Rule created successfully' });
}

export async function updatePenaltyRule(req, res) {
  const rule = await penaltyRuleService.updatePenaltyRule(req.params.id, req.validated.body);
  res.json({ success: true, data: rule, message: 'Rule updated successfully' });
}

export async function deletePenaltyRule(req, res) {
  await penaltyRuleService.deletePenaltyRule(req.params.id);
  res.json({ success: true, message: 'Rule deleted successfully' });
}
