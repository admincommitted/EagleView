// Screen section: Invoice Terms
// Split out of InvoiceGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { CheckSquare, Plus, X } from 'lucide-react';
import React from 'react';

export default function InvoiceTermsSection({ ctx }) {
  const { masters, activeTerm, handleInvoiceFieldChange, invoiceFormData, isAddressModalOpen, isMiscIncludedModalOpen, isMiscNotIncludedModalOpen, isTermsModalOpen, jobData, setInvoiceFormData, setIsAddressModalOpen, setIsMiscIncludedModalOpen, setIsMiscNotIncludedModalOpen, setIsTermsModalOpen, setJobData } = ctx;
  // ---- misc charges (not included) rows ----
  // ICEGATE misc-charge directory: codes A..N in directory order (30-Oct-2026 - before only D / M / N were mapped and
  // the other 11 charges went out with a blank code, which ICES rejects). D, M, N are confirmed from filed BEs.
  const MISC_DESC = ['BROKERAGE AND COMMISSIONS', 'COST OF CONTAINERS', 'COST OF PACKING', 'HANDLING CHARGES', 'COST OF GOODS AND SERVICES', 'DOCUMENTATION',
    'COUNTRY OF ORIGIN CERTIFICATE', 'LOYALTIES AND LICENCE FEES', 'VALUE OF PROCEEDS WHICH ACCURE', 'COST OF WARRANTY SERVICES', 'OTHER COST OR PAYMENT',
    'OTHER CHARGES AND PAYMENT', 'LOADING CHARGES', 'UNLOADING CHARGES'];
  const MISC_CODE = Object.fromEntries(MISC_DESC.map((d, i) => [d, String.fromCharCode(65 + i)]));
  const [miscForm, setMiscForm] = React.useState({ desc: '', amount: '', rate: '' });
  const [miscEdit, setMiscEdit] = React.useState(null);
  const miscRows = (() => { let r = invoiceFormData.miscChargeRows; if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { r = []; } } return Array.isArray(r) ? r : []; })();
  const saveMiscRows = (rows) => setInvoiceFormData(prev => ({ ...prev, miscChargeRows: rows }));
  const addMiscRow = () => {
    if (!miscForm.desc) { window.alert('Select the charge'); return; }
    const a = String(miscForm.amount).trim(), r = String(miscForm.rate).trim();
    if ((a && r) || (!a && !r)) { window.alert('Give an amount OR a rate'); return; }
    const row = { desc: miscForm.desc, code: MISC_CODE[miscForm.desc] || '', amount: a, rate: r };
    saveMiscRows(miscEdit !== null ? miscRows.map((x, i) => i === miscEdit ? row : x) : [...miscRows, row]);
    setMiscForm({ desc: '', amount: '', rate: '' }); setMiscEdit(null);
  };
  // ---- supplier address search (Party master) ----
  const [addrFilter, setAddrFilter] = React.useState('');
  const [addrPick, setAddrPick] = React.useState(-1);
  const addresses = React.useMemo(() => {
    const p = (masters?.parties || []).find(x => String(x.name || '').trim().toUpperCase() === String(invoiceFormData.supplierName || '').trim().toUpperCase());
    if (!p) return [];
    const list = (p.branches && p.branches.length ? p.branches.map(b => ({ address1: b.address1, address2: b.address2, city: b.city, state: b.state, pin: b.pinCode, country: b.country }))
      : [{ address1: p.street, address2: '', city: p.city, state: p.stateProvince, pin: p.zipPostcode, country: p.countryCode }]);
    const q = addrFilter.trim().toLowerCase();
    return list.filter(a => !q || Object.values(a).some(v => String(v || '').toLowerCase().includes(q)));
  }, [masters, invoiceFormData.supplierName, addrFilter]);
  const pickAddress = (a) => {
    setInvoiceFormData(prev => ({ ...prev, supplierAddress1: a.address1 || '', supplierAddress2: [a.address2, a.city].filter(Boolean).join(', '), supplierAddress3: [a.state, a.pin].filter(Boolean).join(' '), supplierCountry: a.country || prev.supplierCountry }));
    setIsAddressModalOpen(false); setAddrPick(-1);
  };
  return (
    <>
    {/* Incoterm Modal */}
      {isTermsModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '650px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color, #cbd5e1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#334155', fontWeight: 'normal' }}>
                Invoice Terms <strong style={{ color: 'var(--text-main, var(--text-main, #0f172a))' }}>({activeTerm})</strong>
              </h3>
              <X size={18} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setIsTermsModalOpen(false)} />
            </div>
            
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {(activeTerm === 'FOB' || activeTerm === 'CI') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ width: '120px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Freight Value</label>
                  <input type="text" name="freightValue" className="input-field mandatory-field" value={invoiceFormData.freightValue || ''} onChange={handleInvoiceFieldChange} style={{ width: '120px', color: 'var(--primary-color-end, var(--primary-color-end))', border: '1px solid #ef4444' }} />
                  
                  <label style={{ width: '60px', color: 'var(--text-main, var(--text-main, #1e293b))', textAlign: 'center' }}>Currency</label>
                  <input list="currency-list" name="freightCurrency" type="text" className="input-field mandatory-field" value={invoiceFormData.freightCurrency ?? (invoiceFormData.currency || '')} onChange={(e) => handleInvoiceFieldChange({ target: { name: 'freightCurrency', value: e.target.value.toUpperCase() } })} style={{ width: '60px', color: 'var(--primary-color-end)', background: '#f0fdf4', border: '1px solid #ef4444', textAlign: 'center' }} />
                  
                  <label style={{ width: '40px', color: 'var(--text-main, var(--text-main, #1e293b))', textAlign: 'center' }}>Rate</label>
                  <input type="text" name="freightRate" className="input-field mandatory-field" value={invoiceFormData.freightRate || ''} onChange={handleInvoiceFieldChange} style={{ width: '50px', color: 'var(--primary-color-end, var(--primary-color-end))', border: '1px solid #ef4444', textAlign: 'center' }} />
                  <label style={{ color: 'var(--text-main, #1e293b)', whiteSpace: 'nowrap' }} title="Is the freight the actual amount paid (Y/N)">Actual?</label>
                  <input type="text" name="whetherFreightActual" maxLength={1} className="input-field mandatory-field" value={invoiceFormData.whetherFreightActual || ''} onChange={(e) => handleInvoiceFieldChange({ target: { name: 'whetherFreightActual', value: e.target.value.toUpperCase() } })} style={{ width: '40px', color: 'var(--primary-color-end, var(--primary-color-end))', border: '1px solid #ef4444', textAlign: 'center' }} />
                </div>
              )}

              {(activeTerm === 'FOB' || activeTerm === 'CF') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ width: '120px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Insurance Value</label>
                  <input type="text" name="insuranceValue" className="input-field mandatory-field" value={invoiceFormData.insuranceValue || ''} onChange={handleInvoiceFieldChange} style={{ width: '120px', color: 'var(--primary-color-end, var(--primary-color-end))', border: '1px solid #ef4444' }} />
                  
                  <label style={{ width: '60px', color: 'var(--text-main, var(--text-main, #1e293b))', textAlign: 'center' }}>Currency</label>
                  <input list="currency-list" name="insuranceCurrency" type="text" className="input-field mandatory-field" value={invoiceFormData.insuranceCurrency ?? (invoiceFormData.currency || '')} onChange={(e) => handleInvoiceFieldChange({ target: { name: 'insuranceCurrency', value: e.target.value.toUpperCase() } })} style={{ width: '60px', color: 'var(--primary-color-end)', background: '#f0fdf4', border: '1px solid #ef4444', textAlign: 'center' }} />
                  
                  <label style={{ width: '40px', color: 'var(--text-main, var(--text-main, #1e293b))', textAlign: 'center' }}>Rate</label>
                  <input type="text" name="insuranceRate" className="input-field mandatory-field" value={invoiceFormData.insuranceRate || ''} onChange={handleInvoiceFieldChange} style={{ width: '50px', color: 'var(--primary-color-end, var(--primary-color-end))', border: '1px solid #ef4444', textAlign: 'center' }} />

                </div>
              )}

            </div>
            
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color, #cbd5e1)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'var(--bg-panel, #ffffff)' }}>
              <button onClick={() => {
                // ICEGATE: freight / insurance as amount OR rate, not both
                const both = (a, b) => String(invoiceFormData[a] ?? '').trim() && String(invoiceFormData[b] ?? '').trim();
                if (both('freightValue', 'freightRate') || both('insuranceValue', 'insuranceRate')) { window.alert('Give freight / insurance as an amount OR a rate %, not both'); return; }
                setIsTermsModalOpen(false); setInvoiceFormData(prev => ({...prev, terms: activeTerm, termsOfInvoice: activeTerm})); }} className="btn btn-success" style={{ background: '#4ade80', color: '#fff', border: 'none', padding: '6px 20px', fontSize: '13px', borderRadius: '4px' }}>
                OK
              </button>
              <button onClick={() => setIsTermsModalOpen(false)} className="btn btn-secondary" style={{ background: '#fff', color: '#334155', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 20px', fontSize: '13px', borderRadius: '4px' }}>
                CANCEL
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Misc Charges Modal (Included) */}
      {isMiscIncludedModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '600px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color, #cbd5e1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#334155', fontWeight: 'normal' }}>
                Miscellaneous Charges Specified in Invoice
              </h3>
              <X size={18} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setIsMiscIncludedModalOpen(false)} />
            </div>
            
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 0.8fr 1.5fr', gap: '8px', alignItems: 'center', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #1e293b))' }}>
                <div>Charge Name</div>
                <div>Charges</div>
                <div>Curr</div>
                <div>Rate %</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 0.8fr 1.5fr', gap: '8px', alignItems: 'center' }}>
                <div>Local Agency Comm.</div>
                  <input type="text" name="agencyCommAmount" value={invoiceFormData.agencyCommAmount || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ border: '1px solid #cbd5e1' }} />
                  <input type="text" name="agencyCommCurrency" value={invoiceFormData.agencyCommCurrency || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ border: '1px solid #cbd5e1' }} />
                  <input type="text" name="agencyCommRate" value={invoiceFormData.agencyCommRate || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ border: '1px solid #cbd5e1' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 0.8fr 1.5fr', gap: '8px', alignItems: 'center' }}>
                <div>Loading</div>
                  <input type="text" name="loadingAmount" value={invoiceFormData.loadingAmount || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ border: '1px solid #cbd5e1' }} />
                  <input type="text" name="loadingCurrency" value={invoiceFormData.loadingCurrency || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ border: '1px solid #cbd5e1' }} />
                  <input type="text" name="loadingRate" value={invoiceFormData.loadingRate || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ border: '1px solid #cbd5e1' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 0.8fr 1.5fr', gap: '8px', alignItems: 'center' }}>
                <div>Miscellaneous</div>
                <input type="text" name="miscCharges" value={invoiceFormData.miscCharges || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ color: 'var(--primary-color-end)', border: '1px solid #cbd5e1' }} />
                <input type="text" name="miscCurrency" value={invoiceFormData.miscCurrency || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ color: 'var(--primary-color-end)', border: '1px solid #cbd5e1' }} />
                <input type="text" name="miscChargesRate" value={invoiceFormData.miscChargesRate || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ border: '1px solid #cbd5e1' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 0.8fr 1.5fr', gap: '8px', alignItems: 'center' }}>
                <div>HSS</div>
                <input type="text" name="hssLoadAmount" value={invoiceFormData.hssLoadAmount || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ border: '1px solid #cbd5e1' }} />
                <input type="text" name="hssCurrency" value={invoiceFormData.hssCurrency || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ border: '1px solid #cbd5e1' }} />
                <input type="text" name="hssLoadRate" value={invoiceFormData.hssLoadRate || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ border: '1px solid #cbd5e1' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 0.8fr 1.5fr', gap: '8px', alignItems: 'center' }}>
                <div>Discount</div>
                  <input type="text" name="discountAmount" value={invoiceFormData.discountAmount || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ border: '1px solid #cbd5e1' }} />
                  <input type="text" name="discountCurrency" value={invoiceFormData.discountCurrency || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ border: '1px solid #cbd5e1' }} />
                  <input type="text" name="discountRate" value={invoiceFormData.discountRate || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ border: '1px solid #cbd5e1' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 3.8fr', gap: '8px', alignItems: 'center' }}>
                <div>Nature of Discount</div>
                  <input type="text" name="natureOfDiscount" value={invoiceFormData.natureOfDiscount || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ border: '1px solid #cbd5e1' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr', gap: '8px', alignItems: 'center' }}>
                <div>Landing %</div>
                {/* 30-Oct-2026: a real box - filed as landingRate (landing charges % ; blank = ICES default) */}
                <input type="text" name="landingRate" inputMode="decimal" placeholder="blank = default" title="Landing charges % (ICEGATE landingRate); leave blank unless a different rate is declared" value={invoiceFormData.landingRate || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ color: 'var(--primary-color-end, var(--primary-color-end))', border: '1px solid #cbd5e1' }} />
              </div>

              {/* 30-Oct-2026: "Cumulative Misc. Charge" moved to the toolbar (Cumulative ... Apply), where it is split over the invoices */}

            </div>
            
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color, #cbd5e1)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'var(--bg-panel, #ffffff)' }}>
              <button onClick={() => setIsMiscIncludedModalOpen(false)} className="btn btn-success" style={{ background: '#4ade80', color: '#fff', border: 'none', padding: '6px 20px', fontSize: '13px', borderRadius: '4px' }}>
                OK
              </button>
              <button onClick={() => setIsMiscIncludedModalOpen(false)} className="btn btn-secondary" style={{ background: '#fff', color: '#334155', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 20px', fontSize: '13px', borderRadius: '4px' }}>
                CANCEL
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Misc Charges Modal (Not Included) */}
      {isMiscNotIncludedModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '700px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color, #cbd5e1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#334155', fontWeight: 'normal' }}>
                Discount/Miscellaneous Details
              </h3>
              <X size={18} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setIsMiscNotIncludedModalOpen(false)} />
            </div>
            
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* rows kept on the invoice (miscChargeRows) and sent as misc_chModel. The boxes were not saved before. 28-Oct-2026 */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ color: 'var(--text-main, var(--text-main, #1e293b))' }}>Misc Desc</label>
                  <select className="input-field mandatory-field" value={miscForm.desc} onChange={(e) => setMiscForm({ ...miscForm, desc: e.target.value })} style={{ border: '1px solid #ef4444', color: 'var(--primary-color-end, var(--primary-color-end))' }}>
                    <option value="">Select Charge</option>
                    {MISC_DESC.map(d => <option key={d} value={d}>{(MISC_CODE[d] ? MISC_CODE[d] + ' - ' : '') + d}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ color: 'var(--text-main, var(--text-main, #1e293b))' }}>Amount</label>
                  <input type="text" className="input-field" value={miscForm.amount} onChange={(e) => setMiscForm({ ...miscForm, amount: e.target.value })} style={{ border: '1px solid #cbd5e1' }} />
                </div>
                <div style={{ paddingBottom: '6px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #1e293b))' }}>OR</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ color: 'var(--text-main, var(--text-main, #1e293b))' }}>Rate</label>
                  <input type="text" className="input-field" value={miscForm.rate} onChange={(e) => setMiscForm({ ...miscForm, rate: e.target.value })} style={{ border: '1px solid #cbd5e1' }} />
                </div>
                <button type="button" onClick={addMiscRow} className="btn btn-primary" style={{ background: 'var(--primary-color-start)', color: '#fff', border: 'none', padding: '6px 12px', fontSize: '13px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Plus size={14} /> {miscEdit !== null ? 'Update' : 'Add'}
                </button>
              </div>

              <div style={{ background: 'var(--bg-panel, #ffffff)', padding: '8px', borderRadius: '4px', color: '#ef4444', fontSize: '11px', display: 'flex', gap: '16px' }}>
                <span style={{ fontWeight: 'bold' }}>For Invoice Terms CI:</span>
                <span>(1) D - Handling Charges</span>
                <span>(2) M - Loading Charges</span>
                <span>(3) N - Unloading Charges</span>
              </div>

              <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', minHeight: '120px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead style={{ background: 'var(--primary-bg-light, var(--primary-bg-light))', color: '#334155' }}>
                    <tr>
                      <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid var(--border-color, #cbd5e1)', borderRight: '1px solid var(--border-color, #cbd5e1)', width: '40px' }}>Edit</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid var(--border-color, #cbd5e1)', borderRight: '1px solid var(--border-color, #cbd5e1)', width: '60px' }}>Remove</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid var(--border-color, #cbd5e1)', borderRight: '1px solid var(--border-color, #cbd5e1)' }}>Miscellaneous Desc.</th>
                      <th style={{ padding: '6px', textAlign: 'right', borderBottom: '1px solid var(--border-color, #cbd5e1)', borderRight: '1px solid var(--border-color, #cbd5e1)', width: '100px' }}>Amount</th>
                      <th style={{ padding: '6px', textAlign: 'right', borderBottom: '1px solid var(--border-color, #cbd5e1)', borderRight: '1px solid var(--border-color, #cbd5e1)', width: '80px' }}>Rate</th>
                      <th style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {miscRows.map((r, i) => (
                      <tr key={i} style={{ background: miscEdit === i ? '#fefce8' : undefined }}>
                        <td style={{ padding: '6px', cursor: 'pointer', color: 'var(--primary-color-start)' }} onClick={() => { setMiscForm({ desc: r.desc || '', amount: r.amount || '', rate: r.rate || '' }); setMiscEdit(i); }}>Edit</td>
                        <td style={{ padding: '6px', cursor: 'pointer', color: '#dc2626' }} onClick={() => saveMiscRows(miscRows.filter((_, j) => j !== i))}>Remove</td>
                        <td style={{ padding: '6px' }}>{(r.code ? r.code + ' - ' : '') + r.desc}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{r.amount}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{r.rate}</td>
                        <td></td>
                      </tr>
                    ))}
                    {!miscRows.length && <tr><td colSpan="6" style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>No charges</td></tr>}
                  </tbody>
                </table>
              </div>
              
            </div>
            
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color, #cbd5e1)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'var(--bg-panel, #ffffff)' }}>
              <button onClick={() => setIsMiscNotIncludedModalOpen(false)} className="btn btn-success" style={{ background: '#4ade80', color: '#fff', border: 'none', padding: '6px 20px', fontSize: '13px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckSquare size={14} /> Ok
              </button>
              <button onClick={() => setIsMiscNotIncludedModalOpen(false)} className="btn btn-secondary" style={{ background: '#fff', color: '#334155', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 20px', fontSize: '13px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <X size={14} /> Cancel
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Address Search Modal */}
      {isAddressModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '600px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            <div style={{ padding: '12px 16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#334155', fontWeight: 'normal' }}>Search</h3>
            </div>
            
            <div style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <label style={{ color: '#334155' }}>Find</label>
                <input type="text" className="input-field" placeholder="ENTER FILTER" value={addrFilter} onChange={(e) => setAddrFilter(e.target.value)} style={{ flex: 1, border: '1px solid #cbd5e1' }} />
              </div>
              
              <div style={{ border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '2px', overflow: 'hidden', height: '250px', overflowY: 'auto', marginTop: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', whiteSpace: 'nowrap' }}>
                  <thead style={{ background: 'var(--bg-panel, #ffffff)', color: '#334155' }}>
                    <tr>
                      <th style={{ padding: '4px 8px', borderRight: '1px solid var(--border-color, #cbd5e1)', borderBottom: '1px solid var(--border-color, #cbd5e1)', width: '30px' }}></th>
                      <th style={{ padding: '4px 8px', textAlign: 'left', borderRight: '1px solid var(--border-color, #cbd5e1)', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>Address1</th>
                      <th style={{ padding: '4px 8px', textAlign: 'left', borderRight: '1px solid var(--border-color, #cbd5e1)', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>Address2</th>
                      <th style={{ padding: '4px 8px', textAlign: 'left', borderRight: '1px solid var(--border-color, #cbd5e1)', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>City</th>
                      <th style={{ padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* addresses of the supplier party from the Party master (the list was always empty) 28-Oct-2026 */}
                    {addresses.map((a, i) => (
                      <tr key={i} style={{ cursor: 'pointer', background: addrPick === i ? '#fefce8' : undefined }} onClick={() => setAddrPick(i)} onDoubleClick={() => { setAddrPick(i); pickAddress(a); }}>
                        <td style={{ padding: '4px 8px' }}><input type="radio" readOnly checked={addrPick === i} /></td>
                        <td style={{ padding: '4px 8px' }}>{a.address1}</td><td style={{ padding: '4px 8px' }}>{a.address2}</td>
                        <td style={{ padding: '4px 8px' }}>{a.city}</td><td style={{ padding: '4px 8px' }}>{a.state}</td>
                      </tr>
                    ))}
                    {!addresses.length && <tr><td colSpan="5" style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>{invoiceFormData.supplierName ? 'No address for this supplier in the Party master' : 'Choose the Supplier Name first'}</td></tr>}
                    </tbody>
                </table>
              </div>
            </div>
            
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color, #cbd5e1)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#fff' }}>
              <button onClick={() => { if (addresses[addrPick]) pickAddress(addresses[addrPick]); else setIsAddressModalOpen(false); }} className="btn btn-success" style={{ background: '#4ade80', color: '#fff', border: 'none', padding: '6px 20px', fontSize: '13px', borderRadius: '4px' }}>
                OK
              </button>
              <button onClick={() => setIsAddressModalOpen(false)} className="btn btn-secondary" style={{ background: '#fff', color: '#334155', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 20px', fontSize: '13px', borderRadius: '4px' }}>
                CANCEL
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* SVB Loading Modal */}
    </>
  );
}
