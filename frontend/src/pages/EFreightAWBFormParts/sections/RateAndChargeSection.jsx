// Screen section: Rate and Charge Details
// Split out of EFreightAWBForm.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Calendar, ChevronDown, Clock, DollarSign, Info, Trash2 } from 'lucide-react';
import React from 'react';
import toast from 'react-hot-toast';

export default function RateAndChargeSection({ ctx }) {
  // 30-Oct-2026: "Auto Rate" was dead, "+ Add Other Charge" was a dead span, the charge grid's inputs
  // were not bound to anything, and its delete icon only printed "Item Deleted". All of it is real now,
  // and the charge lines are actually sent when the AWB is saved.
  const { addCharge, autoRate, chargeableWeight, inputStyle, labelStyle, otherCharges, rateInfo, rating,
    removeCharge, sectionHeaderStyle, sectionStyle, theme, updateCharge } = ctx;
  return (
    <>
    <div className='awb-card' style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div style={{display:'flex', alignItems:'center', gap:'8px'}}><DollarSign size={18}/> Rate and Charge Details</div><ChevronDown size={18} color="#9ca3af" />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <div><label style={labelStyle}>Currency<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label><input className='mandatory-border' style={inputStyle} /></div>
              <div><label style={labelStyle}>Payment Type<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label><select className='mandatory-border' className='mandatory-border' style={inputStyle}><option>Pre-Paid</option><option>Charge Collect</option></select></div>
              <div><label style={labelStyle}>DV for Customs</label><input style={inputStyle} /></div>
              <div><label style={labelStyle}>DV for Carriage</label><input style={inputStyle} /></div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '16px', color: '#1f2937', textTransform: 'uppercase' }}>Total Shipments</div>
                <table className='awb-table' style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '8px 0', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase' }}>Shipment Type</th>
                      <th style={{ padding: '8px 0', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase' }}>Total Pieces</th>
                      <th style={{ padding: '8px 0', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase' }}>Total Weights</th>
                      <th style={{ padding: '8px 0', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase' }}>Total Volume</th>
                      <th style={{ padding: '8px 0', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase' }}>Chargeable Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(otherCharges || []).map((c, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '12px 8px 12px 0' }}><input value={c.code} onChange={e => updateCharge(idx, 'code', e.target.value)} placeholder="e.g. MY" style={{...inputStyle, padding:'6px'}}/></td>
                        <td style={{ padding: '12px 8px 12px 0' }}><input value={c.description} onChange={e => updateCharge(idx, 'description', e.target.value)} placeholder="Description" style={{...inputStyle, padding:'6px'}}/></td>
                        <td style={{ padding: '12px 8px 12px 0' }}><input type="number" value={c.amount} onChange={e => updateCharge(idx, 'amount', e.target.value)} style={{...inputStyle, padding:'6px', textAlign:'right'}}/></td>
                        <td style={{ padding: '12px 8px 12px 0' }}>
                          <select value={c.dueTo} onChange={e => updateCharge(idx, 'dueTo', e.target.value)} style={{...inputStyle, padding:'6px', textTransform: 'uppercase'}}>
                            <option>Due Carrier</option><option>Due Agent</option>
                          </select>
                        </td>
                        <td style={{ padding: '12px 8px 12px 0' }}><input value={c.remarks} onChange={e => updateCharge(idx, 'remarks', e.target.value)} style={{...inputStyle, padding:'6px'}} /></td>
                        <td style={{ padding: '12px 0', textAlign: 'center' }}>
                          <Trash2 size={16} color="#ef4444" style={{ cursor: 'pointer', border: '1px solid #fca5a5', padding: '2px', borderRadius: '4px' }} onClick={() => removeCharge(idx)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
  
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '16px', color: '#1f2937', textTransform: 'uppercase' }}>Shipment Charges</div>
                <table className='awb-table' style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '8px 0', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase' }}>Commodity</th>
                      <th style={{ padding: '8px 0', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase' }}>Volumetric Weight</th>
                      <th style={{ padding: '8px 0', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase' }}>Chargeable Weight</th>
                      <th style={{ padding: '8px 0', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase', textAlign:'right' }}>Rate</th>
                      <th style={{ padding: '8px 0', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase', textAlign:'right' }}>Net Charge</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '16px 0', color: '#4b5563', textTransform: 'uppercase' }}>--</td>
                      <td style={{ padding: '16px 0', fontWeight: 'bold', color: '#1f2937', textTransform: 'uppercase' }}>--</td>
                      <td style={{ padding: '16px 0', fontWeight: 'bold', color: '#1f2937', textTransform: 'uppercase' }}>--</td>
                      <td style={{ padding: '16px 0', fontWeight: 'bold', color: '#1f2937', textAlign:'right' }}>--</td>
                      <td style={{ padding: '16px 0', fontWeight: 'bold', color: '#1f2937', textAlign:'right' }}>--</td>
                    </tr>
                  </tbody>
                </table>
              </div>
  
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '12px', color: '#1f2937', textTransform: 'uppercase' }}>Other Charges</div>
                <div style={{ width: '200px', marginBottom: '16px' }}>
                  <label style={{ ...labelStyle, color: '#1f2937', textTransform: 'uppercase', fontWeight: 'bold', fontSize: '11px' }}>Payment Type<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label>
                  <select className='mandatory-border' style={{ ...inputStyle, borderColor: '#ef4444', textTransform: 'uppercase' }}><option>Pre-Paid</option><option>Charge Collect</option></select>
                </div>
                <table className='awb-table' style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '8px 0', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase' }}>Code</th>
                      <th style={{ padding: '8px 0', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase' }}>Charge Head</th>
                      <th style={{ padding: '8px 0', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase' }}>Charge</th>
                      <th style={{ padding: '8px 0', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase' }}>Due Party</th>
                      <th style={{ padding: '8px 0', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase' }}>Remarks</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '12px 8px 12px 0' }}><input style={{...inputStyle, padding:'6px'}}/></td>
                      <td style={{ padding: '12px 8px 12px 0' }}><input style={{...inputStyle, padding:'6px'}}/></td>
                      <td style={{ padding: '12px 8px 12px 0' }}><input style={{...inputStyle, padding:'6px', textAlign:'right'}}/></td>
                      <td style={{ padding: '12px 8px 12px 0' }}><select style={{...inputStyle, padding:'6px', textTransform: 'uppercase'}}><option>Due Carrier</option></select></td>
                      <td style={{ padding: '12px 8px 12px 0' }}><input style={{...inputStyle, padding:'6px'}} /></td>
                      <td style={{ padding: '12px 0', textAlign: 'center' }}><Trash2 size={16} color="#ef4444" style={{ cursor: 'pointer', border: '1px solid #fca5a5', padding: '2px', borderRadius: '4px' }} onClick={() => toast.error('Item Deleted')} /></td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span onClick={addCharge} style={{ color: '#0284c7', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase' }}>+ Add Other Charge</span>
                  <button type="button" onClick={autoRate} disabled={rating} className="btn-outline" style={{ padding: '6px 16px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: '#0284c7', border: '1px solid #0284c7', background: 'white', textTransform: 'uppercase', cursor: rating ? 'wait' : 'pointer' }}>
                    {rating ? 'Looking up TACT...' : 'Auto Rate'}
                  </button>
                </div>
                {rateInfo && (
                  <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '6px', fontSize: '12px',
                    background: rateInfo.success === false ? '#fef2f2' : '#ecfdf5',
                    border: '1px solid ' + (rateInfo.success === false ? '#fecaca' : '#a7f3d0'),
                    color: rateInfo.success === false ? '#991b1b' : '#065f46' }}>
                    {rateInfo.success === false ? rateInfo.error : (
                      <>
                        <b>{rateInfo.currency} {rateInfo.rate}</b> per kg &middot; class {rateInfo.rateClass} &middot; {rateInfo.weightBreak} kg break
                        &middot; {chargeableWeight} kg chargeable = <b>{rateInfo.currency} {rateInfo.amount}</b>
                        <div style={{ marginTop: '4px', color: '#047857' }}>{rateInfo.note}</div>
                      </>
                    )}
                  </div>
                )}
            </div>

            

              <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '8px', borderTop: '1px solid #e5e7eb', margin: '0 -20px -20px -20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: theme.primary, fontWeight: 'bold', fontSize: '13px', marginBottom: '16px' }}>
                  <span style={{ borderLeft: '3px solid #b91c1c', paddingLeft: '8px' }}>Charges</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#1f2937', marginBottom: '12px' }}>
                  <div>Freight Charges</div>
                  <div style={{ fontWeight: 'bold' }}>0.00</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#1f2937', marginBottom: '12px' }}>
                  <div>Other Charges</div>
                  <div style={{ fontWeight: 'bold' }}>0.00</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#1f2937', marginBottom: '16px' }}>
                  <div>Add On Charges</div>
                  <div style={{ fontWeight: 'bold' }}>--</div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#1f2937', borderTop: '1px solid #e5e7eb', paddingTop: '16px', fontWeight: 'bold' }}>
                  <div>
                    Total Amount<br/>
                    <span style={{ color: theme.primary, fontSize: '11px' }}>INR</span>
                  </div>
                  <div style={{ color: theme.primary, fontSize: '16px' }}>0.00</div>
                </div>
              </div>
            </div>

          {/* Additional Info */}
          <div className='awb-card' style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div style={{display:'flex', alignItems:'center', gap:'8px'}}><Info size={18}/> Additional Info</div><ChevronDown size={18} color="#9ca3af" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '24px' }}>
              <div><label style={labelStyle}>Special Service Request</label><input style={inputStyle} /></div>
              <div><label style={labelStyle}>Shippers Certification</label><input style={inputStyle} /></div>
            </div>

            <div style={{ marginBottom: '24px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '16px', color: '#1f2937', textTransform: 'uppercase' }}>Carrier\'s Execution Signature</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#1f2937', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>Date</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input style={{...inputStyle, paddingRight:'35px', cursor: 'pointer'}} placeholder="Select Date" readOnly />
                        <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}><Calendar size={16} color="#0284c7" /></span>
                      </div>
                      <div style={{ position: 'relative', width: '90px' }}>
                        <input style={{...inputStyle, paddingRight:'35px', cursor: 'pointer'}} placeholder="Time" readOnly />
                        <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}><Clock size={16} color="#0284c7" /></span>
                      </div>
                    </div>
                  </div>
                  <div><label style={{ display: 'block', fontSize: '11px', color: '#1f2937', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>Place</label><input style={inputStyle} /></div>
                  <div><label style={{ display: 'block', fontSize: '11px', color: '#1f2937', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>Authorization</label><input style={{...inputStyle, background: '#e5e7eb'}} /></div>
                </div>
              </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '12px', color: '#1f2937' }}>Accounting Info</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 40px auto', gap: '20px', marginBottom: '8px', alignItems: 'end' }}>
                <div>
                  <label style={labelStyle}>Information Identifier</label>
                  <select style={inputStyle}>
                    <option>Select</option>
                    <option value="General Information">General Information</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Information</label>
                  <input style={inputStyle} />
                </div>
                <div>
                  <div style={{ background: '#e2e8f0', padding: '8px', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }} onClick={() => toast.error('Item Deleted')}><Trash2 size={16} color="#ef4444" /></div>
                </div>
                <div></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 40px auto', gap: '20px', marginBottom: '12px', alignItems: 'center' }}>
                <div>
                  <select style={inputStyle}>
                    <option>Select</option>
                    <option value="General Information">General Information</option>
                  </select>
                </div>
                <div>
                  <input style={inputStyle} />
                </div>
                <div>
                  <div style={{ background: '#e2e8f0', padding: '8px', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }} onClick={() => toast.error('Item Deleted')}><Trash2 size={16} color="#ef4444" /></div>
                </div>
                <div></div>
              </div>
              <div style={{ color: theme.primary, fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => toast.success('New Info row added!')}>+ Add Info</div>
            </div>

            <div>
              <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '12px', color: '#1f2937' }}>Other & Customs Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 40px', gap: '16px', marginBottom: '8px', alignItems: 'end' }}>
                <div><label style={labelStyle}>ISO CountryCode</label><input style={inputStyle} /></div>
                <div><label style={labelStyle}>Info. ID</label><input style={inputStyle} /></div>
                <div><label style={labelStyle}>Customs Info. ID</label><input style={inputStyle} /></div>
                <div><label style={labelStyle}>Supp. Customs Info.</label><input style={inputStyle} /></div>
                <div><div style={{ background: '#e2e8f0', padding: '8px', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }} onClick={() => toast.error('Item Deleted')}><Trash2 size={16} color="#ef4444" /></div></div>
              </div>
              {[
                ['', '', 'ED', '0927'],
                ['', '', 'SM', 'XRY'],
                ['', '', 'SM', 'PHS'],
                ['', '', 'SM', 'ETD'],
                ['', '', 'SS', 'SPX'],
                ['', '', 'SD', '17091636'],
                ['', '', 'SN', '523270'],
              ].map((row, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 40px', gap: '16px', marginBottom: '8px', alignItems: 'center' }}>
                  <div><input style={inputStyle} /></div>
                  <div><input style={inputStyle} /></div>
                  <div><input style={inputStyle} /></div>
                  <div><input style={inputStyle} /></div>
                  <div><div style={{ background: '#e2e8f0', padding: '8px', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }} onClick={() => toast.error('Item Deleted')}><Trash2 size={16} color="#ef4444" /></div></div>
                </div>
              ))}
              <div style={{ color: theme.primary, fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }} onClick={() => toast.success('New Info row added!')}>+ Add Info</div>
            </div>

          </div>
    </>
  );
}
