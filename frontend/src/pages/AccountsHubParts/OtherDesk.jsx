// 04-Nov-2026: Accounts > Other Transactions, built like iCAFFE's screens in EagleView's look.
//   Cheque Book Management - books per bank, every leaf (issued from payment vouchers, cancelled, unused), next cheque no
//   Job Closing            - income / expense / profit of every job; close (no new voucher for that job) or re-open
//   TDS Payable Updation   - TDS deducted per month and section against challans paid, due dates, late days
//   Approval System        - vouchers waiting (with the rule that applies), approve / return, decided list, rules
//   Inter Branch           - Bank Transfer / Journal / Cash Transfer: raise, accept or return, branch balances
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Save, Pencil, Trash2, RotateCcw, Search, Check, X, Lock, Unlock, Download, RefreshCw, FileText, Ban, Undo2 } from 'lucide-react';
import { T, inr, fmtDate, todayIso, fyStart, api, postJson, lookup, Box, Sheet, Btn, ActionBar, Field, inputStyle, roStyle, mandStyle, Money, Badge, LedgerPicker, Grid, Empty } from './ui';
import { deskOf } from './CommandSearch';
import { useGlobalContext } from '../../GlobalContext';

const csv = (name, cols, rows) => {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [cols.map(c => esc(c[1])).join(',')].concat(rows.map(r => cols.map(c => esc(typeof c[0] === 'function' ? c[0](r) : r[c[0]])).join(',')));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' })); a.download = name + '.csv'; a.click();
};
function Strip({ items }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: '10px 16px', display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
      {items.filter(Boolean).map(([label, value, color]) => (
        <div key={label}>
          <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: color || '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        </div>
      ))}
    </div>
  );
}
const ymName = (ym) => new Date(ym + '-01T00:00:00Z').toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const accountsOf = (v) => String(v.accounts || '').split('|').filter(Boolean).map(s => { const [name, dc, amt] = s.split('~'); return { name, dc, amt: Number(amt) || 0 }; });
const AccountLines = ({ v }) => accountsOf(v).map((a, i) => (
  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11 }}>
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{a.dc === 'Cr' ? '  To ' : ''}{a.name}</span>
    <Money v={a.amt} side={a.dc} />
  </div>
));

// ================================================================== CHEQUE BOOK MANAGEMENT
const blankBook = { bankLedgerId: '', bookNo: '', fromNo: '', toNo: '', issuedOn: todayIso(), status: 'IN USE', isActive: 1 };
export function ChequeBooksScreen() {
  const nav = useNavigate();
  const [books, setBooks] = useState([]);
  const [banks, setBanks] = useState([]);
  const [form, setForm] = useState(blankBook);
  const [leaves, setLeaves] = useState([]);
  const [filter, setFilter] = useState('');
  const [cancelAt, setCancelAt] = useState(null);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const load = () => api('/api/accounts-hub/cheque-books').then(setBooks).catch(e => setMsg('Not loaded: ' + e.message));
  useEffect(() => { load(); lookup('ledgers-in?groups=' + encodeURIComponent('Bank Accounts,Bank OD A/c')).then(setBanks); }, []);
  const openBook = (b) => { setForm({ ...b }); setMsg(''); setCancelAt(null); api('/api/accounts-hub/cheque-books/' + b.id + '/leaves').then(setLeaves).catch(() => setLeaves([])); };
  const clear = () => { setForm(blankBook); setLeaves([]); setMsg(''); };
  const save = async () => {
    setMsg('');
    if (!form.bankLedgerId) return setMsg('Choose the bank');
    if (!form.fromNo || !form.toNo) return setMsg('Enter the first and last cheque no');
    if (Number(String(form.toNo).replace(/\D/g, '')) < Number(String(form.fromNo).replace(/\D/g, ''))) return setMsg('Last cheque no is before the first');
    const body = { bankLedgerId: form.bankLedgerId, bookNo: form.bookNo, fromNo: form.fromNo, toNo: form.toNo, issuedOn: form.issuedOn, status: form.status, isActive: 1 };
    try { if (form.id) await postJson('/api/accounts-hub/masters/chequebooks/' + form.id, body, 'PUT'); else await postJson('/api/accounts-hub/masters/chequebooks', body); setMsg(form.id ? 'Updated' : 'Saved'); await load(); if (!form.id) clear(); else openBook({ ...form }); }
    catch (e) { setMsg('Not saved: ' + e.message); }
  };
  const del = async () => {
    if (!form.id || !window.confirm('Delete this cheque book? Issued cheques stay on their vouchers.')) return;
    try { await api('/api/accounts-hub/masters/chequebooks/' + form.id, { method: 'DELETE' }); setMsg('Deleted'); load(); clear(); } catch (e) { setMsg('Not deleted: ' + e.message); }
  };
  const mark = async (no, action) => {
    try { await postJson(`/api/accounts-hub/cheque-books/${form.id}/leaves/${no}`, { action, reason }); setCancelAt(null); setReason(''); openBook(form); load(); }
    catch (e) { setMsg('Not changed: ' + e.message); }
  };
  const tot = books.reduce((t, b) => ({ total: t.total + b.total, issued: t.issued + b.issued, cancelled: t.cancelled + b.cancelled, unused: t.unused + b.unused }), { total: 0, issued: 0, cancelled: 0, unused: 0 });
  const shown = leaves.filter(l => !filter || l.status === filter);
  const tone = (s) => (s === 'ISSUED' ? 'ok' : s === 'CANCELLED' ? 'bad' : 'muted');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Strip items={[['Cheque books', books.length], ['Leaves', tot.total], ['Issued', tot.issued, T.cr], ['Cancelled', tot.cancelled, tot.cancelled ? T.dr : null], ['Unused', tot.unused, 'var(--primary-text, #0369a1)']]} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(270px, 340px) minmax(0, 1fr)', gap: 12, alignItems: 'start' }} className="acc-two">
        <div style={{ background: '#fff', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #eef2f7', fontWeight: 800, color: 'var(--primary-text, #1e3a8a)', fontSize: 11, textTransform: 'uppercase' }}>Cheque books</div>
          {books.map(b => { const on = String(form.id) === String(b.id); const pct = b.total ? Math.round((b.issued + b.cancelled) / b.total * 100) : 0; return (
            <div key={b.id} onClick={() => openBook(b)} style={{ padding: '9px 10px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: on ? T.headBg : 'transparent', borderLeft: `3px solid ${on ? 'var(--primary-color-end, #0369a1)' : 'transparent'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                <b style={{ fontSize: 11.5 }}>{b.bankName || 'Bank #' + b.bankLedgerId}</b>
                <Badge tone={b.status === 'IN USE' ? 'ok' : b.status === 'CANCELLED' ? 'bad' : 'muted'}>{b.status || 'IN USE'}</Badge>
              </div>
              <div style={{ fontSize: 10.5, color: T.muted, margin: '2px 0 5px' }}>{b.bookNo ? 'Book ' + b.bookNo + ', ' : ''}{b.fromNo} to {b.toNo}</div>
              <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', background: T.grad }} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.muted, marginTop: 3 }}><span>{b.issued} issued, {b.unused} left</span><span>Next <b style={{ color: '#0f172a' }}>{b.nextNo || '-'}</b></span></div>
            </div>); })}
          {!books.length && <div style={{ padding: 20, textAlign: 'center', fontSize: 11.5, color: T.muted }}>No cheque books yet</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <Box title={form.id ? 'Cheque book - ' + (form.bankName || '') : 'New cheque book'} style={{ background: '#fff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) repeat(5, minmax(0, 1fr))', gap: 10 }}>
              <Field label="Bank" required><LedgerPicker id="cbbank" list={banks} value={form.bankLedgerId} onChange={v => setForm({ ...form, bankLedgerId: v })} placeholder="Bank ledger" mandatory /></Field>
              <Field label="Book No"><input style={inputStyle} value={form.bookNo || ''} onChange={e => setForm({ ...form, bookNo: e.target.value })} /></Field>
              <Field label="From Cheque" required><input style={form.fromNo ? inputStyle : mandStyle} value={form.fromNo || ''} onChange={e => setForm({ ...form, fromNo: e.target.value })} placeholder="000101" /></Field>
              <Field label="To Cheque" required><input style={form.toNo ? inputStyle : mandStyle} value={form.toNo || ''} onChange={e => setForm({ ...form, toNo: e.target.value })} placeholder="000150" /></Field>
              <Field label="Received On"><input type="date" style={inputStyle} value={form.issuedOn ? String(form.issuedOn).slice(0, 10) : ''} onChange={e => setForm({ ...form, issuedOn: e.target.value })} /></Field>
              <Field label="Status"><select style={inputStyle} value={form.status || 'IN USE'} onChange={e => setForm({ ...form, status: e.target.value })}><option>IN USE</option><option>FINISHED</option><option>CANCELLED</option></select></Field>
            </div>
          </Box>
          <ActionBar note={msg}>
            <Btn kind="save" onClick={save} disabled={!!form.id}><Save size={13} /> Save</Btn>
            <Btn kind="save" onClick={save} disabled={!form.id}><Pencil size={13} /> Modify</Btn>
            <Btn kind="danger" onClick={del} disabled={!form.id}><Trash2 size={13} /> Delete</Btn>
            <Btn kind="clear" onClick={clear}><RotateCcw size={13} /> Clear</Btn>
          </ActionBar>
          {form.id && (
            <Grid title={'Cheque leaves (' + shown.length + ')'} maxHeight="calc(100vh - 470px)" rows={shown} rowKey={l => l.chequeNo}
              right={<>
                {['', 'UNUSED', 'ISSUED', 'CANCELLED'].map(s => <span key={s} onClick={() => setFilter(s)} style={{ cursor: 'pointer', fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: filter === s ? T.grad : 'transparent', color: filter === s ? '#fff' : T.head }}>{s ? s[0] + s.slice(1).toLowerCase() : 'All'}</span>)}
                <Btn small kind="ghost" onClick={() => csv('Cheques_' + (form.bookNo || form.id), [['chequeNo', 'Cheque No'], ['status', 'Status'], ['date', 'Date'], ['voucherNumber', 'Voucher'], ['party', 'Party'], ['amount', 'Amount'], ['reason', 'Reason']], shown)}><Download size={11} /> Excel</Btn>
              </>}
              cols={[
                { label: 'Cheque No', render: l => <b>{l.chequeNo}</b> },
                { label: 'Status', render: l => <Badge tone={tone(l.status)}>{l.status}</Badge> },
                { label: 'Date', render: l => fmtDate(l.date) },
                { label: 'Voucher', render: l => (l.voucherId ? <span onClick={() => nav('/accounts-hub?item=payment&voucher=' + l.voucherId)} style={{ color: T.head, cursor: 'pointer', fontWeight: 700 }}>{l.voucherNumber}</span> : '') },
                { label: 'Paid to', wrap: true, render: l => l.party || <span style={{ color: T.muted }}>{l.reason}</span> },
                { label: 'Amount', right: true, render: l => (l.amount != null ? <Money v={l.amount} /> : '') },
                { label: '', render: l => (l.status === 'UNUSED' ? (cancelAt === l.chequeNo
                  ? <span style={{ display: 'inline-flex', gap: 4 }}><input autoFocus value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason" style={{ ...inputStyle, height: 24, width: 150 }} /><Btn small kind="danger" onClick={() => mark(l.chequeNo, 'cancel')}>Cancel</Btn><Btn small kind="ghost" onClick={() => setCancelAt(null)}><X size={11} /></Btn></span>
                  : <Btn small kind="ghost" onClick={() => { setCancelAt(l.chequeNo); setReason(''); }}><Ban size={11} /> Cancel leaf</Btn>)
                  : l.status === 'CANCELLED' ? <Btn small kind="ghost" onClick={() => mark(l.chequeNo, 'restore')}><Undo2 size={11} /> Restore</Btn> : null) },
              ]} />
          )}
          {!form.id && <Empty title="Pick a cheque book on the left to see every leaf">Issued cheques are read from payment vouchers of that bank whose cheque no is in the book.</Empty>}
        </div>
      </div>
      <style>{`@media (max-width: 900px) { .acc-two { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

// ================================================================== JOB CLOSING
export function JobClosingScreen() {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('OPEN');
  const [flag, setFlag] = useState('');
  const [picked, setPicked] = useState({});
  const [remarks, setRemarks] = useState('');
  const [msg, setMsg] = useState('');
  const load = () => { setBusy(true); api('/api/accounts-hub/jobs').then(setRows).catch(e => setMsg('Not loaded: ' + e.message)).finally(() => setBusy(false)); };
  useEffect(() => { load(); }, []);
  const shown = rows.filter(r => (!status || r.status === status) && (!q || r.jobNo.includes(q.toUpperCase().trim()))
    && (!flag || (flag === 'loss' && r.profit < 0) || (flag === 'unbilled' && !r.billed) || (flag === 'nocost' && !r.hasCost)));
  const sel = shown.filter(r => picked[r.jobNo]);
  const act = async (list, action) => {
    if (!list.length) return;
    if (action === 'close' && !window.confirm('Close ' + list.length + ' job(s)? No new voucher can be posted for a closed job.')) return;
    try { for (const r of list) await postJson('/api/accounts-hub/jobs/close', { jobNo: r.jobNo, remarks, action }); setPicked({}); setRemarks(''); setMsg((action === 'close' ? 'Closed ' : 'Re-opened ') + list.length + ' job(s)'); load(); }
    catch (e) { setMsg('Not changed: ' + e.message); }
  };
  const open = rows.filter(r => r.status === 'OPEN'); const closed = rows.length - open.length;
  const profit = rows.reduce((t, r) => t + r.profit, 0);
  const allOn = shown.length > 0 && shown.every(r => picked[r.jobNo]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Strip items={[['Jobs', rows.length], ['Open', open.length, 'var(--primary-text, #0369a1)'], ['Closed', closed], ['Profit on all jobs', '₹ ' + inr(profit, 0), profit < 0 ? T.dr : T.cr],
        ['Loss-making', rows.filter(r => r.profit < 0).length, T.dr], ['Open and not billed', open.filter(r => !r.billed).length, '#b45309']]} />
      <ActionBar note={msg}>
        <div style={{ position: 'relative' }}><Search size={13} style={{ position: 'absolute', left: 8, top: 8, color: '#94a3b8' }} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Job no" style={{ ...inputStyle, width: 170, paddingLeft: 26 }} /></div>
        <select style={{ ...inputStyle, width: 120 }} value={status} onChange={e => setStatus(e.target.value)}><option value="">All jobs</option><option value="OPEN">Open</option><option value="CLOSED">Closed</option></select>
        <select style={{ ...inputStyle, width: 160 }} value={flag} onChange={e => setFlag(e.target.value)}><option value="">Any result</option><option value="loss">Loss-making</option><option value="unbilled">Not billed yet</option><option value="nocost">No cost booked</option></select>
        <Btn kind="primary" onClick={load} disabled={busy}><RefreshCw size={13} /> {busy ? 'Loading' : 'Refresh'}</Btn>
        <span style={{ width: 1, height: 22, background: T.headBorder, margin: '0 4px' }} />
        <input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Closing remarks" style={{ ...inputStyle, width: 200 }} />
        <Btn kind="danger" onClick={() => act(sel.filter(r => r.status === 'OPEN'), 'close')} disabled={!sel.some(r => r.status === 'OPEN')}><Lock size={13} /> Close selected ({sel.filter(r => r.status === 'OPEN').length})</Btn>
        <Btn kind="clear" onClick={() => act(sel.filter(r => r.status === 'CLOSED'), 'reopen')} disabled={!sel.some(r => r.status === 'CLOSED')}><Unlock size={13} /> Re-open</Btn>
        <Btn kind="plain" onClick={() => csv('Jobs', [['jobNo', 'Job No'], ['first', 'First Entry'], ['last', 'Last Entry'], ['vouchers', 'Vouchers'], ['income', 'Income'], ['expense', 'Expense'], ['profit', 'Profit'], ['margin', 'Margin %'], ['status', 'Status'], ['closedOn', 'Closed On'], ['remarks', 'Remarks']], shown)} disabled={!shown.length}><Download size={13} /> Excel</Btn>
      </ActionBar>
      <Grid title={'Jobs (' + shown.length + ')'} maxHeight="calc(100vh - 360px)" rows={shown} rowKey={r => r.jobNo}
        empty={busy ? 'Loading' : rows.length ? 'No job matches the filters' : 'No vouchers with a job no yet'}
        foot={['', 'Total', '', '', '', <Money v={shown.reduce((t, r) => t + r.income, 0)} strong />, <Money v={shown.reduce((t, r) => t + r.expense, 0)} strong />, <Money v={shown.reduce((t, r) => t + r.profit, 0)} strong />]}
        cols={[
          { label: <input type="checkbox" checked={allOn} onChange={e => setPicked(e.target.checked ? Object.fromEntries(shown.map(r => [r.jobNo, 1])) : {})} />, w: 30, render: r => <input type="checkbox" checked={!!picked[r.jobNo]} onChange={e => setPicked(p => ({ ...p, [r.jobNo]: e.target.checked ? 1 : 0 }))} /> },
          { label: 'Job No', render: r => <b>{r.jobNo}</b> },
          { label: 'First / Last entry', render: r => fmtDate(r.first) + ' - ' + fmtDate(r.last) },
          { label: 'Vouchers', right: true, render: r => r.vouchers },
          { label: 'Billed / Cost', render: r => <span style={{ display: 'inline-flex', gap: 4 }}><Badge tone={r.billed ? 'ok' : 'warn'}>{r.billed ? 'Billed' : 'Not billed'}</Badge>{!r.hasCost && <Badge tone="muted">No cost</Badge>}</span> },
          { label: 'Income', right: true, render: r => <Money v={r.income} /> },
          { label: 'Expense', right: true, render: r => <Money v={r.expense} /> },
          { label: 'Profit', right: true, render: r => <span style={{ fontWeight: 800, color: r.profit < 0 ? T.dr : T.cr }}>{inr(r.profit)}</span> },
          { label: 'Margin', right: true, render: r => (r.margin == null ? '-' : r.margin + '%') },
          { label: 'Status', render: r => (r.status === 'CLOSED' ? <span title={(r.remarks || '') + (r.closedBy ? ' - ' + r.closedBy : '')}><Badge tone="bad">Closed {fmtDate(r.closedOn)}</Badge></span> : <Badge tone="ok">Open</Badge>) },
          { label: '', render: r => <span style={{ display: 'inline-flex', gap: 4 }}>
            {r.status === 'OPEN' ? <Btn small kind="ghost" onClick={() => act([r], 'close')}><Lock size={11} /> Close</Btn> : <Btn small kind="ghost" onClick={() => act([r], 'reopen')}><Unlock size={11} /> Re-open</Btn>}
            <Btn small kind="ghost" onClick={() => nav('/accounts-hub?item=expsheet&jobNo=' + encodeURIComponent(r.jobNo))}><FileText size={11} /></Btn></span> },
        ]} />
    </div>
  );
}

// ================================================================== TDS PAYABLE UPDATION
export function TdsPayableScreen() {
  const nav = useNavigate();
  const [years, setYears] = useState([]);
  const [fyId, setFyId] = useState('');
  const [d, setD] = useState(null);
  const [sel, setSel] = useState(null);
  const [lines, setLines] = useState([]);
  const [ch, setCh] = useState({ challanNo: '', bsrCode: '', paidOn: todayIso(), amount: '', interest: '', remarks: '' });
  const [st, setSt] = useState('');
  const [msg, setMsg] = useState('');
  const load = () => api('/api/accounts-hub/tds-payable' + (fyId ? '?fyId=' + fyId : '')).then(r => { setD(r); if (sel) { const s = r.rows.find(x => x.month === sel.month && x.section === sel.section); setSel(s || null); } }).catch(e => setMsg('Not loaded: ' + e.message));
  useEffect(() => { lookup('years').then(setYears); }, []);
  useEffect(() => { load(); }, [fyId]);
  const pick = (r) => { setSel(r); setMsg(''); setCh({ challanNo: '', bsrCode: '', paidOn: todayIso(), amount: r.balance > 0 ? String(r.balance) : '', interest: r.status === 'OVERDUE' ? String(Math.ceil(r.balance * 0.015 * Math.max(1, Math.ceil(r.daysLate / 30)))) : '', remarks: '' });
    api(`/api/accounts-hub/tds-payable/detail?month=${r.month}&section=${encodeURIComponent(r.section)}`).then(setLines).catch(() => setLines([])); };
  const addChallan = async () => {
    setMsg('');
    try { await postJson('/api/accounts-hub/tds-challans', { ...ch, month: sel.month, section: sel.section }); setMsg('Saved challan ' + ch.challanNo); load(); setCh({ ...ch, challanNo: '', amount: '', interest: '' }); }
    catch (e) { setMsg('Not saved: ' + e.message); }
  };
  const delChallan = async (c) => { if (!window.confirm('Delete challan ' + c.challanNo + '?')) return; try { await api('/api/accounts-hub/tds-challans/' + c.id, { method: 'DELETE' }); setMsg('Deleted challan'); load(); } catch (e) { setMsg('Not deleted: ' + e.message); } };
  if (!d) return <Box style={{ background: '#fff' }}><span style={{ color: T.muted }}>{msg || 'Loading'}</span></Box>;
  const rows = d.rows.filter(r => !st || r.status === st);
  const tone = (s) => (s === 'PAID' ? 'ok' : s === 'OVERDUE' ? 'bad' : 'warn');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Strip items={[['Financial year', d.fy.name], ['TDS deducted', '₹ ' + inr(d.totals.deducted, 0)], ['Deposited', '₹ ' + inr(d.totals.paid, 0), T.cr], ['To deposit', '₹ ' + inr(d.totals.balance, 0), d.totals.balance ? T.dr : null], ['Overdue months', d.totals.overdue, d.totals.overdue ? T.dr : null]]} />
      <ActionBar note={!sel ? msg : ''}>
        <select style={{ ...inputStyle, width: 150 }} value={fyId} onChange={e => { setFyId(e.target.value); setSel(null); }}><option value="">Current year</option>{years.map(y => <option key={y.id} value={y.id}>FY {y.name || y.code}</option>)}</select>
        <select style={{ ...inputStyle, width: 140 }} value={st} onChange={e => setSt(e.target.value)}><option value="">All</option><option value="DUE">Due</option><option value="OVERDUE">Overdue</option><option value="PAID">Paid</option></select>
        <Btn kind="primary" onClick={load}><RefreshCw size={13} /> Refresh</Btn>
        <Btn kind="plain" onClick={() => csv('TDS_Payable_' + d.fy.name, [[r => ymName(r.month), 'Month'], ['section', 'Section'], ['entries', 'Entries'], ['net', 'Deducted'], ['paid', 'Deposited'], ['balance', 'Balance'], ['dueDate', 'Due Date'], ['status', 'Status']], rows)} disabled={!rows.length}><Download size={13} /> Excel</Btn>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.muted }}>Due by the 7th of next month (30 April for March). Interest 1.5% a month when late.</span>
      </ActionBar>
      <Grid title="TDS by month and section" maxHeight={sel ? 260 : 'calc(100vh - 360px)'} rows={rows} rowKey={r => r.month + r.section} activeKey={sel ? sel.month + sel.section : undefined} onRow={pick}
        empty="No TDS deducted in this year. TDS is read from ledgers with TDS in the name under Duties & Taxes."
        foot={['Total', '', '', '', <Money v={rows.reduce((t, r) => t + r.net, 0)} strong />, <Money v={rows.reduce((t, r) => t + r.paid, 0)} strong />, <Money v={rows.reduce((t, r) => t + Math.max(0, r.balance), 0)} strong />]}
        cols={[
          { label: 'Month', render: r => <b>{ymName(r.month)}</b> }, { label: 'Section', render: r => r.section }, { label: 'Entries', right: true, render: r => r.entries }, { label: 'Parties', right: true, render: r => r.parties },
          { label: 'Deducted', right: true, render: r => <Money v={r.net} /> }, { label: 'Deposited', right: true, render: r => <Money v={r.paid} side={r.paid ? 'Cr' : null} /> },
          { label: 'Balance', right: true, render: r => <span style={{ fontWeight: 800, color: r.balance > 0.5 ? T.dr : T.muted }}>{inr(Math.max(0, r.balance))}</span> },
          { label: 'Due date', render: r => fmtDate(r.dueDate) },
          { label: 'Status', render: r => <Badge tone={tone(r.status)}>{r.status === 'OVERDUE' ? 'Overdue ' + r.daysLate + 'd' : r.status === 'PAID' ? 'Paid' : 'Due'}</Badge> },
          { label: 'Challans', right: true, render: r => r.challans.length || '-' },
        ]} />
      {sel && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 10, alignItems: 'start' }} className="acc-two">
          <Grid title={'Deductions - ' + sel.section + ', ' + ymName(sel.month) + ' (' + lines.length + ')'} maxHeight="calc(100vh - 560px)" rows={lines} rowKey={(l, i) => i}
            onRow={l => nav('/accounts-hub?item=' + deskOf(l.typeName === 'Purchase' ? 'Purchase' : l.typeName) + '&voucher=' + l.voucherId)}
            cols={[{ label: 'Date', render: l => fmtDate(l.date) }, { label: 'Voucher', render: l => l.typeName + ' ' + l.voucherNumber }, { label: 'Party', wrap: true, render: l => l.party || '' },
              { label: 'Job', render: l => l.jobNo || '' }, { label: 'TDS', right: true, render: l => <Money v={l.amount} side={l.dc} /> }]} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Box title={'Deposit challan - balance ₹ ' + inr(Math.max(0, sel.balance))} style={{ background: '#fff' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                <Field label="Challan No (CIN)" required><input style={ch.challanNo ? inputStyle : mandStyle} value={ch.challanNo} onChange={e => setCh({ ...ch, challanNo: e.target.value })} /></Field>
                <Field label="BSR Code"><input style={inputStyle} value={ch.bsrCode} onChange={e => setCh({ ...ch, bsrCode: e.target.value })} maxLength={7} /></Field>
                <Field label="Paid On" required><input type="date" style={inputStyle} value={ch.paidOn} onChange={e => setCh({ ...ch, paidOn: e.target.value })} /></Field>
                <Field label="Tax Amount" required><input style={{ ...inputStyle, textAlign: 'right' }} value={ch.amount} onChange={e => setCh({ ...ch, amount: e.target.value })} inputMode="decimal" /></Field>
                <Field label="Interest" hint={sel.status === 'OVERDUE' ? 'Worked out at 1.5% a month' : ' '}><input style={{ ...inputStyle, textAlign: 'right' }} value={ch.interest} onChange={e => setCh({ ...ch, interest: e.target.value })} inputMode="decimal" /></Field>
                <Field label="Remarks"><input style={inputStyle} value={ch.remarks} onChange={e => setCh({ ...ch, remarks: e.target.value })} /></Field>
              </div>
            </Box>
            <ActionBar note={msg}><Btn kind="save" onClick={addChallan}><Save size={13} /> Save challan</Btn></ActionBar>
            {sel.challans.length > 0 && (
              <Grid title="Challans deposited" maxHeight={180} rows={sel.challans} rowKey={c => c.id}
                cols={[{ label: 'Challan', render: c => <b>{c.challanNo}</b> }, { label: 'BSR', render: c => c.bsrCode || '' }, { label: 'Paid on', render: c => fmtDate(c.paidOn) },
                  { label: 'Tax', right: true, render: c => inr(c.amount) }, { label: 'Interest', right: true, render: c => (Number(c.interest) ? inr(c.interest) : '-') },
                  { label: '', render: c => <span onClick={() => delChallan(c)} style={{ cursor: 'pointer', color: T.dr }}><Trash2 size={13} /></span> }]} />
            )}
          </div>
        </div>
      )}
      <style>{`@media (max-width: 900px) { .acc-two { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

// ================================================================== APPROVAL SYSTEM
export function ApprovalsScreen({ Rules, startTab = 'pending' }) {
  const nav = useNavigate();
  const [tab, setTab] = useState(startTab);
  const [d, setD] = useState({ rules: [], rows: [] });
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState({});
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [returning, setReturning] = useState(null);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const load = () => { if (tab === 'rules') return; setBusy(true); api('/api/accounts-hub/approvals?state=' + (tab === 'pending' ? 'pending' : 'done')).then(setD).catch(e => setMsg('Not loaded: ' + e.message)).finally(() => setBusy(false)); };
  useEffect(() => { setPicked({}); load(); }, [tab]);
  const types = [...new Set(d.rows.map(r => r.typeName))];
  const shown = d.rows.filter(r => (!type || r.typeName === type) && (!q || (r.voucherNumber + ' ' + (r.accounts || '') + ' ' + (r.narration || '') + ' ' + (r.jobNo || '')).toLowerCase().includes(q.toLowerCase())));
  const sel = shown.filter(r => picked[r.id]);
  const decide = async (list, status) => {
    if (!list.length) return;
    if (status === 'Returned' && !reason.trim()) return setMsg('Enter why it is returned');
    try { for (const v of list) await postJson('/api/vouchers/update-status/' + v.id, { status, rejectionReason: status === 'Returned' ? reason.trim() : undefined });
      setMsg((status === 'Approved' ? 'Approved ' : 'Returned ') + list.length + ' voucher(s)'); setPicked({}); setReturning(null); setReason(''); load(); }
    catch (e) { setMsg('Not changed: ' + e.message); }
  };
  const total = shown.reduce((t, r) => t + Number(r.totalAmount || 0), 0);
  const allOn = shown.length > 0 && shown.every(r => picked[r.id]);
  return (
    <Sheet tabs={[{ id: 'pending', label: 'Waiting for approval' }, { id: 'done', label: 'Approved / returned' }, { id: 'rules', label: 'Approval rules' }]} tab={tab} onTab={setTab}>
      {tab === 'rules' && Rules}
      {tab !== 'rules' && (
        <>
          <ActionBar note={msg}>
            <div style={{ position: 'relative' }}><Search size={13} style={{ position: 'absolute', left: 8, top: 8, color: '#94a3b8' }} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Voucher, party, job, narration" style={{ ...inputStyle, width: 230, paddingLeft: 26 }} /></div>
            <select style={{ ...inputStyle, width: 150 }} value={type} onChange={e => setType(e.target.value)}><option value="">All voucher types</option>{types.map(t => <option key={t}>{t}</option>)}</select>
            <Btn kind="primary" onClick={load} disabled={busy}><RefreshCw size={13} /> Refresh</Btn>
            {tab === 'pending' && <>
              <span style={{ width: 1, height: 22, background: T.headBorder, margin: '0 4px' }} />
              <Btn kind="save" onClick={() => decide(sel, 'Approved')} disabled={!sel.length}><Check size={13} /> Approve selected ({sel.length})</Btn>
            </>}
            <span style={{ marginLeft: 'auto', fontSize: 11.5, color: T.inkSoft, fontWeight: 700 }}>{shown.length} vouchers, ₹ {inr(total, 0)}</span>
          </ActionBar>
          {tab === 'pending' && !d.rules.length && <div style={{ fontSize: 11.5, color: T.muted }}>No approval rules yet - every voucher waits here until someone approves it. Add rules in the Approval rules tab to name the approver by voucher type and amount.</div>}
          <Grid title={tab === 'pending' ? 'Vouchers waiting' : 'Recent decisions'} maxHeight="calc(100vh - 330px)" rows={shown} rowKey={r => r.id}
            empty={busy ? 'Loading' : tab === 'pending' ? 'Nothing is waiting for approval' : 'No decisions yet'}
            cols={[
              ...(tab === 'pending' ? [{ label: <input type="checkbox" checked={allOn} onChange={e => setPicked(e.target.checked ? Object.fromEntries(shown.map(r => [r.id, 1])) : {})} />, w: 30, render: r => <input type="checkbox" checked={!!picked[r.id]} onChange={e => setPicked(p => ({ ...p, [r.id]: e.target.checked ? 1 : 0 }))} /> }] : []),
              { label: 'Date', render: r => fmtDate(r.date) },
              { label: 'Voucher', render: r => <span onClick={() => nav('/accounts-hub?item=' + deskOf(r.baseType) + '&voucher=' + r.id)} style={{ cursor: 'pointer' }}><b style={{ color: T.head }}>{r.voucherNumber}</b><div style={{ fontSize: 10, color: T.muted }}>{r.typeName}</div></span> },
              { label: 'Accounts', w: '34%', wrap: true, render: r => <AccountLines v={r} /> },
              { label: 'Amount', right: true, render: r => <b>{inr(r.totalAmount)}</b> },
              { label: 'Entered by', render: r => r.createdByName || '' },
              ...(tab === 'pending' ? [
                { label: 'Waiting', right: true, render: r => <span style={{ color: r.age > 3 ? T.dr : T.muted }}>{r.age}d</span> },
                { label: 'Approver (rule)', render: r => r.approvers || <span style={{ color: T.muted }}>Any</span> },
                { label: '', render: r => (returning === r.id
                  ? <span style={{ display: 'inline-flex', gap: 4 }}><input autoFocus value={reason} onChange={e => setReason(e.target.value)} placeholder="Why returned" style={{ ...inputStyle, height: 24, width: 150 }} /><Btn small kind="danger" onClick={() => decide([r], 'Returned')}>Return</Btn><Btn small kind="ghost" onClick={() => setReturning(null)}><X size={11} /></Btn></span>
                  : <span style={{ display: 'inline-flex', gap: 4 }}><Btn small kind="save" onClick={() => decide([r], 'Approved')}><Check size={11} /> Approve</Btn><Btn small kind="ghost" onClick={() => { setReturning(r.id); setReason(''); }}><Undo2 size={11} /> Return</Btn></span>) },
              ] : [
                { label: 'Decision', render: r => <Badge tone={/approv/i.test(r.status) ? 'ok' : 'bad'}>{r.status}</Badge> },
                { label: 'Reason', wrap: true, render: r => r.rejectionReason || '' },
                { label: 'On', render: r => fmtDate(r.updatedAt) },
              ]),
            ]} />
        </>
      )}
    </Sheet>
  );
}

// ================================================================== INTER BRANCH (iCAFFE: Bank Transfer / Journal / Cash Transfer)
// The sending branch raises; its voucher posts at once against "BRANCH A/C - <to branch>". The receiving branch accepts
// (picks the bank / cash it came into, or checks the journal entries) and its voucher posts against "BRANCH A/C - <from>",
// or returns it with a reason - then the sending voucher is reversed. Backend: /api/accounts-hub/ib.
const IB_TYPES = [['bank', 'Bank Transfer'], ['journal', 'Journal'], ['cash', 'Cash Transfer']];
const ibTone = (s) => (s === 'Accepted' ? 'ok' : s === 'Returned' ? 'bad' : 'warn');
export function InterBranchScreen({ startTab = 'list' }) {
  const g = useGlobalContext() || {};
  const myBranch = (g.activeBranch && !g.activeBranch.isAll && (g.activeBranch.branchCode || g.activeBranch.branch_code)) || ''; // 'All branches' = pick one on the form
  const [tab, setTab] = useState(startTab === 'raise' ? 'raise' : 'list');
  const [branches, setBranches] = useState([]);
  useEffect(() => { api('/api/accounts-hub/ib/branches').then(setBranches).catch(() => setBranches([])); }, []);
  const [listKey, setListKey] = useState(1);
  return (
    <Sheet tabs={[{ id: 'list', label: 'Transfers' }, { id: 'raise', label: 'Raise transfer' }, { id: 'bal', label: 'Branch balances' }]} tab={tab} onTab={setTab}>
      {branches.length > 0 && branches.length < 2 && (
        <div style={{ fontSize: 11.5, fontWeight: 700, color: T.amber, background: T.amberBg, border: '1px solid #fde68a', padding: '6px 10px', borderRadius: 6 }}>
          Only one branch ({branches.map(b => b.code).join(', ')}) is set up. Add the other branches in Settings, Branch Master, to transfer between them.
        </div>
      )}
      {tab === 'raise' && <IbRaise branches={branches} myBranch={myBranch} onDone={() => { setListKey(k => k + 1); setTab('list'); }} />}
      {tab === 'list' && <IbList key={listKey} myBranch={myBranch} />}
      {tab === 'bal' && <IbBalances />}
    </Sheet>
  );
}

function IbRaise({ branches, myBranch, onDone }) {
  const [f, setF] = useState({ type: 'bank', fromBranch: myBranch, toBranch: '', date: todayIso(), amount: '', fromLedgerId: '', refNo: '', narration: '' });
  const [look, setLook] = useState({ all: [], banks: [], cash: [] });
  const [lines, setLines] = useState([]);
  const [cur, setCur] = useState({ ledgerId: '', dc: 'Dr', amount: '', remarks: '' });
  const [msg, setMsg] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { if (myBranch && !f.fromBranch) setF(x => ({ ...x, fromBranch: myBranch })); }, [myBranch]);
  useEffect(() => {
    Promise.all([lookup('ledgers'), lookup('ledgers-in?groups=Bank Accounts,Bank OD A/c'), lookup('ledgers-in?groups=Cash-in-Hand')])
      .then(([all, banks, cash]) => setLook({ all: all.filter(l => !/^BRANCH A\/C - /i.test(l.name)), banks, cash }));
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const jv = f.type === 'journal';
  const fromList = f.type === 'bank' ? look.banks : f.type === 'cash' ? look.cash : look.all;
  const net = lines.reduce((s, l) => s + (l.dc === 'Dr' ? 1 : -1) * Number(l.amount || 0), 0);
  const amount = jv ? Math.abs(net) : Number(f.amount || 0);
  const nameOf = (id) => (look.all.find(l => String(l.id) === String(id)) || {}).name || '';
  const add = () => {
    setMsg('');
    if (!cur.ledgerId) return setMsg('Choose the account for the other branch');
    if (!(Number(cur.amount) > 0)) return setMsg('Enter the amount');
    if (String(cur.ledgerId) === String(f.fromLedgerId)) return setMsg('Your own account cannot be in the other branch\'s entries');
    setLines(x => [...x, { ...cur, amount: Number(cur.amount) }]); setCur({ ledgerId: '', dc: cur.dc, amount: '', remarks: '' });
  };
  const toLabel = f.toBranch ? 'BRANCH A/C - ' + f.toBranch : 'Branch A/c of the other branch';
  const preview = amount > 0 && f.fromLedgerId ? [
    { ledgerName: toLabel, dc: jv && net < 0 ? 'Cr' : 'Dr', amount },
    { ledgerName: nameOf(f.fromLedgerId), dc: jv && net < 0 ? 'Dr' : 'Cr', amount },
  ] : [];
  const save = async () => {
    setMsg('');
    if (!f.fromBranch || !f.toBranch) return setMsg('Choose both branches');
    if (f.fromBranch === f.toBranch) return setMsg('From and to branch cannot be the same');
    if (!f.fromLedgerId) return setMsg(jv ? 'Choose the account of your branch' : 'Choose the ' + (f.type === 'cash' ? 'cash' : 'bank') + ' account it goes from');
    if (jv && !lines.length) return setMsg(cur.ledgerId ? 'Click Add to put the entry in the grid' : 'Add the entries the other branch should book');
    if (!(amount > 0)) return setMsg('Enter the amount');
    setSaving(true);
    try {
      const r = await postJson('/api/accounts-hub/ib', { ...f, amount, toLines: jv ? lines : [] });
      setMsg('Saved ' + r.ibNo + ' (voucher ' + r.voucherNumber + ') - waiting for ' + f.toBranch + ' to accept');
      setTimeout(onDone, 900);
    } catch (e) { setMsg('Not saved: ' + e.message); }
    setSaving(false);
  };
  const g6 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, alignItems: 'end' };
  const seg = (on) => ({ padding: '5px 14px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', border: 'none', background: on ? T.grad : 'transparent', color: on ? '#fff' : T.head });
  const brOpts = branches.map(b => <option key={b.code} value={b.code}>{b.code} - {b.name}</option>);
  return (
    <>
      <div style={{ display: 'inline-flex', border: `1px solid ${T.headBorder}`, borderRadius: 6, overflow: 'hidden', background: '#fff', alignSelf: 'flex-start' }}>
        {IB_TYPES.map(([k, l]) => <button key={k} type="button" style={seg(f.type === k)} onClick={() => { setF({ ...f, type: k, fromLedgerId: '' }); setLines([]); setMsg(''); }}>{l}</button>)}
      </div>
      <Box>
        <div style={g6}>
          <Field label="From Branch" required><select style={f.fromBranch ? inputStyle : mandStyle} value={f.fromBranch} onChange={set('fromBranch')}><option value="">Select</option>{brOpts}</select></Field>
          <Field label="To Branch" required><select style={f.toBranch ? inputStyle : mandStyle} value={f.toBranch} onChange={set('toBranch')}><option value="">Select</option>{branches.filter(b => b.code !== f.fromBranch).map(b => <option key={b.code} value={b.code}>{b.code} - {b.name}</option>)}</select></Field>
          <Field label="Date" required><input type="date" style={inputStyle} value={f.date} onChange={set('date')} /></Field>
          <Field label={jv ? 'Your Account (other side)' : f.type === 'cash' ? 'From Cash' : 'From Bank'} required span={2}>
            <LedgerPicker id="ibfrom" list={fromList.length ? fromList : look.all} value={f.fromLedgerId} onChange={x => setF({ ...f, fromLedgerId: x })} placeholder={jv ? 'Account in your branch' : f.type === 'cash' ? 'Cash in hand' : 'Bank account'} mandatory />
          </Field>
          {!jv && <Field label="Amount" required><input style={{ ...(Number(f.amount) > 0 ? inputStyle : mandStyle), textAlign: 'right' }} value={f.amount} onChange={set('amount')} inputMode="decimal" /></Field>}
          {jv && <Field label="Amount"><input readOnly style={{ ...roStyle, textAlign: 'right', fontWeight: 800 }} value={inr(amount)} /></Field>}
          <Field label={f.type === 'bank' ? 'UTR / Chq No' : 'Ref No'}><input style={inputStyle} value={f.refNo} onChange={set('refNo')} /></Field>
          <Field label="Narration" span={2}><input style={inputStyle} value={f.narration} onChange={set('narration')} placeholder="Leave blank to write it from the type and branch" /></Field>
        </div>
      </Box>
      {jv && (
        <>
          <Box title={'Entries ' + (f.toBranch || 'the other branch') + ' should book'}>
            <div style={g6}>
              <Field label="Account" required span={2}><LedgerPicker id="ibto" list={look.all} value={cur.ledgerId} onChange={x => setCur({ ...cur, ledgerId: x })} placeholder="Expense, income, party ..." mandatory /></Field>
              <Field label="Dr / Cr"><select style={inputStyle} value={cur.dc} onChange={e => setCur({ ...cur, dc: e.target.value })}><option>Dr</option><option>Cr</option></select></Field>
              <Field label="Amount" required><input style={{ ...inputStyle, textAlign: 'right' }} value={cur.amount} onChange={e => setCur({ ...cur, amount: e.target.value })} inputMode="decimal" onKeyDown={e => e.key === 'Enter' && add()} /></Field>
              <Field label="Remarks" span={2}><input style={inputStyle} value={cur.remarks} onChange={e => setCur({ ...cur, remarks: e.target.value })} /></Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Btn kind="primary" onClick={add}><Plus size={13} /> Add</Btn></div>
            </div>
          </Box>
          <Grid title="Other branch entries" maxHeight={220} rows={lines} empty="Add what the other branch should book - e.g. their expense, paid by you"
            cols={[{ label: 'Delete', w: 48, render: (l, i) => <span onClick={() => setLines(x => x.filter((_, j) => j !== i))} style={{ cursor: 'pointer', color: T.dr }}><Trash2 size={13} /></span> },
              { label: 'Account', wrap: true, render: l => <b>{nameOf(l.ledgerId)}</b> }, { label: 'Debit', right: true, render: l => (l.dc === 'Dr' ? <Money v={l.amount} side="Dr" /> : '') },
              { label: 'Credit', right: true, render: l => (l.dc === 'Cr' ? <Money v={l.amount} side="Cr" /> : '') }, { label: 'Remarks', wrap: true, render: l => l.remarks }]}
            foot={['', 'BRANCH A/C - ' + (f.fromBranch || '?') + ' (their side)', net < 0 ? <Money v={-net} side="Dr" strong /> : '', net > 0 ? <Money v={net} side="Cr" strong /> : '', '']} />
        </>
      )}
      {preview.length > 0 && <Grid title={'Your branch (' + (f.fromBranch || '?') + ') will post now'} maxHeight={140} rows={preview}
        cols={[{ label: 'Account', render: p => <b>{p.ledgerName}</b> }, { label: 'Debit', right: true, render: p => (p.dc === 'Dr' ? <Money v={p.amount} side="Dr" /> : '') }, { label: 'Credit', right: true, render: p => (p.dc === 'Cr' ? <Money v={p.amount} side="Cr" /> : '') }]} />}
      <ActionBar note={msg}>
        <Btn kind="save" onClick={save} disabled={saving}><Save size={13} /> {saving ? 'Saving' : 'Raise transfer'}</Btn>
        <Btn kind="clear" onClick={() => { setF({ type: f.type, fromBranch: myBranch, toBranch: '', date: todayIso(), amount: '', fromLedgerId: '', refNo: '', narration: '' }); setLines([]); setMsg(''); }}><RotateCcw size={13} /> Clear</Btn>
      </ActionBar>
    </>
  );
}

function IbList({ myBranch }) {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [fl, setFl] = useState({ from: fyStart(), to: todayIso(), type: '', status: '', mine: myBranch ? 'in' : '' });
  const [mineTouched, setMineTouched] = useState(false);
  // the branch comes from the top bar a moment after the page opens - then show what is coming to it
  useEffect(() => { if (myBranch && !mineTouched) setFl(x => ({ ...x, mine: 'in' })); }, [myBranch]);
  const [msg, setMsg] = useState('');
  const [act, setAct] = useState(null); // { id, kind: 'accept' | 'return', toLedgerId, date, reason, lines }
  const [look, setLook] = useState({ banks: [], cash: [], all: [] });
  useEffect(() => { Promise.all([lookup('ledgers'), lookup('ledgers-in?groups=Bank Accounts,Bank OD A/c'), lookup('ledgers-in?groups=Cash-in-Hand')]).then(([all, banks, cash]) => setLook({ all, banks, cash })); }, []);
  const load = () => {
    const qs = new URLSearchParams({ from: fl.from, to: fl.to }); if (fl.type) qs.set('type', fl.type); if (fl.status) qs.set('status', fl.status);
    api('/api/accounts-hub/ib?' + qs).then(setRows).catch(e => setMsg('Not loaded: ' + e.message));
  };
  useEffect(load, [fl.from, fl.to, fl.type, fl.status]);
  const shown = rows.filter(r => !myBranch || !fl.mine || (fl.mine === 'in' ? r.toBranch === myBranch : r.fromBranch === myBranch));
  const doAccept = async (r) => {
    setMsg('');
    try {
      const body = r.type === 'journal' ? { date: act.date, toLines: act.lines } : { date: act.date, toLedgerId: act.toLedgerId };
      const x = await postJson('/api/accounts-hub/ib/' + r.id + '/accept', body); setMsg('Accepted ' + r.ibNo + ' - voucher ' + x.voucherNumber); setAct(null); load();
    } catch (e) { setMsg('Not accepted: ' + e.message); }
  };
  const doReturn = async (r) => {
    setMsg('');
    if (!String(act.reason || '').trim()) return setMsg('Enter why it is returned');
    try { await postJson('/api/accounts-hub/ib/' + r.id + '/return', { reason: act.reason.trim() }); setMsg('Returned ' + r.ibNo + ' - the sending voucher is reversed'); setAct(null); load(); }
    catch (e) { setMsg('Not returned: ' + e.message); }
  };
  const open = (vid, type) => vid && nav('/accounts-hub?item=' + (type === 'journal' ? 'journal' : 'contra') + '&voucher=' + vid);
  const vlink = (no, vid, type) => (no ? <span onClick={() => open(vid, type)} style={{ cursor: 'pointer', color: T.head, fontWeight: 800 }}>{no}</span> : '');
  const waitingIn = rows.filter(r => r.status === 'Waiting' && (!myBranch || r.toBranch === myBranch));
  const sel = act && rows.find(r => r.id === act.id);
  return (
    <>
      <Strip items={[['Transfers', shown.length], ['Waiting for ' + (myBranch || 'you'), waitingIn.length, '#b45309'], ['Accepted', shown.filter(r => r.status === 'Accepted').length, T.cr], ['Returned', shown.filter(r => r.status === 'Returned').length, T.dr], ['Value', '₹ ' + inr(shown.reduce((t, r) => t + Number(r.amount || 0), 0), 0)]]} />
      <ActionBar note={msg}>
        <input type="date" style={{ ...inputStyle, width: 140 }} value={fl.from} onChange={e => setFl({ ...fl, from: e.target.value })} />
        <span style={{ fontSize: 11, color: T.muted }}>to</span>
        <input type="date" style={{ ...inputStyle, width: 140 }} value={fl.to} onChange={e => setFl({ ...fl, to: e.target.value })} />
        <select style={{ ...inputStyle, width: 140 }} value={fl.type} onChange={e => setFl({ ...fl, type: e.target.value })}><option value="">All types</option>{IB_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select style={{ ...inputStyle, width: 130 }} value={fl.status} onChange={e => setFl({ ...fl, status: e.target.value })}><option value="">All status</option><option>Waiting</option><option>Accepted</option><option>Returned</option></select>
        {myBranch && <select style={{ ...inputStyle, width: 170 }} value={fl.mine} onChange={e => { setMineTouched(true); setFl({ ...fl, mine: e.target.value }); }}><option value="in">Coming to {myBranch}</option><option value="out">Sent by {myBranch}</option><option value="">All branches</option></select>}
        <Btn kind="primary" onClick={load}><RefreshCw size={13} /> Refresh</Btn>
        <Btn kind="plain" onClick={() => csv('inter_branch', [['ibNo', 'IB No'], ['typeName', 'Type'], [r => fmtDate(r.date), 'Date'], ['fromBranch', 'From'], ['toBranch', 'To'], ['amount', 'Amount'], ['refNo', 'Ref'], ['status', 'Status'], ['raiseNo', 'Sent voucher'], ['acceptNo', 'Received voucher'], ['returnReason', 'Return reason']], shown)}><Download size={13} /> Excel</Btn>
      </ActionBar>
      <Grid title={'Inter branch transfers (' + shown.length + ')'} maxHeight="calc(100vh - 400px)" rows={shown} rowKey={r => r.id} activeKey={act && act.id}
        empty={fl.mine === 'in' ? 'Nothing sent to ' + myBranch + ' in this period' : 'No inter branch transfers in this period'}
        cols={[
          { label: 'IB No', render: r => <b>{r.ibNo}</b> },
          { label: 'Type', render: r => <Badge tone="brand">{r.typeName}</Badge> },
          { label: 'Date', render: r => fmtDate(r.date) },
          { label: 'From > To', render: r => <b>{r.fromBranch} &gt; {r.toBranch}</b> },
          { label: 'Details', w: '28%', wrap: true, render: r => (
            <div style={{ fontSize: 11 }}>
              <div>{r.type === 'journal' ? r.toLines.map(l => l.ledgerName + ' ' + l.dc + ' ' + inr(l.amount)).join('; ') : (r.fromLedger || '') + (r.toLedger ? ' > ' + r.toLedger : '')}</div>
              {r.refNo && <div style={{ color: T.muted }}>Ref {r.refNo}</div>}
              {r.returnReason && <div style={{ color: T.dr }}>Returned: {r.returnReason}</div>}
            </div>) },
          { label: 'Amount', right: true, render: r => <b>{inr(r.amount)}</b> },
          { label: 'Vouchers', render: r => <span style={{ fontSize: 11 }}>{vlink(r.raiseNo, r.raiseVoucherId, r.type)}{r.acceptNo ? ' / ' : ''}{vlink(r.acceptNo, r.acceptVoucherId, r.type)}{r.reverseNo ? ' / rev ' : ''}{vlink(r.reverseNo, r.reverseVoucherId, r.type)}</span> },
          { label: 'By', render: r => <span style={{ fontSize: 11 }}>{r.raisedBy || ''}{r.decidedBy ? ' / ' + r.decidedBy : ''}</span> },
          { label: 'Status', render: r => <Badge tone={ibTone(r.status)}>{r.status}</Badge> },
          { label: '', render: r => (r.status === 'Waiting' ? (
            <span style={{ display: 'inline-flex', gap: 4 }}>
              <Btn small kind="save" onClick={() => setAct({ id: r.id, kind: 'accept', date: todayIso() < r.date ? r.date : todayIso(), toLedgerId: '', lines: r.toLines.map(l => ({ ledgerId: l.ledgerId, dc: l.dc, amount: l.amount, remarks: l.remarks })) })}><Check size={11} /> Accept</Btn>
              <Btn small kind="ghost" onClick={() => setAct({ id: r.id, kind: 'return', reason: '' })}><Undo2 size={11} /> Return</Btn>
            </span>) : null) },
        ]} />
      {sel && act.kind === 'accept' && (
        <Box title={'Accept ' + sel.ibNo + ' - ' + sel.typeName + ' of ' + inr(sel.amount) + ' from ' + sel.fromBranch} right={<span onClick={() => setAct(null)} style={{ cursor: 'pointer' }}><X size={13} /></span>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, alignItems: 'end' }}>
            <Field label="Accept Date" required><input type="date" style={inputStyle} min={sel.date} value={act.date} onChange={e => setAct({ ...act, date: e.target.value })} /></Field>
            {sel.type !== 'journal' && <Field label={sel.type === 'cash' ? 'Received In Cash' : 'Received In Bank'} required span={2}>
              <LedgerPicker id="ibacc" list={(sel.type === 'cash' ? look.cash : look.banks).length ? (sel.type === 'cash' ? look.cash : look.banks) : look.all} value={act.toLedgerId} onChange={x => setAct({ ...act, toLedgerId: x })} placeholder={sel.type === 'cash' ? 'Cash in hand' : 'Bank account'} mandatory /></Field>}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Btn kind="save" onClick={() => doAccept(sel)}><Check size={13} /> Accept and post</Btn></div>
          </div>
          {sel.type === 'journal' && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 6 }}>{sel.toBranch} will book these entries against BRANCH A/C - {sel.fromBranch}. Amounts can be changed; they must still add up to {inr(sel.amount)}.</div>
              {act.lines.map((l, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) 80px 140px', gap: 8, marginBottom: 6 }}>
                  <LedgerPicker id={'ibl' + i} list={look.all.filter(a => !/^BRANCH A\/C - /i.test(a.name))} value={l.ledgerId} onChange={x => setAct({ ...act, lines: act.lines.map((y, j) => (j === i ? { ...y, ledgerId: x } : y)) })} />
                  <select style={inputStyle} value={l.dc} onChange={e => setAct({ ...act, lines: act.lines.map((y, j) => (j === i ? { ...y, dc: e.target.value } : y)) })}><option>Dr</option><option>Cr</option></select>
                  <input style={{ ...inputStyle, textAlign: 'right' }} value={l.amount} onChange={e => setAct({ ...act, lines: act.lines.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)) })} inputMode="decimal" />
                </div>
              ))}
            </div>
          )}
        </Box>
      )}
      {sel && act.kind === 'return' && (
        <Box title={'Return ' + sel.ibNo + ' to ' + sel.fromBranch} right={<span onClick={() => setAct(null)} style={{ cursor: 'pointer' }}><X size={13} /></span>}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
            <Field label="Reason" required style={{ flex: 1 }}><input autoFocus style={act.reason ? inputStyle : mandStyle} value={act.reason} onChange={e => setAct({ ...act, reason: e.target.value })} placeholder="Wrong branch, amount not received ..." onKeyDown={e => e.key === 'Enter' && doReturn(sel)} /></Field>
            <Btn kind="danger" onClick={() => doReturn(sel)}><Undo2 size={13} /> Return and reverse</Btn>
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>{sel.fromBranch}'s voucher {sel.raiseNo} is reversed by a new voucher dated today; nothing is deleted.</div>
        </Box>
      )}
    </>
  );
}

function IbBalances() {
  const [rows, setRows] = useState(null); const [msg, setMsg] = useState('');
  useEffect(() => { api('/api/accounts-hub/ib/balances').then(setRows).catch(e => setMsg(e.message)); }, []);
  if (msg) return <Empty title="Could not load">{msg}</Empty>;
  if (!rows) return <div style={{ color: T.muted, fontSize: 12, padding: 12 }}>Loading</div>;
  const tot = rows.reduce((s, r) => s + r.net, 0);
  return (
    <>
      <Grid title="Branch accounts" maxHeight={400} rows={rows} rowKey={r => r.id} empty="No branch accounts yet - they are made with the first transfer"
        cols={[{ label: 'Account', render: r => <b>{r.name}</b> },
          { label: 'Balance', right: true, render: r => <Money v={Math.abs(r.net)} side={r.net >= 0 ? 'Dr' : 'Cr'} strong /> },
          { label: 'Meaning', wrap: true, render: r => (Math.abs(r.net) < 0.01 ? 'Settled' : r.net > 0 ? r.branch + ' owes the other branches' : 'Other branches owe ' + r.branch) }]} />
      <div style={{ fontSize: 11.5, color: Math.abs(tot) < 0.01 ? T.cr : T.amber, fontWeight: 700 }}>
        {Math.abs(tot) < 0.01 ? 'All branch accounts net to nil - every transfer has both sides.' : 'Branch accounts differ by ' + inr(Math.abs(tot)) + ' - some transfers are still waiting to be accepted.'}
      </div>
    </>
  );
}
