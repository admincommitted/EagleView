// 04-Nov-2026: Accounts masters built like iCAFFE's master screens, in EagleView's look.
//   Groups          - tree on the left (balance and ledgers of each branch), group form + its ledgers on the right
//   Ledger Account  - account list on the left, full account form on the right (details, GST & TDS, address, bank, credit)
//   TDS Schedule    - sections and rates, how many ledgers use each
//   MAP CSR Posting - which income / expense ledger every billing charge posts to
// Backend: /api/accounts-hub/groups-tree, /groups, /ledgers, /tds-schedule, /masters/gstcharges
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Save, Pencil, Trash2, RotateCcw, ChevronRight, ChevronDown, Search, FileText, Download, Wand2, FolderTree, BookUser } from 'lucide-react';
import { T, inr, fmtDate, api, postJson, lookup, Box, Btn, ActionBar, Field, inputStyle, roStyle, mandStyle, Money, Badge, LedgerPicker, Grid, Empty } from './ui';

const NATURES = ['Assets', 'Liabilities', 'Income', 'Expenses'];
const STATES = [['01', 'Jammu & Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'], ['05', 'Uttarakhand'], ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'],
  ['10', 'Bihar'], ['11', 'Sikkim'], ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'], ['16', 'Tripura'], ['17', 'Meghalaya'], ['18', 'Assam'], ['19', 'West Bengal'],
  ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'], ['24', 'Gujarat'], ['26', 'Dadra & Nagar Haveli and Daman & Diu'], ['27', 'Maharashtra'], ['29', 'Karnataka'],
  ['30', 'Goa'], ['31', 'Lakshadweep'], ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['34', 'Puducherry'], ['35', 'Andaman & Nicobar Islands'], ['36', 'Telangana'], ['37', 'Andhra Pradesh'], ['38', 'Ladakh'], ['97', 'Other Territory']];
const stateOfGstin = (g) => (STATES.find(([c]) => c === String(g || '').slice(0, 2)) || [])[1] || '';
const csv = (name, cols, rows) => {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [cols.map(c => esc(c[1])).join(',')].concat(rows.map(r => cols.map(c => esc(typeof c[0] === 'function' ? c[0](r) : r[c[0]])).join(',')));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' })); a.download = name + '.csv'; a.click();
};
const balTxt = (b, side) => (b ? inr(b) + ' ' + side : '0.00');

// a list panel on the left of a master screen
function ListPanel({ title, count, search, onSearch, children, tools, placeholder = 'Search' }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: 'calc(100vh - 190px)', position: 'sticky', top: 8 }}>
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #eef2f7', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontWeight: 800, color: 'var(--primary-text, #1e3a8a)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: T.muted }}>{count}</span>
      </div>
      <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6, borderBottom: '1px solid #eef2f7' }}>
        <div style={{ position: 'relative' }}><Search size={13} style={{ position: 'absolute', left: 8, top: 8, color: '#94a3b8' }} /><input value={search} onChange={e => onSearch(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, paddingLeft: 26 }} /></div>
        {tools}
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>{children}</div>
    </div>
  );
}
const rowStyle = (on) => ({ padding: '7px 10px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: on ? T.headBg : 'transparent', borderLeft: `3px solid ${on ? 'var(--primary-color-end, #0369a1)' : 'transparent'}` });
const twoPane = { display: 'grid', gridTemplateColumns: 'minmax(260px, 330px) minmax(0, 1fr)', gap: 12, alignItems: 'start' };
const Stat = ({ label, children }) => (<div style={{ minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase' }}>{label}</div><div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 1 }}>{children}</div></div>);

// ================================================================== GROUPS
export function GroupsScreen() {
  const nav = useNavigate();
  const [groups, setGroups] = useState([]);
  const [open, setOpen] = useState({});
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ name: '', parentId: '', nature: 'Assets' });
  const [ledgers, setLedgers] = useState([]);
  const [msg, setMsg] = useState('');
  const load = () => api('/api/accounts-hub/groups-tree').then(gs => { setGroups(gs); setOpen(o => (Object.keys(o).length ? o : Object.fromEntries(gs.filter(g => !g.parentId).map(g => [g.id, true])))); }).catch(e => setMsg('Not loaded: ' + e.message));
  useEffect(() => { load(); }, []);
  const byId = useMemo(() => new Map(groups.map(g => [g.id, g])), [groups]);
  const kids = (id) => groups.filter(g => (g.parentId || null) === id);
  const pathOf = (g) => { const out = []; let x = g, n = 0; while (x && n++ < 20) { out.unshift(x.name); x = byId.get(x.parentId); } return out.join(' > '); };
  const pick = (g) => { setSel(g); setMsg(''); setForm({ id: g.id, name: g.name, parentId: g.parentId || '', nature: g.nature }); api('/api/accounts-hub/ledgers?groupId=' + g.id + '&limit=500').then(r => setLedgers(r.rows || [])).catch(() => setLedgers([])); };
  const clear = (parentId = '') => { setSel(null); setLedgers([]); setMsg(''); const p = byId.get(Number(parentId)); setForm({ name: '', parentId, nature: p ? p.nature : 'Assets' }); };
  const save = async () => {
    setMsg('');
    if (!form.name.trim()) return setMsg('Enter the group name');
    try {
      if (form.id) await postJson('/api/accounts-hub/groups/' + form.id, form, 'PUT'); else await postJson('/api/accounts-hub/groups', form);
      setMsg(form.id ? 'Updated' : 'Saved'); lookup('groups', true); lookup('ledgers', true); await load(); if (!form.id) clear(form.parentId);
    } catch (e) { setMsg('Not saved: ' + e.message); }
  };
  const del = async () => {
    if (!form.id || !window.confirm('Delete group "' + form.name + '"?')) return;
    try { await api('/api/accounts-hub/groups/' + form.id, { method: 'DELETE' }); setMsg('Deleted'); lookup('groups', true); await load(); clear(); } catch (e) { setMsg('Not deleted: ' + e.message); }
  };
  const ql = q.trim().toLowerCase();
  const matches = (g) => !ql || g.name.toLowerCase().includes(ql) || kids(g.id).some(matches);
  const Node = ({ g, depth }) => {
    if (!matches(g)) return null;
    const ch = kids(g.id); const isOpen = open[g.id] || !!ql; const on = sel && sel.id === g.id;
    return (
      <>
        <div onClick={() => pick(g)} style={{ ...rowStyle(on), padding: '6px 10px 6px ' + (8 + depth * 16) + 'px', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span onClick={e => { e.stopPropagation(); setOpen(o => ({ ...o, [g.id]: !o[g.id] })); }} style={{ width: 14, display: 'inline-flex', color: '#94a3b8' }}>{ch.length ? (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : null}</span>
          <span style={{ fontSize: 11.5, fontWeight: depth ? 600 : 800, color: depth ? '#334155' : 'var(--primary-text, #1e3a8a)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
          {g.ledgers > 0 && <span style={{ fontSize: 9.5, color: T.muted }}>{g.ledgers}</span>}
        </div>
        {isOpen && ch.map(c => <Node key={c.id} g={c} depth={depth + 1} />)}
      </>
    );
  };
  const roots = NATURES.map(n => ({ n, list: groups.filter(g => !g.parentId && g.nature === n) }));
  return (
    <div style={twoPane} className="acc-two">
      <ListPanel title="Chart of accounts" count={groups.length + ' groups'} search={q} onSearch={setQ} placeholder="Search group"
        tools={<div style={{ display: 'flex', gap: 6 }}><Btn small kind="ghost" onClick={() => setOpen(Object.fromEntries(groups.map(g => [g.id, true])))}>Expand all</Btn><Btn small kind="ghost" onClick={() => setOpen({})}>Collapse</Btn></div>}>
        {roots.map(({ n, list }) => list.length > 0 && (
          <div key={n}>
            <div style={{ padding: '6px 10px', fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase', background: '#f8fafc', borderBottom: '1px solid #eef2f7' }}>{n}</div>
            {list.map(g => <Node key={g.id} g={g} depth={0} />)}
          </div>
        ))}
      </ListPanel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        <Box title={form.id ? 'Group - ' + form.name : 'New group'} right={sel && sel.isBuiltIn ? <Badge tone="brand">Built-in</Badge> : null} style={{ background: '#fff' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <Field label="Group Name" required><input style={form.name ? inputStyle : mandStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
            <Field label="Under Group" hint="Leave blank for a primary group">
              <select style={inputStyle} value={form.parentId || ''} disabled={sel && sel.isBuiltIn} onChange={e => { const p = byId.get(Number(e.target.value)); setForm({ ...form, parentId: e.target.value, nature: p ? p.nature : form.nature }); }}>
                <option value="">Primary (no parent)</option>
                {groups.filter(g => !form.id || g.id !== form.id).map(g => <option key={g.id} value={g.id}>{pathOf(g)}</option>)}
              </select>
            </Field>
            <Field label="Nature" hint={form.parentId ? 'Same as the under group' : ' '}>
              <select style={form.parentId ? roStyle : inputStyle} disabled={!!form.parentId} value={form.nature} onChange={e => setForm({ ...form, nature: e.target.value })}>{NATURES.map(n => <option key={n}>{n}</option>)}</select>
            </Field>
          </div>
          {sel && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 14, paddingTop: 12, borderTop: '1px solid #eef2f7' }}>
              <Stat label="Path">{pathOf(sel)}</Stat>
              <Stat label="Sub-groups">{sel.subGroups}</Stat>
              <Stat label="Ledgers (incl. sub-groups)">{sel.ledgers}</Stat>
              <Stat label="Closing balance"><span style={{ color: !sel.balance ? '#0f172a' : sel.balance < 0 ? T.cr : T.dr }}>{inr(Math.abs(sel.balance))}{sel.balance ? (sel.balance < 0 ? ' Cr' : ' Dr') : ''}</span></Stat>
            </div>
          )}
        </Box>
        <ActionBar note={msg}>
          <Btn kind="save" onClick={save} disabled={!!form.id}><Save size={13} /> Save</Btn>
          <Btn kind="save" onClick={save} disabled={!form.id}><Pencil size={13} /> Modify</Btn>
          <Btn kind="danger" onClick={del} disabled={!form.id || (sel && sel.isBuiltIn)}><Trash2 size={13} /> Delete</Btn>
          <Btn kind="clear" onClick={() => clear()}><RotateCcw size={13} /> Clear</Btn>
          {sel && <Btn kind="plain" onClick={() => clear(String(sel.id))}><Plus size={13} /> Add sub-group</Btn>}
          {sel && <Btn kind="plain" onClick={() => nav('/accounts-hub?item=ledgers&group=' + sel.id)}><Plus size={13} /> Add ledger here</Btn>}
        </ActionBar>
        {sel && (
          <Grid title={'Ledgers under ' + sel.name + ' (' + ledgers.length + ')'} maxHeight="calc(100vh - 470px)" rows={ledgers} rowKey={l => l.id}
            onRow={l => nav('/accounts-hub?item=ledgers&ledger=' + l.id)} empty="No ledgers in this group"
            right={ledgers.length > 0 && <Btn small kind="ghost" onClick={() => csv('Ledgers_' + sel.name, [['name', 'Ledger'], ['groupName', 'Group'], ['gstin', 'GSTIN'], [r => inr(r.balance) + ' ' + r.side, 'Balance']], ledgers)}><Download size={11} /> Excel</Btn>}
            cols={[{ label: 'Ledger', render: l => <b>{l.name}</b> }, { label: 'Group', render: l => l.groupName }, { label: 'GSTIN', render: l => l.gstin || '' },
              { label: 'Balance', right: true, render: l => <Money v={l.balance} side={l.balance ? l.side : null} /> }, { label: '', render: l => (l.balance ? l.side : '') }]} />
        )}
        {!sel && <Empty title="Pick a group on the left to see or change it">Or fill the form above to add a new group.</Empty>}
      </div>
      <style>{`@media (max-width: 900px) { .acc-two { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

// ================================================================== LEDGER ACCOUNT
const blankLedger = (groupId = '') => ({ name: '', groupId, openingBalance: '', balanceType: 'Dr', creditDays: '', creditLimit: '', maintainBillByBill: 0, costCentresApplicable: 0,
  isGstApplicable: 0, gstin: '', pan: '', hsnSac: '', taxability: '', gstRate: '', isTdsApplicable: 0, tdsNatureId: '', deducteeType: '', isTdsDeductible: 0,
  address: '', state: '', pinCode: '', country: 'India', contactPerson: '', phone: '', email: '', bankName: '', bankAccount: '', bankIfsc: '',
  accountType: 'Personal', accountCode: '', dealingBranch: '', monthlyBudget: '', creditMode: 'Credit', businessType: '', isUnregistered: 0, isBlacklisted: 0, blacklistReason: '',
  isComposite: 0, isFixedDeposit: 0, isTdsExempt: 0, partyTdsLedgerId: '', msmeNo: '', msmeType: '', msmeActivity: '', msmeAgreementDays: '', isActive: 1 });
const CHILD_FORMS = {
  addresses: { title: 'Addresses', blank: { label: '', address: '', city: '', state: '', pinCode: '', country: 'India', gstin: '', contactPerson: '', phone: '', email: '', isDefault: 0 },
    cols: [['label', 'Label'], ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['gstin', 'GSTIN'], ['contactPerson', 'Contact'], ['phone', 'Phone']] },
  banks: { title: 'Bank accounts', blank: { bankName: '', accountName: '', accountNo: '', ifsc: '', branch: '', swift: '', isDefault: 0 },
    cols: [['bankName', 'Bank'], ['accountName', 'Account name'], ['accountNo', 'Account no'], ['ifsc', 'IFSC'], ['branch', 'Branch'], ['swift', 'SWIFT']] },
  openings: { title: 'Opening bills', blank: { docNo: '', docDate: '', dueDate: '', dc: 'Dr', amount: '', jobNo: '', remarks: '' },
    cols: [['docNo', 'Bill / Doc No'], ['docDate', 'Bill Date'], ['dueDate', 'Due Date'], ['dc', 'Dr/Cr'], ['amount', 'Amount'], ['jobNo', 'Job No'], ['remarks', 'Remarks']] },
};

// addresses / bank accounts / opening bills of one ledger
function ChildList({ kind, ledger, onChanged }) {
  const cfg = CHILD_FORMS[kind];
  const rows = ledger[kind] || [];
  const [f, setF] = useState(cfg.blank);
  const [msg, setMsg] = useState('');
  const [paste, setPaste] = useState('');
  useEffect(() => { setF(cfg.blank); setMsg(''); }, [kind, ledger.id]);
  const save = async () => {
    setMsg('');
    try { if (f.id) await postJson(`/api/accounts-hub/ledgers/${ledger.id}/${kind}/${f.id}`, f, 'PUT'); else await postJson(`/api/accounts-hub/ledgers/${ledger.id}/${kind}`, f); setMsg(f.id ? 'Updated' : 'Saved'); setF(cfg.blank); onChanged(); }
    catch (e) { setMsg('Not saved: ' + e.message); }
  };
  const del = async (r) => { if (!window.confirm('Delete this entry?')) return; try { await api(`/api/accounts-hub/ledgers/${ledger.id}/${kind}/${r.id}`, { method: 'DELETE' }); setMsg('Deleted'); setF(cfg.blank); onChanged(); } catch (e) { setMsg('Not deleted: ' + e.message); } };
  // opening bills pasted from Excel: Bill no, Bill date (dd/mm/yyyy), Amount, Dr/Cr, Due date, Job no
  const toIso = (s) => { const m = String(s || '').trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : String(s || '').trim(); };
  const importPaste = async () => {
    const list = paste.split(/\r?\n/).map(l => l.split('\t')).filter(c => c[0] && c[0].trim() && !/bill|doc/i.test(c[0])).map(c => ({ docNo: c[0], docDate: toIso(c[1]), amount: String(c[2] || '').replace(/,/g, ''), dc: /cr/i.test(c[3] || '') ? 'Cr' : 'Dr', dueDate: toIso(c[4]), jobNo: c[5] || '' }));
    if (!list.length) return setMsg('Nothing to import - paste rows copied from Excel');
    try { const r = await postJson(`/api/accounts-hub/ledgers/${ledger.id}/openings`, list); setMsg('Saved ' + r.added + ' bills'); setPaste(''); onChanged(); } catch (e) { setMsg('Not imported: ' + e.message); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value });
  const openSum = kind === 'openings' ? rows.reduce((s, r) => s + (r.dc === 'Cr' ? -1 : 1) * Number(r.amount || 0), 0) : 0;
  const ledgerOpen = (ledger.balanceType === 'Cr' ? -1 : 1) * Number(ledger.openingBalance || 0);
  const diff = Math.round((ledgerOpen - openSum) * 100) / 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {kind === 'openings' && (
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center', background: Math.abs(diff) < 0.01 ? T.okBg : T.amberBg, border: '1px solid ' + (Math.abs(diff) < 0.01 ? '#a7f3d0' : '#fde68a'), borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
          <span>Opening balance of the account <b>{inr(Math.abs(ledgerOpen))} {ledgerOpen < 0 ? 'Cr' : 'Dr'}</b></span>
          <span>Bills entered <b>{inr(Math.abs(openSum))} {openSum < 0 ? 'Cr' : 'Dr'}</b></span>
          <b style={{ color: Math.abs(diff) < 0.01 ? T.cr : T.amber }}>{Math.abs(diff) < 0.01 ? 'Matches' : 'Difference ' + inr(Math.abs(diff)) + (diff < 0 ? ' Cr' : ' Dr')}</b>
        </div>
      )}
      <Box title={(f.id ? 'Change ' : 'Add ') + cfg.title.toLowerCase().replace(/s$/, '')} style={{ background: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, alignItems: 'end' }}>
          {kind === 'addresses' && <>
            <Field label="Label"><input style={inputStyle} value={f.label || ''} onChange={set('label')} placeholder="Mumbai branch" /></Field>
            <Field label="Address" required span={2}><input style={f.address ? inputStyle : mandStyle} value={f.address || ''} onChange={set('address')} /></Field>
            <Field label="City"><input style={inputStyle} value={f.city || ''} onChange={set('city')} /></Field>
            <Field label="State"><select style={inputStyle} value={f.state || ''} onChange={set('state')}><option value="">Select</option>{STATES.map(([c, n]) => <option key={c} value={n}>{c} - {n}</option>)}</select></Field>
            <Field label="PIN"><input style={inputStyle} value={f.pinCode || ''} onChange={set('pinCode')} /></Field>
            <Field label="GSTIN"><input style={inputStyle} value={f.gstin || ''} onChange={e => setF({ ...f, gstin: e.target.value.toUpperCase(), state: f.state || stateOfGstin(e.target.value) })} maxLength={15} /></Field>
            <Field label="Contact Person"><input style={inputStyle} value={f.contactPerson || ''} onChange={set('contactPerson')} /></Field>
            <Field label="Phone"><input style={inputStyle} value={f.phone || ''} onChange={set('phone')} /></Field>
            <Field label="Email"><input style={inputStyle} value={f.email || ''} onChange={set('email')} /></Field>
          </>}
          {kind === 'banks' && <>
            <Field label="Bank Name"><input style={inputStyle} value={f.bankName || ''} onChange={set('bankName')} /></Field>
            <Field label="Account Name"><input style={inputStyle} value={f.accountName || ''} onChange={set('accountName')} /></Field>
            <Field label="Account No" required><input style={f.accountNo ? inputStyle : mandStyle} value={f.accountNo || ''} onChange={set('accountNo')} /></Field>
            <Field label="IFSC"><input style={inputStyle} value={f.ifsc || ''} onChange={e => setF({ ...f, ifsc: e.target.value.toUpperCase() })} maxLength={11} /></Field>
            <Field label="Branch"><input style={inputStyle} value={f.branch || ''} onChange={set('branch')} /></Field>
            <Field label="SWIFT (overseas)"><input style={inputStyle} value={f.swift || ''} onChange={e => setF({ ...f, swift: e.target.value.toUpperCase() })} maxLength={11} /></Field>
          </>}
          {kind === 'openings' && <>
            <Field label="Bill / Doc No" required><input style={f.docNo ? inputStyle : mandStyle} value={f.docNo || ''} onChange={set('docNo')} /></Field>
            <Field label="Bill Date" required><input type="date" style={inputStyle} value={f.docDate || ''} onChange={set('docDate')} /></Field>
            <Field label="Due Date"><input type="date" style={inputStyle} value={f.dueDate || ''} onChange={set('dueDate')} /></Field>
            <Field label="Dr / Cr"><select style={inputStyle} value={f.dc || 'Dr'} onChange={set('dc')}><option>Dr</option><option>Cr</option></select></Field>
            <Field label="Amount" required><input style={{ ...(Number(f.amount) ? inputStyle : mandStyle), textAlign: 'right' }} value={f.amount ?? ''} onChange={set('amount')} inputMode="decimal" /></Field>
            <Field label="Job No"><input style={inputStyle} value={f.jobNo || ''} onChange={set('jobNo')} /></Field>
            <Field label="Remarks"><input style={inputStyle} value={f.remarks || ''} onChange={set('remarks')} /></Field>
          </>}
          {kind !== 'openings' && <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, height: 28, cursor: 'pointer' }}><input type="checkbox" checked={!!Number(f.isDefault)} onChange={set('isDefault')} /> Default</label>}
        </div>
      </Box>
      <ActionBar note={msg}>
        <Btn kind="save" onClick={save}>{f.id ? <Pencil size={13} /> : <Plus size={13} />} {f.id ? 'Update' : 'Add'}</Btn>
        <Btn kind="clear" onClick={() => { setF(cfg.blank); setMsg(''); }}><RotateCcw size={13} /> Clear</Btn>
      </ActionBar>
      {kind === 'openings' && (
        <Box title="Paste bills from Excel" right={<span style={{ fontWeight: 600, color: T.muted, fontSize: 10.5 }}>Columns: Bill no, Bill date (dd/mm/yyyy), Amount, Dr/Cr, Due date, Job no</span>} style={{ background: '#fff' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={3} placeholder="Copy the rows in Excel and paste here" style={{ ...inputStyle, height: 'auto', padding: 6, flex: 1, fontFamily: 'monospace' }} />
            <Btn kind="primary" onClick={importPaste} disabled={!paste.trim()}><Download size={13} /> Import</Btn>
          </div>
        </Box>
      )}
      <Grid title={cfg.title + ' (' + rows.length + ')'} maxHeight={300} rows={rows} rowKey={r => r.id} activeKey={f.id} onRow={r => { setF({ ...r }); setMsg(''); }}
        empty={'No ' + cfg.title.toLowerCase() + ' yet'}
        cols={[...cfg.cols.map(([k, l]) => ({ label: l, right: k === 'amount', wrap: k === 'address', render: r => (k.endsWith('Date') ? fmtDate(r[k]) : k === 'amount' ? inr(r[k]) : r[k] || '') })),
          ...(kind !== 'openings' ? [{ label: '', render: r => (Number(r.isDefault) ? <Badge tone="brand">Default</Badge> : '') }] : []),
          { label: '', render: r => <span onClick={e => { e.stopPropagation(); del(r); }} style={{ cursor: 'pointer', color: T.dr }}><Trash2 size={13} /></span> }]} />
    </div>
  );
}

export function LedgerScreen() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState({ total: 0, rows: [] });
  const [q, setQ] = useState('');
  const [gf, setGf] = useState('');
  const [flag, setFlag] = useState('');
  const [groups, setGroups] = useState([]);
  const [tds, setTds] = useState([]);
  const [allLedgers, setAllLedgers] = useState([]);
  const [form, setForm] = useState(blankLedger(params.get('group') || ''));
  const [info, setInfo] = useState(null);
  const [tab, setTab] = useState('account');
  const [msg, setMsg] = useState('');
  const loadList = (tries = 3) => api(`/api/accounts-hub/ledgers?q=${encodeURIComponent(q)}&groupId=${gf}&flag=${flag}&limit=1000`).then(setList).catch(() => { if (tries > 1) setTimeout(() => loadList(tries - 1), 1200); });
  useEffect(() => { const h = setTimeout(loadList, 250); return () => clearTimeout(h); }, [q, gf, flag]);
  useEffect(() => { api('/api/accounts-hub/groups-tree').then(setGroups).catch(() => {}); api('/api/accounts-hub/tds-schedule').then(setTds).catch(() => {}); lookup('ledgers').then(setAllLedgers); }, []);
  const open = (id) => api('/api/accounts-hub/ledgers/' + id).then(l => { setInfo(l); setMsg(''); setForm({ ...blankLedger(), ...Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v == null ? '' : v])) }); }).catch(e => setMsg(e.message));
  useEffect(() => { const id = params.get('ledger'); if (id) open(id); }, [params.get('ledger')]);
  const byId = useMemo(() => new Map(groups.map(g => [g.id, g])), [groups]);
  const pathOf = (g) => { const out = []; let x = g, n = 0; while (x && n++ < 20) { out.unshift(x.name); x = byId.get(x.parentId); } return out.join(' > '); };
  const grp = byId.get(Number(form.groupId));
  const isParty = grp && /sundry (debtors|creditors)/i.test(pathOf(grp));
  const isBank = grp && /bank|cash/i.test(pathOf(grp));
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value });
  const setGstin = (v) => { const g = v.toUpperCase().replace(/\s/g, ''); const f = { ...form, gstin: g }; if (g.length >= 12 && !form.pan) f.pan = g.slice(2, 12); if (g.length >= 2 && !form.state) f.state = stateOfGstin(g); if (g) { f.isGstApplicable = 1; f.isUnregistered = 0; } setForm(f); };
  const clear = () => { setForm(blankLedger(gf || '')); setInfo(null); setMsg(''); setTab('account'); const p = new URLSearchParams(params); p.delete('ledger'); p.delete('group'); setParams(p); };
  const save = async () => {
    setMsg('');
    if (!form.name.trim()) return setMsg('Enter the account name');
    if (!form.groupId) return setMsg('Choose the under group');
    if (Number(form.isBlacklisted) && !String(form.blacklistReason || '').trim()) { setTab('other'); return setMsg('Enter why the party is blacklisted'); }
    const body = { ...form }; ['addresses', 'banks', 'openings', 'groupName', 'nature', 'balance', 'side', 'entries', 'totalDr', 'totalCr', 'lastEntry', 'partyTdsLedgerName', 'createdAt', 'updatedAt', 'createdByName', 'modifiedByName'].forEach(k => delete body[k]);
    try {
      if (form.id) { await postJson('/api/accounts-hub/ledgers/' + form.id, body, 'PUT'); setMsg('Updated'); open(form.id); }
      else { const r = await postJson('/api/accounts-hub/ledgers', body); setMsg('Saved'); if (r && r.id) { const p = new URLSearchParams(params); p.set('ledger', r.id); setParams(p); } }
      lookup('ledgers', true); loadList();
    } catch (e) { setMsg('Not saved: ' + e.message); }
  };
  const del = async () => {
    if (!form.id || !window.confirm('Delete account "' + form.name + '"?')) return;
    try { await api('/api/accounts-hub/ledgers/' + form.id, { method: 'DELETE' }); lookup('ledgers', true); loadList(); clear(); setMsg('Deleted'); } catch (e) { setMsg('Not deleted: ' + e.message); }
  };
  const sel = form.id;
  const g3 = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 };
  const g4 = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 };
  const chk = (k, label, extra) => <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, height: 28, cursor: 'pointer', ...extra }}><input type="checkbox" checked={!!Number(form[k])} onChange={set(k)} /> {label}</label>;
  const n = (k) => (info && info[k] ? info[k].length : 0);
  const tabs = [{ id: 'account', label: 'Account' }, { id: 'other', label: 'Other details & MSME' }, ...(sel ? [{ id: 'addresses', label: 'Addresses (' + n('addresses') + ')' }, { id: 'banks', label: 'Bank accounts (' + n('banks') + ')' }, { id: 'openings', label: 'Opening bills (' + n('openings') + ')' }] : [])];
  const actions = (
    <ActionBar note={msg}>
      <Btn kind="save" onClick={save} disabled={!!sel}><Save size={13} /> Save</Btn>
      <Btn kind="save" onClick={save} disabled={!sel}><Pencil size={13} /> Modify</Btn>
      <Btn kind="danger" onClick={del} disabled={!sel}><Trash2 size={13} /> Delete</Btn>
      <Btn kind="clear" onClick={clear}><RotateCcw size={13} /> Clear</Btn>
      <Btn kind="plain" onClick={() => csv('Ledger_Accounts', [['accountCode', 'A/c Code'], ['name', 'Account'], ['groupName', 'Group'], ['gstin', 'GSTIN'], ['pan', 'PAN'], ['state', 'State'], ['msmeNo', 'MSME'], ['creditDays', 'Credit Days'], [r => inr(r.balance) + ' ' + r.side, 'Balance']], list.rows)} disabled={!list.rows.length}><Download size={13} /> Excel</Btn>
      {info && sel && <span style={{ marginLeft: 'auto', fontSize: 10.5, color: T.muted }}>Entered {info.createdByName ? 'by ' + info.createdByName + ' ' : ''}on {fmtDate(info.createdAt)}{info.modifiedByName || info.updatedAt !== info.createdAt ? ' | changed ' + (info.modifiedByName ? 'by ' + info.modifiedByName + ' ' : '') + 'on ' + fmtDate(info.updatedAt) : ''}</span>}
    </ActionBar>
  );
  return (
    <div style={twoPane} className="acc-two">
      <ListPanel title="Accounts" count={list.rows.length + (list.total > list.rows.length ? ' of ' + list.total : '')} search={q} onSearch={setQ} placeholder="Name, code, GSTIN or PAN"
        tools={<div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 6 }}>
          <select style={inputStyle} value={gf} onChange={e => setGf(e.target.value)}><option value="">All groups</option>{groups.map(g => <option key={g.id} value={g.id}>{pathOf(g)}</option>)}</select>
          <select style={inputStyle} value={flag} onChange={e => setFlag(e.target.value)}><option value="">All</option><option value="msme">MSME</option><option value="blacklisted">Blacklisted</option><option value="nogstin">No GSTIN</option><option value="inactive">Inactive</option></select>
        </div>}>
        {list.rows.map(l => (
          <div key={l.id} onClick={() => { const p = new URLSearchParams(params); p.set('ledger', l.id); setParams(p); }} style={{ ...rowStyle(String(sel) === String(l.id)), opacity: Number(l.isActive) === 0 ? 0.55 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
              <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', color: !l.balance ? T.muted : l.side === 'Dr' ? T.dr : T.cr }}>{l.balance ? inr(l.balance, 0) + ' ' + l.side : '-'}</span>
            </div>
            <div style={{ fontSize: 10, color: T.muted, display: 'flex', gap: 5, alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {Number(l.isBlacklisted) ? <Badge tone="bad">Blacklisted</Badge> : null}{l.msmeNo ? <Badge tone="brand">MSME</Badge> : null}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{[l.accountCode, l.groupName, l.gstin].filter(Boolean).join(' | ')}</span>
            </div>
          </div>
        ))}
        {!list.rows.length && <div style={{ padding: 20, textAlign: 'center', fontSize: 11.5, color: T.muted }}>{q || gf || flag ? 'No account matches' : 'No accounts yet'}</div>}
      </ListPanel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        {info && sel && (
          <div style={{ background: '#fff', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr)) auto', gap: 12, alignItems: 'center' }}>
            <Stat label="Current balance"><span style={{ color: info.balance ? (info.side === 'Dr' ? T.dr : T.cr) : '#0f172a' }}>{balTxt(info.balance, info.side)}</span></Stat>
            <Stat label="Total debit">{inr(info.totalDr)}</Stat>
            <Stat label="Total credit">{inr(info.totalCr)}</Stat>
            <Stat label="Entries">{info.entries}</Stat>
            <Stat label="Last entry">{info.lastEntry ? fmtDate(info.lastEntry) : '-'}</Stat>
            <Btn kind="primary" onClick={() => nav('/accounts-hub?item=ledger&ledger=' + sel)}><FileText size={13} /> Ledger statement</Btn>
          </div>
        )}
        {info && sel && Number(info.isBlacklisted) ? <div style={{ padding: '8px 12px', borderRadius: 6, background: T.drBg, border: '1px solid #fecaca', color: T.dr, fontSize: 12, fontWeight: 700 }}>Blacklisted: {info.blacklistReason || 'no reason given'}</div> : null}

        <div>
          <div className="tab-container" style={{ marginBottom: 0 }}>
            {tabs.map(t => <div key={t.id} className={'custom-tab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>{t.label}</div>)}
          </div>
          <div style={{ background: '#fff', border: '1px solid #94a3b8', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tab === 'account' && <>
              <Box title={sel ? 'Account details - ' + (info ? info.name : '') : 'New account'} style={{ background: '#fff' }}>
                <div style={g4}>
                  <Field label="Account Name" required span={2}><input style={form.name ? inputStyle : mandStyle} value={form.name} onChange={set('name')} autoFocus={!sel} /></Field>
                  <Field label="Under Group" required span={2}>
                    <select style={form.groupId ? inputStyle : mandStyle} value={form.groupId} onChange={set('groupId')}><option value="">Select</option>{groups.map(g => <option key={g.id} value={g.id}>{pathOf(g)}</option>)}</select>
                  </Field>
                  <Field label="Account Type"><select style={inputStyle} value={form.accountType || 'Personal'} onChange={set('accountType')}><option>Personal</option><option>Ledger</option></select></Field>
                  <Field label="Group Type"><input readOnly style={roStyle} value={grp ? grp.nature + (isParty ? ' - party' : isBank ? ' - bank / cash' : '') : ''} /></Field>
                  <Field label="Opening Balance">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px', gap: 6 }}>
                      <input style={{ ...inputStyle, textAlign: 'right' }} value={form.openingBalance} onChange={set('openingBalance')} inputMode="decimal" placeholder="0.00" />
                      <select style={inputStyle} value={form.balanceType} onChange={set('balanceType')}><option>Dr</option><option>Cr</option></select>
                    </div>
                  </Field>
                  <Field label="Current Balance"><input readOnly style={{ ...roStyle, textAlign: 'right', fontWeight: 700 }} value={info && sel ? balTxt(info.balance, info.side) : ''} /></Field>
                </div>
              </Box>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }} className="acc-two-b">
                <Box title="GST & TDS" style={{ background: '#fff' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                    <Field label="GSTIN" hint={form.gstin ? stateOfGstin(form.gstin) : Number(form.isUnregistered) ? 'Un-registered party' : 'State and PAN fill in from it'}><input style={inputStyle} value={form.gstin} onChange={e => setGstin(e.target.value)} maxLength={15} placeholder="07AAACC1234D1Z5" disabled={!!Number(form.isUnregistered)} /></Field>
                    <Field label="PAN"><input style={inputStyle} value={form.pan} onChange={e => setForm({ ...form, pan: e.target.value.toUpperCase() })} maxLength={10} placeholder="AAACC1234D" /></Field>
                    <Field label="Taxability"><select style={inputStyle} value={form.taxability} onChange={set('taxability')}><option value="">Select</option><option>Taxable</option><option>Exempt</option><option>Nil Rated</option><option>Non-GST</option></select></Field>
                    <Field label="HSN / SAC and GST %">
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px', gap: 6 }}><input style={inputStyle} value={form.hsnSac} onChange={set('hsnSac')} placeholder="996531" /><input style={{ ...inputStyle, textAlign: 'right' }} value={form.gstRate} onChange={set('gstRate')} placeholder="%" /></div>
                    </Field>
                    <div style={{ gridColumn: 'span 2', display: 'flex', gap: 14, flexWrap: 'wrap' }}>{chk('isGstApplicable', 'GST applicable')}{chk('isUnregistered', 'Un-registered')}{chk('isComposite', 'Composite GST')}</div>
                    <div style={{ gridColumn: 'span 2', display: 'flex', gap: 14, flexWrap: 'wrap' }}>{chk('isTdsApplicable', 'Apply TDS')}{chk('isTdsExempt', 'Exempt TDS')}{chk('isTdsDeductible', 'Party deducts TDS from us')}</div>
                    <Field label="TDS Section"><select style={inputStyle} value={form.tdsNatureId} disabled={!Number(form.isTdsApplicable) || !!Number(form.isTdsExempt)} onChange={set('tdsNatureId')}><option value="">Select</option>{tds.map(t => <option key={t.id} value={t.id}>{t.section} - {t.name} ({Number(t.rate)}%)</option>)}</select></Field>
                    <Field label="Deductee Type"><select style={inputStyle} value={form.deducteeType} disabled={!Number(form.isTdsApplicable)} onChange={set('deducteeType')}><option value="">Select</option><option>Company</option><option>Individual / HUF</option><option>Firm / LLP</option><option>Others</option></select></Field>
                    <Field label="Party TDS A/c" span={2}><LedgerPicker id="ptds" list={allLedgers} value={form.partyTdsLedgerId} onChange={v => setForm({ ...form, partyTdsLedgerId: v })} placeholder="TDS ledger used for this party" /></Field>
                  </div>
                </Box>
                <Box title="Credit control & bank" style={{ background: '#fff' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                    <Field label="Credit Days" hint="Overdue after these days (30 when blank)"><input style={{ ...inputStyle, textAlign: 'right' }} value={form.creditDays} onChange={set('creditDays')} inputMode="numeric" /></Field>
                    <Field label="Credit Limit"><input style={{ ...inputStyle, textAlign: 'right' }} value={form.creditLimit} onChange={set('creditLimit')} inputMode="decimal" /></Field>
                    <Field label="Credit Mode"><select style={inputStyle} value={form.creditMode || 'Credit'} onChange={set('creditMode')}><option>Credit</option><option>Advance</option><option>Cash</option><option>Against delivery</option></select></Field>
                    <Field label="Monthly Budget"><input style={{ ...inputStyle, textAlign: 'right' }} value={form.monthlyBudget} onChange={set('monthlyBudget')} inputMode="decimal" /></Field>
                    <div style={{ gridColumn: 'span 2', display: 'flex', gap: 14, flexWrap: 'wrap' }}>{chk('maintainBillByBill', 'Keep bill-by-bill')}{chk('costCentresApplicable', 'Cost centres apply')}</div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase', margin: '12px 0 6px' }}>Main bank account {sel ? '(more in Bank accounts)' : ''}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                    <Field label="Bank Name"><input style={inputStyle} value={form.bankName} onChange={set('bankName')} /></Field>
                    <Field label="Account No"><input style={inputStyle} value={form.bankAccount} onChange={set('bankAccount')} /></Field>
                    <Field label="IFSC"><input style={inputStyle} value={form.bankIfsc} onChange={e => setForm({ ...form, bankIfsc: e.target.value.toUpperCase() })} maxLength={11} /></Field>
                  </div>
                </Box>
              </div>
              <Box title={'Registered address & contact' + (sel ? ' (more in Addresses)' : '')} style={{ background: '#fff' }}>
                <div style={g4}>
                  <Field label="Address" span={2}><textarea rows={2} style={{ ...inputStyle, height: 'auto', padding: 6 }} value={form.address} onChange={set('address')} /></Field>
                  <Field label="State"><select style={inputStyle} value={form.state} onChange={set('state')}><option value="">Select</option>{STATES.map(([c, nm]) => <option key={c} value={nm}>{c} - {nm}</option>)}</select></Field>
                  <Field label="PIN / Country"><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}><input style={inputStyle} value={form.pinCode} onChange={set('pinCode')} maxLength={10} /><input style={inputStyle} value={form.country} onChange={set('country')} /></div></Field>
                  <Field label="Contact Person"><input style={inputStyle} value={form.contactPerson} onChange={set('contactPerson')} /></Field>
                  <Field label="Phone"><input style={inputStyle} value={form.phone} onChange={set('phone')} /></Field>
                  <Field label="Email" span={2}><input style={inputStyle} value={form.email} onChange={set('email')} /></Field>
                </div>
              </Box>
              {actions}
            </>}
            {tab === 'other' && <>
              <Box title="Other details" style={{ background: '#fff' }}>
                <div style={g4}>
                  <Field label="A/c Code"><input style={inputStyle} value={form.accountCode} onChange={e => setForm({ ...form, accountCode: e.target.value.toUpperCase() })} placeholder="Short code" /></Field>
                  <Field label="Dealing Branch"><input style={inputStyle} value={form.dealingBranch} onChange={set('dealingBranch')} placeholder="DEL" /></Field>
                  <Field label="Business Type"><select style={inputStyle} value={form.businessType} onChange={set('businessType')}><option value="">Select</option>{['Exporter', 'Importer', 'Exporter & Importer', 'Freight Forwarder', 'Airline', 'Shipping Line', 'Transporter', 'CHA', 'Overseas Agent', 'Vendor', 'Employee', 'Other'].map(b => <option key={b}>{b}</option>)}</select></Field>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>{chk('isActive', 'Active (untick to stop using this account)')}</div>
                  <div style={{ gridColumn: 'span 4', display: 'flex', gap: 18, flexWrap: 'wrap' }}>{chk('isFixedDeposit', 'Fixed deposit account')}{chk('isBlacklisted', 'Blacklist party', { color: Number(form.isBlacklisted) ? T.dr : undefined })}</div>
                  {!!Number(form.isBlacklisted) && <Field label="Why blacklisted" required span={4}><input style={form.blacklistReason ? inputStyle : mandStyle} value={form.blacklistReason} onChange={set('blacklistReason')} placeholder="Cheque bounced, dispute, legal ..." /></Field>}
                </div>
              </Box>
              <Box title="MSME (Udyam)" right={<span style={{ fontWeight: 600, color: T.muted, fontSize: 10.5 }}>Dues to an MSME supplier must be paid within 45 days</span>} style={{ background: '#fff' }}>
                <div style={g4}>
                  <Field label="Udyam Registration No" span={2}><input style={inputStyle} value={form.msmeNo} onChange={e => setForm({ ...form, msmeNo: e.target.value.toUpperCase() })} placeholder="UDYAM-DL-07-0012345" /></Field>
                  <Field label="Enterprise"><select style={inputStyle} value={form.msmeType} onChange={set('msmeType')}><option value="">Select</option><option>Micro</option><option>Small</option><option>Medium</option></select></Field>
                  <Field label="Activity"><select style={inputStyle} value={form.msmeActivity} onChange={set('msmeActivity')}><option value="">Select</option><option>Manufacturing</option><option>Services</option><option>Trading</option></select></Field>
                  <Field label="Agreed Payment Days" hint="Up to 45"><input style={{ ...inputStyle, textAlign: 'right' }} value={form.msmeAgreementDays} onChange={set('msmeAgreementDays')} inputMode="numeric" /></Field>
                </div>
              </Box>
              {actions}
            </>}
            {sel && info && ['addresses', 'banks', 'openings'].includes(tab) && <ChildList kind={tab} ledger={info} onChanged={() => open(sel)} />}
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 900px) { .acc-two, .acc-two-b { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

// ================================================================== TDS SCHEDULE
export function TdsScreen() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ section: '', name: '', rate: '', rateWithoutPan: '20', exemptionLimit: '' });
  const [msg, setMsg] = useState('');
  const load = () => api('/api/accounts-hub/tds-schedule').then(setRows).catch(e => setMsg('Not loaded: ' + e.message));
  useEffect(() => { load(); }, []);
  const clear = () => { setForm({ section: '', name: '', rate: '', rateWithoutPan: '20', exemptionLimit: '' }); setMsg(''); };
  const save = async () => {
    setMsg('');
    try { if (form.id) await postJson('/api/accounts-hub/tds-schedule/' + form.id, form, 'PUT'); else await postJson('/api/accounts-hub/tds-schedule', form); setMsg(form.id ? 'Updated' : 'Saved'); lookup('tdsnatures', true); load(); if (!form.id) clear(); }
    catch (e) { setMsg('Not saved: ' + e.message); }
  };
  const del = async () => {
    if (!form.id || !window.confirm('Delete ' + form.section + ' - ' + form.name + '?')) return;
    try { await api('/api/accounts-hub/tds-schedule/' + form.id, { method: 'DELETE' }); setMsg('Deleted'); lookup('tdsnatures', true); load(); clear(); } catch (e) { setMsg('Not deleted: ' + e.message); }
  };
  const std = async () => { try { const r = await postJson('/api/accounts-hub/tds-schedule/standard', {}); setMsg(r.added ? 'Saved ' + r.added + ' standard sections' : 'Standard sections are already there'); lookup('tdsnatures', true); load(); } catch (e) { setMsg('Not added: ' + e.message); } };
  const shown = rows.filter(r => !q || (r.section + ' ' + r.name).toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Box title={form.id ? 'TDS section - ' + form.section : 'New TDS section'} style={{ background: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 2fr) repeat(3, minmax(0, 1fr))', gap: 12 }}>
          <Field label="Section" required><input style={form.section ? inputStyle : mandStyle} value={form.section} onChange={e => setForm({ ...form, section: e.target.value.toUpperCase() })} placeholder="194C" /></Field>
          <Field label="Nature Of Payment" required><input style={form.name ? inputStyle : mandStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Payment to contractors - others" /></Field>
          <Field label="Rate %" required><input style={{ ...inputStyle, textAlign: 'right' }} value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} inputMode="decimal" /></Field>
          <Field label="Rate Without PAN %"><input style={{ ...inputStyle, textAlign: 'right' }} value={form.rateWithoutPan} onChange={e => setForm({ ...form, rateWithoutPan: e.target.value })} inputMode="decimal" /></Field>
          <Field label="Threshold (yearly)"><input style={{ ...inputStyle, textAlign: 'right' }} value={form.exemptionLimit} onChange={e => setForm({ ...form, exemptionLimit: e.target.value })} inputMode="decimal" placeholder="0" /></Field>
        </div>
      </Box>
      <ActionBar note={msg}>
        <Btn kind="save" onClick={save} disabled={!!form.id}><Save size={13} /> Save</Btn>
        <Btn kind="save" onClick={save} disabled={!form.id}><Pencil size={13} /> Modify</Btn>
        <Btn kind="danger" onClick={del} disabled={!form.id}><Trash2 size={13} /> Delete</Btn>
        <Btn kind="clear" onClick={clear}><RotateCcw size={13} /> Clear</Btn>
        <Btn kind="plain" onClick={std}><Wand2 size={13} /> Add standard sections</Btn>
      </ActionBar>
      <Grid title={'TDS schedule (' + shown.length + ')'} maxHeight="calc(100vh - 400px)" rows={shown} rowKey={r => r.id} activeKey={form.id}
        onRow={r => { setForm({ ...r, rate: String(Number(r.rate)), rateWithoutPan: String(Number(r.rateWithoutPan)), exemptionLimit: String(Number(r.exemptionLimit) || '') }); setMsg(''); }}
        right={<input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" style={{ ...inputStyle, height: 24, width: 180 }} />}
        empty="No TDS sections yet - click Add standard sections"
        cols={[{ label: 'Section', render: r => <b>{r.section}</b> }, { label: 'Nature of payment', render: r => r.name }, { label: 'Rate %', right: true, render: r => Number(r.rate) },
          { label: 'Without PAN %', right: true, render: r => Number(r.rateWithoutPan) }, { label: 'Threshold', right: true, render: r => (Number(r.exemptionLimit) ? inr(r.exemptionLimit, 0) : '-') },
          { label: 'Ledgers using it', right: true, render: r => r.ledgers || '-' }]} />
    </div>
  );
}

// ================================================================== MAP CSR POSTING
export function MapCsrScreen() {
  const [rows, setRows] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [edit, setEdit] = useState({});
  const [only, setOnly] = useState(false);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const load = () => api('/api/accounts-hub/masters/gstcharges').then(setRows).catch(e => setMsg('Not loaded: ' + e.message));
  useEffect(() => { load(); lookup('ledgers').then(setLedgers); }, []);
  const val = (r, k) => (edit[r.id] && k in edit[r.id] ? edit[r.id][k] : r[k]);
  const change = (r, k, v) => setEdit(e => ({ ...e, [r.id]: { ...(e[r.id] || {}), [k]: v } }));
  const saveAll = async () => {
    const ids = Object.keys(edit); if (!ids.length) return setMsg('Nothing changed');
    try { for (const id of ids) { const r = rows.find(x => String(x.id) === id); await postJson('/api/accounts-hub/masters/gstcharges/' + id, { ...r, ...edit[id] }, 'PUT'); } setEdit({}); setMsg('Saved ' + ids.length + ' charges'); load(); }
    catch (e) { setMsg('Not saved: ' + e.message); }
  };
  const unmapped = rows.filter(r => !r.ledgerId || !r.expenseLedgerId).length;
  const shown = rows.filter(r => (!only || !val(r, 'ledgerId') || !val(r, 'expenseLedgerId')) && (!q || String(r.chargeName).toLowerCase().includes(q.toLowerCase())));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: '#fff', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <Stat label="Charges">{rows.length}</Stat>
        <Stat label="Fully mapped">{rows.length - unmapped}</Stat>
        <Stat label="Need a ledger"><span style={{ color: unmapped ? T.dr : T.cr }}>{unmapped}</span></Stat>
        <span style={{ fontSize: 11.5, color: T.muted, flex: 1, minWidth: 220 }}>When a job is billed (CSR posting) each charge posts to its income ledger; vendor bills for the same charge post to its expense ledger.</span>
      </div>
      <ActionBar note={msg}>
        <Btn kind="save" onClick={saveAll} disabled={!Object.keys(edit).length}><Save size={13} /> Save changes {Object.keys(edit).length ? '(' + Object.keys(edit).length + ')' : ''}</Btn>
        <Btn kind="clear" onClick={() => { setEdit({}); setMsg(''); }}><RotateCcw size={13} /> Undo</Btn>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, cursor: 'pointer' }}><input type="checkbox" checked={only} onChange={e => setOnly(e.target.checked)} /> Only charges without a ledger</label>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search charge" style={{ ...inputStyle, width: 200, marginLeft: 'auto' }} />
      </ActionBar>
      <Grid title="Charge to ledger mapping" maxHeight="calc(100vh - 380px)" rows={shown} rowKey={r => r.id}
        empty={rows.length ? 'No charge matches' : 'No charges yet - add them in Masters, GST Charges'}
        cols={[
          { label: 'Charge', render: r => <b>{r.chargeName}</b> }, { label: 'SAC', render: r => r.sacCode || '' }, { label: 'GST %', right: true, render: r => (r.gstRate != null ? Number(r.gstRate) : '') },
          { label: 'Income ledger (billing)', w: '28%', render: r => <LedgerPicker id={'in' + r.id} list={ledgers} value={val(r, 'ledgerId') || ''} onChange={v => change(r, 'ledgerId', v)} placeholder="Income ledger" /> },
          { label: 'Expense ledger (vendor bills)', w: '28%', render: r => <LedgerPicker id={'ex' + r.id} list={ledgers} value={val(r, 'expenseLedgerId') || ''} onChange={v => change(r, 'expenseLedgerId', v)} placeholder="Expense ledger" /> },
          { label: 'RCM', render: r => <input type="checkbox" checked={!!Number(val(r, 'rcm'))} onChange={e => change(r, 'rcm', e.target.checked ? 1 : 0)} /> },
          { label: '', render: r => (edit[r.id] ? <Badge tone="warn">Changed</Badge> : (!r.ledgerId || !r.expenseLedgerId) ? <Badge tone="bad">Missing</Badge> : <Badge tone="ok">OK</Badge>) },
        ]} />
    </div>
  );
}
