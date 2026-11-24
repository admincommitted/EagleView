// Screen section: ACTIONS
// Split out of ExportInvoiceTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Edit, Trash2 } from 'lucide-react';
import ModernDatePicker from '../../../../common/ModernDatePicker';
import React from 'react';
import RichAutocomplete from '../../../../common/RichAutocomplete';
import toast from 'react-hot-toast';
import { Cell, Seg } from './invCompact';
import { toNotation, unitsOf, rateText, perUnit, PER_100_CURRENCIES } from '../../../../../utils/cbicExchange';

const fmtD = (v) => { if (!v) return ''; const s = String(v).trim(); const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(s); if (!m) return s; const d = new Date(+m[1], +m[2] - 1, +m[3]); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'); };

export default function ActionsSection({ ctx }) {
  const { selectInvoice, resetForm, exportData, items, buyerDetails, setShowBuyerModal, askDelete } = ctx;
  const { addFreightInsurance, consigneeSame, currencies, formData, handleChange, handleConsigneeSameChange, handleNatureOfContractChange, igstBasedOn, invoices, natureOfContract, selectedId, setAddFreightInsurance, setFormData, setIgstBasedOn, setInvoices, setNatureOfContract, setSelectedId } = ctx;
  return (
    <>
    {/* INVOICE GRID (data-nodirty: a click here is not a change of the invoice form) */}
      <div className="glass-panel" data-nodirty="1" style={{ padding: '6px', marginBottom: '0' }}>
        <div style={{ height: '120px', overflowY: 'auto', border: '1px solid var(--primary-border)', background: '#fff', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.03)' }}>
        <table className="compact-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
            <tr>
              <th style={{ width: '60px', textAlign: 'center', padding: '1px 4px' }}>ACTIONS</th>
              <th style={{ padding: '1px 4px' }}>INV SR NO.</th>
              <th style={{ padding: '1px 4px' }}>INVOICE NO.</th>
              <th style={{ padding: '1px 4px' }}>INVOICE DATE</th>
              <th style={{ padding: '1px 4px' }}>CURR</th>
              <th style={{ padding: '1px 4px' }}>INVOICE VALUE</th>
              <th style={{ padding: '1px 4px', textAlign: 'right' }}>FOB (INR)</th>
              <th style={{ padding: '1px 4px' }}>NATURE OF CONTRACT</th>
              <th style={{ padding: '1px 4px' }}>BUYER NAME</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, idx) => (
              <tr key={idx} title="Click to open this invoice" style={{ borderBottom: '1px solid #e2e8f0', background: selectedId === inv.id ? '#fefce8' : 'transparent', cursor: 'pointer' }} onClick={() => (ctx.openInvoice || selectInvoice)(inv)}>
                <td style={{ textAlign: 'center', padding: '1px 4px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <Edit size={14} style={{ color: '#0f172a', cursor: 'pointer' }} />
                  {/* asks first and does not open the invoice it deletes (the click also selected the row) */}
                  <Trash2 size={14} style={{ color: '#ef4444', cursor: 'pointer' }} onClick={(e) => {
                    e.stopPropagation();
                    if (!askDelete([inv.id], `invoice ${inv.no || inv.invoiceNo || idx + 1}`)) return;
                    if (selectedId === inv.id) resetForm(); toast.success('Invoice deleted');
                  }} />
                </td>
                {/* serial = position (the database id was shown after reopening a job, e.g. 57) */}
                <td style={{ padding: '1px 4px' }}>{idx + 1}</td>
                <td style={{ padding: '1px 4px' }}>{inv.no || inv.invoiceNo}</td>
                <td style={{ padding: '1px 4px' }}>{fmtD(inv.date || inv.invoiceDate)}</td>
                <td style={{ padding: '1px 4px' }}>{inv.currency}</td>
                <td style={{ padding: '1px 4px' }}>{inv.value || inv.invoiceValue}</td>
                <td style={{ padding: '1px 4px', textAlign: 'right' }}>{inv.invFobInr ? Number(inv.invFobInr).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                <td style={{ padding: '1px 4px' }}>{inv.contractType || inv.natureOfContract}</td>
                <td style={{ padding: '1px 4px' }}>{inv.buyer || inv.buyerName}</td>
              </tr>
            ))}
            {!invoices.length && <tr><td colSpan={10} style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>No invoice yet - fill Invoice Details below and click Save</td></tr>}
          </tbody>
        </table>
        </div>
      </div>

      {/* INVOICE DETAILS + AEO - compact grid, label beside the box (29-Oct-2026) */}
      <div className="ivd-box">
        <div className="ivd-band">Invoice Details
          <small style={{ color: selectedId ? '#b45309' : '#16a34a' }}>{selectedId ? `editing invoice ${(invoices.findIndex(i => i.id === selectedId) + 1) || ''} (${formData.no || ''}) - Save / Modify keep the changes (Clear for a new one)` : 'new invoice - Save adds it'}</small></div>
        <div className="ivd-body">
          <div className="ivd-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            <Cell label="Invoice No *">
              <input type="text" className="input-field" maxLength={17} value={formData.no || ''} onChange={e => setFormData({...formData, no: e.target.value.toUpperCase()})} style={{ borderColor: formData.no ? undefined : '#f87171' }} />
            </Cell>
            <Cell label="Invoice Date *">
              <div style={{ flex: 1 }}><ModernDatePicker className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} style={{ width: '100%' }} /></div>
            </Cell>
            <Cell label="Inv. Value *">
              <input type="text" inputMode="decimal" className="input-field" value={formData.value || ''} onChange={e => setFormData({...formData, value: e.target.value.replace(/[^0-9.]/g, '')})} style={{ textAlign: 'right', fontWeight: 700, borderColor: formData.value ? undefined : '#f87171' }} />
            </Cell>
            <Cell label="Curr / Rate *">
              <div style={{ flex: '0 0 70px' }}>
                {/* 30-Oct-2026: the master holds the rate for ONE unit; it is put into CBIC notation here
                    (x100 for JPY / KRW) and the units travel with the invoice as unitInRs. */}
                <RichAutocomplete
                  options={currencies}
                  value={formData.currency}
                  onChange={v => { const c = String(v || '').toUpperCase(); setFormData({...formData, currency: c, unitInRs: unitsOf(c)}); }}
                  onSelect={c => { const q = toNotation(c.currencyCode, c.exportRate); setFormData({...formData, currency: c.currencyCode, exchRate: q.rate, unitInRs: q.unitInRs, nonStandardCurr: 'N'}); }}
                  searchFilter={(c, q) => c.currencyCode?.toLowerCase()?.includes(q?.toLowerCase()) || c.currencyName?.toLowerCase()?.includes(q?.toLowerCase())}
                  renderOption={c => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{c.currencyCode}</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{c.currencyName}</div>
                    </>
                  )}
                  placeholder="Curr"
                  inputStyle={{ height: '26px', boxSizing: 'border-box', width: '100%', borderColor: formData.currency ? undefined : '#f87171' }}
                />
              </div>
              <input type="text" className={'input-field' + (formData.nonStandardCurr === 'Y' ? '' : ' ivd-ro')} value={formData.exchRate || ''} onChange={e => setFormData({...formData, exchRate: e.target.value})} style={{ textAlign: 'right' }} placeholder="Rate" readOnly={formData.nonStandardCurr !== 'Y'} tabIndex={formData.nonStandardCurr === 'Y' ? 0 : -1} title={(formData.nonStandardCurr === 'Y' ? 'Manual entry enabled. ' : 'Rate of the currency master (CBIC). Set Non-std = Y to type it. ') + (formData.exchRate && formData.currency ? 'Read as ' + rateText(formData.currency, formData.exchRate, formData.unitInRs) + ' = Rs ' + perUnit(formData.currency, formData.exchRate, formData.unitInRs).toFixed(4) + ' for one ' + String(formData.currency).toUpperCase() : '')} />
              {PER_100_CURRENCIES.includes(String(formData.currency || '').trim().toUpperCase()) && (
                <span style={{ flex: '0 0 auto', fontSize: '10px', fontWeight: 700, color: '#b45309', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '3px', padding: '2px 5px', whiteSpace: 'nowrap' }}
                  title={`CBIC notifies ${String(formData.currency).toUpperCase()} in Schedule II - rupees per 100 units. Type the notification figure as it is.`}>per 100</span>
              )}
              <select name="nonStandardCurr" value={formData.nonStandardCurr === 'Y' ? 'Y' : 'N'} onChange={handleChange} className="input-field" style={{ flex: '0 0 74px', width: '74px' }} title="Non-standard currency: Y = type the exchange rate yourself (currency not in the CBIC notification)">
                <option value="N">Std</option><option value="Y">Non-std</option>
              </select>
            </Cell>

            <Cell label="Pymt. Nature">
              {/* ICEGATE codes DP / AP / LC / DA / NA */}
              <select name="pymtNature" value={String(formData.pymtNature || '').slice(0, 2).toUpperCase()} onChange={handleChange} className="input-field">
                <option value="">Select</option>
                <option value="DP">DP - Delivery against Payment</option>
                <option value="DA">DA - Delivery against Acceptance</option>
                <option value="AP">AP - Advance Payment</option>
                <option value="LC">LC - Letter of Credit</option>
                <option value="NA">NA - Not Applicable</option>
              </select>
            </Cell>
            <Cell label="Pymt. Period">
              <input name="pymtPeriod" value={formData.pymtPeriod || ''} onChange={e => setFormData(prev => ({ ...prev, pymtPeriod: e.target.value.replace(/\D/g, '').slice(0, 3) }))} type="text" inputMode="numeric" placeholder="days (e.g. 180)" className="input-field" style={{ textAlign: 'right' }} />
            </Cell>
            <Cell label="Contract No.">
              <input name="contractNo" value={formData.contractNo || ''} onChange={handleChange} type="text" className="input-field" />
            </Cell>
            <Cell label="Cons = Buyer" title="Is Consignee and Buyer same [Y/N]? Y = consignee of the SB Header goes as buyer">
              <select className="input-field" value={consigneeSame} onChange={handleConsigneeSameChange} style={{ flex: '0 0 130px', width: '130px' }} title="Is Consignee and Buyer same [Y/N]">
                {/* labels start with Y / N so the familiar Y / N keys work (29-Oct-2026) */}
                <option value="Y">Y - Same</option>
                <option value="N">N - Different</option>
              </select>
              <span style={{ flex: 1, minWidth: 0, fontSize: '11px', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }} title="Buyer sent in the SB">
                {consigneeSame === 'Y' ? (exportData.consigneeName || '(consignee of SB Header)') : (buyerDetails.name || formData.buyer || '-')}
              </span>
              {consigneeSame === 'N' && <button type="button" className="btn btn-secondary" onClick={() => setShowBuyerModal(true)} style={{ height: '26px', padding: '0 8px', fontSize: '11px', flexShrink: 0 }}>Edit</button>}
            </Cell>

            <Cell label="Contract">
              <Seg value={natureOfContract} options={['FOB', 'CI', 'CIF', 'CF']} onChange={handleNatureOfContractChange} title="Nature of contract (CF / CI / CIF / FOB)" />
            </Cell>
            <Cell label="Add F/I/N/B" title="Unit price includes: Freight / Insurance / None / Both (ICEGATE: CIF = B, CI = I, CF = F, FOB = N)">
              <select className="input-field" value={addFreightInsurance} onChange={(e) => setAddFreightInsurance(e.target.value)} style={{ flex: '0 0 120px', width: '120px' }}>
                <option value="F">F - Freight</option><option value="I">I - Insurance</option><option value="N">N - None</option><option value="B">B - Both</option>
              </select>
              {addFreightInsurance !== ({ CIF: 'B', CI: 'I', CF: 'F', FOB: 'N' })[natureOfContract] && <span style={{ fontSize: '10px', color: '#b45309', whiteSpace: 'nowrap' }} title="ICEGATE advisory: CIF-B, CI-I, CF-F, FOB-N">⚠ usually {({ CIF: 'B', CI: 'I', CF: 'F', FOB: 'N' })[natureOfContract]}</span>}
            </Cell>
            <Cell label="Inv FOB ₹">
              <input name="invFobInr" tabIndex={-1} value={formData.invFobInr || ''} type="text" className="input-field ivd-ro" style={{ textAlign: 'right', fontWeight: 700 }} readOnly title="Invoice FOB in INR, worked out from value, rate and charges" />
            </Cell>
            <Cell label="IGST Based On">
              <Seg value={igstBasedOn} options={['CIF', 'FOB', 'MANUAL']} onChange={setIgstBasedOn} title="Value the IGST is worked out on" />
            </Cell>

            <Cell label="AEO Code"><input name="aeoCode" value={formData.aeoCode || ''} onChange={handleChange} type="text" className="input-field" /></Cell>
            <Cell label="AEO Country">
              <input name="aeoCountry" value={formData.aeoCountry || ''} onChange={handleChange} type="text" className="input-field" placeholder="country name" />
              {/* 2-letter code sent to ICEGATE */}
              <input name="aeoCountryCode" value={formData.aeoCountryCode || formData.aeoRoleCntr || ''} onChange={e => setFormData(prev => ({ ...prev, aeoCountryCode: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2), aeoRoleCntr: '' }))} type="text" className="input-field" placeholder="CC" title="Country code (2 letters)" style={{ flex: '0 0 44px', width: '44px', textAlign: 'center' }} />
            </Cell>
            <Cell label="AEO Role"><input name="aeoRole" value={formData.aeoRole || ''} onChange={handleChange} type="text" className="input-field" /></Cell>
            <Cell label="Term Place"><input name="termPlace" value={formData.termPlace || ''} onChange={handleChange} type="text" className="input-field" /></Cell>
          </div>
        </div>
      </div>
    </>
  );
}
