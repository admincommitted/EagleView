import { Op } from 'sequelize';
import { BadRequestError, NotFoundError } from '../../../core/http/index.js';
import { AccountGroup, AccountLedger, Budget, CostCentre, Voucher, VoucherDetail } from '../../../models/index.js';

const BUDGET_BASES = ['LEDGER', 'GROUP', 'COST_CENTRE'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_WARN_AT_PCT = 80;
const MIN_WARN_PCT = 1;
const MAX_WARN_PCT = 200;
const OVER_BUDGET = 'Over budget';

const NOTE_WITH_BUDGETS =
  'Utilisation is the Dr total on each budget’s own ledger / group / cost centre inside its own ' +
  'dates. It is computed fresh every time, never stored, so it cannot drift from the books.';
const NOTE_WITHOUT_BUDGETS =
  'No budget has been created yet. A budget is set against one ledger, an account group or a ' +
  'cost centre so that utilisation can actually be measured.';

const round2 = (value) => Math.round((value || 0) * 100) / 100;
const budgetNotFound = () =>
  new NotFoundError('Budget not found', { body: { success: false, error: 'Budget not found' } });

// every id under (and including) one root of a parent / child master
function familyIds(rows, rootId) {
  const ids = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const row of rows) {
      if (row.parentId && ids.has(row.parentId) && !ids.has(row.id)) {
        ids.add(row.id);
        grew = true;
      }
    }
  }
  return [...ids];
}

const groupFamily = async (rootId) => familyIds(await AccountGroup.findAll(), rootId);
const centreFamily = async (rootId) => familyIds(await CostCentre.findAll(), rootId);

const nameOrMissing = (row, label, id) => (row ? row.name : '(' + label + ' ' + id + ' no longer exists)');

/** Which voucher lines count for a budget, and the name of what it is set on. */
async function budgetTarget(budget) {
  if (budget.basis === 'COST_CENTRE') {
    const ids = await centreFamily(budget.targetId);
    const centre = await CostCentre.findByPk(budget.targetId);
    return {
      lineFilter: { costCentreId: { [Op.in]: ids } },
      name: nameOrMissing(centre, 'cost centre', budget.targetId),
    };
  }
  if (budget.basis === 'GROUP') {
    const groupIds = await groupFamily(budget.targetId);
    const ledgers = await AccountLedger.findAll({ where: { groupId: { [Op.in]: groupIds } }, attributes: ['id'] });
    const group = await AccountGroup.findByPk(budget.targetId);
    const name = nameOrMissing(group, 'group', budget.targetId);
    if (!ledgers.length) return { lineFilter: null, name };
    return { lineFilter: { ledgerId: { [Op.in]: ledgers.map((ledger) => ledger.id) } }, name };
  }
  const ledger = await AccountLedger.findByPk(budget.targetId);
  return { lineFilter: { ledgerId: budget.targetId }, name: nameOrMissing(ledger, 'ledger', budget.targetId) };
}

// what has actually been spent against this budget in its own period
async function utilisationOf(budget) {
  const vouchers = await Voucher.findAll({
    where: { date: { [Op.between]: [budget.fromDate, budget.toDate] } },
    attributes: ['id'],
  });
  const voucherIds = vouchers.map((voucher) => voucher.id);
  if (!voucherIds.length) return { used: 0, lines: 0, target: '' };
  const target = await budgetTarget(budget);
  if (!target.lineFilter) return { used: 0, lines: 0, target: target.name };
  const lines = await VoucherDetail.findAll({ where: { voucherId: { [Op.in]: voucherIds }, ...target.lineFilter } });
  // spend is the Dr side; a credit back to the head reduces it
  const used = lines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0) * (line.dc === 'Dr' ? 1 : -1), 0);
  return { used: round2(used), lines: lines.length, target: target.name };
}

function budgetState(allocated, used, utilisedPct, warnAtPct) {
  if (allocated <= 0) return 'No allocation set';
  if (used > allocated) return OVER_BUDGET;
  return utilisedPct >= warnAtPct ? 'Near the limit' : 'Within budget';
}

async function budgetView(budget) {
  const utilisation = await utilisationOf(budget);
  const allocated = round2(parseFloat(budget.allocated) || 0);
  const utilisedPct = allocated > 0 ? Math.round((utilisation.used / allocated) * 1000) / 10 : null;
  return {
    id: budget.id,
    name: budget.name,
    basis: budget.basis,
    targetId: budget.targetId,
    target: utilisation.target,
    fromDate: budget.fromDate,
    toDate: budget.toDate,
    allocated,
    utilized: utilisation.used,
    variance: round2(allocated - utilisation.used),
    utilisedPct,
    warnAtPct: budget.warnAtPct,
    state: budgetState(allocated, utilisation.used, utilisedPct, budget.warnAtPct),
    voucherLines: utilisation.lines,
    notes: budget.notes || '',
    createdByName: budget.createdByName || '',
  };
}

export async function listBudgets() {
  const budgets = await Budget.findAll({
    order: [
      ['fromDate', 'DESC'],
      ['name', 'ASC'],
    ],
  });
  const data = [];
  for (const budget of budgets) data.push(await budgetView(budget));
  return {
    success: true,
    data,
    totals: {
      allocated: round2(data.reduce((sum, row) => sum + row.allocated, 0)),
      utilized: round2(data.reduce((sum, row) => sum + row.utilized, 0)),
      overBudget: data.filter((row) => row.state === OVER_BUDGET).length,
    },
    note: data.length ? NOTE_WITH_BUDGETS : NOTE_WITHOUT_BUDGETS,
  };
}

// the pickable targets, so the create form is not a free-text box
export async function budgetTargets() {
  const [groups, ledgers, centres] = await Promise.all([
    AccountGroup.findAll({ order: [['name', 'ASC']] }),
    AccountLedger.findAll({ order: [['name', 'ASC']] }),
    CostCentre.findAll({ order: [['name', 'ASC']] }),
  ]);
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  return {
    success: true,
    groups: groups.map((group) => ({ id: group.id, name: group.name, nature: group.nature })),
    ledgers: ledgers.map((ledger) => ({
      id: ledger.id,
      name: ledger.name,
      group: (groupsById.get(ledger.groupId) || {}).name || '',
    })),
    costCentres: centres.map((centre) => ({ id: centre.id, name: centre.name })),
  };
}

async function targetExists(basis, id) {
  if (basis === 'GROUP') return AccountGroup.findByPk(id);
  if (basis === 'COST_CENTRE') return CostCentre.findByPk(id);
  return AccountLedger.findByPk(id);
}

const isGiven = (budget, partial, ...keys) => !partial || keys.some((key) => budget[key] !== undefined);

/** Every problem of a budget, in the order the screen lists them. `partial` checks only the fields sent. */
async function budgetProblems(budget, partial) {
  const problems = [];
  const basis = String(budget.basis || 'LEDGER').toUpperCase();
  if (isGiven(budget, partial, 'basis') && !BUDGET_BASES.includes(basis)) {
    problems.push('Basis must be LEDGER, GROUP or COST_CENTRE');
  }
  if (isGiven(budget, partial, 'name') && !String(budget.name || '').trim()) problems.push('Give the budget a name');
  if (isGiven(budget, partial, 'targetId')) {
    const id = parseInt(budget.targetId, 10);
    if (!id) problems.push('Pick what the budget is set against');
    else if (!(await targetExists(basis, id)))
      problems.push('That ' + basis.toLowerCase().replace('_', ' ') + ' does not exist');
  }
  if (isGiven(budget, partial, 'fromDate', 'toDate')) {
    const from = String(budget.fromDate || '').slice(0, 10);
    const to = String(budget.toDate || '').slice(0, 10);
    if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) problems.push('Give a from and to date');
    else if (from > to) problems.push('The from date is after the to date');
  }
  if (isGiven(budget, partial, 'allocated')) {
    const allocated = parseFloat(budget.allocated);
    if (!Number.isFinite(allocated) || allocated < 0) problems.push('Allocated amount must be a number, zero or more');
  }
  if (budget.warnAtPct !== undefined) {
    const warnAt = parseInt(budget.warnAtPct, 10);
    if (!(warnAt >= MIN_WARN_PCT && warnAt <= MAX_WARN_PCT))
      problems.push('Warn-at percentage must be between 1 and 200');
  }
  return problems;
}

async function checkBudget(budget, partial) {
  const problems = await budgetProblems(budget, partial);
  if (!problems.length) return;
  const message = problems.join('; ');
  throw new BadRequestError(message, { body: { success: false, error: message, errors: problems } });
}

export async function createBudget(body, createdByName) {
  const budget = body || {};
  await checkBudget(budget, false);
  const row = await Budget.create({
    name: String(budget.name).trim(),
    basis: String(budget.basis || 'LEDGER').toUpperCase(),
    targetId: parseInt(budget.targetId, 10),
    fromDate: String(budget.fromDate).slice(0, 10),
    toDate: String(budget.toDate).slice(0, 10),
    allocated: parseFloat(budget.allocated),
    warnAtPct: budget.warnAtPct !== undefined ? parseInt(budget.warnAtPct, 10) : DEFAULT_WARN_AT_PCT,
    notes: budget.notes ? String(budget.notes) : null,
    createdByName,
  });
  return { success: true, data: row };
}

/** Only the fields that were sent change. */
function changedBudgetValues(body) {
  const values = {};
  for (const key of ['name', 'basis', 'notes']) {
    if (body[key] !== undefined) values[key] = body[key] == null ? null : String(body[key]);
  }
  if (values.basis) values.basis = values.basis.toUpperCase();
  if (body.targetId !== undefined) values.targetId = parseInt(body.targetId, 10);
  if (body.fromDate !== undefined) values.fromDate = String(body.fromDate).slice(0, 10);
  if (body.toDate !== undefined) values.toDate = String(body.toDate).slice(0, 10);
  if (body.allocated !== undefined) values.allocated = parseFloat(body.allocated);
  if (body.warnAtPct !== undefined) values.warnAtPct = parseInt(body.warnAtPct, 10);
  return values;
}

export async function updateBudget(id, body) {
  const row = await Budget.findByPk(id);
  if (!row) throw budgetNotFound();
  await checkBudget({ ...row.toJSON(), ...body }, true);
  await row.update(changedBudgetValues(body));
  return { success: true, data: row };
}

export async function deleteBudget(id) {
  const row = await Budget.findByPk(id);
  if (!row) throw budgetNotFound();
  await row.destroy();
  return { success: true };
}
