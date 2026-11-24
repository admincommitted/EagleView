// Screen section: All mandatory fields must be filled before submission.
// Split out of EFreightAWBForm.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { FileText, Info, Plane, Save, Trash2, X } from 'lucide-react';
import React from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';

export default function AllMandatoryFieldsSection({ ctx }) {
  // 30-Oct-2026: the dimensions grid in this modal showed ONE hardcoded row (61 x 61 x 18 = 2.68) and
  // three blank ones. It was never bound to the dims state, so nothing typed survived, handleRemoveDim
  // and updateDim were never called, and the four totals above it always read "--". Download Dims and
  // Upload Bulk Dims were dead. All of it reads and writes the real dims now.
  const { airlines, airports, awbStocks, chargeableWeight, currencies, dims, downloadDims, handleAddDim, handleRemoveDim,
    handleSubmit, iataAgents, inputStyle, labelStyle, onSubmit, rightSidebarMode, selectedConsignee, selectedShipper,
    setRightSidebarMode, setShowDimsModal, showDimsModal, sphList, theme, totalPieces, totalVolume, totalWeight,
    updateDim, uploadDims, volWeight } = ctx;
  const dimFileRef = React.useRef(null);
  return (
    <>
    {/* Premium Sticky Action Bar */}
        <div style={{ background: 'white', borderTop: '1px solid #e5e7eb', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', bottom: 0, zIndex: 50, boxShadow: '0 -4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ color: '#6b7280', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <Info size={16} /> All mandatory fields must be filled before submission.
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button className='btn-outline' style={{ padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => toast.success('Draft Saved!')}>
              <Save size={16} /> Save Draft
            </button>
            <button className='btn-outline' style={{ padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f766e', borderColor: '#0f766e' }} onClick={() => toast.success('Preview Generating...')}>
              <FileText size={16} /> Preview AWB
            </button>
            <button className='btn-primary' style={{ padding: '10px 32px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', background: '#0284c7' }} onClick={handleSubmit(onSubmit)}>
              <Plane size={16} /> Submit AWB
            </button>
          </div>
        </div>

        {/* Dims Modal */}
      {showDimsModal && createPortal(
        <div style={{ position: 'fixed', top: '70px', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: 'white', width: '850px', height: '100vh', overflowY: 'auto', boxShadow: '-10px 0 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#1f2937', padding: '16px 20px' }}>Add Dimensions</h3>
              <div style={{ background: '#e11d48', padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowDimsModal(false)}>
                 <X size={20} color="white" />
              </div>
            </div>
            
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', fontSize: '12px' }}>
                <div><div style={{ color: theme.primary, marginBottom: '4px', fontWeight: 'bold' }}>Total Pieces</div><div style={{ fontWeight: 'bold', fontSize: '14px' }}>{totalPieces || '--'}</div></div>
                <div><div style={{ color: theme.primary, marginBottom: '4px', fontWeight: 'bold' }}>Total Weight</div><div style={{ fontWeight: 'bold', fontSize: '14px' }}>{totalWeight || '--'} kg</div></div>
                <div><div style={{ color: theme.primary, marginBottom: '4px', fontWeight: 'bold' }}>Total Volume</div><div style={{ fontWeight: 'bold', fontSize: '14px' }}>{totalVolume ? totalVolume.toFixed(3) : '--'} cbm</div></div>
                <div><div style={{ color: theme.primary, marginBottom: '4px', fontWeight: 'bold' }}>Volumetric Weight</div><div style={{ fontWeight: 'bold', fontSize: '14px' }}>{volWeight > 0 ? volWeight : '--'} kg</div></div>
                <div><div style={{ color: theme.primary, marginBottom: '4px', fontWeight: 'bold' }}>Chargeable Weight</div><div style={{ fontWeight: 'bold', fontSize: '14px' }}>{chargeableWeight > 0 ? chargeableWeight : '--'} kg</div></div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>Add your piece group level dimensions below</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontSize: '11px' }}><Info size={12} /> Volume is worked out from L x W x H x pieces; type over it if the carrier measured differently</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span onClick={downloadDims} style={{ color: '#ef4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>Download Dims</span>
                  <input ref={dimFileRef} type="file" accept=".xlsx,.xls,.csv,.txt" style={{ display: 'none' }}
                    onChange={e => { const f = (e.target.files || [])[0]; e.target.value = ''; uploadDims(f); }} />
                  <button type="button" onClick={() => dimFileRef.current && dimFileRef.current.click()} className="btn-outline" style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>Upload Bulk Dims</button>
                </div>
              </div>
              
              <div style={{ textAlign: 'right', marginBottom: '8px' }}>
                <span onClick={handleAddDim} style={{ border: '1px solid #ef4444', color: '#ef4444', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', marginRight: '8px', fontWeight: 'bold' }}>+ Add Row</span>
              </div>
              
              <table className="awb-table" style={{ width: '100%', fontSize: '12px', textAlign: 'left', borderCollapse: 'collapse', marginBottom: '24px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '30px' }}></th>
                    <th style={{ color: '#ef4444 !important' }}>Pieces</th>
                    <th style={{ color: '#ef4444 !important' }}>Weight (kg)</th>
                    <th style={{ color: '#ef4444 !important' }}>Length (cm)</th>
                    <th style={{ color: '#ef4444 !important' }}>Width (cm)</th>
                    <th style={{ color: '#ef4444 !important' }}>Height (cm)</th>
                    <th style={{ color: '#ef4444 !important' }}>Volume (cbm)</th>
                    <th style={{ color: '#ef4444 !important' }}>Stackable</th>
                    <th style={{ color: '#ef4444 !important' }}>Tiltable</th>
                  </tr>
                </thead>
                <tbody>
                  {(dims || []).map((d, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center' }}>
                        <Trash2 size={14} color={(dims || []).length > 1 ? '#ef4444' : '#e5e7eb'}
                          style={{ cursor: (dims || []).length > 1 ? 'pointer' : 'not-allowed' }}
                          onClick={() => handleRemoveDim(idx)} />
                      </td>
                      <td><input type="number" value={d.pieces} onChange={e => updateDim(idx, 'pieces', e.target.value)} style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '4px', fontSize: '12px', textAlign: 'right', boxSizing: 'border-box' }} /></td>
                      <td><input type="number" value={d.weight} onChange={e => updateDim(idx, 'weight', e.target.value)} style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '4px', fontSize: '12px', textAlign: 'right', boxSizing: 'border-box' }} /></td>
                      <td><input type="number" value={d.length} onChange={e => updateDim(idx, 'length', e.target.value)} style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '4px', fontSize: '12px', textAlign: 'right', boxSizing: 'border-box' }} /></td>
                      <td><input type="number" value={d.width} onChange={e => updateDim(idx, 'width', e.target.value)} style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '4px', fontSize: '12px', textAlign: 'right', boxSizing: 'border-box' }} /></td>
                      <td><input type="number" value={d.height} onChange={e => updateDim(idx, 'height', e.target.value)} style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '4px', fontSize: '12px', textAlign: 'right', boxSizing: 'border-box' }} /></td>
                      <td>
                        <input type="number" value={d.volume} onChange={e => updateDim(idx, 'volume', e.target.value)}
                          title="Filled automatically from L x W x H x pieces; type over it if the carrier measured differently"
                          style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '4px', fontSize: '12px', textAlign: 'right', fontWeight: 'bold', boxSizing: 'border-box' }} />
                      </td>
                      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={!!d.stackable} onChange={e => updateDim(idx, 'stackable', e.target.checked)} style={{ accentColor: '#ef4444' }} /></td>
                      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={!!d.tiltable} onChange={e => updateDim(idx, 'tiltable', e.target.checked)} /></td>
                    </tr>
                  ))}
                  {!(dims || []).length && (
                    <tr><td colSpan={9} style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>No dimension line yet - use &quot;+ Add Row&quot; or upload a file.</td></tr>
                  )}
                </tbody>
              </table>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn-primary" style={{ padding: '8px 24px', borderRadius: '4px', fontWeight: 'bold', background: '#e11d48', color: 'white', border: 'none' }} onClick={() => {
                  const kept = (dims || []).filter(d => d.pieces || d.weight || d.volume).length;
                  toast.success(kept ? kept + ' dimension line(s) kept - they go with the AWB when you save it' : 'No dimension line filled in');
                  setShowDimsModal(false);
                }}>Done</button>
                <button className="btn-outline" style={{ padding: '8px 24px', borderRadius: '4px', fontWeight: 'bold', color: '#e11d48', border: '1px solid #e11d48', background: 'white' }} onClick={() => setShowDimsModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

          {/* Right Sidebar (Shipper / Consignee) */}
        {['shipper', 'consignee'].includes(rightSidebarMode) && createPortal(
            (() => {
              const party = rightSidebarMode === 'shipper' ? selectedShipper : selectedConsignee;
              if (!party) return null;
              const branch = party.branches && party.branches.length > 0 ? party.branches[0] : {};
              const title = rightSidebarMode === 'shipper' ? 'Shipper Details' : 'Consignee Details';
              const code = party.code || 'N/A';
              
              return (
            <div style={{ position: 'fixed', top: '70px', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
  <div style={{ background: 'white', width: '550px', height: '100vh', overflowY: 'auto', boxShadow: '-10px 0 25px rgba(0,0,0,0.1)', maxHeight: '100vh', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.2s ease-out' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '14px', color: theme.textMain }}>{title}</h3>
                <X size={18} color={theme.primary} style={{ cursor: 'pointer' }} onClick={() => setRightSidebarMode(null)} />
              </div>
              
              <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ border: '1px solid #d1d5db', padding: '8px 12px', borderRadius: '4px', fontWeight: 'bold' }}>{party.name.charAt(0).toUpperCase()}</div>
                  <div style={{ fontSize: '12px' }}>
                    <div style={{ fontWeight: 'bold' }}>{party.name}</div>
                    <div style={{ color: theme.blueText, fontSize: '11px' }}>CODE: {code}</div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div><label style={labelStyle}>Address Line One<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label><input className='mandatory-border' style={inputStyle} defaultValue={branch.address1 || party.street || ''} /></div>
                  <div><label style={labelStyle}>Address Line Two</label><input style={inputStyle} defaultValue={branch.address2 || ''} /></div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div><label style={labelStyle}>Country<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label><input className='mandatory-border' style={inputStyle} defaultValue={branch.country || party.countryCode || ''} /></div>
                    <div><label style={labelStyle}>State</label><input style={inputStyle} defaultValue={branch.state || party.stateProvince || ''} /></div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div><label style={labelStyle}>City<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label><input className='mandatory-border' style={inputStyle} defaultValue={branch.city || party.city || ''} /></div>
                    <div><label style={labelStyle}>Postal Code</label><input style={inputStyle} defaultValue={branch.pinCode || party.zipPostcode || ''} /></div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div><label style={labelStyle}>Phone Number</label><input style={inputStyle} defaultValue={branch.phone || party.phoneNumber || ''} /></div>
                    <div><label style={labelStyle}>Mobile Number</label><input style={inputStyle} defaultValue={branch.mobile || ''} /></div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div><label style={labelStyle}>Fax Number</label><input style={inputStyle} defaultValue={branch.fax || ''} /></div>
                    <div><label style={labelStyle}>Email ID</label><input style={inputStyle} defaultValue={branch.email1 || party.email || ''} /></div>
                  </div>
                  
                  <div><label style={labelStyle}>GSTIN Number</label><input style={inputStyle} defaultValue={branch.gstin || party.taxId || ''} /></div>
                </div>
              </div>
  
              <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '10px' }}>
                <button className='btn-primary' style={{ padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => { toast.success(`${title} Updated!`); setRightSidebarMode(null); }}>Update</button>
                <button className='btn-outline' style={{ padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setRightSidebarMode(null)}>Cancel</button>
              </div>
            </div>
    </div>
  );
})()
            , document.body)}

        {/* Right Sidebar (Notify Details) */}
        {rightSidebarMode === 'notify' && createPortal(
          <div style={{ position: 'fixed', top: '70px', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
<div style={{ background: 'white', width: '550px', height: '100vh', overflowY: 'auto', boxShadow: '-10px 0 25px rgba(0,0,0,0.1)', maxHeight: '100vh', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.2s ease-out' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '14px', color: theme.textMain }}>Notify Details</h3>
              <X size={18} color={theme.primary} style={{ cursor: 'pointer' }} onClick={() => setRightSidebarMode(null)} />
            </div>
            
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><label style={labelStyle}>Notify Name<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label><input className='mandatory-border' style={{...inputStyle, borderColor: 'red'}} placeholder="Enter the Notify Name" /></div>
                <div><label style={labelStyle}>Notify Code<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label><input className='mandatory-border' style={{...inputStyle, background: '#e5e7eb'}} /></div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div><label style={labelStyle}>Address Line One<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label><input className='mandatory-border' style={inputStyle} /></div>
                <div><label style={labelStyle}>Account Number</label><input style={inputStyle} /></div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label style={labelStyle}>Country<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label><select className='mandatory-border' style={inputStyle}><option>Select the Country</option></select></div>
                  <div><label style={labelStyle}>State</label><input style={inputStyle} /></div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label style={labelStyle}>City<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label><select className='mandatory-border' style={inputStyle}><option>Select the City</option></select></div>
                  <div><label style={labelStyle}>Postal Code</label><input style={inputStyle} /></div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label style={labelStyle}>Phone Number</label><input style={inputStyle} /></div>
                  <div><label style={labelStyle}>Mobile Number</label><input style={inputStyle} /></div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label style={labelStyle}>Fax Number</label><input style={inputStyle} /></div>
                  <div><label style={labelStyle}>Email ID</label><input style={inputStyle} /></div>
                </div>
                
                <div><label style={labelStyle}>Billing Address</label><textarea style={{...inputStyle, height: '60px', resize: 'vertical'}}></textarea></div>
              </div>
            </div>

            <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '10px' }}>
              <button className='btn-primary' style={{ padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => { toast.success('Notify Details Added!'); setRightSidebarMode(null); }}>Add</button>
              <button className='btn-outline' style={{ padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setRightSidebarMode(null)}>Cancel</button>
            </div>
          </div>
        </div>
          , document.body)}

        
          {/* AWB Details Drawer */}
          {rightSidebarMode === 'awb' && createPortal(
            <div style={{ position: 'fixed', top: '70px', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ background: 'white', width: '500px', height: '100vh', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.2s ease-out' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', color: theme.textMain }}>AWB Advanced Details</h3>
                  <X size={18} color={theme.primary} style={{ cursor: 'pointer' }} onClick={() => setRightSidebarMode(null)} />
                </div>
                <div style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div><label style={labelStyle}>Execution Date</label><input type="date" style={inputStyle} /></div>
                  <div><label style={labelStyle}>Execution Place</label><input style={inputStyle} defaultValue="DELHI" /></div>
                  <div><label style={labelStyle}>Signature of Shipper</label><input style={inputStyle} /></div>
                  <div><label style={labelStyle}>Signature of Issuing Carrier</label><input style={inputStyle} /></div>
                  <div><label style={labelStyle}>Reference Number</label><input style={inputStyle} /></div>
                  <div><label style={labelStyle}>Optional Shipping Info</label><textarea style={{...inputStyle, height: '80px', resize: 'vertical'}}></textarea></div>
                </div>
                <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '10px' }}>
                  <button className='btn-primary' style={{ padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => { toast.success('AWB Details Updated!'); setRightSidebarMode(null); }}>Save</button>
                  <button className='btn-outline' style={{ padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setRightSidebarMode(null)}>Cancel</button>
                </div>
              </div>
            </div>
          , document.body)}

          {/* IATA Agent Drawer */}
          {rightSidebarMode === 'iataAgent' && createPortal(
            <div style={{ position: 'fixed', top: '70px', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ background: 'white', width: '500px', height: '100vh', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.2s ease-out' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', color: theme.textMain }}>IATA Agent Details</h3>
                  <X size={18} color={theme.primary} style={{ cursor: 'pointer' }} onClick={() => setRightSidebarMode(null)} />
                </div>
                <div style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div><label style={labelStyle}>CASS Address</label><input style={inputStyle} /></div>
                  <div><label style={labelStyle}>Agent Account No.</label><input style={inputStyle} /></div>
                  <div><label style={labelStyle}>Customs Code</label><input style={inputStyle} /></div>
                  <div><label style={labelStyle}>Commission %</label><input style={inputStyle} /></div>
                  <div><label style={labelStyle}>TDS %</label><input style={inputStyle} /></div>
                  <div><label style={labelStyle}>Remarks</label><textarea style={{...inputStyle, height: '80px', resize: 'vertical'}}></textarea></div>
                </div>
                <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '10px' }}>
                  <button className='btn-primary' style={{ padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => { toast.success('IATA Agent Info Updated!'); setRightSidebarMode(null); }}>Save</button>
                  <button className='btn-outline' style={{ padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setRightSidebarMode(null)}>Cancel</button>
                </div>
              </div>
            </div>
          , document.body)}

          {/* Right Sidebar (Remarks) */}
        {rightSidebarMode === 'remarks' && createPortal(
          <div style={{ position: 'fixed', top: '70px', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
<div style={{ background: 'white', width: '550px', height: '100vh', overflowY: 'auto', boxShadow: '-10px 0 25px rgba(0,0,0,0.1)', maxHeight: '100vh', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.2s ease-out' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '14px', color: theme.textMain }}>Remarks/Handling Information</h3>
              <X size={18} color={theme.primary} style={{ cursor: 'pointer' }} onClick={() => setRightSidebarMode(null)} />
            </div>
            
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Shipment Remarks</label>
                <textarea style={{ ...inputStyle, height: '100px', resize: 'vertical' }}></textarea>
              </div>
              
              <div>
                <label style={labelStyle}>Handling Instructions</label>
                <select style={{ ...inputStyle, marginBottom: '8px' }}>
                  <option>Select the pre-defined instructions</option>
                </select>
                <textarea style={{ ...inputStyle, height: '100px', resize: 'vertical' }} placeholder="Enter the Handling Instructions"></textarea>
              </div>
            </div>

            <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '10px' }}>
              <button className='btn-primary' style={{ padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => { toast.success('Remarks Updated!'); setRightSidebarMode(null); }}>Done</button>
              <button className='btn-outline' style={{ padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setRightSidebarMode(null)}>Cancel</button>
            </div>
          </div>
        </div>
          , document.body)}
        
      
      {/* Master Data Datalists */}
      <datalist id="airportsList">
        {airports.map((a, i) => <option key={i} value={a.code}>{a.name}</option>)}
      </datalist>
      <datalist id="currenciesList">
        {currencies.map((c, i) => <option key={i} value={c.code}>{c.name}</option>)}
      </datalist>
      <datalist id="sphList">
        {sphList.map((s, i) => <option key={i} value={s.code}>{s.description}</option>)}
      </datalist>
            <datalist id="airlinesList">
        {airlines.map((a, i) => <option key={i} value={a.prefix}>{a.name}</option>)}
      </datalist>
      <datalist id="awbStockList">
        {awbStocks.map(s => {
            const formatted = s.fullAwbNumber.length === 11 ? s.fullAwbNumber.substring(0,3) + '-' + s.fullAwbNumber.substring(3) : s.fullAwbNumber;
            return <option key={s.id} value={formatted} />;
        })}
      </datalist>
      <datalist id="iataAgentsList">
        {iataAgents.map(a => <option key={a.id} value={a.name}>{a.iataCode}</option>)}
      </datalist>
    </>
  );
}
