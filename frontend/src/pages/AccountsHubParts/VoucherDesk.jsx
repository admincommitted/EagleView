// 04-Nov-2026 (v3): voucher screens laid out like iCAFFE - an entry tab and a Search tab.
// Receipt / Payment / Remittance: boxes on top (voucher, cash-bank book, account, amount + cheque), an entry strip
// (docket, TDS, bank charge, due bills) with Add, the "Accounts Information" grid, then narration and totals.
// Journal / Contra / Inter branch: header box, an Account - Amount - Dr/Cr strip with Add, the grid, Dr / Cr totals.
// Everything is saved through POST /api/vouchers (Dr = Cr, closed months refused).
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGlobalContext } from '../../GlobalContext';
import { Plus, Search, Printer, Trash2, Pencil, Save, RotateCcw, FileText, ListChecks, Wand2, ArrowLeft, Copy, History, X } from 'lucide-react';
import { printVoucher } from './printVoucher';
import { PurchaseForm, PURCHASE_DESKS, PurchaseInfoBox, purchaseFromVoucher } from './PurchaseDesk';
import { AttachDocs, newDraftKey, claimDocs, readExcel, sampleExcel, ExcelButtons, ledgerByName } from './extras';
import {

  T, inr, fmtDate, todayIso, fyStart, api, postJson, lookup, Box, Sheet, Btn, ActionBar, Field, Row, inputStyle, roStyle, mandStyle,
  Money, Badge, statusTone, LedgerPicker, BalanceStrip, PostingTable, Grid, Empty, useBalance, PartyNote,
} from './ui';

// 05-Nov-2026: iCAFFE numbering - the voucher no comes from the branch + division series (Settings > Number Series (iCAFFE)),
// BA / CA / JN, and is given on Save. The division comes from the job no (NDL/AE/...) or is chosen.
export const DIV_OPTS = [['AE', 'Export Air'], ['AI', 'Import Air'], ['SE', 'Export Sea'], ['SI', 'Import Sea']];
export const divFrom = (v) => { const m = /(?:^|\/|-)(AE|AI|SE|SI)(?:\/|-|$)/.exec(String(v || '').toUpperCase()); return m ? m[1] : ''; };
export const nextVoucherNo = (typeId, q) => api('/api/vouchers/next-number/' + typeId + '?' + new URLSearchParams(Object.entries(q).filter(([, v]) => v)).toString());

const BANK_GROUPS = 'Bank Accounts,Cash-in-Hand,Bank OD A/c';
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'HKD', 'SAR'];
const PAY_BY = ['Cheque', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'Cash', 'DD', 'Wire transfer'];
export const DESKS = {
  receipt: { base: 'Receipt', title: 'Receipt', mode: 'cash', partySide: 'Cr', pending: 'receivable' },
  payment: { base: 'Payment', title: 'Payment', mode: 'cash', partySide: 'Dr', pending: 'payable' },
  remittance: { base: 'Receipt', title: 'Remittance', mode: 'cash', fcy: true, partySide: 'Cr', pending: 'receivable', filterFcy: true },
  remonaccount: { base: 'Receipt', title: 'Remittance (On Account)', mode: 'cash', fcy: true, onAccount: true, partySide: 'Cr', pending: 'receivable', filterFcy: true },
  contra: { base: 'Contra', title: 'Contra Voucher', mode: 'lines', banksOnly: true },
  journal: { base: 'Journal', title: 'Journal Voucher', mode: 'lines' },
  interbranch: { base: 'Journal', title: 'Inter Branch Transfer', mode: 'lines', branch: true },
  ...Object.fromEntries(Object.entries(PURCHASE_DESKS).map(([k, v]) => [k, { base: 'Purchase', searchBase: 'Purchase,Debit Note', desk: k, title: v.title, mode: 'purchase', job: v.needJob ? 'yes' : 'no' }])),
};
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isFinite(n) ? n : 0; };
const r2 = (v) => Math.round(v * 100) / 100;
// search runs to the end of the financial year, so vouchers dated after today (post-dated) are found too
const fyEnd = () => { const c = window.__acctx || {}; return c.fyEnd ? String(c.fyEnd).slice(0, 10) : (Number(fyStart().slice(0, 4)) + 1) + '-03-31'; }; // top-bar year (06-Nov-2026)

export default function VoucherDesk({ desk }) {
  const cfg = DESKS[desk];
  const [params, setParams] = useSearchParams();
  const openId = params.get('voucher');
  const [tab, setTab] = useState('entry');
  const [typeId, setTypeId] = useState(null);
  const [formKey, setFormKey] = useState(1);
  useEffect(() => { lookup('voucher-types').then(ts => { const t = (ts || []).find(x => x.baseType === cfg.base); setTypeId(t ? t.id : null); }); }, [desk]);
  useEffect(() => { if (openId) setTab('entry'); }, [openId]);

  const [edit, setEdit] = useState(null); // { voucher, mode: 'modify' | 'copy' }
  const [draftKey, setDraftKey] = useState(newDraftKey); // attachments of a voucher not saved yet
  const openVoucher = (id) => { setEdit(null); const p = new URLSearchParams(params); p.set('voucher', id); setParams(p); setTab('entry'); setFormKey(k => k + 1); };
  const startNew = () => { setDraftKey(newDraftKey()); setEdit(null); const p = new URLSearchParams(params); p.delete('voucher'); setParams(p); setFormKey(k => k + 1); setTab('entry'); };
  const saved = (id) => { if (id) claimDocs(draftKey, id).then(() => { setDraftKey(newDraftKey()); openVoucher(id); }); else startNew(); };
  const modify = (v) => { setEdit({ voucher: v, mode: 'modify' }); setTab('entry'); setFormKey(k => k + 1); };
  const [finder, setFinder] = useState(null); // 'modify' | 'delete' | 'print' - iCAFFE's Modify / Delete / Print on the entry screen
  const actions = (
    <>
      <Btn kind="plain" onClick={() => setFinder('modify')}><Pencil size={13} /> Modify</Btn>
      <Btn kind="danger" onClick={() => setFinder('delete')}><Trash2 size={13} /> Delete</Btn>
      <Btn kind="plain" onClick={() => setFinder('print')}><Printer size={13} /> Print</Btn>
    </>
  );
  // which form a saved voucher opens in for Modify / Copy: its own form when its lines fit it, else the Dr / Cr form
  const formFor = (v) => (cfg.mode === 'cash' && ['Receipt', 'Payment'].includes(v.baseType) && cashFromVoucher(v, cfg) ? 'cash'
    : cfg.mode === 'purchase' && ['Purchase', 'Debit Note'].includes(v.baseType) && purchaseFromVoucher(v) ? 'purchase' : 'lines');
  const copy = (v) => { setDraftKey(newDraftKey()); setEdit({ voucher: v, mode: 'copy' }); const p = new URLSearchParams(params); p.delete('voucher'); setParams(p); setTab('entry'); setFormKey(k => k + 1); };

  return (
    <Sheet tabs={[{ id: 'entry', label: cfg.title, icon: FileText }, { id: 'search', label: 'Search', icon: Search }]} tab={tab} onTab={setTab}
      right={openId && tab === 'entry' ? <Btn small kind="save" onClick={startNew}><Plus size={12} /> New {cfg.title}</Btn> : null}>
      {tab === 'search' && <SearchTab cfg={cfg} onOpen={openVoucher} activeId={openId} onCopy={copy} />}
      {tab === 'entry' && finder && !edit && <FindVoucher cfg={cfg} action={finder} onClose={() => setFinder(null)} onModify={v => { setFinder(null); const p = new URLSearchParams(params); p.delete('voucher'); setParams(p); modify(v); }} />}
      {tab === 'entry' && edit && (() => {
        const v = edit.voucher; const tid = edit.mode === 'modify' ? v.voucherTypeId : typeId; const eid = edit.mode === 'modify' ? v.id : null;
        const back = () => (edit.mode === 'modify' ? openVoucher(v.id) : startNew()); const f = formFor(v);
        if (f === 'cash') return <CashForm key={formKey} cfg={cfg} typeId={tid} initial={v} editId={eid} onSaved={saved} onClear={back} />;
        if (f === 'purchase') return <PurchaseForm key={formKey} desk={desk} typeId={tid} initial={v} editId={eid} onSaved={saved} onClear={back} draftKey={draftKey} />;
        return <LinesForm key={formKey} cfg={{ ...cfg, mode: 'lines', banksOnly: cfg.banksOnly && v.baseType === 'Contra' }} typeId={tid} initial={v} editId={eid} onSaved={saved} onClear={back} />;
      })()}
      {tab === 'entry' && !edit && openId && <VoucherView key={formKey} id={openId} onNew={startNew} onSearch={() => setTab('search')} onModify={modify} onCopy={copy} onDeleted={startNew} />}
      {tab === 'entry' && !edit && !openId && !typeId && <Empty title={'Voucher type "' + cfg.base + '" is missing'}>Add it in Masters, Groups, Voucher types, then come back.</Empty>}
      {tab === 'entry' && !edit && !openId && typeId && cfg.mode === 'purchase' && <PurchaseForm key={formKey} desk={desk} typeId={typeId} onSaved={saved} onClear={startNew} draftKey={draftKey} actions={actions} />}
      {tab === 'entry' && !edit && !openId && typeId && cfg.mode === 'cash' && <CashForm key={formKey} cfg={cfg} typeId={typeId} onSaved={saved} onClear={startNew} actions={actions} />}
      {tab === 'entry' && !edit && !openId && typeId && cfg.mode === 'lines' && <LinesForm key={formKey} cfg={cfg} typeId={typeId} onSaved={saved} onClear={startNew} actions={actions} />}
      {tab === 'entry' && !openId && (edit ? edit.mode === 'modify' ? <AttachDocs voucherId={edit.voucher.id} /> : <AttachDocs draftKey={draftKey} /> : typeId ? <AttachDocs draftKey={draftKey} /> : null)}
    </Sheet>
  );
}

// ------------------------------------------------------------------ Modify / Delete / Print from the entry screen: pick the voucher
const FIND_TITLE = { modify: 'Choose the voucher to modify', delete: 'Choose the voucher to delete', print: 'Choose the voucher to print' };
function FindVoucher({ cfg, action, onClose, onModify }) {
  const [f, setF] = useState({ vno: '', from: fyStart(), to: fyEnd(), q: '' });
  const [rows, setRows] = useState(null); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(0);
  const run = (ff = f) => {
    const qs = new URLSearchParams({ base: cfg.searchBase || cfg.base, from: ff.from, to: ff.to });
    if (ff.vno) qs.set('vno', ff.vno); if (ff.q) qs.set('q', ff.q); if (cfg.job) qs.set('job', cfg.job); if (cfg.filterFcy) qs.set('fcy', '1'); if (cfg.desk) qs.set('desk', cfg.desk);
    setRows(null); api('/api/accounts-hub/vouchers?' + qs.toString()).then(r => setRows(r.slice(0, 200))).catch(e => { setRows([]); setMsg(e.message); });
  };
  useEffect(() => { run(); }, []);
  const pick = async (row) => {
    setMsg(''); setBusy(row.id);
    try {
      const v = await api('/api/accounts-hub/vouchers/' + row.id);
      if (action === 'modify') { if (/approv/i.test(v.status || '') && !window.confirm(v.voucherNumber + ' is approved. Modifying it sends it back for approval. Continue?')) { setBusy(0); return; } onModify(v); return; }
      if (action === 'print') { if (!printVoucher(v)) setMsg('Allow pop-ups for this site to print'); }
      if (action === 'delete') {
        if (!window.confirm('Delete ' + (v.typeName || '') + ' ' + v.voucherNumber + ' dated ' + fmtDate(v.date) + ' for ' + inr(v.totalAmount) + '? It is removed from the books; the audit trail keeps a copy.')) { setBusy(0); return; }
        await api('/api/accounts-hub/vouchers/' + v.id, { method: 'DELETE' }); setMsg('Deleted ' + v.voucherNumber); run();
      }
    } catch (e) { setMsg((action === 'delete' ? 'Not deleted: ' : 'Could not open: ') + e.message); }
    setBusy(0);
  };
  const acc = (v) => String(v.accounts || '').split('|').filter(Boolean).map(s2 => s2.split('~')[0]).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3).join(', ');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const key = (e) => e.key === 'Enter' && run();
  const verb = action === 'modify' ? 'Modify' : action === 'delete' ? 'Delete' : 'Print';
  return (
    <Box title={FIND_TITLE[action]} right={<span onClick={onClose} style={{ cursor: 'pointer' }} title="Close"><X size={13} /></span>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 1fr) minmax(130px, 1fr) minmax(130px, 1fr) minmax(200px, 2fr) auto', gap: 10, alignItems: 'end' }} className="acc-strip">
        <Field label="Voucher No"><input autoFocus style={inputStyle} value={f.vno} onChange={set('vno')} onKeyDown={key} /></Field>
        <Field label="From"><input type="date" style={inputStyle} value={f.from} onChange={set('from')} /></Field>
        <Field label="To"><input type="date" style={inputStyle} value={f.to} onChange={set('to')} /></Field>
        <Field label="Account / ref / narration"><input style={inputStyle} value={f.q} onChange={set('q')} onKeyDown={key} /></Field>
        <Btn kind="primary" onClick={() => run()}><Search size={13} /> Find</Btn>
      </div>
      {msg && <div style={{ fontSize: 11.5, fontWeight: 700, color: /^Not|Could/.test(msg) ? T.dr : T.cr, marginTop: 8 }}>{msg}</div>}
      <div style={{ marginTop: 10 }}>
        <Grid title={rows ? rows.length + ' voucher' + (rows.length === 1 ? '' : 's') + (rows.length === 200 ? ' (first 200 - narrow the search)' : '') : 'Finding'} maxHeight={280} rows={rows || []} rowKey={v => v.id}
          empty={rows ? 'No voucher for this search' : 'Finding'}
          cols={[
            { label: 'Voucher No.', render: v => <b style={{ color: T.head }}>{v.voucherNumber}</b> }, { label: 'Type', render: v => v.typeName }, { label: 'Date', render: v => fmtDate(v.date) },
            { label: 'Accounts', wrap: true, render: v => acc(v) }, { label: 'Ref', render: v => v.refNo || '' }, { label: 'Amount', right: true, render: v => <Money v={v.totalAmount} strong /> },
            { label: 'Status', render: v => <Badge tone={statusTone(v.status)}>{v.status || 'Pending'}</Badge> },
            { label: '', render: v => <Btn small kind={action === 'delete' ? 'danger' : action === 'modify' ? 'save' : 'primary'} disabled={!!busy} onClick={() => pick(v)}>{action === 'delete' ? <Trash2 size={11} /> : action === 'modify' ? <Pencil size={11} /> : <Printer size={11} />} {busy === v.id ? '...' : verb}</Btn> },
          ]} />
      </div>
    </Box>
  );
}

// ------------------------------------------------------------------ search tab (iCAFFE filters)
const blankSearch = () => ({ from: fyStart(), to: fyEnd(), q: '', status: '', ledgerId: '', vno: '', refNo: '', jobNo: '', branch: '', amount: '', narration: '' });
function SearchTab({ cfg, onOpen, activeId, onCopy }) {
  const [f, setF] = useState(blankSearch());
  const [list, setList] = useState([]); const [busy, setBusy] = useState(false);
  const [ledgers, setLedgers] = useState([]); const [years, setYears] = useState([]);
  const [more, setMore] = useState(false); const [msg, setMsg] = useState('');
  useEffect(() => { lookup('ledgers').then(setLedgers); lookup('years').then(setYears); }, []);
  const run = (ff = f) => {
    setBusy(true);
    const qs = new URLSearchParams({ base: cfg.searchBase || cfg.base, from: ff.from, to: ff.to });
    ['q', 'status', 'ledgerId', 'vno', 'refNo', 'jobNo', 'branch', 'amount', 'narration'].forEach(k => { if (ff[k]) qs.set(k, ff[k]); });
    if (cfg.job) qs.set('job', cfg.job); if (cfg.filterFcy) qs.set('fcy', '1'); if (cfg.desk) qs.set('desk', cfg.desk);
    api('/api/accounts-hub/vouchers?' + qs.toString()).then(setList).catch(() => setList([])).finally(() => setBusy(false));
  };
  useEffect(() => { run(); }, []);
  const rows = list;
  const acc = (v) => String(v.accounts || '').split('|').filter(Boolean).map(s => { const [name, dc, amt] = s.split('~'); return { name, dc, amt: num(amt) }; });
  const total = rows.reduce((s, v) => s + num(v.totalAmount), 0);
  const clear = () => { const n = blankSearch(); setF(n); run(n); };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const key = (e) => e.key === 'Enter' && run();
  const doPrint = async (id) => { try { const v = await api('/api/accounts-hub/vouchers/' + id); if (!printVoucher(v)) setMsg('Allow pop-ups for this site to print'); } catch (e) { setMsg(e.message); } };
  const doCopy = async (id) => { try { onCopy(await api('/api/accounts-hub/vouchers/' + id)); } catch (e) { setMsg(e.message); } };
  const exportCsv = () => {
    const esc = (v) => { const s2 = String(v ?? ''); return /[",\n]/.test(s2) ? '"' + s2.replace(/"/g, '""') + '"' : s2; };
    const lines = [['Date', 'Voucher No', 'Type', 'Status', 'Accounts', 'Amount', 'Ref / Chq', 'Job', 'Narration'].join(',')].concat(rows.map(v => [fmtDate(v.date), v.voucherNumber, v.typeName, v.status || 'Pending', acc(v).map(a => a.name + ' ' + a.dc + ' ' + a.amt).join('; '), v.totalAmount, v.refNo || '', v.jobNo || '', v.narration || ''].map(esc).join(',')));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv' })); a.download = cfg.title.replace(/[^\w]+/g, '_') + '_vouchers.csv'; a.click();
  };
  return (
    <>
      <Box>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: 10, alignItems: 'end' }}>
          <Field label="Financial Year"><select style={inputStyle} value={(years.find(y => String(y.startDate).slice(0, 10) === f.from && String(y.endDate).slice(0, 10) === f.to) || {}).id || ''} onChange={e => { const y = years.find(x => String(x.id) === e.target.value); if (y) setF({ ...f, from: String(y.startDate).slice(0, 10), to: String(y.endDate).slice(0, 10) }); }}>
            <option value="">Custom dates</option>{years.map(y => <option key={y.id} value={y.id}>{y.name || y.code}</option>)}</select></Field>
          <Field label="From"><input type="date" style={inputStyle} value={f.from} onChange={set('from')} /></Field>
          <Field label="To"><input type="date" style={inputStyle} value={f.to} onChange={set('to')} /></Field>
          <Field label="Account Name" span={2}><LedgerPicker id="srchacc" list={ledgers} value={f.ledgerId} onChange={v => setF({ ...f, ledgerId: v })} placeholder="Any account" /></Field>
          <Field label="Voucher No"><input style={inputStyle} value={f.vno} onChange={set('vno')} onKeyDown={key} /></Field>
          <Field label="Status"><select style={inputStyle} value={f.status} onChange={set('status')}><option value="">All</option><option>Approved</option><option>Pending</option><option>Returned</option><option>Rejected</option></select></Field>
          {more && <>
            <Field label="Chq / Ref / Bill No"><input style={inputStyle} value={f.refNo} onChange={set('refNo')} onKeyDown={key} /></Field>
            <Field label="Job / Docket No"><input style={inputStyle} value={f.jobNo} onChange={set('jobNo')} onKeyDown={key} /></Field>
            <Field label="Branch"><input style={inputStyle} value={f.branch} onChange={set('branch')} onKeyDown={key} /></Field>
            <Field label="Amount"><input style={{ ...inputStyle, textAlign: 'right' }} value={f.amount} onChange={set('amount')} onKeyDown={key} inputMode="decimal" /></Field>
            <Field label="Narration" span={2}><input style={inputStyle} value={f.narration} onChange={set('narration')} onKeyDown={key} /></Field>
            <Field label="Any text" span={2}><input style={inputStyle} value={f.q} onChange={set('q')} onKeyDown={key} placeholder="Account, voucher, ref, job or narration" /></Field>
          </>}
        </div>
      </Box>
      <ActionBar note={msg}>
        <Btn kind="primary" onClick={() => run()} disabled={busy}><Search size={13} /> {busy ? 'Searching' : 'Search'}</Btn>
        <Btn kind="clear" onClick={clear}><RotateCcw size={13} /> Clear</Btn>
        <Btn kind="plain" onClick={() => setMore(m => !m)}>{more ? 'Fewer filters' : 'More filters'}</Btn>
        <Btn kind="plain" onClick={exportCsv} disabled={!rows.length}><FileText size={13} /> Excel</Btn>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: rows.length >= 500 ? T.amber : T.inkSoft, fontWeight: 700 }}>{rows.length >= 500 ? 'First 500 vouchers - narrow the dates or filters to see the rest' : rows.length + ' vouchers'}, total <Money v={total} strong /></span>
      </ActionBar>
      <Grid title="Voucher Details" maxHeight="calc(100vh - 380px)" onRow={v => onOpen(v.id)} rowKey={v => v.id} activeKey={activeId}
        empty={busy ? 'Searching' : 'No vouchers for these filters'}
        cols={[
          { label: 'Type', render: v => v.typeName },
          { label: 'Voucher No.', render: v => <b style={{ color: T.head }}>{v.voucherNumber}</b> },
          { label: 'Voucher Date', render: v => fmtDate(v.date) },
          { label: 'Status', render: v => <Badge tone={statusTone(v.status)}>{v.status || 'Pending'}</Badge> },
          { label: 'Account Name', wrap: true, render: v => acc(v).map((a, i) => <div key={i}>{a.name}</div>) },
          { label: 'Debit', right: true, render: v => acc(v).map((a, i) => <div key={i}>{a.dc === 'Dr' ? <Money v={a.amt} side="Dr" /> : ' '}</div>) },
          { label: 'Credit', right: true, render: v => acc(v).map((a, i) => <div key={i}>{a.dc === 'Cr' ? <Money v={a.amt} side="Cr" /> : ' '}</div>) },
          { label: 'Ref / Chq No', render: v => v.refNo || '' },
          { label: 'Job No', render: v => v.jobNo || '' },
          { label: 'Narration', wrap: true, render: v => <span style={{ color: T.muted }}>{v.narration || ''}</span> },
          { label: '', render: v => <span style={{ display: 'inline-flex', gap: 2 }} onClick={e => e.stopPropagation()}>
            <span title="Copy as new" onClick={() => doCopy(v.id)} style={{ cursor: 'pointer', color: T.head, padding: 3 }}><Copy size={13} /></span>
            <span title="Print" onClick={() => doPrint(v.id)} style={{ cursor: 'pointer', color: T.head, padding: 3 }}><Printer size={13} /></span></span> },
        ]}
        rows={rows} />
    </>
  );
}

// ------------------------------------------------------------------ view (read-only, opened from Search)
function VoucherView({ id, onNew, onSearch, onModify, onCopy, onDeleted }) {
  const [v, setV] = useState(null); const [err, setErr] = useState('');
  const [msg, setMsg] = useState(''); const [trail, setTrail] = useState(null);
  const load = () => api('/api/accounts-hub/vouchers/' + id).then(setV).catch(e => setErr(e.message));
  useEffect(() => { setV(null); setErr(''); load(); }, [id]);
  const del = async () => {
    if (!window.confirm('Delete voucher ' + v.voucherNumber + '? It is removed from the books; the audit trail keeps a copy.')) return;
    try { await api('/api/accounts-hub/vouchers/' + id, { method: 'DELETE' }); onDeleted(); } catch (e) { setMsg('Not deleted: ' + e.message); }
  };
  const showTrail = () => (trail ? setTrail(null) : api('/api/accounts-hub/vouchers/' + id + '/audit').then(setTrail).catch(e => setMsg(e.message)));
  if (err) return <Empty title="Could not open the voucher">{err}</Empty>;
  if (!v) return <div style={{ color: T.muted, fontSize: 12, padding: 12 }}>Opening</div>;
  const ro = (k, val) => <Row key={k} label={k}><input readOnly style={roStyle} value={val || ''} /></Row>;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        <Box>{ro('Voucher No', v.voucherNumber)}{ro('Date', fmtDate(v.date))}{ro('Type', v.typeName)}</Box>
        <Box>{ro('Ref / Chq No', v.refNo)}{ro('Job No', v.jobNo)}{ro('Branch', v.branchCode)}</Box>
        <Box>
          <Row label="Status"><Badge tone={statusTone(v.status)}>{v.status || 'Pending'}</Badge></Row>
          {ro('Amount', inr(v.totalAmount))}{ro('Entered by', v.createdByName)}
        </Box>
      </div>
      <PurchaseInfoBox v={v} onChanged={load} />
      <AttachDocs voucherId={v.id} compact />
      <PostingTable title="Accounts Information" lines={v.lines || []} />
      {v.allocations && v.allocations.length > 0 && (
        <Grid title="Bills Set Off" maxHeight={200} rows={v.allocations}
          cols={[{ label: 'Bill', render: a => a.againstNo || a.refNo || a.refType }, { label: 'Bill Date', render: a => fmtDate(a.againstDate) }, { label: 'Amount', right: true, render: a => <Money v={a.amount} /> }]} />
      )}
      <Box><Row label="Narration"><input readOnly style={roStyle} value={v.narration || ''} /></Row>
        {v.rejectionReason && <div style={{ marginTop: 6, color: T.dr, fontSize: 12 }}>Returned: {v.rejectionReason}</div>}</Box>
      <ActionBar note={msg}>
        <Btn kind="save" onClick={onNew}><Plus size={13} /> New</Btn>
        <Btn kind="save" onClick={() => onModify(v)}><Pencil size={13} /> Modify</Btn>
        <Btn kind="danger" onClick={del}><Trash2 size={13} /> Delete</Btn>
        <Btn kind="primary" onClick={() => { if (!printVoucher(v)) setMsg('Allow pop-ups for this site to print'); }}><Printer size={13} /> Print</Btn>
        <Btn kind="plain" onClick={() => onCopy(v)}><Copy size={13} /> Copy as new</Btn>
        <Btn kind="plain" onClick={showTrail}><History size={13} /> Audit trail</Btn>
        <Btn kind="plain" onClick={onSearch}><ArrowLeft size={13} /> Back to search</Btn>
      </ActionBar>
      {trail && (
        <Grid title={'Audit trail - ' + v.voucherNumber} maxHeight={260} right={<span onClick={() => setTrail(null)} style={{ cursor: 'pointer' }}><X size={13} /></span>}
          rows={[{ id: 'c', action: 'CREATED', byUser: (trail.voucher || {}).createdByName, at: (trail.voucher || {}).createdAt }, ...trail.trail,
            ...(trail.voucher && /approv|reject|return/i.test(trail.voucher.status || '') ? [{ id: 's', action: String(trail.voucher.status).toUpperCase(), byUser: '', at: trail.voucher.updatedAt, note: trail.voucher.rejectionReason }] : [])]}
          rowKey={r => r.id}
          cols={[{ label: 'When', render: r => (r.at ? new Date(r.at).toLocaleString('en-IN') : '') }, { label: 'Action', render: r => <Badge tone={r.action === 'DELETED' ? 'bad' : r.action === 'MODIFIED' ? 'warn' : 'ok'}>{r.action}</Badge> },
            { label: 'By', render: r => r.byUser || '-' },
            { label: 'Change', wrap: true, render: r => (r.before && r.after ? <div style={{ fontSize: 10.5 }}><div style={{ color: T.dr }}>Before: {fmtDate(r.before.date)}, {inr(r.before.amount)} - {(r.before.lines || []).join('; ')}</div><div style={{ color: T.cr }}>After: {fmtDate(r.after.date)}, {inr(r.after.amount)} - {(r.after.lines || []).join('; ')}</div></div> : r.note || '') }]} />
      )}
    </>
  );
}

// ------------------------------------------------------------------ receipt / payment / remittance
const blankEntry = () => ({ ledgerId: '', amount: '', currency: 'INR', fcy: '', roe: '', jobNo: '', tdsLedger: '', tdsAmt: '', chgLedger: '', chgAmt: '', remarks: '', allocs: {} });

// 05-Nov-2026: Modify / Copy of a receipt or payment opens in this form again. The bank line, each party line, its TDS
// ("TDS - <party>") and bank charges ("Bank charges") lines and the bills set off are read back from the voucher;
// a voucher whose lines do not fit (posted some other way) returns null and opens in the Dr / Cr form instead.
export function cashFromVoucher(v, cfg) {
  if (!v || !Array.isArray(v.lines) || !v.lines.length) return null;
  const pay = cfg.partySide === 'Dr'; const bankSide = pay ? 'Cr' : 'Dr';
  const L = v.lines.map(l => ({ ...l, amount: num(l.amount), remarks: l.remarks || '' }));
  const isChg = (l) => l.dc === 'Dr' && /^bank charges/i.test(l.remarks);
  const isTds = (l) => l.dc === bankSide && /^TDS - /i.test(l.remarks);
  const bankC = L.filter(l => l.dc === bankSide && !isTds(l) && /bank|cash/i.test(l.groupName || '')).sort((a, b) => b.amount - a.amount);
  const bankL = bankC[0] || L.filter(l => l.dc === bankSide && !isTds(l)).sort((a, b) => b.amount - a.amount)[0];
  if (!bankL) return null;
  const parties = L.filter(l => l !== bankL && l.dc === cfg.partySide && !isChg(l));
  const tds = L.filter(l => l !== bankL && isTds(l)); const chg = L.filter(l => l !== bankL && isChg(l));
  if (!parties.length || parties.length + tds.length + chg.length + 1 !== L.length) return null;
  const words = String(bankL.remarks || '').split(' ');
  const payBy = PAY_BY.find(p => String(bankL.remarks || '').toLowerCase().startsWith(p.toLowerCase())) || 'NEFT';
  const strip = (r) => String(r || '').replace(new RegExp('^' + payBy.replace(/\W/g, '.') + '\\s*', 'i'), '').replace(/^No \S+\s*/i, '').trim();
  const entries = parties.map(l => ({ ...blankEntry(), ledgerId: l.ledgerId, amount: String(l.amount), currency: l.currency || 'INR', fcy: l.amountFcy != null ? String(l.amountFcy) : '', roe: l.roe != null ? String(l.roe) : '',
    jobNo: v.jobNo || '', remarks: strip(l.remarks), allocs: {}, billList: [] }));
  tds.forEach(t => { const nm = String(t.remarks).replace(/^TDS - /i, '').trim().toLowerCase(); const e = entries.find((x, i) => String(parties[i].ledgerName || '').toLowerCase() === nm) || entries[0]; e.tdsLedger = t.ledgerId; e.tdsAmt = String(r2(num(e.tdsAmt) + t.amount)); });
  chg.forEach(c => { const e = entries[0]; e.chgLedger = c.ledgerId; e.chgAmt = String(r2(num(e.chgAmt) + c.amount)); });
  (v.allocations || []).forEach(a => { const e = entries.find(x => String(x.ledgerId) === String(a.ledgerId)); if (!e) return; const k = a.againstVoucherId || a.refNo; if (!k) return;
    e.allocs[k] = String(num(a.amount)); e.billList.push({ voucherId: a.againstVoucherId || null, refNo: a.againstNo || a.refNo, billNo: a.refNo, date: a.againstDate, amount: num(a.amount), pending: num(a.amount) }); });
  const chqNo = v.refNo || ''; const drawee = words.length > 3 && chqNo ? String(bankL.remarks).split('No ' + chqNo).slice(1).join('').trim() : '';
  return { bank: bankL.ledgerId, entries, h: { date: String(v.date).slice(0, 10), voucherNumber: v.voucherNumber, refNo: '', narration: v.narration || '', branchCode: v.branchCode || '', costCentreId: bankL.costCentreId || '',
    payBy, chqNo, chqDate: String(v.date).slice(0, 10), drawee } };
}

// 07-Nov-2026: Branch = the branch this voucher belongs to (the user's own branches from the top bar). It starts on the
// branch picked in the top bar; with "All branches" in the top bar it has to be chosen. The voucher no series, the
// branch reports and who may see / change the voucher all go by it.
function useMyBranches() {
  const g = useGlobalContext() || {};
  const list = (g.branches || []).filter(b => !b.isAll && String(b.status || 'Active') !== 'Inactive').map(b => ({ code: String(b.branchCode || b.branch_code || '').toUpperCase(), name: b.branchName || b.branch_name || '' }));
  const mine = (g.activeBranch && !g.activeBranch.isAll && String(g.activeBranch.branchCode || g.activeBranch.branch_code || '').toUpperCase()) || '';
  return { list, mine, all: !!(g.activeBranch && g.activeBranch.isAll) };
}
function BranchSelect({ value, onChange, list, required, exclude, disabled }) {
  const opts = list.filter(b => b.code !== exclude);
  const known = !value || opts.some(b => b.code === value);
  return (
    <select style={required && !value ? mandStyle : inputStyle} value={value || ''} onChange={onChange} disabled={disabled} title="The branch this voucher belongs to">
      <option value="">{required ? 'Choose the branch' : 'Select'}</option>
      {!known && <option value={value}>{value}</option>}
      {opts.map(b => <option key={b.code} value={b.code}>{b.code} - {b.name}</option>)}
    </select>
  );
}

function CashForm({ cfg, typeId, onSaved, onClear, initial, editId, actions }) {
  const seed = useMemo(() => (initial ? cashFromVoucher(initial, cfg) : null), []);
  const pay = cfg.partySide === 'Dr';
  const bankSide = pay ? 'Cr' : 'Dr';
  const [h, setH] = useState(() => (seed ? { ...seed.h, ...(editId ? {} : { date: todayIso(), voucherNumber: '', chqNo: '', chqDate: todayIso() }) }
    : { date: todayIso(), voucherNumber: '', refNo: '', narration: '', branchCode: '', costCentreId: '', payBy: pay ? 'NEFT' : 'NEFT', chqNo: '', chqDate: todayIso(), drawee: '' }));
  const br = useMyBranches();
  useEffect(() => { if (!editId && !h.branchCode && br.mine) setH(x => ({ ...x, branchCode: br.mine })); }, [br.mine]);
  const [look, setLook] = useState({ all: [], banks: [], cc: [] });
  const [bank, setBank] = useState(seed ? seed.bank : '');
  const [cur, setCur] = useState({ ...blankEntry(), currency: cfg.fcy ? 'USD' : 'INR' });
  const [editAt, setEditAt] = useState(-1);
  const [entries, setEntries] = useState(() => (seed ? seed.entries.map(e => (editId ? e : { ...e, allocs: {}, billList: [] })) : []));
  const [bills, setBills] = useState(null);
  const [msg, setMsg] = useState(''); const [saving, setSaving] = useState(false);
  const bankBal = useBalance(bank);
  const party = useBalance(cur.ledgerId);

  useEffect(() => {
    Promise.all([lookup('ledgers'), lookup('ledgers-in?groups=' + encodeURIComponent(BANK_GROUPS)), lookup('costcentres')]).then(([all, banks, cc]) => setLook({ all, banks, cc }));
  }, [typeId]);
  const rpDiv = h.division || divFrom((entries.find(e => e.jobNo) || {}).jobNo) || divFrom(cur.jobNo);
  useEffect(() => { if (!editId) nextVoucherNo(typeId, { division: rpDiv, branch: h.branchCode, date: h.date, ledgers: bank || '' }).then(r => setH(x => ({ ...x, icaffe: !!r.icaffe, voucherNumber: r.icaffe ? (r.nextNumber || r.note || 'on Save') : (r.nextNumber || x.voucherNumber) }))).catch(() => {}); }, [typeId, rpDiv, h.branchCode, h.date, bank]);
  // INR amount from the foreign currency
  useEffect(() => { if (cur.currency !== 'INR' && num(cur.fcy) && num(cur.roe)) setCur(c => ({ ...c, amount: String(r2(num(c.fcy) * num(c.roe))) })); }, [cur.fcy, cur.roe, cur.currency]);
  useEffect(() => { setBills(null); }, [cur.ledgerId]);

  const nameOf = (id) => (look.all.find(l => String(l.id) === String(id)) || {}).name || '';
  const fetchBills = () => {
    if (!cur.ledgerId) return setMsg('Choose the account first');
    setMsg('');
    Promise.all([api(`/api/vouchers/pending-bills?ledgerId=${cur.ledgerId}&type=${cfg.pending}`), cfg.pending === 'payable' ? api('/api/accounts-hub/held-bills?ledgerId=' + cur.ledgerId).catch(() => []) : Promise.resolve([])])
      .then(([r, held]) => { const hm = new Map((held || []).map(x => [String(x.voucherId), x])); setBills((r.bills || []).map(b => (b.voucherId && hm.has(String(b.voucherId)) ? { ...b, held: hm.get(String(b.voucherId)).holdReason || 'On hold' } : b))); })
      .catch(() => setBills([]));
  };
  const allocTotal = Object.values(cur.allocs).reduce((s, v) => s + num(v), 0);
  const autoAllocate = () => {
    let left = num(cur.amount); const a = {};
    for (const b of [...(bills || [])].filter(b => !b.held).sort((x, y) => String(x.date).localeCompare(String(y.date)))) { if (left <= 0) break; const take = r2(Math.min(left, b.pending)); a[b.voucherId || b.refNo] = String(take); left = r2(left - take); }
    setCur(c => ({ ...c, allocs: a }));
  };

  const add = () => {
    setMsg('');
    if (!cur.ledgerId) return setMsg('Choose the account');
    if (!num(cur.amount)) return setMsg('Enter the amount');
    if (num(cur.tdsAmt) && !cur.tdsLedger) return setMsg('Choose the TDS account');
    if (num(cur.chgAmt) && !cur.chgLedger) return setMsg('Choose the bank charge account');
    if (allocTotal - num(cur.amount) > 0.01) return setMsg('Bills set off are more than the amount');
    const e = { ...cur, billList: bills || cur.billList || [] };
    setEntries(x => (editAt >= 0 ? x.map((y, i) => (i === editAt ? e : y)) : [...x, e]));
    setCur({ ...blankEntry(), currency: cur.currency, roe: cur.roe }); setEditAt(-1); setBills(null);
  };
  const XL = [{ key: 'account', label: 'Account Name', aliases: ['account', 'party', 'ledger'] }, { key: 'amount', label: 'Amount' }, { key: 'jobNo', label: 'Docket No', aliases: ['job no', 'job', 'docket'] },
    { key: 'tdsAccount', label: 'TDS Account' }, { key: 'tdsAmt', label: 'TDS Amount', aliases: ['tds'] }, { key: 'remarks', label: 'Remarks', aliases: ['narration'] }];
  const readXl = async (file) => {
    setMsg('');
    try {
      const rows = await readExcel(file, XL); const bad = []; const got = [];
      for (const r of rows) {
        const l = ledgerByName(look.all, r.account); const t = r.tdsAccount ? ledgerByName(look.all, r.tdsAccount) : null;
        if (!l || !(num(r.amount) > 0) || (r.tdsAccount && !t)) { bad.push('row ' + r._row + (!l ? ' (account "' + r.account + '" not found)' : !(num(r.amount) > 0) ? ' (no amount)' : ' (TDS account not found)')); continue; }
        got.push({ ...blankEntry(), ledgerId: l.id, amount: String(num(r.amount)), jobNo: r.jobNo, tdsLedger: t ? t.id : '', tdsAmt: t ? String(num(r.tdsAmt)) : '', remarks: r.remarks, billList: [] });
      }
      if (got.length) setEntries(x => [...x, ...got]);
      setMsg((got.length ? 'Read ' + got.length + ' line' + (got.length === 1 ? '' : 's') + ' from Excel' : 'Nothing read') + (bad.length ? ' - skipped ' + bad.slice(0, 5).join(', ') + (bad.length > 5 ? ' and ' + (bad.length - 5) + ' more' : '') : '') + (got.length ? '. Fetch due bills per line with Edit if needed.' : ''));
    } catch (e) { setMsg('Could not read the Excel: ' + e.message); }
  };
  const edit = (i) => { setCur(entries[i]); setEditAt(i); setBills(entries[i].billList && entries[i].billList.length ? entries[i].billList : null); };

  const posting = useMemo(() => {
    const out = []; let net = 0;
    entries.forEach(e => {
      const fx = e.currency !== 'INR' ? { currency: e.currency, amountFcy: num(e.fcy), roe: num(e.roe) } : {};
      const memo = [h.payBy, h.chqNo && 'No ' + h.chqNo, e.remarks].filter(Boolean).join(' ') || null;
      out.push({ ledgerId: e.ledgerId, dc: cfg.partySide, amount: r2(num(e.amount)), remarks: memo, costCentreId: h.costCentreId || null, ...fx });
      if (num(e.tdsAmt)) out.push({ ledgerId: e.tdsLedger, dc: bankSide, amount: r2(num(e.tdsAmt)), remarks: 'TDS - ' + nameOf(e.ledgerId) });
      if (num(e.chgAmt)) out.push({ ledgerId: e.chgLedger, dc: 'Dr', amount: r2(num(e.chgAmt)), remarks: 'Bank charges' });
      net += pay ? num(e.amount) - num(e.tdsAmt) + num(e.chgAmt) : num(e.amount) - num(e.tdsAmt) - num(e.chgAmt);
    });
    if (bank && r2(net)) {
      const fcyE = cfg.fcy && entries.length === 1 && entries[0].currency !== 'INR' ? entries[0] : null;
      out.push({ ledgerId: bank, dc: bankSide, amount: r2(net), remarks: [h.payBy, h.chqNo && 'No ' + h.chqNo, h.drawee].filter(Boolean).join(' ') || null, costCentreId: h.costCentreId || null });
      if (fcyE && !num(fcyE.tdsAmt) && !num(fcyE.chgAmt)) Object.assign(out[out.length - 1], { currency: fcyE.currency, amountFcy: num(fcyE.fcy), roe: num(fcyE.roe) });
    }
    return out;
  }, [entries, bank, h, cfg]);
  const dr = posting.filter(p => p.dc === 'Dr').reduce((s, p) => s + p.amount, 0);
  const cr = posting.filter(p => p.dc === 'Cr').reduce((s, p) => s + p.amount, 0);
  const bookTotal = r2(posting.filter(p => String(p.ledgerId) === String(bank)).reduce((s, p) => s + p.amount, 0));
  const totalTds = r2(entries.reduce((s, e) => s + num(e.tdsAmt), 0));

  const save = async () => {
    setMsg('');
    if (!h.voucherNumber) return setMsg('Enter the voucher no');
    if (!h.date) return setMsg('Enter the date');
    if (!h.branchCode) return setMsg('Choose the branch this voucher belongs to');
    if (!bank) return setMsg('Choose the cash / bank book');
    if (!entries.length) return setMsg(cur.ledgerId ? 'Click Add to put the account in the grid' : 'Add at least one account');
    if (Math.abs(dr - cr) > 0.01) return setMsg('Debit and credit must be equal before saving');
    const allocations = cfg.onAccount ? [] : entries.flatMap(e => (e.billList || []).filter(b => num(e.allocs[b.voucherId || b.refNo])).map(b => ({ ledgerId: e.ledgerId, againstVoucherId: b.voucherId || null, refNo: b.refNo || b.billNo || null, refType: 'AGAINST', amount: num(e.allocs[b.voucherId || b.refNo]) })));
    const narration = h.narration || `${cfg.title} ${pay ? 'to' : 'from'} ${entries.map(e => nameOf(e.ledgerId)).join(', ')}${h.chqNo ? ' by ' + h.payBy + ' ' + h.chqNo + ' dt ' + fmtDate(h.chqDate) : ''}`;
    setSaving(true);
    try {
      const body = { voucherTypeId: typeId, voucherNumber: h.voucherNumber, division: rpDiv || null, ownBranch: h.branchCode || null, date: h.date, narration, refNo: h.chqNo || h.refNo || null, jobNo: (entries.find(e => e.jobNo) || {}).jobNo || null, branchCode: h.branchCode || null, details: posting, allocations };
      if (editId) { await postJson('/api/accounts-hub/vouchers/' + editId, body, 'PUT'); onSaved(editId); }
      else { const r = await postJson('/api/vouchers', body); onSaved((r && r.data && r.data.id) || r.id); }
    } catch (e) { setMsg('Not saved: ' + e.message); }
    setSaving(false);
  };

  const set = (k) => (e) => setH({ ...h, [k]: e.target.value });
  const setC = (k) => (e) => setCur({ ...cur, [k]: e.target.value });
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10 }}>
        <Box>
          <Row label="Branch" required><BranchSelect value={h.branchCode} onChange={set('branchCode')} list={br.list} required disabled={!!editId} /></Row>
          <Row label="Division" required><select style={rpDiv ? inputStyle : mandStyle} value={rpDiv} onChange={set('division')} disabled={!!editId}><option value="">Select</option>{DIV_OPTS.map(([k, l]) => <option key={k} value={k}>{k} - {l}</option>)}</select></Row>
          <Row label="Voucher No" required><input style={h.voucherNumber ? (h.icaffe ? { ...inputStyle, background: '#eef2f6' } : inputStyle) : mandStyle} readOnly={!!h.icaffe && !editId} value={h.voucherNumber} onChange={set('voucherNumber')} /></Row>
          <Row label="Date" required><input type="date" style={inputStyle} value={h.date} onChange={set('date')} /></Row>
          <Row label="Cost Center"><select style={inputStyle} value={h.costCentreId} onChange={set('costCentreId')}><option value="">Select</option>{look.cc.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Row>
        </Box>
        <Box>
          <Row label={'Cash/Bank Book (' + bankSide + '.)'} required w={128}><LedgerPicker id="bank" list={look.banks.length ? look.banks : look.all} value={bank} onChange={setBank} placeholder="Cash / bank book" mandatory /></Row>
          <Row label="Current Balance" w={128}><input readOnly style={roStyle} value={bankBal ? inr(bankBal.balance) + ' ' + bankBal.side : ''} /></Row>
          <Row label="Reference No" w={128}><input style={inputStyle} value={h.refNo} onChange={set('refNo')} /></Row>
        </Box>
        <Box>
          <Row label={'Account (' + cfg.partySide + '.)'} required w={96}><LedgerPicker id="acc" list={look.all} value={cur.ledgerId} onChange={v => setCur({ ...cur, ledgerId: v, allocs: {} })} placeholder={pay ? 'Paid to' : 'Received from'} mandatory /></Row>
          <Row label="GSTIN" w={96}><input readOnly style={roStyle} value={party ? party.gstin || '' : ''} /></Row>
          <Row label="Balance" w={96}><input readOnly style={roStyle} value={party ? inr(party.balance) + ' ' + party.side + (party.groupName ? '  -  ' + party.groupName : '') : ''} /></Row>
          <PartyNote b={party} />
          <Row label="Currency" w={96}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 6 }}>
              <select style={inputStyle} value={cur.currency} onChange={setC('currency')}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
              <input style={cur.currency === 'INR' ? roStyle : inputStyle} readOnly={cur.currency === 'INR'} value={cur.roe} onChange={setC('roe')} placeholder="Ex. rate" inputMode="decimal" />
              <input style={cur.currency === 'INR' ? roStyle : inputStyle} readOnly={cur.currency === 'INR'} value={cur.fcy} onChange={setC('fcy')} placeholder="FC amt" inputMode="decimal" />
            </div>
          </Row>
        </Box>
        <Box>
          <Row label="Amount" required w={96}><input style={{ ...(num(cur.amount) ? inputStyle : mandStyle), fontWeight: 800, textAlign: 'right' }} value={cur.amount} onChange={setC('amount')} inputMode="decimal" placeholder="0.00" /></Row>
          <Row label="Payment By" w={96}><select style={inputStyle} value={h.payBy} onChange={set('payBy')}>{PAY_BY.map(p => <option key={p}>{p}</option>)}</select></Row>
          <Row label="CHQ/DD/UTR No" w={96}><input style={inputStyle} value={h.chqNo} onChange={set('chqNo')} /></Row>
          <Row label="CHQ/DD Date" w={96}><input type="date" style={inputStyle} value={h.chqDate} onChange={set('chqDate')} /></Row>
        </Box>
      </div>

      {/* entry strip */}
      <Box>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, alignItems: 'end' }}>
          <Field label="Docket / Job No"><input style={inputStyle} value={cur.jobNo} onChange={setC('jobNo')} placeholder="Optional" /></Field>
          <Field label="TDS Account" span={2}><LedgerPicker id="tds" list={look.all} value={cur.tdsLedger} onChange={v => setCur({ ...cur, tdsLedger: v })} placeholder={pay ? 'TDS payable' : 'TDS receivable'} /></Field>
          <Field label="TDS Amt"><input style={{ ...inputStyle, textAlign: 'right' }} value={cur.tdsAmt} onChange={setC('tdsAmt')} inputMode="decimal" /></Field>
          <Field label="Bank Chg. A/c" span={2}><LedgerPicker id="chg" list={look.all} value={cur.chgLedger} onChange={v => setCur({ ...cur, chgLedger: v })} placeholder="Bank charges" /></Field>
          <Field label="Bank Charge"><input style={{ ...inputStyle, textAlign: 'right' }} value={cur.chgAmt} onChange={setC('chgAmt')} inputMode="decimal" /></Field>
          <Field label="Bank Name (drawee)"><input style={inputStyle} value={h.drawee} onChange={set('drawee')} /></Field>
          <Field label="Remarks" span={2}><input style={inputStyle} value={cur.remarks} onChange={setC('remarks')} /></Field>
          <div style={{ display: 'flex', gap: 8, gridColumn: 'span 3', minWidth: 0, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <ExcelButtons onFile={readXl} onSample={() => sampleExcel(cfg.title.toLowerCase().replace(/\W+/g, '_') + '_sample', XL, [['ABC EXPORTS', 11800, 'AE/001', '', '', 'Against INV/1']])} />
            {!cfg.onAccount && <Btn kind="primary" onClick={fetchBills}><ListChecks size={13} /> Fetch Due Bills</Btn>}
            <Btn kind="primary" onClick={add}><Plus size={13} /> {editAt >= 0 ? 'Update' : 'Add'}</Btn>
          </div>
        </div>
        {bills && (
          <div style={{ marginTop: 10 }}>
            <Grid title={'Due bills of ' + nameOf(cur.ledgerId)} maxHeight={220}
              right={<>{bills.length > 0 && <Btn small kind="ghost" onClick={autoAllocate}><Wand2 size={11} /> Oldest first</Btn>}<span style={{ color: allocTotal - num(cur.amount) > 0.01 ? T.dr : T.head }}>Set off {inr(allocTotal)} of {inr(num(cur.amount))}</span></>}
              empty="No open bills - the amount stays on account"
              rows={bills} rowKey={b => b.voucherId || b.refNo}
              cols={[{ label: 'Bill No', render: b => b.billNo || b.refNo }, { label: 'Date', render: b => fmtDate(b.date) }, { label: 'Job', render: b => b.jobNo || '' },
                { label: 'Bill Amount', right: true, render: b => <Money v={b.amount} muted /> }, { label: 'Pending', right: true, render: b => <Money v={b.pending} strong /> },
                { label: 'Days', right: true, render: b => <span style={{ color: b.overdueDays > 0 ? T.dr : T.muted }}>{b.overdueDays || 0}</span> },
                { label: 'Set Off', right: true, w: 130, render: b => { const k = b.voucherId || b.refNo; if (b.held) return <span title={b.held}><Badge tone="warn">On hold</Badge></span>; return <input style={{ ...inputStyle, height: 24, textAlign: 'right' }} value={cur.allocs[k] || ''} onChange={e => setCur(c => ({ ...c, allocs: { ...c.allocs, [k]: e.target.value } }))} />; } }]} />
          </div>
        )}
      </Box>

      <Grid title="Accounts Information" maxHeight={260} empty="Choose the account and amount above, then click Add"
        rows={entries}
        cols={[
          { label: 'Edit', w: 40, render: (e, i) => <span onClick={() => edit(i)} style={{ cursor: 'pointer', color: T.head }}><Pencil size={13} /></span> },
          { label: 'Delete', w: 48, render: (e, i) => <span onClick={() => { setEntries(x => x.filter((_, j) => j !== i)); if (editAt === i) { setEditAt(-1); setCur(blankEntry()); } }} style={{ cursor: 'pointer', color: T.dr }}><Trash2 size={13} /></span> },
          { label: 'Account Name', wrap: true, render: e => <b>{nameOf(e.ledgerId)}</b> },
          { label: 'Debit', right: true, render: e => (cfg.partySide === 'Dr' ? <Money v={e.amount} side="Dr" /> : '') },
          { label: 'Credit', right: true, render: e => (cfg.partySide === 'Cr' ? <Money v={e.amount} side="Cr" /> : '') },
          { label: 'Currency', render: e => (e.currency !== 'INR' ? `${e.currency} ${inr(e.fcy)} @ ${e.roe}` : 'INR') },
          { label: 'Docket No', render: e => e.jobNo },
          { label: 'TDS Account', render: e => nameOf(e.tdsLedger) },
          { label: 'TDS Amt', right: true, render: e => (num(e.tdsAmt) ? inr(e.tdsAmt) : '') },
          { label: 'Bank Chg', right: true, render: e => (num(e.chgAmt) ? inr(e.chgAmt) : '') },
          { label: 'Bills Set Off', right: true, render: e => { const t = Object.values(e.allocs).reduce((s, v) => s + num(v), 0); return t ? inr(t) : <span style={{ color: T.muted }}>On account</span>; } },
        ]} />

      <Box>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) repeat(3, minmax(120px, 1fr))', gap: 10, alignItems: 'end' }}>
          <Field label="Narration"><input style={inputStyle} value={h.narration} onChange={set('narration')} placeholder="Leave blank to write it from the accounts and cheque" /></Field>
          <Field label="Book Total"><input readOnly style={{ ...roStyle, textAlign: 'right', fontWeight: 800 }} value={inr(bookTotal)} /></Field>
          <Field label="Total TDS"><input readOnly style={{ ...roStyle, textAlign: 'right' }} value={inr(totalTds)} /></Field>
          <Field label="Accounts"><input readOnly style={{ ...roStyle, textAlign: 'right' }} value={entries.length} /></Field>
        </div>
      </Box>
      {posting.length > 0 && <PostingTable title="This will post" lines={posting.map(p => ({ ...p, ledgerName: nameOf(p.ledgerId) }))} />}
      <BalanceStrip dr={dr} cr={cr} />
      {editId && <div style={{ padding: '8px 12px', borderRadius: 6, background: T.amberBg, border: '1px solid #fde68a', fontSize: 12, fontWeight: 600, color: T.amber }}>Modifying {cfg.title} {initial.voucherNumber}. Bills set off are shown as saved - Fetch Due Bills to set off more. After saving the voucher goes back for approval.</div>}
      <ActionBar note={msg}>
        <Btn kind="save" onClick={save} disabled={saving}>{editId ? <Pencil size={13} /> : <Save size={13} />} {saving ? 'Saving' : editId ? 'Save changes' : 'Save'}</Btn>
        {!editId && actions}
        <Btn kind="clear" onClick={onClear}>{editId ? <X size={13} /> : <RotateCcw size={13} />} {editId ? 'Cancel' : 'Clear'}</Btn>
      </ActionBar>
    </>
  );
}

// ------------------------------------------------------------------ journal / contra / inter branch
const blankLine = () => ({ ledgerId: '', amount: '', dc: 'Dr', refNo: '', refDate: '', refAmt: '', jobNo: '', costCentreId: '', remarks: '',
  isTds: false, tdsNatureId: '', tdsBase: '', isGst: false, gstRate: '18', gstKind: 'input', gstPlace: 'intra', sac: '' });
// 04-Nov-2026: iCAFFE Journal line extras - Ref date / amount, IS TDS (section + amount it is on; the line posts to TDS Payable and
// the section goes into the remarks the TDS Payable report reads), IS GST (GST lines made from the line: input or output,
// CGST + SGST or IGST). GST lines carry _parent so they follow their line on edit / delete.
let lineSeq = 1;
const gstSplit = (amt, rate, place) => { const g = r2(num(amt) * num(rate) / 100); return place === 'inter' ? [['igst', g]] : [['cgst', r2(g / 2)], ['sgst', r2(g - r2(g / 2))]]; };

// initial = a saved voucher (Modify / Copy as new): its lines come in as Dr / Cr lines in rupees, foreign currency kept per line
function LinesForm({ cfg, typeId, onSaved, onClear, initial, editId, actions }) {
  const [h, setH] = useState(() => ({ date: initial && editId ? String(initial.date).slice(0, 10) : todayIso(), voucherNumber: initial && editId ? initial.voucherNumber : '', narration: initial ? initial.narration || '' : '',
    branchCode: initial ? initial.branchCode || '' : '', currency: 'INR', roe: '1', refNo: initial ? initial.refNo || '' : '' }));
  const br = useMyBranches();
  // own branch (the voucher's branch); for an inter-branch transfer h.branchCode is the branch it goes TO
  const [own, setOwn] = useState(() => (initial && editId && !cfg.branch ? initial.branchCode || '' : ''));
  useEffect(() => { if (!editId && !own && br.mine) setOwn(br.mine); }, [br.mine]);
  useEffect(() => { if (!cfg.branch) setH(x => ({ ...x, branchCode: own })); }, [own]);
  const [look, setLook] = useState({ all: [], banks: [], cc: [], tds: [], tax: null });
  const [cur, setCur] = useState(blankLine());
  const [editAt, setEditAt] = useState(-1);
  const [lines, setLines] = useState(() => (initial ? (initial.lines || []).map(l => ({ ledgerId: l.ledgerId, amount: String(l.amount), dc: l.dc, refNo: '', jobNo: initial.jobNo || '', costCentreId: l.costCentreId || '',
    remarks: l.remarks || '', _fx: l.currency && l.currency !== 'INR' ? { currency: l.currency, amountFcy: l.amountFcy, roe: l.roe } : null })) : []));
  const [msg, setMsg] = useState(''); const [saving, setSaving] = useState(false);
  const bal = useBalance(cur.ledgerId);
  useEffect(() => {
    Promise.all([lookup('ledgers'), lookup('ledgers-in?groups=' + encodeURIComponent(BANK_GROUPS)), lookup('costcentres'), lookup('tdsnatures'), cfg.banksOnly ? Promise.resolve(null) : postJson('/api/accounts-hub/tax-ledgers', {}).catch(() => null)])
      .then(([all, banks, cc, tds, tax]) => setLook({ all, banks, cc, tds: tds || [], tax }));
  }, [typeId]);
  const jvDiv = h.division || divFrom((lines.find(l => l.jobNo) || {}).jobNo);
  useEffect(() => { if (!editId) nextVoucherNo(typeId, { division: jvDiv, branch: own, date: h.date, ledgers: lines.map(l => l.ledgerId).filter(Boolean).join(',') }).then(r => setH(x => ({ ...x, icaffe: !!r.icaffe, voucherNumber: r.icaffe ? (r.nextNumber || r.note || 'on Save') : (r.nextNumber || x.voucherNumber) }))).catch(() => {}); }, [typeId, jvDiv, own, h.date, lines.length]);
  const list = cfg.banksOnly && look.banks.length ? look.banks : look.all;
  const nameOf = (id) => (look.all.find(l => String(l.id) === String(id)) || {}).name || '';
  const fc = h.currency !== 'INR';
  const inrOf = (l) => r2(fc ? num(l.amount) * num(h.roe) : num(l.amount));
  const dr = r2(lines.filter(l => l.dc === 'Dr').reduce((s, l) => s + inrOf(l), 0));
  const cr = r2(lines.filter(l => l.dc === 'Cr').reduce((s, l) => s + inrOf(l), 0));

  const tdsNat = (id) => look.tds.find(n => String(n.id) === String(id));
  // IS TDS: amount = TDS on amount x section rate, posted to TDS Payable
  const setTds = (patch) => setCur(c => {
    const n = { ...c, ...patch };
    if (n.isTds) { const nat = tdsNat(n.tdsNatureId); if (nat && num(n.tdsBase)) n.amount = String(Math.round(num(n.tdsBase) * num(nat.rate) / 100)); if (!n.ledgerId && look.tax && look.tax.tdsPayable) n.ledgerId = look.tax.tdsPayable; if (patch.isTds) n.dc = 'Cr'; }
    return n;
  });
  const gstPreview = cur.isGst && num(cur.amount) ? gstSplit(cur.amount, cur.gstRate, cur.gstPlace) : [];
  const gstLines = (l, key) => {
    if (!l.isGst || !num(l.gstRate) || !look.tax) return [];
    const t = look.tax; const io = l.gstKind === 'output' ? 'output' : 'input';
    const led = { igst: io === 'input' ? t.inputIgst : t.outputIgst, cgst: io === 'input' ? t.inputCgst : t.outputCgst, sgst: io === 'input' ? t.inputSgst : t.outputSgst };
    return gstSplit(l.amount, l.gstRate, l.gstPlace).filter(([, a]) => a > 0).map(([k, a]) => ({ ...blankLine(), ledgerId: led[k], amount: String(a), dc: l.dc, jobNo: l.jobNo, costCentreId: l.costCentreId,
      remarks: (io === 'input' ? 'Input ' : 'Output ') + k.toUpperCase() + ' ' + (l.gstPlace === 'inter' ? l.gstRate : num(l.gstRate) / 2) + '% on ' + inr(num(l.amount)) + (l.sac ? ' SAC ' + l.sac : ''), _parent: key }));
  };
  const add = () => {
    setMsg('');
    if (!cur.ledgerId) return setMsg('Choose the account');
    if (!num(cur.amount)) return setMsg('Enter the amount');
    if (cur.isTds && !cur.tdsNatureId) return setMsg('Choose the TDS section');
    if (cur.isTds && !num(cur.tdsBase)) return setMsg('Enter the amount TDS is on');
    if (cur.isGst && !look.tax) return setMsg('GST ledgers could not be set up - check the Duties & Taxes group');
    if (cur.refAmt && !(num(cur.refAmt) > 0)) return setMsg('Ref amount must be a number');
    const key = cur._key || 'L' + (lineSeq++);
    const line = { ...cur, _key: key };
    const kids = gstLines(line, key);
    let next;
    if (editAt >= 0) {
      const oldKey = lines[editAt]._key;
      const rest = lines.filter((y, i) => i !== editAt && !(oldKey && y._parent === oldKey));
      const pos = lines.slice(0, editAt).filter(y => !(oldKey && y._parent === oldKey)).length;
      next = [...rest.slice(0, pos), line, ...kids, ...rest.slice(pos)];
    } else next = [...lines, line, ...kids];
    setLines(next); setEditAt(-1);
    // next line starts with the difference on the other side
    const d = r2(next.filter(l => l.dc === 'Dr').reduce((s, l) => s + num(l.amount), 0) - next.filter(l => l.dc === 'Cr').reduce((s, l) => s + num(l.amount), 0));
    setCur({ ...blankLine(), dc: d > 0 ? 'Cr' : 'Dr', amount: d ? String(Math.abs(d)) : '', jobNo: cur.jobNo, costCentreId: cur.costCentreId });
  };
  const XL = [{ key: 'account', label: 'Account Name', aliases: ['account', 'ledger', 'party'] }, { key: 'debit', label: 'Debit', aliases: ['dr amount'] }, { key: 'credit', label: 'Credit', aliases: ['cr amount'] },
    { key: 'dc', label: 'Dr/Cr', aliases: ['drcr', 'type'] }, { key: 'amount', label: 'Amount' }, { key: 'refNo', label: 'Ref No', aliases: ['reference', 'bill no'] }, { key: 'refDate', label: 'Ref Date', date: true },
    { key: 'refAmt', label: 'Ref Amount', aliases: ['ref amt'] }, { key: 'jobNo', label: 'Docket No', aliases: ['job no', 'job', 'docket'] }, { key: 'remarks', label: 'Narration', aliases: ['remarks', 'line narration'] }];
  const readXl = async (file) => {
    setMsg('');
    try {
      const rows = await readExcel(file, XL); const bad = []; const got = [];
      for (const r of rows) {
        const l = ledgerByName(list, r.account);
        let dc = /^c/i.test(r.dc) ? 'Cr' : /^d/i.test(r.dc) ? 'Dr' : ''; let amt = num(r.amount);
        if (num(r.debit)) { dc = 'Dr'; amt = num(r.debit); } else if (num(r.credit)) { dc = 'Cr'; amt = num(r.credit); }
        if (!l || !(amt > 0) || !dc) { bad.push('row ' + r._row + (!l ? ' ("' + r.account + '" not found)' : !(amt > 0) ? ' (no amount)' : ' (Dr / Cr missing)')); continue; }
        got.push({ ...blankLine(), _key: 'L' + (lineSeq++), ledgerId: l.id, dc, amount: String(amt), refNo: r.refNo, refDate: r.refDate, refAmt: r.refAmt ? String(num(r.refAmt)) : '', jobNo: r.jobNo, remarks: r.remarks });
      }
      if (got.length) setLines(x => [...x, ...got]);
      const d = r2(got.reduce((s, l) => s + (l.dc === 'Dr' ? 1 : -1) * num(l.amount), 0));
      setMsg((got.length ? 'Read ' + got.length + ' line' + (got.length === 1 ? '' : 's') + ' from Excel' + (d ? ' - they differ by ' + inr(Math.abs(d)) + ' ' + (d > 0 ? 'Dr' : 'Cr') : '') : 'Nothing read') + (bad.length ? ' - skipped ' + bad.slice(0, 5).join(', ') + (bad.length > 5 ? ' and ' + (bad.length - 5) + ' more' : '') : ''));
    } catch (e) { setMsg('Could not read the Excel: ' + e.message); }
  };
  const removeAt = (i) => { const k = lines[i]._key; setLines(x => x.filter((y, j) => j !== i && !(k && y._parent === k))); if (editAt === i) { setEditAt(-1); setCur(blankLine()); } };
  const editLine = (l, i) => { if (l._parent) return setMsg('This GST line comes from the line above it - edit that line'); setCur(l); setEditAt(i); };
  const lineRemarks = (l) => {
    const nat = l.isTds ? tdsNat(l.tdsNatureId) : null;
    return [l.refNo && 'Ref ' + l.refNo, l.refDate && 'dt ' + fmtDate(l.refDate), num(l.refAmt) && 'amt ' + inr(num(l.refAmt)),
      nat && 'TDS ' + nat.section + ' @' + nat.rate + '% on ' + inr(num(l.tdsBase)),
      l.isGst && !l._parent && 'GST ' + l.gstRate + '% ' + (l.gstKind === 'output' ? 'output' : 'input') + (l.sac ? ' SAC ' + l.sac : ''), l.remarks].filter(Boolean).join(' ') || null;
  };
  const save = async () => {
    setMsg('');
    if (!h.voucherNumber) return setMsg('Enter the voucher no');
    if (!own) return setMsg('Choose the branch this voucher belongs to');
    if (cfg.branch && !h.branchCode) return setMsg('Choose the branch the transfer goes to');
    if (cfg.branch && h.branchCode === own) return setMsg('The transfer has to go to another branch');
    if (lines.length < 2) return setMsg('Add at least two accounts');
    if (Math.abs(dr - cr) > 0.01) return setMsg('Debit and credit must be equal before saving');
    const details = lines.map(l => ({ ledgerId: l.ledgerId, dc: l.dc, amount: inrOf(l), remarks: lineRemarks(l), costCentreId: l.costCentreId || null, ...(fc ? { currency: h.currency, amountFcy: num(l.amount), roe: num(h.roe) } : (l._fx || {})) }));
    const narration = h.narration || (cfg.branch ? 'Inter branch transfer to ' + h.branchCode : '');
    setSaving(true);
    try {
      const body = { voucherTypeId: typeId, voucherNumber: h.voucherNumber, division: jvDiv || null, ownBranch: own || null, date: h.date, narration, refNo: h.refNo || null, jobNo: (lines.find(l => l.jobNo) || {}).jobNo || null, branchCode: h.branchCode || null, details };
      if (editId) { await postJson('/api/accounts-hub/vouchers/' + editId, body, 'PUT'); onSaved(editId); }
      else { const r = await postJson('/api/vouchers', body); onSaved((r && r.data && r.data.id) || r.id); }
    } catch (e) { setMsg('Not saved: ' + e.message); }
    setSaving(false);
  };
  const set = (k) => (e) => setH({ ...h, [k]: e.target.value });
  const setC = (k) => (e) => setCur({ ...cur, [k]: e.target.value });
  return (
    <>
      {initial && (
        <div style={{ padding: '8px 12px', borderRadius: 6, background: editId ? T.amberBg : T.headBg, border: '1px solid ' + (editId ? '#fde68a' : T.headBorder), fontSize: 12, fontWeight: 600, color: editId ? T.amber : T.head }}>
          {editId ? `Modifying ${initial.typeName} ${initial.voucherNumber}. The lines are shown as Dr / Cr entries; after saving the voucher goes back for approval.` : `Copy of ${initial.typeName} ${initial.voucherNumber} - change what you need and Save as a new voucher.`}
        </div>
      )}
      <Box>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, alignItems: 'end' }}>
          <Field label="Branch" required><BranchSelect value={own} onChange={e => setOwn(e.target.value)} list={br.list} required disabled={!!editId} /></Field>
          {cfg.branch && <Field label="To Branch" required><BranchSelect value={h.branchCode} onChange={set('branchCode')} list={br.list} required exclude={own} /></Field>}
          <Field label="Division" required><select style={jvDiv ? inputStyle : mandStyle} value={jvDiv} onChange={set('division')} disabled={!!editId}><option value="">Select</option>{DIV_OPTS.map(([k, l]) => <option key={k} value={k}>{k} - {l}</option>)}</select></Field>
          <Field label="Voucher No." required><input style={h.voucherNumber ? (h.icaffe ? { ...inputStyle, background: '#eef2f6' } : inputStyle) : mandStyle} readOnly={!!h.icaffe && !editId} value={h.voucherNumber} onChange={set('voucherNumber')} /></Field>
          <Field label="Date" required><input type="date" style={inputStyle} value={h.date} onChange={set('date')} /></Field>
          <Field label="Curr"><select style={inputStyle} value={h.currency} onChange={e => setH({ ...h, currency: e.target.value, roe: e.target.value === 'INR' ? '1' : h.roe })}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Ex. Rate"><input style={fc ? inputStyle : roStyle} readOnly={!fc} value={h.roe} onChange={set('roe')} inputMode="decimal" /></Field>
          <Field label="Ref No"><input style={inputStyle} value={h.refNo} onChange={set('refNo')} /></Field>
        </div>
      </Box>
      <Box>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2.4fr) minmax(110px, 1fr) minmax(100px, 0.9fr) 80px minmax(110px, 1fr) minmax(110px, 1fr) minmax(130px, 1.2fr)', gap: 10, alignItems: 'end' }} className="acc-strip">
          <Field label="Account Name" required hint={bal ? `Balance ${inr(bal.balance)} ${bal.side}${bal.groupName ? ' - ' + bal.groupName : ''}` : ' '}><LedgerPicker id="jl" list={list} value={cur.ledgerId} onChange={v => setCur({ ...cur, ledgerId: v })} mandatory placeholder={cfg.banksOnly ? 'Bank / cash' : 'Party / ledger'} /></Field>
          <Field label={fc ? 'Amount (' + h.currency + ')' : 'Amount'} required hint={fc && num(cur.amount) ? 'INR ' + inr(num(cur.amount) * num(h.roe)) : ' '}><input style={{ ...(num(cur.amount) ? inputStyle : mandStyle), textAlign: 'right', fontWeight: 800 }} value={cur.amount} onChange={setC('amount')} inputMode="decimal" onKeyDown={e => e.key === 'Enter' && add()} /></Field>
          <Field label="INR Amount" hint=" "><input readOnly style={{ ...roStyle, textAlign: 'right' }} value={inr(fc ? num(cur.amount) * num(h.roe) : num(cur.amount))} /></Field>
          <Field label="Dr/Cr" hint=" "><select style={{ ...inputStyle, color: cur.dc === 'Dr' ? T.dr : T.cr, fontWeight: 800 }} value={cur.dc} onChange={setC('dc')}><option>Dr</option><option>Cr</option></select></Field>
          <Field label="Ref No" hint=" "><input style={inputStyle} value={cur.refNo} onChange={setC('refNo')} /></Field>
          <Field label="Docket No" hint=" "><input style={inputStyle} value={cur.jobNo} onChange={setC('jobNo')} /></Field>
          <Field label="Cost Center" hint=" "><select style={inputStyle} value={cur.costCentreId} onChange={setC('costCentreId')}><option value="">Select</option>{look.cc.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        </div>
        {!cfg.banksOnly && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) minmax(110px, 1fr) auto minmax(0, 3fr)', gap: 10, alignItems: 'end', marginTop: 8 }} className="acc-strip">
            <Field label="Ref Date"><input type="date" style={inputStyle} value={cur.refDate} onChange={setC('refDate')} /></Field>
            <Field label="Ref Amount"><input style={{ ...inputStyle, textAlign: 'right' }} value={cur.refAmt} onChange={setC('refAmt')} inputMode="decimal" /></Field>
            <div style={{ display: 'flex', gap: 12, paddingBottom: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', margin: 0 }}><input type="checkbox" checked={cur.isTds} onChange={e => setTds({ isTds: e.target.checked, isGst: e.target.checked ? false : cur.isGst })} /> IS TDS</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', margin: 0 }}><input type="checkbox" checked={cur.isGst} onChange={e => setCur({ ...cur, isGst: e.target.checked, isTds: e.target.checked ? false : cur.isTds })} /> IS GST</label>
            </div>
            <div style={{ minWidth: 0 }}>
              {cur.isTds && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 2fr) minmax(110px, 1fr) minmax(90px, 0.8fr)', gap: 10, alignItems: 'end' }}>
                  <Field label="TDS Section" required><select style={cur.tdsNatureId ? inputStyle : mandStyle} value={cur.tdsNatureId} onChange={e => setTds({ tdsNatureId: e.target.value })}><option value="">Select</option>{look.tds.map(n => <option key={n.id} value={n.id}>{n.section} - {n.name} ({n.rate}%)</option>)}</select></Field>
                  <Field label="TDS On Amount" required><input style={{ ...(num(cur.tdsBase) ? inputStyle : mandStyle), textAlign: 'right' }} value={cur.tdsBase} onChange={e => setTds({ tdsBase: e.target.value })} inputMode="decimal" /></Field>
                  <Field label="Rate"><input readOnly style={{ ...roStyle, textAlign: 'right' }} value={tdsNat(cur.tdsNatureId) ? tdsNat(cur.tdsNatureId).rate + '%' : ''} /></Field>
                </div>
              )}
              {cur.isGst && (
                <div style={{ display: 'grid', gridTemplateColumns: '80px minmax(110px, 1fr) minmax(150px, 1.3fr) minmax(90px, 0.8fr) minmax(140px, 1.4fr)', gap: 10, alignItems: 'end' }}>
                  <Field label="GST %"><select style={inputStyle} value={cur.gstRate} onChange={setC('gstRate')}>{['5', '12', '18', '28'].map(g => <option key={g} value={g}>{g}%</option>)}</select></Field>
                  <Field label="Input / Output"><select style={inputStyle} value={cur.gstKind} onChange={setC('gstKind')}><option value="input">Input (purchase)</option><option value="output">Output (sale)</option></select></Field>
                  <Field label="Place Of Supply"><select style={inputStyle} value={cur.gstPlace} onChange={setC('gstPlace')}><option value="intra">Same state (CGST + SGST)</option><option value="inter">Other state (IGST)</option></select></Field>
                  <Field label="SAC"><input style={inputStyle} value={cur.sac} onChange={setC('sac')} /></Field>
                  <Field label="GST Lines Made"><input readOnly style={{ ...roStyle, textAlign: 'right' }} value={gstPreview.map(([k, a]) => k.toUpperCase() + ' ' + inr(fc ? a * num(h.roe) : a)).join(' + ')} /></Field>
                </div>
              )}
              {!cur.isTds && !cur.isGst && <div style={{ fontSize: 10.5, color: T.muted, paddingBottom: 8 }}>Tick IS TDS for a TDS line (section and the amount it is on), or IS GST to add the GST lines for this amount.</div>}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'end', marginTop: 8 }}>
          <Field label="Line Narration" style={{ flex: 1 }}><input style={inputStyle} value={cur.remarks} onChange={setC('remarks')} onKeyDown={e => e.key === 'Enter' && add()} /></Field>
          <ExcelButtons onFile={readXl} onSample={() => sampleExcel(cfg.title.toLowerCase().replace(/\W+/g, '_') + '_sample', XL, [['AIR FREIGHT EXPENSE', 10000, '', '', '', 'XYZ-55', '30/10/2026', 11800, 'AE/001', 'Freight Oct'], ['XYZ AIRLINES', '', 10000, '', '', 'XYZ-55', '', '', 'AE/001', '']])} />
          <Btn kind="primary" onClick={add}><Plus size={13} /> {editAt >= 0 ? 'Update' : 'Add'}</Btn>
        </div>
      </Box>
      <Grid title="Accounts Information" maxHeight={300} empty="Enter an account and amount above, then Add. The next line starts with the difference."
        rows={lines}
        cols={[
          { label: 'Edit', w: 40, render: (l, i) => (l._parent ? '' : <span onClick={() => editLine(l, i)} style={{ cursor: 'pointer', color: T.head }}><Pencil size={13} /></span>) },
          { label: 'Delete', w: 48, render: (l, i) => (l._parent ? '' : <span onClick={() => removeAt(i)} style={{ cursor: 'pointer', color: T.dr }}><Trash2 size={13} /></span>) },
          { label: 'Account Name', wrap: true, render: l => <div style={{ paddingLeft: l._parent ? 14 : 0 }}><b>{nameOf(l.ledgerId)}</b>{' '}{l.isTds && <Badge tone="warn">TDS {(tdsNat(l.tdsNatureId) || {}).section}</Badge>}{l.isGst && !l._parent && <Badge tone="brand">GST {l.gstRate}%</Badge>}{l._parent && <span style={{ fontSize: 10, color: T.muted }}> (GST of the line above)</span>}</div> },
          { label: 'Debit', right: true, render: l => (l.dc === 'Dr' ? <Money v={inrOf(l)} side="Dr" /> : '') },
          { label: 'Credit', right: true, render: l => (l.dc === 'Cr' ? <Money v={inrOf(l)} side="Cr" /> : '') },
          ...(fc ? [{ label: 'Curr', render: () => h.currency }, { label: 'Ex Rate', right: true, render: () => h.roe }, { label: 'FC Amount', right: true, render: l => inr(l.amount) }] : []),
          { label: 'Ref No', render: l => l.refNo },
          ...(!cfg.banksOnly ? [{ label: 'Ref Date', render: l => fmtDate(l.refDate) }, { label: 'Ref Amt', right: true, render: l => (num(l.refAmt) ? inr(num(l.refAmt)) : '') }] : []),
          { label: 'Docket No', render: l => l.jobNo },
          { label: 'Cost Center', render: l => (look.cc.find(c => String(c.id) === String(l.costCentreId)) || {}).name || '' },
          { label: 'Narration', wrap: true, render: l => (l._parent ? l.remarks : [l.isTds && tdsNat(l.tdsNatureId) && 'on ' + inr(num(l.tdsBase)), l.remarks].filter(Boolean).join(' - ')) },
        ]}
        foot={['', '', 'Total', <Money v={dr} side="Dr" strong />, <Money v={cr} side="Cr" strong />]} />
      <Box>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) repeat(2, minmax(120px, 1fr))', gap: 10, alignItems: 'end' }}>
          <Field label="Narration"><input style={inputStyle} value={h.narration} onChange={set('narration')} /></Field>
          <Field label="Dr."><input readOnly style={{ ...roStyle, textAlign: 'right', color: T.dr, fontWeight: 800 }} value={inr(dr)} /></Field>
          <Field label="Cr."><input readOnly style={{ ...roStyle, textAlign: 'right', color: T.cr, fontWeight: 800 }} value={inr(cr)} /></Field>
        </div>
      </Box>
      <BalanceStrip dr={dr} cr={cr} />
      <ActionBar note={msg}>
        <Btn kind="save" onClick={save} disabled={saving}>{editId ? <Pencil size={13} /> : <Save size={13} />} {saving ? 'Saving' : editId ? 'Save changes' : 'Save'}</Btn>
        {!editId && actions}
        <Btn kind="clear" onClick={onClear}>{editId ? <X size={13} /> : <RotateCcw size={13} />} {editId ? 'Cancel' : 'Clear'}</Btn>
      </ActionBar>
      <style>{`@media (max-width: 1100px) { .acc-strip { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)) !important; } }`}</style>
    </>
  );
}
