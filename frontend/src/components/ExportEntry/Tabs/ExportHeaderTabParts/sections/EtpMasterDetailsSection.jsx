// Screen section: ETP Master Details
// Split out of ExportHeaderTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Download, Edit, FolderOpen, Save, X } from 'lucide-react';
import ModernDatePicker from '../../../../common/ModernDatePicker';
import React from 'react';

export default function EtpMasterDetailsSection({ ctx }) {
  const { categoryList, etpDetails, exportData, factoryAddress, handleChange, isCategoryModalOpen, isConfirmFactoryOpen, isEtpModalOpen, isFactoryAddressModalOpen, isMarksNoModalOpen, setEtpDetails, setExportData, setFactoryAddress, setIsCategoryModalOpen, setIsConfirmFactoryOpen, setIsEtpModalOpen, setIsFactoryAddressModalOpen, setIsMarksNoModalOpen, setNfeiCategory, setNfeiCategoryCode } = ctx;
  return (
    <>
    {isEtpModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '800px', borderRadius: '4px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '14px', color: '#334155' }}>ETP Master Details</h3>
              </div>
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#f0fdfa' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '11px' }}>Job No <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" className="input-field" value={etpDetails.JobNo} onChange={e => setEtpDetails({...etpDetails, JobNo: e.target.value})} style={{ border: '1px solid var(--primary-border)' }} />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '11px' }}>Job Date <span style={{ color: '#ef4444' }}>*</span></label>
                    <ModernDatePicker className="input-field" value={etpDetails.JobDate} onChange={e => setEtpDetails({...etpDetails, JobDate: e.target.value})} style={{ border: '1px solid var(--primary-border)' }} />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '11px' }}>Site Id <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" className="input-field" value={etpDetails.SiteId} onChange={e => setEtpDetails({...etpDetails, SiteId: e.target.value})} style={{ border: '1px solid var(--primary-border)' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '11px' }}>Gateway Port<span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" className="input-field" value={etpDetails.GatewayPort} onChange={e => setEtpDetails({...etpDetails, GatewayPort: e.target.value})} style={{ border: '1px solid var(--primary-border)' }} />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '11px' }}>Stuff Port<span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" className="input-field" value={etpDetails.StuffPort} onChange={e => setEtpDetails({...etpDetails, StuffPort: e.target.value})} style={{ border: '1px solid var(--primary-border)' }} />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '11px' }}>Carrier Code<span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" className="input-field" value={etpDetails.CarrierCode} onChange={e => setEtpDetails({...etpDetails, CarrierCode: e.target.value})} style={{ border: '1px solid var(--primary-border)' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '11px' }}>Port Of Discharge<span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" className="input-field" value={etpDetails.PortOfDischarge} onChange={e => setEtpDetails({...etpDetails, PortOfDischarge: e.target.value})} style={{ border: '1px solid var(--primary-border)' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '11px' }}>Carrier Number<span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" className="input-field" value={etpDetails.CarrierNumber} onChange={e => setEtpDetails({...etpDetails, CarrierNumber: e.target.value})} style={{ border: '1px solid var(--primary-border)' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '11px' }}>Bond Code <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" className="input-field" value={etpDetails.BondCode} onChange={e => setEtpDetails({...etpDetails, BondCode: e.target.value})} style={{ border: '1px solid var(--primary-border)' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 3' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '11px' }}>Bond Number <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" className="input-field" value={etpDetails.BondNumber} onChange={e => setEtpDetails({...etpDetails, BondNumber: e.target.value})} style={{ border: '1px solid var(--primary-border)', width: '100%' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '11px' }}>Bond Date <span style={{ color: '#ef4444' }}>*</span></label>
                    <ModernDatePicker className="input-field" value={etpDetails.BondDate} onChange={e => setEtpDetails({...etpDetails, BondDate: e.target.value})} style={{ border: '1px solid var(--primary-border)' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '11px' }}>Bond Site <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" className="input-field" value={etpDetails.BondSite} onChange={e => setEtpDetails({...etpDetails, BondSite: e.target.value})} style={{ border: '1px solid var(--primary-border)' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '11px' }}>Exp.Trans. Shippment Date</label>
                    <ModernDatePicker className="input-field" value={etpDetails.ExpTransShippmentDate} onChange={e => setEtpDetails({...etpDetails, ExpTransShippmentDate: e.target.value})} style={{ border: '1px solid var(--primary-border)' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '11px' }}>Exp.Trans Shippment No.</label>
                    <input type="text" className="input-field" value={etpDetails.ExpTransShippmentNo} onChange={e => setEtpDetails({...etpDetails, ExpTransShippmentNo: e.target.value})} style={{ border: '1px solid var(--primary-border)' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '11px' }}>Airway Bill No.</label>
                    <input type="text" className="input-field" value={etpDetails.AirWayBillNo} onChange={e => setEtpDetails({...etpDetails, AirWayBillNo: e.target.value})} style={{ border: '1px solid var(--primary-border)' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
                  <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 16px', background: '#10b981', border: 'none' }} onClick={() => { setExportData(prev => ({ ...prev, etpDetails })); setIsEtpModalOpen(false); }}>
                    <Save size={14} /> SAVE
                  </button>
                  <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 16px', background: '#10b981', border: 'none' }} onClick={() => { setExportData(prev => ({ ...prev, etpDetails })); setIsEtpModalOpen(false); }}>
                    <Edit size={14} /> UPDATE
                  </button>
                  <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 16px', background: 'var(--primary-color-start, #3b82f6)', border: 'none' }} onClick={() => {
                      const blob = new Blob([JSON.stringify(etpDetails, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = 'etp_details.json'; a.click();
                      URL.revokeObjectURL(url);
                    }}>
                    <Download size={14} /> DOWNLOAD JSON
                  </button>
                </div>
              </div>
              <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
              <button className="btn btn-success" onClick={() => { setExportData(prev => ({ ...prev, etpDetails })); setIsEtpModalOpen(false); }}>OK</button>
              <button className="btn btn-secondary" onClick={() => setIsEtpModalOpen(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {isCategoryModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '480px', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ padding: '16px 20px', background: 'transparent', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderOpen size={16} color="#0ea5e9" />
                Select NFEI Category
              </span>
              <button onClick={() => setIsCategoryModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', borderRadius: '4px', display: 'flex' }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = 'none'}><X size={18} /></button>
            </div>
            
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '16px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                <span>SEARCH BY:</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="radio" name="catSearch" value="CODE" checked={exportData["catSearch"] !== 'DESCRIPTION'} onChange={handleChange} style={{ accentColor: 'var(--primary-color-start, #0ea5e9)', cursor: 'pointer', width: '16px', height: '16px' }} /> 
                  Code
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="radio" name="catSearch" value="DESCRIPTION" checked={exportData["catSearch"] === 'DESCRIPTION'} onChange={handleChange} style={{ accentColor: 'var(--primary-color-start, #0ea5e9)', cursor: 'pointer', width: '16px', height: '16px' }} /> 
                  Description
                </label>
              </div>
              
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <input name="enterFilter" type="text" placeholder="Type to filter..." style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--primary-border)', borderRadius: '6px', fontSize: '13px', outline: 'none', transition: 'border-color 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }} onFocus={e => e.target.style.borderColor = 'var(--primary-color-start, #0ea5e9)'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} value={exportData["enterFilter"] || ""} onChange={handleChange} />
              </div>
              
              <div style={{ height: '320px', overflowY: 'auto', border: '1px solid var(--primary-border)', borderRadius: '6px', background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <tr>
                      <th style={{ padding: '10px 12px', width: '44px', resize: 'none' }}></th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: '12px', letterSpacing: '0.5px', resize: 'none' }}>CODE</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: '12px', letterSpacing: '0.5px', resize: 'none' }}>DESCRIPTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryList.filter(item => {
                      if (!exportData.enterFilter) return true;
                      const term = exportData.enterFilter.toLowerCase();
                      if (exportData.catSearch === 'DESCRIPTION') return item.desc.toLowerCase().includes(term);
                      return item.code.toLowerCase().includes(term);
                    }).map(item => (
                      <tr 
                        key={item.code} 
                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.15s ease' }} 
                        onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.querySelector('.mock-checkbox').style.borderColor = 'var(--primary-color-start, #0ea5e9)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.querySelector('.mock-checkbox').style.borderColor = '#cbd5e1'; }}
                        onClick={() => { setNfeiCategory(item.desc); setNfeiCategoryCode(item.code); setExportData(prev => ({...prev, nfeiCategory: item.desc, nfeiCategoryCode: item.code, enterFilter: ''})); setIsCategoryModalOpen(false); }}
                      >
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <div className="mock-checkbox" style={{ width: '16px', height: '16px', border: '2px solid #cbd5e1', borderRadius: '4px', margin: '0 auto', transition: 'border-color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {exportData.nfeiCategoryCode === item.code && <div style={{ width: '8px', height: '8px', background: 'var(--primary-color-start, #0ea5e9)', borderRadius: '2px' }} />}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#0f172a', fontWeight: 500 }}>{item.code}</td>
                        <td style={{ padding: '10px 12px', color: '#334155' }}>{item.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

            {/* FACTORY ADDRESS CONFIRM MODAL */}
      {isConfirmFactoryOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '400px', borderRadius: '6px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-main, var(--text-main, #0f172a))' }}>Confirm Action</span>
              <button onClick={() => setIsConfirmFactoryOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, var(--text-muted, #64748b))' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '24px 16px', fontSize: '14px', color: '#334155', textAlign: 'center' }}>
              Do you want to save Factory Stuff Address?
            </div>
            <div style={{ padding: '12px 16px', background: 'var(--bg-input)', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn" onClick={() => setIsConfirmFactoryOpen(false)} style={{ padding: '6px 16px', border: '1px solid var(--primary-border)', background: '#fff', borderRadius: '4px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <button className="btn" onClick={() => { setIsConfirmFactoryOpen(false); setIsFactoryAddressModalOpen(true); }} style={{ padding: '6px 16px', background: 'var(--primary-color-end, #2563eb)', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 500, cursor: 'pointer' }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* FACTORY ADDRESS MODAL */}
      {isFactoryAddressModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '500px', borderRadius: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ padding: '12px 16px', background: '#fff', color: '#334155', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '16px' }}>Address</span>
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ border: '1px solid var(--primary-border)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color, #cbd5e1)', fontSize: '13px', fontWeight: 600, color: '#334155' }}>Address</div>
                <div style={{ padding: '12px' }}>
                  <textarea 
                    value={factoryAddress}
                    onChange={e => { setFactoryAddress(e.target.value); setExportData(prev => ({...prev, factoryAddress: e.target.value})); }}
                    style={{ width: '100%', height: '100px', border: '2px solid #0284c7', borderRadius: '4px', padding: '8px', fontSize: '13px', outline: 'none', resize: 'none' }}
                  />
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn" onClick={() => setIsFactoryAddressModalOpen(false)} style={{ background: '#4ade80', color: '#fff', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '4px', fontWeight: 600 }}>OK</button>
              <button className="btn" onClick={() => setIsFactoryAddressModalOpen(false)} style={{ background: '#1e40af', color: '#fff', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '4px', fontWeight: 600 }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}


      {isMarksNoModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '600px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                MARKS & NUMBERS
              </span>
              <button type="button" onClick={() => setIsMarksNoModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', borderRadius: '4px', display: 'flex' }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Marks & Numbers (Customs Flat File)</label>
                <textarea name="autoField_16" value={exportData["autoField_16"] || ""} onChange={handleChange} style={{ width: '100%', height: '120px', padding: '12px', borderRadius: '6px', border: '2px solid #0ea5e9', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' }} placeholder="Enter Marks & Numbers here..."></textarea>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Checklist Display Only (Not in Flat File)</label>
                <textarea name="thisDisplayOnlyInChecklistNotInCustomFlatFile" value={exportData["thisDisplayOnlyInChecklistNotInCustomFlatFile"] || ""} onChange={handleChange} style={{ width: '100%', height: '120px', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' }} placeholder="Additional Marks info for Checklist..."></textarea>
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc' }}>
              <button type="button" onClick={() => setIsMarksNoModalOpen(false)} style={{ padding: '8px 24px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>OK</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
