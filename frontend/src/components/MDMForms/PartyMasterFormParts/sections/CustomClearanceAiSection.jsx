// Screen section: 🧠 Custom Clearance AI Rules (Gemini)
// Split out of PartyMasterForm.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { PlusCircle, Save } from 'lucide-react';
import React from 'react';

export default function CustomClearanceAiSection({ ctx }) {
  const { activeTab, adCodeFormData, customAlert, drawbackFormData, formData, handleFormChange, selectedParty, setAdCodeFormData, setDrawbackFormData, setSelectedParty } = ctx;
  return (
    <>
    {activeTab === 'ai_rules' && (
          <div className="glass-panel" style={{ padding: '1rem', border: '1px solid var(--border-color)', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <div style={{ padding: '1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e40af', fontSize: '13px' }}>🧠 Custom Clearance AI Rules (Gemini)</h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#3b82f6' }}>Write natural language instructions for the AI on how to map descriptions, units, or HSN codes when extracting from PDFs for this specific client.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Import AI Rules</label>
                <textarea 
                  className="input-field" 
                  style={{ height: '150px', resize: 'vertical' }} 
                  placeholder="e.g. Always prefix description with 'SPARE PARTS FOR'. If unit is pcs, change to NOS."
                  value={formData.aiImportRules || ''}
                  onChange={(e) => handleFormChange('aiImportRules', e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Export AI Rules</label>
                <textarea 
                  className="input-field" 
                  style={{ height: '150px', resize: 'vertical' }} 
                  placeholder="e.g. Map HSN to 84000000 if not found. Ignore DBK if under 500 INR."
                  value={formData.aiExportRules || ''}
                  onChange={(e) => handleFormChange('aiExportRules', e.target.value)}
                />
              </div>
            </div>
            
            {/* We could add Item Dictionary Grid here in the future, currently keeping it text rules for simplicity */}
            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={() => { const btn = document.getElementById('partyMasterMainSaveBtn'); if(btn) btn.click(); else customAlert('Save button not found'); }}>
                  <Save size={16} /> Save AI Rules
                </button>
            </div>
          </div>
        )}

        {activeTab === 'adcode' && (
          <div className="glass-panel" style={{ padding: '0', overflowY: 'auto', border: '1px solid var(--border-color)', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* AD Code Details Section */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: '#f0f9ff', padding: '0.5rem 1rem', borderBottom: '1px solid #bae6fd' }}>
                <h3 style={{ color: 'var(--primary-text, #0369a1)', margin: 0, fontSize: '11px' }}>AD Code Details</h3>
              </div>
              
              <div style={{ padding: '0.5rem 1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {/* Left Col */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <label style={{ width: '120px', fontSize: '11px', fontWeight: 600 }}>AD Code</label>
                      <input type="text" className="input-field" placeholder="AD CODE" style={{ flex: 1, borderColor: '#ef4444', textTransform: 'uppercase' }} value={adCodeFormData.adCode} onChange={e => setAdCodeFormData({...adCodeFormData, adCode: e.target.value})} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <label style={{ width: '120px', fontSize: '11px', fontWeight: 600 }}>Bank Name</label>
                      <input type="text" className="input-field" placeholder="BANK NAME" style={{ flex: 1, borderColor: '#3b82f6', textTransform: 'uppercase' }} value={adCodeFormData.bankName} onChange={e => setAdCodeFormData({...adCodeFormData, bankName: e.target.value})} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <label style={{ width: '120px', fontSize: '11px', fontWeight: 600 }}>Serial No</label>
                      <input type="text" className="input-field" placeholder="SERIAL NO" style={{ flex: 1, borderColor: '#3b82f6', textTransform: 'uppercase' }} value={adCodeFormData.serialNo} onChange={e => setAdCodeFormData({...adCodeFormData, serialNo: e.target.value})} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <label style={{ width: '120px', fontSize: '11px', fontWeight: 600 }}>Branch Address <span style={{color: 'var(--text-muted, var(--text-muted, #64748b))'}}>[If any]</span></label>
                      <input type="text" className="input-field" placeholder="BRANCH ADDRESS" style={{ flex: 1, borderColor: '#22c55e', background: '#f0fdf4', textTransform: 'uppercase' }} value={adCodeFormData.branchAddress} onChange={e => setAdCodeFormData({...adCodeFormData, branchAddress: e.target.value})} />
                    </div>
                  </div>
                  {/* Right Col */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <label style={{ width: '120px', fontSize: '11px', fontWeight: 600 }}>Forex Code</label>
                      <input type="text" className="input-field" placeholder="FOREX CODE" style={{ flex: 1, borderColor: '#3b82f6', textTransform: 'uppercase' }} value={adCodeFormData.forexCode} onChange={e => setAdCodeFormData({...adCodeFormData, forexCode: e.target.value})} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <label style={{ width: '120px', fontSize: '11px', fontWeight: 600 }}>Bank Address</label>
                      <input type="text" className="input-field" placeholder="ADDRESS" style={{ flex: 1, borderColor: '#3b82f6', textTransform: 'uppercase' }} value={adCodeFormData.bankAddress} onChange={e => setAdCodeFormData({...adCodeFormData, bankAddress: e.target.value})} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <label style={{ width: '120px', fontSize: '11px', fontWeight: 600 }}>Loading Port</label>
                      <input type="text" className="input-field" placeholder="LOADING PORT" style={{ flex: 1, borderColor: '#22c55e', background: '#f0fdf4', textTransform: 'uppercase' }} value={adCodeFormData.loadingPort} onChange={e => setAdCodeFormData({...adCodeFormData, loadingPort: e.target.value})} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <label style={{ width: '120px' }}></label>
                      <button className="btn btn-primary" onClick={() => {
                          if (!selectedParty) return;
                          if (!selectedParty.adCodes) selectedParty.adCodes = [];
                          selectedParty.adCodes.push({...adCodeFormData});
                          setSelectedParty({...selectedParty, ...formData});
                          setAdCodeFormData({ portCode: '', adCode: '', bankName: '', branchName: '', serialNo: '', forexCode: '', bankAddress: '', loadingPort: '' });
                      }} style={{ padding: '0.2rem 0.75rem', fontSize: '11px', background: '#3b82f6', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <PlusCircle size={12} /> Add
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color, #cbd5e1)', background: '#fff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', whiteSpace: 'nowrap' }}>
                    <thead style={{ background: 'var(--bg-app, var(--bg-app, #f8fafc))', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
                      <tr>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 'normal', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>Edit</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 'normal', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>Delete</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 'normal', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>Sr. No</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 'normal', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>AD Code</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 'normal', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>Bank Name</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 'normal', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>Bank Address</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 'normal', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>Forex Code</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 'normal', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>Loading Port</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 'normal' }}>AD Code Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedParty?.adCodes || []).map((ad, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                          <td style={{ padding: '4px 8px', borderRight: '1px solid var(--border-color, #e2e8f0)', color: '#3b82f6', cursor: 'pointer' }}>Edit</td>
                          <td style={{ padding: '4px 8px', borderRight: '1px solid var(--border-color, #e2e8f0)', color: '#ef4444', cursor: 'pointer' }} onClick={() => {
                              selectedParty.adCodes = selectedParty.adCodes.filter((_, i) => i !== idx);
                              setSelectedParty({...selectedParty, ...formData});
                          }}>Delete</td>
                          <td style={{ padding: '4px 8px', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>{ad.serialNo}</td>
                          <td style={{ padding: '4px 8px', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>{ad.adCode}</td>
                          <td style={{ padding: '4px 8px', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>{ad.bankName}</td>
                          <td style={{ padding: '4px 8px', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>{ad.bankAddress}</td>
                          <td style={{ padding: '4px 8px', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>{ad.forexCode}</td>
                          <td style={{ padding: '4px 8px', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>{ad.loadingPort}</td>
                          <td style={{ padding: '4px 8px' }}>{ad.branchAddress}</td>
                        </tr>
                      ))}
                      {(!selectedParty?.adCodes || selectedParty.adCodes.length === 0) && (
                        <tr><td colSpan="9" style={{ padding: '2rem' }}></td></tr>
                      )}
                    </tbody>
                  </table>
                  <div style={{ background: '#94a3b8', height: '10px', margin: '4px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ width: '0', height: '0', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: '5px solid white', marginLeft: '2px' }}></div>
                    <div style={{ width: '0', height: '0', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '5px solid white', marginRight: '2px' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawback A/C Details Section */}
            <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid #bae6fd' }}>
              <div style={{ background: '#f0f9ff', padding: '0.5rem 1rem', borderBottom: '1px solid #bae6fd' }}>
                <h3 style={{ color: 'var(--primary-text, #0369a1)', margin: 0, fontSize: '11px' }}>Drawback A/C Details</h3>
              </div>
              
              <div style={{ padding: '0.5rem 1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {/* Left Col */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <label style={{ width: '120px', fontSize: '11px', fontWeight: 600 }}>AD Code</label>
                      <input type="text" className="input-field" placeholder="AD CODE" style={{ flex: 1, borderColor: '#ef4444', textTransform: 'uppercase' }} value={drawbackFormData.adCode} onChange={e => setDrawbackFormData({...drawbackFormData, adCode: e.target.value})} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <label style={{ width: '120px', fontSize: '11px', fontWeight: 600 }}>Bank Name</label>
                      <input type="text" className="input-field" placeholder="BANK NAME" style={{ flex: 1, borderColor: '#3b82f6', textTransform: 'uppercase' }} value={drawbackFormData.bankName} onChange={e => setDrawbackFormData({...drawbackFormData, bankName: e.target.value})} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <label style={{ width: '120px', fontSize: '11px', fontWeight: 600 }}>IFSC Code</label>
                      <input type="text" className="input-field" placeholder="IFSC CODE" style={{ flex: 1, borderColor: '#3b82f6', textTransform: 'uppercase' }} value={drawbackFormData.ifscCode} onChange={e => setDrawbackFormData({...drawbackFormData, ifscCode: e.target.value})} />
                    </div>
                  </div>
                  {/* Right Col */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <label style={{ width: '120px', fontSize: '11px', fontWeight: 600 }}>Account No</label>
                      <input type="text" className="input-field" placeholder="ACCOUNT NO" style={{ flex: 1, borderColor: '#3b82f6', textTransform: 'uppercase' }} value={drawbackFormData.accountNo} onChange={e => setDrawbackFormData({...drawbackFormData, accountNo: e.target.value})} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <label style={{ width: '120px', fontSize: '11px', fontWeight: 600 }}>Bank Address</label>
                      <input type="text" className="input-field" placeholder="ADDRESS" style={{ flex: 1, borderColor: '#3b82f6', textTransform: 'uppercase' }} value={drawbackFormData.bankAddress} onChange={e => setDrawbackFormData({...drawbackFormData, bankAddress: e.target.value})} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto' }}>
                      <label style={{ width: '120px' }}></label>
                      <button className="btn btn-primary" onClick={() => {
                          if (!selectedParty) return;
                          if (!selectedParty.drawbackAccounts) selectedParty.drawbackAccounts = [];
                          selectedParty.drawbackAccounts.push({...drawbackFormData});
                          setSelectedParty({...selectedParty, ...formData});
                          setDrawbackFormData({ adCode: '', bankName: '', ifscCode: '', accountNo: '', bankAddress: '' });
                      }} style={{ padding: '0.2rem 0.75rem', fontSize: '11px', background: '#3b82f6', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <PlusCircle size={12} /> Add
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color, #cbd5e1)', background: '#fff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', whiteSpace: 'nowrap' }}>
                    <thead style={{ background: 'var(--bg-app, var(--bg-app, #f8fafc))', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
                      <tr>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 'normal', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>Edit</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 'normal', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>Delete</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 'normal', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>AD Code</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 'normal', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>Account No</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 'normal', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>IFSC Code</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 'normal', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>Bank Name</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 'normal' }}>Bank Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedParty?.drawbackAccounts || []).map((dbk, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                          <td style={{ padding: '4px 8px', borderRight: '1px solid var(--border-color, #e2e8f0)', color: '#3b82f6', cursor: 'pointer' }}>Edit</td>
                          <td style={{ padding: '4px 8px', borderRight: '1px solid var(--border-color, #e2e8f0)', color: '#ef4444', cursor: 'pointer' }} onClick={() => {
                              selectedParty.drawbackAccounts = selectedParty.drawbackAccounts.filter((_, i) => i !== idx);
                              setSelectedParty({...selectedParty, ...formData});
                          }}>Delete</td>
                          <td style={{ padding: '4px 8px', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>{dbk.adCode}</td>
                          <td style={{ padding: '4px 8px', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>{dbk.accountNo}</td>
                          <td style={{ padding: '4px 8px', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>{dbk.ifscCode}</td>
                          <td style={{ padding: '4px 8px', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>{dbk.bankName}</td>
                          <td style={{ padding: '4px 8px' }}>{dbk.bankAddress}</td>
                        </tr>
                      ))}
                      {(!selectedParty?.drawbackAccounts || selectedParty.drawbackAccounts.length === 0) && (
                        <tr><td colSpan="7" style={{ padding: '2rem' }}></td></tr>
                      )}
                    </tbody>
                  </table>
                  <div style={{ background: '#94a3b8', height: '10px', margin: '4px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ width: '0', height: '0', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: '5px solid white', marginLeft: '2px' }}></div>
                    <div style={{ width: '0', height: '0', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '5px solid white', marginRight: '2px' }}></div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
    </>
  );
}
