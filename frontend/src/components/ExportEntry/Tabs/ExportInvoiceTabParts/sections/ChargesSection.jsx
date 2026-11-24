// Screen section: Charges
// Split out of ExportInvoiceTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';
import RichAutocomplete from '../../../../common/RichAutocomplete';
import toast from 'react-hot-toast';
import askConfirm, { askText } from '../../../../common/askConfirm'; // EagleView windows, 20-Nov-2026
import { unitsOf } from '../../../../../utils/cbicExchange';
import { Cell, Seg } from './invCompact';

export default function ChargesSection({ ctx }) {
  const { checkInvoice, buildInvoice, resetForm, selectInvoice, items, rateOf, askDelete, repriceItems } = ctx;
  // Other Details: Cancel puts back the values from before the window was opened (it kept the changes)
  const [otherSnap, setOtherSnap] = React.useState(null);
  // errors stop the save; warnings ask first
  const passes = () => {
    const { errors, warnings } = checkInvoice();
    if (errors.length) { toast.error(errors.join('\n'), { duration: 6000 }); return false; }
    if (warnings.length && !window.confirm(warnings.join('\n') + '\n\nSave anyway?')) return false;
    return true;
  };
  const { countries, formData, handleChange, invoices, natureOfContract, parties, selectedId, setFormData, setInvoices, setSelectedId, setShowOtherDetailsModal, setThirdPartyDetails, showOtherDetailsModal, thirdPartyDetails } = ctx;
  // Modify: the open invoice takes the form's values. 17-Nov-2026: also used by Save while an invoice is open - Save
  // added a copy of the open invoice as a new invoice (the duplicate invoice no check skips the open invoice itself).
  const modifyInvoice = () => {
    if (!selectedId) { toast.error('Click an invoice in the list first'); return false; }
    if (!passes()) return false;
    const next = invoices.map(inv => inv.id === selectedId ? buildInvoice(inv) : inv);
    setInvoices(next);
    repriceItems(next); // item FOB (INR) follows a new rate / value / charges
    resetForm();
    toast.success('Invoice modified - save the job to keep it');
    return true;
  };
  return (
    <>
    {/* CHARGES + THIRD PARTY - compact (29-Oct-2026) */}
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: '6px', alignItems: 'start' }}>
        <div className="ivd-box">
          <div className="ivd-band">Charges <small style={{ color: '#64748b' }}>rate (%) or amount; freight / insurance show for CF / CI / CIF</small></div>
          <div className="ivd-body">
            <table className="ivd-tbl">
              <thead><tr><th style={{ width: '38%' }}>Charge</th><th>Rate %</th><th style={{ width: '16%' }}>Currency</th><th>Amount</th></tr></thead>
              <tbody>
                {[
                  ...(['CIF', 'CF'].includes(natureOfContract) ? [['Freight', 'freight']] : []),
                  ...(['CIF', 'CI'].includes(natureOfContract) ? [['Insurance', 'insurance']] : []),
                  ['Packing & Misc', 'packing'], ['Discount on FOB', 'discount'], ['Other Deductions', 'other'],
                ].map(([label, k]) => (
                  <tr key={k}>
                    <td>{label}</td>
                    <td><input name={k + 'Rate'} value={formData[k + 'Rate'] || ''} onChange={handleChange} type="text" inputMode="decimal" className="input-field" style={{ textAlign: 'right' }} /></td>
                    <td><input name={k + 'Curr'} value={formData[k + 'Curr'] || ''} onChange={handleChange} type="text" className="input-field" placeholder={formData.currency || ''} /></td>
                    <td><input name={k + 'Amount'} value={formData[k + 'Amount'] || ''} onChange={handleChange} type="text" inputMode="decimal" className="input-field" style={{ textAlign: 'right' }} /></td>
                  </tr>
                ))}
                <tr>
                  <td>
                    Commission
                    <Seg style={{ marginLeft: 8, verticalAlign: 'middle', height: 22 }} btnStyle={{ padding: '0 7px' }} title="Commission on FOB or CIF value" value={formData.commType} options={['FOB', 'CIF']} onChange={t => handleChange({ target: { name: 'commType', value: t } })} />
                  </td>
                  <td><input name="commissionRate" value={formData.commissionRate || ''} onChange={handleChange} type="text" inputMode="decimal" className="input-field" style={{ textAlign: 'right' }} /></td>
                  <td><input name="commissionCurr" value={formData.commissionCurr || ''} onChange={handleChange} type="text" className="input-field" placeholder={formData.currency || ''} /></td>
                  <td><input name="commissionAmount" value={formData.commissionAmount || ''} onChange={handleChange} type="text" inputMode="decimal" className="input-field" style={{ textAlign: 'right' }} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="ivd-box">
          <div className="ivd-band">Third Party
            <Seg style={{ height: 22, marginLeft: 'auto' }} btnStyle={{ padding: '0 10px' }} title="Y = payment from a third party (its country must be FATF compliant)" value={thirdPartyDetails === 'Y' ? 'Y' : 'N'} options={[['N', 'No'], ['Y', 'Yes']]} onChange={setThirdPartyDetails} />
          </div>
          <div className="ivd-body">
            {thirdPartyDetails !== 'Y' && <div style={{ fontSize: '11px', color: '#94a3b8', padding: '2px 0' }}>No third party - payment comes from the buyer.</div>}
            {thirdPartyDetails === 'Y' && (
              <div className="ivd-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
                <Cell label="Name" w="62px" span={2}>
                  <div style={{ flex: 1 }}>
                    <RichAutocomplete
                      options={parties}
                      value={formData.tpName}
                      onChange={v => setFormData({...formData, tpName: v})}
                      onSelect={p => setFormData({
                        ...formData,
                        tpName: p.name,
                        tpAddress1: ((p.branches && p.branches[0]) ? p.branches[0].address1 : p.street) || '',
                        tpAddress2: ((p.branches && p.branches[0]) ? p.branches[0].address2 : '') || '',
                        tpCity: ((p.branches && p.branches[0]) ? p.branches[0].city : p.city) || '',
                        tpPin: ((p.branches && p.branches[0]) ? p.branches[0].pinCode : p.zipPostcode) || '',
                        tpCntry: (countries && countries.find(c => c.code === p.countryCode)) ? countries.find(c => c.code === p.countryCode).name : (p.countryCode || ''),
                          tpCntr2: p.countryCode || ''
                      })}
                      searchFilter={(p, q) => p.name?.toLowerCase()?.includes(q?.toLowerCase())}
                      renderOption={p => (
                        <>
                          <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{p.name}</div>
                          <div style={{ fontSize: '10px', color: '#64748b' }}>{p.street}, {p.city}</div>
                        </>
                      )}
                      placeholder="THIRD PARTY NAME"
                      inputStyle={{ height: '26px', boxSizing: 'border-box', width: '100%', border: '1px solid #86efac' }}
                    />
                  </div>
                </Cell>
                <Cell label="Address 1" w="62px"><input name="tpAddress1" value={formData.tpAddress1 || ''} onChange={handleChange} type="text" className="input-field" /></Cell>
                <Cell label="Address 2" w="62px"><input name="tpAddress2" value={formData.tpAddress2 || ''} onChange={handleChange} type="text" className="input-field" /></Cell>
                <Cell label="City" w="62px"><input name="tpCity" value={formData.tpCity || ''} onChange={handleChange} type="text" className="input-field" /></Cell>
                <Cell label="Pin" w="62px"><input name="tpPin" value={formData.tpPin || ''} onChange={handleChange} type="text" className="input-field" /></Cell>
                <Cell label="Country" w="62px">
                  <div style={{ flex: 1 }}>
                    <RichAutocomplete
                      options={countries}
                      value={formData.tpCntry}
                      onChange={v => setFormData({...formData, tpCntry: v})}
                      onSelect={c => setFormData({...formData, tpCntry: c.name, tpCntr2: c.code})}
                      searchFilter={(c, q) => c.name?.toLowerCase()?.includes(q?.toLowerCase()) || c.code?.toLowerCase()?.includes(q?.toLowerCase())}
                      renderOption={c => (
                        <>
                          <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{c.name}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)' }}>Code: {c.code}</div>
                        </>
                      )}
                      placeholder="COUNTRY"
                      inputStyle={{ height: '26px', boxSizing: 'border-box', width: '100%', border: '1px solid #86efac' }}
                    />
                  </div>
                  <input name="tpCntr2" value={formData.tpCntr2 || ''} onChange={handleChange} type="text" className="input-field" placeholder="CC" title="Country code sent to ICEGATE" style={{ flex: '0 0 40px', width: '40px', textAlign: 'center' }} />
                </Cell>
                <Cell label="Subdivision" w="62px" title="Country subdivision (state / province)">
                  <input name="tpCntryDiv" value={formData.tpCntryDiv || ''} onChange={handleChange} type="text" className="input-field" />
                  <input name="tpCntr1" value={formData.tpCntr1 || ''} onChange={handleChange} type="text" className="input-field" placeholder="CC" style={{ flex: '0 0 40px', width: '40px', textAlign: 'center' }} />
                </Cell>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="ivd-btns">
        <button className="btn btn-success" style={{ padding: '0.25rem 0.75rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
          title={selectedId ? 'An invoice is open - Save updates it (as Modify). For a new invoice press Clear first.' : 'Add this invoice'}
          onClick={() => {
            if (selectedId) { if (modifyInvoice()) toast('Save on an open invoice works as Modify - for a new invoice press Clear first', { icon: '\u2139\ufe0f', duration: 5000 }); return; }
            if (!passes()) return;
            const newId = invoices.length ? Math.max(...invoices.map(i => Number(i.id) || 0)) + 1 : 1;
            const inv = buildInvoice({ id: newId });
            delete inv.exportJobId;
            setInvoices([...invoices, inv]);
            resetForm();
            toast.success(`Invoice ${inv.no} added (serial ${invoices.length + 1}) - click Modify / Ctrl+S on the SB Header to save the job`);
          }}>
          <span style={{ fontSize: '14px' }}>&#128190;</span> Save
        </button>
        <button className="btn btn-warning" style={{ padding: '0.25rem 0.75rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
          onClick={() => { modifyInvoice(); }}>
          <span style={{ fontSize: '14px' }}>&#9998;</span> Modify
        </button>
        <button className="btn btn-danger" style={{ padding: '0.25rem 0.75rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
          onClick={() => {
            if (!selectedId) return toast.error('Click an invoice in the list first');
            const idx = invoices.findIndex(i => i.id === selectedId);
            if (!askDelete([selectedId], `invoice ${formData.no || idx + 1}`)) return;
            resetForm();
            toast.success('Invoice deleted');
          }}>
          <span style={{ fontSize: '14px' }}>&#10006;</span> Delete
        </button>
        <button className="btn btn-danger" style={{ padding: '0.25rem 0.75rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
          onClick={() => { if (!invoices.length) return toast.error('No invoice to delete'); if (askDelete(invoices.map(i => i.id), `all ${invoices.length} invoice(s)`)) { resetForm(); toast.success('All invoices deleted'); } }}>
          <span style={{ fontSize: '14px' }}>&#10006;</span> Delete All Invoices
        </button>
        <button className="btn btn-info" style={{ padding: '0.25rem 0.75rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => { setOtherSnap({ ...formData }); setShowOtherDetailsModal(true); }}>
          <span style={{ fontSize: '14px' }}>&#128196;</span> Other Details
        </button>
        <button className="btn btn-info" style={{ padding: '0.25rem 0.75rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
          onClick={() => resetForm()}>
          <span style={{ fontSize: '14px' }}>&#10227;</span> Clear
        </button>
        <button className="btn btn-success" style={{ padding: '0.25rem 0.75rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
          onClick={() => {
            if (!selectedId) return toast.error('Click an invoice in the list first');
            const invToDuplicate = invoices.find(i => i.id === selectedId);
            const newId = invoices.length ? Math.max(...invoices.map(i => Number(i.id) || 0)) + 1 : 1;
            // the copy gets its own invoice no (the same no twice is rejected) and is opened for editing
            const base = String(invToDuplicate.no || invToDuplicate.invoiceNo || 'INV').slice(0, 13);
            let no = base + '-C'; let k = 2; while (invoices.some(i => String(i.no || i.invoiceNo) === no)) no = base + '-C' + (k++);
            const copy = { ...invToDuplicate, id: newId, no, invoiceNo: no };
            delete copy.exportJobId; delete copy.items;
            setInvoices([...invoices, copy]);
            selectInvoice(copy);
            toast.success(`Invoice copied as ${no} - change the invoice no and click Modify`);
          }}>
          <span style={{ fontSize: '14px' }}>&#128196;</span> Duplicate Invoice
        </button>
        <button className="btn btn-info" style={{ padding: '0.25rem 0.75rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
          onClick={() => {
            if (!invoices.length) return toast.error('No invoices');
            // serial = position in the list; ids are renumbered 1..n (a deleted invoice left gaps)
            setInvoices(invoices.map((inv, idx) => ({ ...inv, id: idx + 1 })));
            resetForm();
            toast.success('Invoice serial numbers arranged 1 - ' + invoices.length);
          }}>
          <span style={{ fontSize: '14px' }}>&#8597;</span> Arrange Invoice Serial No
        </button>
        <button className="btn btn-warning" style={{ padding: '0.25rem 0.75rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
          onClick={async () => {
            // was only a message; now applies the rate to every invoice (and the open form)
            // 30-Oct-2026: the units are named in the question. CBIC Schedule II quotes JPY and KRW per 100,
            // and a per-100 figure taken as per-1 made every rupee figure on the Shipping Bill 100 times too big.
            const curAsk = String(formData.currency || (invoices[0] && invoices[0].currency) || '').toUpperCase();
            const uAsk = unitsOf(curAsk);
            // 20-Nov-2026: an EagleView window (the browser's prompt box is not shown in every browser)
            const rate = await askText({ title: 'Exchange rate for all invoices', message: `Rupees per ${uAsk > 1 ? uAsk + ' ' : ''}${curAsk || 'unit'}${uAsk > 1 ? ' - CBIC Schedule II' : ''}`,
              label: 'Exchange rate', value: formData.exchRate || '', okLabel: 'Apply', check: (t) => (parseFloat(t) > 0 ? '' : 'Type a rate above 0') });
            if (rate === null) return;
            const r = parseFloat(rate);
            if (isNaN(r) || r <= 0) { toast.error('Invalid exchange rate'); return; }
            // the rate is for the invoice currency; FOB (INR) is worked out again (it kept the old rate's value)
            const cur = String(formData.currency || (invoices[0] && invoices[0].currency) || '').toUpperCase();
            const same = invoices.filter(inv => !cur || String(inv.currency || '').toUpperCase() === cur);
            if (cur && same.length < invoices.length && !(await askConfirm({ title: 'Apply the rate', message: `Apply ${r.toFixed(4)} only to the ${same.length} ${cur} invoice(s)? Other currencies are not changed.`, okLabel: 'Apply', cancelLabel: 'Do not apply' }))) return;
            const next = invoices.map(inv => {
              if (cur && String(inv.currency || '').toUpperCase() !== cur) return inv;
              const old = parseFloat(inv.exchRate || inv.exchangeRate) || 0;
              const fob = parseFloat(inv.invFobInr);
              return { ...inv, exchRate: r.toFixed(4), exchangeRate: r.toFixed(4), unitInRs: unitsOf(inv.currency || cur), invFobInr: old > 0 && !isNaN(fob) ? (fob / old * r).toFixed(2) : inv.invFobInr };
            });
            setInvoices(next);
            repriceItems(next); // item FOB (INR) of those invoices too
            setFormData({ ...formData, exchRate: r.toFixed(4), unitInRs: uAsk });
            if (selectedId && ctx.keepInInvBase) ctx.keepInInvBase({ exchRate: r.toFixed(4), unitInRs: uAsk }); // the open invoice got the rate too
            toast.success('Exchange rate ' + r.toFixed(4) + ' applied to ' + same.length + ' invoice(s)'); return;
          }}>
          <span style={{ fontSize: '14px' }}>&#10227;</span> Update Exchange Rate
        </button>
      </div>

      {/* OTHER DETAILS MODAL */}
      {showOtherDetailsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: '4px', padding: '1rem', width: '600px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 0.25rem 0', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', color: '#334155', fontWeight: 'normal' }}>Other Invoice Details {formData.no ? `- ${formData.no}` : ''}</h3>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '0.75rem' }}>Shown on the checklist; the charges are on the main screen. Click {selectedId ? 'Modify' : 'Save'} after OK to keep them on the invoice.</div>
            {/* charges were here a second time (same boxes as the Charges table); now only the details that have no other place */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '11px' }}>
              {[
                ['Exporter Contract No', 'contractNo', 'text'], ['Contract Date', 'contractDate', 'date'],
                ['L/C No', 'lcNo', 'text'], ['L/C Date', 'lcDate', 'date'],
                ["Buyer's Order No", 'poNo', 'text'], ['Order Date', 'poDate', 'date'],
                ['Proforma Invoice No', 'proformaNo', 'text'], ['Proforma Date', 'proformaDate', 'date'],
              ].map(([label, field, type]) => (
                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <label style={{ width: '140px', fontWeight: 500 }}>{label}</label>
                  <input type={type} className="input-field" maxLength={30} value={formData[field] || ''} onChange={e => setFormData(prev => ({...prev, [field]: type === 'text' ? e.target.value.toUpperCase() : e.target.value}))} style={{ flex: 1, border: '1px solid #cbd5e1' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button className="btn btn-success" style={{ padding: '0.25rem 1rem' }} onClick={() => { setShowOtherDetailsModal(false); setOtherSnap(null); }}>OK</button>
              <button className="btn btn-secondary" style={{ padding: '0.25rem 1rem' }} onClick={() => { if (otherSnap) setFormData(otherSnap); setOtherSnap(null); setShowOtherDetailsModal(false); }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* BUYER DETAILS MODAL */}
    </>
  );
}
