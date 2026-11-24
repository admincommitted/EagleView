// Sales dashboard (11-Nov-2026): what one sales person (or his team, or the whole branch) has - billing this FY against
// the same days of last FY, this month, month by month, outstanding and overdue, dockets, customers that are falling /
// gone quiet / overdue, reviews due, contacts' birthdays, how complete the profiles are, and (team) person by person.
// A sales person who logs in sees his own; a manager / head his team; admin (or a user who is not a sales person) all.
// Figures are company-wide (every branch the customer is billed from) and are read from the books - nothing is written.
const S = require('./salesHub');
const { q, today } = S;

const fyStart = (d) => { const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)); return `${m < 4 ? y - 1 : y}-04-01`; };
const addYears = (d, n) => `${Number(d.slice(0, 4)) + n}${d.slice(4)}`;
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const MON = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const r0 = (n) => Math.round(Number(n) || 0);
const DEFAULT_CREDIT = 30;

// what the books say, per debtor ledger - read once, kept 10 minutes
let BOOKS = { key: '', at: 0, data: null };
async function books() {
  const t = today();
  if (BOOKS.key === t && Date.now() - BOOKS.at < 600000) return BOOKS.data;
  const fy = fyStart(t), lfy = addYears(fy, -1), lyToday = addYears(t, -1), recentFrom = addDays(t, -200);
  const groups = [...await S.debtorGroupIds()];
  const inDebtors = groups.length ? `d.ledgerId IN (SELECT id FROM AccountLedgers WHERE groupId IN (${groups.join(',')}))` : '1 = 0';
  // billing (sales less credit notes, incl. GST) by ledger and month, since the start of last FY
  const rows = await q(`SELECT d.ledgerId lid, substr(v.date, 1, 7) m,
      sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) amt,
      sum(CASE WHEN v.date <= ? THEN (CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) ELSE 0 END) amtTo,
      count(DISTINCT CASE WHEN t.baseType = 'Sales' THEN v.id END) bills, max(CASE WHEN t.baseType = 'Sales' THEN v.date END) last
    FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
    WHERE t.baseType IN ('Sales', 'Credit Note') AND coalesce(v.status, '') <> 'Rejected' AND v.date >= ? AND ${inDebtors}
    GROUP BY d.ledgerId, m`, [lyToday, lfy]);
  const month = new Map();
  for (const r of rows) { if (!month.has(r.lid)) month.set(r.lid, []); month.get(r.lid).push({ m: r.m, amt: r.amt || 0, amtTo: r.amtTo || 0, bills: r.bills || 0, last: r.last ? String(r.last).slice(0, 10) : null }); }
  // balance (opening + every valid voucher) of every debtor ledger
  const led = await q(`SELECT id, openingBalance ob, balanceType bt, creditDays cd FROM AccountLedgers WHERE groupId IN (${groups.join(',') || 0})`);
  const mv = new Map((await q(`SELECT d.ledgerId lid, sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) mv FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
      WHERE coalesce(v.status, '') <> 'Rejected' AND ${inDebtors} GROUP BY d.ledgerId`)).map(r => [r.lid, r.mv || 0]));
  // bills of the last 200 days by date: what is still inside the credit days is not overdue yet
  const recent = new Map();
  for (const r of await q(`SELECT d.ledgerId lid, v.date dt, sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE 0 END) amt FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
      JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE t.baseType = 'Sales' AND coalesce(v.status, '') <> 'Rejected' AND v.date >= ? AND ${inDebtors} GROUP BY d.ledgerId, v.date`, [recentFrom])) {
    if (!recent.has(r.lid)) recent.set(r.lid, []); recent.get(r.lid).push([String(r.dt).slice(0, 10), r.amt || 0]);
  }
  const bal = new Map();
  for (const l of led) {
    const b = (l.bt === 'Cr' ? -1 : 1) * (Number(l.ob) || 0) + (mv.get(l.id) || 0);
    if (Math.abs(b) < 1) continue;
    const cd = Number(l.cd) > 0 ? Number(l.cd) : DEFAULT_CREDIT; const from = addDays(t, -cd);
    const notDue = (recent.get(l.id) || []).filter(([d]) => d > from).reduce((a, [, x]) => a + x, 0);
    bal.set(l.id, { bal: b, overdue: b > 0 ? Math.max(0, b - notDue) : 0, cd });
  }
  // dockets by the marketing person written on them
  const dq = (del) => q(`SELECT upper(trim(coalesce(marketingPerson, ''))) n, substr(docketDate, 1, 7) m, count(*) c, sum(CASE WHEN docketDate <= ? THEN 1 ELSE 0 END) cTo FROM Shipments
      WHERE docketDate >= ? ${del ? 'AND coalesce(isDeleted, 0) = 0' : ''} GROUP BY 1, 2`, [lyToday, lfy]);
  const dockets = await dq(true).catch(() => dq(false)).catch(() => []);
  const data = { t, fy, lfy, lyToday, month, bal, dockets };
  BOOKS = { key: t, at: Date.now(), data };
  return data;
}

// which persons this viewer may pick, and the one shown
function scopeOf(v, persons, want) {
  const byId = new Map(persons.map(p => [p.id, p]));
  const options = [];
  if (v.team) {
    if (v.team.size > 1) options.push({ value: 'team', label: `My team (${v.team.size})` });
    options.push({ value: String(v.me.id), label: `Me - ${v.me.name}` });
    for (const id of v.team) if (id !== v.me.id && byId.get(id)) options.push({ value: String(id), label: byId.get(id).name });
  } else {
    options.push({ value: 'all', label: 'All sales persons' });
    if (v.me) options.push({ value: String(v.me.id), label: `Me - ${v.me.name}` });
    for (const p of persons) if (!v.me || p.id !== v.me.id) options.push({ value: String(p.id), label: p.name + (p.isActive === 0 ? ' (left)' : '') });
    options.push({ value: 'none', label: 'Customers with no KAM' });
  }
  let sel = String(want || '');
  if (!options.some(o => o.value === sel)) sel = v.team ? (v.team.size > 1 ? 'team' : String(v.me.id)) : 'all';
  const ids = sel === 'team' ? [...v.team] : sel === 'all' || sel === 'none' ? null : [Number(sel)];
  const label = (options.find(o => o.value === sel) || {}).label;
  return { sel, ids, options, label, person: ids && ids.length === 1 ? byId.get(ids[0]) : null };
}

async function build(req) {
  const v = await S.viewer(req);
  const B = await books();
  const { t, fy, lfy, lyToday } = B;
  const persons = await q('SELECT id, code, name, role, reportingToId, aliases, userId, isActive, branchCodes FROM SalesPersons ORDER BY coalesce(isActive, 1) DESC, name');
  const sc = scopeOf(v, persons, req.query.person);

  // customers in scope: by KAM (a customer counts once, under its KAM); "all" and "no KAM" follow the branch in the top bar
  const where = []; const p = [];
  if (sc.ids) { where.push(`c.kamId IN (${sc.ids.map(() => '?').join(',')})`); p.push(...sc.ids); }
  else {
    if (sc.sel === 'none') where.push('c.kamId IS NULL');
    if (v.branches && v.branches.length) { where.push(`(c.branchCode IS NULL OR c.branchCode = '' OR upper(c.branchCode) IN (${v.branches.map(() => '?').join(',')}))`); p.push(...v.branches); }
  }
  const custs = await q(`SELECT c.id, c.name, c.status, c.kamId, c.ledgerId, c.segment, c.industry, c.nextReviewDate, c.branchCode, c.potentialRevenue, c.createdAt, c.city, c.state
      FROM SalesCustomers c ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`, p);
  const ids = custs.map(c => c.id);
  const inIds = ids.length ? ids.join(',') : '0';
  const ledRows = ids.length ? await q(`SELECT c.id cid, c.ledgerId lid, 'MAIN' kind, l.name, g.name gname FROM SalesCustomers c JOIN AccountLedgers l ON l.id = c.ledgerId LEFT JOIN AccountGroups g ON g.id = l.groupId
      WHERE c.id IN (${inIds}) UNION ALL SELECT customerId, ledgerId, kind, NULL, NULL FROM SalesCustomerLedgers WHERE customerId IN (${inIds})`) : [];
  const ledOf = new Map();
  for (const r of ledRows) { if (r.kind === 'MAIN' && S.isReimbLedger(r.name, r.gname)) r.kind = 'REIMB'; if (!ledOf.has(r.cid)) ledOf.set(r.cid, []); ledOf.get(r.cid).push(r); }
  const contacts = ids.length ? await q(`SELECT customerId, name, designation, mobile, email, birthday, anniversary, isPrimary FROM SalesContacts WHERE customerId IN (${inIds}) AND coalesce(isActive, 1) = 1`) : [];
  const lanes = ids.length ? await q(`SELECT customerId, count(*) n FROM SalesLanes WHERE customerId IN (${inIds}) AND coalesce(isActive, 1) = 1 GROUP BY customerId`) : [];
  const laneN = new Map(lanes.map(r => [r.customerId, r.n]));
  const contactN = new Map(); contacts.forEach(c => contactN.set(c.customerId, (contactN.get(c.customerId) || 0) + 1));
  const personName = new Map(persons.map(x => [x.id, x.name]));

  const curM = t.slice(0, 7), lyM = lyToday.slice(0, 7);
  const prevM = (() => { const y = Number(curM.slice(0, 4)), m = Number(curM.slice(5, 7)); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; })();
  const fyMonths = MON.map((n, i) => { const y = Number(fy.slice(0, 4)) + (i >= 9 ? 1 : 0); const m = ((i + 3) % 12) + 1; return { key: `${y}-${String(m).padStart(2, '0')}`, ly: `${y - 1}-${String(m).padStart(2, '0')}`, label: n }; });
  const months = fyMonths.map(m => ({ month: m.key, label: m.label, cy: 0, ly: 0, cyReimb: 0, dockets: 0, future: m.key > curM }));
  const mIdx = new Map(fyMonths.map((m, i) => [m.key, i])), lyIdx = new Map(fyMonths.map((m, i) => [m.ly, i]));

  const rows = custs.map(c => {
    const o = { id: c.id, name: c.name, status: c.status, kamId: c.kamId, kam: personName.get(c.kamId) || '', segment: c.segment, city: c.city || c.state || '',
      cy: 0, lyTo: 0, ly: 0, thisMonth: 0, prevMonth: 0, sameMonthLy: 0, reimbCy: 0, lastBill: null, billsCy: 0, outstanding: 0, overdue: 0, creditDays: null, nextReviewDate: c.nextReviewDate };
    for (const l of ledOf.get(c.id) || []) {
      const reimb = l.kind === 'REIMB';
      for (const r of B.month.get(l.lid) || []) {
        if (r.last && (!o.lastBill || r.last > o.lastBill)) o.lastBill = r.last;
        if (reimb) { if (r.m >= fy.slice(0, 7)) { o.reimbCy += r.amt; const i = mIdx.get(r.m); if (i != null) months[i].cyReimb += r.amt; } continue; }
        if (r.m >= fy.slice(0, 7)) { o.cy += r.amt; o.billsCy += r.bills; const i = mIdx.get(r.m); if (i != null) months[i].cy += r.amt; }
        else { o.ly += r.amt; o.lyTo += r.amtTo; const i = lyIdx.get(r.m); if (i != null) months[i].ly += r.amt; }
        if (r.m === curM) o.thisMonth += r.amt; if (r.m === prevM) o.prevMonth += r.amt; if (r.m === lyM) o.sameMonthLy += r.amtTo;
      }
      const b = B.bal.get(l.lid); if (b) { o.outstanding += b.bal; o.overdue += b.overdue; if (!reimb && o.creditDays == null) o.creditDays = b.cd; }
    }
    const d = o.lastBill ? daysBetween(o.lastBill, t) : null;
    o.activity = d == null ? 'NONE' : d <= 60 ? 'ACTIVE' : d <= 120 ? 'SLOWING' : 'DORMANT';
    o.daysSince = d;
    o.growth = o.lyTo > 0 ? (o.cy - o.lyTo) / o.lyTo : null;
    for (const k of ['cy', 'lyTo', 'ly', 'thisMonth', 'prevMonth', 'sameMonthLy', 'reimbCy', 'outstanding', 'overdue']) o[k] = r0(o[k]);
    o.hasContact = (contactN.get(c.id) || 0) > 0; o.hasLane = (laneN.get(c.id) || 0) > 0; o.hasIndustry = !!c.industry; o.hasPotential = !!c.potentialRevenue;
    return o;
  });
  months.forEach(m => { m.cy = r0(m.cy); m.ly = r0(m.ly); m.cyReimb = r0(m.cyReimb); });

  // dockets: by the marketing person on the docket, matched to the sales persons in scope
  const keyOf = new Map(); for (const x of persons) { keyOf.set(S.nameKey(x.name), x.id); String(x.aliases || '').split(',').forEach(a => { if (a.trim()) keyOf.set(S.nameKey(a), x.id); }); }
  const scopeSet = sc.ids ? new Set(sc.ids) : null;
  let docCy = 0, docLyTo = 0, docMonth = 0; const docBy = new Map();
  for (const r of B.dockets) {
    const pid = r.n ? keyOf.get(S.nameKey(r.n)) || null : null;
    if (scopeSet ? !scopeSet.has(pid) : sc.sel === 'none' ? pid != null : false) continue;
    if (r.m >= fy.slice(0, 7)) { docCy += r.c; const i = mIdx.get(r.m); if (i != null) months[i].dockets += r.c; if (pid) docBy.set(pid, (docBy.get(pid) || 0) + r.c); }
    else docLyTo += r.cTo || 0; // the same days last year
    if (r.m === curM) docMonth += r.c;
  }

  const sum = (k, list = rows) => list.reduce((a, r) => a + (r[k] || 0), 0);
  const customers = rows.filter(r => r.status !== 'PROSPECT');
  const kpi = {
    billedCy: sum('cy'), billedLyTo: sum('lyTo'), billedLy: sum('ly'), reimbCy: sum('reimbCy'),
    thisMonth: sum('thisMonth'), prevMonth: sum('prevMonth'), sameMonthLy: sum('sameMonthLy'),
    outstanding: r0(rows.reduce((a, r) => a + Math.max(r.outstanding, 0), 0)), overdue: sum('overdue'), advances: r0(-rows.reduce((a, r) => a + Math.min(r.outstanding, 0), 0)),
    customers: customers.length, prospects: rows.length - customers.length,
    active: rows.filter(r => r.activity === 'ACTIVE').length, slowing: rows.filter(r => r.activity === 'SLOWING').length, dormant: rows.filter(r => r.activity === 'DORMANT').length,
    notBilled: customers.filter(r => r.activity === 'NONE').length,
    newThisFy: rows.filter(r => r.cy > 0 && r.ly <= 0).length, newThisFyBilled: r0(rows.filter(r => r.cy > 0 && r.ly <= 0).reduce((a, r) => a + r.cy, 0)),
    dockets: docCy, docketsLyTo: docLyTo, docketsMonth: docMonth,
  };
  const slim = (r) => ({ id: r.id, name: r.name, kam: r.kam, city: r.city, status: r.status, cy: r.cy, lyTo: r.lyTo, ly: r.ly, growth: r.growth, lastBill: r.lastBill, daysSince: r.daysSince,
    activity: r.activity, outstanding: r.outstanding, overdue: r.overdue, creditDays: r.creditDays, thisMonth: r.thisMonth, billsCy: r.billsCy });
  const top = rows.filter(r => r.cy > 0).sort((a, b) => b.cy - a.cy).slice(0, 12).map(slim);
  // falling: billed at least Rs 1 lakh in the same days last year and 30% or more down
  const falling = rows.filter(r => r.lyTo >= 100000 && r.cy < r.lyTo * 0.7).sort((a, b) => (b.lyTo - b.cy) - (a.lyTo - a.cy)).slice(0, 12).map(slim);
  // gone quiet: billed last year, nothing for 60+ days
  const quiet = rows.filter(r => r.ly > 0 && (r.daysSince == null || r.daysSince > 60)).sort((a, b) => b.ly - a.ly).slice(0, 12).map(slim);
  const overdue = rows.filter(r => r.overdue >= 1000).sort((a, b) => b.overdue - a.overdue).slice(0, 12).map(slim);
  const reviews = rows.filter(r => r.nextReviewDate && r.nextReviewDate <= addDays(t, 7)).sort((a, b) => String(a.nextReviewDate).localeCompare(String(b.nextReviewDate))).slice(0, 15)
    .map(r => ({ ...slim(r), nextReviewDate: r.nextReviewDate, late: r.nextReviewDate < t }));
  // birthdays and anniversaries in the next 15 days
  const nameOf = new Map(rows.map(r => [r.id, r.name]));
  const events = [];
  for (const c of contacts) for (const [k, what] of [['birthday', 'Birthday'], ['anniversary', 'Anniversary']]) {
    const d = String(c[k] || ''); if (!/^\d{4}-\d{2}-\d{2}/.test(d)) continue;
    let next = `${t.slice(0, 4)}${d.slice(4, 10)}`; if (next < t) next = `${Number(t.slice(0, 4)) + 1}${d.slice(4, 10)}`;
    const inDays = daysBetween(t, next); if (inDays <= 15) events.push({ customerId: c.customerId, customer: nameOf.get(c.customerId), contact: c.name, designation: c.designation, mobile: c.mobile, what, date: next, inDays });
  }
  events.sort((a, b) => a.inDays - b.inDays);
  const billedOnes = customers.filter(r => r.cy > 0 || r.ly > 0);
  const profile = { total: billedOnes.length, contact: billedOnes.filter(r => r.hasContact).length, lane: billedOnes.filter(r => r.hasLane).length,
    industry: billedOnes.filter(r => r.hasIndustry).length, potential: billedOnes.filter(r => r.hasPotential).length };

  // person by person (when more than one person is shown)
  let team = [];
  if (!sc.ids || sc.ids.length > 1) {
    const by = new Map();
    for (const r of rows) { const k = r.kamId || 0; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
    if (sc.ids) for (const id of sc.ids) if (!by.has(id)) by.set(id, []); // team members with no customer yet
    team = [...by.entries()].map(([k, list]) => ({
      id: k || null, name: k ? personName.get(k) || '?' : 'No KAM', customers: list.filter(r => r.status !== 'PROSPECT').length, prospects: list.filter(r => r.status === 'PROSPECT').length,
      cy: sum('cy', list), lyTo: sum('lyTo', list), thisMonth: sum('thisMonth', list), outstanding: r0(list.reduce((a, r) => a + Math.max(r.outstanding, 0), 0)), overdue: sum('overdue', list),
      active: list.filter(r => r.activity === 'ACTIVE').length, quiet: list.filter(r => r.ly > 0 && (r.daysSince == null || r.daysSince > 60)).length, dockets: k ? docBy.get(k) || 0 : null,
    })).map(x => ({ ...x, growth: x.lyTo > 0 ? (x.cy - x.lyTo) / x.lyTo : null })).sort((a, b) => (a.id ? 0 : 1) - (b.id ? 0 : 1) || b.cy - a.cy);
  }
  const noLogin = v.canManage ? persons.filter(x => x.isActive !== 0 && !x.userId).length : 0;
  return {
    success: true, asOn: t, fy, fyLabel: `${fy.slice(2, 4)}-${String(Number(fy.slice(2, 4)) + 1).padStart(2, '0')}`, lyToday, curMonth: curM,
    scope: { sel: sc.sel, label: sc.label, options: sc.options, person: sc.person ? { id: sc.person.id, name: sc.person.name, role: sc.person.role } : null },
    me: v.me ? { id: v.me.id, name: v.me.name, role: v.me.role } : null, canManage: v.canManage, noLogin, defaultCredit: DEFAULT_CREDIT,
    kpi, months, top, falling, quiet, overdue, reviews, events: events.slice(0, 20), profile, team,
  };
}

module.exports = { build, books };
