// 04-Nov-2026: Outstanding, Credit Control and Bank Reconciliation rebuilt inside Accounts in the hub's look.
//   Outstanding         - receivable / payable open bills (FIFO + bill-wise set-offs, utils/openItems), ageing tiles that
//                         filter, party view with its bills, Excel, printed statement per party
//   Credit Control      - parties with limit use, ageing, risk and why; per party: bills, follow-ups with promise to pay
//                         (kept / broken), credit limit and days, reminder policy, and matching the party's own ledger
//   Bank Reconciliation - books vs bank: cheques not presented, deposits not credited, the balance the bank should show;
//                         clear lines by hand or read the bank statement from Excel and match it
// Backends: /api/vouchers/outstanding, /api/credit-control/*, /api/accounts-hub/brs, /api/vouchers/brs/reconcile.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Download, Printer, ChevronRight, ChevronDown, Search, Plus, Check, X, Save, Wand2, BookOpen, FileText, Mail, MessageCircle } from 'lucide-react';
import { T, inr, fmtDate, todayIso, api, postJson, lookup, Box, Sheet, Btn, ActionBar, Field, inputStyle, roStyle, Money, Badge, LedgerPicker, Grid, Empty } from './ui';
import { readExcel, sampleExcel, ExcelButtons } from './extras';
import { InvoiceSend, openInvoicePdf } from './GstInvoiceDesk';
import VoucherDrawer from './VoucherDrawer';

const num = (v) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isFinite(n) ? n : 0; };
const r2 = (v) => Math.round(v * 100) / 100;
const addDays = (iso, d) => { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
async function toExcel(name, cols, rows) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([cols.map(c => c[1]), ...rows.map(r => cols.map(c => (typeof c[0] === 'function' ? c[0](r) : r[c[0]])))]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Sheet1'); XLSX.writeFile(wb, name + '.xlsx');
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function printHtml(title, body) {
  const w = window.open('', '_blank', 'width=900,height=1000'); if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;font-size:12px;color:#111}
  h1{font-size:17px;margin:0}h2{font-size:13px;margin:4px 0 12px;font-weight:600}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #777;padding:5px 7px}th{background:#eee;text-align:left}
  .n{text-align:right;white-space:nowrap}.tot td{font-weight:800}.sub{color:#555;font-size:11px}</style></head><body>${body}<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close(); return true;
}
function Tiles({ items, active, onPick }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: 8 }} className="acc-tiles">
      {items.map(t => {
        const on = active === t.key;
        return (
          <div key={t.key} onClick={() => onPick && onPick(on ? '' : t.key)} style={{ cursor: onPick ? 'pointer' : 'default', background: on ? T.headBg : '#fff', border: `1px solid ${on ? T.head : T.headBorder}`, borderRadius: 8, padding: '8px 12px', minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: t.color || T.ink, fontVariantNumeric: 'tabular-nums' }}>{t.value}</div>
            {t.sub && <div style={{ fontSize: 10.5, color: T.muted }}>{t.sub}</div>}
          </div>
        );
      })}
      <style>{'@media (max-width: 900px) { .acc-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }'}</style>
    </div>
  );
}
const ageKey = (d) => (d <= 0 ? 'notDue' : d <= 30 ? 'd30' : d <= 60 ? 'd60' : d <= 90 ? 'd90' : 'd90p');
const AGE = [['notDue', 'Not due'], ['d30', '1-30 days'], ['d60', '31-60 days'], ['d90', '61-90 days'], ['d90p', 'Over 90 days']];
const ageColor = { notDue: '#047857', d30: '#b45309', d60: '#c2410c', d90: '#b91c1c', d90p: '#7f1d1d' };

// ================================================================== OUTSTANDING
export function OutstandingScreen() {
  const nav = useNavigate();
  // 08-Nov-2026: a bill that is a GST invoice (from GST Invoice or loaded from iCAFFE's Sales Register) opens as a PDF (Print, Download, Mail, WhatsApp)
  const [send, setSend] = useState(null); // { voucherId, mode }
  const pdf = (b, dl) => openInvoicePdf(b.voucherId, dl).catch(e => setMsg('Invoice ' + b.refNo + ': ' + e.message));
  const ib = { border: '1px solid #cbd5e1', background: '#fff', borderRadius: 4, cursor: 'pointer', padding: '1px 4px', marginLeft: 3, display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' };
  // buttons first, then the bill no (08-Nov-2026: on one line)
  // 09-Nov-2026: clicking the bill no shows the voucher's details in a side panel; the PDF opens from its own button
  const [vd, setVd] = useState(null);
  const vdLink = (b) => ({ title: 'Show the details of ' + b.refNo, onClick: (e) => { e.stopPropagation(); setVd(b.voucherId); }, style: { color: '#1d4ed8', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600, background: String(vd) === String(b.voucherId) ? T.headBg : undefined } });
  const BillNo = ({ b }) => b.gst && b.voucherId
    ? <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}>
        <button type="button" title="Download PDF" style={{ ...ib, marginLeft: 0 }} onClick={(e) => { e.stopPropagation(); pdf(b, true); }}><Download size={11} color="#334155" /></button>
        <button type="button" title={'Open the PDF of ' + b.gst.invoiceNo + ' in a new tab'} style={ib} onClick={(e) => { e.stopPropagation(); pdf(b, false); }}><FileText size={11} color="#b91c1c" /></button>
        <button type="button" title="E-mail with PDF" style={ib} onClick={(e) => { e.stopPropagation(); setSend({ voucherId: b.voucherId, mode: 'mail' }); }}><Mail size={11} color="#1d4ed8" /></button>
        <button type="button" title="WhatsApp with PDF" style={{ ...ib, marginRight: 6 }} onClick={(e) => { e.stopPropagation(); setSend({ voucherId: b.voucherId, mode: 'whatsapp' }); }}><MessageCircle size={11} color="#16a34a" /></button>
        <span {...vdLink(b)}>{b.refNo}</span>
        {b.gst.irn && <span style={{ marginLeft: 4, fontSize: 9, color: '#047857', fontWeight: 800 }}>IRN</span>}
      </span>
    : b.voucherId ? <span style={{ whiteSpace: 'nowrap' }}><span {...vdLink(b)}>{b.refNo}</span></span>
    : <span style={{ whiteSpace: 'nowrap' }}>{b.refNo}</span>;
  const [f, setF] = useState({ type: 'receivable', asOn: todayIso(), view: 'party', q: '', age: '', overdue: false });
  const [data, setData] = useState(null); const [msg, setMsg] = useState(''); const [open, setOpen] = useState({});
  const load = () => { setData(null); setMsg(''); api(`/api/vouchers/outstanding?type=${f.type}&asOn=${f.asOn}`).then(setData).catch(e => setMsg('Not loaded: ' + e.message)); };
  useEffect(load, [f.type, f.asOn]);
  const bills = useMemo(() => (data ? data.data || [] : []).map(b => ({ ...b, age: ageKey(b.overdueDays) })), [data]);
  const shown = bills.filter(b => (!f.q || (b.party + ' ' + b.refNo + ' ' + (b.narration || '')).toLowerCase().includes(f.q.toLowerCase())) && (!f.age || b.age === f.age) && (!f.overdue || b.overdueDays > 0));
  const parties = useMemo(() => {
    const m = new Map();
    shown.forEach(b => { if (!m.has(b.ledgerId)) m.set(b.ledgerId, { ledgerId: b.ledgerId, party: b.party, bills: [], total: 0, notDue: 0, d30: 0, d60: 0, d90: 0, d90p: 0, oldest: 0 }); const p = m.get(b.ledgerId); p.bills.push(b); p.total = r2(p.total + b.pending); p[b.age] = r2(p[b.age] + b.pending); p.oldest = Math.max(p.oldest, b.overdueDays); });
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [shown]);
  const tot = (k) => r2(bills.filter(b => !k || b.age === k).reduce((s, b) => s + b.pending, 0));
  const rec = f.type === 'receivable';
  const statement = (p) => {
    const rows = p.bills.map(b => `<tr><td>${esc(b.refNo)}</td><td>${fmtDate(b.date)}</td><td>${fmtDate(b.dueDate)}</td><td class="n">${inr(b.amount)}</td><td class="n">${inr(b.pending)}</td><td class="n">${b.overdueDays > 0 ? b.overdueDays : ''}</td></tr>`).join('');
    if (!printHtml('Statement ' + p.party, `<h1>COMMITTED CARGO CARE LIMITED</h1><h2>Statement of outstanding - ${esc(p.party)} - as on ${fmtDate(f.asOn)}</h2>
      <table><thead><tr><th>Bill</th><th>Date</th><th>Due</th><th class="n">Bill amount</th><th class="n">${rec ? 'Due from you' : 'Due to you'}</th><th class="n">Days overdue</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr class="tot"><td colspan="4">Total</td><td class="n">${inr(p.total)}</td><td></td></tr></tfoot></table><p class="sub">Please let us know if any bill above differs from your books.</p>`)) setMsg('Allow pop-ups to print');
  };
  return (
    <>
    {send && <InvoiceSend voucherId={send.voucherId} mode={send.mode} onClose={() => setSend(null)} />}
    {vd && <VoucherDrawer id={vd} ids={shown.map(b => b.voucherId)} onMove={setVd} onClose={() => setVd(null)} />}
    <Sheet tabs={[{ id: 'o', label: 'Outstanding' }]} tab="o" onTab={() => {}}>
      <ActionBar note={msg}>
        <div style={{ display: 'inline-flex', border: `1px solid ${T.headBorder}`, borderRadius: 6, overflow: 'hidden' }}>
          {[['receivable', 'Receivable (debtors)'], ['payable', 'Payable (creditors)']].map(([k, l]) => <button key={k} type="button" onClick={() => setF({ ...f, type: k, age: '' })} style={{ padding: '5px 12px', fontSize: 11.5, fontWeight: 800, border: 'none', cursor: 'pointer', background: f.type === k ? T.grad : '#fff', color: f.type === k ? '#fff' : T.head }}>{l}</button>)}
        </div>
        <span style={{ fontSize: 11, color: T.muted }}>As on</span><input type="date" style={{ ...inputStyle, width: 140 }} value={f.asOn} onChange={e => setF({ ...f, asOn: e.target.value })} />
        <div style={{ position: 'relative' }}><Search size={13} style={{ position: 'absolute', left: 8, top: 8, color: T.muted }} /><input style={{ ...inputStyle, width: 210, paddingLeft: 26 }} value={f.q} onChange={e => setF({ ...f, q: e.target.value })} placeholder="Party, bill or narration" /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, margin: 0 }}><input type="checkbox" checked={f.overdue} onChange={e => setF({ ...f, overdue: e.target.checked })} /> Overdue only</label>
        <select style={{ ...inputStyle, width: 120 }} value={f.view} onChange={e => setF({ ...f, view: e.target.value })}><option value="party">Party-wise</option><option value="bill">Bill-wise</option></select>
        <Btn kind="primary" onClick={load}><RefreshCw size={13} /> Refresh</Btn>
        <Btn kind="plain" onClick={() => toExcel('outstanding_' + f.type + '_' + f.asOn, [['party', 'Party'], ['refNo', 'Bill'], [b => fmtDate(b.date), 'Date'], [b => fmtDate(b.dueDate), 'Due'], ['amount', 'Bill amount'], ['pending', 'Pending'], ['overdueDays', 'Days overdue'], [b => (AGE.find(a => a[0] === b.age) || [])[1], 'Ageing']], shown)}><Download size={13} /> Excel</Btn>
      </ActionBar>
      {!data && !msg && <div style={{ color: T.muted, fontSize: 12, padding: 12 }}>Loading</div>}
      {data && (
        <>
          <Tiles active={f.age} onPick={a => setF({ ...f, age: a })} items={[
            { key: '', label: rec ? 'Total receivable' : 'Total payable', value: '₹ ' + inr(tot(''), 0), sub: bills.length + ' bills, ' + new Set(bills.map(b => b.ledgerId)).size + ' parties' },
            ...AGE.map(([k, l]) => ({ key: k, label: l, value: '₹ ' + inr(tot(k), 0), color: ageColor[k], sub: bills.filter(b => b.age === k).length + ' bills' }))]} />
          {data.basis && <div style={{ fontSize: 10.5, color: T.muted }}>{data.basis}{data.note ? ' - ' + data.note : ''}. Click an ageing box to show only those bills.</div>}
          {f.view === 'party' ? (
            <Grid title={'Parties (' + parties.length + ')'} maxHeight="calc(100vh - 420px)" rows={parties} rowKey={p => p.ledgerId} empty={bills.length ? 'Nothing matches the filter' : 'Nothing outstanding on this date'}
              cols={[
                { label: '', w: 24, render: p => <span onClick={() => setOpen(o => ({ ...o, [p.ledgerId]: !o[p.ledgerId] }))} style={{ cursor: 'pointer', color: T.head }}>{open[p.ledgerId] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span> },
                { label: 'Party', wrap: true, render: p => (
                  <div><b onClick={() => setOpen(o => ({ ...o, [p.ledgerId]: !o[p.ledgerId] }))} style={{ cursor: 'pointer' }}>{p.party}</b>
                    {open[p.ledgerId] && (
                      <table style={{ width: '100%', marginTop: 6, fontSize: 11 }}><thead><tr><th style={{ textAlign: 'left', fontSize: 10, color: '#64748b', fontWeight: 700, padding: '2px 6px 2px 0', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0' }}>Bill No</th><th style={{ textAlign: 'left', fontSize: 10, color: '#64748b', fontWeight: 700, padding: '2px 6px 2px 0', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0' }}>Bill Date</th><th style={{ textAlign: 'left', fontSize: 10, color: '#64748b', fontWeight: 700, padding: '2px 6px 2px 0', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0' }}>Due Date</th><th style={{ textAlign: 'left', fontSize: 10, color: '#64748b', fontWeight: 700, padding: '2px 6px 2px 0', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>Pending</th><th style={{ textAlign: 'left', fontSize: 10, color: '#64748b', fontWeight: 700, padding: '2px 6px 2px 0', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>Overdue Days</th></tr></thead><tbody>{p.bills.map(b => (
                        <tr key={b.id} style={{ whiteSpace: 'nowrap' }}><td><BillNo b={b} /></td><td style={{ whiteSpace: 'nowrap' }}>{fmtDate(b.date)}</td><td style={{ whiteSpace: 'nowrap' }}>{fmtDate(b.dueDate)}</td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{inr(b.pending)}</td><td style={{ textAlign: 'right', whiteSpace: 'nowrap', color: ageColor[b.age], fontWeight: 700 }}>{b.overdueDays > 0 ? b.overdueDays : 'Not due'}</td></tr>))}</tbody></table>
                    )}</div>) },
                { label: 'Bills', right: true, render: p => p.bills.length },
                { label: 'Outstanding', right: true, render: p => <Money v={p.total} strong /> },
                ...AGE.map(([k, l]) => ({ label: l, right: true, render: p => (p[k] ? <span style={{ color: ageColor[k], fontWeight: 700 }}>{inr(p[k])}</span> : '') })),
                { label: 'Oldest', right: true, render: p => (p.oldest > 0 ? p.oldest + ' d' : '') },
                { label: '', render: p => <span style={{ display: 'inline-flex', gap: 4 }}><Btn small kind="ghost" onClick={() => statement(p)} title="Print statement"><Printer size={11} /></Btn><Btn small kind="ghost" onClick={() => nav('/accounts-hub?item=ledger&ledger=' + p.ledgerId)} title="Ledger"><BookOpen size={11} /></Btn></span> },
              ]}
              foot={['', 'Total', shown.length, <Money v={r2(shown.reduce((s, b) => s + b.pending, 0))} strong />, ...AGE.map(([k]) => inr(r2(shown.filter(b => b.age === k).reduce((s, b) => s + b.pending, 0)))), '', '']} />
          ) : (
            <Grid title={'Bills (' + shown.length + ')'} maxHeight="calc(100vh - 420px)" rows={shown} rowKey={b => b.id} empty="Nothing matches the filter"
              cols={[{ label: 'Party', wrap: true, render: b => <b>{b.party}</b> }, { label: 'Bill', render: b => <BillNo b={b} /> }, { label: 'Date', render: b => fmtDate(b.date) }, { label: 'Due', render: b => fmtDate(b.dueDate) },
                { label: 'Bill amount', right: true, render: b => <Money v={b.amount} muted /> }, { label: 'Pending', right: true, render: b => <Money v={b.pending} strong /> },
                { label: 'Overdue', right: true, render: b => <span style={{ color: ageColor[b.age], fontWeight: 700 }}>{b.overdueDays > 0 ? b.overdueDays + ' days' : 'not due'}</span> }, { label: 'Narration', wrap: true, render: b => b.narration }]}
              foot={['Total', '', '', '', '', <Money v={r2(shown.reduce((s, b) => s + b.pending, 0))} strong />, '', '']} />
          )}
        </>
      )}
    </Sheet>
    </>
  );
}

// ================================================================== CREDIT CONTROL
const RISK_TONE = { High: 'bad', Medium: 'warn', Low: 'ok', None: 'muted' };
export function CreditControlScreen() {
  const nav = useNavigate();
  const [asOn, setAsOn] = useState(todayIso());
  const [d, setD] = useState(null); const [msg, setMsg] = useState('');
  const [fl, setFl] = useState({ q: '', risk: '', over: false });
  const [sel, setSel] = useState(null);
  const load = () => { setMsg(''); api('/api/credit-control/ageing?type=receivable&asOn=' + asOn).then(setD).catch(e => setMsg('Not loaded: ' + e.message)); };
  useEffect(load, [asOn]);
  const clients = (d && d.clients) || [];
  const shown = clients.filter(c => (!fl.q || c.name.toLowerCase().includes(fl.q.toLowerCase())) && (!fl.risk || c.risk === fl.risk) && (!fl.over || c.overLimit));
  const k = (d && d.kpis) || {};
  return (
    <Sheet tabs={[{ id: 'c', label: 'Credit Control' }]} tab="c" onTab={() => {}}>
      <ActionBar note={msg}>
        <span style={{ fontSize: 11, color: T.muted }}>As on</span><input type="date" style={{ ...inputStyle, width: 140 }} value={asOn} onChange={e => setAsOn(e.target.value)} />
        <div style={{ position: 'relative' }}><Search size={13} style={{ position: 'absolute', left: 8, top: 8, color: T.muted }} /><input style={{ ...inputStyle, width: 200, paddingLeft: 26 }} value={fl.q} onChange={e => setFl({ ...fl, q: e.target.value })} placeholder="Customer" /></div>
        <select style={{ ...inputStyle, width: 130 }} value={fl.risk} onChange={e => setFl({ ...fl, risk: e.target.value })}><option value="">All risk</option><option>High</option><option>Medium</option><option>Low</option></select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, margin: 0 }}><input type="checkbox" checked={fl.over} onChange={e => setFl({ ...fl, over: e.target.checked })} /> Over limit</label>
        <Btn kind="primary" onClick={load}><RefreshCw size={13} /> Refresh</Btn>
        <Btn kind="plain" onClick={() => toExcel('credit_control_' + asOn, [['name', 'Customer'], ['totalOut', 'Outstanding'], ['creditLimit', 'Limit'], ['utilisationPct', 'Use %'], ['creditDays', 'Credit days'], [c => c.buckets.notDue, 'Not due'], [c => c.buckets.b15, '1-15'], [c => c.buckets.b30, '16-30'], [c => c.buckets.b60, '31-60'], [c => c.buckets.b90, '60+'], ['risk', 'Risk'], ['riskWhy', 'Why']], shown)}><Download size={13} /> Excel</Btn>
      </ActionBar>
      {d && <Tiles items={[
        { key: 'a', label: 'Total receivable', value: '₹ ' + inr(k.totalOutstanding, 0), sub: clients.length + ' customers' },
        { key: 'b', label: 'Not due', value: '₹ ' + inr(k.notDue, 0), color: '#047857' },
        { key: 'c', label: 'Overdue 1-30', value: '₹ ' + inr(k.overdue1to30, 0), color: '#b45309' },
        { key: 'd', label: 'Overdue 31-60', value: '₹ ' + inr(k.overdue31to60, 0), color: '#c2410c' },
        { key: 'e', label: 'Over 60 days', value: '₹ ' + inr(k.critical60plus, 0), color: '#b91c1c' },
        { key: 'f', label: 'Promised this week', value: '₹ ' + inr(k.expectedThisWeek, 0), sub: (k.promisesCounted || 0) + ' promises' },
        { key: 'g', label: 'Over limit / no limit', value: (k.partiesOverLimit || 0) + ' / ' + (k.partiesWithoutLimit || 0), color: k.partiesOverLimit ? '#b91c1c' : T.ink }]} />}
      {!d && !msg && <div style={{ color: T.muted, fontSize: 12, padding: 12 }}>Loading</div>}
      {d && (
        <Grid title={'Customers (' + shown.length + ')'} maxHeight={sel ? 260 : 'calc(100vh - 420px)'} rows={shown} rowKey={c => c.ledgerId} activeKey={sel} onRow={c => setSel(c.ledgerId === sel ? null : c.ledgerId)}
          empty={clients.length ? 'Nothing matches the filter' : 'No customer owes anything on this date'}
          cols={[
            { label: 'Customer', wrap: true, render: c => <div><b>{c.name}</b><div style={{ fontSize: 10, color: T.muted }}>{[c.contactPerson, c.phone].filter(Boolean).join(' - ')}</div></div> },
            { label: 'Outstanding', right: true, render: c => <Money v={c.totalOut} strong /> },
            { label: 'Limit use', w: 140, render: c => (c.creditLimit ? (
              <div title={inr(c.totalOut) + ' of ' + inr(c.creditLimit)}><div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: Math.min(100, c.utilisationPct || 0) + '%', height: '100%', background: c.overLimit ? T.dr : (c.utilisationPct || 0) > 80 ? T.amber : T.cr }} /></div>
                <div style={{ fontSize: 10, color: c.overLimit ? T.dr : T.muted, fontWeight: c.overLimit ? 800 : 400 }}>{c.utilisationPct}% of {inr(c.creditLimit, 0)}</div></div>) : <span style={{ fontSize: 10.5, color: T.muted }}>No limit set</span>) },
            { label: 'Not due', right: true, render: c => inr(c.buckets.notDue || 0) },
            { label: '1-15', right: true, render: c => inr(c.buckets.b15 || 0) },
            { label: '16-30', right: true, render: c => inr(c.buckets.b30 || 0) },
            { label: '31-60', right: true, render: c => <span style={{ color: c.buckets.b60 ? '#c2410c' : undefined }}>{inr(c.buckets.b60 || 0)}</span> },
            { label: '60+', right: true, render: c => <span style={{ color: c.buckets.b90 ? T.dr : undefined, fontWeight: c.buckets.b90 ? 800 : 400 }}>{inr(c.buckets.b90 || 0)}</span> },
            { label: 'Risk', render: c => <span title={c.riskWhy}><Badge tone={RISK_TONE[c.risk] || 'muted'}>{c.risk}</Badge></span> },
            { label: 'Promise', render: c => (c.nextPromise ? <span style={{ fontSize: 11 }}>{fmtDate(c.nextPromise.date)}{c.nextPromise.amount ? ' - ' + inr(c.nextPromise.amount, 0) : ''}</span> : '') },
          ]} />
      )}
      {sel && <PartyPanel key={sel} id={sel} asOn={asOn} onChanged={load} onClose={() => setSel(null)} onLedger={() => nav('/accounts-hub?item=ledger&ledger=' + sel)} />}
    </Sheet>
  );
}

function PartyPanel({ id, asOn, onChanged, onClose, onLedger }) {
  const [p, setP] = useState(null); const [tab, setTab] = useState('bills'); const [msg, setMsg] = useState('');
  const [fu, setFu] = useState({ channel: 'CALL', note: '', promiseDate: '', promiseAmount: '', refNo: '' });
  const [lim, setLim] = useState({ creditLimit: '', creditDays: '' });
  const [pol, setPol] = useState({});
  const [match, setMatch] = useState(null);
  const load = () => api('/api/credit-control/party/' + id + '?asOn=' + asOn).then(r => { setP(r); setLim({ creditLimit: String(r.party.creditLimit || ''), creditDays: String(r.party.creditDays || '') });
    setPol(r.policy || { autoSendLedger: false, autoSendDays: '', overdueReminders: false, reminderAfterDays: 7, autoHoldDelivery: false, notes: '' }); }).catch(e => setMsg(e.message));
  useEffect(() => { load(); }, [id, asOn]);
  if (!p) return <Box><div style={{ fontSize: 12, color: msg ? T.dr : T.muted }}>{msg || 'Opening'}</div></Box>;
  const addFu = async () => {
    setMsg('');
    try { await postJson('/api/credit-control/followups', { ledgerId: id, ...fu }); setFu({ channel: fu.channel, note: '', promiseDate: '', promiseAmount: '', refNo: '' }); setMsg('Follow-up saved'); load(); onChanged(); }
    catch (e) { setMsg('Not saved: ' + e.message); }
  };
  const kept = async (f, v) => { try { await postJson('/api/credit-control/followups/' + f.id, { promiseMet: v }, 'PUT'); load(); onChanged(); } catch (e) { setMsg(e.message); } };
  const saveLimit = async () => {
    setMsg('');
    if (num(lim.creditLimit) < 0 || num(lim.creditDays) < 0) return setMsg('Limit and days cannot be negative');
    try { await postJson('/api/accounts-hub/ledgers/' + id, { creditLimit: num(lim.creditLimit), creditDays: Math.round(num(lim.creditDays)) }, 'PUT'); setMsg('Credit limit saved'); load(); onChanged(); }
    catch (e) { setMsg('Not saved: ' + e.message); }
  };
  const savePol = async () => { setMsg(''); try { await postJson('/api/credit-control/policy/' + id, pol, 'PUT'); setMsg('Policy saved'); load(); } catch (e) { setMsg('Not saved: ' + e.message); } };
  const MX = [{ key: 'ref', label: 'Invoice / Ref No', aliases: ['ref', 'reference', 'invoice', 'bill no', 'doc no', 'particulars'] }, { key: 'date', label: 'Date', date: true }, { key: 'amount', label: 'Amount' }, { key: 'debit', label: 'Debit' }, { key: 'credit', label: 'Credit' }];
  const readMatch = async (file) => {
    setMsg(''); setMatch(null);
    try {
      const rows = (await readExcel(file, MX)).map(r => ({ ref: r.ref, date: r.date, ...(r.amount !== '' ? { amount: r.amount } : {}), debit: r.debit, credit: r.credit }));
      setMatch(await postJson('/api/credit-control/ledger-match', { ledgerId: id, asOn, rows }));
    } catch (e) { setMsg('Could not match: ' + e.message); }
  };
  const b = p.buckets || {};
  return (
    <Box title={<span>{p.party.name} <span style={{ fontWeight: 600, color: T.muted }}>- {inr(p.total)} outstanding, {(p.bills || []).length} bills{p.party.gstin ? ', ' + p.party.gstin : ''}</span></span>}
      right={<><Btn small kind="ghost" onClick={onLedger}><BookOpen size={11} /> Ledger</Btn><span onClick={onClose} style={{ cursor: 'pointer' }}><X size={13} /></span></>}>
      <div className="tab-container" style={{ marginBottom: 10 }}>
        {[['bills', 'Bills'], ['fu', 'Follow-ups (' + (p.followUps || []).length + ')'], ['limit', 'Limit & policy'], ['match', 'Match their ledger']].map(([k, l]) => <div key={k} className={'custom-tab' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}>{l}</div>)}
      </div>
      {msg && <div style={{ fontSize: 11.5, fontWeight: 700, color: /^Not|Could/.test(msg) ? T.dr : T.cr, marginBottom: 8 }}>{msg}</div>}
      {tab === 'bills' && (
        <>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 6 }}>Not due {inr(b.notDue || 0)} - 1-15 days {inr(b.b15 || 0)} - 16-30 {inr(b.b30 || 0)} - 31-60 {inr(b.b60 || 0)} - 60+ {inr(b.b90 || 0)}</div>
          <Grid title="Open bills" maxHeight={240} rows={p.bills || []} rowKey={x => x.id} empty="Nothing outstanding"
            cols={[{ label: 'Bill', render: x => x.refNo }, { label: 'Party bill / ref', render: x => x.billNo }, { label: 'Job', render: x => x.jobNo }, { label: 'Date', render: x => fmtDate(x.date) }, { label: 'Due', render: x => fmtDate(x.dueDate) },
              { label: 'Amount', right: true, render: x => <Money v={x.amount} muted /> }, { label: 'Pending', right: true, render: x => <Money v={x.pending} strong /> },
              { label: 'Overdue', right: true, render: x => <span style={{ color: x.overdueDays > 0 ? T.dr : T.cr, fontWeight: 700 }}>{x.overdueDays > 0 ? x.overdueDays + ' days' : 'not due'}</span> }]} />
        </>
      )}
      {tab === 'fu' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 3fr) 140px 120px 120px auto', gap: 8, alignItems: 'end' }} className="acc-strip">
            <Field label="Channel"><select style={inputStyle} value={fu.channel} onChange={e => setFu({ ...fu, channel: e.target.value })}>{['CALL', 'EMAIL', 'VISIT', 'WHATSAPP'].map(c => <option key={c}>{c}</option>)}</select></Field>
            <Field label="What was said" required><input style={inputStyle} value={fu.note} onChange={e => setFu({ ...fu, note: e.target.value })} placeholder="Spoke to accounts, payment next week ..." /></Field>
            <Field label="Promise to pay on"><input type="date" style={inputStyle} min={asOn} value={fu.promiseDate} onChange={e => setFu({ ...fu, promiseDate: e.target.value })} /></Field>
            <Field label="Amount promised"><input style={{ ...inputStyle, textAlign: 'right' }} value={fu.promiseAmount} onChange={e => setFu({ ...fu, promiseAmount: e.target.value })} inputMode="decimal" /></Field>
            <Field label="Ref"><input style={inputStyle} value={fu.refNo} onChange={e => setFu({ ...fu, refNo: e.target.value })} /></Field>
            <Btn kind="primary" onClick={addFu}><Plus size={13} /> Add</Btn>
          </div>
          <Grid title="Follow-up log" maxHeight={240} rows={p.followUps || []} rowKey={x => x.id} empty="No follow-up yet"
            cols={[{ label: 'When', render: x => new Date(x.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) }, { label: 'By', render: x => x.createdByName || '' },
              { label: 'Channel', render: x => <Badge tone="brand">{x.channel}</Badge> }, { label: 'Note', wrap: true, render: x => x.note },
              { label: 'Promise', render: x => (x.promiseDate ? fmtDate(x.promiseDate) + (x.promiseAmount ? ' - ' + inr(x.promiseAmount, 0) : '') : '') },
              { label: 'Kept?', render: x => (!x.promiseDate ? '' : x.promiseMet === true ? <Badge tone="ok">Kept</Badge> : x.promiseMet === false ? <Badge tone="bad">Broken</Badge>
                : <span style={{ display: 'inline-flex', gap: 4 }}><Btn small kind="save" onClick={() => kept(x, true)}><Check size={11} /> Kept</Btn><Btn small kind="ghost" onClick={() => kept(x, false)}><X size={11} /> Broken</Btn></span>) }]} />
        </>
      )}
      {tab === 'limit' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
          <Box title="Credit limit">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
              <Field label="Credit limit (Rs)"><input style={{ ...inputStyle, textAlign: 'right' }} value={lim.creditLimit} onChange={e => setLim({ ...lim, creditLimit: e.target.value })} inputMode="decimal" /></Field>
              <Field label="Credit days"><input style={{ ...inputStyle, textAlign: 'right' }} value={lim.creditDays} onChange={e => setLim({ ...lim, creditDays: e.target.value })} inputMode="numeric" /></Field>
              <Btn kind="save" onClick={saveLimit}><Save size={13} /> Save</Btn>
            </div>
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 6 }}>Saved on the ledger; due dates of bills are worked out from the credit days.</div>
          </Box>
          <Box title="Reminders">
            {[['autoSendLedger', 'Send the ledger statement automatically'], ['overdueReminders', 'Send overdue reminders'], ['autoHoldDelivery', 'Hold delivery when over limit / 60+ days']].map(([k2, l]) => (
              <label key={k2} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, margin: '0 0 6px' }}><input type="checkbox" checked={!!pol[k2]} onChange={e => setPol({ ...pol, [k2]: e.target.checked })} /> {l}</label>))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Statement on days (e.g. 1,15)"><input style={inputStyle} value={pol.autoSendDays || ''} onChange={e => setPol({ ...pol, autoSendDays: e.target.value })} /></Field>
              <Field label="Remind after days overdue"><input style={{ ...inputStyle, textAlign: 'right' }} value={pol.reminderAfterDays ?? ''} onChange={e => setPol({ ...pol, reminderAfterDays: e.target.value })} inputMode="numeric" /></Field>
            </div>
            <Field label="Notes"><input style={inputStyle} value={pol.notes || ''} onChange={e => setPol({ ...pol, notes: e.target.value })} /></Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}><Btn kind="save" onClick={savePol}><Save size={13} /> Save policy</Btn></div>
          </Box>
        </div>
      )}
      {tab === 'match' && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, color: T.inkSoft }}>Read the customer's own ledger (Excel) and pair it with our open bills - by reference first, then by amount.</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}><ExcelButtons label="Read their ledger" onFile={readMatch} onSample={() => sampleExcel('party_ledger_sample', MX, [['INV/1', '10/05/2026', '', '', 11800]])} /></span>
          </div>
          {match && (
            <>
              <Tiles items={[{ key: 'a', label: 'Our books', value: inr(match.totals.ourBooks) }, { key: 'b', label: 'Their ledger', value: inr(match.totals.theirLedger) },
                { key: 'c', label: 'Matched', value: match.counts.matched, color: T.cr }, { key: 'd', label: 'Amount differs', value: match.counts.variances, color: T.amber },
                { key: 'e', label: 'Only in our books', value: match.counts.oursOnly, color: T.dr }, { key: 'f', label: 'Only in theirs', value: match.counts.theirsOnly, color: T.dr }]} />
              {match.variances.length > 0 && <Grid title="Amount differs" maxHeight={180} rows={match.variances} cols={[{ label: 'Bill', render: x => x.ref }, { label: 'Ours', right: true, render: x => inr(x.ours) }, { label: 'Theirs', right: true, render: x => inr(x.theirs) }, { label: 'Difference', right: true, render: x => <b>{inr(x.diff)}</b> }, { label: 'Likely reason', wrap: true, render: x => x.hint }]} />}
              {match.oursOnly.length > 0 && <Grid title="Only in our books" maxHeight={180} rows={match.oursOnly} cols={[{ label: 'Bill', render: x => x.ref }, { label: 'Date', render: x => fmtDate(x.date) }, { label: 'Pending', right: true, render: x => inr(x.ours) }]} />}
              {match.theirsOnly.length > 0 && <Grid title="Only in their ledger" maxHeight={180} rows={match.theirsOnly} cols={[{ label: 'Line', render: x => x.line }, { label: 'Ref', render: x => x.ref }, { label: 'Date', render: x => x.date }, { label: 'Amount', right: true, render: x => inr(x.amount) }]} />}
              <div style={{ fontSize: 10.5, color: T.muted }}>{match.note}</div>
            </>
          )}
        </>
      )}
    </Box>
  );
}

// ================================================================== BANK RECONCILIATION
const digits = (s) => String(s || '').replace(/\D/g, '').replace(/^0+/, '');
export function BankRecoScreen() {
  const [banks, setBanks] = useState([]);
  const [f, setF] = useState({ ledgerId: '', from: todayIso().slice(0, 8) + '01', to: todayIso(), stmt: '', show: 'open' });
  const [d, setD] = useState(null); const [msg, setMsg] = useState('');
  const [edits, setEdits] = useState({}); // detail id -> clearance date ('' = not cleared)
  const [pick, setPick] = useState({}); const [bulkDate, setBulkDate] = useState(todayIso());
  const [stLines, setStLines] = useState(null); // bank statement lines not found in the books
  const [saving, setSaving] = useState(false);
  useEffect(() => { lookup('ledgers-in?groups=Bank Accounts,Bank OD A/c,Cash-in-Hand').then(b => { setBanks(b || []); if (b && b.length && !f.ledgerId) setF(x => ({ ...x, ledgerId: String(b[0].id) })); }); }, []);
  const load = () => {
    if (!f.ledgerId) return; setMsg(''); setEdits({}); setPick({}); setStLines(null);
    api(`/api/accounts-hub/brs?ledgerId=${f.ledgerId}&from=${f.from}&to=${f.to}`).then(setD).catch(e => setMsg('Not loaded: ' + e.message));
  };
  useEffect(load, [f.ledgerId, f.from, f.to]);
  const rows = (d && d.rows) || [];
  const cdOf = (r) => (edits[r.id] !== undefined ? edits[r.id] : r.clearanceDate || '');
  const openOn = (r) => { const c = cdOf(r); return !c || c > f.to; };
  const live = useMemo(() => {
    const np = r2(rows.filter(r => r.dc === 'Cr' && openOn(r)).reduce((s, r) => s + r.amount, 0));
    const nc = r2(rows.filter(r => r.dc === 'Dr' && openOn(r)).reduce((s, r) => s + r.amount, 0));
    return { np, nc, bank: d ? r2(d.closing + np - nc) : 0 };
  }, [rows, edits, d]);
  const shown = rows.filter(r => f.show === 'all' || (f.show === 'open' ? openOn(r) : !openOn(r)));
  const dirty = Object.keys(edits).filter(k => { const r = rows.find(x => String(x.id) === k); return r && (edits[k] || '') !== (r.clearanceDate || ''); });
  const setCd = (r, v) => {
    if (v && v < r.date) return setMsg('Clearing date cannot be before the voucher date (' + fmtDate(r.date) + ')');
    setMsg(''); setEdits(e => ({ ...e, [r.id]: v }));
  };
  const save = async () => {
    if (!dirty.length) return setMsg('Nothing changed');
    setSaving(true);
    try { await postJson('/api/vouchers/brs/reconcile', { updates: dirty.map(k => ({ id: Number(k), clearanceDate: edits[k] || null })) }); setMsg('Saved ' + dirty.length + ' line' + (dirty.length === 1 ? '' : 's')); setTimeout(load, 400); }
    catch (e) { setMsg('Not saved: ' + e.message); }
    setSaving(false);
  };
  const clearPicked = () => { const ids = Object.keys(pick).filter(k => pick[k]); if (!ids.length) return setMsg('Tick the lines to clear'); const e = { ...edits }; let bad = 0; ids.forEach(k => { const r = rows.find(x => String(x.id) === k); if (r && bulkDate >= r.date) e[k] = bulkDate; else bad++; }); setEdits(e); setPick({}); setMsg(bad ? bad + ' line(s) dated after ' + fmtDate(bulkDate) + ' left as they are' : ''); };
  // bank statement from Excel: pair each line with an open book line of the same amount and direction, cheque no first, then nearest date
  const SX = [{ key: 'date', label: 'Date', aliases: ['txn date', 'value date', 'transaction date', 'tran date'], date: true }, { key: 'desc', label: 'Description', aliases: ['narration', 'particulars', 'remarks', 'details'] },
    { key: 'ref', label: 'Chq / Ref No', aliases: ['cheque no', 'chq no', 'ref no', 'reference', 'chqrefno', 'utr'] }, { key: 'wd', label: 'Withdrawal', aliases: ['debit', 'withdrawal amt', 'dr', 'withdrawals'] },
    { key: 'dep', label: 'Deposit', aliases: ['credit', 'deposit amt', 'cr', 'deposits'] }, { key: 'bal', label: 'Balance', aliases: ['closing balance'] }];
  const readStatement = async (file) => {
    setMsg('');
    try {
      const st = (await readExcel(file, SX)).filter(s => num(s.wd) || num(s.dep));
      if (!st.length) return setMsg('No withdrawal / deposit lines found in the statement');
      const used = new Set(); const e = { ...edits }; const missing = []; let matched = 0; let already = 0;
      for (const s of st) {
        const amt = r2(num(s.wd) || num(s.dep)); const dc = num(s.wd) ? 'Cr' : 'Dr'; // a withdrawal in the bank is a credit to the bank ledger in our books
        const cands = rows.filter(r => !used.has(r.id) && r.dc === dc && Math.abs(r.amount - amt) < 0.01 && openOn(r) && (!s.date || s.date >= r.date));
        let m = s.ref && digits(s.ref) ? cands.find(r => digits(r.refNo) && (digits(r.refNo) === digits(s.ref) || digits(s.desc).includes(digits(r.refNo)))) : null;
        if (!m && s.desc) m = cands.find(r => digits(r.refNo).length >= 4 && digits(s.desc).includes(digits(r.refNo)));
        if (!m) m = cands.filter(r => !s.date || daysBetween(r.date, s.date) <= 10).sort((a, b) => Math.abs(daysBetween(a.date, s.date || a.date)) - Math.abs(daysBetween(b.date, s.date || b.date)))[0];
        if (m) { used.add(m.id); e[m.id] = s.date || f.to; matched++; continue; }
        // a line the books already show as cleared is not missing
        const done = rows.find(r => !used.has(r.id) && r.dc === dc && Math.abs(r.amount - amt) < 0.01 && !openOn(r) && (!s.ref || !digits(r.refNo) || digits(r.refNo) === digits(s.ref) || digits(s.desc).includes(digits(r.refNo))));
        if (done) { used.add(done.id); already++; } else missing.push({ ...s, amount: amt, dc });
      }
      setEdits(e); setStLines(missing);
      const last = [...st].reverse().find(s => s.bal !== '' && s.bal != null);
      if (last && !f.stmt) setF(x => ({ ...x, stmt: String(num(last.bal)) }));
      setMsg('Statement read: ' + st.length + ' lines, ' + matched + ' matched with the books (not saved yet - check and Save)' + (already ? ', ' + already + ' already cleared' : '') + ', ' + missing.length + ' not in the books');
    } catch (err) { setMsg('Could not read the statement: ' + err.message); }
  };
  const diff = f.stmt !== '' ? r2(num(f.stmt) - live.bank) : null;
  const led = banks.find(b => String(b.id) === String(f.ledgerId));
  return (
    <Sheet tabs={[{ id: 'b', label: 'Bank Reconciliation' }]} tab="b" onTab={() => {}}>
      <Box>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) repeat(3, minmax(130px, 1fr)) auto', gap: 10, alignItems: 'end' }} className="acc-strip">
          <Field label="Bank / Cash Book" required><select style={inputStyle} value={f.ledgerId} onChange={e => setF({ ...f, ledgerId: e.target.value, stmt: '' })}><option value="">{banks.length ? 'Select' : 'No bank ledger yet'}</option>{banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="From"><input type="date" style={inputStyle} value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></Field>
          <Field label="To (statement date)"><input type="date" style={inputStyle} value={f.to} onChange={e => setF({ ...f, to: e.target.value })} /></Field>
          <Field label="Balance as per statement"><input style={{ ...inputStyle, textAlign: 'right' }} value={f.stmt} onChange={e => setF({ ...f, stmt: e.target.value })} inputMode="decimal" placeholder="Closing on the bank statement" /></Field>
          <div style={{ display: 'flex', gap: 8 }}><Btn kind="primary" onClick={load}><RefreshCw size={13} /> Load</Btn></div>
        </div>
      </Box>
      {!banks.length && <Empty title="No bank account yet">Create the bank ledgers under Bank Accounts (Masters, Ledger Account), then reconcile here.</Empty>}
      {d && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 10, alignItems: 'start' }} className="acc-bill-foot">
            <Tiles items={[{ key: 'a', label: 'Opening (books)', value: inr(Math.abs(d.opening)) + (d.opening < 0 ? ' Cr' : ' Dr') }, { key: 'b', label: 'Balance as per books', value: inr(Math.abs(d.closing)) + (d.closing < 0 ? ' Cr' : ' Dr'), sub: 'on ' + fmtDate(f.to) },
              { key: 'c', label: 'Not presented', value: inr(live.np), color: T.amber, sub: rows.filter(r => r.dc === 'Cr' && openOn(r)).length + ' payments' }, { key: 'd', label: 'Not yet credited', value: inr(live.nc), color: T.amber, sub: rows.filter(r => r.dc === 'Dr' && openOn(r)).length + ' deposits' }]} />
            <Box title="Reconciliation statement" pad={0}>
              <div style={{ padding: '6px 12px', fontSize: 12 }}>
                {[['Balance as per books', d.closing], ['Add: cheques issued, not presented', live.np], ['Less: deposits not yet credited', -live.nc]].map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: T.inkSoft }}>{k}</span><Money v={v} /></div>)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: T.headBg, borderTop: `1px solid ${T.headBorder}` }}><b style={{ color: T.head }}>Balance as per bank</b><Money v={live.bank} strong /></div>
              {diff !== null && <div style={{ padding: '6px 12px', fontSize: 12, fontWeight: 800, color: Math.abs(diff) < 0.01 ? T.cr : T.dr }}>{Math.abs(diff) < 0.01 ? 'Matches the statement' : 'Statement differs by ' + inr(Math.abs(diff)) + (diff > 0 ? ' (bank shows more)' : ' (bank shows less)')}</div>}
            </Box>
          </div>
          <ActionBar note={msg}>
            <select style={{ ...inputStyle, width: 150 }} value={f.show} onChange={e => setF({ ...f, show: e.target.value })}><option value="open">Not cleared</option><option value="done">Cleared</option><option value="all">All lines</option></select>
            <span style={{ fontSize: 11, color: T.muted }}>Clear ticked on</span><input type="date" style={{ ...inputStyle, width: 140 }} value={bulkDate} onChange={e => setBulkDate(e.target.value)} />
            <Btn kind="plain" onClick={clearPicked}><Check size={13} /> Clear ticked</Btn>
            <ExcelButtons label="Read bank statement" onFile={readStatement} onSample={() => sampleExcel('bank_statement_sample', SX, [['05/10/2026', 'CHQ PAID 000124 XYZ AIRLINES', '000124', 1500, '', 48500], ['08/10/2026', 'NEFT CR ABC EXPORTS', 'UTR123', '', 5000, 53500]])} />
            <Btn kind="save" onClick={save} disabled={saving}><Save size={13} /> {saving ? 'Saving' : 'Save' + (dirty.length ? ' (' + dirty.length + ')' : '')}</Btn>
            <Btn kind="plain" onClick={() => toExcel('brs_' + (led ? led.name : '') + '_' + f.to, [[r => fmtDate(r.date), 'Date'], ['voucherNumber', 'Voucher'], ['typeName', 'Type'], ['party', 'Party'], ['refNo', 'Chq / Ref'], [r => (r.dc === 'Dr' ? r.amount : ''), 'Deposit'], [r => (r.dc === 'Cr' ? r.amount : ''), 'Withdrawal'], [r => fmtDate(cdOf(r)), 'Cleared on']], shown)}><Download size={13} /> Excel</Btn>
          </ActionBar>
          <Grid title={(f.show === 'open' ? 'Not cleared' : f.show === 'done' ? 'Cleared' : 'All lines') + ' (' + shown.length + ')'} maxHeight="calc(100vh - 470px)" rows={shown} rowKey={r => r.id}
            empty={rows.length ? 'Nothing here - change the filter' : 'No entries in this bank for the period'}
            cols={[
              { label: <input type="checkbox" checked={shown.length > 0 && shown.every(r => pick[r.id])} onChange={e => { const p = { ...pick }; shown.forEach(r => { p[r.id] = e.target.checked; }); setPick(p); }} />, w: 28, render: r => <input type="checkbox" checked={!!pick[r.id]} onChange={e => setPick({ ...pick, [r.id]: e.target.checked })} /> },
              { label: 'Date', render: r => <span>{fmtDate(r.date)}{r.older && <div style={{ fontSize: 9.5, color: T.amber, fontWeight: 800 }}>EARLIER</div>}</span> },
              { label: 'Voucher', render: r => <span><b>{r.voucherNumber}</b><div style={{ fontSize: 10, color: T.muted }}>{r.typeName}</div></span> },
              { label: 'Party / narration', wrap: true, render: r => <span><b>{r.party}</b><div style={{ fontSize: 10, color: T.muted }}>{r.narration}</div></span> },
              { label: 'Chq / Ref', render: r => r.refNo },
              { label: 'Deposit', right: true, render: r => (r.dc === 'Dr' ? <Money v={r.amount} side="Dr" /> : '') },
              { label: 'Withdrawal', right: true, render: r => (r.dc === 'Cr' ? <Money v={r.amount} side="Cr" /> : '') },
              { label: 'Cleared on', w: 170, render: r => { const c = cdOf(r); const ch = edits[r.id] !== undefined && (edits[r.id] || '') !== (r.clearanceDate || ''); return (
                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><input type="date" min={r.date} style={{ ...inputStyle, height: 24, width: 130, borderColor: ch ? T.amber : undefined, background: ch ? T.amberBg : undefined }} value={c} onChange={e => setCd(r, e.target.value)} />
                  {c && <span onClick={() => setCd(r, '')} style={{ cursor: 'pointer', color: T.dr }} title="Not cleared"><X size={12} /></span>}</span>); } },
            ]} />
          {stLines && stLines.length > 0 && (
            <Grid title={'In the bank statement but not in the books (' + stLines.length + ') - bank charges, interest, direct credits: book them, then read the statement again'} maxHeight={220} rows={stLines}
              right={<Btn small kind="ghost" onClick={() => toExcel('statement_not_in_books', [['date', 'Date'], ['desc', 'Description'], ['ref', 'Ref'], [s => (s.dc === 'Cr' ? s.amount : ''), 'Withdrawal'], [s => (s.dc === 'Dr' ? s.amount : ''), 'Deposit']], stLines)}><Download size={11} /> Excel</Btn>}
              cols={[{ label: 'Date', render: s => fmtDate(s.date) }, { label: 'Description', wrap: true, render: s => s.desc }, { label: 'Ref', render: s => s.ref },
                { label: 'Withdrawal', right: true, render: s => (s.dc === 'Cr' ? inr(s.amount) : '') }, { label: 'Deposit', right: true, render: s => (s.dc === 'Dr' ? inr(s.amount) : '') }]} />
          )}
        </>
      )}
      <style>{'@media (max-width: 900px) { .acc-bill-foot { grid-template-columns: 1fr !important; } }'}</style>
    </Sheet>
  );
}
