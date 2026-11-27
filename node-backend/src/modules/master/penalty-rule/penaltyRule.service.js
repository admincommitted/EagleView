import { Op } from 'sequelize';
import { ConflictError, NotFoundError } from '../../../core/http/index.js';
import { PenaltyRule } from '../../../models/index.js';

const failed = (ErrorClass, message) => new ErrorClass(message, { body: { success: false, message } });
const ruleNotFound = () => failed(NotFoundError, 'Rule not found');

/** The saved columns, in the column order of the rule (values already checked by penaltyRuleSchema). */
const ruleValuesOf = (rule) => ({
  tradeType: rule.tradeType,
  type: rule.type,
  mode: rule.mode,
  basis: rule.basis,
  rateUom: rule.rateUom,
  freeDays: rule.freeDays,
  slab1Rate: rule.slab1Rate,
  slab2Rate: rule.slab2Rate,
  slab3Rate: rule.slab3Rate,
});

/** One rule per trade + type + mode. */
const findDuplicate = (values, exceptId) =>
  PenaltyRule.findOne({
    where: {
      tradeType: values.tradeType,
      type: values.type,
      mode: values.mode,
      ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}),
    },
  });

export const listPenaltyRules = () => PenaltyRule.findAll();

export async function createPenaltyRule(rule) {
  const values = ruleValuesOf(rule);
  if (await findDuplicate(values)) {
    throw failed(
      ConflictError,
      `A ${values.tradeType} ${values.type} rule for ${values.mode} already exists - edit that one`,
    );
  }
  return PenaltyRule.create(values);
}

export async function updatePenaltyRule(id, rule) {
  const values = ruleValuesOf(rule);
  const savedRule = await PenaltyRule.findByPk(id);
  if (!savedRule) throw ruleNotFound();
  if (await findDuplicate(values, savedRule.id)) {
    throw failed(ConflictError, `A ${values.tradeType} ${values.type} rule for ${values.mode} already exists`);
  }
  await savedRule.update(values);
  return savedRule;
}

export async function deletePenaltyRule(id) {
  const deletedCount = await PenaltyRule.destroy({ where: { id } });
  if (!deletedCount) throw ruleNotFound();
}
