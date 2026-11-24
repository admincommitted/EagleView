// Screen section: SW Const
// Split out of ItemGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { CheckSquare, MinusCircle, X } from 'lucide-react';
import React from 'react';

export default function SwConstSection({ ctx }) {
  const { addSwConstRow, addSwProdRow, removeSwConstRow, removeSwProdRow, saveSwConstModal, saveSwProductionModal, setShowSwConstModal, setShowSwProductionModal, setSwConstForm, setSwProdForm, showSwConstModal, showSwProductionModal, swConstForm, swProdForm, tempSwConstData, tempSwProdData } = ctx;
  return (
    <>
    {showSwConstModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '900px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'var(--bg-panel, #ffffff)', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#334155', fontWeight: 'normal' }}>SW Const</h3>
                <X size={18} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setShowSwConstModal(false)} />
              </div>
              
              <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                
                {/* Form Area */}
                <div style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '4px', background: 'var(--bg-panel, #ffffff)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', alignItems: 'end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '12px' }}>Const. Sr No</label>
                      <input type="text" className="input-field" style={{ width: '100%', border: '2px solid #ef4444' }} value={swConstForm.srNo} onChange={(e) => setSwConstForm({...swConstForm, srNo: e.target.value})} />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '12px' }}>Element Name</label>
                      <input type="text" className="input-field" style={{ width: '100%', border: '1px solid #ef4444' }} value={swConstForm.name} onChange={(e) => setSwConstForm({...swConstForm, name: e.target.value})} />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '12px' }}>Element Code</label>
                      <input type="text" className="input-field" style={{ width: '100%', border: '1px solid #ef4444' }} value={swConstForm.code} onChange={(e) => setSwConstForm({...swConstForm, code: e.target.value})} />
                    </div>
  
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '12px' }}>Const. %</label>
                      <input type="text" className="input-field" style={{ width: '100%', border: '1px solid #cbd5e1' }} value={swConstForm.percent} onChange={(e) => setSwConstForm({...swConstForm, percent: e.target.value})} />
                    </div>
  
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '12px' }}>Const. Yield %</label>
                      <input type="text" className="input-field" style={{ width: '100%', border: '1px solid #cbd5e1' }} value={swConstForm.yield} onChange={(e) => setSwConstForm({...swConstForm, yield: e.target.value})} />
                    </div>
  
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '12px' }}>Active Ingredient</label>
                      <select className="input-field" style={{ width: '100%', border: '1px solid #cbd5e1', color: '#0000ff' }} value={swConstForm.active} onChange={(e) => setSwConstForm({...swConstForm, active: e.target.value})}>
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </select>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button onClick={addSwConstRow} className="btn btn-success" style={{ display: 'flex', alignItems: 'center', background: '#5cb85c', border: 'none', padding: '6px 20px', color: '#fff', fontSize: '14px', borderRadius: '4px', cursor: 'pointer' }}>
                      ADD
                    </button>
                  </div>
                </div>
  
                {/* Grid Area */}
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
                  <table className="data-grid" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                    <thead style={{ background: 'var(--primary-bg-light, var(--primary-bg-light))' }}>
                      <tr>
                        <th style={{ width: '50px', borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px', textAlign: 'center' }}>Remove</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Const. Sr No</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Element Name</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Element Code</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Const. %</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Const. Yield %</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Active Ingredient</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tempSwConstData.map((row, idx) => (
                          <tr key={idx}>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}><MinusCircle onClick={() => removeSwConstRow(row.id)} size={14} color="#ef4444" style={{ cursor: 'pointer', fill: '#fee2e2' }} /></td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.srNo}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.name}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.code}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.percent}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.yield}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.active}</td>
                          </tr>
                      ))}
                      {tempSwConstData.length === 0 && (
                          <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No Data Added</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
  
              </div>
              
              <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'var(--bg-panel, #ffffff)', borderTop: '1px solid var(--border-color, #cbd5e1)', borderRadius: '0 0 4px 4px' }}>
                <button className="btn btn-success" onClick={saveSwConstModal} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#5cb85c', color: '#fff', padding: '6px 16px', borderRadius: '4px', border: 'none', fontSize: '12px', cursor: 'pointer' }}>
                  <CheckSquare size={14} /> Ok
                </button>
                <button className="btn btn-danger" onClick={() => setShowSwConstModal(false)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', color: '#334155', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 16px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* SW Production Modal */}{/* SW Production Modal */}
      {showSwProductionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '1000px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'var(--bg-panel, #ffffff)', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#334155', fontWeight: 'normal' }}>Single Window Production Details</h3>
                <X size={18} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setShowSwProductionModal(false)} />
              </div>
              
              <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                
                {/* Form Area */}
                <div style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '4px', background: 'var(--bg-panel, #ffffff)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', alignItems: 'end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>Batch Identifier</label>
                      <input type="text" className="input-field" style={{ width: '100%', border: '2px solid #ef4444' }} value={swProdForm.batch} onChange={(e) => setSwProdForm({...swProdForm, batch: e.target.value})} />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>Batch Quantity</label>
                      <input type="text" className="input-field" style={{ width: '100%', border: '1px solid #ef4444', color: '#0000ff' }} value={swProdForm.qty} onChange={(e) => setSwProdForm({...swProdForm, qty: e.target.value})} />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>UQC</label>
                      <input list="uqc-list" type="text" className="input-field" style={{ width: '100%', border: '1px solid #ef4444' }} value={swProdForm.uqc} onChange={(e) => setSwProdForm({...swProdForm, uqc: e.target.value})} />
                    </div>
  
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>Date of Mnf</label>
                      <input type="text" className="input-field" style={{ width: '100%', border: '1px solid #ef4444' }} value={swProdForm.mnfDate} onChange={(e) => setSwProdForm({...swProdForm, mnfDate: e.target.value})} />
                    </div>
  
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>Date of Expiry</label>
                      <input type="text" className="input-field" style={{ width: '100%', border: '1px solid #ef4444' }} value={swProdForm.expDate} onChange={(e) => setSwProdForm({...swProdForm, expDate: e.target.value})} />
                    </div>
  
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>Best Before</label>
                      <input type="text" className="input-field" style={{ width: '100%', border: '1px solid #ef4444' }} value={swProdForm.bestBefore} onChange={(e) => setSwProdForm({...swProdForm, bestBefore: e.target.value})} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button onClick={addSwProdRow} className="btn btn-success" style={{ display: 'flex', alignItems: 'center', background: '#5cb85c', border: 'none', padding: '6px 20px', color: '#fff', fontSize: '14px', borderRadius: '4px', cursor: 'pointer' }}>
                      ADD
                    </button>
                  </div>
                </div>
  
                {/* Grid Area */}
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
                  <table className="data-grid" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                    <thead style={{ background: 'var(--primary-bg-light, var(--primary-bg-light))' }}>
                      <tr>
                        <th style={{ width: '50px', borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px', textAlign: 'center' }}>Remove</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Batch Identifier</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Batch Quantity</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>UQC</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Date of Mnf</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Date of Expiry</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Best Before</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tempSwProdData.map((row, idx) => (
                          <tr key={idx}>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}><MinusCircle onClick={() => removeSwProdRow(row.id)} size={14} color="#ef4444" style={{ cursor: 'pointer', fill: '#fee2e2' }} /></td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.batch}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.qty}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.uqc}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.mnfDate}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.expDate}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.bestBefore}</td>
                          </tr>
                      ))}
                      {tempSwProdData.length === 0 && (
                          <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No Data Added</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
  
              </div>
              
              <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'var(--bg-panel, #ffffff)', borderTop: '1px solid var(--border-color, #cbd5e1)', borderRadius: '0 0 4px 4px' }}>
                <button className="btn btn-success" onClick={saveSwProductionModal} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#5cb85c', color: '#fff', padding: '6px 16px', borderRadius: '4px', border: 'none', fontSize: '12px', cursor: 'pointer' }}>
                  <CheckSquare size={14} /> Ok
                </button>
                <button className="btn btn-danger" onClick={() => setShowSwProductionModal(false)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', color: '#334155', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 16px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* SW Control Modal */}{/* SW Control Modal */}
    </>
  );
}
