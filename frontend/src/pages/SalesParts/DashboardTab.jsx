// Sales > Dashboard: the logged-in sales person's own figures (a manager sees his team, admin everyone, and can pick a
// person). Billing this FY against the same days of last FY, this month, month by month, outstanding / overdue,
// customers to act on, reviews and birthdays, and person by person for a team. 11-Nov-2026.
import React from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CalendarClock, Gift, Users, Info, IndianRupee, CalendarDays, Wallet, Landmark, Package, BarChart3, HeartPulse, ClipboardCheck, Inbox, Send, Hourglass, Trophy, Target } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { api, C, inr, crore, dmy, btn, th, td, ActivityChip, KpiCard, Card, TONE } from './salesUi';
import CustomerForm from './CustomerForm';

const pct = (g) => (g == null ? '' : `${g >= 0 ? '+' : ''}${Math.round(g * 100)}%`);
const growthOf = (a, b) => (b > 0 ? (a - b) / b : null);
const MONTH_NAME = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Delta({ g, suffix }) {
  if (g == null) return <span style={{ color: C.mute }}>no billing then</span>;
  const up = g >= 0;
  return (
    <span>
      <span style={{ color: up ? C.green : C.red, fontWeight: 700, whiteSpace: 'nowrap' }}>
        {up ? <TrendingUp size={13} style={{ verticalAlign: '-2px' }} /> : <TrendingDown size={13} style={{ verticalAlign: '-2px' }} />} {g > 9.99 ? '10x+' : pct(g)}
      </span>
      {suffix && <span style={{ color: C.mute }}> {suffix}</span>}
    </span>
  );
}

function Panel({ title, icon, tone, right, children, pad = true }) {
  return <Card title={title} icon={icon} tone={tone} right={right} pad={pad}>{children}</Card>;
}

// one customer list (top / falling / quiet / overdue) - a row opens the customer
function CustTable({ rows, cols, onOpen, empty }) {
  if (!rows.length) return <div style={{ padding: '14px 12px', fontSize: '12px', color: C.mute }}>{empty}</div>;
  return (
    <div style={{ overflow: 'auto', maxHeight: '360px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{cols.map(c => <th key={c[0]} style={{ ...th, textAlign: c[2] ? 'right' : 'left' }}>{c[1]}</th>)}</tr></thead>
        <tbody>{rows.map(r => (
          <tr key={r.id} tabIndex={0} onClick={() => onOpen(r.id)} onKeyDown={e => { if (e.key === 'Enter') onOpen(r.id); }} style={{ cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = C.soft; }} onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
            {cols.map(c => <td key={c[0]} style={{ ...td, textAlign: c[2] ? 'right' : 'left', whiteSpace: c[2] ? 'nowrap' : undefined, fontVariantNumeric: c[2] ? 'tabular-nums' : undefined }}>{c[3](r)}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function HealthBar({ k }) {
  const parts = [['Billing', k.active, TONE.green[0]], ['Slowing', k.slowing, '#f59e0b'], ['Dormant', k.dormant, TONE.red[0]], ['Not billed', k.notBilled + k.prospects, '#cbd5e1']];
  const tot = parts.reduce((a, p) => a + p[1], 0) || 1;
  return (
    <div>
      <div style={{ display: 'flex', height: '16px', borderRadius: '8px', overflow: 'hidden', background: C.greyBg, gap: '2px' }}>
        {parts.map(p => p[1] > 0 && <div key={p[0]} title={`${p[0]}: ${p[1]}`} style={{ width: `${p[1] / tot * 100}%`, background: p[2] }} />)}
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '6px', fontSize: '11.5px', color: C.grey }}>
        {parts.map(p => <span key={p[0]} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: p[2], display: 'inline-block' }} />{p[0]} <b style={{ color: C.ink }}>{p[1]}</b></span>)}
      </div>
    </div>
  );
}

function Completeness({ p }) {
  const items = [['Contact person', p.contact], ['Lanes (what it ships)', p.lane], ['Industry', p.industry], ['Potential', p.potential]];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      {items.map(([k, n]) => { const v = p.total ? n / p.total : 0; return (
        <div key={k}>
          <div style={{ display: 'flex', fontSize: '11.5px', color: C.grey }}><span>{k}</span><span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{n} of {p.total}</span></div>
          <div style={{ height: '8px', background: C.greyBg, borderRadius: '4px', marginTop: '3px' }}><div style={{ height: '100%', width: `${Math.max(v * 100, v > 0 ? 2 : 0)}%`, background: v >= 0.8 ? TONE.green[0] : v >= 0.4 ? '#f59e0b' : TONE.red[0], borderRadius: '4px' }} /></div>
        </div>); })}
      <div style={{ fontSize: '11px', color: C.mute }}>Customers billed this FY or last FY. Fill these on the customer to plan visits and quotations.</div>
    </div>
  );
}

const money = (v) => <span title={inr(v)}>{crore(v)}</span>;

export default function DashboardTab({ meta, reloadMeta, goTab }) {
  const [person, setPerson] = React.useState(() => { try { return localStorage.getItem('sales.dash.person') || ''; } catch (e) { return ''; } });
  const [d, setD] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [attn, setAttn] = React.useState('falling');
  const [open, setOpen] = React.useState(null);
  const [deals, setDeals] = React.useState(null); // enquiry / quotation figures (hidden if they cannot be read)

  const load = React.useCallback(async (p = person) => {
    setBusy(true);
    api('/deals/summary' + (/^\d+$/.test(String(p || '')) ? '?person=' + p : '')).then(r => setDeals(r.data)).catch(() => setDeals(null));
    try { const r = await api('/dashboard' + (p ? '?person=' + encodeURIComponent(p) : '')); setD(r); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }, [person]);
  React.useEffect(() => { load(); }, []); // eslint-disable-line
  const pick = (p) => { setPerson(p); try { localStorage.setItem('sales.dash.person', p); } catch (e) { /* ignore */ } load(p); };

  if (!d) return <div style={{ color: C.mute, fontSize: '12px', padding: '20px 0' }}>{busy ? 'Reading the books…' : 'No figures.'}</div>;
  const k = d.kpi;
  const cm = MONTH_NAME[Number(d.curMonth.slice(5, 7)) - 1];
  const chart = d.months.map(m => ({ ...m, cy: m.future ? null : m.cy, cyReimb: m.future ? null : m.cyReimb }));
  const multi = d.team.length > 0;
  const attnRows = { falling: d.falling, quiet: d.quiet, overdue: d.overdue }[attn];
  const custCol = ['name', 'Customer', false, r => <><b style={{ color: C.ink }}>{r.name}</b>{!d.scope.person && <div style={{ fontSize: '10.5px', color: C.mute }}>{r.kam || 'no KAM'}{r.city ? ' · ' + r.city : ''}</div>}</>];
  const attnCols = {
    falling: [custCol, ['lyTo', 'Same days LY', true, r => money(r.lyTo)], ['cy', 'This FY', true, r => money(r.cy)], ['g', 'Change', true, r => <Delta g={r.growth} />], ['last', 'Last bill', true, r => dmy(r.lastBill)]],
    quiet: [custCol, ['ly', 'Last FY', true, r => money(r.ly)], ['cy', 'This FY', true, r => money(r.cy)], ['last', 'Last bill', true, r => r.lastBill ? <>{dmy(r.lastBill)}<div style={{ fontSize: '10.5px', color: C.red }}>{r.daysSince} days</div></> : <span style={{ color: C.red }}>not this FY</span>]],
    overdue: [custCol, ['out', 'Outstanding', true, r => money(r.outstanding)], ['od', 'Overdue', true, r => <b style={{ color: C.red }}>{crore(r.overdue)}</b>], ['cd', 'Credit', true, r => `${r.creditDays || d.defaultCredit} d`], ['last', 'Last bill', true, r => dmy(r.lastBill)]],
  }[attn];

  return (
    <div>
      {/* who */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: C.ink }}>{d.scope.person ? d.scope.person.name : d.scope.label}</div>
          <div style={{ fontSize: '11.5px', color: C.mute }}>
            FY {d.fyLabel} up to {dmy(d.asOn)} · billing is sales less credit notes, incl. GST{d.scope.person ? ' · customers where he is the KAM, every branch' : ''}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
          {d.scope.options.length > 1 && (
            <select aria-label="Whose dashboard" value={d.scope.sel} onChange={e => pick(e.target.value)} style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', minWidth: '220px', background: '#fff' }}>
              {d.scope.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          <button type="button" style={btn()} onClick={() => load()} disabled={busy}><RefreshCw size={13} /> {busy ? 'Reading…' : 'Refresh'}</button>
        </div>
      </div>
      {d.canManage && d.noLogin > 0 && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: TONE.blue[1], color: TONE.blue[0], border: '1px solid #bfdbfe', padding: '8px 12px', borderRadius: '10px', fontSize: '12px', marginBottom: '14px' }}>
          <Info size={14} /> {d.noLogin} sales person(s) have no EagleView login linked. Link it on the sales person (Sales persons tab) - then he sees only his own dashboard and customers.
          {goTab && <button type="button" style={{ ...btn('ghost'), marginLeft: 'auto' }} onClick={() => goTab('persons')}>Open sales persons</button>}
        </div>
      )}

      {/* figures */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        <KpiCard label={`Billed FY ${d.fyLabel} so far`} value={money(k.billedCy)} icon={IndianRupee} tone="blue">
          <span><Delta g={growthOf(k.billedCy, k.billedLyTo)} suffix={`vs ${crore(k.billedLyTo)} same days LY`} /></span>
          <span>Full last FY {crore(k.billedLy)}</span>
        </KpiCard>
        <KpiCard label={`${cm} so far`} value={money(k.thisMonth)} icon={CalendarDays} tone="violet">
          <span><Delta g={growthOf(k.thisMonth, k.sameMonthLy)} suffix={`vs ${crore(k.sameMonthLy)} same days LY`} /></span>
          <span>Last month {crore(k.prevMonth)}</span>
        </KpiCard>
        <KpiCard label="Outstanding" value={money(k.outstanding)} icon={Wallet} tone={k.overdue > 0 ? 'red' : 'green'}>
          <span>Overdue <b style={{ color: k.overdue > 0 ? C.red : C.green }}>{crore(k.overdue)}</b>{k.outstanding > 0 ? ` (${Math.round(k.overdue / k.outstanding * 100)}%)` : ''}</span>
          <span>{k.advances > 0 ? `Advances held ${crore(k.advances)}` : 'Past the ledger credit days'}</span>
        </KpiCard>
        <KpiCard label="Customers" value={<>{k.active}<span style={{ fontSize: '13px', color: C.mute, fontWeight: 600 }}> billing of {k.customers}</span></>} icon={Users} tone="green" tint>
          <span>New this FY <b style={{ color: C.ink }}>{k.newThisFy}</b> ({crore(k.newThisFyBilled)})</span>
          <span>{k.prospects} prospect(s)</span>
        </KpiCard>
        <KpiCard label="Duty / DO billed this FY" value={money(k.reimbCy)} icon={Landmark} tone="slate"><span>Recovered on the customers' duty / DO accounts - kept out of the billing above</span></KpiCard>
        <KpiCard label="Dockets this FY" value={k.dockets ? inr(k.dockets) : '-'} icon={Package} tone="cyan">
          <span>{cm}: {inr(k.docketsMonth) || 0}</span>
          <span>{k.dockets ? (k.docketsLyTo ? <Delta g={growthOf(k.dockets, k.docketsLyTo)} suffix="vs same days LY" /> : 'By the marketing person on the docket') : 'No docket has his name as marketing person'}</span>
        </KpiCard>
      </div>

      {/* enquiries and quotations */}
      {deals && goTab && (
        <div style={{ marginBottom: '14px' }}>
          <Panel title="Enquiries and quotations" icon={Inbox} tone="amber" right={<span style={{ fontSize: '11px', color: C.mute }}>Click a figure to open the list</span>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
              <KpiCard compact label="Open enquiries" value={deals.openEnquiries} icon={Inbox} tone={deals.lateEnquiries ? 'red' : 'blue'} onClick={() => goTab('enquiries')}
                valueColor={deals.lateEnquiries ? TONE.red[0] : undefined}><span>{deals.lateEnquiries ? `${deals.lateEnquiries} past "quote by"` : 'to be quoted'}</span></KpiCard>
              <KpiCard compact label="Draft quotations" value={deals.draftQuotes} icon={ClipboardCheck} tone="slate" onClick={() => goTab('quotes', 'DRAFT')}><span>not sent yet</span></KpiCard>
              <KpiCard compact label="Quotations sent" value={deals.sentQuotes} icon={Send} tone="violet" onClick={() => goTab('quotes', 'SENT')}><span>{crore(deals.sentValue)} awaiting reply</span></KpiCard>
              <KpiCard compact label="Expiring / expired" value={`${deals.expiringQuotes} / ${deals.expiredQuotes}`} icon={Hourglass} tone="amber" onClick={() => goTab('quotes', 'EXPIRED')}><span>in 7 days / past validity</span></KpiCard>
              <KpiCard compact label="Won this month" value={deals.wonMonth} icon={Trophy} tone="green" tint onClick={() => goTab('quotes', 'WON')}><span>{crore(deals.wonMonthValue)} · margin {crore(deals.wonMonthMargin)}</span></KpiCard>
              <KpiCard compact label="Win rate this FY" value={deals.winRate == null ? '-' : deals.winRate + '%'} icon={Target} tone="cyan"><span>{deals.fyWon} won, {deals.fyLost} lost</span></KpiCard>
            </div>
          </Panel>
        </div>
      )}

      {/* month by month + health */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.2fr) minmax(260px, 1fr)', gap: '12px', marginBottom: '14px' }} className="sales-dash-row">
        <Panel title="Billing month by month" icon={BarChart3} tone="blue" right={<span style={{ fontSize: '11px', color: C.mute }}>Rs lakh</span>}>
          <div style={{ height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesBillGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#1d4ed8" /></linearGradient>
                  <linearGradient id="salesReimbGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e2e8f0" /><stop offset="100%" stopColor="#cbd5e1" /></linearGradient>
                </defs>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.grey }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.grey }} axisLine={false} tickLine={false} width={48} tickFormatter={v => Math.round(v / 1e5).toLocaleString('en-IN')} />
                <Tooltip formatter={(v, n) => [v == null ? '-' : 'Rs ' + inr(v), n]} labelStyle={{ fontWeight: 700 }} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={9} />
                <Bar dataKey="cy" name={`FY ${d.fyLabel}`} stackId="a" fill="url(#salesBillGrad)" radius={[0, 0, 0, 0]} maxBarSize={34} />
                <Bar dataKey="cyReimb" name="Duty / DO" stackId="a" fill="url(#salesReimbGrad)" radius={[4, 4, 0, 0]} maxBarSize={34} />
                <Line dataKey="ly" name="Last FY" type="linear" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          <Panel title="How the customers are billing" icon={HeartPulse} tone="green"><HealthBar k={k} /><div style={{ fontSize: '11px', color: C.mute, marginTop: '6px' }}>Billing: a bill in the last 60 days · Slowing: 60-120 · Dormant: more than 120.</div></Panel>
          <Panel title="Profiles filled" icon={ClipboardCheck} tone="violet"><Completeness p={d.profile} /></Panel>
        </div>
      </div>

      {/* customers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: '12px', marginBottom: '14px' }}>
        <Panel title="Top customers this FY" icon={TrendingUp} tone="blue" pad={false}>
          <CustTable rows={d.top} onOpen={setOpen} empty="Nothing billed this FY yet."
            cols={[custCol, ['cy', 'This FY', true, r => money(r.cy)], ['g', 'vs same days LY', true, r => <Delta g={r.growth} />], ['m', cm, true, r => money(r.thisMonth)], ['act', '', false, r => <ActivityChip activity={r.activity} last={r.lastBill} />]]} />
        </Panel>
        <Panel title="Needs attention" icon={AlertTriangle} tone="amber" pad={false}
          right={[['falling', `Falling (${d.falling.length})`], ['quiet', `Gone quiet (${d.quiet.length})`], ['overdue', `Overdue (${d.overdue.length})`]].map(([key, l]) => (
            <button key={key} type="button" onClick={() => setAttn(key)} aria-pressed={attn === key}
              style={{ padding: '3px 9px', fontSize: '11px', fontWeight: 700, borderRadius: '12px', cursor: 'pointer', border: '1px solid ' + (attn === key ? TONE.amber[0] : C.line), background: attn === key ? TONE.amber[1] : '#fff', color: attn === key ? TONE.amber[0] : C.grey }}>{l}</button>))}>
          <div style={{ fontSize: '11px', color: C.mute, padding: '6px 12px 0' }}>
            {attn === 'falling' ? 'Billed Rs 1 lakh+ in the same days last year and 30% or more down now.' : attn === 'quiet' ? 'Billed last year, no bill for 60 days or more - call or visit.' : `Outstanding past the ledger credit days (${d.defaultCredit} days where the ledger has none).`}
          </div>
          <CustTable rows={attnRows} cols={attnCols} onOpen={setOpen} empty="Nothing here - good." />
        </Panel>
      </div>

      {multi && (
        <div style={{ marginBottom: '14px' }}>
          <Panel title="Sales person by sales person" icon={Users} tone="violet" pad={false} right={<span style={{ fontSize: '11px', color: C.mute }}>Click a name to open his dashboard</span>}>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{[['Sales person'], ['Customers', 1], ['Billing', 1], ['Gone quiet', 1], ['This FY', 1], ['Same days LY', 1], ['Change', 1], [cm, 1], ['Outstanding', 1], ['Overdue', 1], ['Dockets', 1]].map(([h, r]) => <th key={h} style={{ ...th, textAlign: r ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
                <tbody>{d.team.map(t => {
                  const share = k.billedCy > 0 ? Math.max(t.cy, 0) / k.billedCy : 0;
                  const canOpen = t.id && d.scope.options.some(o => o.value === String(t.id));
                  return (
                    <tr key={t.id || 'none'}>
                      <td style={td}>
                        {canOpen ? <button type="button" onClick={() => pick(String(t.id))} style={{ border: 'none', background: 'none', padding: 0, color: C.accent, fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>{t.name}</button> : <b style={{ color: t.id ? C.ink : C.amber }}>{t.name}</b>}
                        <div style={{ height: '4px', background: C.greyBg, borderRadius: '2px', marginTop: '3px', width: '140px' }} title={`${Math.round(share * 100)}% of the billing`}><div style={{ height: '100%', width: `${share * 100}%`, background: 'linear-gradient(90deg, #60a5fa, #2563eb)', borderRadius: '2px' }} /></div>
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>{t.customers}{t.prospects ? <div style={{ fontSize: '10.5px', color: C.mute }}>+{t.prospects} prospects</div> : null}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{t.active}</td>
                      <td style={{ ...td, textAlign: 'right', color: t.quiet ? C.amber : C.mute }}>{t.quiet}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{money(t.cy)}</td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', color: C.grey }}>{money(t.lyTo)}</td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}><Delta g={t.growth} /></td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{money(t.thisMonth)}</td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{money(t.outstanding)}</td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', color: t.overdue > 0 ? C.red : C.mute }}>{money(t.overdue)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{t.dockets == null ? '' : t.dockets || '-'}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', gap: '12px' }}>
        <Panel title="Reviews due (next 7 days)" icon={CalendarClock} tone="cyan" pad={false}>
          <CustTable rows={d.reviews} onOpen={setOpen} empty="No account review due. Set 'Next review' on a customer to plan visits."
            cols={[custCol, ['rv', 'Review', true, r => <span style={{ color: r.late ? C.red : C.ink, fontWeight: 700 }}>{dmy(r.nextReviewDate)}{r.late ? ' (late)' : ''}</span>], ['cy', 'This FY', true, r => money(r.cy)]]} />
        </Panel>
        <Panel title="Birthdays and anniversaries (next 15 days)" icon={Gift} tone="pink" pad={false}>
          {d.events.length === 0 ? <div style={{ padding: '14px 12px', fontSize: '12px', color: C.mute }}>None coming up. Add birthdays / anniversaries on the customer's contacts.</div> : (
            <div style={{ maxHeight: '300px', overflow: 'auto' }}>
              {d.events.map((e, i) => (
                <div key={i} role="button" tabIndex={0} onClick={() => setOpen(e.customerId)} onKeyDown={ev => { if (ev.key === 'Enter') setOpen(e.customerId); }} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '7px 12px', borderTop: i ? '1px solid #f1f5f9' : 'none', cursor: 'pointer', fontSize: '12px' }}>
                  <div style={{ width: '44px', textAlign: 'center', flexShrink: 0, background: e.inDays === 0 ? TONE.green[1] : TONE.pink[1], borderRadius: '8px', padding: '3px 0' }}><div style={{ fontSize: '16px', fontWeight: 800, color: e.inDays === 0 ? TONE.green[0] : TONE.pink[0] }}>{e.date.slice(8, 10)}</div><div style={{ fontSize: '10px', color: C.mute }}>{MONTH_NAME[Number(e.date.slice(5, 7)) - 1]}</div></div>
                  <div style={{ minWidth: 0 }}><b>{e.contact}</b>{e.designation ? `, ${e.designation}` : ''} <span style={{ color: C.mute }}>· {e.what}{e.inDays === 0 ? ' today' : ` in ${e.inDays} day(s)`}</span><div style={{ fontSize: '11px', color: C.grey }}>{e.customer}{e.mobile ? ' · ' + e.mobile : ''}</div></div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {open && <CustomerForm id={open} meta={meta} onClose={() => setOpen(null)} onSaved={() => {}} reloadMeta={reloadMeta} />}
    </div>
  );
}
