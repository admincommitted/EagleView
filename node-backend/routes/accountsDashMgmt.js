// 08-Nov-2026: management figures for the Accounts dashboard (GET /api/accounts-hub/dashboard -> "mgmt").
// Read only. Everything below follows the branch picked in the top bar (the Vouchers table is limited by
// utils/branchScope), except "branches", which compares every branch the user may see.
//   - profit before tax: the year-end journals to "PROFIT ON LOSS ACCOUNT" (profit moved to reserves, income-tax
//     provision, deferred tax) are not expenses of the year, so they are kept out and shown on their own
//   - gross margin: direct incomes less direct expenses (groups under Direct Incomes / Sales Accounts and
//     Direct Expenses / Purchase Accounts)
//   - reimbursable (pass-through): income heads billed mostly on REIMBURSABLE invoices (import duty, DO, stamp duty...)
//     against the expense head of the same name; net revenue = income less these
//   - by division (AE / AI / SE / SI from the voucher), by branch, top customers with job margin, jobs with cost and
//     no invoice, loss-making jobs, dockets with no invoice, billing vs collection, last year's figures, expenses
//     against the ledger's monthly budget (or last year), GST / TDS due dates, bank reconciliation status
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../db');
const bs = require('../utils/branchScope');

const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const r2 = (v) => Math.round(num(v) * 100) / 100;
const APPROP = /PROFIT\s*(ON|AND|&)\s*LOSS|INCOME\s*TAX|DEF+ERED\s*TAX/i;
const DIRECT = /^(direct (incomes?|expenses?)|sales accounts?|purchase accounts?)$/i;
const REIMB = /REIMBURS/i;
const DIVS = { AE: 'Air Export', AI: 'Air Import', SE: 'Sea Export', SI: 'Sea Import' };
const stem = (n) => String(n || '').toUpperCase().replace(/\(.*?\)/g, ' ')
  .replace(/\b(CHARGES?|CHGS?|INCOME|EXPENSES?|EXP|RECEIPTED|PAID|A\/C|ACCOUNT|GROUP)\b/g, ' ').replace(/[^A-Z0-9]+/g, ' ').trim();
const shiftYear = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCFullYear(t.getUTCFullYear() + n); return t.toISOString().slice(0, 10); };
const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const ym = (d) => String(d).slice(0, 7);
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // m = 1..12
const monthLabel = (m) => new Date(m + '-01T00:00:00Z').toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

module.exports = async function mgmtFigures({ q, VALID, fy, asOn, ledgers, groups, byId, path, debtorG, creditorG, bankG, incomeG, expenseG, receivable, payable, months, cash, req }) {
  const out = {};
  const lg = new Map(ledgers.map(l => [l.id, l]));
  const inList = (ids) => [...ids].map(Number).filter(Number.isFinite).join(',') || '0';
  // ledger classification
  const cls = new Map();
  for (const l of ledgers) {
    const inc = incomeG.has(l.groupId), exp = expenseG.has(l.groupId);
    if (!inc && !exp) continue;
    const p = path(l.groupId);
    cls.set(l.id, { nat: inc ? 'I' : 'E', direct: p.some(n => DIRECT.test(String(n).trim())), approp: exp && APPROP.test(l.name), stem: stem(l.name) });
  }
  const plIds = inList(cls.keys());

  // ---------------- this year's income / expense lines with voucher, division and job
  const lines = await q(`SELECT d.voucherId vid, d.ledgerId, d.dc, d.amount, v.date, upper(coalesce(v.division, '')) division, upper(trim(coalesce(v.jobNo, ''))) jobNo,
      upper(coalesce(v.icaffeType, '') || ' ' || coalesce(t.name, '')) vtype, t.baseType
      FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
      WHERE ${VALID} AND v.date >= ? AND v.date <= ? AND d.ledgerId IN (${plIds})`, [fy.startDate, asOn]);
  const T = { income: 0, expense: 0, approp: 0, dInc: 0, dExp: 0 };
  const div = new Map(); const ensureDiv = (k) => { if (!div.has(k)) div.set(k, { code: k, name: DIVS[k] || 'Other / not tagged', income: 0, direct: 0, indirect: 0 }); return div.get(k); };
  const mon = new Map(months.map(m => [m.m, { m: m.m, income: 0, expense: 0, approp: 0, dInc: 0, dExp: 0 }]));
  const ledInc = new Map(), ledReimb = new Map(), ledExp = new Map(), divLed = new Map();
  const jobs = new Map(); const job = (j) => { if (!jobs.has(j)) jobs.set(j, { jobNo: j, income: 0, cost: 0, first: '9999', last: '', div: '', cust: new Map() }); return jobs.get(j); };
  const vInc = new Map(); // voucher -> income credited (for the customer split)
  for (const r of lines) {
    const c = cls.get(r.ledgerId); if (!c) continue;
    const a = num(r.amount); const s = r.dc === 'Dr' ? a : -a; const mm = mon.get(ym(r.date));
    const dk = DIVS[r.division] ? r.division : '-';
    if (c.nat === 'I') {
      T.income -= s; if (c.direct) T.dInc -= s; if (mm) { mm.income -= s; if (c.direct) mm.dInc -= s; }
      ensureDiv(dk).income -= s; divLed.set(dk + '|' + r.ledgerId, (divLed.get(dk + '|' + r.ledgerId) || 0) - s);
      ledInc.set(r.ledgerId, (ledInc.get(r.ledgerId) || 0) - s);
      if (REIMB.test(r.vtype)) ledReimb.set(r.ledgerId, (ledReimb.get(r.ledgerId) || 0) - s);
      if (r.jobNo) { const j = job(r.jobNo); j.income -= s; if (!j.div) j.div = dk; }
      vInc.set(r.vid, (vInc.get(r.vid) || 0) - s);
    } else if (c.approp) { T.approp += s; if (mm) mm.approp += s; }
    else {
      T.expense += s; if (c.direct) T.dExp += s; if (mm) { mm.expense += s; if (c.direct) mm.dExp += s; }
      const dv = ensureDiv(dk); if (c.direct) dv.direct += s; else dv.indirect += s;
      ledExp.set(r.ledgerId, (ledExp.get(r.ledgerId) || 0) + s);
      if (r.jobNo && c.direct) { const j = job(r.jobNo); j.cost += s; if (!j.div) j.div = dk; if (r.date < j.first) j.first = r.date; if (r.date > j.last) j.last = r.date; }
    }
  }
  const profit = T.income - T.expense, gross = T.dInc - T.dExp;

  // reimbursable: income heads billed mostly on reimbursable invoices, against the expense head of the same name
  const expByStem = new Map(); for (const [id, v] of ledExp) { const st = cls.get(id).stem; if (st) expByStem.set(st, (expByStem.get(st) || 0) + v); }
  const reimb = [];
  for (const [id, v] of ledInc) {
    const rb = ledReimb.get(id) || 0; if (v <= 0 || rb < v * 0.5) continue;
    const st = cls.get(id).stem; const cost = expByStem.get(st) || 0;
    reimb.push({ id, name: (lg.get(id) || {}).name, billed: r2(v), cost: r2(cost), diff: r2(v - cost) });
  }
  reimb.sort((a, b) => b.billed - a.billed);
  const rBilled = reimb.reduce((t, x) => t + x.billed, 0), rCost = reimb.reduce((t, x) => t + x.cost, 0);
  const netRevenue = T.income - rBilled;
  out.pl = {
    income: r2(T.income), expense: r2(T.expense), profit: r2(profit), approp: r2(T.approp), bookProfit: r2(profit - T.approp),
    directIncome: r2(T.dInc), directExpense: r2(T.dExp), gross: r2(gross), indirectExpense: r2(T.expense - T.dExp), otherIncome: r2(T.income - T.dInc),
    netRevenue: r2(netRevenue), grossPct: netRevenue > 0 ? Math.round(gross / netRevenue * 1000) / 10 : null, netPct: netRevenue > 0 ? Math.round(profit / netRevenue * 1000) / 10 : null,
  };
  out.reimb = { billed: r2(rBilled), cost: r2(rCost), diff: r2(rBilled - rCost), heads: reimb.slice(0, 8) };
  out.months = [...mon.values()].map(m => ({ m: m.m, income: r2(m.income), expense: r2(m.expense), profit: r2(m.income - m.expense), gross: r2(m.dInc - m.dExp), approp: r2(m.approp) }));
  // by division: gross margin on net revenue (income less reimbursable). Indirect costs (salary, rent...) are mostly not
  // tagged to a division in iCAFFE, so they are shown as a total only.
  const reimbIds = new Set(reimb.map(x => x.id));
  out.divisions = [...div.values()].filter(d => Math.abs(d.income) + Math.abs(d.direct) > 1).map(d => {
    let rb = 0; for (const id of reimbIds) rb += divLed.get(d.code + '|' + id) || 0;
    const nr = d.income - rb, g = d.income - d.direct;
    return { code: d.code, name: d.name, income: r2(d.income), reimb: r2(rb), netRevenue: r2(nr), direct: r2(d.direct), gross: r2(g), grossPct: nr > 0 ? Math.round(g / nr * 1000) / 10 : null,
      share: netRevenue ? Math.round(nr / netRevenue * 1000) / 10 : 0, indirect: r2(d.indirect) };
  }).sort((a, b) => b.netRevenue - a.netRevenue);

  // ---------------- customers: revenue (income on their invoices) and the margin of their jobs
  const debt = inList(debtorG);
  const vDebtor = await q(`SELECT d.voucherId vid, d.ledgerId, d.amount FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN AccountLedgers l ON l.id = d.ledgerId
      WHERE ${VALID} AND v.date >= ? AND v.date <= ? AND l.groupId IN (${debt}) ORDER BY d.amount`, [fy.startDate, asOn]);
  const vParty = new Map(); for (const r of vDebtor) vParty.set(r.vid, r.ledgerId); // the largest debtor line wins
  const cust = new Map(); const cu = (id) => { if (!cust.has(id)) cust.set(id, { id, name: (lg.get(id) || {}).name || '#' + id, revenue: 0, cost: 0, jobs: 0 }); return cust.get(id); };
  for (const r of lines) {
    const c = cls.get(r.ledgerId); if (!c || c.nat !== 'I') continue;
    const p = vParty.get(r.vid); if (!p) continue;
    const s = r.dc === 'Dr' ? num(r.amount) : -num(r.amount);
    cu(p).revenue -= s;
    if (r.jobNo) { const jm = job(r.jobNo).cust; jm.set(p, (jm.get(p) || 0) - s); }
  }
  for (const j of jobs.values()) {
    let best = null, bv = -Infinity; for (const [p, v] of j.cust) if (v > bv) { best = p; bv = v; }
    j.custId = best; if (best != null) { const c = cu(best); c.cost += j.cost; c.jobs++; }
  }
  const recBy = new Map((receivable.parties || []).map(p => [p.id, p]));
  out.customers = [...cust.values()].filter(c => c.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 10).map(c => {
    const rp = recBy.get(c.id) || {};
    return { id: c.id, name: c.name, revenue: r2(c.revenue), cost: r2(c.cost), margin: r2(c.revenue - c.cost), marginPct: c.revenue ? Math.round((c.revenue - c.cost) / c.revenue * 1000) / 10 : null,
      jobs: c.jobs, share: T.income ? Math.round(c.revenue / T.income * 1000) / 10 : 0, outstanding: r2(rp.balance || 0), overdue: r2(rp.overdue || 0) };
  });
  out.customerCount = [...cust.values()].filter(c => c.revenue > 0).length;

  // ---------------- jobs: cost booked with no invoice, loss-making jobs
  // a job billed in an earlier year (cost booked this year) is not unbilled, and its margin cannot be judged on this year alone
  const billedJobs = await q(`SELECT upper(trim(v.jobNo)) j, min(v.date) first FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId
      WHERE ${VALID} AND t.baseType = 'Sales' AND coalesce(v.jobNo, '') <> '' GROUP BY 1`);
  const billedFirst = new Map(billedJobs.map(r => [r.j, r.first]));
  const all = [...jobs.values()].filter(j => j.cost > 0.5 || j.income > 0.5);
  const unbilled = all.filter(j => j.cost > 0.5 && j.income <= 0.5 && !billedFirst.has(j.jobNo)).sort((a, b) => b.cost - a.cost);
  const loss = all.filter(j => j.income > 0.5 && j.cost > j.income + 0.5 && !(billedFirst.get(j.jobNo) < fy.startDate)).sort((a, b) => (b.cost - b.income) - (a.cost - a.income));
  out.jobs = {
    total: all.length, billed: all.filter(j => j.income > 0.5).length,
    unbilled: { count: unbilled.length, cost: r2(unbilled.reduce((t, j) => t + j.cost, 0)), list: unbilled.slice(0, 10).map(j => ({ jobNo: j.jobNo, cost: r2(j.cost), first: j.first, last: j.last, division: DIVS[j.div] ? j.div : '' })) },
    loss: { count: loss.length, amount: r2(loss.reduce((t, j) => t + j.cost - j.income, 0)), list: loss.slice(0, 10).map(j => ({ jobNo: j.jobNo, income: r2(j.income), cost: r2(j.cost), loss: r2(j.cost - j.income), customer: j.custId ? (lg.get(j.custId) || {}).name : '', division: DIVS[j.div] ? j.div : '' })) },
  };
  // dockets registered (Shipment Registration) with no sales invoice yet, older than 7 days
  try {
    const st = bs.current(); const list = st && st.clause ? st.list : null;
    // dockets carry iCAFFE's branch code (NDL, MUM...); the books use the Branch Master code (DEL...)
    let codes = list;
    if (list) {
      const cb = await q('SELECT branchCode, icaffeCode FROM CompanyBranches').catch(() => []);
      codes = [...list];
      for (const c of list) {
        for (const r of cb) if (String(r.branchCode || '').toUpperCase() === c && r.icaffeCode) codes.push(String(r.icaffeCode).toUpperCase().replace(/^OFF\/?/, ''));
        if (c === st.def) codes.push('NDL', ''); // iCAFFE's head office (NEW DELHI) is the default branch
      }
    }
    const brW = codes ? ` AND upper(trim(coalesce(branchCode, ''))) IN (${[...new Set(codes)].map(c => `'${String(c).replace(/[^A-Z0-9]/g, '')}'`).join(',')})` : '';
    const dk = await q(`SELECT docketNo, docketDate, division, mainParty FROM Shipments WHERE docketDate >= ? AND docketDate <= ? AND coalesce(stage, '') <> 'Cancelled'${brW} ORDER BY docketDate`, [fy.startDate, addDays(asOn, -7)]);
    if (dk.length) {
      const open = dk.filter(d => !billedFirst.has(String(d.docketNo || '').toUpperCase().trim()));
      const byDiv = {}; for (const d of open) byDiv[d.division || '-'] = (byDiv[d.division || '-'] || 0) + 1;
      // by party: a party billed in bulk (one invoice for many dockets, e.g. courier) shows as one line
      const bp = new Map(); for (const d of open) { const k = String(d.mainParty || '-').trim().toUpperCase(); if (!bp.has(k)) bp.set(k, { party: d.mainParty || '-', count: 0, oldest: d.docketDate, oldestNo: d.docketNo }); const x = bp.get(k); x.count++; if (d.docketDate < x.oldest) { x.oldest = d.docketDate; x.oldestNo = d.docketNo; } }
      out.dockets = { registered: dk.length, notBilled: open.length, byDiv, byParty: [...bp.values()].sort((a, b) => b.count - a.count).slice(0, 10), parties: bp.size,
        oldest: open.slice(0, 10).map(d => ({ docketNo: d.docketNo, date: d.docketDate, division: d.division, party: d.mainParty })) };
    } else out.dockets = { registered: 0, notBilled: 0, byDiv: {}, oldest: [] };
  } catch (e) { out.dockets = null; }

  // ---------------- billing vs collection (party side, incl. GST)
  const bc = await q(`SELECT substr(v.date, 1, 7) m, t.baseType, d.dc, sum(d.amount) amt FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
      JOIN AccountLedgers l ON l.id = d.ledgerId WHERE ${VALID} AND v.date >= ? AND v.date <= ? AND l.groupId IN (${debt}) AND t.baseType IN ('Sales', 'Credit Note', 'Debit Note', 'Receipt') GROUP BY 1, 2, 3`, [fy.startDate, asOn]);
  const bcm = new Map(months.map(m => [m.m, { m: m.m, billed: 0, collected: 0 }]));
  for (const r of bc) {
    const x = bcm.get(r.m); if (!x) continue; const a = num(r.amt);
    if (r.baseType === 'Receipt') x.collected += r.dc === 'Cr' ? a : -a;
    else x.billed += r.dc === 'Dr' ? a : -a;
  }
  const bcl = [...bcm.values()].map(x => ({ m: x.m, billed: r2(x.billed), collected: r2(x.collected) }));
  const tb = bcl.reduce((t, x) => t + x.billed, 0), tc = bcl.reduce((t, x) => t + x.collected, 0);
  out.collection = { months: bcl, billed: r2(tb), collected: r2(tc), pct: tb ? Math.round(tc / tb * 1000) / 10 : null };

  // ---------------- next 30 days (bill date + the party's credit days)
  const vend = (payable.parties || []).filter(p => p.overdue > 0.5 || p.due30 > 0.5).sort((a, b) => (b.overdue + b.due30) - (a.overdue + a.due30)).slice(0, 10)
    .map(p => ({ id: p.id, name: p.name, overdue: r2(p.overdue), due30: r2(p.due30), balance: r2(p.balance), creditDays: p.creditDays }));
  out.next30 = {
    cash: r2(cash), recDue: r2(receivable.due30 || 0), recOverdue: r2(receivable.overdue || 0), payDue: r2(payable.due30 || 0), payOverdue: r2(payable.overdue || 0),
    expected: r2(cash + (receivable.due30 || 0) - (payable.due30 || 0) - (payable.overdue || 0)), vendors: vend,
  };

  // ---------------- last year, same period
  const pFrom = shiftYear(fy.startDate, -1), pTo = shiftYear(asOn, -1);
  const prev = await q(`SELECT d.ledgerId, d.dc, sum(d.amount) amt, substr(v.date, 1, 7) m FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
      WHERE ${VALID} AND v.date >= ? AND v.date <= ? AND d.ledgerId IN (${plIds}) GROUP BY 1, 2, 4`, [pFrom, pTo]);
  const P = { income: 0, expense: 0, dInc: 0, dExp: 0 }; const pm = new Map(); const pLed = new Map();
  for (const r of prev) {
    const c = cls.get(r.ledgerId); if (!c || c.approp) continue;
    const s = r.dc === 'Dr' ? num(r.amt) : -num(r.amt);
    const k = shiftYear(r.m + '-01', 1).slice(0, 7); if (!pm.has(k)) pm.set(k, { income: 0, expense: 0 });
    if (c.nat === 'I') { P.income -= s; if (c.direct) P.dInc -= s; pm.get(k).income -= s; }
    else { P.expense += s; if (c.direct) P.dExp += s; pm.get(k).expense += s; pLed.set(r.ledgerId, (pLed.get(r.ledgerId) || 0) + s); }
  }
  const pct = (a, b) => (Math.abs(b) > 1 ? Math.round((a - b) / Math.abs(b) * 1000) / 10 : null);
  out.prev = {
    from: pFrom, to: pTo, has: prev.length > 0, income: r2(P.income), expense: r2(P.expense), profit: r2(P.income - P.expense), gross: r2(P.dInc - P.dExp),
    months: out.months.map(m => { const x = pm.get(m.m) || { income: 0, expense: 0 }; return { m: m.m, income: r2(x.income), expense: r2(x.expense), profit: r2(x.income - x.expense) }; }),
    change: { income: pct(T.income, P.income), gross: pct(gross, P.dInc - P.dExp), profit: pct(profit, P.income - P.expense), expense: pct(T.expense, P.expense) },
  };

  // ---------------- expenses against budget (ledger's monthly budget) or last year
  const mElapsed = Math.max(1, (Number(asOn.slice(0, 4)) - Number(fy.startDate.slice(0, 4))) * 12 + Number(asOn.slice(5, 7)) - Number(fy.startDate.slice(5, 7)) + 1);
  const budRows = await q('SELECT id, monthlyBudget FROM AccountLedgers WHERE monthlyBudget > 0').catch(() => []);
  const bud = new Map(budRows.map(r => [r.id, num(r.monthlyBudget)]));
  const heads = new Set([...ledExp.keys(), ...bud.keys()].filter(id => cls.has(id) && cls.get(id).nat === 'E' && !cls.get(id).approp && !cls.get(id).direct));
  const er = [...heads].map(id => {
    const actual = ledExp.get(id) || 0, ly = pLed.get(id) || 0, b = bud.has(id) ? bud.get(id) * mElapsed : null;
    return { id, name: (lg.get(id) || {}).name, actual: r2(actual), lastYear: r2(ly), budget: b == null ? null : r2(b), vsBudget: b ? Math.round((actual - b) / b * 1000) / 10 : null, vsLastYear: pct(actual, ly) };
  }).filter(x => Math.abs(x.actual) > 1 || x.budget).sort((a, b) => b.actual - a.actual);
  const indirectLY = [...pLed.entries()].filter(([id]) => cls.has(id) && !cls.get(id).direct).reduce((t, [, v]) => t + v, 0);
  out.budget = { months: mElapsed, budgetHeads: bud.size, rows: er.slice(0, 12), indirect: r2(T.expense - T.dExp), indirectLY: r2(indirectLY), indirectBudget: r2([...bud.entries()].filter(([id]) => cls.has(id) && !cls.get(id).direct).reduce((t, [, v]) => t + v * mElapsed, 0)) };

  // ---------------- GST / TDS due dates (from today), with the month's figures where known
  const td = new Date().toISOString().slice(0, 10);
  const monFig = new Map(months.map(m => [m.m, m]));
  const dues = [];
  for (let k = -2; k <= 1; k++) {
    const d = new Date(td.slice(0, 7) + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + k - 1); const per = d.toISOString().slice(0, 7); // the return period
    const y = Number(per.slice(0, 4)), m = Number(per.slice(5, 7)); const nx = m === 12 ? [y + 1, 1] : [y, m + 1]; const nxs = nx[0] + '-' + String(nx[1]).padStart(2, '0');
    const f = monFig.get(per) || {};
    dues.push({ what: 'GSTR-1 (outward supplies)', period: monthLabel(per), due: nxs + '-11', amount: f.gstOut != null ? r2(f.gstOut) : null });
    dues.push({ what: 'GSTR-3B (GST payment)', period: monthLabel(per), due: nxs + '-20', amount: f.gstOut != null ? r2((f.gstOut || 0) - (f.gstIn || 0)) : null });
    dues.push({ what: 'TDS deposit (challan 281)', period: monthLabel(per), due: m === 3 ? nx[0] + '-04-30' : nxs + '-07', amount: f.tds != null ? r2(f.tds) : null });
  }
  const qy = Number(td.slice(0, 4));
  for (const [qn, dd] of [['Q1 (Apr-Jun)', '-07-31'], ['Q2 (Jul-Sep)', '-10-31'], ['Q3 (Oct-Dec)', '-01-31'], ['Q4 (Jan-Mar)', '-05-31']]) for (const yy of [qy - 1, qy, qy + 1]) dues.push({ what: 'TDS return 24Q / 26Q', period: qn, due: yy + dd, amount: null });
  for (const yy of [qy, qy + 1]) dues.push({ what: 'GSTR-9 annual return', period: 'FY ' + (yy - 1) + '-' + String(yy).slice(2), due: yy + '-12-31', amount: null });
  const daysTo = (d) => Math.round((new Date(d + 'T00:00:00Z') - new Date(td + 'T00:00:00Z')) / 86400000);
  out.compliance = dues.map(x => ({ ...x, days: daysTo(x.due) })).filter(x => x.days >= -10 && x.days <= 45).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 9);

  // ---------------- bank reconciliation: entries not yet matched with the bank statement
  const bankIds = ledgers.filter(l => bankG.has(l.groupId) && !/cash/i.test(l.name) && !/cash/i.test(l.groupName || '')).map(l => l.id);
  if (bankIds.length) {
    const cut = addDays(asOn, -15);
    const ur = await q(`SELECT d.ledgerId, count(*) n, sum(d.amount) amt, min(v.date) oldest FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
        WHERE ${VALID} AND v.date >= ? AND v.date <= ? AND d.ledgerId IN (${bankIds.join(',')}) AND (d.clearanceDate IS NULL OR d.clearanceDate = '') GROUP BY 1`, [fy.startDate, cut]);
    const lr = await q(`SELECT d.ledgerId, max(d.clearanceDate) last FROM VoucherDetails d WHERE d.ledgerId IN (${bankIds.join(',')}) AND coalesce(d.clearanceDate, '') <> '' GROUP BY 1`);
    const lastBy = new Map(lr.map(r => [r.ledgerId, String(r.last).slice(0, 10)]));
    const rows = ur.map(r => ({ id: r.ledgerId, name: (lg.get(r.ledgerId) || {}).name, open: r.n, amount: r2(r.amt), oldest: r.oldest, lastReconciled: lastBy.get(r.ledgerId) || null })).sort((a, b) => b.open - a.open);
    out.brs = { asOf: cut, banks: rows.length, open: rows.reduce((t, r) => t + r.open, 0), amount: r2(rows.reduce((t, r) => t + r.amount, 0)), neverDone: rows.filter(r => !r.lastReconciled).length, rows: rows.slice(0, 8) };
  } else out.brs = { banks: 0, open: 0, amount: 0, neverDone: 0, rows: [] };

  // ---------------- branch-wise (every branch the user may see, whatever is picked in the top bar)
  try {
    const st = bs.current() || {}; const allowed = await bs.allowedFor(req.user); const def = st.def || 'DEL';
    const w = allowed ? ` AND coalesce(nullif(upper(trim(v.branchCode)), ''), '${def}') IN (${allowed.map(c => `'${String(c).replace(/[^A-Z0-9]/g, '')}'`).join(',')})` : '';
    const br = await sequelize.query(`SELECT coalesce(nullif(upper(trim(v.branchCode)), ''), '${def}') br, d.ledgerId, d.dc, sum(d.amount) amt FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
        WHERE ${VALID} AND v.date >= ? AND v.date <= ? AND d.ledgerId IN (${plIds})${w} GROUP BY 1, 2, 3`, { replacements: [fy.startDate, asOn], type: QueryTypes.SELECT, __noScope: true });
    const names = new Map((await q('SELECT branchCode, branchName FROM CompanyBranches').catch(() => [])).map(r => [String(r.branchCode || '').toUpperCase(), r.branchName]));
    const bm = new Map();
    for (const r of br) {
      const c = cls.get(r.ledgerId); if (!c || c.approp) continue;
      if (!bm.has(r.br)) bm.set(r.br, { code: r.br, name: names.get(r.br) || r.br, income: 0, expense: 0, dInc: 0, dExp: 0 });
      const x = bm.get(r.br); const s = r.dc === 'Dr' ? num(r.amt) : -num(r.amt);
      if (c.nat === 'I') { x.income -= s; if (c.direct) x.dInc -= s; if (reimbIds.has(r.ledgerId)) x.reimb = (x.reimb || 0) - s; } else { x.expense += s; if (c.direct) x.dExp += s; }
    }
    const tot = [...bm.values()].reduce((t, x) => t + x.income, 0);
    out.branches = [...bm.values()].map(x => { const nr = x.income - (x.reimb || 0); return { code: x.code, name: x.name, income: r2(x.income), netRevenue: r2(nr), expense: r2(x.expense), gross: r2(x.dInc - x.dExp), profit: r2(x.income - x.expense),
      grossPct: nr > 0 ? Math.round((x.dInc - x.dExp) / nr * 1000) / 10 : null, netPct: nr > 0 ? Math.round((x.income - x.expense) / nr * 1000) / 10 : null, share: tot ? Math.round(x.income / tot * 1000) / 10 : 0, current: !st.list || st.list.includes(x.code) }; })
      .sort((a, b) => b.netRevenue - a.netRevenue);
  } catch (e) { out.branches = []; }
  return out;
};
