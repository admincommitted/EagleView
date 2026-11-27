import { selectRows } from '../shared/hubQuery.service.js';
import { dayBefore, round2, todayIso } from '../shared/hubFormat.service.js';
import { loadGroupTree } from '../shared/groupTree.service.js';
import { NO_MOVEMENT, ledgerMovements, signedOpening } from '../shared/ledgerMovements.service.js';
import { findFinancialYear, yearSummary } from '../shared/financialYear.service.js';

// Balance Sheet / Profit & Loss / Trial Balance: one group tree with every ledger's opening (as at From), Dr / Cr of
// the period and closing (as at To), in the branch scope of the top bar. The screen totals it per group, so the same
// data can be shown, printed and exported at any level (main groups, all groups, groups + ledgers).

const MAX_GROUP_DEPTH = 20;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PROFIT_AND_LOSS_ACCOUNT = /^profit\s*(and|&)\s*loss\s*a\/?c/i;
const CARRIED_FORWARD_LINE = 'Difference in opening balances (income / expense of earlier years)';

const isoDateOrNull = (value) => (ISO_DATE.test(String(value || '')) ? String(value) : null);

/** Nature of a group: the nature found walking up to its top group (the top-most one that has a nature wins). */
function natureLookup(byId) {
  const natureByGroup = new Map();
  return (groupId) => {
    if (natureByGroup.has(groupId)) return natureByGroup.get(groupId);
    let group = byId.get(groupId);
    let depth = 0;
    let nature = null;
    while (group && depth++ < MAX_GROUP_DEPTH) {
      if (group.nature) nature = group.nature;
      if (!group.parentId) break;
      group = byId.get(group.parentId);
    }
    natureByGroup.set(groupId, nature);
    return nature;
  };
}

const financialYearStartOfDate = (isoDate) =>
  (isoDate.slice(5) >= '04-01' ? isoDate.slice(0, 4) : String(Number(isoDate.slice(0, 4)) - 1)) + '-04-01';

/**
 * Income and expense accounts start every financial year at 0 (as in iCAFFE / Tally): their opening is only what was
 * booked from 1 April of the year of "from" up to the day before. The earlier years' net (the books' carried-forward
 * profit sits in PROFIT AND LOSS A/C) is shown on one line, "Difference in opening balances", so the statement tallies.
 */
export async function buildFinancialStatement(query) {
  const year = await findFinancialYear(query.fyId);
  const to = isoDateOrNull(query.to) || (todayIso() < year.endDate ? todayIso() : year.endDate);
  const from = isoDateOrNull(query.from) || year.startDate;
  const { groups, byId } = await loadGroupTree();
  const ledgers = await selectRows('SELECT id, name, groupId, openingBalance, balanceType FROM AccountLedgers');
  const before = await ledgerMovements(null, dayBefore(from));
  const inPeriod = await ledgerMovements(from, to);
  const natureOf = natureLookup(byId);
  const yearStart = financialYearStartOfDate(from);
  const beforeYear = yearStart < from ? await ledgerMovements(null, dayBefore(yearStart)) : before;
  const rows = [];
  let carried = 0;
  for (const ledger of ledgers) {
    const earlier = before.get(ledger.id) || NO_MOVEMENT;
    const movement = inPeriod.get(ledger.id) || NO_MOVEMENT;
    let opening = round2(signedOpening(ledger) + earlier.dr - earlier.cr);
    const debit = round2(movement.dr);
    const credit = round2(movement.cr);
    if (/^(Income|Expenses)$/.test(natureOf(ledger.groupId) || '')) {
      const earlierYears = beforeYear.get(ledger.id) || NO_MOVEMENT;
      const previousYears = round2(signedOpening(ledger) + earlierYears.dr - earlierYears.cr);
      if (previousYears) {
        carried += previousYears;
        opening = round2(opening - previousYears);
      }
    }
    if (!opening && !debit && !credit) continue;
    rows.push({
      id: ledger.id,
      name: ledger.name,
      g: ledger.groupId,
      op: opening,
      dr: debit,
      cr: credit,
      cl: round2(opening + debit - credit),
    });
  }
  carried = round2(carried);
  if (carried) {
    const profitAndLoss = ledgers.find((ledger) => PROFIT_AND_LOSS_ACCOUNT.test(String(ledger.name || '').trim()));
    const groupId =
      (profitAndLoss && profitAndLoss.groupId) ||
      (groups.find((group) => !group.parentId && group.nature === 'Liabilities') || {}).id;
    rows.push({ id: -1, name: CARRIED_FORWARD_LINE, g: groupId, op: carried, dr: 0, cr: 0, cl: carried });
  }
  return {
    from,
    to,
    fy: yearSummary(year),
    groups: groups.map((group) => ({ id: group.id, name: group.name, p: group.parentId || null, n: group.nature })),
    ledgers: rows,
  };
}
