// Screen section: Edit
// Split out of InvoiceGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Copy, Download, Edit, FileText, RefreshCw } from 'lucide-react';
import React from 'react';
import askConfirm from '../../../../common/askConfirm'; // EagleView question window, 20-Nov-2026

export default function EditSection({ ctx }) {
  const { checkAll, checkedIds, fileInputRefInv, handleApplyCumulative, handleCopyFromOtherJob, handleDownloadSample, handleReadExcel, handleRecalculateDutyAllInv, handleUpdateExchangeRate, invoices, jobData, selectedRowId, setJobData, setSelectedRowId, toggleCheck } = ctx;
  const cumBox = (k, ph) => <input type="text" inputMode="decimal" placeholder={ph} title={'Cumulative ' + ph + ' for the whole job - "Apply" splits it over the invoices by invoice value'} value={jobData?.[k] || ''} onChange={(e) => { const v = e.target.value; setJobData(prev => ({ ...prev, [k]: v })); }} className="input-field" style={{ width: '80px', fontSize: '11px', padding: '2px 4px' }} />;
  const amtOrRate = (amt, rate, cur) => String(amt ?? '').trim() ? `${amt}${cur ? ' ' + cur : ''}` : (String(rate ?? '').trim() ? `${rate}%` : '');
  // 30-Oct-2026: the invoice form is replaced when another row is clicked, so anything typed and not put in with
  // SAVE / MODIFY used to disappear silently. The row is only switched after asking.
  // boxes the screen fills by itself (defaults / filters) - not the operator's typing
  const SKIP = new Set(['enterFilter', 'searchBy', 'searchByCert', 'searchByWh', 'cumulativeFreight', 'cumulativeInsurance', 'cumulativeMiscCharge']);
  const invoiceDirty = () => {
    const f = document.getElementById('invoice-form'); if (!f || !selectedRowId) return false;
    const cur = (invoices || []).find(iv => iv.id === selectedRowId) || {};
    const same = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();
    for (const el of f.querySelectorAll('input[name], select[name], textarea[name]')) {
      if (el.type === 'checkbox' || el.type === 'radio' || el.disabled || el.readOnly) continue;
      const k = el.name; if (!k || SKIP.has(k)) continue;
      // a key the row does not carry yet counts as a change only when something was actually typed
      if (!same(el.value, cur[k] ?? '')) return true;
    }
    return false;
  };
  // Validate / File BE read the job, not this form, so they ask here whether anything is still untyped-in.
  const { registerPendingEdits } = ctx;
  React.useEffect(() => {
    if (typeof registerPendingEdits !== 'function') return undefined;
    return registerPendingEdits('invoices', () => {
      if (!invoiceDirty()) return '';
      const cur = (invoices || []).find(iv => iv.id === selectedRowId) || {};
      const which = cur.invNo ? 'Invoice ' + cur.invNo : 'The open invoice';
      return which + ' has changes that were not put in with MODIFY - they are not part of the BE yet.';
    });
  }); // no dependency list: the check must close over the current invoices / selected row
  const pickInvoice = async (id) => {
    if (id === selectedRowId) return;
    // 20-Nov-2026: asked in an EagleView window with named buttons, not the browser's OK / Cancel box
    if (invoiceDirty()) { const lbl = (r) => r && r.invNo ? 'invoice ' + r.invNo : 'the other invoice'; const cur = (invoices || []).find(iv => iv.id === selectedRowId); const nxt = (invoices || []).find(iv => iv.id === id); const which = cur && cur.invNo ? 'Invoice ' + cur.invNo : 'This invoice'; if (!(await askConfirm({ title: 'Changes not put in', message: which + ' has changes that were not put in with MODIFY.', note: 'Drop the changes: ' + lbl(nxt) + ' opens, and what was typed here is lost.\nStay here: press MODIFY first, then open ' + lbl(nxt) + '.', okLabel: 'Drop the changes', cancelLabel: 'Stay here' }))) return; }
    setSelectedRowId(id);
  };

  return (
    <>
    {/* Top Grid Area (approx 40% of screen height) */}
      <div className="glass-panel" style={{ flex: '0 0 180px', display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: '4px' }}>
        <div style={{ overflowX: 'auto', overflowY: 'auto', height: '100%' }}>
          <table className="data-grid" style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
            <thead style={{ background: 'var(--primary-bg-light, var(--primary-bg-light))', color: '#334155', position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ width: '30px', textAlign: 'center' }}>
                  <input type="checkbox" checked={invoices.length > 0 && checkedIds.length === invoices.length} onChange={checkAll} style={{ margin: 0, cursor: 'pointer' }} />
                </th>
                <th style={{ width: '30px', textAlign: 'center' }}>Edit</th>
                <th style={{ width: '50px' }}>Inv SrNo</th>
                <th>Invoice No</th>
                <th>Invoice Date</th>
                <th style={{ textAlign: 'right' }}>Value</th>
                <th>Currency</th>
                <th>Terms</th>
                <th style={{ textAlign: 'right' }}>Freight</th>
                <th style={{ textAlign: 'right' }}>Insurance</th>
                <th style={{ textAlign: 'right' }}>Miscellaneous</th>
                <th style={{ textAlign: 'right' }}>HSS</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, idx) => (
                <tr 
                  key={inv.id} 
                  onClick={() => pickInvoice(inv.id)}
                  style={{ 
                    background: selectedRowId === inv.id ? '#fefce8' : 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={checkedIds.includes(inv.id)} onChange={() => toggleCheck(inv.id)} style={{ margin: 0, cursor: 'pointer' }} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Edit size={14} color="var(--primary-text, var(--primary-color-start))" />
                  </td>
                  <td>{idx + 1}</td>
                  <td>{inv.invNo}</td>
                  <td>{inv.invDate || inv.invoiceDate}</td>
                  <td style={{ textAlign: 'right' }}>{inv.value || inv.invValue}</td>
                  <td>{inv.currency || inv.invoiceCurrency}</td>
                  <td>{inv.terms || inv.termsOfInvoice}</td>
                  {/* amount, or rate % when only a rate was given (the grid read fields that do not exist) 28-Oct-2026 */}
                  <td style={{ textAlign: 'right' }}>{amtOrRate(inv.freightValue, inv.freightRate, inv.freightCurrency)}</td>
                  <td style={{ textAlign: 'right' }}>{amtOrRate(inv.insuranceValue, inv.insuranceRate, inv.insuranceCurrency)}</td>
                  <td style={{ textAlign: 'right' }}>{amtOrRate(inv.miscCharges, inv.miscChargesRate, inv.miscCurrency)}</td>
                  <td style={{ textAlign: 'right' }}>{amtOrRate(inv.hssLoadAmount, inv.hssLoadRate, inv.hssCurrency)}</td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan="12" style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8' }}>No Invoices found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Middle Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '6px 8px', background: 'var(--bg-panel, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px', marginBottom: '8px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderRight: '1px solid var(--border-color, #cbd5e1)', paddingRight: '8px' }}>
          {/* 30-Oct-2026: job-level amounts that "Apply" splits over the invoices (the old checkbox did nothing) */}
          <label style={{ fontWeight: '600', color: 'var(--text-main, var(--text-main, #1e293b))', whiteSpace: 'nowrap' }}>Cumulative</label>
          {cumBox('cumulativeFreight', 'Freight')}{cumBox('cumulativeInsurance', 'Insurance')}{cumBox('cumulativeMiscCharge', 'Misc')}
          <button type="button" onClick={handleApplyCumulative} className="btn btn-secondary" title="Split the cumulative amounts over the invoices by invoice value" style={{ padding: '3px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>Apply</button>
        </div>
        
        <input type="file" accept=".xls, .xlsx, .csv" ref={fileInputRefInv} style={{ display: 'none' }} onChange={handleReadExcel} />
        <button onClick={() => fileInputRefInv.current && fileInputRefInv.current.click()} className="btn btn-secondary" style={{ background: 'var(--primary-color-end, var(--primary-color-end))', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <FileText size={12} /> Read Excel
        </button>
        <button onClick={handleDownloadSample} className="btn btn-secondary" style={{ background: 'var(--primary-text, var(--primary-color-start))', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Download size={12} /> Download Sample
          </button>
        <button onClick={handleRecalculateDutyAllInv} className="btn btn-secondary" style={{ background: 'var(--primary-color-end, var(--primary-color-end))', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
            <RefreshCw size={12} /> Re-Calculate Duty All Inv
          </button>
        <button onClick={handleUpdateExchangeRate} className="btn btn-secondary" style={{ background: 'var(--primary-text, var(--primary-color-start))', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <RefreshCw size={12} /> Update Exchange Rate
          </button>
        <button onClick={handleCopyFromOtherJob} className="btn btn-secondary" style={{ background: 'var(--primary-color-end, var(--primary-color-end))', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
            <Copy size={12} /> Copy From Other Job
          </button>
      </div>

      {/* Bottom Form Area */}
    </>
  );
}
