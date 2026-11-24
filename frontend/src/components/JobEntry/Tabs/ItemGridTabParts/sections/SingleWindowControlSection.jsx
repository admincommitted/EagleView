// Screen section: Single Window Control Information
// Split out of ItemGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { CheckSquare, MinusCircle, X, FileSpreadsheet } from 'lucide-react';
import React from 'react';

export default function SingleWindowControlSection({ ctx }) {
  const { importSwCtrlExcel, applySwControlToAll, addSwCtrlRow, addSwStmtRow, applySwStatementToAll, removeSwCtrlRow, removeSwStmtRow, saveSwControlModal, saveSwStatementModal, setShowSwControlModal, setShowSwStatementModal, setSwCtrlForm, setSwStmtForm, showSwControlModal, showSwStatementModal, swCtrlForm, swStmtForm, tempSwCtrlData, tempSwStmtData } = ctx;
  return (
    <>
    {showSwControlModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '1000px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'var(--bg-panel, #ffffff)', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#334155', fontWeight: 'normal' }}>Single Window Control Information</h3>
                <X size={18} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setShowSwControlModal(false)} />
              </div>
              
              <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                
                {/* Form Area */}
                <div style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '4px', background: 'var(--bg-panel, #ffffff)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr) 0.6fr', gap: '10px', alignItems: 'end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>Type Code</label>
                      {/* ICEGATE wants the control CODE (max 17), not its name - the old list sent "Fumigation Control" etc. 28-Oct-2026 */}
                      <input list="sw-ctrl-codes" className="input-field" placeholder="code e.g. SEC65" maxLength={17} style={{ width: '100%', border: '2px solid #ef4444', color: '#0000ff', textTransform: 'uppercase' }}
                        value={swCtrlForm.typeCode === 'Select' ? '' : (swCtrlForm.typeCode || '')} onChange={(e) => setSwCtrlForm({...swCtrlForm, typeCode: e.target.value.toUpperCase().replace(/\s/g, '')})} />
                      <datalist id="sw-ctrl-codes">
                        <option value="SEC65">Section 65 - manufacture / operation in warehouse</option>
                        <option value="SEZ">SEZ</option>
                      </datalist>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>Location</label>
                      <input type="text" className="input-field" style={{ width: '100%', border: '1px solid #ef4444' }} value={swCtrlForm.location} onChange={(e) => setSwCtrlForm({...swCtrlForm, location: e.target.value})} />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>Start Date</label>
                      <input type="text" className="input-field" style={{ width: '100%', border: '1px solid #cbd5e1' }} value={swCtrlForm.startDate} onChange={(e) => setSwCtrlForm({...swCtrlForm, startDate: e.target.value})} />
                    </div>
  
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>End Date</label>
                      <input type="text" className="input-field" style={{ width: '100%', border: '1px solid #cbd5e1' }} value={swCtrlForm.endDate} onChange={(e) => setSwCtrlForm({...swCtrlForm, endDate: e.target.value})} />
                    </div>
  
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>Result Code</label>
                      <input type="text" className="input-field" style={{ width: '100%', background: '#f0fdf4', border: '1px solid #cbd5e1' }} value={swCtrlForm.resultCode} onChange={(e) => setSwCtrlForm({...swCtrlForm, resultCode: e.target.value})} />
                    </div>
  
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>Result Text</label>
                      <input type="text" className="input-field" style={{ width: '100%', border: '1px solid #cbd5e1' }} value={swCtrlForm.resultText} onChange={(e) => setSwCtrlForm({...swCtrlForm, resultText: e.target.value})} />
                    </div>

                    {/* 13-Nov-2026: control serial an ex-bond BE files (the warehouse BE's); empty = 1, 2, 3 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '13px' }} title="Ex-bond BE: the control serial of the warehouse BE (empty = 1, 2, 3 ...)">Sr No</label>
                      <input type="text" className="input-field" style={{ width: '100%', border: '1px solid #cbd5e1' }} value={swCtrlForm.slNo || ''} onChange={(e) => setSwCtrlForm({...swCtrlForm, slNo: e.target.value.replace(/\D/g, '')})} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                    <label title="Sheet SW_Control of the Job Excel (or iCAFFE's ImportExcel): Inv Sr No, Item Sr No, Control Type, Control Location, Start Date, End Date, Result Code, Result Text, Control Sr No - this item's rows are added"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', border: '1px solid #10b981', color: '#047857', padding: '6px 14px', fontSize: '13px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
                      <FileSpreadsheet size={15} /> Import from Excel
                      <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = null; importSwCtrlExcel && importSwCtrlExcel(f); }} />
                    </label>
                    <button onClick={addSwCtrlRow} className="btn btn-success" style={{ display: 'flex', alignItems: 'center', background: '#5cb85c', border: 'none', padding: '6px 20px', color: '#fff', fontSize: '14px', borderRadius: '4px', cursor: 'pointer' }}>
                      ADD
                    </button>
                  </div>
                </div>
  
                {/* Grid Area (scrolls: an ex-bond item can carry hundreds of control rows) */}
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'auto', maxHeight: '45vh' }}>
                  <table className="data-grid" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                    <thead style={{ background: 'var(--primary-bg-light, var(--primary-bg-light))' }}>
                      <tr>
                        <th style={{ width: '50px', borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px', textAlign: 'center' }}>Remove</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Type Code</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Location</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Start Date</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>End Date</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Result Code</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Result Text</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Sr No</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tempSwCtrlData.map((row, idx) => (
                          <tr key={idx}>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}><MinusCircle onClick={() => removeSwCtrlRow(row.id)} size={14} color="#ef4444" style={{ cursor: 'pointer', fill: '#fee2e2' }} />{/* 22-Nov-2026: a row can be changed - it goes back into the boxes above; ADD puts it in the list again */}<span role="button" title="Change this row: it goes back into the boxes above" onClick={() => { setSwCtrlForm({ typeCode: row.typeCode || '', location: row.location || '', startDate: row.startDate || '', endDate: row.endDate || '', resultCode: row.resultCode || '', resultText: row.resultText || '', slNo: row.slNo || row.controlSlNo || '' }); removeSwCtrlRow(row.id); }} style={{ marginLeft: '8px', color: '#2563eb', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>EDIT</span></td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.typeCode}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.location}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.startDate}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.endDate}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.resultCode}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.resultText}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.slNo || row.controlSlNo || ''}</td>
                          </tr>
                      ))}
                      {tempSwCtrlData.length === 0 && (
                          <tr><td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No Data Added</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
  
              </div>
              
              <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'var(--bg-panel, #ffffff)', borderTop: '1px solid var(--border-color, #cbd5e1)', borderRadius: '0 0 4px 4px' }}>
                <button className="btn btn-primary" onClick={applySwControlToAll} title="Put these control rows on every item of the job. Each item keeps its own CTH and Item Sr No." style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#3b82f6', color: '#fff', padding: '6px 16px', borderRadius: '4px', border: 'none', fontSize: '12px', cursor: 'pointer' }}>
                  <CheckSquare size={14} /> Apply to All Items
                </button>
                <button className="btn btn-success" onClick={saveSwControlModal} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#5cb85c', color: '#fff', padding: '6px 16px', borderRadius: '4px', border: 'none', fontSize: '12px', cursor: 'pointer' }}>
                  <CheckSquare size={14} /> Ok
                </button>
                <button className="btn btn-danger" onClick={() => setShowSwControlModal(false)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', color: '#334155', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 16px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* SW Statement Modal */}{/* SW Statement Modal */}
      {showSwStatementModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '900px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'var(--bg-panel, #ffffff)', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#334155', fontWeight: 'normal' }}>Single Window Statement</h3>
                <X size={18} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setShowSwStatementModal(false)} />
              </div>
              
              <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                
                {/* Form Area */}
                <div style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '4px', background: 'var(--bg-panel, #ffffff)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>Type Code</label>
                      {/* statement type codes DEC / UTG / REM (the list sent "DECLARATION" / "Undertaking"). 28-Oct-2026 */}
                      <select className="input-field" style={{ width: '100%', border: '2px solid #ef4444', color: '#0000ff' }} value={({ DECLARATION: 'DEC', UNDERTAKING: 'UTG' })[String(swStmtForm.typeCode || '').toUpperCase()] || swStmtForm.typeCode} onChange={(e) => setSwStmtForm({...swStmtForm, typeCode: e.target.value})}>
                        <option value="Select">Select</option>
                        <option value="DEC">DEC | Declaration</option>
                        <option value="UTG">UTG | Undertaking</option>
                        <option value="REM">REM | Remark (text needed)</option>
                      </select>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>Statement Code</label>
                      {/* any statement code can be typed (only 4 were offered; production files also use CUV01-03, PC002...) */}
                      <input list="sw-stmt-codes" className="input-field" placeholder="e.g. PC002" maxLength={7} style={{ width: '100%', border: '1px solid #cbd5e1', color: '#0000ff', textTransform: 'uppercase' }}
                        value={swStmtForm.stmtCode === 'Select' ? '' : (swStmtForm.stmtCode || '')} onChange={(e) => setSwStmtForm({...swStmtForm, stmtCode: e.target.value.toUpperCase().replace(/\s/g, '')})} />
                      <datalist id="sw-stmt-codes">
                        <option value="AQ000">Declaration in respect of all animals and livestock products</option>
                        <option value="AQ001">Undertaking in case of import of live-stock products for trading/marketing</option>
                        <option value="CUG00">General Declaration - I</option>
                        <option value="CUG01">General Declaration - II</option>
                        <option value="CUV01" />
                        <option value="CUV02" />
                        <option value="CUV03" />
                        <option value="PC002" />
                      </datalist>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>Statement Text</label>
                      <input type="text" className="input-field" style={{ width: '100%', border: '1px solid #cbd5e1' }} value={swStmtForm.stmtText} onChange={(e) => setSwStmtForm({...swStmtForm, stmtText: e.target.value})} />
                    </div>
  
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>Statement For</label>
                      <select className="input-field" style={{ width: '100%', border: '1px solid #cbd5e1', color: '#0000ff' }} value={swStmtForm.stmtFor} onChange={(e) => setSwStmtForm({...swStmtForm, stmtFor: e.target.value})}>
                        <option value="Select">Select</option>
                        <option value="BE">BE</option>
                        <option value="Invoice">Invoice</option>
                        <option value="Item">Item</option>
                      </select>
                    </div>
  
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <button onClick={addSwStmtRow} className="btn btn-success" style={{ display: 'flex', alignItems: 'center', background: '#5cb85c', border: 'none', padding: '6px 20px', color: '#fff', fontSize: '14px', borderRadius: '4px', cursor: 'pointer' }}>
                        ADD
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
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Type Code</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Statement Code</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Statement Text</th>
                        <th style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }}>Statement For</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tempSwStmtData.map((row, idx) => (
                          <tr key={idx}>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}><MinusCircle onClick={() => removeSwStmtRow(row.id)} size={14} color="#ef4444" style={{ cursor: 'pointer', fill: '#fee2e2' }} /></td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.typeCode}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.stmtCode}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.stmtText}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: '#334155' }}>{row.stmtFor}</td>
                          </tr>
                      ))}
                      {tempSwStmtData.length === 0 && (
                          <tr><td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No Data Added</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
  
              </div>
              
              <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'var(--bg-panel, #ffffff)', borderTop: '1px solid var(--border-color, #cbd5e1)', borderRadius: '0 0 4px 4px' }}>
                <button className="btn btn-primary" onClick={applySwStatementToAll} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#3b82f6', color: '#fff', padding: '6px 16px', borderRadius: '4px', border: 'none', fontSize: '12px', cursor: 'pointer' }}>
                  <CheckSquare size={14} /> Apply to All in Invoice
                </button>
                <button className="btn btn-success" onClick={saveSwStatementModal} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#5cb85c', color: '#fff', padding: '6px 16px', borderRadius: '4px', border: 'none', fontSize: '12px', cursor: 'pointer' }}>
                  <CheckSquare size={14} /> Ok
                </button>
                <button className="btn btn-danger" onClick={() => setShowSwStatementModal(false)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', color: '#334155', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 16px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Anti Dumping Modal */}


{/* Antidumping Custom Duty Modal */}
    </>
  );
}
