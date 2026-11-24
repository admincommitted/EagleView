// Screen section: Scheme Code Category
// Split out of ItemGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import ModernDatePicker from '../../../../common/ModernDatePicker'; // 21-Nov-2026: DD-MM-YYYY date box like the invoice screens (same YYYY-MM-DD value)
import { CheckSquare, Info, MinusCircle, Plus, X } from 'lucide-react';
import React from 'react';

export default function SchemeCodeCategorySection({ ctx }) {
  const { addSchemeCatRow, addSwInfoRow, applySwInfoToAll, removeSwInfoRow, saveSchemeCategoryModal, saveSwInfoModal, schemeCatForm, schemeSearch, setSchemeCatForm, setSchemeSearch, setShowSchemeCategoryModal, setShowSchemeSearchModal, setShowSwInfoModal, setSwInfoForm, setTempSchemeCatData, showSchemeCategoryModal, showSchemeSearchModal, showSwInfoModal, swInfoForm, tempSchemeCatData, tempSwInfoData } = ctx;
  return (
    <>
    {showSchemeCategoryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '600px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'var(--bg-panel, #ffffff)', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#334155', fontWeight: 'normal' }}>Scheme Code Category</h3>
            </div>
            
            <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ border: '1px solid #cbd5e1', padding: '15px', borderRadius: '4px', background: 'var(--bg-panel, #ffffff)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 130px 1fr', gap: '10px', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px' }}>RITC</label>
                  <input type="text" className="input-field" value={schemeCatForm?.ritc || ''} onChange={(e) => setSchemeCatForm({...schemeCatForm, ritc: e.target.value})} style={{ width: '100%', border: '1px solid #cbd5e1' }} />
                  
                  <label style={{ fontSize: '12px' }}>Scheme Code</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input list="scheme-list" type="text" className="input-field" value={schemeCatForm?.schemeCode || ''} onChange={(e) => setSchemeCatForm({...schemeCatForm, schemeCode: e.target.value})} style={{ flex: 1, border: '1px solid #ef4444' }} />
                    <Info size={16} color="#0000ff" style={{ cursor: 'pointer' }} onClick={() => setShowSchemeSearchModal(true)} />
                  </div>
                  
                  <label style={{ fontSize: '12px' }}>License No</label>
                  <input type="text" className="input-field" value={schemeCatForm?.licenseNo || ''} onChange={(e) => setSchemeCatForm({...schemeCatForm, licenseNo: e.target.value})} style={{ width: '100%', border: '1px solid #cbd5e1' }} />
                  
                  <label style={{ fontSize: '12px' }}>Date</label>
                  <ModernDatePicker className="input-field" value={schemeCatForm?.date || ''} onChange={(e) => setSchemeCatForm({...schemeCatForm, date: e.target.value})} style={{ width: '100%', border: '1px solid #cbd5e1' }} />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button className="btn btn-primary" onClick={addSchemeCatRow} style={{ background: 'var(--primary-color-start)', border: 'none', padding: '6px 16px', color: '#fff', fontSize: '12px', borderRadius: '4px', cursor: 'pointer' }}>
                    Add
                  </button>
                </div>
              </div>

              <div style={{ border: '1px solid #93c5fd', borderRadius: '4px', height: '150px', overflowY: 'auto' }}>
                <table className="data-grid" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                  <thead style={{ background: '#f1f5f9' }}>
                    <tr>
                      <th style={{ padding: '6px', borderBottom: '1px solid #e2e8f0' }}>RITC</th>
                      <th style={{ padding: '6px', borderBottom: '1px solid #e2e8f0' }}>Scheme Code</th>
                      <th style={{ padding: '6px', borderBottom: '1px solid #e2e8f0' }}>License No</th>
                      <th style={{ padding: '6px', borderBottom: '1px solid #e2e8f0' }}>Date</th>
                      <th style={{ padding: '6px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(tempSchemeCatData) && tempSchemeCatData.map((row) => (
                      <tr key={row.id}>
                        <td style={{ padding: '6px', borderBottom: '1px solid #f1f5f9' }}>{row.ritc}</td>
                        <td style={{ padding: '6px', borderBottom: '1px solid #f1f5f9' }}>{row.schemeCode}</td>
                        <td style={{ padding: '6px', borderBottom: '1px solid #f1f5f9' }}>{row.licenseNo}</td>
                        <td style={{ padding: '6px', borderBottom: '1px solid #f1f5f9' }}>{row.date}</td>
                        <td style={{ padding: '6px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                          <X size={14} color="#ef4444" style={{ cursor: 'pointer' }} onClick={() => setTempSchemeCatData(tempSchemeCatData.filter(r => r.id !== row.id))} />
                        </td>
                      </tr>
                    ))}
                    {(!Array.isArray(tempSchemeCatData) || tempSchemeCatData.length === 0) && (
                      <tr><td colSpan="5" style={{ textAlign: 'center', padding: '10px' }}>No records</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color, #cbd5e1)', borderRadius: '0 0 4px 4px' }}>
              <button className="btn btn-success" onClick={saveSchemeCategoryModal} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#5cb85c', color: '#fff', padding: '6px 16px', borderRadius: '4px', border: 'none', fontSize: '12px', cursor: 'pointer' }}>
                <CheckSquare size={14} /> Ok
              </button>
              <button className="btn btn-danger" onClick={() => setShowSchemeCategoryModal(false)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', color: '#334155', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 16px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheme Search Modal */}
      {showSchemeSearchModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '500px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'var(--bg-panel, #ffffff)', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#334155', fontWeight: 'normal' }}>Search</h3>
              <X size={18} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setShowSchemeSearchModal(false)} />
            </div>
            <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '4px', background: 'var(--bg-panel, #ffffff)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-main, var(--text-main, #0f172a))' }}>Search By</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>code or description</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-main, var(--text-main, #0f172a))', width: '60px' }}>Filter</span>
                  <input type="text" className="input-field" placeholder="ENTER FILTER" value={schemeSearch} onChange={(e) => setSchemeSearch(e.target.value)} style={{ flex: 1, border: '1px solid #cbd5e1', color: '#94a3b8', textTransform: 'uppercase' }} />
                </div>
              </div>
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'auto', maxHeight: '250px' }}>
                <table className="data-grid" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                  <thead style={{ background: 'var(--primary-bg-light, var(--primary-bg-light))', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ width: '30px', borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}></th>
                      <th style={{ width: '100px', borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>SCHEME_CODE</th>
                      <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>SCHEME_DESC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { code: '00', desc: 'FREE SHIPPING BILL INVOLING REMITTAN...' },
                      { code: '01', desc: 'ADVANCE LICENCE WITH ACTUAL USER C...' },
                      { code: '02', desc: 'ADVANCE LICENCE FOR INTERMEDIATE S...' },
                      { code: '03', desc: 'ADVANCE LICENCE' },
                      { code: '04', desc: 'ADVANCE RELEASE ORDER' },
                      { code: '05', desc: 'ADVANCE LICENCE FOR DEEMED EXPORTS' },
                      { code: '06', desc: 'DEPB POST EXPORT' },
                      { code: '07', desc: 'DEPB-PRE EXPORTS' },
                      { code: '08', desc: 'REPLENISHMENT LICENCE' },
                      { code: '09', desc: 'DIAMOND IMPREST LICENCE' },
                      { code: '10', desc: 'BULK LICENCE' },
                      { code: '11', desc: 'Concessional DUTY EPCG SCHEME' },
                      { code: '12', desc: 'ZERO DUTY EPCG SCHEME' }
                    ].map((row, i) => (
                      <tr key={i}>
                        <td style={{ padding: '4px', borderBottom: '1px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}>
                          <CheckSquare size={14} color="#22c55e" />
                        </td>
                        <td style={{ padding: '4px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.code}</td>
                        <td style={{ padding: '4px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-panel, #ffffff)', borderTop: '1px solid var(--border-color, #cbd5e1)', borderRadius: '0 0 4px 4px' }}>
              <button className="btn btn-danger" onClick={() => setShowSchemeSearchModal(false)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ef4444', color: '#fff', padding: '6px 16px', borderRadius: '4px', border: 'none', fontSize: '12px', cursor: 'pointer' }}>
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SW Info Type Modal */}
      {showSwInfoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '900px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'var(--bg-panel, #ffffff)', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#334155', fontWeight: 'normal' }}>SW Info Type</h3>
                <X size={18} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setShowSwInfoModal(false)} />
              </div>
              
              <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                
                {/* Form Area */}
                <div style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '4px', background: 'var(--bg-panel, #ffffff)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', alignItems: 'end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '12px' }}>Info Type</label>
                      <select className="input-field" style={{ width: '100%', border: '1px solid #ef4444', color: '#0000ff' }} value={swInfoForm.type} onChange={(e) => setSwInfoForm({...swInfoForm, type: e.target.value})}>
                        <option value="Select">Select</option>
                        <option value="IDT">IDT | Item Identification</option>
                        <option value="CHR">CHR | Item Characteristics</option>
                        <option value="CTG">CTG | Item Category</option>
                        <option value="PNM">PNM | Product Name</option>
                        <option value="PEC">PEC | PGA Exception category</option>
                        <option value="ORC">ORC | Origin Criteria</option>
                        <option value="DTY">DTY | DUTY</option>
                        <option value="OTH">OTH | OTHERS</option>
                        <option value="SEZ">SEZ | SEZ</option>
                        <option value="SIU">SIU | SIMS (AI/Excel)</option>
                      </select>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '12px' }}>Info Qualifier</label>
                      <select className="input-field" style={{ width: '100%', border: '1px solid #ef4444', color: '#0000ff' }} value={swInfoForm.qualifier} onChange={(e) => setSwInfoForm({...swInfoForm, qualifier: e.target.value})}>
                        <option value="Select">Select</option>
                        {swInfoForm.type === 'CHR' && (
                          <>
                            <option value="CCDC">CCDC | CCDC</option>
                            <option value="SGD">SGD | SGD</option>
                            <option value="SQC">SQC | Standard UQC</option>
                          </>
                        )}
                        {(swInfoForm.type === 'PNM' || swInfoForm.type === 'SIU') && (
                          <option value="SIU">SIU | SIMS Unique reference number</option>
                        )}
                      </select>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '12px' }}>Qualifier Code</label>
                      <select className="input-field" style={{ width: '100%', border: '1px solid #cbd5e1', color: '#0000ff' }} value={swInfoForm.code} onChange={(e) => setSwInfoForm({...swInfoForm, code: e.target.value})}>
                        <option value="Select">Select</option>
                        {(swInfoForm.type === 'PNM' || swInfoForm.type === 'SIU') && (
                          <>
                            <option value="SIUNAF">SIUNAF ||SIUNAF</option>
                            <option value="SIUNAPL">SIUNAPL ||SIUNAPL</option>
                            <option value="SIUNRR">SIUNRR ||SIUNRR</option>
                          </>
                        )}
                      </select>
                    </div>
  
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '12px' }}>Info Text</label>
                      <input type="text" className="input-field" style={{ width: '100%', border: '1px solid #cbd5e1' }} value={swInfoForm.text} onChange={(e) => setSwInfoForm({...swInfoForm, text: e.target.value})} />
                    </div>
  
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '12px' }}>Info Qty.</label>
                      <input type="text" className="input-field" style={{ width: '100%', border: '1px solid #cbd5e1' }} value={swInfoForm.qty} onChange={(e) => setSwInfoForm({...swInfoForm, qty: e.target.value})} />
                    </div>
  
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '12px' }}>Info UQC</label>
                      <input list="uqc-list" type="text" className="input-field" style={{ width: '100%', background: '#f0fdf4', border: '1px solid #cbd5e1' }} value={swInfoForm.uqc} onChange={(e) => setSwInfoForm({...swInfoForm, uqc: e.target.value})} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '12px' }}>Agency</label>
                      <select className="input-field" style={{ width: '100%', border: '1px solid #ef4444', color: '#0000ff' }} value={swInfoForm.agency} onChange={(e) => setSwInfoForm({...swInfoForm, agency: e.target.value})}>
                        <option value="ALL">ALL</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: 'span 3' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <button onClick={addSwInfoRow} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--primary-color-start)', border: 'none', padding: '6px 16px', color: '#fff', fontSize: '12px', borderRadius: '4px', cursor: 'pointer' }}>
                        <Plus size={14}/> Add
                      </button>
                    </div>
                  </div>
                </div>
  
                {/* Grid Area */}
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
                  <table className="data-grid" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                    <thead style={{ background: 'var(--primary-bg-light, var(--primary-bg-light))' }}>
                      <tr>
                        <th style={{ width: '50px', borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px', textAlign: 'center' }}>Remove</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Agency</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Info Type</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Info Qualifier</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Info Code</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Info Text</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Info Qty.</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Info UQC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tempSwInfoData.map((row, idx) => (
                          <tr key={idx}>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}><MinusCircle onClick={() => removeSwInfoRow(row.id)} size={14} color="#ef4444" style={{ cursor: 'pointer', fill: '#fee2e2' }} /></td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.agency || 'ALL'}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.type}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.qualifier}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.code}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.text}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.qty}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.uqc}</td>
                          </tr>
                      ))}
                      {tempSwInfoData.length === 0 && (
                          <tr><td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No Info Data Added</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
  
              </div>
              
              <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'var(--bg-panel, #ffffff)', borderTop: '1px solid var(--border-color, #cbd5e1)', borderRadius: '0 0 4px 4px' }}>
                <button className="btn btn-primary" onClick={applySwInfoToAll} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#3b82f6', color: '#fff', padding: '6px 16px', borderRadius: '4px', border: 'none', fontSize: '12px', cursor: 'pointer' }}>
                  <CheckSquare size={14} /> Apply to All in Invoice
                </button>
                <button className="btn btn-success" onClick={saveSwInfoModal} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#5cb85c', color: '#fff', padding: '6px 16px', borderRadius: '4px', border: 'none', fontSize: '12px', cursor: 'pointer' }}>
                  <CheckSquare size={14} /> Ok
                </button>
                <button className="btn btn-danger" onClick={() => setShowSwInfoModal(false)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', color: '#334155', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 16px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* SW Const Modal */}{/* SW Const Modal */}
    </>
  );
}
