// Shared parts of the AWB document windows (SLI, DGD, labels, booking, CCA, DO, COO, lithium, live animals, temperature,
// security declaration) - 11-Nov-2026.
// Before: every window got only the AWB number, everything else was typed again; "Print" printed the whole screen
// (window.print), the top bar covered the window's buttons, and what was typed came back only by luck.
// Now: DocWindow reads the saved AWB (GET /api/awb/doc-data/:type/:id) and the window fills itself from it; what the
// operator changes / types is kept with the AWB (PersistedDoc) and comes back next time; Print prints only the sheet;
// PDF / Word export the sheet with the typed values; "Fill from AWB" starts again from the AWB.
import React from 'react';
import { createPortal } from 'react-dom';
import html2pdf from 'html2pdf.js';
import { X, Printer, Download, FileText, RefreshCw } from 'lucide-react';

// given by PersistedDoc: { docType, restore(root), capture(root) }
export const DocCtx = React.createContext(null);

export const dmy = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? `${m[3]}-${m[2]}-${m[1]}` : (v || ''); };
export const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const dMonY = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? `${m[3]}-${MON[Number(m[2]) - 1]}-${m[1]}` : (v || ''); };
export const kg = (v) => (v || v === 0 ? (Number(v) || 0).toFixed(2) : '');
export const money = (v) => (Number(v) ? Number(v).toFixed(2) : '');
const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// what a window shows when the AWB is not saved yet (blank form)
export const EMPTY_DOC = {
  awbNo: '', mawbNo: '', hawbNo: '', date: '', airline: { name: '', code: '', prefix: '' }, flights: [], routing: [], origin: { code: '', name: '', country: '' },
  destination: { code: '', name: '', country: '' }, shipper: {}, consignee: {}, notify: null, shipperBlock: '', consigneeBlock: '', notifyBlock: '', agent: {},
  pieces: '', gross: '', chargeable: '', volume: '', lines: [], dims: [], dimsText: '', goods: '', hsCodes: [], shc: [], handling: '', ssr: '', osi: '', sci: '',
  currency: '', chargeCode: '', declared: {}, charges: { other: [] }, executed: {}, houses: [], company: {}, user: '', today: new Date().toISOString().slice(0, 10),
};
export const flightText = (d) => (d.flights || []).map(f => `${f.flight}${f.date ? ' / ' + dmy(f.date) : ''}`).join(', ');
export const airportText = (a) => (a && a.code ? `${a.code}${a.name ? ' - ' + a.name : ''}` : '');
export const isPrepaid = (d) => /^P/i.test(d.chargeCode || '') || !d.chargeCode;

// ---- fields: named (so a typed value comes back in the same place) and filled from the AWB ----
const line = { border: 'none', borderBottom: '1px solid #000', outline: 'none', fontFamily: 'Arial, sans-serif', fontSize: '11px', padding: '2px 3px', background: 'transparent', boxSizing: 'border-box', color: '#000' };
export function In({ name, v, w = '100%', style, ...rest }) {
  return <input name={name} defaultValue={v == null ? '' : String(v)} style={{ ...line, width: w, ...style }} {...rest} />;
}
export function Tx({ name, v, rows = 3, style, ...rest }) {
  return <textarea name={name} defaultValue={v == null ? '' : String(v)} rows={rows} style={{ ...line, border: '1px solid #cbd5e1', width: '100%', resize: 'vertical', ...style }} {...rest} />;
}
export function Ck({ name, on, label, style }) {
  return <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '12px', fontSize: '11px', ...style }}><input type="checkbox" name={name} defaultChecked={!!on} /> {label}</label>;
}
export const box = { border: '1px solid #000', padding: '6px 8px', verticalAlign: 'top' };
export const cap = { fontSize: '9.5px', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '2px' };
export const title = { textAlign: 'center', fontSize: '17px', fontWeight: 'bold', margin: '0 0 2px', letterSpacing: '0.5px' };
export function Letterhead({ c, small }) {
  return (
    <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '5px', marginBottom: '10px' }}>
      <div style={{ fontSize: small ? '15px' : '18px', fontWeight: 'bold' }}>{(c && c.name) || ' '}</div>
      {c && c.address && <div style={{ fontSize: '10px' }}>{c.address}</div>}
      {c && (c.gstin || c.phone || c.email) && <div style={{ fontSize: '9.5px' }}>{[c.gstin && `GSTIN ${c.gstin}`, c.phone && `Ph ${c.phone}`, c.email].filter(Boolean).join('   |   ')}</div>}
    </div>
  );
}
export function Sign({ left, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '40px', marginTop: '28px', fontSize: '10.5px' }}>
      {[left, right].filter(Boolean).map((t, i) => <div key={i} style={{ flex: 1, textAlign: i ? 'right' : 'left' }}><div style={{ height: '34px' }} /><div style={{ borderTop: '1px solid #000', display: 'inline-block', minWidth: '220px', paddingTop: '3px' }}>{t}</div></div>)}
    </div>
  );
}

// ---- reading the AWB ----
export function useAwbDoc(isOpen, awbId, awbType) {
  const [state, setState] = React.useState({ d: null, loading: false, err: '' });
  const load = React.useCallback(() => {
    if (!awbId) { setState({ d: null, loading: false, err: 'This AWB is not saved yet - the form opens blank. Save the AWB to fill it from the AWB.' }); return; }
    setState(s => ({ ...s, loading: true, err: '' }));
    fetch(`/api/awb/doc-data/${encodeURIComponent(awbType || 'AWB')}/${encodeURIComponent(awbId)}`)
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Could not read the AWB'); return j; })
      .then(d => setState({ d, loading: false, err: '' })).catch(e => setState({ d: null, loading: false, err: e.message }));
  }, [awbId, awbType]);
  // closed: forget the AWB, so the next opening fills (and restores) from a fresh read
  React.useEffect(() => { if (isOpen) load(); else setState({ d: null, loading: false, err: '' }); }, [isOpen, load]);
  return { ...state, reload: load };
}

// the sheet with its typed values written in (inputs do not print / export reliably)
export function sheetClone(root) {
  const c = root.cloneNode(true);
  const src = root.querySelectorAll('input, textarea, select');
  c.querySelectorAll('input, textarea, select').forEach((el, i) => {
    const o = src[i];
    const span = document.createElement('span');
    if (o && (o.type === 'checkbox' || o.type === 'radio')) { span.textContent = o.checked ? '[X]' : '[  ]'; span.style.fontFamily = 'monospace'; }
    else {
      const val = o ? (o.tagName === 'SELECT' ? (o.options[o.selectedIndex] || {}).text || '' : o.value) : '';
      span.innerHTML = esc(val).replace(/\n/g, '<br/>') || '&nbsp;';
      span.style.cssText = `display:${o && o.tagName === 'TEXTAREA' ? 'block' : 'inline-block'};min-width:${o && o.tagName === 'TEXTAREA' ? '100%' : '20px'};font-size:11px;white-space:pre-wrap;`;
      if (o && o.tagName !== 'TEXTAREA') span.style.borderBottom = '1px solid #000';
    }
    el.parentNode.replaceChild(span, el);
  });
  return c;
}

const tb = (bg) => ({ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 11px', backgroundColor: bg, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' });

// window: reads the AWB, shows the sheet (children(d)), keeps what is typed, prints / exports only the sheet
export function DocWindow({ isOpen, onClose, title: heading, fileName, awbId, awbType, landscape, sheetWidth = 794, children, extraButtons }) {
  const pctx = React.useContext(DocCtx);
  const { d, loading, err, reload } = useAwbDoc(isOpen, awbId, awbType);
  const [gen, setGen] = React.useState(0);
  const sheetRef = React.useRef(null);
  const restored = React.useRef(false);
  React.useEffect(() => { if (!isOpen) restored.current = false; }, [isOpen]);
  // what was typed before comes back once the sheet is filled from the AWB
  React.useEffect(() => {
    if (!isOpen || loading || (!d && !err) || restored.current || !sheetRef.current) return; // only once the AWB is read
    restored.current = true;
    if (pctx && pctx.restore) setTimeout(() => pctx.restore(sheetRef.current), 0);
  }, [isOpen, loading, d, err]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!isOpen) return null;
  const base = String(fileName || heading || 'Document').replace(/[^A-Za-z0-9_-]+/g, '_');
  const refill = () => {
    if (!window.confirm('Fill the form again from the AWB? What was typed here is replaced.')) return;
    reload(); setGen(g => g + 1);
    setTimeout(() => { if (pctx && pctx.capture && sheetRef.current) pctx.capture(sheetRef.current); }, 600);
  };
  const doPrint = () => {
    const c = sheetClone(sheetRef.current);
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;'; document.body.appendChild(f);
    const doc = f.contentWindow.document; doc.open();
    doc.write(`<html><head><title>${esc(base)}</title><style>@page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:8mm} body{margin:0;font-family:Arial,sans-serif;color:#000} .pb{page-break-after:always} table{border-collapse:collapse}</style></head><body>${c.outerHTML}</body></html>`);
    doc.close();
    setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 1500); }, 300);
  };
  const doPdf = () => {
    const c = sheetClone(sheetRef.current); c.style.width = (landscape ? 1040 : 720) + 'px'; c.style.padding = '8px';
    html2pdf().set({ margin: [0.25, 0.25, 0.25, 0.25], filename: `${base}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' }, pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.keep'] } }).from(c).save();
  };
  const doWord = () => {
    const c = sheetClone(sheetRef.current);
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${esc(base)}</title><style>@page WordSection1 { size: ${landscape ? '841.9pt 595.3pt; mso-page-orientation: landscape' : '595.3pt 841.9pt'}; margin: 0.5in; } div.WordSection1 { page: WordSection1; } table { border-collapse: collapse; }</style></head><body><div class="WordSection1">${c.outerHTML}</div></body></html>`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'application/msword' })); a.download = `${base}.doc`; document.body.appendChild(a); a.click(); a.remove();
  };
  const data = d || EMPTY_DOC;
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div role="dialog" aria-label={heading} style={{ backgroundColor: '#e2e8f0', width: '96vw', maxWidth: `${sheetWidth + 80}px`, height: '94vh', borderRadius: '8px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }}>
        <div style={{ padding: '9px 14px', borderBottom: '1px solid #cbd5e1', display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: '8px 8px 0 0', flexWrap: 'wrap' }}>
          <div style={{ marginRight: 'auto', minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: 'bold' }}>{heading}{data.hawbNo ? ` - HAWB ${data.hawbNo}` : data.awbNo ? ` - ${data.awbNo}` : ''}</h2>
            <span style={{ fontSize: '11px', color: loading ? '#64748b' : err ? '#b45309' : '#16a34a', fontWeight: 'bold' }}>{loading ? 'Reading the AWB...' : err || 'Filled from the saved AWB - change anything; it is kept with the AWB'}</span>
          </div>
          {extraButtons}
          {awbId && <button type="button" onClick={refill} style={tb('#64748b')} title="Start again from the AWB"><RefreshCw size={14} /> Fill from AWB</button>}
          <button type="button" onClick={doPrint} style={tb('#0f766e')}><Printer size={14} /> Print</button>
          <button type="button" onClick={doPdf} style={tb('#dc2626')}><Download size={14} /> PDF</button>
          <button type="button" onClick={doWord} style={tb('#2563eb')}><FileText size={14} /> Word</button>
          <button type="button" onClick={onClose} aria-label="Close" style={{ display: 'flex', padding: '6px', backgroundColor: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}><X size={16} /></button>
        </div>
        <div style={{ padding: '14px', flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
          {loading ? <div style={{ color: '#64748b', fontSize: '13px', padding: '40px' }}>Reading the AWB...</div> : (
            <div key={gen} ref={sheetRef} data-doc-root={pctx ? pctx.docType : ''} style={{ width: `${sheetWidth}px`, backgroundColor: 'white', padding: '22px 26px', fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#000', boxSizing: 'border-box', alignSelf: 'flex-start', textTransform: 'none' }}>
              {children(data)}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---- Code 39 barcode (labels) - plain SVG, no library ----
const C39 = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
  U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn',
  $: 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn',
};
export function Barcode39({ value, height = 46, unit = 1.4 }) {
  const text = '*' + String(value || '').toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, '') + '*';
  const bars = []; let x = 0;
  for (const ch of text) {
    const p = C39[ch]; if (!p) continue;
    for (let i = 0; i < 9; i++) { const w = (p[i] === 'w' ? 3 : 1) * unit; if (i % 2 === 0) bars.push(<rect key={bars.length} x={x} y={0} width={w} height={height} fill="#000" />); x += w; }
    x += unit; // gap between characters
  }
  return <svg width={x} height={height} viewBox={`0 0 ${x} ${height}`} role="img" aria-label={`Barcode ${value}`} style={{ display: 'block', margin: '0 auto' }}>{bars}</svg>;
}
