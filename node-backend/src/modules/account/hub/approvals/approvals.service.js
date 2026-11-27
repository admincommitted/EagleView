import { selectRows } from '../shared/hubQuery.service.js';
import { daysBetween, toNumber, todayIso } from '../shared/hubFormat.service.js';
import { ensureMasterTable } from '../shared/masterDefinitions.service.js';

const MAX_LISTED = 300;
const WAITING_CONDITION = "coalesce(v.status, 'Pending') NOT IN ('Approved', 'Rejected', 'Returned')";
const DECIDED_CONDITION = "v.status IN ('Approved', 'Rejected', 'Returned')";

// a rule applies to its voucher type within its amount range (no "to" amount = no upper limit)
const ruleApplies = (rule, voucher, amount) =>
  String(rule.voucherType || '').toUpperCase() === String(voucher.baseType || '').toUpperCase() &&
  (rule.fromAmount == null || amount >= toNumber(rule.fromAmount)) &&
  (rule.toAmount == null || !toNumber(rule.toAmount) || amount <= toNumber(rule.toAmount));

/** Vouchers waiting for approval (state "pending") or recently decided, with the approvers whose rule applies. */
export async function listApprovals(state) {
  await ensureMasterTable('approvals');
  const rules = await selectRows('SELECT * FROM AccApprovalRules WHERE coalesce(isActive, 1) = 1 ORDER BY level');
  const pending = state === 'pending';
  const vouchers =
    await selectRows(`SELECT v.id, v.voucherNumber, v.date, v.totalAmount, v.status, v.narration, v.refNo, v.jobNo, v.branchCode, v.createdByName, v.rejectionReason, v.updatedAt, t.name typeName, t.baseType,
        (SELECT group_concat(l.name || '~' || d.dc || '~' || d.amount, '|') FROM VoucherDetails d JOIN AccountLedgers l ON l.id = d.ledgerId WHERE d.voucherId = v.id) accounts
        FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE ${pending ? WAITING_CONDITION : DECIDED_CONDITION} ORDER BY ${pending ? 'v.date, v.id' : 'v.updatedAt DESC'} LIMIT ${MAX_LISTED}`);
  const today = todayIso();
  return {
    rules,
    rows: vouchers.map((voucher) => {
      const amount = toNumber(voucher.totalAmount);
      const approvers = rules
        .filter((rule) => ruleApplies(rule, voucher, amount))
        .map((rule) => rule.approverName)
        .join(', ');
      return { ...voucher, approvers, age: daysBetween(voucher.date, today) };
    }),
  };
}
