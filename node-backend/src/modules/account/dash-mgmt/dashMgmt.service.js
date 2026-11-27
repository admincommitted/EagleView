import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { allowedFor, current as currentScope } from '../../../middlewares/branchScope.middleware.js';

// Management figures for the Accounts dashboard (GET /api/accounts-hub/dashboard -> "mgmt"). Read only. Everything
// follows the branch picked in the top bar (the Vouchers table is limited by the branch scope), except "branches",
// which compares every branch the user may see.
//   - profit before tax: the year-end journals to "PROFIT ON LOSS ACCOUNT" (profit moved to reserves, income-tax
//     provision, deferred tax) are not expenses of the year, so they are kept out and shown on their own
//   - gross margin: direct incomes less direct expenses (groups under Direct Incomes / Sales Accounts and
//     Direct Expenses / Purchase Accounts)
//   - reimbursable (pass-through): income heads billed mostly on REIMBURSABLE invoices (import duty, DO, stamp duty...)
//     against the expense head of the same name; net revenue = income less these
//   - by division (AE / AI / SE / SI from the voucher), by branch, top customers with job margin, jobs with cost and
//     no invoice, loss-making jobs, dockets with no invoice, billing vs collection, last year's figures, expenses
//     against the ledger's monthly budget (or last year), GST / TDS due dates, bank reconciliation status

const APPROPRIATION_HEAD = /PROFIT\s*(ON|AND|&)\s*LOSS|INCOME\s*TAX|DEF+ERED\s*TAX/i;
const DIRECT_GROUP = /^(direct (incomes?|expenses?)|sales accounts?|purchase accounts?)$/i;
const REIMBURSABLE_VOUCHER = /REIMBURS/i;
const DIVISIONS = { AE: 'Air Export', AI: 'Air Import', SE: 'Sea Export', SI: 'Sea Import' };
const FALLBACK_DEFAULT_BRANCH = 'DEL';
const HEAD_OFFICE_DOCKET_BRANCHES = ['NDL', ''];
const MS_PER_DAY = 86400000;
const HALF_RUPEE = 0.5;
const ONE_RUPEE = 1;
const REIMBURSABLE_SHARE = 0.5;
const DOCKET_GRACE_DAYS = 7;
const BANK_RECONCILE_GRACE_DAYS = 15;
const COMPLIANCE_WINDOW = { pastDays: -10, aheadDays: 45, listed: 9 };

const toNumber = (value) => {
  const number = Number(value);
  return isFinite(number) ? number : 0;
};
const round2 = (value) => Math.round(toNumber(value) * 100) / 100;
const percentOneDecimal = (part, whole) => Math.round((part / whole) * 1000) / 10;

/** A ledger name without the words that differ between an income and an expense head of the same charge. */
const headStem = (name) =>
  String(name || '')
    .toUpperCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(CHARGES?|CHGS?|INCOME|EXPENSES?|EXP|RECEIPTED|PAID|A\/C|ACCOUNT|GROUP)\b/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
const shiftYear = (isoDate, years) => {
  const day = new Date(isoDate + 'T00:00:00Z');
  day.setUTCFullYear(day.getUTCFullYear() + years);
  return day.toISOString().slice(0, 10);
};
const addDays = (isoDate, days) => {
  const day = new Date(isoDate + 'T00:00:00Z');
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
};
const monthKey = (isoDate) => String(isoDate).slice(0, 7);
const monthLabel = (month) =>
  new Date(month + '-01T00:00:00Z').toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const idList = (ids) => [...ids].map(Number).filter(Number.isFinite).join(',') || '0';
const sqlCodeList = (codes) => codes.map((code) => `'${String(code).replace(/[^A-Z0-9]/g, '')}'`).join(',');
const signedLine = (line, amountKey = 'amount') =>
  line.dc === 'Dr' ? toNumber(line[amountKey]) : -toNumber(line[amountKey]);
const addTo = (map, key, amount) => map.set(key, (map.get(key) || 0) + amount);
const percentChange = (now, before) =>
  Math.abs(before) > ONE_RUPEE ? Math.round(((now - before) / Math.abs(before)) * 1000) / 10 : null;

/** Income / expense ledgers: nature, direct or not, appropriation head, and the name stem. */
function classifyLedgers({ ledgers, path, incomeG, expenseG }) {
  const classes = new Map();
  for (const ledger of ledgers) {
    const isIncome = incomeG.has(ledger.groupId);
    const isExpense = expenseG.has(ledger.groupId);
    if (!isIncome && !isExpense) continue;
    classes.set(ledger.id, {
      nat: isIncome ? 'I' : 'E',
      direct: path(ledger.groupId).some((name) => DIRECT_GROUP.test(String(name).trim())),
      approp: isExpense && APPROPRIATION_HEAD.test(ledger.name),
      stem: headStem(ledger.name),
    });
  }
  return classes;
}

function newYearTotals(months) {
  const divisions = new Map();
  return {
    totals: { income: 0, expense: 0, approp: 0, dInc: 0, dExp: 0 },
    divisions,
    divisionOf: (code) => {
      if (!divisions.has(code))
        divisions.set(code, { code, name: DIVISIONS[code] || 'Other / not tagged', income: 0, direct: 0, indirect: 0 });
      return divisions.get(code);
    },
    monthly: new Map(
      months.map((month) => [month.m, { m: month.m, income: 0, expense: 0, approp: 0, dInc: 0, dExp: 0 }]),
    ),
    incomeByLedger: new Map(),
    reimbursedByLedger: new Map(),
    expenseByLedger: new Map(),
    divisionLedger: new Map(),
    jobs: new Map(),
    jobOf(jobNo) {
      if (!this.jobs.has(jobNo))
        this.jobs.set(jobNo, { jobNo, income: 0, cost: 0, first: '9999', last: '', div: '', cust: new Map() });
      return this.jobs.get(jobNo);
    },
  };
}

function addIncomeLine(year, line, classOf, signed, month, divisionCode) {
  const { totals } = year;
  totals.income -= signed;
  if (classOf.direct) totals.dInc -= signed;
  if (month) {
    month.income -= signed;
    if (classOf.direct) month.dInc -= signed;
  }
  year.divisionOf(divisionCode).income -= signed;
  year.divisionLedger.set(
    divisionCode + '|' + line.ledgerId,
    (year.divisionLedger.get(divisionCode + '|' + line.ledgerId) || 0) - signed,
  );
  year.incomeByLedger.set(line.ledgerId, (year.incomeByLedger.get(line.ledgerId) || 0) - signed);
  if (REIMBURSABLE_VOUCHER.test(line.vtype))
    year.reimbursedByLedger.set(line.ledgerId, (year.reimbursedByLedger.get(line.ledgerId) || 0) - signed);
  if (line.jobNo) {
    const job = year.jobOf(line.jobNo);
    job.income -= signed;
    if (!job.div) job.div = divisionCode;
  }
}

function addExpenseLine(year, line, classOf, signed, month, divisionCode) {
  const { totals } = year;
  totals.expense += signed;
  if (classOf.direct) totals.dExp += signed;
  if (month) {
    month.expense += signed;
    if (classOf.direct) month.dExp += signed;
  }
  const division = year.divisionOf(divisionCode);
  if (classOf.direct) division.direct += signed;
  else division.indirect += signed;
  year.expenseByLedger.set(line.ledgerId, (year.expenseByLedger.get(line.ledgerId) || 0) + signed);
  if (line.jobNo && classOf.direct) {
    const job = year.jobOf(line.jobNo);
    job.cost += signed;
    if (!job.div) job.div = divisionCode;
    if (line.date < job.first) job.first = line.date;
    if (line.date > job.last) job.last = line.date;
  }
}

/** This year's income / expense lines by month, division, ledger and job. */
function yearTotals(lines, classes, months) {
  const year = newYearTotals(months);
  for (const line of lines) {
    const classOf = classes.get(line.ledgerId);
    if (!classOf) continue;
    const signed = signedLine(line);
    const month = year.monthly.get(monthKey(line.date));
    const divisionCode = DIVISIONS[line.division] ? line.division : '-';
    if (classOf.nat === 'I') {
      addIncomeLine(year, line, classOf, signed, month, divisionCode);
    } else if (classOf.approp) {
      year.totals.approp += signed;
      if (month) month.approp += signed;
    } else addExpenseLine(year, line, classOf, signed, month, divisionCode);
  }
  return year;
}

// income heads billed mostly on reimbursable invoices, against the expense head of the same name
function reimbursableHeads(year, classes, ledgerById) {
  const expenseByStem = new Map();
  for (const [ledgerId, amount] of year.expenseByLedger) {
    const { stem } = classes.get(ledgerId);
    if (stem) addTo(expenseByStem, stem, amount);
  }
  const heads = [];
  for (const [ledgerId, billed] of year.incomeByLedger) {
    const reimbursed = year.reimbursedByLedger.get(ledgerId) || 0;
    if (billed <= 0 || reimbursed < billed * REIMBURSABLE_SHARE) continue;
    const cost = expenseByStem.get(classes.get(ledgerId).stem) || 0;
    heads.push({
      id: ledgerId,
      name: (ledgerById.get(ledgerId) || {}).name,
      billed: round2(billed),
      cost: round2(cost),
      diff: round2(billed - cost),
    });
  }
  return heads.sort((first, second) => second.billed - first.billed);
}

function profitAndLoss(totals, netRevenue) {
  const profit = totals.income - totals.expense;
  const gross = totals.dInc - totals.dExp;
  return {
    income: round2(totals.income),
    expense: round2(totals.expense),
    profit: round2(profit),
    approp: round2(totals.approp),
    bookProfit: round2(profit - totals.approp),
    directIncome: round2(totals.dInc),
    directExpense: round2(totals.dExp),
    gross: round2(gross),
    indirectExpense: round2(totals.expense - totals.dExp),
    otherIncome: round2(totals.income - totals.dInc),
    netRevenue: round2(netRevenue),
    grossPct: netRevenue > 0 ? percentOneDecimal(gross, netRevenue) : null,
    netPct: netRevenue > 0 ? percentOneDecimal(profit, netRevenue) : null,
  };
}

// gross margin on net revenue (income less reimbursable). Indirect costs (salary, rent...) are mostly not tagged to a
// division in iCAFFE, so they are shown as a total only.
function divisionFigures(year, reimbursableIds, netRevenue) {
  return [...year.divisions.values()]
    .filter((division) => Math.abs(division.income) + Math.abs(division.direct) > ONE_RUPEE)
    .map((division) => {
      let reimbursed = 0;
      for (const ledgerId of reimbursableIds)
        reimbursed += year.divisionLedger.get(division.code + '|' + ledgerId) || 0;
      const divisionNetRevenue = division.income - reimbursed;
      const gross = division.income - division.direct;
      return {
        code: division.code,
        name: division.name,
        income: round2(division.income),
        reimb: round2(reimbursed),
        netRevenue: round2(divisionNetRevenue),
        direct: round2(division.direct),
        gross: round2(gross),
        grossPct: divisionNetRevenue > 0 ? percentOneDecimal(gross, divisionNetRevenue) : null,
        share: netRevenue ? percentOneDecimal(divisionNetRevenue, netRevenue) : 0,
        indirect: round2(division.indirect),
      };
    })
    .sort((first, second) => second.netRevenue - first.netRevenue);
}

// customers: revenue (income on their invoices) and the margin of their jobs; a voucher's party is its largest debtor line
async function customerFigures({ q, VALID, fy, asOn, debtorList, lines, classes, year, ledgerById, receivable }) {
  const debtorLines = await q(
    `SELECT d.voucherId vid, d.ledgerId, d.amount FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN AccountLedgers l ON l.id = d.ledgerId
      WHERE ${VALID} AND v.date >= ? AND v.date <= ? AND l.groupId IN (${debtorList}) ORDER BY d.amount`,
    [fy.startDate, asOn],
  );
  const partyOfVoucher = new Map();
  for (const line of debtorLines) partyOfVoucher.set(line.vid, line.ledgerId);
  const customers = new Map();
  const customerOf = (ledgerId) => {
    if (!customers.has(ledgerId))
      customers.set(ledgerId, {
        id: ledgerId,
        name: (ledgerById.get(ledgerId) || {}).name || '#' + ledgerId,
        revenue: 0,
        cost: 0,
        jobs: 0,
      });
    return customers.get(ledgerId);
  };
  for (const line of lines) {
    const classOf = classes.get(line.ledgerId);
    if (!classOf || classOf.nat !== 'I') continue;
    const party = partyOfVoucher.get(line.vid);
    if (!party) continue;
    const signed = line.dc === 'Dr' ? toNumber(line.amount) : -toNumber(line.amount);
    customerOf(party).revenue -= signed;
    if (line.jobNo) addTo(year.jobOf(line.jobNo).cust, party, -signed);
  }
  // a job's cost goes to the customer billed most on it
  for (const job of year.jobs.values()) {
    let best = null;
    let bestAmount = -Infinity;
    for (const [party, amount] of job.cust) {
      if (amount > bestAmount) {
        best = party;
        bestAmount = amount;
      }
    }
    job.custId = best;
    if (best != null) {
      const customer = customerOf(best);
      customer.cost += job.cost;
      customer.jobs++;
    }
  }
  const receivableByParty = new Map((receivable.parties || []).map((party) => [party.id, party]));
  const billedCustomers = [...customers.values()].filter((customer) => customer.revenue > 0);
  const top = billedCustomers
    .sort((first, second) => second.revenue - first.revenue)
    .slice(0, 10)
    .map((customer) => {
      const outstanding = receivableByParty.get(customer.id) || {};
      return {
        id: customer.id,
        name: customer.name,
        revenue: round2(customer.revenue),
        cost: round2(customer.cost),
        margin: round2(customer.revenue - customer.cost),
        marginPct: customer.revenue ? percentOneDecimal(customer.revenue - customer.cost, customer.revenue) : null,
        jobs: customer.jobs,
        share: year.totals.income ? percentOneDecimal(customer.revenue, year.totals.income) : 0,
        outstanding: round2(outstanding.balance || 0),
        overdue: round2(outstanding.overdue || 0),
      };
    });
  return { customers: top, customerCount: [...customers.values()].filter((customer) => customer.revenue > 0).length };
}

const divisionCodeShown = (code) => (DIVISIONS[code] ? code : '');

// a job billed in an earlier year (cost booked this year) is not unbilled, and its margin cannot be judged on this year alone
function jobFigures(year, billedFirst, fy, ledgerById) {
  const jobs = [...year.jobs.values()].filter((job) => job.cost > HALF_RUPEE || job.income > HALF_RUPEE);
  const unbilled = jobs
    .filter((job) => job.cost > HALF_RUPEE && job.income <= HALF_RUPEE && !billedFirst.has(job.jobNo))
    .sort((first, second) => second.cost - first.cost);
  const loss = jobs
    .filter(
      (job) =>
        job.income > HALF_RUPEE && job.cost > job.income + HALF_RUPEE && !(billedFirst.get(job.jobNo) < fy.startDate),
    )
    .sort((first, second) => second.cost - second.income - (first.cost - first.income));
  return {
    total: jobs.length,
    billed: jobs.filter((job) => job.income > HALF_RUPEE).length,
    unbilled: {
      count: unbilled.length,
      cost: round2(unbilled.reduce((sum, job) => sum + job.cost, 0)),
      list: unbilled.slice(0, 10).map((job) => ({
        jobNo: job.jobNo,
        cost: round2(job.cost),
        first: job.first,
        last: job.last,
        division: divisionCodeShown(job.div),
      })),
    },
    loss: {
      count: loss.length,
      amount: round2(loss.reduce((sum, job) => sum + job.cost - job.income, 0)),
      list: loss.slice(0, 10).map((job) => ({
        jobNo: job.jobNo,
        income: round2(job.income),
        cost: round2(job.cost),
        loss: round2(job.cost - job.income),
        customer: job.custId ? (ledgerById.get(job.custId) || {}).name : '',
        division: divisionCodeShown(job.div),
      })),
    },
  };
}

// dockets carry iCAFFE's branch code (NDL, MUM...); the books use the Branch Master code (DEL...); iCAFFE's head
// office (NEW DELHI) is the default branch
async function docketBranchCodes(q, scope) {
  const list = scope && scope.clause ? scope.list : null;
  if (!list) return null;
  let companyBranches;
  try {
    companyBranches = await q('SELECT branchCode, icaffeCode FROM CompanyBranches');
  } catch {
    companyBranches = [];
  }
  const codes = [...list];
  for (const code of list) {
    for (const branch of companyBranches) {
      if (String(branch.branchCode || '').toUpperCase() === code && branch.icaffeCode)
        codes.push(
          String(branch.icaffeCode)
            .toUpperCase()
            .replace(/^OFF\/?/, ''),
        );
    }
    if (code === scope.def) codes.push(...HEAD_OFFICE_DOCKET_BRANCHES);
  }
  return codes;
}

// by party: a party billed in bulk (one invoice for many dockets, e.g. courier) shows as one line
function docketsByParty(openDockets) {
  const byParty = new Map();
  for (const docket of openDockets) {
    const key = String(docket.mainParty || '-')
      .trim()
      .toUpperCase();
    if (!byParty.has(key))
      byParty.set(key, {
        party: docket.mainParty || '-',
        count: 0,
        oldest: docket.docketDate,
        oldestNo: docket.docketNo,
      });
    const party = byParty.get(key);
    party.count++;
    if (docket.docketDate < party.oldest) {
      party.oldest = docket.docketDate;
      party.oldestNo = docket.docketNo;
    }
  }
  return byParty;
}

/** Dockets registered (Shipment Registration) with no sales invoice yet, older than 7 days; null when unreadable. */
async function unbilledDockets({ q, fy, asOn, billedFirst }) {
  try {
    const codes = await docketBranchCodes(q, currentScope());
    const branchFilter = codes
      ? ` AND upper(trim(coalesce(branchCode, ''))) IN (${sqlCodeList([...new Set(codes)])})`
      : '';
    const dockets = await q(
      `SELECT docketNo, docketDate, division, mainParty FROM Shipments WHERE docketDate >= ? AND docketDate <= ? AND coalesce(stage, '') <> 'Cancelled'${branchFilter} ORDER BY docketDate`,
      [fy.startDate, addDays(asOn, -DOCKET_GRACE_DAYS)],
    );
    if (!dockets.length) return { registered: 0, notBilled: 0, byDiv: {}, oldest: [] };
    const open = dockets.filter(
      (docket) =>
        !billedFirst.has(
          String(docket.docketNo || '')
            .toUpperCase()
            .trim(),
        ),
    );
    const byDiv = {};
    for (const docket of open) byDiv[docket.division || '-'] = (byDiv[docket.division || '-'] || 0) + 1;
    const byParty = docketsByParty(open);
    return {
      registered: dockets.length,
      notBilled: open.length,
      byDiv,
      byParty: [...byParty.values()].sort((first, second) => second.count - first.count).slice(0, 10),
      parties: byParty.size,
      oldest: open.slice(0, 10).map((docket) => ({
        docketNo: docket.docketNo,
        date: docket.docketDate,
        division: docket.division,
        party: docket.mainParty,
      })),
    };
  } catch {
    return null;
  }
}

/** Billing vs collection on the debtors' side (incl. GST), month by month. */
async function collectionFigures({ q, VALID, fy, asOn, debtorList, months }) {
  const rows = await q(
    `SELECT substr(v.date, 1, 7) m, t.baseType, d.dc, sum(d.amount) amt FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
      JOIN AccountLedgers l ON l.id = d.ledgerId WHERE ${VALID} AND v.date >= ? AND v.date <= ? AND l.groupId IN (${debtorList}) AND t.baseType IN ('Sales', 'Credit Note', 'Debit Note', 'Receipt') GROUP BY 1, 2, 3`,
    [fy.startDate, asOn],
  );
  const monthly = new Map(months.map((month) => [month.m, { m: month.m, billed: 0, collected: 0 }]));
  for (const row of rows) {
    const month = monthly.get(row.m);
    if (!month) continue;
    const amount = toNumber(row.amt);
    if (row.baseType === 'Receipt') month.collected += row.dc === 'Cr' ? amount : -amount;
    else month.billed += row.dc === 'Dr' ? amount : -amount;
  }
  const list = [...monthly.values()].map((month) => ({
    m: month.m,
    billed: round2(month.billed),
    collected: round2(month.collected),
  }));
  const billed = list.reduce((sum, month) => sum + month.billed, 0);
  const collected = list.reduce((sum, month) => sum + month.collected, 0);
  return {
    months: list,
    billed: round2(billed),
    collected: round2(collected),
    pct: billed ? percentOneDecimal(collected, billed) : null,
  };
}

/** Next 30 days: cash, what falls due to and from parties (bill date + the party's credit days), vendors to pay. */
function nextThirtyDays(cash, receivable, payable) {
  const vendors = (payable.parties || [])
    .filter((party) => party.overdue > HALF_RUPEE || party.due30 > HALF_RUPEE)
    .sort((first, second) => second.overdue + second.due30 - (first.overdue + first.due30))
    .slice(0, 10)
    .map((party) => ({
      id: party.id,
      name: party.name,
      overdue: round2(party.overdue),
      due30: round2(party.due30),
      balance: round2(party.balance),
      creditDays: party.creditDays,
    }));
  return {
    cash: round2(cash),
    recDue: round2(receivable.due30 || 0),
    recOverdue: round2(receivable.overdue || 0),
    payDue: round2(payable.due30 || 0),
    payOverdue: round2(payable.overdue || 0),
    expected: round2(cash + (receivable.due30 || 0) - (payable.due30 || 0) - (payable.overdue || 0)),
    vendors,
  };
}

/** Last year, same period: income, expense, gross, profit, by month and per expense ledger. */
async function lastYearFigures({ q, VALID, fy, asOn, plIds, classes }) {
  const from = shiftYear(fy.startDate, -1);
  const to = shiftYear(asOn, -1);
  const rows = await q(
    `SELECT d.ledgerId, d.dc, sum(d.amount) amt, substr(v.date, 1, 7) m FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
      WHERE ${VALID} AND v.date >= ? AND v.date <= ? AND d.ledgerId IN (${plIds}) GROUP BY 1, 2, 4`,
    [from, to],
  );
  const totals = { income: 0, expense: 0, dInc: 0, dExp: 0 };
  const byMonth = new Map();
  const expenseByLedger = new Map();
  for (const row of rows) {
    const classOf = classes.get(row.ledgerId);
    if (!classOf || classOf.approp) continue;
    const signed = signedLine(row, 'amt');
    const thisYearMonth = shiftYear(row.m + '-01', 1).slice(0, 7);
    if (!byMonth.has(thisYearMonth)) byMonth.set(thisYearMonth, { income: 0, expense: 0 });
    if (classOf.nat === 'I') {
      totals.income -= signed;
      if (classOf.direct) totals.dInc -= signed;
      byMonth.get(thisYearMonth).income -= signed;
    } else {
      totals.expense += signed;
      if (classOf.direct) totals.dExp += signed;
      byMonth.get(thisYearMonth).expense += signed;
      addTo(expenseByLedger, row.ledgerId, signed);
    }
  }
  return { from, to, rows, totals, byMonth, expenseByLedger };
}

function lastYearSummary(lastYear, monthsShown, thisYear) {
  const { totals } = lastYear;
  const gross = thisYear.dInc - thisYear.dExp;
  const profit = thisYear.income - thisYear.expense;
  return {
    from: lastYear.from,
    to: lastYear.to,
    has: lastYear.rows.length > 0,
    income: round2(totals.income),
    expense: round2(totals.expense),
    profit: round2(totals.income - totals.expense),
    gross: round2(totals.dInc - totals.dExp),
    months: monthsShown.map((month) => {
      const before = lastYear.byMonth.get(month.m) || { income: 0, expense: 0 };
      return {
        m: month.m,
        income: round2(before.income),
        expense: round2(before.expense),
        profit: round2(before.income - before.expense),
      };
    }),
    change: {
      income: percentChange(thisYear.income, totals.income),
      gross: percentChange(gross, totals.dInc - totals.dExp),
      profit: percentChange(profit, totals.income - totals.expense),
      expense: percentChange(thisYear.expense, totals.expense),
    },
  };
}

/** Indirect expenses against the ledger's monthly budget (times the months gone) or last year. */
async function budgetFigures({ q, fy, asOn, classes, year, lastYear, ledgerById }) {
  const monthsElapsed = Math.max(
    1,
    (Number(asOn.slice(0, 4)) - Number(fy.startDate.slice(0, 4))) * 12 +
      Number(asOn.slice(5, 7)) -
      Number(fy.startDate.slice(5, 7)) +
      1,
  );
  let budgetRows;
  try {
    budgetRows = await q('SELECT id, monthlyBudget FROM AccountLedgers WHERE monthlyBudget > 0');
  } catch {
    budgetRows = [];
  }
  const monthlyBudget = new Map(budgetRows.map((row) => [row.id, toNumber(row.monthlyBudget)]));
  const isIndirectExpense = (id) =>
    classes.has(id) && classes.get(id).nat === 'E' && !classes.get(id).approp && !classes.get(id).direct;
  const heads = new Set([...year.expenseByLedger.keys(), ...monthlyBudget.keys()].filter(isIndirectExpense));
  const rows = [...heads]
    .map((id) => {
      const actual = year.expenseByLedger.get(id) || 0;
      const lastYearAmount = lastYear.expenseByLedger.get(id) || 0;
      const budget = monthlyBudget.has(id) ? monthlyBudget.get(id) * monthsElapsed : null;
      return {
        id,
        name: (ledgerById.get(id) || {}).name,
        actual: round2(actual),
        lastYear: round2(lastYearAmount),
        budget: budget == null ? null : round2(budget),
        vsBudget: budget ? percentOneDecimal(actual - budget, budget) : null,
        vsLastYear: percentChange(actual, lastYearAmount),
      };
    })
    .filter((row) => Math.abs(row.actual) > ONE_RUPEE || row.budget)
    .sort((first, second) => second.actual - first.actual);
  const isIndirect = (id) => classes.has(id) && !classes.get(id).direct;
  const indirectLastYear = [...lastYear.expenseByLedger.entries()]
    .filter(([id]) => isIndirect(id))
    .reduce((sum, [, amount]) => sum + amount, 0);
  return {
    months: monthsElapsed,
    budgetHeads: monthlyBudget.size,
    rows: rows.slice(0, 12),
    indirect: round2(year.totals.expense - year.totals.dExp),
    indirectLY: round2(indirectLastYear),
    indirectBudget: round2(
      [...monthlyBudget.entries()]
        .filter(([id]) => isIndirect(id))
        .reduce((sum, [, amount]) => sum + amount * monthsElapsed, 0),
    ),
  };
}

/** GST / TDS due dates from today (the month's figures where known), within 10 days past to 45 days ahead. */
function complianceDates(months) {
  const today = new Date().toISOString().slice(0, 10);
  const figuresByMonth = new Map(months.map((month) => [month.m, month]));
  const dues = [];
  for (let offset = -2; offset <= 1; offset++) {
    const periodStart = new Date(today.slice(0, 7) + '-01T00:00:00Z');
    periodStart.setUTCMonth(periodStart.getUTCMonth() + offset - 1);
    const period = periodStart.toISOString().slice(0, 7); // the return period
    const periodYear = Number(period.slice(0, 4));
    const periodMonth = Number(period.slice(5, 7));
    const [nextYear, nextMonth] = periodMonth === 12 ? [periodYear + 1, 1] : [periodYear, periodMonth + 1];
    const nextMonthKey = nextYear + '-' + String(nextMonth).padStart(2, '0');
    const figures = figuresByMonth.get(period) || {};
    dues.push({
      what: 'GSTR-1 (outward supplies)',
      period: monthLabel(period),
      due: nextMonthKey + '-11',
      amount: figures.gstOut != null ? round2(figures.gstOut) : null,
    });
    dues.push({
      what: 'GSTR-3B (GST payment)',
      period: monthLabel(period),
      due: nextMonthKey + '-20',
      amount: figures.gstOut != null ? round2((figures.gstOut || 0) - (figures.gstIn || 0)) : null,
    });
    dues.push({
      what: 'TDS deposit (challan 281)',
      period: monthLabel(period),
      due: periodMonth === 3 ? nextYear + '-04-30' : nextMonthKey + '-07',
      amount: figures.tds != null ? round2(figures.tds) : null,
    });
  }
  const thisYear = Number(today.slice(0, 4));
  const quarters = [
    ['Q1 (Apr-Jun)', '-07-31'],
    ['Q2 (Jul-Sep)', '-10-31'],
    ['Q3 (Oct-Dec)', '-01-31'],
    ['Q4 (Jan-Mar)', '-05-31'],
  ];
  for (const [quarter, dueDay] of quarters) {
    for (const dueYear of [thisYear - 1, thisYear, thisYear + 1])
      dues.push({ what: 'TDS return 24Q / 26Q', period: quarter, due: dueYear + dueDay, amount: null });
  }
  for (const dueYear of [thisYear, thisYear + 1])
    dues.push({
      what: 'GSTR-9 annual return',
      period: 'FY ' + (dueYear - 1) + '-' + String(dueYear).slice(2),
      due: dueYear + '-12-31',
      amount: null,
    });
  const daysTo = (isoDate) =>
    Math.round((new Date(isoDate + 'T00:00:00Z') - new Date(today + 'T00:00:00Z')) / MS_PER_DAY);
  return dues
    .map((due) => ({ ...due, days: daysTo(due.due) }))
    .filter((due) => due.days >= COMPLIANCE_WINDOW.pastDays && due.days <= COMPLIANCE_WINDOW.aheadDays)
    .sort((first, second) => first.due.localeCompare(second.due))
    .slice(0, COMPLIANCE_WINDOW.listed);
}

/** Bank entries not yet matched with the bank statement (older than 15 days), per bank ledger. */
async function bankReconciliationStatus({ q, VALID, fy, asOn, ledgers, bankG, ledgerById }) {
  const bankIds = ledgers
    .filter(
      (ledger) => bankG.has(ledger.groupId) && !/cash/i.test(ledger.name) && !/cash/i.test(ledger.groupName || ''),
    )
    .map((ledger) => ledger.id);
  if (!bankIds.length) return { banks: 0, open: 0, amount: 0, neverDone: 0, rows: [] };
  const cut = addDays(asOn, -BANK_RECONCILE_GRACE_DAYS);
  const unreconciled = await q(
    `SELECT d.ledgerId, count(*) n, sum(d.amount) amt, min(v.date) oldest FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
      WHERE ${VALID} AND v.date >= ? AND v.date <= ? AND d.ledgerId IN (${bankIds.join(',')}) AND (d.clearanceDate IS NULL OR d.clearanceDate = '') GROUP BY 1`,
    [fy.startDate, cut],
  );
  const lastReconciled = await q(
    `SELECT d.ledgerId, max(d.clearanceDate) last FROM VoucherDetails d WHERE d.ledgerId IN (${bankIds.join(',')}) AND coalesce(d.clearanceDate, '') <> '' GROUP BY 1`,
  );
  const lastByLedger = new Map(lastReconciled.map((row) => [row.ledgerId, String(row.last).slice(0, 10)]));
  const rows = unreconciled
    .map((row) => ({
      id: row.ledgerId,
      name: (ledgerById.get(row.ledgerId) || {}).name,
      open: row.n,
      amount: round2(row.amt),
      oldest: row.oldest,
      lastReconciled: lastByLedger.get(row.ledgerId) || null,
    }))
    .sort((first, second) => second.open - first.open);
  return {
    asOf: cut,
    banks: rows.length,
    open: rows.reduce((sum, row) => sum + row.open, 0),
    amount: round2(rows.reduce((sum, row) => sum + row.amount, 0)),
    neverDone: rows.filter((row) => !row.lastReconciled).length,
    rows: rows.slice(0, 8),
  };
}

function addBranchLine(branch, line, classOf, reimbursableIds) {
  const signed = signedLine(line, 'amt');
  if (classOf.nat === 'I') {
    branch.income -= signed;
    if (classOf.direct) branch.dInc -= signed;
    if (reimbursableIds.has(line.ledgerId)) branch.reimb = (branch.reimb || 0) - signed;
  } else {
    branch.expense += signed;
    if (classOf.direct) branch.dExp += signed;
  }
}

/** Branch-wise: every branch the user may see, whatever is picked in the top bar ([] when unreadable). */
async function branchFigures({ q, VALID, fy, asOn, plIds, classes, reimbursableIds, req }) {
  try {
    const scope = currentScope() || {};
    const allowed = await allowedFor(req.user);
    const defaultBranch = scope.def || FALLBACK_DEFAULT_BRANCH;
    const branchOf = `coalesce(nullif(upper(trim(v.branchCode)), ''), '${defaultBranch}')`;
    const allowedFilter = allowed ? ` AND ${branchOf} IN (${sqlCodeList(allowed)})` : '';
    // __noScope: this comparison reads every branch the user may see, not only the one picked
    const rows = await sequelize.query(
      `SELECT ${branchOf} br, d.ledgerId, d.dc, sum(d.amount) amt FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
        WHERE ${VALID} AND v.date >= ? AND v.date <= ? AND d.ledgerId IN (${plIds})${allowedFilter} GROUP BY 1, 2, 3`,
      { replacements: [fy.startDate, asOn], type: QueryTypes.SELECT, __noScope: true },
    );
    let companyBranches;
    try {
      companyBranches = await q('SELECT branchCode, branchName FROM CompanyBranches');
    } catch {
      companyBranches = [];
    }
    const branchNames = new Map(
      companyBranches.map((branch) => [String(branch.branchCode || '').toUpperCase(), branch.branchName]),
    );
    const branches = new Map();
    for (const row of rows) {
      const classOf = classes.get(row.ledgerId);
      if (!classOf || classOf.approp) continue;
      if (!branches.has(row.br))
        branches.set(row.br, {
          code: row.br,
          name: branchNames.get(row.br) || row.br,
          income: 0,
          expense: 0,
          dInc: 0,
          dExp: 0,
        });
      addBranchLine(branches.get(row.br), row, classOf, reimbursableIds);
    }
    const totalIncome = [...branches.values()].reduce((sum, branch) => sum + branch.income, 0);
    return [...branches.values()]
      .map((branch) => {
        const netRevenue = branch.income - (branch.reimb || 0);
        return {
          code: branch.code,
          name: branch.name,
          income: round2(branch.income),
          netRevenue: round2(netRevenue),
          expense: round2(branch.expense),
          gross: round2(branch.dInc - branch.dExp),
          profit: round2(branch.income - branch.expense),
          grossPct: netRevenue > 0 ? percentOneDecimal(branch.dInc - branch.dExp, netRevenue) : null,
          netPct: netRevenue > 0 ? percentOneDecimal(branch.income - branch.expense, netRevenue) : null,
          share: totalIncome ? percentOneDecimal(branch.income, totalIncome) : 0,
          current: !scope.list || scope.list.includes(branch.code),
        };
      })
      .sort((first, second) => second.netRevenue - first.netRevenue);
  } catch {
    return [];
  }
}

/**
 * The "mgmt" part of the Accounts dashboard. `args` are the dashboard's own figures:
 * { q, VALID, fy, asOn, ledgers, groups, byId, path, debtorG, creditorG, bankG, incomeG, expenseG, receivable, payable,
 *   months, cash, req } - q reads rows (read-only connection), VALID is the valid-voucher SQL condition, req.user the user.
 */
export async function buildManagementDashboard(args) {
  const {
    q,
    VALID,
    fy,
    asOn,
    ledgers,
    path,
    debtorG,
    bankG,
    incomeG,
    expenseG,
    receivable,
    payable,
    months,
    cash,
    req,
  } = args;
  const ledgerById = new Map(ledgers.map((ledger) => [ledger.id, ledger]));
  const classes = classifyLedgers({ ledgers, path, incomeG, expenseG });
  const plIds = idList(classes.keys());
  const lines = await q(
    `SELECT d.voucherId vid, d.ledgerId, d.dc, d.amount, v.date, upper(coalesce(v.division, '')) division, upper(trim(coalesce(v.jobNo, ''))) jobNo,
      upper(coalesce(v.icaffeType, '') || ' ' || coalesce(t.name, '')) vtype, t.baseType
      FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
      WHERE ${VALID} AND v.date >= ? AND v.date <= ? AND d.ledgerId IN (${plIds})`,
    [fy.startDate, asOn],
  );
  const year = yearTotals(lines, classes, months);
  const { totals } = year;
  const reimbursable = reimbursableHeads(year, classes, ledgerById);
  const reimbursedBilled = reimbursable.reduce((sum, head) => sum + head.billed, 0);
  const reimbursedCost = reimbursable.reduce((sum, head) => sum + head.cost, 0);
  const netRevenue = totals.income - reimbursedBilled;
  const reimbursableIds = new Set(reimbursable.map((head) => head.id));
  const out = {};
  out.pl = profitAndLoss(totals, netRevenue);
  out.reimb = {
    billed: round2(reimbursedBilled),
    cost: round2(reimbursedCost),
    diff: round2(reimbursedBilled - reimbursedCost),
    heads: reimbursable.slice(0, 8),
  };
  out.months = [...year.monthly.values()].map((month) => ({
    m: month.m,
    income: round2(month.income),
    expense: round2(month.expense),
    profit: round2(month.income - month.expense),
    gross: round2(month.dInc - month.dExp),
    approp: round2(month.approp),
  }));
  out.divisions = divisionFigures(year, reimbursableIds, netRevenue);
  const debtorList = idList(debtorG);
  Object.assign(
    out,
    await customerFigures({ q, VALID, fy, asOn, debtorList, lines, classes, year, ledgerById, receivable }),
  );
  const billedJobs =
    await q(`SELECT upper(trim(v.jobNo)) j, min(v.date) first FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId
      WHERE ${VALID} AND t.baseType = 'Sales' AND coalesce(v.jobNo, '') <> '' GROUP BY 1`);
  const billedFirst = new Map(billedJobs.map((row) => [row.j, row.first]));
  out.jobs = jobFigures(year, billedFirst, fy, ledgerById);
  out.dockets = await unbilledDockets({ q, fy, asOn, billedFirst });
  out.collection = await collectionFigures({ q, VALID, fy, asOn, debtorList, months });
  out.next30 = nextThirtyDays(cash, receivable, payable);
  const lastYear = await lastYearFigures({ q, VALID, fy, asOn, plIds, classes });
  out.prev = lastYearSummary(lastYear, out.months, totals);
  out.budget = await budgetFigures({ q, fy, asOn, classes, year, lastYear, ledgerById });
  out.compliance = complianceDates(months);
  out.brs = await bankReconciliationStatus({ q, VALID, fy, asOn, ledgers, bankG, ledgerById });
  out.branches = await branchFigures({ q, VALID, fy, asOn, plIds, classes, reimbursableIds, req });
  return out;
}
