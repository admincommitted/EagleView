// Air cargo (consol) manifest of a MAWB - 11-Nov-2026.
// Before: the master's date / destination / flight / consignee were left blank (filled only on the MAWB screen, which had
// no button for it), goods / chargeable weight / addresses of the houses were empty, our name and address were typed
// into the code (Delhi only), and the totals were not checked against the MAWB. Now everything comes from
// GET /api/awb/manifest/:mawb - the saved MAWB and its live HAWBs - and the sheet can be printed, saved as PDF / Word or
// taken to Excel. Only "Remarks" and "Prepared by" are typed here (kept with the AWB by PersistedDoc).
import React from 'react';
import { createPortal } from 'react-dom';
import { X, Download, FileText, RefreshCw, Printer, FileSpreadsheet } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { DocCtx } from './docKit';

const dmy = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? `${m[3]}-${m[2]}-${m[1]}` : (v || ''); };
const kg = (v) => (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const cell = { padding: '5px 6px', border: '1px solid #000', verticalAlign: 'top', fontSize: '10.5px' };
const head = { ...cell, fontWeight: 'bold', background: '#eef2f7', fontSize: '10px', textAlign: 'left' };
const num = { ...cell, textAlign: 'right', whiteSpace: 'nowrap' };

function PartyBlock({ title, p }) {
  return (
    <div style={{ border: '1px solid #000', padding: '6px 8px', minHeight: '64px' }}>
      <div style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#334155', marginBottom: '3px' }}>{title}</div>
      <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{p && p.name}</div>
      {p && p.address && <div style={{ fontSize: '10px' }}>{p.address}</div>}
      {p && p.place && <div style={{ fontSize: '10px' }}>{p.place}</div>}
      {p && p.phone && <div style={{ fontSize: '10px' }}>Ph: {p.phone}</div>}
    </div>
  );
}

const CargoManifestModal = ({ isOpen, onClose, awbNumber }) => {
  const sheetRef = React.useRef();
  const [d, setD] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  // remarks / prepared by typed before come back once the sheet is drawn (PersistedDoc)
  const pctx = React.useContext(DocCtx);
  const restored = React.useRef(false);
  React.useEffect(() => { if (!isOpen) restored.current = false; }, [isOpen]);
  React.useEffect(() => {
    if (!isOpen || loading || !d || restored.current || !sheetRef.current) return;
    restored.current = true;
    if (pctx && pctx.restore) setTimeout(() => pctx.restore(sheetRef.current), 0);
  }, [isOpen, loading, d]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = React.useCallback(() => {
    if (!awbNumber) return;
    setLoading(true); setErr('');
    fetch(`/api/awb/manifest/${encodeURIComponent(awbNumber)}`)
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Could not read the manifest'); return j; })
      .then(setD).catch(e => { setD(null); setErr(e.message); }).finally(() => setLoading(false));
  }, [awbNumber]);
  React.useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  if (!isOpen) return null;
  const m = (d && d.master) || {};
  const rows = (d && d.houses) || [];
  const t = (d && d.totals) || {};
  const co = (d && d.company) || {};
  const mawbNo = m.mawb || awbNumber || '';
  const fileBase = `Manifest_${String(mawbNo).replace(/[^0-9A-Za-z-]/g, '')}`;

  // the sheet with typed values written in (inputs do not print / export reliably)
  const sheetHtml = () => {
    const c = sheetRef.current.cloneNode(true);
    c.style.width = '1040px'; c.style.padding = '10px 12px'; // fits A4 landscape
    c.querySelectorAll('input, textarea').forEach(el => {
      const orig = sheetRef.current.querySelector(`[data-k="${el.getAttribute('data-k')}"]`);
      const div = document.createElement('div');
      div.innerHTML = esc(orig ? orig.value : el.value).replace(/\n/g, '<br/>') || '&nbsp;';
      div.style.cssText = 'font-size:10.5px;min-height:14px;';
      el.parentNode.replaceChild(div, el);
    });
    return c;
  };
  const doPrint = () => {
    const c = sheetHtml();
    const w = document.createElement('iframe');
    w.style.cssText = 'position:fixed;width:0;height:0;border:0;';
    document.body.appendChild(w);
    const doc = w.contentWindow.document;
    doc.open();
    doc.write(`<html><head><title>${esc(fileBase)}</title><style>@page{size:A4 landscape;margin:8mm} body{margin:0;font-family:Arial,sans-serif;color:#000} table{page-break-inside:auto} tr{page-break-inside:avoid}</style></head><body>${c.outerHTML}</body></html>`);
    doc.close();
    setTimeout(() => { w.contentWindow.focus(); w.contentWindow.print(); setTimeout(() => w.remove(), 1500); }, 300);
  };
  const doPdf = () => {
    html2pdf().set({ margin: [0.25, 0.25, 0.25, 0.25], filename: `${fileBase}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, windowWidth: 1150 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }, pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' } }).from(sheetHtml()).save();
  };
  const doWord = () => {
    const c = sheetHtml();
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Cargo Manifest</title><style>@page WordSection1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 0.4in; } div.WordSection1 { page: WordSection1; } table { border-collapse: collapse; }</style></head><body><div class="WordSection1">${c.outerHTML}</div></body></html>`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'application/msword' })); a.download = `${fileBase}.doc`;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const doExcel = () => {
    const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const lines = [
      ['MAWB', mawbNo, 'Date', dmy(m.date), 'Airline', m.airline, 'Flight', (m.flights || []).map(f => `${f.flight} ${dmy(f.date)}`).join(' / '), 'From', m.origin, 'To', m.destination],
      [],
      ['S.No', 'HAWB No', 'Origin', 'Destination', 'Shipper', 'Shipper address', 'Consignee', 'Consignee address', 'Pieces', 'Gross wt (kg)', 'Chargeable wt (kg)', 'Volume (CBM)', 'Nature of goods', 'PP/CC'],
      ...rows.map((r, i) => [i + 1, r.hawb, r.origin, r.destination, r.shipper.name, [r.shipper.address, r.shipper.place].filter(Boolean).join(', '), r.consignee.name, [r.consignee.address, r.consignee.place].filter(Boolean).join(', '), r.pieces, r.gross, r.chargeable, r.volume || '', r.goods, r.chargeCode]),
      ['', 'Total', '', '', '', '', '', '', t.pieces, t.gross, t.chargeable, t.volume || '', `${t.houses} house(s)`, ''],
      ...(m.mawb ? [['', 'MAWB', '', '', '', '', '', '', m.pieces, m.gross, m.chargeable, '', '', '']] : []),
    ];
    const csv = '﻿' + lines.map(l => l.map(q).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `${fileBase}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const btn = (bg) => ({ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', backgroundColor: bg, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' });
  const info = (label, value) => (
    <tr><td style={{ padding: '2px 6px 2px 0', fontSize: '10.5px', color: '#334155', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{label}</td><td style={{ padding: '2px 0', fontSize: '11px', fontWeight: 'bold', verticalAlign: 'top' }}>{value || '-'}</td></tr>
  );
  const ok = d && rows.length > 0;

  // straight under <body>: inside the page the top bar covered the toolbar
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div role="dialog" aria-label="Cargo manifest" style={{ backgroundColor: '#e2e8f0', width: '96vw', maxWidth: '1240px', height: '94vh', borderRadius: '8px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #cbd5e1', display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: '8px 8px 0 0', flexWrap: 'wrap' }}>
          <div style={{ marginRight: 'auto' }}>
            <h2 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: 'bold' }}>Cargo manifest - MAWB {mawbNo}</h2>
            <span style={{ fontSize: '11px', color: loading ? '#64748b' : ok ? '#16a34a' : '#b45309', fontWeight: 'bold' }}>
              {loading ? 'Reading the MAWB and its houses...' : d ? `${t.houses} house(s), ${t.pieces} pcs, ${kg(t.gross)} kg` : err}
            </span>
          </div>
          <button type="button" onClick={load} title="Read again" style={btn('#64748b')}><RefreshCw size={14} /> Refresh</button>
          <button type="button" onClick={doPrint} disabled={!ok} style={{ ...btn('#0f766e'), opacity: ok ? 1 : 0.5 }}><Printer size={14} /> Print</button>
          <button type="button" onClick={doPdf} disabled={!ok} style={{ ...btn('#dc2626'), opacity: ok ? 1 : 0.5 }}><Download size={14} /> PDF</button>
          <button type="button" onClick={doWord} disabled={!ok} style={{ ...btn('#2563eb'), opacity: ok ? 1 : 0.5 }}><FileText size={14} /> Word</button>
          <button type="button" onClick={doExcel} disabled={!ok} style={{ ...btn('#15803d'), opacity: ok ? 1 : 0.5 }}><FileSpreadsheet size={14} /> Excel</button>
          <button type="button" onClick={onClose} aria-label="Close" style={{ display: 'flex', padding: '6px', backgroundColor: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}><X size={16} /></button>
        </div>

        {d && d.warnings && d.warnings.length > 0 && (
          <div style={{ margin: '10px 16px 0', padding: '8px 12px', background: '#fef3c7', color: '#92400e', borderRadius: '6px', fontSize: '12px' }}>
            {d.warnings.map((w, i) => <div key={i}>{w}</div>)}
          </div>
        )}

        <div style={{ padding: '14px', flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
          <div ref={sheetRef} data-doc-root={pctx ? pctx.docType : ''} style={{ width: '1100px', backgroundColor: 'white', padding: '18px 20px', fontFamily: 'Arial, sans-serif', color: '#000', boxSizing: 'border-box', alignSelf: 'flex-start' }}>
            {/* who we are */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '6px', marginBottom: '8px' }}>
              <div style={{ fontSize: '19px', fontWeight: 'bold', letterSpacing: '0.5px' }}>{co.name || ' '}</div>
              {co.address && <div style={{ fontSize: '10.5px' }}>{co.address}</div>}
              <div style={{ fontSize: '10px' }}>{[co.gstin && `GSTIN ${co.gstin}`, co.iata && `IATA ${co.iata}`, co.phone && `Ph ${co.phone}`, co.email].filter(Boolean).join('   |   ')}</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '6px' }}>AIR CARGO MANIFEST (CONSOLIDATION)</div>
            </div>

            {/* the master */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.1fr', gap: '8px', marginBottom: '10px' }}>
              <PartyBlock title="Shipper (MAWB)" p={m.shipper} />
              <PartyBlock title="Consignee (MAWB) / destination agent" p={m.consignee} />
              <div style={{ border: '1px solid #000', padding: '6px 8px' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}><tbody>
                  {info('MAWB No.', mawbNo)}
                  {info('MAWB date', dmy(m.date))}
                  {info('Airline', m.airline ? `${m.airline}${m.airlineCode ? ' (' + m.airlineCode + ')' : ''}` : '')}
                  {info('Flight / date', (m.flights || []).map(f => `${f.flight}  ${dmy(f.date)}`).join('   ·   '))}
                  {info('From / to', m.origin || m.destination ? `${m.origin || '-'}  to  ${m.destination || '-'}` : '')}
                  {(m.routing || []).length > 1 && info('Routing', m.routing.join('  >  '))}
                </tbody></table>
              </div>
            </div>

            {/* the houses */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...head, width: '3%' }}>S.No</th>
                  <th style={{ ...head, width: '9%' }}>HAWB No.</th>
                  <th style={{ ...head, width: '6%' }}>Org / Dest</th>
                  <th style={{ ...head, width: '21%' }}>Shipper</th>
                  <th style={{ ...head, width: '21%' }}>Consignee</th>
                  <th style={{ ...head, width: '5%', textAlign: 'right' }}>Pcs</th>
                  <th style={{ ...head, width: '8%', textAlign: 'right' }}>Gross wt (kg)</th>
                  <th style={{ ...head, width: '8%', textAlign: 'right' }}>Chg. wt (kg)</th>
                  <th style={{ ...head, width: '15%' }}>Nature of goods</th>
                  <th style={{ ...head, width: '4%' }}>PP/CC</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={10} style={{ ...cell, textAlign: 'center', padding: '20px', color: '#64748b' }}>Reading the houses...</td></tr>}
                {!loading && rows.length === 0 && <tr><td colSpan={10} style={{ ...cell, textAlign: 'center', padding: '20px', color: '#64748b' }}>{err || `No live HAWB is linked to ${mawbNo}. Link the houses on the MAWB (View / Link HAWBs) or on each HAWB.`}</td></tr>}
                {!loading && rows.map((r, i) => (
                  <tr key={r.id}>
                    <td style={{ ...cell, textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ ...cell, fontWeight: 'bold' }}>{r.hawb}</td>
                    <td style={{ ...cell, textAlign: 'center' }}>{r.origin}<br />{r.destination}</td>
                    <td style={cell}><b>{r.shipper.name}</b>{r.shipper.address && <div>{r.shipper.address}</div>}{r.shipper.place && <div>{r.shipper.place}</div>}</td>
                    <td style={cell}><b>{r.consignee.name}</b>{r.consignee.address && <div>{r.consignee.address}</div>}{r.consignee.place && <div>{r.consignee.place}</div>}</td>
                    <td style={num}>{r.pieces}</td>
                    <td style={num}>{kg(r.gross)}</td>
                    <td style={num}>{kg(r.chargeable)}</td>
                    <td style={{ ...cell, whiteSpace: 'pre-line' }}>{r.goods}</td>
                    <td style={{ ...cell, textAlign: 'center' }}>{r.chargeCode}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 'bold' }}>
                    <td colSpan={5} style={{ ...cell, fontWeight: 'bold', textAlign: 'right' }}>Total of {t.houses} house(s)</td>
                    <td style={{ ...num, fontWeight: 'bold' }}>{t.pieces}</td>
                    <td style={{ ...num, fontWeight: 'bold' }}>{kg(t.gross)}</td>
                    <td style={{ ...num, fontWeight: 'bold' }}>{kg(t.chargeable)}</td>
                    <td colSpan={2} style={cell}>{t.volume ? `Volume ${t.volume} CBM` : ''}</td>
                  </tr>
                  {m.mawb && (
                    <tr>
                      <td colSpan={5} style={{ ...cell, textAlign: 'right' }}>As per MAWB {m.mawb}</td>
                      <td style={{ ...num, color: m.pieces !== t.pieces ? '#b91c1c' : '#000' }}>{m.pieces}</td>
                      <td style={{ ...num, color: Math.abs((m.gross || 0) - (t.gross || 0)) > 0.5 ? '#b91c1c' : '#000' }}>{kg(m.gross)}</td>
                      <td style={num}>{m.chargeable ? kg(m.chargeable) : ''}</td>
                      <td colSpan={2} style={cell}>{m.goods ? String(m.goods).split('\n')[0] : ''}</td>
                    </tr>
                  )}
                </tfoot>
              )}
            </table>

            {/* remarks and sign-off */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '12px', marginTop: '12px', fontSize: '10.5px' }}>
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>Remarks</div>
                <textarea data-k="remarks" rows={3} placeholder="Optional" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', fontFamily: 'Arial, sans-serif', fontSize: '10.5px', padding: '4px', resize: 'vertical' }} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>For {co.name || ''}</div>
                <div style={{ height: '34px' }} />
                <div style={{ borderTop: '1px solid #000', display: 'inline-block', minWidth: '220px', paddingTop: '3px' }}>Authorised signatory</div>
                <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px' }}>
                  <span>Prepared by</span>
                  <input data-k="preparedBy" defaultValue={(d && d.preparedBy) || ''} key={(d && d.preparedBy) || 'p'} style={{ width: '140px', border: '1px solid #cbd5e1', fontSize: '10.5px', padding: '2px 4px' }} />
                  <span>on {dmy(new Date().toISOString().slice(0, 10))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CargoManifestModal;
