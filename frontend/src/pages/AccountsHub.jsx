// 04-Nov-2026 (v6): screens are opened from the navbar Accounts menu only (like every other module); this page has the
// title, breadcrumb, search and + New, then the screen - or the accounts dashboard when no screen is open.
// 04-Nov-2026 (v3): the Accounts page, rebuilt from iCAFFE's Accounts module in EagleView's own colours.
// Top: theme bar with the iCAFFE groups (Masters, Voucher, Purchase, Other Transactions, Reports, Books & GST) and the
// screens of the open group under it. Voucher and purchase screens, masters, reports, month closing and merge open
// here; screens that already existed elsewhere open in their own page.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Search, Plus, Save, Trash2, Pencil, Download, Printer, RefreshCw, ArrowRightLeft, Lock, Unlock, Command, ExternalLink, RotateCcw, Home as HomeIcon, ChevronRight, Building2, CalendarDays } from 'lucide-react';
import { canOpen } from '../utils/permissions';
import { useGlobalContext } from '../GlobalContext';
import { SECTIONS, ALL_ITEMS, hrefOf, QUICK } from './AccountsHubParts/menu';
import { T, inr, fmtDate, api, lookup, Box, Btn, ActionBar, Field, inputStyle, roStyle, Grid, Money, Badge, LedgerPicker, SuggestBox } from './AccountsHubParts/ui';
import VoucherDesk from './AccountsHubParts/VoucherDesk';
import CommandSearch from './AccountsHubParts/CommandSearch';
import AccountsDashboard from './AccountsHubParts/Dashboard';
import { GroupsScreen, LedgerScreen, TdsScreen, MapCsrScreen } from './AccountsHubParts/MastersDesk';
import { ReportView, LedgerReport } from './AccountsHubParts/ReportsDesk';
import { ChequeBooksScreen, JobClosingScreen, TdsPayableScreen, ApprovalsScreen, InterBranchScreen } from './AccountsHubParts/OtherDesk';
import { OutstandingScreen, CreditControlScreen, BankRecoScreen } from './AccountsHubParts/ControlDesk';
import GstInvoiceDesk, { ProvisionalSheetScreen } from './AccountsHubParts/GstInvoiceDesk';

const allowed = (i) => canOpen(hrefOf(i).split('?')[0]);

export default function AccountsHub() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [palette, setPalette] = useState(false);
  const active = ALL_ITEMS.find(i => i.id === params.get('item')) || null;
  const [sec, setSec] = useState(active ? active.section.id : 'home');
  useEffect(() => { if (active) setSec(active.section.id); }, [active && active.id]);
  useEffect(() => {
    const k = (e) => { if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') { e.preventDefault(); setPalette(true); } };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, []);

  const pick = (it) => { if (it.route) { nav(it.route); return; } setParams({ item: it.id }); };
  const sections = SECTIONS.map(s => ({ ...s, items: s.items.filter(allowed) })).filter(s => s.items.length);
  const curSec = sections.find(s => s.id === sec);
  const goHome = () => { setSec('home'); setParams({}); };

  const quick = QUICK.map(q => ALL_ITEMS.find(i => i.id === q.id)).filter(i => i && allowed(i));
  // 06-Nov-2026: every screen shows the branch and financial year picked in the top bar; picking another one reloads it
  const g = useGlobalContext() || {};
  const scope = ((g.activeBranch && (g.activeBranch.isAll ? 'ALL' : g.activeBranch.branchCode)) || '') + '|' + ((g.activeYear && g.activeYear.id) || '');
  const [waited, setWaited] = useState(false);
  useEffect(() => { const t = setTimeout(() => setWaited(true), 2500); return () => clearTimeout(t); }, []);
  const scopeReady = waited || !!(g.activeBranch && g.activeYear);
  const groupTabs = [{ id: 'home', title: 'Home', icon: HomeIcon }, ...sections];

  return (
    <div style={{ padding: '0.25rem 0.5rem 0.5rem', minHeight: '100%', background: 'var(--bg-app, #f8fafc)' }}>
      {/* page header - same pattern as the main Dashboard: title on the left, search and New on the right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: '0.4rem', flexWrap: 'wrap' }}>
        <div>
          <h1 onClick={goHome} style={{ fontSize: '1.35rem', lineHeight: 1.2, fontWeight: 800, color: 'var(--text-main, #0f172a)', letterSpacing: '-0.5px', cursor: 'pointer', margin: 0 }}>{active ? active.label : 'Accounts'}</h1>
          <p style={{ color: 'var(--text-muted, #64748b)', margin: '3px 0 0', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {active ? <><span onClick={goHome} style={{ cursor: 'pointer', textDecoration: 'underline' }} title="Back to Accounts home">Accounts</span><ChevronRight size={12} /><span onClick={() => { setSec(active.section.id); setParams({}); }} style={{ cursor: 'pointer', textDecoration: 'underline' }} title={'Back to ' + active.section.title}>{active.section.title}</span></> : 'Books, vouchers, bills and reports in one place.'}
            {/* 07-Nov-2026: the branch / year in scope as two badges, so it is clear which books the figures are from */}
            {g.activeBranch && (
              <span title="Branch in scope (change it in the top bar)" style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, fontSize: '11.5px', fontWeight: 800, letterSpacing: '0.02em',
                background: g.activeBranch.isAll ? '#fef3c7' : 'var(--primary-color-start, #0284c7)', color: g.activeBranch.isAll ? '#92400e' : '#fff', border: g.activeBranch.isAll ? '1px solid #f59e0b' : '1px solid transparent', boxShadow: '0 1px 2px rgba(0,0,0,.08)' }}>
                <Building2 size={12} />{g.activeBranch.isAll ? 'All branches' : g.activeBranch.branchCode + ' - ' + g.activeBranch.branchName}
              </span>
            )}
            {g.activeYear && (
              <span title="Financial year in scope (change it in the top bar)" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, fontSize: '11.5px', fontWeight: 800,
                background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd' }}>
                <CalendarDays size={12} />FY {g.activeYear.code || g.activeYear.name}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div onClick={() => setPalette(true)} style={{ position: 'relative', cursor: 'text' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <div style={{ padding: '0.35rem 0.8rem 0.35rem 2.1rem', borderRadius: 8, border: '1px solid var(--border-color, #cbd5e1)', fontSize: 13, width: 320, background: '#fff', boxSizing: 'border-box', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
              Search ledger, voucher or bill
              <span style={{ marginLeft: 'auto', fontSize: 10, border: '1px solid #cbd5e1', borderRadius: 4, padding: '0 5px', color: '#64748b' }}>Ctrl K</span>
            </div>
          </div>
          <NewMenu items={quick} onPick={pick} />
        </div>
      </div>

      <div style={{ borderTop: '1px solid #cbd5e1', marginBottom: 12 }} />

      {!scopeReady && active && <div style={{ padding: 30, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Loading branch and year...</div>}
      {(scopeReady || !active) && <div key={scope}>
      {!active && <Home sections={sections} onPick={pick} />}
      {active && active.desk && <VoucherDesk key={active.id} desk={active.desk} section={active.section} />}
      {active && active.master && <MasterCrud key={active.id} kind={active.master} />}
      {active && active.report && <ReportView key={active.id} item={active} />}
      {active && active.view === 'months' && <MonthClosing />}
      {active && active.view === 'merge' && <MergeAccount />}
      {active && active.view === 'groups' && <GroupsScreen />}
      {active && active.view === 'ledgers' && <LedgerScreen />}
      {active && active.view === 'tds' && <TdsScreen />}
      {active && active.view === 'mapcsr' && <MapCsrScreen />}
      {active && active.view === 'ledgerrep' && <LedgerReport />}
      {active && active.view === 'cheques' && <ChequeBooksScreen />}
      {active && active.view === 'jobs' && <JobClosingScreen />}
      {active && active.view === 'tdspay' && <TdsPayableScreen />}
      {active && active.view === 'approvals' && <ApprovalsScreen key={active.id} startTab={active.id === 'approval' ? 'rules' : 'pending'} Rules={<MasterCrud kind="approvals" />} />}
      {active && active.view === 'ib' && <InterBranchScreen key={active.id} startTab={active.id === 'ibraise' ? 'raise' : 'list'} />}
      {active && active.view === 'outstanding' && <OutstandingScreen />}
      {active && active.view === 'credit' && <CreditControlScreen />}
      {active && active.view === 'brs' && <BankRecoScreen />}
      {active && active.view === 'gstinv' && <GstInvoiceDesk key={active.kind} kind={active.kind} />}
      {active && active.view === 'provsheet' && <ProvisionalSheetScreen />}
      </div>}
      <CommandSearch open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}

// "+ New" button with the common entry screens, like the + New Job button on the main dashboard
function NewMenu({ items, onPick }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div className="dropdown" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="btn btn-primary" onClick={() => setOpen(true)}
        style={{ background: T.grad, boxShadow: '0 4px 12px var(--primary-shadow, rgba(14,165,233,0.3))', border: 'none', padding: '0.4rem 1.1rem', fontWeight: 600 }}>
        <Plus size={14} /> New
      </button>
      <div className="dropdown-menu" style={{ right: 0, left: 'auto', minWidth: 200, padding: '0.5rem', display: open ? 'flex' : 'none' }} onClick={() => setOpen(false)}>
        {items.map(i => <div key={i.id} className="dropdown-item" onClick={() => onPick(i)} style={{ padding: '0.5rem 0.75rem', cursor: 'pointer' }}>{i.label}</div>)}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ home: accounts dashboard (screens are in the group tabs and the navbar menu)
function Home({ sections, onPick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AccountsDashboard />
    </div>
  );
}
// ------------------------------------------------------------------ master field input
function FieldInput({ f, value, onChange, look }) {
  if (f.type === 'bool') return <label style={{ display: 'flex', alignItems: 'center', gap: 6, height: 28, margin: 0 }}><input type="checkbox" checked={!!Number(value)} onChange={e => onChange(e.target.checked ? 1 : 0)} /> Yes</label>;
  if (f.type === 'select') return <select style={inputStyle} value={value || ''} onChange={e => onChange(e.target.value)}><option value="">Select</option>{f.options.map(o => <option key={o}>{o}</option>)}</select>;
  if (f.type === 'date') return <input type="date" style={inputStyle} value={value ? String(value).slice(0, 10) : ''} onChange={e => onChange(e.target.value)} />;
  if (f.type === 'number') return <input type="number" step="any" style={{ ...inputStyle, textAlign: 'right' }} value={value ?? ''} onChange={e => onChange(e.target.value)} />;
  if (f.type === 'ledger' || f.type === 'tdsnature' || f.type === 'costcentre') {
    const list = look[f.type] || [];
    const label = (o) => o.name + (f.type === 'tdsnature' && o.section ? ' (' + o.section + ')' : '');
    // 06-Nov-2026: type-ahead list (was the browser's datalist: first 3,000 only, start-of-name match)
    const items = list.map(o => ({ id: o.id, name: label(o), groupName: o.groupName || '' }));
    return <LedgerPicker id={'fi-' + f.key} list={items} value={value || ''} onChange={id => onChange(id || '')} placeholder={list.length ? 'Type to search' : 'No entries yet'} />;
  }
  if (f.type === 'sac') return <SuggestBox text={value || ''} onText={v => onChange(v)} onPick={o => onChange(o.code)} items={look.sac || []} getKey={o => o.code}
    getLabel={o => o.code + ' ' + (o.description || '')} getSub={o => o.description || ''} style={inputStyle} placeholder="996511 ..." />;
  return <input style={inputStyle} value={value || ''} onChange={e => onChange(e.target.value)} />;
}
const showVal = (f, v, look) => {
  if (v === null || v === undefined || v === '') return '';
  if (f.type === 'bool') return Number(v) ? 'Yes' : 'No';
  if (f.type === 'date') return fmtDate(v);
  if (['ledger', 'tdsnature', 'costcentre'].includes(f.type)) { const o = (look[f.type] || []).find(x => String(x.id) === String(v)); return o ? o.name : '#' + v; }
  if (f.type === 'number') return Number(v).toLocaleString('en-IN');
  return String(v);
};

// ------------------------------------------------------------------ generic master (iCAFFE: form, Save / Modify / Delete / Clear, list)
function MasterCrud({ kind }) {
  const [meta, setMeta] = useState(null);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({});
  const [look, setLook] = useState({});
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [msg, setMsg] = useState('');
  const load = () => api('/api/accounts-hub/masters/' + kind).then(setRows).catch(e => setMsg(e.message));
  const blank = (m = meta) => ({ ...Object.fromEntries(m.fields.map(f => [f.key, f.type === 'bool' ? 0 : ''])), isActive: 1 });
  useEffect(() => {
    api('/api/accounts-hub/masters/' + kind + '/meta').then(m => {
      setMeta(m); setForm(blank(m)); load();
      const need = new Set(m.fields.map(f => f.type));
      Promise.all([need.has('ledger') ? lookup('ledgers') : [], need.has('tdsnature') ? lookup('tdsnatures') : [], need.has('costcentre') ? lookup('costcentres') : [], need.has('sac') ? lookup('sac') : []])
        .then(([ledger, tdsnature, costcentre, sac]) => setLook({ ledger, tdsnature, costcentre, sac }));
    }).catch(e => setMsg(e.message));
  }, [kind]);
  if (!meta) return <Box style={{ background: '#fff' }}><span style={{ color: T.muted }}>{msg || 'Loading'}</span></Box>;
  const save = async () => {
    setMsg('');
    const miss = meta.fields.find(f => f.required && (form[f.key] === '' || form[f.key] == null));
    if (miss) return setMsg('Enter ' + miss.label);
    try {
      await api('/api/accounts-hub/masters/' + kind + (form.id ? '/' + form.id : ''), { method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      setMsg(form.id ? 'Updated' : 'Saved'); if (!form.id) setForm(blank()); load();
    } catch (e) { setMsg('Not saved: ' + e.message); }
  };
  const del = async () => {
    if (!form.id || !window.confirm('Delete this entry?')) return;
    try { await api('/api/accounts-hub/masters/' + kind + '/' + form.id, { method: 'DELETE' }); setMsg('Deleted'); setForm(blank()); load(); } catch (e) { setMsg('Not deleted: ' + e.message); }
  };
  const title = meta.fields[0];
  const sub = meta.fields.slice(1, 3);
  const active = (r) => r.isActive === undefined || r.isActive === null || !!Number(r.isActive);
  const shown = rows.filter(r => (!status || (status === 'active') === active(r)) && (!q || meta.fields.some(f => String(showVal(f, r[f.key], look)).toLowerCase().includes(q.toLowerCase()))));
  const exportCsv = () => {
    const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [meta.fields.map(f => esc(f.label)).join(',')].concat(shown.map(r => meta.fields.map(f => esc(showVal(f, r[f.key], look))).join(',')));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' })); a.download = meta.title.replace(/[^\w]+/g, '_') + '.csv'; a.click();
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 330px) minmax(0, 1fr)', gap: 12, alignItems: 'start' }} className="acc-two">
      {/* list */}
      <div style={{ background: '#fff', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 190px)', position: 'sticky', top: 8 }}>
        <div style={{ padding: '8px 10px', borderBottom: '1px solid #eef2f7', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, color: 'var(--primary-text, #1e3a8a)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{meta.title}</span>
          <span style={{ marginLeft: 'auto', fontSize: 10.5, color: T.muted }}>{shown.length} of {rows.length}</span>
        </div>
        <div style={{ padding: 8, display: 'grid', gridTemplateColumns: '1fr 96px', gap: 6, borderBottom: '1px solid #eef2f7' }}>
          <div style={{ position: 'relative' }}><Search size={13} style={{ position: 'absolute', left: 8, top: 8, color: '#94a3b8' }} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" style={{ ...inputStyle, paddingLeft: 26 }} /></div>
          <select style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {shown.map(r => { const on = String(form.id) === String(r.id); return (
            <div key={r.id} onClick={() => { setForm({ ...r }); setMsg(''); }}
              style={{ padding: '7px 10px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: on ? T.headBg : 'transparent', borderLeft: `3px solid ${on ? 'var(--primary-color-end, #0369a1)' : 'transparent'}`, opacity: active(r) ? 1 : 0.55 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{showVal(title, r[title.key], look) || '(blank)'}</span>
                {!active(r) && <Badge tone="muted">Inactive</Badge>}
              </div>
              <div style={{ fontSize: 10, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.map(f => showVal(f, r[f.key], look)).filter(Boolean).join(' | ')}</div>
            </div>); })}
          {!shown.length && <div style={{ padding: 20, textAlign: 'center', fontSize: 11.5, color: T.muted }}>{rows.length ? 'No entry matches' : 'No entries yet'}</div>}
        </div>
      </div>
      {/* form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        <Box title={form.id ? meta.title + ' - ' + (showVal(title, form[title.key], look) || '') : meta.title + ' - new entry'}
          right={<label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, cursor: 'pointer', color: T.inkSoft }}><input type="checkbox" checked={form.isActive === undefined || !!Number(form.isActive)} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked ? 1 : 0 }))} /> Active</label>}
          style={{ background: '#fff' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {meta.fields.map(f => <Field key={f.key} label={f.label} required={f.required}><FieldInput f={f} value={form[f.key]} look={look} onChange={v => setForm(p => ({ ...p, [f.key]: v }))} /></Field>)}
          </div>
        </Box>
        <ActionBar note={msg}>
          <Btn kind="save" onClick={save} disabled={!!form.id}><Save size={13} /> Save</Btn>
          <Btn kind="save" onClick={save} disabled={!form.id}><Pencil size={13} /> Modify</Btn>
          <Btn kind="danger" onClick={del} disabled={!form.id}><Trash2 size={13} /> Delete</Btn>
          <Btn kind="clear" onClick={() => { setForm(blank()); setMsg(''); }}><RotateCcw size={13} /> Clear</Btn>
          <Btn kind="plain" onClick={() => { const c = { ...form }; delete c.id; setForm(c); setMsg('Copied - change it and Save as a new entry'); }} disabled={!form.id}><Plus size={13} /> Copy as new</Btn>
          <Btn kind="plain" onClick={exportCsv} disabled={!shown.length}><Download size={13} /> Excel</Btn>
        </ActionBar>
        <Grid title={'All entries (' + shown.length + ')'} maxHeight="calc(100vh - 420px)" rows={shown} rowKey={r => r.id} activeKey={form.id} onRow={r => { setForm({ ...r }); setMsg(''); }}
          empty="No entries yet - fill the form above and Save"
          cols={meta.fields.slice(0, 7).map(f => ({ label: f.label, right: f.type === 'number', render: r => showVal(f, r[f.key], look) }))} />
      </div>
      <style>{`@media (max-width: 900px) { .acc-two { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

// ------------------------------------------------------------------ month closing
function MonthClosing() {
  const [d, setD] = useState(null); const [msg, setMsg] = useState('');
  const load = () => api('/api/accounts-hub/months').then(setD).catch(e => setMsg(e.message));
  useEffect(() => { load(); }, []);
  const act = async (m, a) => {
    if (!window.confirm((a === 'close' ? 'Close ' : 'Re-open ') + m.periodName + '? ' + (a === 'close' ? 'No voucher can be saved with a date in this month.' : ''))) return;
    try { await api(`/api/accounts-hub/months/${m.month}/${a}`, { method: 'POST' }); setMsg((a === 'close' ? 'Closed ' : 'Re-opened ') + m.periodName); load(); } catch (e) { setMsg('Not changed: ' + e.message); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Grid title={'Month Closing' + (d && d.fy ? ' - FY ' + (d.fy.name || d.fy.code) : '')} maxHeight="none"
        rows={d ? d.months : []} rowKey={m => m.month}
        cols={[
          { label: 'Month', render: m => <b>{m.periodName}</b> },
          { label: 'Vouchers', right: true, render: m => m.vouchers },
          { label: 'Status', render: m => (m.isClosed ? <Badge tone="bad">Closed</Badge> : <Badge tone="ok">Open</Badge>) },
          { label: 'Closed On', render: m => (m.isClosed ? fmtDate(m.closedOn) : '') },
          { label: 'Closed By', render: m => (m.isClosed ? m.closedBy || '' : '') },
          { label: 'Action', right: true, render: m => (m.isClosed ? <Btn small kind="clear" onClick={() => act(m, 'open')}><Unlock size={11} /> Re-open</Btn> : <Btn small kind="danger" onClick={() => act(m, 'close')}><Lock size={11} /> Close month</Btn>) },
        ]} />
      {msg && <ActionBar note={msg} />}
    </div>
  );
}

// ------------------------------------------------------------------ merge account
function MergeAccount() {
  const [ls, setLs] = useState([]); const [a, setA] = useState(''); const [b, setB] = useState(''); const [msg, setMsg] = useState('');
  useEffect(() => { lookup('ledgers').then(setLs); }, []);
  const pickId = (v) => (ls.find(l => l.name === v) || {}).id || '';
  const A = ls.find(l => l.id === a), B = ls.find(l => l.id === b);
  const go = async () => {
    if (!A || !B || A.id === B.id) return setMsg('Choose two different ledgers');
    if (!window.confirm(`All entries of "${A.name}" will move to "${B.name}" and "${A.name}" will be deleted. Continue?`)) return;
    try { const r = await api('/api/accounts-hub/merge-ledgers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromId: A.id, toId: B.id }) }); setMsg(`Merged "${r.merged}" into "${r.into}"`); lookup('ledgers', true).then(setLs); }
    catch (e) { setMsg('Not merged: ' + e.message); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 900 }}>
      <Box title="Merge Account" style={{ background: '#fff' }}>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>Moves every voucher line of the first ledger to the second, adds its opening balance, then deletes the first ledger. Use it for duplicate accounts.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'end' }}>
          <Field label="Merge (will be deleted)" hint={A ? A.groupName : ' '}><LedgerPicker id="mergeA" list={ls} value={a} onChange={id => setA(id || '')} /></Field>
          <ArrowRightLeft size={18} color={T.head} style={{ marginBottom: 24 }} />
          <Field label="Into (stays)" hint={B ? B.groupName : ' '}><LedgerPicker id="mergeB" list={ls} value={b} onChange={id => setB(id || '')} /></Field>
        </div>
      </Box>
      <ActionBar note={msg}><Btn kind="danger" onClick={go} disabled={!a || !b}><ArrowRightLeft size={13} /> Merge</Btn></ActionBar>
    </div>
  );
}
