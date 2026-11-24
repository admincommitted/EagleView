// 09-Nov-2026: Voucher details in a side panel (like iCAFFE's "Voucher Details" screen, without leaving the report).
// Opened from the Ledger, the registers / Day Book report, the Daybook page and Outstanding: click a voucher row and every
// account head of that voucher shows on the right - branch, division, docket, ref, the Dr / Cr lines, narration, bills set
// off, party bill and GST invoice. Up / Down arrows (or the < > buttons) move through the rows of the report; Esc closes.
// Backend: GET /api/accounts-hub/vouchers/:id (lines, allocations, purchase info, gst).
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Printer, FileText, ExternalLink, Layers } from 'lucide-react';
import { T, inr, fmtDate, api, Btn, Badge, statusTone } from './ui';
import { printVoucher } from './printVoucher';
import { deskOf } from './CommandSearch';
import { openInvoicePdf } from './GstInvoiceDesk';

const BRANCH = { DEL: 'NEW DELHI', MUM: 'MUMBAI', JPR: 'JAIPUR', LDH: 'LUDHIANA' };
const DIVISION = { AI: 'Import Air', AE: 'Export Air', SI: 'Import Sea', SE: 'Export Sea' };
const cache = new Map(); // voucher id -> details, for this browser session (cleared when a voucher is saved elsewhere)
if (typeof window !== 'undefined' && !window.__vdCacheHook) {
  window.__vdCacheHook = true;
  const f = window.fetch;
  window.fetch = function (u, o) { try { const m = String((o && o.method) || 'GET').toUpperCase(); if (m !== 'GET' && /\/api\/(accounts-hub|vouchers|accounts-gst)/.test(String(u && u.url ? u.url : u))) cache.clear(); } catch (e) { /* ignore */ } return f.apply(this, arguments); };
}
const load = (id) => (cache.has(id) ? Promise.resolve(cache.get(id)) : api('/api/accounts-hub/vouchers/' + id).then(v => { cache.set(id, v); if (cache.size > 300) cache.delete(cache.keys().next().value); return v; }));

// ids: the voucher ids of the rows on the screen, in order (for Up / Down); id: the one to show
export default function VoucherDrawer({ id, ids, onMove, onClose }) {
  const nav = useNavigate();
  const [v, setV] = useState(null);
  const [err, setErr] = useState('');
  const [merge, setMerge] = useState(() => { try { return localStorage.getItem('vdMerge') === '1'; } catch (e) { return false; } });
  const list = useMemo(() => [...new Set((ids || []).filter(Boolean).map(Number))], [ids]);
  const pos = list.indexOf(Number(id));
  const go = (d) => { const n = list[pos + d]; if (n && onMove) onMove(n); };
  useEffect(() => { let live = true; setErr(''); setV(null); if (id) load(Number(id)).then(x => live && setV(x)).catch(e => live && setErr(e.message)); return () => { live = false; }; }, [id]);
  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (/INPUT|SELECT|TEXTAREA/.test((e.target && e.target.tagName) || '')) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); go(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  const setM = (b) => { setMerge(b); try { localStorage.setItem('vdMerge', b ? '1' : '0'); } catch (e) { /* ignore */ } };
  const lines = useMemo(() => {
    if (!v) return [];
    const ls = (v.lines || []).map(l => ({ name: l.ledgerName, group: l.groupName, dr: l.dc === 'Dr' ? Number(l.amount) || 0 : 0, cr: l.dc === 'Cr' ? Number(l.amount) || 0 : 0, remarks: l.remarks, fcy: l.currency && l.currency !== 'INR' && l.amountFcy ? l.currency + ' ' + inr(l.amountFcy) + (l.roe ? ' @ ' + l.roe : '') : '', n: 1 }));
    // iCAFFE order: account name A-Z within the voucher
    ls.sort((a, b) => String(a.name).localeCompare(String(b.name)) || (b.dr - a.dr));
    if (!merge) return ls;
    const m = new Map();
    for (const l of ls) { const k = l.name + '|' + (l.dr ? 'Dr' : 'Cr'); const x = m.get(k); if (x) { x.dr += l.dr; x.cr += l.cr; x.n++; } else m.set(k, { ...l, remarks: '' }); }
    return [...m.values()];
  }, [v, merge]);
  const dr = lines.reduce((s, l) => s + l.dr, 0), cr = lines.reduce((s, l) => s + l.cr, 0);
  const narr = v ? String(v.narration || '').trim() : '';
  // a line remark is shown only when it adds something (iCAFFE repeats the narration on every line)
  const extra = (r) => { const s = String(r || '').replace(/\s+/g, ' ').trim(); return s && !narr.replace(/\s+/g, ' ').includes(s) ? s : ''; };
  const fullScreen = () => { if (!v) return; onClose(); if (v.gst && v.gst.kind) nav('/accounts-hub?item=gst' + v.gst.kind + '&voucher=' + v.id); else nav('/accounts-hub?item=' + deskOf(v.baseType || 'Journal') + '&voucher=' + v.id); };
  // the invoice already saved for this voucher: as a PDF, or the same page as Print when no PDF can be made here
  const pdf = () => { setErr(''); openInvoicePdf(v.id, false).catch(e => setErr('Invoice: ' + String(e.message || e).split('\n')[0].slice(0, 200))); };
  const info = v ? [
    ['Branch', BRANCH[v.branchCode] || v.branchCode || 'NEW DELHI'], ['Division', DIVISION[v.division] || v.division],
    ['Voucher No', v.voucherNumber], ['Date', fmtDate(v.date)],
    ['Docket No', v.jobNo], ['Ref / Cheque', v.refNo],
    v.purchase && (v.purchase.billNo || v.purchase.billDate) ? ['Party bill', [v.purchase.billNo, v.purchase.billDate && fmtDate(v.purchase.billDate)].filter(Boolean).join(' dt. ')] : null,
    v.gst ? ['GST invoice', v.gst.invoiceNo + (v.gst.irn ? '  (IRN)' : '')] : null,
  ].filter(x => x && x[1]) : [];
  const cellR = { textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', padding: '5px 10px' };
  // drawn on <body> so it sits above the app's header and footer whatever screen opened it
  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.18)', zIndex: 99990 }} />
      <aside role="dialog" aria-label="Voucher details" className="vd-panel" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(600px, 100vw)', background: '#fff', zIndex: 99991, boxShadow: '-10px 0 30px rgba(15,23,42,0.18)', display: 'flex', flexDirection: 'column', animation: 'vdIn .16s ease-out' }}>
        <style>{'@keyframes vdIn{from{transform:translateX(24px);opacity:.4}to{transform:none;opacity:1}} @media (prefers-reduced-motion: reduce){aside.vd-panel{animation:none!important}} @media (max-width: 560px){aside.vd-panel .vd-info{grid-template-columns:minmax(0,1fr)!important}} aside.vd-panel table th{color:#fff!important;background:#1e3a6e!important;font-size:11.5px!important;padding:6px 10px!important}'}</style>
        <div style={{ background: T.grad, color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, opacity: 0.85 }}>Voucher Details{v ? ' - ' + (v.icaffeType || v.typeName || '') : ''}</div>
            <div style={{ fontSize: 17, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v ? v.voucherNumber : 'Loading...'}</div>
          </div>
          {list.length > 1 && <>
            <button type="button" title="Previous row (Up arrow)" onClick={() => go(-1)} disabled={pos <= 0} style={hb(pos <= 0)}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{pos + 1} of {list.length}</span>
            <button type="button" title="Next row (Down arrow)" onClick={() => go(1)} disabled={pos < 0 || pos >= list.length - 1} style={hb(pos < 0 || pos >= list.length - 1)}><ChevronRight size={16} /></button>
          </>}
          <button type="button" title="Close (Esc)" onClick={onClose} style={hb(false)}><X size={16} /></button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {err && <div style={{ color: T.dr, fontWeight: 700, fontSize: 12 }}>{err}</div>}
          {!v && !err && <div style={{ color: T.muted, fontSize: 12, padding: 20, textAlign: 'center' }}>Loading voucher...</div>}
          {v && <>
            <div className="vd-info" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '6px 18px', fontSize: 12 }}>
              {info.map(([k, val]) => <div key={k} style={{ display: 'flex', gap: 8, minWidth: 0 }}><span style={{ color: T.muted, width: 86, flex: '0 0 auto' }}>{k}</span><b style={{ color: T.text, overflowWrap: 'anywhere' }}>{val}</b></div>)}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ color: T.muted, width: 86 }}>Status</span><Badge tone={statusTone(v.status || '')}>{v.status || '-'}</Badge>{v.createdByName && <span style={{ color: T.muted, fontSize: 11 }}>by {v.createdByName}</span>}</div>
            </div>
            <div style={{ border: `1px solid ${T.ruleSoft}`, borderRadius: 6, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ background: '#1e3a6e', color: '#fff' }}>
                  <th style={{ ...thD, textAlign: 'left' }}>Particulars</th><th style={{ ...thD, textAlign: 'right' }}>Debit</th><th style={{ ...thD, textAlign: 'right' }}>Credit</th>
                </tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${T.ruleSoft}`, background: i % 2 ? '#fbfdff' : '#fff' }}>
                      <td style={{ padding: '5px 10px' }}>
                        <div style={{ fontWeight: 600 }}>{l.name}{l.n > 1 && <span style={{ color: T.muted, fontWeight: 500 }}> ({l.n} lines)</span>}</div>
                        {(l.group || extra(l.remarks) || l.fcy) && <div style={{ fontSize: 10.5, color: T.muted }}>{[l.group, l.fcy, extra(l.remarks)].filter(Boolean).join(' | ')}</div>}
                      </td>
                      <td style={{ ...cellR, color: T.dr }}>{l.dr ? inr(l.dr) : ''}</td>
                      <td style={{ ...cellR, color: T.cr }}>{l.cr ? inr(l.cr) : ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ borderTop: `2px solid ${T.rule}`, background: T.headBg }}>
                  <td style={{ padding: '6px 10px', fontWeight: 800, textAlign: 'right' }}>Total</td>
                  <td style={{ ...cellR, fontWeight: 800 }}>{inr(dr)}</td><td style={{ ...cellR, fontWeight: 800 }}>{inr(cr)}</td>
                </tr></tfoot>
              </table>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, margin: 0, cursor: 'pointer' }}><input type="checkbox" checked={merge} onChange={e => setM(e.target.checked)} /> <Layers size={12} /> Same account on one line</label>
              {Math.abs(dr - cr) > 0.009 && <span style={{ color: T.dr, fontWeight: 700 }}>Dr and Cr differ by {inr(Math.abs(dr - cr))}</span>}
            </div>
            {narr && <div style={{ fontSize: 12, background: T.headBg, border: `1px solid ${T.headBorder}`, borderRadius: 6, padding: '8px 10px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><div style={{ fontSize: 10.5, fontWeight: 800, color: T.head, marginBottom: 2 }}>Narration</div>{narr}</div>}
            {(v.allocations || []).length > 0 && <div style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 800, color: T.head, marginBottom: 4 }}>Bills set off</div>
              {(v.allocations || []).map((a, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${T.ruleSoft}`, padding: '3px 0' }}><span>{a.againstNo || a.refNo || a.refType}{a.againstDate ? ' dt. ' + fmtDate(a.againstDate) : ''}</span><b style={{ fontVariantNumeric: 'tabular-nums' }}>{inr(a.amount)}</b></div>)}
            </div>}
            {(v.creditNotes || []).length > 0 && <div style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 800, color: T.head, marginBottom: 4 }}>Credit notes against this bill</div>
              {v.creditNotes.map(c => <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${T.ruleSoft}`, padding: '3px 0' }}><span>{c.voucherNumber} dt. {fmtDate(c.date)}</span><b>{inr(c.totalAmount)}</b></div>)}
            </div>}
          </>}
        </div>
        <div style={{ borderTop: `1px solid ${T.ruleSoft}`, padding: '10px 14px', display: 'flex', gap: 8, flexWrap: 'wrap', background: '#f8fafc' }}>
          <Btn kind="primary" disabled={!v} onClick={() => { if (!printVoucher(v)) setErr('Allow pop-ups for this site to print'); }}><Printer size={13} /> Print</Btn>
          {v && v.gst && <Btn kind="clear" onClick={pdf}><FileText size={13} /> Invoice</Btn>}
          <Btn kind="clear" disabled={!v} onClick={fullScreen}><ExternalLink size={13} /> Open voucher</Btn>
          <span style={{ flex: 1 }} />
          <Btn kind="plain" onClick={onClose}>Close</Btn>
        </div>
      </aside>
    </>,
    document.body
  );
}
const thD = { background: '#1e3a6e', color: '#fff', padding: '6px 10px', fontWeight: 700, position: 'static' };
const hb = (dis) => ({ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff', borderRadius: 6, width: 30, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: dis ? 'default' : 'pointer', opacity: dis ? 0.4 : 1 });
