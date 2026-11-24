// Screen section: SVB Loading Invoice
// Split out of InvoiceGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import ModernDatePicker from '../../../../common/ModernDatePicker';
import React from 'react';

export default function SvbLoadingInvoiceSection({ ctx }) {
  const { handleTempChange, isBrokerModalOpen, isConditionsModalOpen, isOtherInfoModalOpen, isSellerModalOpen, isSvbModalOpen, masters, selectedInvoice, setIsBrokerModalOpen, setIsConditionsModalOpen, setIsOtherInfoModalOpen, setIsSellerModalOpen, setIsSvbModalOpen, tempData, invoiceFormData, setInvoiceFormData } = ctx;
  return (
    <>
    {isSvbModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '650px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#334155', fontWeight: 'normal' }}>SVB Loading Invoice</h3>
            </div>
            
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', gap: '12px', alignItems: 'center' }}>
                <label style={{ color: 'var(--text-main, var(--text-main, #1e293b))' }}>Ref No.</label>
                <input type="text" className="input-field mandatory-field" value={invoiceFormData.svbReferenceNumber || ''} onChange={(e) => setInvoiceFormData(prev => ({ ...prev, svbReferenceNumber: e.target.value }))} style={{ border: '1px solid #ef4444' }} />
                
                <label style={{ color: 'var(--text-main, var(--text-main, #1e293b))' }}>Custom House</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input type="text" className="input-field mandatory-field" maxLength={6} placeholder="e.g. INDEL4" value={invoiceFormData.customHouseCodeWhichHasImposedLoad || ''} onChange={(e) => setInvoiceFormData(prev => ({ ...prev, customHouseCodeWhichHasImposedLoad: e.target.value.toUpperCase() }))} style={{ flex: 2, background: '#f0fdf4', border: '1px solid #ef4444' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px', alignItems: 'center', width: '50%' }}>
                <label style={{ color: 'var(--text-main, var(--text-main, #1e293b))' }}>Date</label>
                <ModernDatePicker className="input-field mandatory-field" value={invoiceFormData.svbReferenceDate || ''} onChange={(e) => setInvoiceFormData(prev => ({ ...prev, svbReferenceDate: e?.target?.value !== undefined ? e.target.value : e }))} style={{ border: '1px solid #ef4444' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'auto 60px', gap: '12px', alignItems: 'center' }}>
                <label style={{ color: 'var(--text-main, var(--text-main, #1e293b))' }}>SVB load on ass. value/duty/both[A/D/B]</label>
                <input type="text" data-allow-text className="input-field mandatory-field" maxLength={1} placeholder="A/D/B" value={invoiceFormData.svbFlag || ''} onChange={(e) => { const v = e.target.value.toUpperCase().replace(/[^ADB]/g, ''); setInvoiceFormData(prev => ({ ...prev, svbFlag: v })); }} style={{ border: '1px solid #ef4444', textAlign: 'center' }} />
              </div>

              <div style={{ fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #1e293b))', marginTop: '8px' }}>SVB load On -</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', alignItems: 'center' }}>
                <label style={{ color: 'var(--text-main, var(--text-main, #1e293b))' }}>Ass. Value(%)</label>
                <input type="text" className="input-field" value={invoiceFormData.svbLoadAssessableValue || ''} onChange={(e) => setInvoiceFormData(prev => ({ ...prev, svbLoadAssessableValue: e.target.value }))} style={{ color: 'var(--primary-color-end, var(--primary-color-end))', border: '1px solid #cbd5e1' }} />
                
                <label style={{ color: 'var(--text-main, var(--text-main, #1e293b))' }}>SVB Load Status</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="text" className="input-field" maxLength={1} value={invoiceFormData.whetherloadProvisionalOnAssValue || ''} onChange={(e) => setInvoiceFormData(prev => ({ ...prev, whetherloadProvisionalOnAssValue: e.target.value.toUpperCase() }))} style={{ width: '40px', border: '1px solid #cbd5e1' }} />
                  <span style={{ color: 'var(--text-main, var(--text-main, #1e293b))' }}>[F/P]</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', alignItems: 'center' }}>
                <label style={{ color: 'var(--text-main, var(--text-main, #1e293b))' }}>Duty(%)</label>
                <input type="text" className="input-field" value={invoiceFormData.svbLoadOnDuty || ''} onChange={(e) => setInvoiceFormData(prev => ({ ...prev, svbLoadOnDuty: e.target.value }))} style={{ color: 'var(--primary-color-end, var(--primary-color-end))', border: '1px solid #cbd5e1' }} />
                
                <label style={{ color: 'var(--text-main, var(--text-main, #1e293b))' }}>SVB Load Status</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="text" className="input-field" maxLength={1} value={invoiceFormData.whetherProvisionalOnDuty || ''} onChange={(e) => setInvoiceFormData(prev => ({ ...prev, whetherProvisionalOnDuty: e.target.value.toUpperCase() }))} style={{ width: '40px', border: '1px solid #cbd5e1' }} />
                  <span style={{ color: 'var(--text-main, var(--text-main, #1e293b))' }}>[F/P]</span>
                </div>
              </div>

            </div>
            
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color, #cbd5e1)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#fff' }}>
              {/* SVB fields are bound to the invoice now (they were plain boxes that saved nothing). 28-Oct-2026 */}
              <button onClick={() => { if (invoiceFormData.svbFlag && !/^[ADB]$/.test(invoiceFormData.svbFlag)) { window.alert('SVB load on must be A, D or B'); return; } setInvoiceFormData(prev => ({ ...prev, svbLoadingFlag: prev.svbReferenceNumber ? 'Y' : prev.svbLoadingFlag })); setIsSvbModalOpen(false); }} className="btn btn-success" style={{ background: '#4ade80', color: '#fff', border: 'none', padding: '6px 20px', fontSize: '13px', borderRadius: '4px' }}>
                OK
              </button>
              <button onClick={() => setIsSvbModalOpen(false)} className="btn btn-secondary" style={{ background: '#fff', color: '#334155', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 20px', fontSize: '13px', borderRadius: '4px' }}>
                CANCEL
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Other Relevant Information Modal */}
      {isOtherInfoModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '500px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#334155', fontWeight: 'normal' }}>Other Relevant Information</h3>
            </div>
            
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
              <textarea 
                name="otherRelevantInform" value={invoiceFormData.otherRelevantInform ?? ''} onChange={handleTempChange}
                style={{ width: '100%', height: '150px', border: '1px solid #cbd5e1', borderRadius: '2px', padding: '8px', resize: 'none', color: 'var(--primary-color-end, var(--primary-color-end))', outline: 'none' }}
              ></textarea>
            </div>
            
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color, #cbd5e1)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#fff' }}>
              <button onClick={() => setIsOtherInfoModalOpen(false)} className="btn btn-success" style={{ background: '#4ade80', color: '#fff', border: 'none', padding: '6px 20px', fontSize: '13px', borderRadius: '4px' }}>
                OK
              </button>
              <button onClick={() => setIsOtherInfoModalOpen(false)} className="btn btn-secondary" style={{ background: '#fff', color: '#334155', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 20px', fontSize: '13px', borderRadius: '4px' }}>
                CANCEL
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Conditions of Restrictions Modal */}
      {isConditionsModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '600px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#334155', fontWeight: 'normal' }}>Conditions of Restrictions Attached with Sale</h3>
            </div>
            
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1, 2, 3, 4, 5].map((num) => (
                <div key={num} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ width: '80px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>{num}.Condition</label>
                  <input type="text" name={`conditionsAttachedWithSale${num}`} value={invoiceFormData[`conditionsAttachedWithSale${num}`] ?? ''} onChange={handleTempChange} className="input-field" style={{ flex: 1, border: '1px solid #cbd5e1', color: 'var(--primary-color-end, var(--primary-color-end))' }} />
                </div>
              ))}
            </div>
            
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color, #cbd5e1)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#fff' }}>
              <button onClick={() => setIsConditionsModalOpen(false)} className="btn btn-success" style={{ background: '#4ade80', color: '#fff', border: 'none', padding: '6px 20px', fontSize: '13px', borderRadius: '4px' }}>
                OK
              </button>
              <button onClick={() => setIsConditionsModalOpen(false)} className="btn btn-secondary" style={{ background: '#fff', color: '#334155', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 20px', fontSize: '13px', borderRadius: '4px' }}>
                CANCEL
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Seller Details Modal */}
      {isSellerModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '600px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            <div style={{ padding: '12px 16px', background: 'var(--bg-panel, #ffffff)', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--primary-text, var(--primary-text))', fontWeight: 'normal' }}>Seller Details</h3>
            </div>
            
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ width: '100px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Name</label>
                <input type="text" name="sellerName" value={invoiceFormData.sellerName ?? ''} onChange={handleTempChange} className="input-field" placeholder="NAME" style={{ flex: 1, background: '#f0fdf4', border: '1px solid #cbd5e1' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ width: '100px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Address1</label>
                <input type="text" name="sellerAddress1" value={invoiceFormData.sellerAddress1 ?? ''} onChange={handleTempChange} className="input-field" placeholder="ADDRESS1" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ width: '100px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Address2</label>
                <input type="text" name="sellerAddress2" value={invoiceFormData.sellerAddress2 ?? ''} onChange={handleTempChange} className="input-field" placeholder="ADDRESS2" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ width: '100px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Address3</label>
                <input type="text" name="sellerAddress3" value={invoiceFormData.sellerAddress3 ?? ''} onChange={handleTempChange} className="input-field" placeholder="ADDRESS3" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ width: '100px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Country</label>
                <input list="country-list" name="sellerCountryName" value={invoiceFormData.sellerCountryName ?? ''} onChange={handleTempChange} type="text" className="input-field" placeholder="COUNTRY" style={{ flex: 1, background: '#f0fdf4', border: '1px solid #cbd5e1' }} />
                
                <label style={{ width: '40px', color: 'var(--text-main, var(--text-main, #1e293b))', textAlign: 'center' }}>Pin</label>
                <input type="text" name="sellerPin" value={invoiceFormData.sellerPin ?? ''} onChange={handleTempChange} className="input-field" style={{ width: '100px', border: '1px solid #cbd5e1' }} />
              </div>
            </div>
            
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color, #cbd5e1)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#fff' }}>
              <button onClick={() => setIsSellerModalOpen(false)} className="btn btn-success" style={{ background: '#4ade80', color: '#fff', border: 'none', padding: '6px 20px', fontSize: '13px', borderRadius: '4px' }}>
                OK
              </button>
              <button onClick={() => setIsSellerModalOpen(false)} className="btn btn-secondary" style={{ background: '#fff', color: '#334155', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 20px', fontSize: '13px', borderRadius: '4px' }}>
                CANCEL
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Broker Details Modal */}
      {isBrokerModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '600px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            <div style={{ padding: '12px 16px', background: 'var(--bg-panel, #ffffff)', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--primary-text, var(--primary-text))', fontWeight: 'normal' }}>Broker's Details</h3>
            </div>
            
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ width: '100px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Broker Name</label>
                <input type="text" name="brokerName" value={invoiceFormData.brokerName ?? ''} onChange={handleTempChange} className="input-field" placeholder="NAME" style={{ flex: 1, background: '#f0fdf4', border: '1px solid #cbd5e1' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ width: '100px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Address1</label>
                <input type="text" name="brokerAddress1" value={invoiceFormData.brokerAddress1 ?? ''} onChange={handleTempChange} className="input-field" placeholder="ADDRESS1" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ width: '100px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Address2</label>
                <input type="text" name="brokerAddress2" value={invoiceFormData.brokerAddress2 ?? ''} onChange={handleTempChange} className="input-field" placeholder="ADDRESS2" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ width: '100px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Address3</label>
                <input type="text" name="brokerAddress3" value={invoiceFormData.brokerAddress3 ?? ''} onChange={handleTempChange} className="input-field" placeholder="ADDRESS3" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ width: '100px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Country</label>
                <input list="country-list" name="brokerCountry" value={invoiceFormData.brokerCountry ?? ''} onChange={handleTempChange} type="text" className="input-field" placeholder="COUNTRY" style={{ flex: 1, background: '#f0fdf4', border: '1px solid #cbd5e1' }} />
                
                <label style={{ width: '40px', color: 'var(--text-main, var(--text-main, #1e293b))', textAlign: 'center' }}>Pin</label>
                <input type="text" name="brokerPin" value={invoiceFormData.brokerPin ?? ''} onChange={handleTempChange} className="input-field" style={{ width: '100px', border: '1px solid #cbd5e1' }} />
              </div>
            </div>
            
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color, #cbd5e1)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#fff' }}>
              <button onClick={() => setIsBrokerModalOpen(false)} className="btn btn-success" style={{ background: '#4ade80', color: '#fff', border: 'none', padding: '6px 20px', fontSize: '13px', borderRadius: '4px' }}>
                OK
              </button>
              <button onClick={() => setIsBrokerModalOpen(false)} className="btn btn-secondary" style={{ background: '#fff', color: '#334155', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 20px', fontSize: '13px', borderRadius: '4px' }}>
                CANCEL
              </button>
            </div>
            
          </div>
        </div>
      )}

    
      {masters && (
        <>
          <datalist id="country-list">{masters.countries?.map(c => <option key={c.id} value={c.code}>{c.name}</option>)}</datalist>
          <datalist id="currency-list">{masters.currencies?.map(c => <option key={c.id} value={c.currencyCode}>{c.currencyName}</option>)}</datalist>
          <datalist id="uqc-list">{masters.uqcs?.map(c => <option key={c.id} value={c.uqcCode}>{c.description}</option>)}</datalist>
          <datalist id="scheme-list">{masters.schemeCodes?.map(c => <option key={c.code} value={c.code}>{c.desc}</option>)}</datalist>
          <datalist id="state-list">{masters.states?.map(c => <option key={c.id} value={c.stateName}>{c.stateCode} - GST {c.taxCode}</option>)}</datalist>
          <datalist id="state-taxcode-list">{masters.states?.map(c => <option key={c.id} value={c.taxCode}>{c.stateName}</option>)}</datalist>
          <datalist id="supplier-list">{masters.parties?.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</datalist>
          <datalist id="port-list">{masters.ports?.map(p => <option key={p.id} value={p.portCode}>{p.portName}</option>)}</datalist>
        </>
      )}
    </>
  );
}
