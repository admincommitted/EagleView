// Screen section: Edit
// Split out of ItemGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Copy, Download, Edit, FileText, RefreshCw, Search, Upload } from 'lucide-react';
import React from 'react';
import toast from 'react-hot-toast';
import { computeItemDuty } from '../helpers';
import askConfirm from '../../../../common/askConfirm'; // EagleView question window, 20-Nov-2026
import QuickQtyWindow from './QuickQtyWindow';

export default function EditSection({ ctx }) {
  const { copyItemRow, handleAiPdf, checkAll, checkedIds, fileInputRef, handleCopyFromOtherJob, handleCopyItem, handleDownloadSample, handleDownloadTemplate, handleFetchItem, handleReadFile, handleRecalculate, invoices, items, jobData, selectedRowId, setSelectedRowId, toggleCheck } = ctx;
  const listOf = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };
  const summary = React.useMemo(() => {
    const invs = invoices || [];
    const n = (v) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0;
    const itemVal = (it) => (n(it.qty || it.quantity) * n(it.price || it.unitPrice)) || n(it.value);
    const curs = [...new Set(invs.map(iv => String(iv.currency || iv.invoiceCurrency || '').toUpperCase()).filter(Boolean))];
    const terms = [...new Set(invs.map(iv => String(iv.terms || iv.termsOfInvoice || '').toUpperCase()).filter(Boolean))];
    const invTotal = invs.reduce((s, iv) => s + n(iv.value || iv.invValue || iv.invoiceValue), 0);
    const itemTotal = items.reduce((s, it) => s + itemVal(it), 0);
    // mismatch per invoice (so two invoices in different currencies are not mixed)
    let mismatch = 0;
    invs.forEach((iv, k) => {
      const its = items.filter(it => String(it.invSrNo || '1') === String(k + 1));
      mismatch += n(iv.value || iv.invValue || iv.invoiceValue) - its.reduce((s, it) => s + itemVal(it), 0);
    });
    const m = Math.round(mismatch * 100) / 100;
    // CIF (assessable value) and duty in INR, live from the items' rates; blank when an exchange rate is missing
    let cif = 0, duty = 0, missing = false;
    items.forEach(it => { const d = computeItemDuty(it, invs, jobData || {}); if (!d.rateFound) missing = true; cif += d.av; duty += d.total; });
    return { terms: terms.length > 1 ? 'Mixed' : (terms[0] || ''), currency: curs.length > 1 ? 'Mixed' : (curs[0] || ''),
      invTotal: invTotal.toFixed(2), itemTotal: itemTotal.toFixed(2), mismatch: m.toFixed(2), mismatchBad: Math.abs(m) >= 0.01,
      cif: missing ? 'Ex. rate?' : cif.toFixed(2), duty: missing ? 'Ex. rate?' : duty.toFixed(2) };
  }, [invoices, items, jobData]);
  // 30-Oct-2026: clicking another row re-mounted the item form (key={selectedRowId}), so anything typed and not
  // yet put in with Save / Modify was gone without a word. The row is only switched after asking.
  const isExBond = String((jobData && (jobData.autoField_51 || jobData.beType)) || '').toUpperCase() === 'X';
  const whNum = (v) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(x) ? x : null; };
  const formDirty = () => {
  // boxes the screen fills by itself (defaults / computed) - they are not the operator's typing
  const SKIP = new Set(['swsRate', 'swsFlag', 'foc', 'rateTypeFlag', 'ceth', 'accessoryStatus', 'itemNo', 'invSrNo', 'enterFilter', 'searchBy']);
    const UPPER = new Set(['brandName', 'model', 'endUse', 'genericDesc', 'manufacturer', 'countryOfOrigin', 'accessories', 'sourceCountry', 'transitCountry']);
    const f = document.getElementById('item-form'); if (!f || !selectedRowId) return false;
    const cur = (items || []).find(it => it.id === selectedRowId) || {};
    const same = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();
    for (const el of f.querySelectorAll('input[name], select[name], textarea[name]')) {
      if (el.type === 'checkbox' || el.type === 'radio' || el.disabled || el.readOnly) continue;
      const k = el.name; if (!k || SKIP.has(k)) continue;
      // a key the row does not carry yet counts as a change only when something was actually typed
      // 22-Nov-2026: MODIFY stores these boxes in capitals; a box typed in small letters then looked "changed" for ever
      // ("Changes not put in" came up right after MODIFY, e.g. model "Nova 2 Pro").
      if (UPPER.has(k) ? !same(String(el.value ?? '').toUpperCase(), String(cur[k] ?? '').toUpperCase()) : !same(el.value, cur[k] ?? '')) return true;
    }
    return false;
  };
  // Validate / File BE read the job, not this form, so they ask here whether anything is still untyped-in.
  // 30-Oct-2026: before this a row typed and left was checked and filed with its old values, with no word said.
  const { registerPendingEdits } = ctx;
  const [quickQty, setQuickQty] = React.useState(false); // 22-Nov-2026: Quick Quantity Entry window (ex-bond)
  React.useEffect(() => {
    if (typeof registerPendingEdits !== 'function') return undefined;
    return registerPendingEdits('items', () => {
      if (!formDirty()) return '';
      const cur = (items || []).find(it => it.id === selectedRowId) || {};
      const which = cur.itemSrNo ? 'Item ' + (cur.invSrNo || 1) + '/' + cur.itemSrNo : 'The open item';
      return which + ' has changes that were not put in with MODIFY - they are not part of the BE yet.';
    });
  }); // no dependency list: the check must close over the current items / selected row
  const pickRow = async (id) => {
    if (id === selectedRowId) return;
    // 20-Nov-2026: asked in an EagleView window with named buttons, not the browser's OK / Cancel box
    if (formDirty()) { const lbl = (r) => r && r.itemSrNo ? 'item ' + (r.invSrNo || 1) + '/' + r.itemSrNo : 'the other item'; const cur = (items || []).find(it => it.id === selectedRowId); const nxt = (items || []).find(it => it.id === id); const which = lbl(cur); if (!(await askConfirm({ title: 'Changes not put in', message: which.charAt(0).toUpperCase() + which.slice(1) + ' has changes that were not put in with MODIFY.', note: 'Drop the changes: ' + lbl(nxt) + ' opens, and what was typed here is lost.\nStay here: press MODIFY first, then open ' + lbl(nxt) + '.', okLabel: 'Drop the changes', cancelLabel: 'Stay here' }))) return; }
    setSelectedRowId(id);
  };

  return (
    <>
    {quickQty && <QuickQtyWindow items={items} onClose={() => setQuickQty(false)} onApply={(m) => { if (ctx.applyQuickQty) ctx.applyQuickQty(m); setQuickQty(false); }} />}
    {/* Top Grid Area */}
      <div className="glass-panel" style={{ flex: '0 0 160px', display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: '4px' }}>
        <div style={{ overflowX: 'auto', overflowY: 'auto', height: '100%' }}>
          <table className="data-grid" style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
            <thead style={{ background: 'var(--primary-bg-light, var(--primary-bg-light))', color: '#334155', position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ width: '30px', textAlign: 'center' }}>
                  <input type="checkbox" checked={items.length > 0 && checkedIds.length === items.length} onChange={checkAll} style={{ margin: 0, cursor: 'pointer' }} />
                </th>
                <th style={{ width: '30px', textAlign: 'center' }}>Edit</th>
                <th style={{ width: '30px', textAlign: 'center' }}>Copy</th>
                <th style={{ width: '60px', textAlign: 'center' }}>Inv Sr No</th>
                <th style={{ width: '80px' }}>Inv No</th>
                <th style={{ width: '60px', textAlign: 'center' }}>Item Sr No</th>
                <th>Item Desc</th>
                <th>RITC</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                {isExBond && <th style={{ textAlign: 'right' }} title="Quantity of this item still in the warehouse when the WH BE was linked (WH BE quantity less what earlier ex-bonds cleared)">WH Bal</th>}
                {isExBond && <th style={{ textAlign: 'right' }} title="WH balance less the quantity of this ex-bond">Left</th>}
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>Value</th>
                <th style={{ textAlign: 'center' }}>FOC</th>
                <th>Scheme</th>
                <th>Lic</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr 
                  key={it.id} 
                  onClick={() => pickRow(it.id)}
                  style={{ 
                    background: selectedRowId === it.id ? '#fefce8' : 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={checkedIds.includes(it.id)} onChange={() => toggleCheck(it.id)} style={{ margin: 0, cursor: 'pointer' }} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Edit size={14} color="var(--primary-text, var(--primary-color-start))" />
                  </td>
                  <td style={{ textAlign: 'center' }} title="Copy this item" onClick={(e) => { e.stopPropagation(); copyItemRow(it.id); }}>
                    <Copy size={14} color="var(--primary-text, var(--primary-color-start))" />
                  </td>
                  <td style={{ textAlign: 'center' }}>{it.invSrNo}</td>
                  <td>{it.invNo || (invoices[parseInt(it.invSrNo) - 1]?.invNo) || ''}</td>
                  <td style={{ textAlign: 'center' }}>{it.itemSrNo}</td>
                  <td>{it.desc}</td>
                  <td>{it.ritc}</td>
                  <td style={{ textAlign: 'right' }}>{it.qty}</td>
                  {isExBond && (() => { const bal = whNum(it._whBalanceQty), q = whNum(it.qty || it.quantity) || 0; const left = bal === null ? null : Math.round((bal - q) * 1e6) / 1e6;
                    return (<><td style={{ textAlign: 'right', color: '#475569' }}>{bal === null ? '' : bal}</td><td style={{ textAlign: 'right', fontWeight: 700, color: left === null ? undefined : left < 0 ? '#dc2626' : left === 0 ? '#16a34a' : '#b45309' }}>{left === null ? '' : left}</td></>); })()}
                  <td>{it.unit || it.uqc}</td>
                  <td style={{ textAlign: 'right' }}>{it.price || it.unitPrice}</td>
                  <td style={{ textAlign: 'right' }}>{((parseFloat(it.qty || it.quantity) * parseFloat(it.price || it.unitPrice)) || 0) ? (parseFloat(it.qty || it.quantity) * parseFloat(it.price || it.unitPrice)).toFixed(2) : (it.value || '')}</td>
                  <td style={{ textAlign: 'center' }}>{it.foc}</td>
                  <td>{listOf(it.schemeCatData).map(r => r.schemeCode).filter(Boolean).join(', ')}</td>
                  <td>{listOf(it.licenceData).map(r => r.licenceNo).filter(Boolean).join(', ')}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan="14" style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8' }}>No Items found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Middle Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '6px 8px', background: 'var(--bg-panel, #ffffff)', border: '1px solid var(--primary-border)', borderRadius: '4px', marginBottom: '4px', overflowX: 'auto' }}>
        <input type="text" className="input-field" title="Position of the open item in the list" style={{ width: '64px', minWidth: '64px', textAlign: 'center', padding: '0 4px' }} value={items.length > 0 ? (items.findIndex(it => it.id === selectedRowId) + 1 || 1) : 0} readOnly />{/* 22-Nov-2026: 40px cut a 3-digit number ("20:" for 207) */}
          <span>of</span>
          <input type="text" className="input-field" title="Items in this job" style={{ width: '64px', minWidth: '64px', textAlign: 'center', padding: '0 4px' }} value={items.length} readOnly />
        
        <button onClick={handleFetchItem} className="btn btn-secondary" style={{ background: 'var(--primary-color-end, var(--primary-color-end))', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
          <Search size={12} /> Fetch Item
        </button>
        <button onClick={() => ctx.askItemHistory && ctx.askItemHistory(true)} title="What earlier jobs of this importer used for this description / model" className="btn btn-secondary" style={{ background: 'var(--primary-color-end, var(--primary-color-end))', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
          <Search size={12} /> Last Used
        </button>
        <button onClick={handleCopyItem} className="btn btn-secondary" style={{ background: 'var(--primary-text, var(--primary-color-start))', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Copy size={12} /> Copy Item
        </button>
        
        <div style={{ flex: 1 }}></div>

        <input type="file" accept=".csv, .xls, .xlsx" ref={fileInputRef} style={{ display: 'none' }} onChange={handleReadFile} />
        
        <input type="file" accept=".pdf" id="importAiPdfInput" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files[0]; e.target.value = null; handleAiPdf(f); }} />
        <button onClick={() => document.getElementById('importAiPdfInput').click()} className="btn btn-secondary" style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Upload size={12} /> Upload PDF (AI)
        </button>

        <button onClick={() => fileInputRef.current && fileInputRef.current.click()} className="btn btn-secondary" style={{ background: 'var(--primary-color-end, var(--primary-color-end))', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <FileText size={12} /> Read File
        </button>
        <button onClick={handleDownloadTemplate} className="btn btn-secondary" style={{ background: '#0f766e', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
          <Download size={12} /> Template
        </button>
        <button onClick={handleDownloadSample} className="btn btn-secondary" style={{ background: 'var(--primary-text, var(--primary-color-start))', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Download size={12} /> Download Sample
        </button>
        
        <div style={{ flex: 1 }}></div>
        
        <button onClick={handleCopyFromOtherJob} className="btn btn-secondary" style={{ background: 'var(--primary-color-end, var(--primary-color-end))', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Copy size={12} /> Copy From Other Job
        </button>
      </div>

      {/* Summary Row: worked out from the job's invoices and items (Terms / Currency were fixed "FOB" / "USD", Mismatch
          was never calculated, CIF Total showed the foreign-currency item total). 28-Oct-2026 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isExBond ? '0.55rem' : '1rem', padding: '6px 8px', background: 'var(--primary-bg-light, var(--primary-bg-light))', border: '1px solid var(--primary-border)', borderRadius: '4px', marginBottom: '8px', overflowX: 'auto', fontWeight: 'bold', color: 'var(--primary-text, var(--primary-text))' }}>
        {[
          ['Terms', summary.terms, '60px'],
          ['Currency', summary.currency, '60px'],
          // 22-Nov-2026: an ex-bond (X) clears part of its warehouse BE, so its items are worth less than the WH invoice and
          // the invoice value is not sent in an X file - the red "Mismatch / ICEGATE error 260" was a false alarm there.
          ...(isExBond ? [
            ['WH BE Invoice', summary.invTotal, '100px', true],
            ['This Ex-Bond', summary.itemTotal, '100px', true],
            ['Rest of WH Invoice', summary.mismatch, '100px', true],
          ] : [
          ['Invoice Total', summary.invTotal, '90px', true],
          ['Item Total', summary.itemTotal, '90px', true],
          // 29-Oct-2026: a mismatch is shown in red (text + box), 0.00 in green
          ['Mismatch', summary.mismatch, '80px', true, summary.mismatchBad ? '#dc2626' : '#16a34a', summary.mismatchBad],
          ]),
          ['CIF Total (INR)', summary.cif, '100px', true],
          ['Total Duty (INR)', summary.duty, '100px', true],
        ].map(([label, val, w, right, color, bad]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
            <span style={color ? { color, fontWeight: bad ? 800 : undefined } : undefined}>{label}</span>
            <input type="text" className="input-field" style={{ width: w, height: '24px', textAlign: right ? 'right' : 'left', color: color || undefined, fontWeight: bad ? 800 : undefined, background: bad ? '#fee2e2' : undefined, border: bad ? '2px solid #dc2626' : undefined }} readOnly value={val} title={label === 'Rest of WH Invoice' ? 'Value of the warehouse BE invoice that is not in this ex-bond (still in the warehouse, or cleared by other ex-bonds). Not an error: an ex-bond file does not carry the invoice value.' : label === 'Mismatch' ? (bad ? 'Invoice and item totals differ - ICEGATE error 260. Fix the items or the invoice value.' : 'Invoice total minus item total, per invoice') : ''} />
            {bad && <span style={{ color: '#dc2626', fontSize: '11px' }}>⚠ ICEGATE error 260</span>}
          </div>
        ))}
        {isExBond && items.length > 0 && <button type="button" onClick={() => { if (selectedRowId && formDirty()) { toast.error('The open item has changes not put in with MODIFY - press MODIFY (or Clear) first'); return; } setQuickQty(true); }} className="btn btn-secondary" title="Type or paste the quantity of every item in one window" style={{ padding: '2px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', whiteSpace: 'nowrap' }}>Quick Qty Entry</button>}
        <button onClick={handleRecalculate} className="btn btn-primary" data-recalc style={{ padding: '2px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--primary-text, var(--primary-color-start))', border: 'none', color: '#fff', marginLeft: isExBond && items.length > 0 ? undefined : 'auto' }}>
            <RefreshCw size={12} /> Re-Calculate
          </button>
      </div>

      {/* Main Form Area */}
    </>
  );
}
