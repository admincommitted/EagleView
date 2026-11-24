// Sales > quotation: header (validity, carrier, transit, cargo), charge lines from GST Charges with basis, buy / sell,
// minimum, currency and rate of exchange, the margin, terms; Print / PDF / Mail, Mark sent, Revise, Won (docket), Lost.
// A draft is edited directly; a sent quotation is changed through Revise (R1, R2 …). 14-Nov-2026.
import React from 'react';
import toast from 'react-hot-toast';
import { Save, Printer, FileDown, Mail, Send, Copy, Trophy, XCircle, RotateCcw, Trash2, Plus, X } from 'lucide-react';
import { api, C, inr, dmy, inp, btn, Field, Section, grid, Modal } from './salesUi';
import { DealChip, QT_STYLE } from './EnquiriesTab';
import { quoteHtml } from './quotePrint';

const num = (v) => { const n = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const count = (s) => String(s || '').split(/[,+]/).reduce((a, p) => { const m = /(\d+)\s*[Xx×*]/.exec(p); return a + (m ? Number(m[1]) : 0); }, 0);
// same working as the server (routes/salesDeals.js workLine)
function autoQty(basis, h) {
  return basis === 'KG' ? num(h.chargeableWt) || num(h.grossWt) : basis === 'CBM' ? num(h.cbm) : basis === 'CONTAINER' ? count(h.containers) : basis === 'PKG' ? num(h.pkgs) : basis === 'PCT' ? num(h.cargoValue) : 1;
}
function work(l, h) {
  const qty = l.autoQty ? autoQty(l.basis, h) : num(l.qty);
  const f = l.basis === 'PCT' ? qty / 100 : qty;
  const sell = r2(Math.max(num(l.sellRate) * f, num(l.minSell)));
  const buy = r2(Math.max(num(l.buyRate) * f, num(l.minBuy)));
  const roe = l.currency === 'INR' ? 1 : num(l.roe);
  return { qty, sell, buy, roe, sellInr: r2(sell * roe), buyInr: r2(buy * roe) };
}

export default function QuoteForm({ id, meta, deal, onClose, onChanged, openQuote }) {
  const [qt, setQt] = React.useState(null);
  const [lines, setLines] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [dlg, setDlg] = React.useState(null); // { kind: 'mail' | 'won' | 'lost', ... }
  const svc = Object.fromEntries((meta.services || []).map(s => [s[0], s[1]]));
  const charges = deal.charges || [];
  const byName = React.useMemo(() => new Map(charges.map(c => [String(c.chargeName).toUpperCase(), c])), [charges]);
  const exp = /EXP/.test(String(qt && qt.serviceType || ''));
  const rateOf = React.useCallback((cur) => { const c = (deal.currencies || []).find(x => x.code === cur); return c ? (exp ? (c.exportRate || c.importRate) : (c.importRate || c.exportRate)) : null; }, [deal.currencies, exp]);
  const load = React.useCallback(async () => {
    try { const d = await api('/quotes/' + id); setQt(d.data); setLines((d.data.lines || []).map(l => ({ ...l, key: Math.random(), autoQty: false }))); setDirty(false); }
    catch (e) { toast.error(e.message); onClose(); }
  }, [id]); // eslint-disable-line
  React.useEffect(() => { load(); }, [load]);
  if (!qt) return <Modal title="Quotation" onClose={onClose} width={600}><div style={{ color: C.mute }}>Loading…</div></Modal>;

  const draft = qt.status === 'DRAFT';
  const setH = (k, v) => { setQt(o => ({ ...o, [k]: v })); setDirty(true); };
  const setL = (key, patch) => { setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l))); setDirty(true); };
  const add = (section) => { setLines(ls => [...ls, { key: Math.random(), section, basis: section === 'FREIGHT' ? (String(qt.serviceType).includes('FCL') ? 'CONTAINER' : String(qt.serviceType).startsWith('AIR') ? 'KG' : 'CBM') : 'FLAT', currency: section === 'FREIGHT' && !/CUSTOMS|TRANSPORT/.test(qt.serviceType) ? 'USD' : 'INR', roe: section === 'FREIGHT' && !/CUSTOMS|TRANSPORT/.test(qt.serviceType) ? rateOf('USD') : 1, autoQty: true, head: '', chargeId: null }]); setDirty(true); };
  const worked = lines.map(l => ({ ...l, w: work(l, qt) }));
  const sell = r2(worked.reduce((s, l) => s + l.w.sellInr, 0)), buy = r2(worked.reduce((s, l) => s + l.w.buyInr, 0));
  const margin = r2(sell - buy), pct = sell ? r2(100 * margin / sell) : null;
  const warn = deal.marginWarnPct || 10;
  const body = () => ({ ...qt, lines: lines.map((l, i) => ({ ...l, qty: l.autoQty ? autoQty(l.basis, qt) : l.qty, sortOrder: i })) });

  const run = async (fn, okMsg) => { setBusy(true); try { const r = await fn(); if (okMsg) toast.success(okMsg); onChanged && onChanged(); return r; } catch (e) { if (e.askReplace) throw e; toast.error(e.message); return null; } finally { setBusy(false); } };
  const save = () => run(async () => { await api('/quotes/' + id, { method: 'PUT', body: body() }); await load(); return true; }, 'Quotation saved');
  const saveFirst = async () => (draft && dirty ? save() : true);
  const html = () => quoteHtml({ ...qt, lines: worked.map(l => ({ ...l, qty: l.w.qty, sellAmount: l.w.sell, sellInr: l.w.sellInr, roe: l.w.roe })) }, deal, svc[qt.serviceType]);
  const print = async () => {
    if (!(await saveFirst())) return;
    const w = window.open('', '_blank'); if (!w) { toast.error('Allow pop-ups to print'); return; }
    w.document.write(html()); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* closed */ } }, 400);
  };
  const pdf = async () => {
    if (!(await saveFirst())) return;
    setBusy(true);
    try {
      const res = await fetch('/api/sales-hub/quotes/' + id + '/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: html() }) });
      if (!res.ok) { let m = 'PDF not made'; try { m = (await res.json()).error || m; } catch (e) { /* not json */ } throw new Error(m); }
      const b = await res.blob(); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = String(qt.quoteNo).replace(/[\\/]+/g, '-') + '.pdf'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 10000);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const mail = async () => {
    if (!(await saveFirst())) return;
    setDlg({ kind: 'mail', to: qt.email || '', cc: qt.spEmail || '', subject: `Quotation ${qt.quoteNo} - ${svc[qt.serviceType] || ''} ${[qt.origin, qt.destination].filter(Boolean).join(' to ')}`,
      body: `Dear ${qt.contactPerson || 'Sir / Madam'},\n\nThank you for your enquiry. Please find our quotation ${qt.quoteNo} attached, valid until ${dmy(qt.validUntil)}.\n\nWe look forward to handling your shipment.\n\nRegards,\n${qt.salesPerson || ''}${qt.spMobile ? '\n' + qt.spMobile : ''}` });
  };
  const sendMail = () => run(async () => { await api('/quotes/' + id + '/mail', { method: 'POST', body: { to: dlg.to, cc: dlg.cc, subject: dlg.subject, body: dlg.body, html: html() } }); setDlg(null); await load(); return true; }, 'Quotation mailed and marked sent');
  const markSent = async () => { if (!(await saveFirst())) return; run(async () => { await api('/quotes/' + id + '/sent', { method: 'POST', body: {} }); await load(); return true; }, 'Marked as sent'); };
  const revise = () => run(async () => { const d = await api('/quotes/' + id + '/revise', { method: 'POST', body: {} }); toast.success('Revision ' + d.quoteNo + ' made'); openQuote(d.id); return true; });
  const won = async (replace) => {
    setBusy(true);
    try { const d = await api('/quotes/' + id + '/won', { method: 'POST', body: { docketNo: dlg.docketNo, replace } }); toast.success(d.docketNo ? `Won - docket ${d.docketNo} now bills at these rates` : 'Marked as won'); setDlg(null); await load(); onChanged && onChanged(); }
    catch (e) { if (e.askReplace && window.confirm(e.message + '\n\nReplace it with ' + qt.quoteNo + '?')) { setBusy(false); return won(true); } toast.error(e.message); }
    finally { setBusy(false); }
  };
  const lost = () => run(async () => { await api('/quotes/' + id + '/lost', { method: 'POST', body: { reason: dlg.reason, lostTo: dlg.lostTo, lostRate: dlg.lostRate } }); setDlg(null); await load(); return true; }, 'Marked as lost');
  const reopen = () => { if (window.confirm('Put ' + qt.quoteNo + ' back to "Sent"?' + (qt.docketNo ? ' Docket ' + qt.docketNo + ' loses this quotation no.' : ''))) run(async () => { await api('/quotes/' + id + '/reopen', { method: 'POST', body: {} }); await load(); return true; }, 'Back to sent'); };
  const del = () => { if (window.confirm('Delete draft ' + qt.quoteNo + '?')) run(async () => { await api('/quotes/' + id, { method: 'DELETE' }); onClose(); return true; }, 'Draft deleted'); };

  const H = (k, props = {}) => <input style={inp} value={qt[k] ?? ''} disabled={!draft || busy} onChange={e => setH(k, props.upper ? e.target.value.toUpperCase() : e.target.value)} {...props} upper={undefined} />;
  const cell = { padding: '3px 4px', borderTop: '1px solid #f1f5f9', verticalAlign: 'top' };
  const ci = { ...inp, padding: '4px 5px', fontSize: '11.5px' };
  const labels = Object.fromEntries((deal.quoteStatus || []).map(s => [s[0], s[1]]));
  const footer = <>
    {draft && <button type="button" style={btn('danger')} disabled={busy} onClick={del}><Trash2 size={13} /> Delete</button>}
    {['SENT', 'LOST'].includes(qt.status) && <button type="button" style={btn()} disabled={busy} onClick={revise}><Copy size={13} /> Revise</button>}
    {['WON', 'LOST'].includes(qt.status) && <button type="button" style={btn()} disabled={busy} onClick={reopen}><RotateCcw size={13} /> Back to sent</button>}
    <span style={{ flex: 1 }} />
    <button type="button" style={btn()} disabled={busy || !lines.length} onClick={print}><Printer size={13} /> Print</button>
    <button type="button" style={btn()} disabled={busy || !lines.length} onClick={pdf}><FileDown size={13} /> PDF</button>
    {['DRAFT', 'SENT'].includes(qt.status) && <button type="button" style={btn()} disabled={busy || !lines.length} onClick={mail}><Mail size={13} /> Mail</button>}
    {draft && <button type="button" style={btn()} disabled={busy || !lines.length} onClick={markSent} title="Sent some other way (WhatsApp, portal)"><Send size={13} /> Mark sent</button>}
    {qt.status === 'SENT' && <button type="button" style={btn('danger')} disabled={busy} onClick={() => setDlg({ kind: 'lost' })}><XCircle size={13} /> Lost</button>}
    {qt.status === 'SENT' && <button type="button" style={{ ...btn(), color: C.green, borderColor: '#86efac' }} disabled={busy} onClick={() => setDlg({ kind: 'won', docketNo: '' })}><Trophy size={13} /> Won</button>}
    {draft && <button type="button" style={btn('primary')} disabled={busy || !dirty} onClick={save}><Save size={13} /> {busy ? 'Saving…' : 'Save'}</button>}
  </>;
  return (
    <Modal title={`Quotation ${qt.quoteNo}`} onClose={() => { if (dirty && draft && !window.confirm('Changes are not saved. Close anyway?')) return; onClose(); }} width={1200} footer={footer}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px', fontSize: '12px' }}>
        <DealChip status={qt.status} map={QT_STYLE} labels={labels} />
        {qt.expired && <span style={{ color: C.red, fontWeight: 700 }}>Validity over</span>}
        <b>{qt.clientName}</b><span style={{ color: C.mute }}>{svc[qt.serviceType]} {[qt.origin, qt.destination].filter(Boolean).join(' > ')}</span>
        <span style={{ color: C.mute }}>Enquiry {qt.enquiryNo}</span>
        {qt.docketNo && <span>Docket <b>{qt.docketNo}</b></span>}
        {qt.status === 'LOST' && <span style={{ color: C.red }}>{qt.rejectReason}{qt.lostTo ? ' (to ' + qt.lostTo + ')' : ''}{qt.lostRate ? ', their rate ' + qt.lostRate : ''}</span>}
        {(qt.revisions || []).length > 1 && <span style={{ marginLeft: 'auto' }}>Revisions: {qt.revisions.map(r => r.id === qt.id ? <b key={r.id} style={{ marginLeft: 6 }}>{r.quoteNo.split('/').pop()}</b>
          : <button key={r.id} type="button" style={{ ...btn('ghost'), padding: '0 4px' }} onClick={() => openQuote(r.id)}>{r.quoteNo.split('/').pop()}</button>)}</span>}
      </div>
      {!draft && qt.status !== 'SUPERSEDED' && <div style={{ fontSize: '11.5px', color: C.amber, background: C.amberBg, padding: '5px 8px', borderRadius: '4px', marginBottom: '8px' }}>This quotation is {String(labels[qt.status] || qt.status).toLowerCase()} - it is not changed any more. Use Revise for new rates.</div>}
      {qt.status === 'SUPERSEDED' && <div style={{ fontSize: '11.5px', color: C.grey, background: C.greyBg, padding: '5px 8px', borderRadius: '4px', marginBottom: '8px' }}>An older revision - kept for the record.</div>}
      <Section title="Quotation">
        <div style={grid(150)}>
          <Field label="Date">{H('date', { type: 'date' })}</Field>
          <Field label="Valid until">{H('validUntil', { type: 'date' })}</Field>
          <Field label="Attention">{H('contactPerson')}</Field>
          <Field label="E-mail">{H('email')}</Field>
          <Field label="Sales person"><select style={inp} value={qt.salesPersonId || ''} disabled={!draft || busy} onChange={e => setH('salesPersonId', e.target.value)}><option value="">-</option>{(meta.persons || []).filter(p => p.isActive !== 0 || p.id === qt.salesPersonId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Incoterm"><select style={inp} value={qt.incoterms || ''} disabled={!draft || busy} onChange={e => setH('incoterms', e.target.value)}><option value="">-</option>{(meta.incoterms || []).map(t => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Carrier / line">{H('carrier')}</Field>
          <Field label="Routing">{H('routing', { placeholder: 'e.g. via DXB' })}</Field>
          <Field label="Transit time">{H('transitTime', { placeholder: 'e.g. 3-4 days' })}</Field>
          <Field label="Frequency">{H('frequency', { placeholder: 'e.g. daily' })}</Field>
          <Field label="Commodity" span={2}>{H('commodity')}</Field>
        </div>
        <div style={{ ...grid(120), marginTop: '8px' }}>
          <Field label="Packages">{H('pkgs', { type: 'number' })}</Field>
          <Field label="Gross wt (kg)">{H('grossWt', { type: 'number' })}</Field>
          <Field label="Chargeable wt (kg)">{H('chargeableWt', { type: 'number' })}</Field>
          <Field label="CBM">{H('cbm', { type: 'number' })}</Field>
          <Field label="Containers">{H('containers', { upper: true, placeholder: '2x40HC' })}</Field>
          <Field label="Cargo value">{H('cargoValue', { type: 'number' })}</Field>
          <Field label="Value currency"><select style={inp} value={qt.cargoCurrency || ''} disabled={!draft || busy} onChange={e => setH('cargoCurrency', e.target.value)}><option value="">-</option><option>INR</option>{(meta.currencies || []).map(c => <option key={c}>{c}</option>)}</select></Field>
        </div>
      </Section>
      <Section title="Charges" right={draft && (deal.sections || []).map(s => <button key={s[0]} type="button" style={{ ...btn(), padding: '3px 8px', fontSize: '11px' }} onClick={() => add(s[0])}><Plus size={11} /> {s[1].replace(' charges', '')}</button>)}>
        <datalist id="qt-charges">{charges.map(c => <option key={c.id} value={c.chargeName} />)}</datalist>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', minWidth: '1080px' }}>
            <thead><tr>{['Section', 'Charge (GST Charges)', 'Basis', 'Qty', 'Cur', 'ROE', 'Buy rate', 'Min buy', 'Sell rate', 'Min sell', 'Sell', 'Sell Rs', 'Margin Rs', 'Vendor', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '4px', background: '#f1f5f9', color: C.grey, fontSize: '10.5px', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
            <tbody>
              {worked.map(l => {
                const known = l.chargeId || byName.get(String(l.head || '').toUpperCase());
                const m = r2(l.w.sellInr - l.w.buyInr);
                return (
                  <tr key={l.key}>
                    <td style={cell}><select style={{ ...ci, width: '92px' }} disabled={!draft} value={l.section || 'OTHER'} onChange={e => setL(l.key, { section: e.target.value })}>{(deal.sections || []).map(s => <option key={s[0]} value={s[0]}>{s[1].replace(' charges', '')}</option>)}</select></td>
                    <td style={cell}><input list="qt-charges" style={{ ...ci, width: '210px', borderColor: known ? '#cbd5e1' : '#fca5a5' }} disabled={!draft} value={l.head || ''} title={l.sacCode ? `SAC ${l.sacCode}, GST ${l.gstRate}%` : 'Pick from the GST Charges list'}
                      onChange={e => { const c = byName.get(e.target.value.toUpperCase()); setL(l.key, { head: e.target.value, chargeId: c ? c.id : null, sacCode: c ? c.sacCode : null, gstRate: c ? c.gstRate : null }); }} />
                      <input style={{ ...ci, width: '210px', marginTop: '2px', fontSize: '10.5px' }} disabled={!draft} placeholder="note on the print (optional)" value={l.remarks || ''} onChange={e => setL(l.key, { remarks: e.target.value })} /></td>
                    <td style={cell}><select style={{ ...ci, width: '110px' }} disabled={!draft} value={l.basis || 'FLAT'} onChange={e => setL(l.key, { basis: e.target.value, autoQty: true })}>{(deal.basis || []).map(b => <option key={b[0]} value={b[0]}>{b[1]}</option>)}</select></td>
                    <td style={cell}><input style={{ ...ci, width: '70px', background: l.autoQty ? '#f0f9ff' : '#fff' }} disabled={!draft} title={l.autoQty ? 'From the cargo above - type to fix it' : 'Typed'} value={l.autoQty ? l.w.qty : (l.qty ?? '')} onChange={e => setL(l.key, { qty: e.target.value, autoQty: false })} /></td>
                    <td style={cell}><select style={{ ...ci, width: '62px' }} disabled={!draft} value={l.currency || 'INR'} onChange={e => setL(l.key, { currency: e.target.value, roe: e.target.value === 'INR' ? 1 : rateOf(e.target.value) })}><option>INR</option>{(meta.currencies || []).filter(c => c !== 'INR').map(c => <option key={c}>{c}</option>)}</select></td>
                    <td style={cell}><input style={{ ...ci, width: '62px' }} disabled={!draft || l.currency === 'INR'} value={l.currency === 'INR' ? 1 : (l.roe ?? '')} onChange={e => setL(l.key, { roe: e.target.value })} /></td>
                    <td style={cell}><input style={{ ...ci, width: '72px' }} disabled={!draft} value={l.buyRate ?? ''} onChange={e => setL(l.key, { buyRate: e.target.value })} /></td>
                    <td style={cell}><input style={{ ...ci, width: '64px' }} disabled={!draft} value={l.minBuy ?? ''} onChange={e => setL(l.key, { minBuy: e.target.value })} /></td>
                    <td style={cell}><input style={{ ...ci, width: '72px', fontWeight: 600 }} disabled={!draft} value={l.sellRate ?? ''} onChange={e => setL(l.key, { sellRate: e.target.value })} /></td>
                    <td style={cell}><input style={{ ...ci, width: '64px' }} disabled={!draft} value={l.minSell ?? ''} onChange={e => setL(l.key, { minSell: e.target.value })} /></td>
                    <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>{l.w.sell.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{inr(l.w.sellInr)}</td>
                    <td style={{ ...cell, textAlign: 'right', color: m < 0 ? C.red : undefined }}>{inr(m)}</td>
                    <td style={cell}><input style={{ ...ci, width: '100px' }} disabled={!draft} placeholder="airline / agent" value={l.vendor || ''} onChange={e => setL(l.key, { vendor: e.target.value })} /></td>
                    <td style={cell}>{draft && <button type="button" aria-label="Remove line" style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.red }} onClick={() => { setLines(ls => ls.filter(z => z.key !== l.key)); setDirty(true); }}><X size={14} /></button>}</td>
                  </tr>
                );
              })}
              {!lines.length && <tr><td colSpan={15} style={{ ...cell, color: C.mute, padding: '12px' }}>{draft ? 'Add charges with the buttons above (Freight, Origin, Destination, Customs …).' : 'No charges.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: '18px', justifyContent: 'flex-end', marginTop: '8px', fontSize: '12.5px', flexWrap: 'wrap' }}>
          <span>Sell <b>Rs {inr(sell)}</b></span><span>Buy Rs {inr(buy)}</span>
          <span style={{ color: pct != null && pct < warn ? C.red : C.green }}>Margin <b>Rs {inr(margin)}</b>{pct != null ? ` (${pct}%)` : ''}{pct != null && pct < warn ? ` - below ${warn}%` : ''}</span>
          <span style={{ color: C.mute }}>GST extra as per charge</span>
        </div>
      </Section>
      <Section title="Terms and remarks">
        <div style={grid(300)}>
          <Field label="Terms & conditions (one per line)" span={2}><textarea style={{ ...inp, minHeight: '110px', fontSize: '11.5px' }} disabled={!draft || busy} value={qt.terms || ''} onChange={e => setH('terms', e.target.value)} /></Field>
          <Field label="Remarks on the quotation"><textarea style={{ ...inp, minHeight: '110px' }} disabled={!draft || busy} value={qt.remarks || ''} onChange={e => setH('remarks', e.target.value)} /></Field>
        </div>
      </Section>
      {dlg && dlg.kind === 'mail' && (
        <Modal title={'Mail ' + qt.quoteNo} onClose={() => setDlg(null)} width={620} footer={<><button type="button" style={btn()} onClick={() => setDlg(null)}>Cancel</button><button type="button" style={btn('primary')} disabled={busy} onClick={sendMail}><Mail size={13} /> {busy ? 'Sending…' : 'Send with PDF'}</button></>}>
          <div style={{ display: 'grid', gap: '8px' }}>
            <Field label="To *"><input style={inp} value={dlg.to} onChange={e => setDlg({ ...dlg, to: e.target.value })} /></Field>
            <Field label="Cc"><input style={inp} value={dlg.cc} onChange={e => setDlg({ ...dlg, cc: e.target.value })} /></Field>
            <Field label="Subject"><input style={inp} value={dlg.subject} onChange={e => setDlg({ ...dlg, subject: e.target.value })} /></Field>
            <Field label="Message"><textarea style={{ ...inp, minHeight: '140px' }} value={dlg.body} onChange={e => setDlg({ ...dlg, body: e.target.value })} /></Field>
            <div style={{ fontSize: '11px', color: C.mute }}>Goes from the e-mail account in Settings &gt; Email, with {String(qt.quoteNo).replace(/[\\/]+/g, '-')}.pdf attached. The quotation is then marked sent.</div>
          </div>
        </Modal>
      )}
      {dlg && dlg.kind === 'won' && (
        <Modal title={'Won - ' + qt.quoteNo} onClose={() => setDlg(null)} width={480} footer={<><button type="button" style={btn()} onClick={() => setDlg(null)}>Cancel</button><button type="button" style={{ ...btn('primary'), background: C.green, borderColor: C.green }} disabled={busy} onClick={() => won(false)}><Trophy size={13} /> Mark won</button></>}>
          <Field label="Docket no (if already registered)" hint="Freight > Shipment Registration. The docket gets this quotation no., and its Provisional Sheet then offers these charges at the quoted rates. Can be left blank."><input style={inp} value={dlg.docketNo} onChange={e => setDlg({ ...dlg, docketNo: e.target.value.toUpperCase() })} placeholder="e.g. DEL/AI/1001/26" /></Field>
        </Modal>
      )}
      {dlg && dlg.kind === 'lost' && (
        <Modal title={'Lost - ' + qt.quoteNo} onClose={() => setDlg(null)} width={480} footer={<><button type="button" style={btn()} onClick={() => setDlg(null)}>Cancel</button><button type="button" style={btn('danger')} disabled={busy || !dlg.reason} onClick={lost}><XCircle size={13} /> Mark lost</button></>}>
          <div style={grid(200)}>
            <Field label="Reason *"><select style={inp} value={dlg.reason || ''} onChange={e => setDlg({ ...dlg, reason: e.target.value })}><option value="">- pick -</option>{((meta.lookups || {}).LOST_REASON || []).filter(r => r.isActive !== 0).map(r => <option key={r.id}>{r.value}</option>)}</select></Field>
            <Field label="Lost to (competitor)"><input style={inp} value={dlg.lostTo || ''} onChange={e => setDlg({ ...dlg, lostTo: e.target.value })} /></Field>
            <Field label="Their rate (if known)"><input style={inp} value={dlg.lostRate || ''} onChange={e => setDlg({ ...dlg, lostRate: e.target.value })} placeholder="e.g. USD 2.20/kg" /></Field>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
