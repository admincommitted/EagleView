import { fyId as financialYearOfScope, scopeKey } from '../../../../middlewares/branchScope.middleware.js';
import { buildManagementDashboard } from '../../dash-mgmt/dashMgmt.service.js';
import { VALID_VOUCHER, readRows, selectRows, selectRowsOrEmpty } from '../shared/hubQuery.service.js';
import { daysBetween, round2, todayIso } from '../shared/hubFormat.service.js';
import { loadGroupTree, natureGroupIds, normalisedGroupName } from '../shared/groupTree.service.js';
import { ensureMonthClosingTable } from '../shared/hubTables.service.js';
import { NO_MOVEMENT, ledgerMovements, signedOpening, voucherDataVersion } from '../shared/ledgerMovements.service.js';
import { findFinancialYear, yearSummary } from '../shared/financialYear.service.js';
import {
  addLedgerLineTotals,
  addVoucherTypeTotals,
  ageingSide,
  emptyYearMonths,
  partyBillLines,
  topHeads,
} from './dashboardFigures.service.js';

// The Accounts dashboard (Accounts > Home): one answer with everything it shows for a financial year. It is cached per
// year + day + branch scope + user until vouchers / ledgers change, and a second user asking for a dashboard that is
// being worked out waits for that run instead of starting another.
const MAX_CACHED_DASHBOARDS = 10;
const PENDING_LISTED = 6;
const RECENT_LISTED = 8;
const PAISA_HALF = 0.005;

const dashboardCache = new Map();
const dashboardsRunning = new Map();

async function dashboardCacheKey(requestedYearId, user) {
  const ledgerChange = (await selectRows('SELECT count(*) n, max(updatedAt) up FROM AccountLedgers'))[0].up;
  return [
    await voucherDataVersion(),
    ledgerChange,
    requestedYearId || financialYearOfScope() || '',
    todayIso(),
    scopeKey(),
    (user && user.id) || '',
  ].join('#');
}

// read with readRows / selectRows; a figure that cannot be read is left empty
async function firstRowOf(readFunction, sql, replacements = []) {
  try {
    return (await readFunction(sql, replacements))[0] || {};
  } catch {
    return {};
  }
}

async function dashboardGroups() {
  const groupTree = await loadGroupTree();
  const { groups, descendants } = groupTree;
  const groupsNamed = (...names) =>
    descendants(groups.filter((group) => names.includes(normalisedGroupName(group.name))).map((group) => group.id));
  return {
    groupTree,
    debtorGroups: groupsNamed('sundry debtors'),
    creditorGroups: groupsNamed('sundry creditors'),
    bankGroups: groupsNamed('bank accounts', 'cash-in-hand', 'bank od a/c'),
    taxGroups: groupsNamed('duties & taxes'),
    incomeGroups: natureGroupIds(groupTree, 'Income'),
    expenseGroups: natureGroupIds(groupTree, 'Expenses'),
  };
}

async function controlFigures(year, asOn) {
  const pendingList =
    await selectRowsOrEmpty(`SELECT v.id, v.voucherNumber, v.date, v.totalAmount, t.name typeName, t.baseType, v.createdByName FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId
        WHERE coalesce(v.status, 'Pending') NOT IN ('Approved', 'Rejected') ORDER BY v.date DESC LIMIT ${PENDING_LISTED}`);
  const pending = await firstRowOf(
    selectRows,
    `SELECT count(*) n, sum(totalAmount) amt FROM Vouchers WHERE coalesce(status, 'Pending') NOT IN ('Approved', 'Rejected')`,
  );
  const recent =
    await selectRowsOrEmpty(`SELECT v.id, v.voucherNumber, v.date, v.totalAmount, v.status, t.name typeName, t.baseType,
        (SELECT l.name FROM VoucherDetails d JOIN AccountLedgers l ON l.id = d.ledgerId WHERE d.voucherId = v.id ORDER BY d.amount DESC LIMIT 1) party
        FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId ORDER BY v.id DESC LIMIT ${RECENT_LISTED}`);
  const unbalanced = await firstRowOf(
    readRows,
    `SELECT count(*) n FROM (SELECT d.voucherId, sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) diff FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
        WHERE v.date >= ? AND v.date <= ? GROUP BY d.voucherId HAVING abs(diff) > 0.01)`,
    [year.startDate, year.endDate],
  );
  let closedMonths = 0;
  try {
    await ensureMonthClosingTable();
    closedMonths =
      (
        await firstRowOf(
          selectRows,
          'SELECT count(*) n FROM AccMonthClosings WHERE isClosed = 1 AND month >= ? AND month <= ?',
          [year.startDate.slice(0, 7), year.endDate.slice(0, 7)],
        )
      ).n || 0;
  } catch {
    // no closing register yet
  }
  const rejected = await firstRowOf(
    selectRows,
    `SELECT count(*) n FROM Vouchers WHERE status = 'Rejected' AND date >= ? AND date <= ?`,
    [year.startDate, asOn],
  );
  return { pendingList, pending, recent, unbalanced, closedMonths, rejected };
}

// management view: profit before tax & transfers, gross margin, reimbursable, divisions, branches, customers, unbilled
// jobs, billing vs collection, next 30 days, last year, budget, due dates, bank reconciliation
async function managementFigures(args) {
  try {
    return await buildManagementDashboard(args);
  } catch (error) {
    console.error('dashboard mgmt', error);
    return { error: error.message };
  }
}

const amountOfType = (byType, baseType) => round2((byType[baseType] || {}).amt || 0);

async function buildDashboard(requestedYearId, user) {
  const year = await findFinancialYear(requestedYearId);
  const asOn = todayIso() < year.endDate ? todayIso() : year.endDate;
  const { groupTree, debtorGroups, creditorGroups, bankGroups, taxGroups, incomeGroups, expenseGroups } =
    await dashboardGroups();
  const { groups, byId, path } = groupTree;
  const ledgers = await selectRows(
    'SELECT l.id, l.name, l.groupId, l.openingBalance, l.balanceType, l.creditDays, l.creditLimit, l.gstin, g.name groupName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId',
  );
  const closing = await ledgerMovements(null, asOn);
  const inYear = await ledgerMovements(year.startDate, asOn);
  const balanceOf = (ledger) => {
    const movement = closing.get(ledger.id) || NO_MOVEMENT;
    return round2(signedOpening(ledger) + movement.dr - movement.cr);
  };
  const yearMovementOf = (ledger) => inYear.get(ledger.id) || NO_MOVEMENT;

  // the year's lines per ledger, side and month (for months, GST, expenses)
  const lines = await readRows(
    `SELECT d.ledgerId, d.dc, sum(d.amount) amount, substr(v.date, 1, 7) date FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
        WHERE ${VALID_VOUCHER} AND v.date >= ? AND v.date <= ? GROUP BY d.ledgerId, d.dc, substr(v.date, 1, 7)`,
    [year.startDate, asOn],
  );
  const ledgerById = new Map(ledgers.map((ledger) => [ledger.id, ledger]));
  const { months, monthByKey } = emptyYearMonths(year.startDate);
  const typeMonthRows = await selectRows(
    `SELECT substr(v.date, 1, 7) m, t.baseType, count(*) n, sum(v.totalAmount) amt FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId
        WHERE ${VALID_VOUCHER} AND v.date >= ? AND v.date <= ? GROUP BY 1, 2`,
    [year.startDate, asOn],
  );
  const byType = addVoucherTypeTotals(typeMonthRows, monthByKey);
  const { tax, expenseByLedger, incomeByLedger } = addLedgerLineTotals(lines, ledgerById, monthByKey, {
    incomeGroups,
    expenseGroups,
    taxGroups,
  });
  const income = round2(months.reduce((sum, month) => sum + month.income, 0));
  const expense = round2(months.reduce((sum, month) => sum + month.expense, 0));

  const banks = ledgers
    .filter((ledger) => bankGroups.has(ledger.groupId))
    .map((ledger) => ({
      id: ledger.id,
      name: ledger.name,
      group: ledger.groupName,
      balance: balanceOf(ledger),
      inflow: round2(yearMovementOf(ledger).dr),
      outflow: round2(yearMovementOf(ledger).cr),
    }))
    .sort((first, second) => Math.abs(second.balance) - Math.abs(first.balance));

  const linesByLedger = await partyBillLines({ ledgers, balanceOf, debtorGroups, creditorGroups, asOn });
  const ageingArgs = { ledgers, balanceOf, linesByLedger, asOn, yearStart: year.startDate };
  const receivable = ageingSide({ ...ageingArgs, partyGroups: debtorGroups, side: 'Dr' });
  const payable = ageingSide({ ...ageingArgs, partyGroups: creditorGroups, side: 'Cr' });

  // tax position: closing balances of Duties & Taxes
  const taxes = ledgers
    .filter((ledger) => taxGroups.has(ledger.groupId))
    .map((ledger) => ({ id: ledger.id, name: ledger.name, balance: balanceOf(ledger) }))
    .filter((head) => Math.abs(head.balance) > PAISA_HALF);

  const control = await controlFigures(year, asOn);
  const isParty = (ledger) => debtorGroups.has(ledger.groupId) || creditorGroups.has(ledger.groupId);
  const noGstin = ledgers.filter((ledger) => isParty(ledger) && !ledger.gstin).length;
  const cash = round2(banks.reduce((sum, bank) => sum + bank.balance, 0));
  const mgmt = await managementFigures({
    q: readRows,
    VALID: VALID_VOUCHER,
    fy: year,
    asOn,
    ledgers,
    groups,
    byId,
    path,
    debtorG: debtorGroups,
    creditorG: creditorGroups,
    bankG: bankGroups,
    incomeG: incomeGroups,
    expenseG: expenseGroups,
    receivable,
    payable,
    months,
    cash,
    req: { user },
  });
  return {
    fy: yearSummary(year),
    asOn,
    counts: {
      groups: groups.length,
      ledgers: ledgers.length,
      vouchers: Object.values(byType).reduce((sum, type) => sum + type.n, 0),
      parties: ledgers.filter(isParty).length,
    },
    kpi: {
      sales: amountOfType(byType, 'Sales') - amountOfType(byType, 'Credit Note'),
      purchase: amountOfType(byType, 'Purchase') - amountOfType(byType, 'Debit Note'),
      receipts: amountOfType(byType, 'Receipt'),
      payments: amountOfType(byType, 'Payment'),
      income,
      expense,
      profit: round2(income - expense),
      margin: income ? Math.round(((income - expense) / income) * 1000) / 10 : null,
      cash,
      receivable: receivable.total,
      payable: payable.total,
      netWorking: round2(cash + receivable.total - payable.total),
      gstOut: round2(tax.gstOut),
      gstIn: round2(tax.gstIn),
      gstNet: round2(tax.gstOut - tax.gstIn),
      tds: round2(tax.tds),
      dso:
        receivable.total && income
          ? Math.round(receivable.total / (income / Math.max(1, daysBetween(year.startDate, asOn) + 1)))
          : null,
    },
    months,
    byType,
    banks,
    receivable,
    payable,
    topExpenses: topHeads(expenseByLedger, ledgerById),
    topIncome: topHeads(incomeByLedger, ledgerById),
    taxes,
    control: {
      pending: control.pending.n || 0,
      pendingAmt: round2(control.pending.amt || 0),
      pendingList: control.pendingList,
      rejected: control.rejected.n || 0,
      unbalanced: control.unbalanced.n || 0,
      closedMonths: control.closedMonths,
      noGstin,
      overLimit: receivable.overLimit,
    },
    recent: control.recent,
    mgmt,
  };
}

async function ignoreRejection(promise) {
  try {
    await promise;
  } catch {
    // the request that started the run answers the error
  }
}

// a run other requests can wait for
function startRun(cacheKey) {
  let resolve;
  let reject;
  const run = new Promise((onDone, onFail) => {
    resolve = onDone;
    reject = onFail;
  });
  ignoreRejection(run);
  dashboardsRunning.set(cacheKey, run);
  return { resolve, reject };
}

/** The dashboard for the year (cached; `refresh` works it out again). */
export async function getAccountsDashboard({ fyId, refresh, user }) {
  const cacheKey = await dashboardCacheKey(fyId, user);
  if (dashboardCache.has(cacheKey) && !refresh) return dashboardCache.get(cacheKey);
  if (dashboardsRunning.has(cacheKey)) return dashboardsRunning.get(cacheKey);
  const run = startRun(cacheKey);
  try {
    const dashboard = await buildDashboard(fyId, user);
    if (dashboardCache.size > MAX_CACHED_DASHBOARDS) dashboardCache.clear();
    dashboardCache.set(cacheKey, dashboard);
    run.resolve(dashboard);
    dashboardsRunning.delete(cacheKey);
    return dashboard;
  } catch (error) {
    run.reject(error);
    dashboardsRunning.delete(cacheKey);
    throw error;
  }
}
