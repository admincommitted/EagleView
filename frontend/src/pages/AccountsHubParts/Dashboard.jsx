// 04-Nov-2026: Accounts dashboard (Accounts > Home). One look at the whole books for a financial year:
// income / expense / profit, cash & bank, receivables and payables with ageing, GST & TDS position, monthly trend,
// money in vs out, top heads, control checks (approvals, unbalanced vouchers, closed months) and recent vouchers.
// Data: GET /api/accounts-hub/dashboard?fyId=
// 08-Nov-2026: management view (d.mgmt): profit before tax and year-end transfers, gross margin, net revenue without
// reimbursable, last year, division-wise and branch-wise margin, top 10 customers with job margin, reimbursable
// billed vs paid, billing vs collection, next 30 days cash, vendor payments due, unbilled / loss-making jobs, dockets
// without invoice, indirect expenses vs last year and budgets, GST / TDS due dates, bank reconciliation status.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, ComposedChart, BarChart, AreaChart, Bar, Line, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell } from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown, Landmark, ArrowDownLeft, ArrowUpRight, Percent, ShieldCheck, AlertTriangle, CheckCircle2, Clock, FileText, Briefcase, Building2, Users, Receipt, CalendarClock, Scale, Wallet } from 'lucide-react';
import { T, inr, fmtDate, api, lookup, inputStyle, Badge, statusTone } from './ui';
import { deskOf } from './CommandSearch';

const C = { income: '#0d9488', expense: '#e11d48', profit: 'var(--primary-color-end, #0369a1)', receipt: '#059669', payment: '#d97706', grid: '#e2e8f0' };
const AGE_COLORS = ['#10b981', '#84cc16', '#f59e0b', '#f97316', '#dc2626'];
const short = (v) => { const n = Math.abs(Number(v) || 0); const s = n >= 1e7 ? (n / 1e7).toFixed(2) + ' Cr' : n >= 1e5 ? (n / 1e5).toFixed(2) + ' L' : n >= 1e3 ? (n / 1e3).toFixed(1) + ' K' : n.toFixed(0); return (Number(v) < 0 ? '-' : '') + s; };
const monName = (m) => new Date(m + '-01T00:00:00Z').toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' });

function Card({ title, icon: I, right, children, style, pad = 12 }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, boxShadow: '0 4px 15px rgba(0,0,0,0.05)', minWidth: 0, display: 'flex', flexDirection: 'column', ...style }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
          {I && <I size={13} color="var(--primary-text, #1e3a8a)" />}
          <span style={{ fontWeight: 800, color: 'var(--primary-text, #1e3a8a)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: T.muted, display: 'flex', alignItems: 'center', gap: 8 }}>{right}</span>
        </div>
      )}
      <div style={{ padding: pad, flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function Kpi({ label, value, sub, tone, icon: I, onClick }) {
  const color = { up: C.income, down: C.expense, blue: C.profit, warn: '#b45309' }[tone] || T.text;
  return (
    <div onClick={onClick} style={{ background: '#fff', border: '1px solid var(--border-color, #e2e8f0)', borderTop: `3px solid ${color}`, borderRadius: 8, padding: '10px 12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', cursor: onClick ? 'pointer' : 'default', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{I && <I size={12} color={color} />}{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color, marginTop: 4, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={inr(value)}>₹ {inr(value, 0)}</div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 2, minHeight: 15 }}>{sub}</div>
    </div>
  );
}

const tip = { contentStyle: { fontSize: 11, borderRadius: 6, border: '1px solid #cbd5e1' }, formatter: (v) => '₹ ' + inr(v) };

// receivable / payable ageing - kept quiet: one headline figure, one bar split by age (click a part to filter),
// and the largest parties
const BUCKET_NAMES = ['0-30', '31-60', '61-90', '91-180', '180+'];
function Ageing({ side, data, onParty, onReport }) {
  const [bucket, setBucket] = useState(-1);
  const total = data.total || 0;
  const pct = (v) => (total ? Math.round(v / total * 100) : 0);
  const all = (data.parties || data.top || []).filter(p => bucket < 0 || (p.buckets && p.buckets[bucket] > 0.005));
  const rows = all.slice(0, 6);
  const amt = (p) => (bucket < 0 ? p.balance : p.buckets[bucket]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '2px 4px' }}>
      {/* headline */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10.5, color: T.muted, fontWeight: 700 }}>Outstanding</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>₹ {inr(total, 0)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: T.muted, fontWeight: 700 }}>Overdue</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: data.overdue ? C.expense : T.text, fontVariantNumeric: 'tabular-nums' }}>₹ {inr(data.overdue, 0)} <span style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>{data.overduePct || 0}%</span></div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: T.muted, fontWeight: 700 }}>Average age</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{data.avgDays || 0} days</div>
        </div>
      </div>

      {/* age split */}
      <div>
        <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: '#f1f5f9', gap: total ? 2 : 0 }}>
          {data.buckets.map((b, i) => b.amount > 0 && (
            <div key={b.bucket} title={b.bucket + ' days: ₹ ' + inr(b.amount, 0) + ' (' + pct(b.amount) + '%)'} onClick={() => setBucket(bucket === i ? -1 : i)}
              style={{ width: pct(b.amount) + '%', minWidth: 3, background: AGE_COLORS[i], cursor: 'pointer', opacity: bucket < 0 || bucket === i ? 1 : 0.25, transition: 'opacity .2s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, gap: 6 }}>
          {data.buckets.map((b, i) => (
            <div key={b.bucket} onClick={() => setBucket(bucket === i ? -1 : i)} style={{ cursor: 'pointer', opacity: bucket < 0 || bucket === i ? 1 : 0.45, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: T.muted, fontWeight: 600 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: AGE_COLORS[i] }} />{b.bucket} days
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{short(b.amount)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* largest parties */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={{ background: 'transparent' }}>{bucket < 0 ? 'Largest ' + (side === 'Dr' ? 'debtors' : 'creditors') : BUCKET_NAMES[bucket] + ' days'}</th>
          <th style={{ textAlign: 'right', background: 'transparent' }}>Amount</th>
          <th style={{ textAlign: 'right', background: 'transparent' }}>Overdue</th>
          <th style={{ textAlign: 'right', background: 'transparent' }}>Oldest</th>
        </tr></thead>
        <tbody>
          {rows.map(p => (
            <tr key={p.id} className="table-row-hover" onClick={() => onParty(p.id)} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ maxWidth: 230, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0.45rem 0.5rem' }} title={p.name}>{p.name}</td>
              <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{inr(amt(p), 0)}</td>
              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: p.overdue > 0.005 ? C.expense : T.muted }}>{p.overdue > 0.005 ? inr(p.overdue, 0) : '-'}</td>
              <td style={{ textAlign: 'right', color: T.muted }}>{p.oldestDays} days</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: T.muted, padding: 18 }}>Nothing outstanding</td></tr>}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
        <span style={{ color: T.muted }}>{bucket >= 0 ? <span onClick={() => setBucket(-1)} style={{ cursor: 'pointer', color: 'var(--primary-text, #0284c7)', fontWeight: 600 }}>Show all ages</span> : (data.count + ' parties' + (data.advances ? ', advances ₹ ' + inr(data.advances, 0) : ''))}</span>
        <span onClick={onReport} style={{ cursor: 'pointer', color: 'var(--primary-text, #0284c7)', fontWeight: 700 }}>View all {all.length > 6 ? all.length + ' ' : ''}parties</span>
      </div>
    </div>
  );
}

function HeadBars({ rows, color, onRow }) {
  const max = Math.max(1, ...rows.map(r => r.amount));
  if (!rows.length) return <div style={{ color: T.muted, fontSize: 12, textAlign: 'center', padding: 18 }}>No entries this year</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map(r => (
        <div key={r.id} onClick={() => onRow(r.id)} style={{ cursor: 'pointer' }} title={r.name}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, gap: 8 }}>
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{inr(r.amount, 0)}</span>
          </div>
          <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, marginTop: 3 }}><div style={{ width: (r.amount / max * 100) + '%', height: '100%', background: color, borderRadius: 3 }} /></div>
        </div>
      ))}
    </div>
  );
}

function Check({ ok, warn, label, value, onClick }) {
  const I = ok ? CheckCircle2 : warn ? AlertTriangle : Clock;
  const color = ok ? '#059669' : warn ? '#dc2626' : '#d97706';
  return (
    <div onClick={onClick} className={onClick ? 'table-row-hover' : ''} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', borderBottom: '1px solid #f1f5f9', cursor: onClick ? 'pointer' : 'default' }}>
      <I size={15} color={color} />
      <span style={{ fontSize: 11.5, fontWeight: 600, flex: 1 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color }}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------- 08-Nov-2026: management sections
const pctTxt = (v) => (v == null ? '-' : (v > 0 ? '+' : '') + v + '%');
function Delta({ v, good = 'up', label = 'vs last year' }) {
  if (v == null) return null;
  const ok = good === 'up' ? v >= 0 : v <= 0;
  return <span style={{ whiteSpace: 'nowrap' }}><b style={{ color: ok ? '#059669' : '#dc2626' }}>{pctTxt(v)}</b> {label}</span>;
}
function Tbl({ cols, rows, onRow, empty = 'Nothing to show', max, foot }) {
  return (
    <div style={{ maxHeight: max, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{cols.map((c, i) => <th key={i} style={{ textAlign: c.r ? 'right' : 'left', background: '#f8fafc', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1 }}>{c.h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={onRow ? 'table-row-hover' : ''} onClick={onRow ? () => onRow(r) : undefined} style={{ borderTop: '1px solid #f1f5f9', cursor: onRow ? 'pointer' : 'default', background: r._hl ? '#eff6ff' : undefined }}>
              {cols.map((c, j) => { const v = c.v(r, i); return <td key={j} title={c.w ? String(v == null ? '' : v) : undefined} style={{ textAlign: c.r ? 'right' : 'left', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', maxWidth: c.w, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: c.b ? 700 : undefined, color: c.color ? c.color(r) : undefined }}>{v}</td>; })}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={cols.length} style={{ textAlign: 'center', color: T.muted, padding: 18 }}>{empty}</td></tr>}
        </tbody>
        {foot && rows.length > 0 && <tfoot><tr style={{ borderTop: '2px solid #e2e8f0', fontWeight: 800 }}>{foot.map((f, i) => <td key={i} style={{ textAlign: cols[i] && cols[i].r ? 'right' : 'left', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{f}</td>)}</tr></tfoot>}
      </table>
    </div>
  );
}
const pctCell = (v) => (v == null ? '-' : v + '%');
const marginColor = (v) => (v == null ? T.muted : v < 0 ? C.expense : v < 10 ? '#b45309' : '#059669');
function Line2({ label, value, strong, color, sign }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 2px', borderBottom: '1px solid #f1f5f9', fontSize: strong ? 13 : 12, fontWeight: strong ? 800 : 600 }}>
      <span>{sign && <span style={{ display: 'inline-block', width: 14, color: T.muted }}>{sign}</span>}{label}</span>
      <span style={{ color: color || T.text, fontVariantNumeric: 'tabular-nums' }}>₹ {inr(value, 0)}</span>
    </div>
  );
}
function Tabs({ tabs, at, set }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
      {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => set(k)} style={{ border: '1px solid ' + (at === k ? 'var(--primary-color-end, #0369a1)' : '#cbd5e1'), background: at === k ? 'var(--primary-color-end, #0369a1)' : '#fff', color: at === k ? '#fff' : T.text, borderRadius: 14, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{l}</button>)}
    </div>
  );
}
function JobsCard({ g, onJob }) {
  const [tab, setTab] = useState('unbilled');
  const u = g.jobs.unbilled, l = g.jobs.loss, dk = g.dockets;
  const divName = { AE: 'Air Exp', AI: 'Air Imp', SE: 'Sea Exp', SI: 'Sea Imp' };
  return (
    <Card title="Jobs to check" icon={Briefcase} right={<span>{g.jobs.total} jobs with entries this year</span>}>
      <Tabs at={tab} set={setTab} tabs={[['unbilled', 'Cost booked, no invoice (' + u.count + ')'], ['loss', 'Cost more than billing (' + l.count + ')'], ...(dk && dk.registered ? [['dockets', 'Dockets not invoiced (' + dk.notBilled + ')']] : [])]} />
      {tab === 'unbilled' && <>
        <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 6 }}>Expenses booked on these jobs, but no sales invoice on the job yet: <b style={{ color: C.expense }}>₹ {inr(u.cost, 0)}</b> waiting to be billed.</div>
        <Tbl max={250} rows={u.list} onRow={r => onJob(r.jobNo)} cols={[{ h: 'Job / docket', v: r => r.jobNo, b: 1 }, { h: 'Div', v: r => divName[r.division] || '-' }, { h: 'First cost', v: r => fmtDate(r.first) }, { h: 'Cost', r: 1, b: 1, v: r => inr(r.cost, 0) }]} empty="Every job with a cost has an invoice" />
      </>}
      {tab === 'loss' && <>
        <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 6 }}>Cost on the job is more than what was billed on it: <b style={{ color: C.expense }}>₹ {inr(l.amount, 0)}</b> in all. Consol / master jobs whose billing sits on house jobs also show here.</div>
        <Tbl max={250} rows={l.list} onRow={r => onJob(r.jobNo)} cols={[{ h: 'Job / docket', v: r => r.jobNo, b: 1 }, { h: 'Customer', v: r => r.customer || '-', w: 170 }, { h: 'Billed', r: 1, v: r => inr(r.income, 0) }, { h: 'Cost', r: 1, v: r => inr(r.cost, 0) }, { h: 'Short', r: 1, b: 1, v: r => inr(r.loss, 0), color: () => C.expense }]} empty="No job costs more than its billing" />
      </>}
      {tab === 'dockets' && dk && <>
        <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 6 }}>{dk.registered} dockets registered this year (older than 7 days); <b style={{ color: C.expense }}>{dk.notBilled}</b> have no sales invoice yet{Object.keys(dk.byDiv || {}).length ? ' (' + Object.entries(dk.byDiv).map(([k, v]) => (divName[k] || k) + ' ' + v).join(', ') + ')' : ''}.</div>
        <Tbl max={250} rows={dk.byParty || []} cols={[{ h: 'Party', v: r => r.party, b: 1, w: 230 }, { h: 'Dockets', r: 1, b: 1, v: r => r.count }, { h: 'Oldest', v: r => fmtDate(r.oldest) + ' ' + (r.oldestNo || '') }]} empty="Every docket is invoiced" />
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 6 }}>{dk.parties} parties. A party billed in bulk (one invoice for many dockets) shows a large count until the invoice carries each docket no.</div>
      </>}
    </Card>
  );
}

const DASH_CSS = `@keyframes accSpin { to { transform: rotate(360deg); } }
.acc-spin { animation: accSpin .8s linear infinite; }
@keyframes accBar { 0% { left: -35%; } 100% { left: 100%; } }
.acc-bar { position: absolute; top: -6px; left: 0; right: 0; height: 3px; overflow: hidden; border-radius: 2px; background: rgba(124,58,237,.15); z-index: 5; }
.acc-bar::after { content: ''; position: absolute; top: 0; bottom: 0; width: 35%; background: linear-gradient(90deg, #7c3aed, #a855f7); animation: accBar 1s ease-in-out infinite; }
.acc-dash[aria-busy="true"] > div:not(.acc-head):not(.acc-bar) { opacity: .5; pointer-events: none; transition: opacity .2s; }
@media (prefers-reduced-motion: reduce) { .acc-spin, .acc-bar::after { animation-duration: 3s; } }`;

export default function AccountsDashboard() {
  const nav = useNavigate();
  const [years, setYears] = useState([]);
  const [fyId, setFyId] = useState('');
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // 07-Nov-2026: Refresh shows that it is working (spinning icon, "Refreshing...", progress bar, dimmed figures) and when it finished
  const [doneAt, setDoneAt] = useState(null);
  const [topFy, setTopFy] = useState(''); // 08-Nov-2026: name of the year picked in the top bar (the default here)
  const [budgets, setBudgets] = useState(null); // 08-Nov-2026: Budgets & Variance (its own screen) - shown on the dashboard
  useEffect(() => { api('/api/budgets').then(setBudgets).catch(() => setBudgets(null)); }, []);
  const load = () => {
    setBusy(true); setErr(''); setDoneAt(null);
    api('/api/accounts-hub/dashboard' + (fyId ? '?fyId=' + fyId : ''))
      .then(x => { setD(x); setDoneAt(new Date()); if (!fyId && x && x.fy) setTopFy(x.fy.name); })
      .catch(e => setErr(e.message)).finally(() => setBusy(false));
  };
  useEffect(() => { if (!doneAt) return; const t = setTimeout(() => setDoneAt(null), 4000); return () => clearTimeout(t); }, [doneAt]);
  useEffect(() => { lookup('years').then(setYears); }, []);
  useEffect(() => { load(); }, [fyId]);

  if (err && !d) return <Card><div style={{ color: T.dr, fontSize: 12 }}>Dashboard could not load: {err}</div></Card>;
  if (!d) return <Card><style>{DASH_CSS}</style><div style={{ color: T.muted, fontSize: 12, padding: 20, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><RefreshCw size={14} className="acc-spin" /> Loading the accounts dashboard...</div></Card>;
  const k = d.kpi;
  const ledger = (id) => nav('/accounts-hub?item=ledger&ledger=' + id);
  const report = (id) => nav('/accounts-hub?item=' + id);
  const g = d.mgmt && !d.mgmt.error ? d.mgmt : null; // 08-Nov-2026: management figures
  const months = d.months.map((m, i) => {
    const x = g && g.months[i] && g.months[i].m === m.m ? g.months[i] : null; const p = g && g.prev.has && g.prev.months[i] ? g.prev.months[i] : null;
    return { ...m, name: monName(m.m), income: x ? x.income : m.income, expense: x ? x.expense : m.expense, profit: x ? x.profit : Math.round((m.income - m.expense) * 100) / 100, lyProfit: p ? p.profit : null };
  });
  const job = (j) => nav('/accounts-hub?item=expsheet&jobNo=' + encodeURIComponent(j));
  const divName = { AE: 'Air Export', AI: 'Air Import', SE: 'Sea Export', SI: 'Sea Import' };
  const budRows = budgets && budgets.data ? budgets.data.filter(b => b.toDate >= d.fy.startDate && b.fromDate <= d.fy.endDate) : [];
  let run = 0; const flow = months.map(m => { run += m.receipt - m.payment; return { ...m, net: Math.round(run) }; });
  const g3 = { display: 'grid', gap: 12, alignItems: 'stretch' };
  const ctl = d.control;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }} className="acc-dash" aria-busy={busy}>
      <style>{DASH_CSS}</style>
      {busy && <div className="acc-bar" />}
      {/* header */}
      <div className="acc-head" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: T.muted }}>FY {d.fy.name} ({fmtDate(d.fy.startDate)} to {fmtDate(d.fy.endDate)}), figures as on {fmtDate(d.asOn)}. {d.counts.ledgers} ledgers, {d.counts.parties} parties, {d.counts.vouchers} vouchers.</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <select style={{ ...inputStyle, width: 150 }} value={fyId} onChange={e => setFyId(e.target.value)}>
            <option value="">{topFy ? 'FY ' + topFy + ' (top bar)' : 'Year in the top bar'}</option>{years.filter(y => (y.name || y.code) !== topFy).map(y => <option key={y.id} value={y.id}>FY {y.name || y.code}</option>)}
          </select>
          {busy && <span style={{ fontSize: 11.5, color: T.muted }}>Fetching latest figures...</span>}
          {!busy && doneAt && <span style={{ fontSize: 11.5, color: '#15803d', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} /> Updated {doneAt.toLocaleTimeString('en-IN')}</span>}
          {!busy && err && <span style={{ fontSize: 11.5, color: T.dr, fontWeight: 700 }}>Refresh failed: {err}</span>}
          <button type="button" className="btn" onClick={load} disabled={busy} aria-busy={busy} style={{ height: 28, padding: '0 12px', fontSize: 11.5, fontWeight: 700, borderRadius: 6, background: T.grad, color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: busy ? 0.75 : 1, cursor: busy ? 'wait' : 'pointer', minWidth: 112, justifyContent: 'center' }}><RefreshCw size={12} className={busy ? 'acc-spin' : ''} /> {busy ? 'Refreshing...' : 'Refresh'}</button>
        </div>
      </div>
      {!d.counts.vouchers && (
        <div style={{ padding: '8px 12px', background: T.amberBg, border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: T.amber, fontWeight: 600 }}>
          No vouchers in this year yet, so the figures are zero. They fill in as soon as vouchers are posted or the iCAFFE accounts are loaded.
        </div>
      )}

      {/* KPIs */}
      {g ? (
        <>
          <div style={{ ...g3, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }} className="acc-kpi4">
            <Kpi label="Income" icon={TrendingUp} value={g.pl.income} tone="up" sub={<>Net revenue {short(g.pl.netRevenue)} {g.prev.has && <Delta v={g.prev.change.income} label="vs LY" />}</>} onClick={() => report('salesreg')} />
            <Kpi label="Gross margin" icon={Scale} value={g.pl.gross} tone="up" sub={<>{g.pl.grossPct != null && g.pl.grossPct + '% of net revenue '}{g.prev.has && <Delta v={g.prev.change.gross} label="vs LY" />}</>} onClick={() => nav('/profit-and-loss')} />
            <Kpi label="Expenses" icon={TrendingDown} value={g.pl.expense} tone="down" sub={<>Indirect {short(g.pl.indirectExpense)} {g.prev.has && <Delta v={g.prev.change.expense} good="down" label="vs LY" />}</>} onClick={() => report('purchasereg')} />
            <Kpi label="Profit before tax" icon={Percent} value={g.pl.profit} tone={g.pl.profit >= 0 ? 'blue' : 'down'} sub={<>{g.pl.netPct != null && 'Margin ' + g.pl.netPct + '% '}{g.prev.has && <Delta v={g.prev.change.profit} label="vs LY" />}</>} onClick={() => nav('/profit-and-loss')} />
            <Kpi label="Cash & bank" icon={Landmark} value={k.cash} tone="blue" sub={d.banks.length + ' accounts'} onClick={() => nav('/trial-balance')} />
            <Kpi label="Receivable" icon={ArrowDownLeft} value={k.receivable} tone="up" sub={(d.receivable.overdue ? 'Overdue ' + short(d.receivable.overdue) : 'Nothing overdue') + (k.dso != null ? ', ' + k.dso + ' days' : '')} onClick={() => report('partybal')} />
            <Kpi label="Payable" icon={ArrowUpRight} value={k.payable} tone="warn" sub={d.payable.overdue ? 'Overdue ' + short(d.payable.overdue) : 'Nothing overdue'} onClick={() => report('partybal')} />
            <Kpi label="Unbilled cost" icon={AlertTriangle} value={g.jobs.unbilled.cost} tone="warn" sub={g.jobs.unbilled.count + ' jobs with cost, no invoice'} onClick={() => { const e = document.getElementById('acc-jobs'); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} />
          </div>
          {Math.abs(g.pl.approp) > 1 && (
            <div style={{ padding: '7px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 11.5, color: '#1e3a8a' }}>
              Year-end entries of <b>₹ {inr(g.pl.approp, 0)}</b> to "Profit on Loss Account" (profit moved to reserves, income-tax provision, deferred tax) are not expenses of the year, so the profit above leaves them out. Profit after these entries, as it stands in the books: <b>₹ {inr(g.pl.bookProfit, 0)}</b>.
            </div>
          )}
        </>
      ) : (
      <div style={{ ...g3, gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))' }}>
        <Kpi label="Income" icon={TrendingUp} value={k.income} tone="up" sub={'Sales incl. GST ' + short(k.sales)} onClick={() => report('salesreg')} />
        <Kpi label="Expenses" icon={TrendingDown} value={k.expense} tone="down" sub={'Purchases incl. GST ' + short(k.purchase)} onClick={() => report('purchasereg')} />
        <Kpi label="Net profit" icon={Percent} value={k.profit} tone={k.profit >= 0 ? 'blue' : 'down'} sub={k.margin == null ? 'Margin -' : 'Margin ' + k.margin + '%'} onClick={() => nav('/profit-and-loss')} />
        <Kpi label="Cash & bank" icon={Landmark} value={k.cash} tone="blue" sub={d.banks.length + ' accounts'} onClick={() => nav('/trial-balance')} />
        <Kpi label="Receivable" icon={ArrowDownLeft} value={k.receivable} tone="up" sub={(d.receivable.overdue ? 'Overdue ' + short(d.receivable.overdue) : 'Nothing overdue') + (k.dso != null ? ', ' + k.dso + ' days' : '')} onClick={() => report('partybal')} />
        <Kpi label="Payable" icon={ArrowUpRight} value={k.payable} tone="warn" sub={d.payable.overdue ? 'Overdue ' + short(d.payable.overdue) : 'Nothing overdue'} onClick={() => report('partybal')} />
      </div>
      )}

      {/* trend + cash */}
      <div style={{ ...g3, gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)' }} className="acc-dash-2">
        <Card title={g ? 'Income, expense and profit by month (before tax)' : 'Income, expense and profit by month'} icon={TrendingUp} right={<span>Working capital <b style={{ color: k.netWorking >= 0 ? C.income : C.expense }}>₹ {short(k.netWorking)}</b></span>}>
          <div style={{ height: 250 }}>
            <ResponsiveContainer>
              <ComposedChart data={months} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={short} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
                <Tooltip {...tip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income" name="Income" fill={C.income} radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="expense" name="Expense" fill={C.expense} radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Line dataKey="profit" name="Profit" stroke={C.profit} strokeWidth={2} dot={{ r: 2 }} />
                {g && g.prev.has && <Line dataKey="lyProfit" name="Profit last year" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Cash & bank" icon={Landmark} right={<b style={{ color: 'var(--primary-text, #1e3a8a)' }}>₹ {inr(k.cash, 0)}</b>} pad={0}>
          <div style={{ maxHeight: 268, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th>Account</th><th style={{ textAlign: 'right' }}>In (year)</th><th style={{ textAlign: 'right' }}>Out (year)</th><th style={{ textAlign: 'right' }}>Balance</th></tr></thead>
              <tbody>
                {d.banks.map(b => (
                  <tr key={b.id} className="table-row-hover" onClick={() => ledger(b.id)} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }} title={b.name}>{b.name}<div style={{ fontSize: 9.5, color: T.muted }}>{b.group}</div></td>
                    <td style={{ textAlign: 'right', color: C.receipt }}>{short(b.inflow)}</td>
                    <td style={{ textAlign: 'right', color: C.payment }}>{short(b.outflow)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: b.balance < 0 ? C.expense : T.text }}>{inr(b.balance, 0)}</td>
                  </tr>
                ))}
                {!d.banks.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: T.muted, padding: 20 }}>No bank or cash ledgers yet</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {g && <>
        {/* 08-Nov-2026: division and branch */}
        <div style={{ ...g3, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} className="acc-dash-2">
          <Card title="Business-wise margin" icon={Briefcase} right={<span>net revenue = without reimbursable</span>}>
            <Tbl rows={g.divisions} cols={[
              { h: 'Division', v: r => r.name, b: 1 }, { h: 'Billed', r: 1, v: r => short(r.income) }, { h: 'Net revenue', r: 1, v: r => short(r.netRevenue) },
              { h: 'Gross margin', r: 1, b: 1, v: r => short(r.gross) }, { h: 'GM %', r: 1, v: r => pctCell(r.grossPct), color: r => marginColor(r.grossPct) }, { h: 'Share', r: 1, v: r => r.share + '%' }]}
              foot={['Total', short(g.pl.income), short(g.pl.netRevenue), short(g.pl.gross), pctCell(g.pl.grossPct), '100%']} />
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8 }}>Gross margin = billing less direct costs (freight, duty, AAI, clearing...). Salary, rent and other indirect costs (₹ {short(g.pl.indirectExpense)}) are not split by division in the books, so they are counted only in the total profit.</div>
          </Card>
          <Card title="Branch-wise" icon={Building2} right={<span>all branches you can see</span>}>
            <Tbl rows={g.branches.map(b => ({ ...b, _hl: b.current }))} cols={[
              { h: 'Branch', v: r => r.name + (r.name !== r.code ? ' (' + r.code + ')' : ''), b: 1 }, { h: 'Net revenue', r: 1, v: r => short(r.netRevenue) }, { h: 'Gross margin', r: 1, v: r => short(r.gross) },
              { h: 'GM %', r: 1, v: r => pctCell(r.grossPct), color: r => marginColor(r.grossPct) }, { h: 'Profit before tax', r: 1, b: 1, v: r => short(r.profit), color: r => (r.profit < 0 ? C.expense : T.text) }, { h: 'Net %', r: 1, v: r => pctCell(r.netPct), color: r => marginColor(r.netPct) }]}
              foot={g.branches.length > 1 ? ['All', short(g.branches.reduce((t, b) => t + b.netRevenue, 0)), short(g.branches.reduce((t, b) => t + b.gross, 0)), '', short(g.branches.reduce((t, b) => t + b.profit, 0)), ''] : null} empty="No branch figures" />
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8 }}>Shaded row = the branch picked at the top. Profit is before the year-end tax and reserve entries.</div>
          </Card>
        </div>

        {/* customers + reimbursable */}
        <div style={{ ...g3, gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)' }} className="acc-dash-2">
          <Card title="Top 10 customers" icon={Users} right={<span>{g.customerCount} customers billed this year</span>}>
            <Tbl rows={g.customers} onRow={r => ledger(r.id)} cols={[
              { h: '#', v: (r, i) => i + 1 }, { h: 'Customer', v: r => r.name, b: 1, w: 240 }, { h: 'Revenue', r: 1, v: r => short(r.revenue) }, { h: 'Share', r: 1, v: r => r.share + '%' }, { h: 'Jobs', r: 1, v: r => r.jobs },
              { h: 'Job margin', r: 1, v: r => short(r.margin), color: r => (r.margin < 0 ? C.expense : T.text) }, { h: 'Margin %', r: 1, v: r => pctCell(r.marginPct), color: r => marginColor(r.marginPct) },
              { h: 'Outstanding', r: 1, v: r => (r.outstanding ? short(r.outstanding) : '-') }, { h: 'Overdue', r: 1, v: r => (r.overdue ? short(r.overdue) : '-'), color: r => (r.overdue ? C.expense : T.muted) }]} empty="No sales this year" />
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8 }}>Revenue = billing on the customer's invoices (without GST). Job margin = that billing less the direct costs booked on the same jobs.</div>
          </Card>
          <Card title="Reimbursable (pass-through)" icon={Receipt} right={<span onClick={() => report('gstreimbursable')} style={{ cursor: 'pointer', color: 'var(--primary-text, #0284c7)', fontWeight: 700 }}>Register</span>}>
            <Line2 label="Billed to customers" value={g.reimb.billed} />
            <Line2 label="Paid out (same heads)" value={g.reimb.cost} />
            <Line2 label={g.reimb.diff < 0 ? 'Paid more than billed' : 'Billed more than paid'} value={Math.abs(g.reimb.diff)} strong color={g.reimb.diff < 0 ? C.expense : '#059669'} />
            <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase', margin: '10px 0 4px' }}>By head</div>
            <Tbl rows={g.reimb.heads} onRow={r => ledger(r.id)} cols={[{ h: 'Head', v: r => r.name, w: 150 }, { h: 'Billed', r: 1, v: r => short(r.billed) }, { h: 'Paid', r: 1, v: r => short(r.cost) }, { h: 'Diff', r: 1, b: 1, v: r => short(r.diff), color: r => (r.diff < 0 ? C.expense : '#059669') }]} empty="No reimbursable billing" />
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8 }}>Import duty, DO, stamp duty and the like are billed at cost. They are kept out of net revenue, so margins are not watered down.</div>
          </Card>
        </div>

        {/* collection + next 30 days */}
        <div style={{ ...g3, gridTemplateColumns: 'minmax(0, 1.4fr) minmax(240px, 1fr) minmax(240px, 1fr)' }} className="acc-dash-3">
          <Card title="Billing vs collection" icon={Wallet} right={<span>Collected <b>{g.collection.pct == null ? '-' : g.collection.pct + '%'}</b> of billed</span>}>
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={g.collection.months.map(m => ({ ...m, name: monName(m.m) }))} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={short} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip {...tip} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="billed" name="Billed (incl. GST)" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="collected" name="Collected" fill={C.receipt} radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: 10.5, color: T.muted }}>Billed {short(g.collection.billed)}, collected {short(g.collection.collected)} this year. Collections include old bills and advances.</div>
          </Card>
          <Card title="Next 30 days" icon={CalendarClock} right={<span>by the party's credit days</span>}>
            <Line2 label="Cash & bank now" value={g.next30.cash} />
            <Line2 sign="+" label="Receivable falling due" value={g.next30.recDue} color={C.income} />
            <Line2 sign="-" label="Payable falling due" value={g.next30.payDue} color={C.expense} />
            <Line2 sign="-" label="Payable already overdue" value={g.next30.payOverdue} color={C.expense} />
            <Line2 label="Expected position" value={g.next30.expected} strong color={g.next30.expected < 0 ? C.expense : 'var(--primary-text, #1e3a8a)'} />
            <div style={{ marginTop: 10, padding: '7px 9px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, fontSize: 11.5 }}>
              Overdue receivable to chase: <b style={{ color: C.expense }}>₹ {inr(g.next30.recOverdue, 0)}</b> - not counted above.
            </div>
          </Card>
          <Card title="Vendor payments due" icon={ArrowUpRight} pad={0} right={<span>overdue + next 30 days</span>}>
            <Tbl max={262} rows={g.next30.vendors} onRow={r => ledger(r.id)} cols={[{ h: 'Vendor', v: r => r.name, w: 150, b: 1 }, { h: 'Overdue', r: 1, v: r => (r.overdue ? short(r.overdue) : '-'), color: r => (r.overdue ? C.expense : T.muted) }, { h: 'Due 30 d', r: 1, v: r => (r.due30 ? short(r.due30) : '-') }]} empty="Nothing due" />
          </Card>
        </div>

        {/* jobs + expenses */}
        <div style={{ ...g3, gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)' }} className="acc-dash-2" id="acc-jobs">
          <JobsCard g={g} onJob={job} />
          <Card title="Indirect expenses vs last year" icon={TrendingDown} right={<span>{short(g.budget.indirect)} {g.prev.has && <>(LY {short(g.budget.indirectLY)})</>}</span>}>
            <Tbl max={250} rows={g.budget.rows} onRow={r => ledger(r.id)} cols={[{ h: 'Head', v: r => r.name, w: 190, b: 1 }, { h: 'This year', r: 1, v: r => short(r.actual) }, { h: 'Last year', r: 1, v: r => short(r.lastYear) },
              { h: 'Change', r: 1, v: r => pctTxt(r.vsLastYear), color: r => (r.vsLastYear == null ? T.muted : r.vsLastYear > 10 ? C.expense : r.vsLastYear < 0 ? '#059669' : T.text) },
              ...(g.budget.budgetHeads ? [{ h: 'Budget', r: 1, v: r => (r.budget == null ? '-' : short(r.budget)) }] : [])]} empty="No indirect expenses" />
            <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase', margin: '10px 0 4px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Budgets</span><span onClick={() => nav('/budgets')} style={{ cursor: 'pointer', color: 'var(--primary-text, #0284c7)' }}>Budgets & Variance</span>
            </div>
            {budRows.length ? budRows.slice(0, 5).map(b => (
              <div key={b.id} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}><span style={{ fontWeight: 600 }}>{b.name}</span><span style={{ fontWeight: 700, color: b.state === 'Over budget' ? C.expense : T.text }}>{short(b.utilized)} / {short(b.allocated)}</span></div>
                <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, marginTop: 3 }}><div style={{ width: Math.min(100, b.utilisedPct || 0) + '%', height: '100%', borderRadius: 3, background: b.state === 'Over budget' ? C.expense : b.state === 'Near the limit' ? '#f59e0b' : C.income }} /></div>
              </div>
            )) : <div style={{ fontSize: 11.5, color: T.muted }}>No budget set for this year. Set one in Budgets & Variance (against a ledger, a group or a cost centre) to see spending against it here.</div>}
          </Card>
        </div>

        {/* due dates + bank reconciliation */}
        <div style={{ ...g3, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} className="acc-dash-2">
          <Card title="GST & TDS due dates" icon={CalendarClock} right={<span>from today</span>}>
            <Tbl rows={g.compliance} cols={[{ h: 'Return / payment', v: r => r.what, b: 1 }, { h: 'Period', v: r => r.period }, { h: 'Due', v: r => fmtDate(r.due) },
              { h: 'Days', r: 1, v: r => (r.days < 0 ? Math.abs(r.days) + ' days ago' : r.days === 0 ? 'Today' : 'in ' + r.days + ' days'), color: r => (r.days < 0 ? '#64748b' : r.days <= 5 ? C.expense : r.days <= 15 ? '#b45309' : T.text) },
              { h: 'Amount (books)', r: 1, v: r => (r.amount == null ? '-' : inr(r.amount, 0)) }]} empty="No due date in the next 45 days" />
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8 }}>Dates as per GST / Income-tax rules (holidays and extensions not counted). Amounts are from the books of the branch picked; filing status is not tracked here - past dates are for checking that the return went in.</div>
          </Card>
          <Card title="Bank reconciliation" icon={Landmark} right={<span onClick={() => report('brs')} style={{ cursor: 'pointer', color: 'var(--primary-text, #0284c7)', fontWeight: 700 }}>Open BRS</span>}>
            <div style={{ display: 'flex', gap: 24, marginBottom: 8, flexWrap: 'wrap' }}>
              <div><div style={{ fontSize: 10.5, color: T.muted, fontWeight: 700 }}>Entries not matched</div><div style={{ fontSize: 18, fontWeight: 800, color: g.brs.open ? C.expense : '#059669' }}>{g.brs.open}</div></div>
              <div><div style={{ fontSize: 10.5, color: T.muted, fontWeight: 700 }}>Amount</div><div style={{ fontSize: 18, fontWeight: 800 }}>₹ {short(g.brs.amount)}</div></div>
              <div><div style={{ fontSize: 10.5, color: T.muted, fontWeight: 700 }}>Banks never reconciled</div><div style={{ fontSize: 18, fontWeight: 800, color: g.brs.neverDone ? '#b45309' : '#059669' }}>{g.brs.neverDone}</div></div>
            </div>
            <Tbl max={180} rows={g.brs.rows} onRow={() => report('brs')} cols={[{ h: 'Bank', v: r => r.name, w: 190, b: 1 }, { h: 'Open', r: 1, v: r => r.open }, { h: 'Amount', r: 1, v: r => short(r.amount) }, { h: 'Last reconciled', v: r => (r.lastReconciled ? fmtDate(r.lastReconciled) : 'Never'), color: r => (r.lastReconciled ? T.text : '#b45309') }]} empty="All bank entries are matched" />
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8 }}>Bank entries of this year older than 15 days ({g.brs.asOf ? fmtDate(g.brs.asOf) : ''}) with no clearing date in BRS.</div>
          </Card>
        </div>
      </>}
      {d.mgmt && d.mgmt.error && <div style={{ padding: '8px 12px', background: T.amberBg, border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: T.amber }}>Management figures could not be worked out: {d.mgmt.error}</div>}

      {/* receivable / payable */}
      <div style={{ ...g3, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} className="acc-dash-2">
        <Card title="Receivables ageing" icon={ArrowDownLeft} pad={16} right={<span>as on {fmtDate(d.asOn)}</span>}><Ageing side="Dr" data={d.receivable} onParty={ledger} onReport={() => report('partybal')} /></Card>
        <Card title="Payables ageing" icon={ArrowUpRight} pad={16} right={<span>as on {fmtDate(d.asOn)}</span>}><Ageing side="Cr" data={d.payable} onParty={ledger} onReport={() => report('partybal')} /></Card>
      </div>

      {/* money flow + tax + control */}
      <div style={{ ...g3, gridTemplateColumns: 'minmax(0, 1.4fr) minmax(240px, 1fr) minmax(240px, 1fr)' }} className="acc-dash-3">
        <Card title="Money in vs money out" icon={Landmark} right={<span>In {short(k.receipts)} / Out {short(k.payments)}</span>}>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={flow} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={short} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
                <Tooltip {...tip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area dataKey="receipt" name="Received" stroke={C.receipt} fill={C.receipt} fillOpacity={0.15} strokeWidth={2} />
                <Area dataKey="payment" name="Paid" stroke={C.payment} fill={C.payment} fillOpacity={0.12} strokeWidth={2} />
                <Line dataKey="net" name="Net (running)" stroke={C.profit} strokeDasharray="4 3" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="GST & TDS position" icon={Percent} right={<span>this year</span>}>
          {[['Output GST (on sales)', k.gstOut, C.expense], ['Input GST (on purchases)', k.gstIn, C.income], [k.gstNet >= 0 ? 'Net GST payable' : 'Net GST credit', Math.abs(k.gstNet), 'var(--primary-text, #1e3a8a)'], ['TDS deducted (payable)', k.tds, '#b45309']].map(([l, v, c], i) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 2px', borderBottom: '1px solid #f1f5f9', fontSize: 12, fontWeight: i === 2 ? 800 : 600 }}>
              <span>{l}</span><span style={{ color: c, fontVariantNumeric: 'tabular-nums' }}>{inr(v, 0)}</span>
            </div>
          ))}
          <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase', margin: '10px 0 4px' }}>Tax ledger balances</div>
          <div style={{ maxHeight: 110, overflowY: 'auto' }}>
            {d.taxes.map(t => (
              <div key={t.id} onClick={() => ledger(t.id)} className="table-row-hover" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 2px', cursor: 'pointer' }}>
                <span>{t.name}</span><span style={{ fontWeight: 700 }}>{inr(Math.abs(t.balance), 0)} {t.balance < 0 ? 'Cr' : 'Dr'}</span>
              </div>
            ))}
            {!d.taxes.length && <div style={{ fontSize: 11, color: T.muted }}>No tax balances</div>}
          </div>
        </Card>
        <Card title="Control & checks" icon={ShieldCheck}>
          <Check ok={!ctl.pending} label="Vouchers waiting for approval" value={ctl.pending ? ctl.pending + ' (' + short(ctl.pendingAmt) + ')' : 'None'} onClick={() => nav('/expense-approvals')} />
          <Check ok={!ctl.rejected} label="Returned / rejected this year" value={ctl.rejected || 'None'} />
          <Check ok={!ctl.unbalanced} warn={!!ctl.unbalanced} label="Vouchers with Dr not equal to Cr" value={ctl.unbalanced || 'None'} />
          <Check ok={ctl.closedMonths > 0} label="Months closed this year" value={ctl.closedMonths + ' of 12'} onClick={() => report('monthclosing')} />
          <Check ok={!ctl.overLimit} warn={!!ctl.overLimit} label="Debtors over credit limit" value={ctl.overLimit || 'None'} />
          <Check ok={!ctl.noGstin} label="Parties without GSTIN" value={ctl.noGstin || 'None'} />
          <Check ok={!d.receivable.overdue} warn={d.receivable.overdue > 0} label="Overdue receivable" value={d.receivable.overdue ? '₹ ' + short(d.receivable.overdue) : 'None'} onClick={() => report('partybal')} />
        </Card>
      </div>

      {/* top heads + recent */}
      <div style={{ ...g3, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }} className="acc-dash-3">
        <Card title="Top expense heads" icon={TrendingDown}><HeadBars rows={d.topExpenses} color={C.expense} onRow={ledger} /></Card>
        <Card title="Top income heads" icon={TrendingUp}><HeadBars rows={d.topIncome} color={C.income} onRow={ledger} /></Card>
        <Card title="Recent vouchers" icon={FileText} pad={0} right={<span>{Object.entries(d.byType).map(([t, v]) => t + ' ' + v.n).join(', ')}</span>}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {d.recent.map(v => (
                <tr key={v.id} className="table-row-hover" onClick={() => nav('/accounts-hub?item=' + deskOf(v.baseType) + '&voucher=' + v.id)} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td><div style={{ fontWeight: 700 }}>{v.typeName} {v.voucherNumber}</div><div style={{ fontSize: 10, color: T.muted, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmtDate(v.date)} {v.party || ''}</div></td>
                  <td style={{ textAlign: 'right' }}><div style={{ fontWeight: 700 }}>{inr(v.totalAmount, 0)}</div><Badge tone={statusTone(v.status)}>{v.status || 'Pending'}</Badge></td>
                </tr>
              ))}
              {!d.recent.length && <tr><td colSpan={2} style={{ textAlign: 'center', color: T.muted, padding: 20 }}>No vouchers yet</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
      <style>{`@media (max-width: 1100px) { .acc-dash-3 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } } @media (max-width: 1100px) { .acc-kpi4 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } } @media (max-width: 860px) { .acc-dash-2, .acc-dash-3 { grid-template-columns: 1fr !important; } } @media (max-width: 560px) { .acc-kpi4 { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
