// Screen section: IGST Duty
// Split out of ItemGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { CheckSquare, Edit, MinusCircle, Plus, RefreshCw, X } from 'lucide-react';
import React from 'react';
import { igstBaseFromForm } from '../helpers';

export default function IgstDutySection({ ctx }) {
  const { saveIgstModal, saveSvbModal, setShowIgstModal, setShowSvbModal, setTempIgstData, setTempSvbData, showIgstModal, showSvbModal, tempIgstData, tempSvbData,
    addDutyRow, editDutyRow, removeDutyRow, clearDutyForm, tempDutyRows, dutyForm, setDutyForm, dutyEditIdx } = ctx;
  return (
    <>
    {showIgstModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: 'var(--bg-panel, #fff)', borderRadius: '4px', width: '100%', maxWidth: '880px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'var(--bg-panel, #ffffff)', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main, #334155)', fontWeight: 'normal' }}>IGST Duty / Duty Notifications</h3>
              <X size={18} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setShowIgstModal(false)} />
            </div>

            <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {/* IGST line (rate / amount for the duty calculation) */}
              <div style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                <table style={{ width: '100%', borderSpacing: '4px 6px', borderCollapse: 'separate', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-main, #0f172a)', fontSize: '11px' }}>
                      <th style={{ width: '70px' }}></th><th>NOTN</th><th>SLNO</th><th>RATE %</th><th>FLAG</th><th>AMOUNT</th><th>UQC</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ color: 'var(--text-main, #0f172a)', fontSize: '12px' }}>IGST</td>
                      <td><input type="text" name="notnNo" className="input-field" placeholder="009/2025" value={tempIgstData.notnNo || ''} onChange={(e) => setTempIgstData({...tempIgstData, notnNo: e.target.value})} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                      <td><input type="text" name="srNo" className="input-field" placeholder="II506" value={tempIgstData.srNo || ''} onChange={(e) => setTempIgstData({...tempIgstData, srNo: e.target.value})} style={{ width: '100%', background: '#fef9c3', border: '1px solid #cbd5e1' }} /></td>
                      <td><input type="text" name="rate" className="input-field" value={tempIgstData.rate || ''}
                        onChange={(e) => {
                          // 30-Oct-2026: IGST = rate x (AV + BCD + SWS + health cess + CVD + ADD + AIDC / other duties) - the way ICES adds it up
                          const rate = parseFloat(e.target.value) || 0;
                          const d = igstBaseFromForm(document.getElementById('item-form'), ctx.selectedItem, ctx.invoices, ctx.jobData);
                          const cessRate = parseFloat(tempIgstData.cessRate) || 0;
                          setTempIgstData({...tempIgstData, rate: e.target.value, amount: d.rateFound ? ((rate / 100) * d.igstBase).toFixed(2) : tempIgstData.amount, cessAmount: d.rateFound && cessRate ? ((cessRate / 100) * d.igstBase).toFixed(2) : tempIgstData.cessAmount});
                        }} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                      <td><input type="text" name="flag" className="input-field" value={tempIgstData.flag || ''} onChange={(e) => setTempIgstData({...tempIgstData, flag: e.target.value})} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                      <td><input type="text" name="amount" className="input-field" value={tempIgstData.amount || ''} onChange={(e) => setTempIgstData({...tempIgstData, amount: e.target.value})} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                      <td><input type="text" name="uqc" className="input-field" value={tempIgstData.uqc || ''} onChange={(e) => setTempIgstData({...tempIgstData, uqc: e.target.value})} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-main, #0f172a)', fontSize: '12px' }} title="GST compensation cess (sin / auto goods etc.) - on the same base as IGST; the notification goes in the duty rows below as G / P">Comp. Cess</td>
                      <td colSpan="2" style={{ fontSize: '10px', color: '#64748b' }}>rate % on AV + customs duties (notification: duty row G / P below)</td>
                      <td><input type="text" name="cessRate" className="input-field" value={tempIgstData.cessRate || ''} onChange={(e) => { const cr = parseFloat(e.target.value) || 0; const d = igstBaseFromForm(document.getElementById('item-form'), ctx.selectedItem, ctx.invoices, ctx.jobData); setTempIgstData({ ...tempIgstData, cessRate: e.target.value, cessAmount: d.rateFound && e.target.value !== '' ? ((cr / 100) * d.igstBase).toFixed(2) : '' }); }} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                      <td></td>
                      <td><input type="text" name="cessAmount" className="input-field" value={tempIgstData.cessAmount || ''} onChange={(e) => setTempIgstData({ ...tempIgstData, cessAmount: e.target.value })} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Duty notification row form (sent in the BE JSON as sbedutyModel) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '10px', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                {[
                  ['Duty Type', 'dutyType', [['C', 'C | Custom'], ['G', 'G | GST'], ['E', 'E | Excise']]],
                  ['Add Duty Type', 'addlDutyFlag', [['A', 'A | AIDC'], ['I', 'I | IGST'], ['P', 'P | Compensation Cess'], ['X', 'X | Excise'], ['+', '+ | Plus']]],
                  ['IGST Flag', 'igstFlag', [['', 'Select'], ['G', 'G | GST'], ['C', 'C | Custom']]],
                ].map(([label, key, opts]) => (
                  <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'var(--text-main, #0f172a)' }}>{label}
                    <select className="input-field" value={dutyForm[key] || ''} onChange={(e) => setDutyForm({ ...dutyForm, [key]: e.target.value })} style={{ minWidth: '120px', border: '1px solid #cbd5e1' }}>
                      {opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                  </label>
                ))}
                {[['Notn No', 'notificationNo', '011/2021'], ['Notn Sl No', 'notificationSrNo', '17'], ['Exem Notn No', 'exmpNotificationNo', ''], ['Exem Sl No', 'exmpNotificationSrNo', '']].map(([label, key, ph]) => (
                  <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'var(--text-main, #0f172a)' }}>{label}
                    <input type="text" className="input-field" placeholder={ph} value={dutyForm[key] || ''} onChange={(e) => setDutyForm({ ...dutyForm, [key]: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDutyRow(); } }} style={{ width: '100px', border: '1px solid #cbd5e1' }} />
                  </label>
                ))}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={addDutyRow} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--primary-color-start)', border: 'none', padding: '5px 12px', color: '#fff', fontSize: '11px', borderRadius: '4px', cursor: 'pointer' }}>
                    {dutyEditIdx !== null ? <><Edit size={12}/> Update</> : <><Plus size={12}/> Add</>}
                  </button>
                  <button type="button" onClick={clearDutyForm} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--primary-color-start)', border: 'none', padding: '5px 12px', color: '#fff', fontSize: '11px', borderRadius: '4px', cursor: 'pointer' }}><RefreshCw size={12}/> Clear</button>
                </div>
              </div>

              <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', overflowX: 'auto' }}>
                <table className="data-grid" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                  <thead style={{ background: 'var(--primary-bg-light)' }}>
                    <tr>
                      {['Edit', 'Remove', 'Duty Type', 'Duty Flg', 'IGST Flg', 'Notn', 'Notn Slno', 'Exem Notn no', 'Exem Notn Slno'].map(h => (
                        <th key={h} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', padding: '6px', textAlign: ['Edit', 'Remove'].includes(h) ? 'center' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tempDutyRows.length === 0 && (
                      <tr><td colSpan="9" style={{ padding: '14px', textAlign: 'center', color: '#64748b' }}>No duty notification rows. Add AIDC / IGST / Compensation cess rows above.</td></tr>
                    )}
                    {tempDutyRows.map((row, i) => (
                      <tr key={row._k || i} style={{ background: dutyEditIdx === i ? 'var(--primary-bg-light)' : undefined }}>
                        <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}><Edit size={14} color="var(--primary-color-start)" style={{ cursor: 'pointer' }} onClick={() => editDutyRow(i)} /></td>
                        <td style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}><MinusCircle size={14} color="#ef4444" style={{ cursor: 'pointer', fill: '#fee2e2' }} onClick={() => removeDutyRow(i)} /></td>
                        {['dutyType', 'addlDutyFlag', 'igstFlag', 'notificationNo', 'notificationSrNo', 'exmpNotificationNo', 'exmpNotificationSrNo'].map(k => (
                          <td key={k} style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: 'var(--text-main, #334155)' }}>{row[k]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color, #cbd5e1)' }}>
              <button type="button" className="btn btn-success" onClick={saveIgstModal} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#22c55e', color: '#fff', padding: '6px 16px', borderRadius: '4px', border: 'none', fontSize: '12px', cursor: 'pointer' }}>
                <CheckSquare size={14} /> Ok
              </button>
              <button type="button" className="btn btn-danger" onClick={() => setShowIgstModal(false)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', color: '#334155', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 16px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SVB Modal */}
      {showSvbModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '600px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'var(--bg-panel, #ffffff)', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#334155', fontWeight: 'normal' }}>SVB Loading Item Wise</h3>
              <X size={18} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={saveSvbModal} />
            </div>
            
            <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 100px 1fr', gap: '10px', alignItems: 'center' }}>
                <label style={{ color: 'var(--text-main, var(--text-main, #0f172a))', fontSize: '12px' }}>Ref No.</label>
                <input type="text" name="refNo" className="input-field" value={tempSvbData.refNo || ''} onChange={(e) => setTempSvbData({...tempSvbData, [e.target.name]: e.target.value})} style={{ width: '150px', border: '1px solid #ef4444' }} />
                
                <label style={{ color: 'var(--text-main, var(--text-main, #0f172a))', fontSize: '12px', textAlign: 'right', paddingRight: '10px' }}>Custom House</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input type="text" name="customHouse1" className="input-field" value={tempSvbData.customHouse1 || ''} onChange={(e) => setTempSvbData({...tempSvbData, [e.target.name]: e.target.value})} style={{ width: '120px', background: '#f0fdf4', border: '1px solid #ef4444' }} />
                  {/* 30-Oct-2026: the second Custom House box is gone - the BE carries one customHouseCodeWhichHasImposedLoad (the box on the left) */}
                </div>
                
                <label style={{ color: 'var(--text-main, var(--text-main, #0f172a))', fontSize: '12px' }}>Date</label>
                <input type="text" name="date" className="input-field" value={tempSvbData.date || ''} onChange={(e) => setTempSvbData({...tempSvbData, [e.target.name]: e.target.value})} style={{ width: '150px', border: '1px solid #ef4444' }} />
                <div style={{ gridColumn: '3 / span 2' }}></div>

                <label style={{ color: 'var(--text-main, var(--text-main, #0f172a))', fontSize: '12px', gridColumn: 'span 2' }}>SVB load on ass. value/duty/both[A/D/B]</label>
                <input type="text" name="loadType" data-allow-text maxLength={1} placeholder="A/D/B" className="input-field" value={tempSvbData.loadType || ''} onChange={(e) => setTempSvbData({...tempSvbData, [e.target.name]: e.target.value.toUpperCase().replace(/[^ADB]/g, '')})} style={{ width: '50px', border: '1px solid #ef4444', textAlign: 'center' }} />
                <div></div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--text-main, var(--text-main, #0f172a))', fontWeight: 'bold' }}>SVB load On</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 100px 120px 60px 40px', gap: '10px', alignItems: 'center' }}>
                  <label style={{ color: 'var(--text-main, var(--text-main, #0f172a))', fontSize: '12px' }}>Ass. Value(%)</label>
                  <input type="text" name="loadValue" className="input-field" value={tempSvbData.loadValue || ''} onChange={(e) => setTempSvbData({...tempSvbData, [e.target.name]: e.target.value})} style={{ width: '100px', border: '1px solid #cbd5e1', color: '#0000ff' }} />
                  <label style={{ color: 'var(--text-main, var(--text-main, #0f172a))', fontSize: '12px', textAlign: 'right', paddingRight: '10px' }}>SVB Load Status</label>
                  <input type="text" name="valueStatus" className="input-field" value={tempSvbData.valueStatus || ''} onChange={(e) => setTempSvbData({...tempSvbData, [e.target.name]: e.target.value})} style={{ width: '50px', border: '1px solid #cbd5e1' }} />
                  <span style={{ fontSize: '12px', color: '#334155' }}>[F/P]</span>

                  <label style={{ color: 'var(--text-main, var(--text-main, #0f172a))', fontSize: '12px' }}>Duty(%)</label>
                  <input type="text" name="loadDuty" className="input-field" value={tempSvbData.loadDuty || ''} onChange={(e) => setTempSvbData({...tempSvbData, [e.target.name]: e.target.value})} style={{ width: '100px', border: '1px solid #cbd5e1', color: '#0000ff' }} />
                  <label style={{ color: 'var(--text-main, var(--text-main, #0f172a))', fontSize: '12px', textAlign: 'right', paddingRight: '10px' }}>SVB Load Status</label>
                  <input type="text" name="dutyStatus" className="input-field" value={tempSvbData.dutyStatus || ''} onChange={(e) => setTempSvbData({...tempSvbData, [e.target.name]: e.target.value})} style={{ width: '50px', border: '1px solid #cbd5e1' }} />
                  <span style={{ fontSize: '12px', color: '#334155' }}>[F/P]</span>
                </div>
              </div>
            </div>
            
            <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'var(--bg-panel, #ffffff)', borderTop: '1px solid var(--border-color, #cbd5e1)', borderRadius: '0 0 4px 4px' }}>
              <button type="button" className="btn btn-success" onClick={saveSvbModal} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#5cb85c', color: '#fff', padding: '6px 16px', borderRadius: '4px', border: 'none', fontSize: '12px', cursor: 'pointer' }}>
                <CheckSquare size={14} /> Ok
              </button>
              <button className="btn btn-danger" onClick={() => setShowSvbModal(false)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', color: '#334155', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 16px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheme Code Category Modal */}
    </>
  );
}
