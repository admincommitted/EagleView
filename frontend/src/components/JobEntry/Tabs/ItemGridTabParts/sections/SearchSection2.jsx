// Screen section: Search
// Split out of ItemGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { CheckSquare, X } from 'lucide-react';
import React from 'react';

export default function SearchSection2({ ctx }) {
  const { saveReimportModal, saveRspModal, saveNcdModal, masters, setShowNcdModal, setShowReimportModal, setShowRspModal, setTempNcdData, setTempReimportData, setTempRspData, showNcdModal, showReimportModal, showRspModal, tempNcdData, tempReimportData, tempRspData , addRspRow, editRspRow, removeRspRow, tempRspRows, rspEditIdx, selectedItem} = ctx;
  return (
    <>
    {/* 30-Oct-2026: the "Search" popup that stood here was a shell - its radio buttons did nothing, its
        result was never written anywhere and nothing could open it (openPortSearchModal was never wired).
        The working code searches are the CTH / CETH / RITC / Scheme windows above. */}

    
      {masters && (
        <>
          <datalist id="country-list">{masters.countries?.map(c => <option key={c.id} value={c.code}>{c.name}</option>)}</datalist>
          <datalist id="currency-list">{masters.currencies?.map(c => <option key={c.id} value={c.currencyCode}>{c.currencyName}</option>)}</datalist>
          <datalist id="uqc-list">{masters.uqcs?.map(c => <option key={c.id} value={c.uqcCode}>{c.description}</option>)}</datalist>
          <datalist id="scheme-list">{masters.schemeCodes?.map(c => <option key={c.code} value={c.code}>{c.desc}</option>)}</datalist>
          <datalist id="state-list">{masters.states?.map(c => <option key={c.id} value={c.stateName}>{c.stateCode} - GST {c.taxCode}</option>)}</datalist>
          <datalist id="state-taxcode-list">{masters.states?.map(c => <option key={c.id} value={c.taxCode}>{c.stateName}</option>)}</datalist>
        </>
      )}

      {showReimportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '1.5rem', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h4 style={{marginTop:0}}>Re-Import Details</h4>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:'10px'}}>
              <div>
                <label style={{display:'block', fontSize:'12px'}}>Re-Import Type</label>
                <select className="input-field" value={tempReimportData?.type || ''} onChange={e => setTempReimportData({...tempReimportData, type: e.target.value})} style={{width:'100%', border:'1px solid #cbd5e1'}}>
                  <option value="">Select...</option>
                  <option value="Y">Y - Yes</option>
                  <option value="N">N - No</option>
                </select>
              </div>
              {/* Re-import = goods exported earlier and brought back: ICEGATE wants the export Shipping Bill details (reimportModel).
                  The old boxes asked for a "previous BE". Old saved values (prevBeNo...) are shown in the SB boxes. 28-Oct-2026 */}
              {[
                ['shippingBillNo', 'Shipping Bill No', 'prevBeNo'], ['shippingBillDate', 'Shipping Bill Date', 'prevBeDate', 'date'],
                ['portOfExport', 'Port of Export', 'prevCustomHouseCode'], ['invoiceNoSb', 'Invoice Sr No in SB'], ['itemNoSb', 'Item Sr No in SB'],
                ['notificationNo', 'Re-import Notification No'], ['notificationSrNo', 'Notification Sr No'],
                ['exportFreight', 'Export Freight'], ['exportInsurance', 'Export Insurance'], ['customsDuty', 'Drawback / Customs Duty availed'], ['exciseDuty', 'Excise Duty / IGST refund availed'],
                ['reasonForReimport', 'Reason for Re-import'],
              ].map(([k, label, old, type]) => (
                <div key={k}>
                  <label style={{display:'block', fontSize:'12px'}}>{label}</label>
                  <input type={type || 'text'} className="input-field" value={tempReimportData?.[k] ?? (old ? tempReimportData?.[old] : '') ?? ''}
                    onChange={e => setTempReimportData({...tempReimportData, [k]: e.target.value})} style={{width:'100%', border:'1px solid #cbd5e1'}} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent:'flex-end' }}>
              <button className="btn btn-success" onClick={saveReimportModal} style={{background:'#22c55e', color:'#fff', padding:'6px 12px', border:'none', borderRadius:'4px'}}>Save</button>
              <button className="btn btn-danger" onClick={() => setShowReimportModal(false)} style={{background:'#fff', color:'#334155', border:'1px solid #cbd5e1', padding:'6px 12px', borderRadius:'4px'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showRspModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '1.5rem', width: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h4 style={{marginTop:0}}>RSP Duty Details <span style={{ fontSize: '11px', fontWeight: 400, color: '#64748b' }}>one line per retail sale price (MRP slab) of this item</span></h4>
            <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
              <div>
                <label style={{display:'block', fontSize:'12px'}}>RSP Duty Flag</label>
                <select className="input-field" value={tempRspData?.rspDutyFlag || ''} onChange={e => setTempRspData({...tempRspData, rspDutyFlag: e.target.value})} style={{width:'100%', border:'1px solid #cbd5e1'}}>
                  <option value="">Select...</option>
                  <option value="Y">Y - Yes RSP applicable</option>
                  <option value="S">S - Scheme (exempted)</option>
                  <option value="N">N - Not applicable</option>
                  <option value="Q">Q - Quantitative restriction</option>
                  <option value="T">T - Temporary exemption</option>
                  <option value="D">D - Deemed import</option>
                </select>
              </div>
              <div>
                <label style={{display:'block', fontSize:'12px'}}>RSP Value</label>
                <input type="number" className="input-field" value={tempRspData?.rspValue || ''} onChange={e => setTempRspData({...tempRspData, rspValue: e.target.value})} style={{width:'100%', border:'1px solid #cbd5e1'}} />
              </div>
              <div>
                <label style={{display:'block', fontSize:'12px'}}>Quantity at this RSP</label>
                <input type="number" className="input-field" placeholder={selectedItem?.qty ? ('blank = all ' + selectedItem.qty) : 'blank = whole item quantity'} value={tempRspData?.rspQty || ''} onChange={e => setTempRspData({...tempRspData, rspQty: e.target.value})} style={{width:'100%'}} />
              </div>
              <div>
                <label style={{display:'block', fontSize:'12px'}}>RSP Notification No</label>
                <input type="text" className="input-field" value={tempRspData?.rspNotificationNo || ''} onChange={e => setTempRspData({...tempRspData, rspNotificationNo: e.target.value})} style={{width:'100%', border:'1px solid #cbd5e1'}} />
              </div>
              <div>
                <label style={{display:'block', fontSize:'12px'}}>RSP Sr No</label>
                <input type="text" className="input-field" value={tempRspData?.rspSrNo || ''} onChange={e => setTempRspData({...tempRspData, rspSrNo: e.target.value})} style={{width:'100%', border:'1px solid #cbd5e1'}} />
              </div>
              <div>
                <label style={{display:'block', fontSize:'12px'}}>RSP Rate</label>
                <input type="number" className="input-field" value={tempRspData?.rspRate || ''} onChange={e => setTempRspData({...tempRspData, rspRate: e.target.value})} style={{width:'100%', border:'1px solid #cbd5e1'}} />
              </div>
              <div>
                <label style={{display:'block', fontSize:'12px'}}>RSP Amount</label>
                <input type="number" className="input-field" value={tempRspData?.rspAmount || ''} onChange={e => setTempRspData({...tempRspData, rspAmount: e.target.value})} style={{width:'100%', border:'1px solid #cbd5e1'}} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button type="button" onClick={addRspRow} style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', padding: '5px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                {rspEditIdx !== null ? 'Update line ' + (rspEditIdx + 1) : '+ Add line'}
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '8px', border: '1px solid #cbd5e1' }}>
              <thead style={{ background: '#f1f5f9' }}>
                <tr><th style={{ padding: '4px', textAlign: 'right' }}>RSP</th><th style={{ padding: '4px', textAlign: 'right' }}>Qty</th><th style={{ padding: '4px', textAlign: 'left' }}>Notification</th><th style={{ padding: '4px', textAlign: 'left' }}>Sr No</th><th style={{ padding: '4px', textAlign: 'right' }}>Rate</th><th style={{ padding: '4px', textAlign: 'right' }}>Amount</th><th style={{ padding: '4px', width: '60px' }} /></tr>
              </thead>
              <tbody>
                {(tempRspRows || []).length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '10px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>No RSP line yet - fill the boxes above and press "Add line"</td></tr>
                ) : (tempRspRows || []).map((r, i) => (
                  <tr key={r.id || i} style={{ borderTop: '1px solid #e2e8f0', background: rspEditIdx === i ? '#fef9c3' : '#fff' }}>
                    <td style={{ padding: '4px', textAlign: 'right' }}>{r.rspValue}</td>
                    <td style={{ padding: '4px', textAlign: 'right' }}>{r.rspQty || 'all'}</td>
                    <td style={{ padding: '4px' }}>{r.rspNotificationNo}</td>
                    <td style={{ padding: '4px' }}>{r.rspSrNo}</td>
                    <td style={{ padding: '4px', textAlign: 'right' }}>{r.rspRate}</td>
                    <td style={{ padding: '4px', textAlign: 'right' }}>{r.rspAmount}</td>
                    <td style={{ padding: '4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button type="button" title="Edit" onClick={() => editRspRow(i)} style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer' }}>edit</button>
                      <button type="button" title="Remove" onClick={() => removeRspRow(i)} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer' }}>x</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent:'flex-end' }}>
              <button className="btn btn-success" onClick={saveRspModal} style={{background:'#22c55e', color:'#fff', padding:'6px 12px', border:'none', borderRadius:'4px'}}>Save</button>
              <button className="btn btn-danger" onClick={() => setShowRspModal(false)} style={{background:'#fff', color:'#334155', border:'1px solid #cbd5e1', padding:'6px 12px', borderRadius:'4px'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showNcdModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '1.5rem', width: '400px' }}>
            <h4 style={{marginTop:0}}>NCD Custom Duty Details</h4>
            <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
              <div>
                <label style={{display:'block', fontSize:'12px'}}>NCD Notification No</label>
                <input type="text" className="input-field" value={tempNcdData?.ncdNotificationNo || ''} onChange={e => setTempNcdData({...tempNcdData, ncdNotificationNo: e.target.value})} style={{width:'100%', border:'1px solid #cbd5e1'}} />
              </div>
              <div>
                <label style={{display:'block', fontSize:'12px'}}>NCD Sr No</label>
                <input type="text" className="input-field" value={tempNcdData?.ncdSrNo || ''} onChange={e => setTempNcdData({...tempNcdData, ncdSrNo: e.target.value})} style={{width:'100%', border:'1px solid #cbd5e1'}} />
              </div>
              <div>
                <label style={{display:'block', fontSize:'12px'}}>NCD Rate</label>
                <input type="number" className="input-field" value={tempNcdData?.ncdRate || ''} onChange={e => setTempNcdData({...tempNcdData, ncdRate: e.target.value})} style={{width:'100%', border:'1px solid #cbd5e1'}} />
              </div>
              <div>
                <label style={{display:'block', fontSize:'12px'}}>NCD Flag</label>
                <select className="input-field" value={tempNcdData?.ncdFlag || ''} onChange={e => setTempNcdData({...tempNcdData, ncdFlag: e.target.value})} style={{width:'100%', border:'1px solid #cbd5e1'}}>
                  <option value="">Select...</option>
                  <option value="A">A - Advalorem</option>
                  <option value="S">S - Specific</option>
                  <option value="B">B - Both</option>
                </select>
              </div>
              <div>
                <label style={{display:'block', fontSize:'12px'}}>NCD Amount</label>
                <input type="number" className="input-field" value={tempNcdData?.ncdAmount || ''} onChange={e => setTempNcdData({...tempNcdData, ncdAmount: e.target.value})} style={{width:'100%', border:'1px solid #cbd5e1'}} />
              </div>
              <div>
                <label style={{display:'block', fontSize:'12px'}}>NCD Unit</label>
                <input type="text" className="input-field" value={tempNcdData?.ncdUnit || ''} onChange={e => setTempNcdData({...tempNcdData, ncdUnit: e.target.value})} style={{width:'100%', border:'1px solid #cbd5e1'}} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent:'flex-end' }}>
              <button className="btn btn-success" onClick={saveNcdModal} style={{background:'#22c55e', color:'#fff', padding:'6px 12px', border:'none', borderRadius:'4px'}}>Save</button>
              <button className="btn btn-danger" onClick={() => setShowNcdModal(false)} style={{background:'#fff', color:'#334155', border:'1px solid #cbd5e1', padding:'6px 12px', borderRadius:'4px'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
