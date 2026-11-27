// Sales dashboard: what one sales person (or his team, or the whole branch) has - billing this FY against the same days
// of last FY, this month, month by month, outstanding and overdue, dockets, customers that are falling / gone quiet /
// overdue, reviews due, contacts' birthdays, how complete the profiles are, and (team) person by person.
// A sales person who logs in sees his own; a manager / head his team; admin (or a user who is not a sales person) all.
// Figures are company-wide (every branch the customer is billed from) and are read from the books - nothing is written.
import * as S from './salesHub.js';

const { q, today } = S;

const DAY_MS = 86400000;
const BOOKS_CACHE_MS = 600000; // 10 minutes
const RECENT_BILL_DAYS = 200;
const MON = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const DEFAULT_CREDIT = 30;
const ACTIVE_DAYS = 60;
const SLOWING_DAYS = 120;
const QUIET_DAYS = 60;
const LIST_SIZE = 12;
const REVIEW_LIST_SIZE = 15;
const REVIEW_AHEAD_DAYS = 7;
const EVENT_AHEAD_DAYS = 15;
const EVENT_LIST_SIZE = 20;
const FALLING_MIN_LAST_YEAR = 100000; // Rs 1 lakh
const FALLING_SHARE_KEPT = 0.7; // 30% or more down
const OVERDUE_LIST_MIN = 1000;
const ROUNDED_ROW_FIELDS = [
  'cy',
  'lyTo',
  'ly',
  'thisMonth',
  'prevMonth',
  'sameMonthLy',
  'reimbCy',
  'outstanding',
  'overdue',
];

const fyStart = (d) => {
  const year = Number(d.slice(0, 4));
  const month = Number(d.slice(5, 7));
  return `${month < 4 ? year - 1 : year}-04-01`;
};
const addYears = (d, n) => `${Number(d.slice(0, 4)) + n}${d.slice(4)}`;
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
const r0 = (n) => Math.round(Number(n) || 0);

function pushInto(map, mapKey, value) {
  if (!map.has(mapKey)) map.set(mapKey, []);
  map.get(mapKey).push(value);
}

async function selectWithFallback(primary, fallback) {
  try {
    return await primary();
  } catch {
    try {
      return await fallback();
    } catch {
      return [];
    }
  }
}

// ---- what the books say, per debtor ledger - read once, kept 10 minutes ----
let BOOKS = { key: '', at: 0, data: null };

// billing (sales less credit notes, incl. GST) by ledger and month, since the start of last FY
async function monthlyBilling(inDebtors, lastYearToday, lastFyStart) {
  const rows = await q(
    `SELECT d.ledgerId lid, substr(v.date, 1, 7) m,
      sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) amt,
      sum(CASE WHEN v.date <= ? THEN (CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) ELSE 0 END) amtTo,
      count(DISTINCT CASE WHEN t.baseType = 'Sales' THEN v.id END) bills, max(CASE WHEN t.baseType = 'Sales' THEN v.date END) last
    FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
    WHERE t.baseType IN ('Sales', 'Credit Note') AND coalesce(v.status, '') <> 'Rejected' AND v.date >= ? AND ${inDebtors}
    GROUP BY d.ledgerId, m`,
    [lastYearToday, lastFyStart],
  );
  const byLedger = new Map();
  for (const row of rows) {
    pushInto(byLedger, row.lid, {
      m: row.m,
      amt: row.amt || 0,
      amtTo: row.amtTo || 0,
      bills: row.bills || 0,
      last: row.last ? String(row.last).slice(0, 10) : null,
    });
  }
  return byLedger;
}

// balance (opening + every valid voucher) of every debtor ledger, and how much of it is overdue
async function debtorBalances(groups, inDebtors, todayDate) {
  const ledgers = await q(
    `SELECT id, openingBalance ob, balanceType bt, creditDays cd FROM AccountLedgers WHERE groupId IN (${groups.join(',') || 0})`,
  );
  const movements = new Map(
    (
      await q(`SELECT d.ledgerId lid, sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) mv FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
      WHERE coalesce(v.status, '') <> 'Rejected' AND ${inDebtors} GROUP BY d.ledgerId`)
    ).map((row) => [row.lid, row.mv || 0]),
  );
  // bills of the last 200 days by date: what is still inside the credit days is not overdue yet
  const recentBills = new Map();
  const recentRows = await q(
    `SELECT d.ledgerId lid, v.date dt, sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE 0 END) amt FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
      JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE t.baseType = 'Sales' AND coalesce(v.status, '') <> 'Rejected' AND v.date >= ? AND ${inDebtors} GROUP BY d.ledgerId, v.date`,
    [addDays(todayDate, -RECENT_BILL_DAYS)],
  );
  for (const row of recentRows) pushInto(recentBills, row.lid, [String(row.dt).slice(0, 10), row.amt || 0]);

  const balances = new Map();
  for (const ledger of ledgers) {
    const balance = (ledger.bt === 'Cr' ? -1 : 1) * (Number(ledger.ob) || 0) + (movements.get(ledger.id) || 0);
    if (Math.abs(balance) < 1) continue;
    const creditDays = Number(ledger.cd) > 0 ? Number(ledger.cd) : DEFAULT_CREDIT;
    const dueFrom = addDays(todayDate, -creditDays);
    const notDue = (recentBills.get(ledger.id) || [])
      .filter(([day]) => day > dueFrom)
      .reduce((sum, [, amount]) => sum + amount, 0);
    balances.set(ledger.id, { bal: balance, overdue: balance > 0 ? Math.max(0, balance - notDue) : 0, cd: creditDays });
  }
  return balances;
}

// dockets by the marketing person written on them (older databases have no isDeleted column)
function docketCounts(lastYearToday, lastFyStart) {
  const docketQuery = (withDeletedFilter) =>
    q(
      `SELECT upper(trim(coalesce(marketingPerson, ''))) n, substr(docketDate, 1, 7) m, count(*) c, sum(CASE WHEN docketDate <= ? THEN 1 ELSE 0 END) cTo FROM Shipments
      WHERE docketDate >= ? ${withDeletedFilter ? 'AND coalesce(isDeleted, 0) = 0' : ''} GROUP BY 1, 2`,
      [lastYearToday, lastFyStart],
    );
  return selectWithFallback(
    () => docketQuery(true),
    () => docketQuery(false),
  );
}

async function books() {
  const t = today();
  if (BOOKS.key === t && Date.now() - BOOKS.at < BOOKS_CACHE_MS) return BOOKS.data;
  const fy = fyStart(t);
  const lfy = addYears(fy, -1);
  const lyToday = addYears(t, -1);
  const groups = [...(await S.debtorGroupIds())];
  const inDebtors = groups.length
    ? `d.ledgerId IN (SELECT id FROM AccountLedgers WHERE groupId IN (${groups.join(',')}))`
    : '1 = 0';
  const month = await monthlyBilling(inDebtors, lyToday, lfy);
  const bal = await debtorBalances(groups, inDebtors, t);
  const dockets = await docketCounts(lyToday, lfy);
  const data = { t, fy, lfy, lyToday, month, bal, dockets };
  BOOKS = { key: t, at: Date.now(), data };
  return data;
}

// ---- dashboard ----

// which persons this viewer may pick, and the one shown
function scopeOf(v, persons, want) {
  const byId = new Map(persons.map((person) => [person.id, person]));
  const options = [];
  if (v.team) {
    if (v.team.size > 1) options.push({ value: 'team', label: `My team (${v.team.size})` });
    options.push({ value: String(v.me.id), label: `Me - ${v.me.name}` });
    for (const id of v.team)
      if (id !== v.me.id && byId.get(id)) options.push({ value: String(id), label: byId.get(id).name });
  } else {
    options.push({ value: 'all', label: 'All sales persons' });
    if (v.me) options.push({ value: String(v.me.id), label: `Me - ${v.me.name}` });
    for (const person of persons) {
      if (!v.me || person.id !== v.me.id)
        options.push({ value: String(person.id), label: person.name + (person.isActive === 0 ? ' (left)' : '') });
    }
    options.push({ value: 'none', label: 'Customers with no KAM' });
  }
  let sel = String(want || '');
  if (!options.some((option) => option.value === sel))
    sel = v.team ? (v.team.size > 1 ? 'team' : String(v.me.id)) : 'all';
  const ids = sel === 'team' ? [...v.team] : sel === 'all' || sel === 'none' ? null : [Number(sel)];
  const label = (options.find((option) => option.value === sel) || {}).label;
  return { sel, ids, options, label, person: ids && ids.length === 1 ? byId.get(ids[0]) : null };
}

// customers in scope: by KAM (a customer counts once, under its KAM); "all" and "no KAM" follow the branch in the top bar
async function customersInScope(scope, v) {
  const where = [];
  const params = [];
  if (scope.ids) {
    where.push(`c.kamId IN (${scope.ids.map(() => '?').join(',')})`);
    params.push(...scope.ids);
  } else {
    if (scope.sel === 'none') where.push('c.kamId IS NULL');
    if (v.branches && v.branches.length) {
      where.push(
        `(c.branchCode IS NULL OR c.branchCode = '' OR upper(c.branchCode) IN (${v.branches.map(() => '?').join(',')}))`,
      );
      params.push(...v.branches);
    }
  }
  return q(
    `SELECT c.id, c.name, c.status, c.kamId, c.ledgerId, c.segment, c.industry, c.nextReviewDate, c.branchCode, c.potentialRevenue, c.createdAt, c.city, c.state
      FROM SalesCustomers c ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`,
    params,
  );
}

// the ledgers, contacts and lanes of the customers in scope
async function customerDetails(customerIds) {
  const inIds = customerIds.length ? customerIds.join(',') : '0';
  const hasCustomers = customerIds.length > 0;
  const ledgerRows = hasCustomers
    ? await q(`SELECT c.id cid, c.ledgerId lid, 'MAIN' kind, l.name, g.name gname FROM SalesCustomers c JOIN AccountLedgers l ON l.id = c.ledgerId LEFT JOIN AccountGroups g ON g.id = l.groupId
      WHERE c.id IN (${inIds}) UNION ALL SELECT customerId, ledgerId, kind, NULL, NULL FROM SalesCustomerLedgers WHERE customerId IN (${inIds})`)
    : [];
  const ledgersOf = new Map();
  for (const row of ledgerRows) {
    if (row.kind === 'MAIN' && S.isReimbLedger(row.name, row.gname)) row.kind = 'REIMB';
    pushInto(ledgersOf, row.cid, row);
  }
  const contacts = hasCustomers
    ? await q(
        `SELECT customerId, name, designation, mobile, email, birthday, anniversary, isPrimary FROM SalesContacts WHERE customerId IN (${inIds}) AND coalesce(isActive, 1) = 1`,
      )
    : [];
  const lanes = hasCustomers
    ? await q(
        `SELECT customerId, count(*) n FROM SalesLanes WHERE customerId IN (${inIds}) AND coalesce(isActive, 1) = 1 GROUP BY customerId`,
      )
    : [];
  const laneCount = new Map(lanes.map((row) => [row.customerId, row.n]));
  const contactCount = new Map();
  contacts.forEach((contact) => contactCount.set(contact.customerId, (contactCount.get(contact.customerId) || 0) + 1));
  return { ledgersOf, contacts, laneCount, contactCount };
}

function previousMonthOf(yearMonth) {
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
}

// the 12 months of this FY, each with the same month of last year
function financialYearMonths(fy) {
  return MON.map((label, index) => {
    const year = Number(fy.slice(0, 4)) + (index >= 9 ? 1 : 0);
    const month = ((index + 3) % 12) + 1;
    return {
      key: `${year}-${String(month).padStart(2, '0')}`,
      ly: `${year - 1}-${String(month).padStart(2, '0')}`,
      label,
    };
  });
}

function activityOf(daysSince) {
  if (daysSince == null) return 'NONE';
  if (daysSince <= ACTIVE_DAYS) return 'ACTIVE';
  if (daysSince <= SLOWING_DAYS) return 'SLOWING';
  return 'DORMANT';
}

// one customer's figures from its ledgers; adds its billing to the month columns
function customerRow(customer, context) {
  const { B, fy, periods, months, monthIndex, lastYearIndex, details, personName } = context;
  const fyMonth = fy.slice(0, 7);
  const row = {
    id: customer.id,
    name: customer.name,
    status: customer.status,
    kamId: customer.kamId,
    kam: personName.get(customer.kamId) || '',
    segment: customer.segment,
    city: customer.city || customer.state || '',
    cy: 0,
    lyTo: 0,
    ly: 0,
    thisMonth: 0,
    prevMonth: 0,
    sameMonthLy: 0,
    reimbCy: 0,
    lastBill: null,
    billsCy: 0,
    outstanding: 0,
    overdue: 0,
    creditDays: null,
    nextReviewDate: customer.nextReviewDate,
  };
  for (const ledger of details.ledgersOf.get(customer.id) || []) {
    const isReimbursement = ledger.kind === 'REIMB';
    for (const billing of B.month.get(ledger.lid) || []) {
      if (billing.last && (!row.lastBill || billing.last > row.lastBill)) row.lastBill = billing.last;
      if (isReimbursement) {
        if (billing.m >= fyMonth) {
          row.reimbCy += billing.amt;
          const index = monthIndex.get(billing.m);
          if (index != null) months[index].cyReimb += billing.amt;
        }
        continue;
      }
      if (billing.m >= fyMonth) {
        row.cy += billing.amt;
        row.billsCy += billing.bills;
        const index = monthIndex.get(billing.m);
        if (index != null) months[index].cy += billing.amt;
      } else {
        row.ly += billing.amt;
        row.lyTo += billing.amtTo;
        const index = lastYearIndex.get(billing.m);
        if (index != null) months[index].ly += billing.amt;
      }
      if (billing.m === periods.currentMonth) row.thisMonth += billing.amt;
      if (billing.m === periods.previousMonth) row.prevMonth += billing.amt;
      if (billing.m === periods.sameMonthLastYear) row.sameMonthLy += billing.amtTo;
    }
    const balance = B.bal.get(ledger.lid);
    if (balance) {
      row.outstanding += balance.bal;
      row.overdue += balance.overdue;
      if (!isReimbursement && row.creditDays == null) row.creditDays = balance.cd;
    }
  }
  const daysSince = row.lastBill ? daysBetween(row.lastBill, B.t) : null;
  row.activity = activityOf(daysSince);
  row.daysSince = daysSince;
  row.growth = row.lyTo > 0 ? (row.cy - row.lyTo) / row.lyTo : null;
  for (const field of ROUNDED_ROW_FIELDS) row[field] = r0(row[field]);
  row.hasContact = (details.contactCount.get(customer.id) || 0) > 0;
  row.hasLane = (details.laneCount.get(customer.id) || 0) > 0;
  row.hasIndustry = !!customer.industry;
  row.hasPotential = !!customer.potentialRevenue;
  return row;
}

// dockets: by the marketing person on the docket, matched to the sales persons in scope
function docketFigures(B, persons, scope, fy, months, monthIndex, currentMonth) {
  const personIdByName = new Map();
  for (const person of persons) {
    personIdByName.set(S.nameKey(person.name), person.id);
    String(person.aliases || '')
      .split(',')
      .forEach((alias) => {
        if (alias.trim()) personIdByName.set(S.nameKey(alias), person.id);
      });
  }
  const scopeSet = scope.ids ? new Set(scope.ids) : null;
  const figures = { docCy: 0, docLyTo: 0, docMonth: 0, docBy: new Map() };
  for (const docket of B.dockets) {
    const personId = docket.n ? personIdByName.get(S.nameKey(docket.n)) || null : null;
    const outOfScope = scopeSet ? !scopeSet.has(personId) : scope.sel === 'none' ? personId != null : false;
    if (outOfScope) continue;
    if (docket.m >= fy.slice(0, 7)) {
      figures.docCy += docket.c;
      const index = monthIndex.get(docket.m);
      if (index != null) months[index].dockets += docket.c;
      if (personId) figures.docBy.set(personId, (figures.docBy.get(personId) || 0) + docket.c);
    } else {
      figures.docLyTo += docket.cTo || 0; // the same days last year
    }
    if (docket.m === currentMonth) figures.docMonth += docket.c;
  }
  return figures;
}

const sumOf = (field, list) => list.reduce((sum, row) => sum + (row[field] || 0), 0);
const isQuiet = (row) => row.ly > 0 && (row.daysSince == null || row.daysSince > QUIET_DAYS);
const positiveOutstanding = (list) => r0(list.reduce((sum, row) => sum + Math.max(row.outstanding, 0), 0));

function kpiOf(rows, customers, docketTotals) {
  const newThisFy = rows.filter((row) => row.cy > 0 && row.ly <= 0);
  return {
    billedCy: sumOf('cy', rows),
    billedLyTo: sumOf('lyTo', rows),
    billedLy: sumOf('ly', rows),
    reimbCy: sumOf('reimbCy', rows),
    thisMonth: sumOf('thisMonth', rows),
    prevMonth: sumOf('prevMonth', rows),
    sameMonthLy: sumOf('sameMonthLy', rows),
    outstanding: positiveOutstanding(rows),
    overdue: sumOf('overdue', rows),
    advances: r0(-rows.reduce((sum, row) => sum + Math.min(row.outstanding, 0), 0)),
    customers: customers.length,
    prospects: rows.length - customers.length,
    active: rows.filter((row) => row.activity === 'ACTIVE').length,
    slowing: rows.filter((row) => row.activity === 'SLOWING').length,
    dormant: rows.filter((row) => row.activity === 'DORMANT').length,
    notBilled: customers.filter((row) => row.activity === 'NONE').length,
    newThisFy: newThisFy.length,
    newThisFyBilled: r0(newThisFy.reduce((sum, row) => sum + row.cy, 0)),
    dockets: docketTotals.docCy,
    docketsLyTo: docketTotals.docLyTo,
    docketsMonth: docketTotals.docMonth,
  };
}

const slim = (row) => ({
  id: row.id,
  name: row.name,
  kam: row.kam,
  city: row.city,
  status: row.status,
  cy: row.cy,
  lyTo: row.lyTo,
  ly: row.ly,
  growth: row.growth,
  lastBill: row.lastBill,
  daysSince: row.daysSince,
  activity: row.activity,
  outstanding: row.outstanding,
  overdue: row.overdue,
  creditDays: row.creditDays,
  thisMonth: row.thisMonth,
  billsCy: row.billsCy,
});

function customerLists(rows, todayDate) {
  const top = rows
    .filter((row) => row.cy > 0)
    .sort((a, b) => b.cy - a.cy)
    .slice(0, LIST_SIZE)
    .map(slim);
  // falling: billed at least Rs 1 lakh in the same days last year and 30% or more down
  const falling = rows
    .filter((row) => row.lyTo >= FALLING_MIN_LAST_YEAR && row.cy < row.lyTo * FALLING_SHARE_KEPT)
    .sort((a, b) => b.lyTo - b.cy - (a.lyTo - a.cy))
    .slice(0, LIST_SIZE)
    .map(slim);
  // gone quiet: billed last year, nothing for 60+ days
  const quiet = rows
    .filter(isQuiet)
    .sort((a, b) => b.ly - a.ly)
    .slice(0, LIST_SIZE)
    .map(slim);
  const overdue = rows
    .filter((row) => row.overdue >= OVERDUE_LIST_MIN)
    .sort((a, b) => b.overdue - a.overdue)
    .slice(0, LIST_SIZE)
    .map(slim);
  const reviews = rows
    .filter((row) => row.nextReviewDate && row.nextReviewDate <= addDays(todayDate, REVIEW_AHEAD_DAYS))
    .sort((a, b) => String(a.nextReviewDate).localeCompare(String(b.nextReviewDate)))
    .slice(0, REVIEW_LIST_SIZE)
    .map((row) => ({ ...slim(row), nextReviewDate: row.nextReviewDate, late: row.nextReviewDate < todayDate }));
  return { top, falling, quiet, overdue, reviews };
}

// birthdays and anniversaries in the next 15 days
function upcomingEvents(contacts, rows, todayDate) {
  const customerName = new Map(rows.map((row) => [row.id, row.name]));
  const events = [];
  for (const contact of contacts) {
    for (const [field, what] of [
      ['birthday', 'Birthday'],
      ['anniversary', 'Anniversary'],
    ]) {
      const date = String(contact[field] || '');
      if (!/^\d{4}-\d{2}-\d{2}/.test(date)) continue;
      let next = `${todayDate.slice(0, 4)}${date.slice(4, 10)}`;
      if (next < todayDate) next = `${Number(todayDate.slice(0, 4)) + 1}${date.slice(4, 10)}`;
      const inDays = daysBetween(todayDate, next);
      if (inDays <= EVENT_AHEAD_DAYS) {
        events.push({
          customerId: contact.customerId,
          customer: customerName.get(contact.customerId),
          contact: contact.name,
          designation: contact.designation,
          mobile: contact.mobile,
          what,
          date: next,
          inDays,
        });
      }
    }
  }
  events.sort((a, b) => a.inDays - b.inDays);
  return events;
}

function profileCompleteness(customers) {
  const billed = customers.filter((row) => row.cy > 0 || row.ly > 0);
  return {
    total: billed.length,
    contact: billed.filter((row) => row.hasContact).length,
    lane: billed.filter((row) => row.hasLane).length,
    industry: billed.filter((row) => row.hasIndustry).length,
    potential: billed.filter((row) => row.hasPotential).length,
  };
}

// person by person (when more than one person is shown)
function teamFigures(rows, scope, personName, docBy) {
  if (scope.ids && scope.ids.length <= 1) return [];
  const rowsByKam = new Map();
  for (const row of rows) pushInto(rowsByKam, row.kamId || 0, row);
  if (scope.ids) for (const id of scope.ids) if (!rowsByKam.has(id)) rowsByKam.set(id, []); // team members with no customer yet
  return [...rowsByKam.entries()]
    .map(([kamId, list]) => ({
      id: kamId || null,
      name: kamId ? personName.get(kamId) || '?' : 'No KAM',
      customers: list.filter((row) => row.status !== 'PROSPECT').length,
      prospects: list.filter((row) => row.status === 'PROSPECT').length,
      cy: sumOf('cy', list),
      lyTo: sumOf('lyTo', list),
      thisMonth: sumOf('thisMonth', list),
      outstanding: positiveOutstanding(list),
      overdue: sumOf('overdue', list),
      active: list.filter((row) => row.activity === 'ACTIVE').length,
      quiet: list.filter(isQuiet).length,
      dockets: kamId ? docBy.get(kamId) || 0 : null,
    }))
    .map((member) => ({ ...member, growth: member.lyTo > 0 ? (member.cy - member.lyTo) / member.lyTo : null }))
    .sort((a, b) => (a.id ? 0 : 1) - (b.id ? 0 : 1) || b.cy - a.cy);
}

async function build(req) {
  const v = await S.viewer(req);
  const B = await books();
  const { t, fy, lyToday } = B;
  const persons = await q(
    'SELECT id, code, name, role, reportingToId, aliases, userId, isActive, branchCodes FROM SalesPersons ORDER BY coalesce(isActive, 1) DESC, name',
  );
  const scope = scopeOf(v, persons, req.query.person);

  const customersFound = await customersInScope(scope, v);
  const details = await customerDetails(customersFound.map((customer) => customer.id));
  const personName = new Map(persons.map((person) => [person.id, person.name]));

  const currentMonth = t.slice(0, 7);
  const periods = {
    currentMonth,
    previousMonth: previousMonthOf(currentMonth),
    sameMonthLastYear: lyToday.slice(0, 7),
  };
  const fyMonths = financialYearMonths(fy);
  const months = fyMonths.map((month) => ({
    month: month.key,
    label: month.label,
    cy: 0,
    ly: 0,
    cyReimb: 0,
    dockets: 0,
    future: month.key > currentMonth,
  }));
  const monthIndex = new Map(fyMonths.map((month, index) => [month.key, index]));
  const lastYearIndex = new Map(fyMonths.map((month, index) => [month.ly, index]));

  const context = { B, fy, periods, months, monthIndex, lastYearIndex, details, personName };
  const rows = customersFound.map((customer) => customerRow(customer, context));
  months.forEach((month) => {
    month.cy = r0(month.cy);
    month.ly = r0(month.ly);
    month.cyReimb = r0(month.cyReimb);
  });

  const docketTotals = docketFigures(B, persons, scope, fy, months, monthIndex, currentMonth);
  const customers = rows.filter((row) => row.status !== 'PROSPECT');
  const kpi = kpiOf(rows, customers, docketTotals);
  const { top, falling, quiet, overdue, reviews } = customerLists(rows, t);
  const events = upcomingEvents(details.contacts, rows, t);
  const profile = profileCompleteness(customers);
  const team = teamFigures(rows, scope, personName, docketTotals.docBy);
  const noLogin = v.canManage ? persons.filter((person) => person.isActive !== 0 && !person.userId).length : 0;
  return {
    success: true,
    asOn: t,
    fy,
    fyLabel: `${fy.slice(2, 4)}-${String(Number(fy.slice(2, 4)) + 1).padStart(2, '0')}`,
    lyToday,
    curMonth: currentMonth,
    scope: {
      sel: scope.sel,
      label: scope.label,
      options: scope.options,
      person: scope.person ? { id: scope.person.id, name: scope.person.name, role: scope.person.role } : null,
    },
    me: v.me ? { id: v.me.id, name: v.me.name, role: v.me.role } : null,
    canManage: v.canManage,
    noLogin,
    defaultCredit: DEFAULT_CREDIT,
    kpi,
    months,
    top,
    falling,
    quiet,
    overdue,
    reviews,
    events: events.slice(0, EVENT_LIST_SIZE),
    profile,
    team,
  };
}

export { build, books };
