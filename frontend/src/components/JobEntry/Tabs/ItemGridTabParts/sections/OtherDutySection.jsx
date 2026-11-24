// Screen section: Other Duty
// Split out of ItemGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { CheckSquare, Info, X } from 'lucide-react';
import React from 'react';

export default function OtherDutySection({ ctx }) {
  const { saveCustomsCvdModal, saveOtherDutyModal, savePolicyParaModal, savePreviousBeModal, setShowCustomsCvdModal, setShowOtherDutyModal, setShowPolicyParaModal, setShowPortSearchModal, setShowPreviousBeModal, setTempCvdData, setTempOtherDutyData, setTempPolicyParaData, setTempPrevBeData, showCustomsCvdModal, showOtherDutyModal, showPolicyParaModal, showPreviousBeModal, tempCvdData, tempOtherDutyData, tempPolicyParaData, tempPrevBeData } = ctx;
  return (
    <>
    {showOtherDutyModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '850px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#334155', fontWeight: 'normal' }}>Other Duty</h3>
              <X size={18} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setShowOtherDutyModal(false)} />
            </div>
            
            <div style={{ padding: '15px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ border: '1px solid #93c5fd', padding: '15px', borderRadius: '4px', background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', fontWeight: 'normal', fontSize: '14px', color: '#0f172a', paddingBottom: '10px' }}>Duty</th>
                      <th style={{ textAlign: 'left', fontWeight: 'normal', fontSize: '14px', color: '#0f172a', paddingBottom: '10px' }}>Notn No</th>
                      <th style={{ textAlign: 'left', fontWeight: 'normal', fontSize: '14px', color: '#0f172a', paddingBottom: '10px' }}>Serial No</th>
                      <th style={{ textAlign: 'left', fontWeight: 'normal', fontSize: '14px', color: '#0f172a', paddingBottom: '10px' }}>Flag</th>
                      <th style={{ textAlign: 'left', fontWeight: 'normal', fontSize: '14px', color: '#0f172a', paddingBottom: '10px' }}>Adv.Rate</th>
                      <th style={{ textAlign: 'left', fontWeight: 'normal', fontSize: '14px', color: '#0f172a', paddingBottom: '10px' }}>Spec.Amt</th>
                      <th style={{ textAlign: 'left', fontWeight: 'normal', fontSize: '14px', color: '#0f172a', paddingBottom: '10px' }}>UQC</th>
                      <th style={{ textAlign: 'left', fontWeight: 'normal', fontSize: '14px', color: '#0f172a', paddingBottom: '10px' }}>Duty Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      'Add1(SIA)', 'Add2(S2)', 'Other(TTA)', 'Cess', 
                      'Health', 'Aggregate', 'Safe Guard', 'Infra Cess'
                    ].map((dutyName) => (
                      <tr key={dutyName}>
                        <td style={{ fontSize: '13px', color: '#0f172a' }}>{dutyName}</td>
                        <td><input type="text" name={`${dutyName}_notnNo`} className="input-field" value={tempOtherDutyData[`${dutyName}_notnNo`] || ''} onChange={(e) => setTempOtherDutyData({...tempOtherDutyData, [e.target.name]: e.target.value})} style={{ width: '80px', background: '#fef9c3', border: '1px solid #0d9488' }} /></td>
                        <td><input type="text" name={`${dutyName}_srNo`} className="input-field" value={tempOtherDutyData[`${dutyName}_srNo`] || ''} onChange={(e) => setTempOtherDutyData({...tempOtherDutyData, [e.target.name]: e.target.value})} style={{ width: '80px', background: '#fef9c3', border: '1px solid #0d9488' }} /></td>
                        <td><input type="text" name={`${dutyName}_flag`} className="input-field" value={tempOtherDutyData[`${dutyName}_flag`] || ''} onChange={(e) => setTempOtherDutyData({...tempOtherDutyData, [e.target.name]: e.target.value})} style={{ width: '60px', border: '1px solid #0d9488' }} /></td>
                        <td><input type="text" name={`${dutyName}_rate`} className="input-field" value={tempOtherDutyData[`${dutyName}_rate`] || ''} onChange={(e) => setTempOtherDutyData({...tempOtherDutyData, [e.target.name]: e.target.value})} style={{ width: '60px', border: '1px solid #0d9488' }} /></td>
                        <td><input type="text" name={`${dutyName}_amount`} className="input-field" value={tempOtherDutyData[`${dutyName}_amount`] || ''} onChange={(e) => setTempOtherDutyData({...tempOtherDutyData, [e.target.name]: e.target.value})} style={{ width: '70px', border: '1px solid #0d9488' }} /></td>
                        <td><input type="text" name={`${dutyName}_uqc`} className="input-field" value={tempOtherDutyData[`${dutyName}_uqc`] || ''} onChange={(e) => setTempOtherDutyData({...tempOtherDutyData, [e.target.name]: e.target.value})} style={{ width: '60px', border: '1px solid #0d9488' }} /></td>
                        <td><input type="text" name={`${dutyName}_dutyAmount`} className="input-field" value={tempOtherDutyData[`${dutyName}_dutyAmount`] || ''} onChange={(e) => setTempOtherDutyData({...tempOtherDutyData, [e.target.name]: e.target.value})} style={{ width: '80px', border: '1px solid #0d9488' }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 4px 4px' }}>
              <button className="btn btn-success" onClick={saveOtherDutyModal} style={{ display: 'flex', alignItems: 'center', background: '#5cb85c', color: '#fff', padding: '6px 20px', borderRadius: '4px', border: 'none', fontSize: '14px', cursor: 'pointer' }}>
                OK
              </button>
              <button className="btn btn-danger" onClick={() => setShowOtherDutyModal(false)} style={{ display: 'flex', alignItems: 'center', background: '#fff', color: '#334155', border: '1px solid #cbd5e1', padding: '6px 20px', borderRadius: '4px', fontSize: '14px', cursor: 'pointer' }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customs CVD Modal */}
      {showCustomsCvdModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '650px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#334155', fontWeight: 'normal' }}>Customs CVD Levy</h3>
              <X size={18} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setShowCustomsCvdModal(false)} />
            </div>
            
            <div style={{ padding: '15px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ border: '1px solid #93c5fd', padding: '15px', borderRadius: '4px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 120px 1fr', gap: '15px 10px', alignItems: 'center' }}>
                  <label style={{ color: '#0f172a', fontSize: '14px' }}>CVD Levy Type</label>
                  <select name="type" className="input-field" value={tempCvdData.type || ''} onChange={(e) => setTempCvdData({...tempCvdData, [e.target.name]: e.target.value})} style={{ width: '100%', border: '2px solid #0d9488', color: '#0000ff' }}>
                    <option>Based On Assessable</option>
                    <option>Based On Landed Cost</option>
                    <option>Based On CIF Value</option>
                    <option>Based On Quantity</option>
                  </select>
                  <div style={{ gridColumn: '3 / span 2' }}></div>
                  
                  <label style={{ color: '#0f172a', fontSize: '14px' }}>Notification No</label>
                  <input type="text" name="notnNo" className="input-field" style={{ width: '100%', background: '#fef9c3', border: '1px solid #0d9488' }} value={tempCvdData.notnNo || ''} onChange={e => setTempCvdData({...tempCvdData, [e.target.name]: e.target.value})} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px', paddingLeft: '15px' }}>CTH Serial No</label>
                  <input type="text" name="cth" className="input-field" style={{ width: '100%', background: '#fef9c3', border: '1px solid #0d9488' }} value={tempCvdData.cth || ''} onChange={e => setTempCvdData({...tempCvdData, [e.target.name]: e.target.value})} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px' }}>Serial No</label>
                  <input type="text" name="srNo" className="input-field" style={{ width: '100%', border: '1px solid #0d9488' }} value={tempCvdData.srNo || ''} onChange={e => setTempCvdData({...tempCvdData, [e.target.name]: e.target.value})} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px', paddingLeft: '15px' }}>Supplier Sl No</label>
                  <input type="text" name="supSlNo" className="input-field" style={{ width: '100%', border: '1px solid #ef4444' }} value={tempCvdData.supSlNo || ''} onChange={e => setTempCvdData({...tempCvdData, [e.target.name]: e.target.value})} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px' }}>Advalorem Rate</label>
                  <input type="text" name="rate" className="input-field" style={{ width: '100%', border: '1px solid #0d9488' }} value={tempCvdData.rate || ''} onChange={e => setTempCvdData({...tempCvdData, [e.target.name]: e.target.value})} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px', paddingLeft: '15px' }}>Flag</label>
                  <input type="text" name="flag" className="input-field" style={{ width: '100%', border: '1px solid #0d9488' }} value={tempCvdData.flag || ''} onChange={e => setTempCvdData({...tempCvdData, [e.target.name]: e.target.value})} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px' }}>Quantity</label>
                  <input type="text" name="qty" className="input-field" style={{ width: '100%', border: '1px solid #0d9488' }} value={tempCvdData.qty || ''} onChange={e => setTempCvdData({...tempCvdData, [e.target.name]: e.target.value})} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px', paddingLeft: '15px' }}>UQC</label>
                  <input list="uqc-list" type="text" name="uqc" className="input-field" style={{ width: '100%', border: '1px solid #0d9488' }} value={tempCvdData.uqc || ''} onChange={e => setTempCvdData({...tempCvdData, [e.target.name]: e.target.value})} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px' }}>Specific Amt</label>
                  <input type="text" name="amount" className="input-field" style={{ width: '100%', border: '1px solid #0d9488' }} value={tempCvdData.amount || ''} onChange={e => setTempCvdData({...tempCvdData, [e.target.name]: e.target.value})} />
                </div>
              </div>
            </div>
            
            <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 4px 4px' }}>
              <button className="btn btn-success" onClick={saveCustomsCvdModal} style={{ display: 'flex', alignItems: 'center', background: '#5cb85c', color: '#fff', padding: '6px 20px', borderRadius: '4px', border: 'none', fontSize: '14px', cursor: 'pointer' }}>
                OK
              </button>
              <button className="btn btn-danger" onClick={() => setShowCustomsCvdModal(false)} style={{ display: 'flex', alignItems: 'center', background: '#fff', color: '#334155', border: '1px solid #cbd5e1', padding: '6px 20px', borderRadius: '4px', fontSize: '14px', cursor: 'pointer' }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Policy Para Modal */}
      {showPolicyParaModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '500px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'var(--primary-bg-light)', borderBottom: '1px solid var(--primary-border)', borderRadius: '4px 4px 0 0' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--primary-text)', fontWeight: 'normal' }}>Policy Para Details</h3>
            </div>
            
            <div style={{ padding: '20px 15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', alignItems: 'center' }}>
                <label style={{ color: '#0f172a', fontSize: '14px' }}>Policy Para No</label>
                <input type="text" name="paraNo" className="input-field" value={tempPolicyParaData.paraNo || ''} onChange={(e) => setTempPolicyParaData({...tempPolicyParaData, [e.target.name]: e.target.value})} style={{ width: '150px', border: '2px solid #ef4444', color: '#0000ff' }} />
                
                <label style={{ color: '#0f172a', fontSize: '14px' }}>Policy Year</label>
                <input type="text" name="year" className="input-field" value={tempPolicyParaData.year || ''} onChange={(e) => setTempPolicyParaData({...tempPolicyParaData, [e.target.name]: e.target.value})} style={{ width: '150px', border: '1px solid #ef4444', color: '#0000ff' }} />
              </div>
            </div>
            
            <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#fff', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 4px 4px' }}>
              <button className="btn btn-success" onClick={savePolicyParaModal} style={{ display: 'flex', alignItems: 'center', background: '#5cb85c', color: '#fff', padding: '6px 20px', borderRadius: '4px', border: 'none', fontSize: '14px', cursor: 'pointer' }}>
                OK
              </button>
              <button className="btn btn-danger" onClick={() => setShowPolicyParaModal(false)} style={{ display: 'flex', alignItems: 'center', background: '#fff', color: '#334155', border: '1px solid #cbd5e1', padding: '6px 20px', borderRadius: '4px', fontSize: '14px', cursor: 'pointer' }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Previous Import Details Modal */}
      {showPreviousBeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '800px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#334155', fontWeight: 'normal' }}>Previous Import Details</h3>
            </div>
            
            <div style={{ padding: '15px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ border: '1px solid #93c5fd', padding: '15px', borderRadius: '4px', background: '#fff' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 180px 1fr', gap: '15px 10px', alignItems: 'center' }}>
                  
                  <label style={{ color: '#0f172a', fontSize: '14px' }}>Previous BE No</label>
                  <input type="text" name="beNo" className="input-field" style={{ width: '100%', border: '2px solid #ef4444' }} value={tempPrevBeData.beNo || ''} onChange={e => setTempPrevBeData({...tempPrevBeData, [e.target.name]: e.target.value})} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px', paddingLeft: '20px' }}>Previous BE Date</label>
                  <input type="text" name="beDate" className="input-field" style={{ width: '100%', border: '1px solid #ef4444' }} value={tempPrevBeData.beDate || ''} onChange={e => setTempPrevBeData({...tempPrevBeData, [e.target.name]: e.target.value})} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px' }}>Previous Unit Price</label>
                  <input type="text" name="unitPrice" className="input-field" style={{ width: '100%', border: '1px solid #0d9488' }} value={tempPrevBeData.unitPrice || ''} onChange={e => setTempPrevBeData({...tempPrevBeData, [e.target.name]: e.target.value})} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px', paddingLeft: '20px' }}>Previous Currency Code</label>
                  <input list="currency-list" type="text" name="currency" className="input-field" style={{ width: '100%', border: '1px solid #0d9488' }} value={tempPrevBeData.currency || ''} onChange={e => setTempPrevBeData({...tempPrevBeData, [e.target.name]: e.target.value})} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px' }}>Previous Custom House</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input type="text" name="customHouse" className="input-field" style={{ width: '100%', background: '#fef9c3', border: '1px solid #ef4444' }} value={tempPrevBeData.customHouse || ''} onChange={e => setTempPrevBeData({...tempPrevBeData, [e.target.name]: e.target.value})} />
                    <Info size={16} color="#0000ff" style={{ cursor: 'pointer', fill: '#dbeafe' }} onClick={() => setShowPortSearchModal(true)} />
                  </div>
                  
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600 }}>Quantity</label>
                  <input type="number" value={tempPrevBeData.qty || ''}
                    onChange={e => setTempPrevBeData({...tempPrevBeData, qty: e.target.value})}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600 }}>UQC</label>
                  <input type="text" value={tempPrevBeData.uqc || ''}
                    onChange={e => setTempPrevBeData({...tempPrevBeData, uqc: e.target.value})}
                    list="uqc-list"
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} />
                </div>
              </div>
            </div>
            
            <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 4px 4px' }}>
              <button className="btn btn-success" onClick={savePreviousBeModal} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#5cb85c', color: '#fff', padding: '6px 16px', borderRadius: '4px', border: 'none', fontSize: '14px', cursor: 'pointer' }}>
                <CheckSquare size={14} /> Ok
              </button>
              <button className="btn btn-danger" onClick={() => setShowPreviousBeModal(false)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', color: '#334155', border: '1px solid #cbd5e1', padding: '6px 16px', borderRadius: '4px', fontSize: '14px', cursor: 'pointer' }}>
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Port Search Modal */}
    </>
  );
}
