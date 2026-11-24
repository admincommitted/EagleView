// Screen section: Party Address
// Split out of PartyMasterForm.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { PlusCircle } from 'lucide-react';
import React from 'react';

export default function PartyAddressSection({ ctx }) {
  const { addressFormData, customAlert, formData, globalLocations, selectedParty, setAddressFormData, setDeleteConfirm, setSelectedParty } = ctx;
  // 14-Nov-2026: the CTX state CODE is not stored in PartyBranches (no column), so it is worked out when a branch is opened:
  // from the GSTIN (first 2 digits), else from the CTX state in the location master (the entry with a numeric tax code wins)
  const taxCodeOf = (country, stateName) => {
      const sts = ((globalLocations || []).find(c => c.code === (country || 'IN')) || {}).states || [];
      const hits = sts.filter(st => String(st.stateName || '').toUpperCase() === String(stateName || '').toUpperCase());
      const h = hits.find(st => /^\d{1,2}$/.test(String(st.taxCode || ''))) || hits[0];
      return h ? (/^\d{1,2}$/.test(String(h.taxCode || '')) ? String(h.taxCode).padStart(2, '0') : (h.stateCode || '')) : '';
  };
  const withCtxCode = (a) => {
      if (!a || a.ctxCode) return a;
      const g = String(a.regNo || a.gstin || '').trim().toUpperCase();
      if (a.ctxType === 'GSTIN' && /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(g)) return { ...a, ctxCode: g.slice(0, 2) };
      const code = a.ctxState ? taxCodeOf(a.country, a.ctxState) : '';
      return code ? { ...a, ctxCode: code } : a;
  };
  return (
    <>
    <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '450px' }}>
              <div style={{ background: '#f0f9ff', padding: '0.5rem 1rem', borderBottom: '1px solid #bae6fd' }}>
                <h3 style={{ color: 'var(--primary-text, #0369a1)', margin: 0, fontSize: '11px' }}>Party Address</h3>
              </div>
              
              <div key={addressFormData.branchSrNo || 'new'} style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflowY: 'auto' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {/* First Column (Aligns with Address 1) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                      <label style={{ width: '80px', fontWeight: 'bold' }}>Sr. No / Def.</label>
                      <input type="text" className="input-field" placeholder="SR. NO" value={addressFormData.branchSrNo || ''} onChange={(e) => setAddressFormData(prev => ({...prev, branchSrNo: e.target.value}))} style={{ width: '60px', border: '1px solid #ef4444' }} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', fontWeight: 'bold', fontSize: '11px' }}>Default <input type="checkbox" checked={!!addressFormData.default} onChange={(e) => setAddressFormData(prev => ({...prev, default: e.target.checked}))} style={{ cursor: 'pointer' }} /></label>
                    </div>
                    {/* Second Column (Aligns with Address 2) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                      <label style={{ width: '80px', fontWeight: 'bold' }}>Branch Name</label>
                      <input type="text" className="input-field" placeholder="BRANCH NAME" value={addressFormData.branchName || addressFormData.branch || ''} onChange={(e) => setAddressFormData(prev => ({...prev, branchName: e.target.value}))} style={{ flex: 1, border: '1px solid #000000' }} />
                    </div>
                    {/* Third Column (Aligns with City) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                      <label style={{ width: '60px', fontWeight: 'bold' }}>Contact</label>
                      <input type="text" className="input-field" placeholder="CONTACT PERSON" value={addressFormData.contactPerson || ''} onChange={(e) => setAddressFormData(prev => ({...prev, contactPerson: e.target.value}))} style={{ flex: 1, border: '1px solid #000000' }} />
                    </div>
                  </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <label style={{ width: '80px' }}>Address1 <span style={{color: 'red'}}>*</span></label>
                    <input type="text" className="input-field" maxLength="35" onInput={(e) => { if(e.target.value.length >= 35) { e.target.style.boxShadow = "0 0 4px red"; e.target.title = "Max 35 characters reached!"; } else { e.target.style.boxShadow = "none"; } }} placeholder="ADDRESS LINE 1" value={addressFormData.address1 || ""} onChange={(e) => setAddressFormData(prev => ({...prev, address1: e.target.value}))} style={{ flex: 1, border: '1px solid #ef4444' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <label style={{ width: '80px' }}>Address2</label>
                    <input type="text" className="input-field" maxLength="35" onInput={(e) => { if(e.target.value.length >= 35) { e.target.style.boxShadow = "0 0 4px red"; e.target.title = "Max 35 characters reached!"; } else { e.target.style.boxShadow = "none"; } }} placeholder="ADDRESS LINE 2" value={addressFormData.address2 || ''} onChange={(e) => setAddressFormData(prev => ({...prev, address2: e.target.value}))} style={{ flex: 1, border: '1px solid #000000' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <label style={{ width: '60px' }}>City <span style={{color: 'red'}}>*</span></label>
                    <input type="text" className="input-field" maxLength="35" onInput={(e) => { if(e.target.value.length >= 35) { e.target.style.boxShadow = "0 0 4px red"; e.target.title = "Max 35 characters reached!"; } else { e.target.style.boxShadow = "none"; } }} placeholder="CITY" value={addressFormData.city || ''} onChange={(e) => setAddressFormData(prev => ({...prev, city: e.target.value}))} style={{ flex: 1, border: '1px solid #000000' }} />
                    {(addressFormData.city || '').length > 17 && <span style={{ fontSize: '10px', color: '#b45309', whiteSpace: 'nowrap', textTransform: 'none' }} title="ICEGATE takes 35; AWB / IATA EDI keeps the first 17 characters of the city">AWB keeps 17</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <label style={{ width: '80px' }}>Country <span style={{color: 'red'}}>*</span></label>
                    <select className="input-field" value={addressFormData.country || ''} onChange={(e) => setAddressFormData(prev => ({...prev, country: e.target.value, state: '', ctxState: ''}))} style={{ flex: 1, border: '1px solid var(--border-color, #cbd5e1)' }}>
                        <option value="">SELECT COUNTRY</option>
                        {globalLocations.map(c => <option key={c.id} value={c.code}>{c.code} - {c.name}</option>)}
                      </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <label style={{ width: '80px' }}>State <span style={{color: 'red'}}>*</span></label>
                    <select className="input-field" value={addressFormData.state || ''} onChange={(e) => setAddressFormData(prev => ({...prev, state: e.target.value}))} style={{ flex: 1, border: '1px solid var(--border-color, #cbd5e1)' }}>
                        <option value="">SELECT STATE</option>
                        {globalLocations.find(c => c.code === addressFormData.country)?.states?.map(s => <option key={s.id} value={s.stateName}>{s.stateName}</option>)}
                      </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <label style={{ width: '60px' }}>Pin <span style={{color: 'red'}}>*</span></label>
                    <input type="text" className="input-field" placeholder="PIN CODE" maxLength={(addressFormData.country || 'IN') === 'IN' ? 6 : 9} title="India: 6 digits (ICEGATE). Other countries: up to 9 (AWB / IATA EDI)" value={addressFormData.pinCode || ''} onChange={(e) => { const v = (addressFormData.country || 'IN') === 'IN' ? e.target.value.replace(/\D/g, '') : e.target.value; setAddressFormData(prev => ({...prev, pinCode: v})); }} style={{ flex: 1, border: '1px solid #000000' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <label style={{ width: '80px' }}>CTX Type</label>
                    <select className="input-field" value={addressFormData.ctxType || ''} onChange={(e) => setAddressFormData(prev => ({...prev, ctxType: e.target.value}))} style={{ flex: 1, border: '1px solid #ef4444', color: 'var(--primary-color-end, #2563eb)' }}>
                      <option>Select</option>
                      <option>GSTIN</option>
                      <option>Aadhar</option>
                      <option>Passport</option>
                      <option>Income Tax PAN</option>
                      <option>TIN No</option>
                      <option>VAT</option>
                      <option>CST</option>
                      <option>Sales Tax Registration No</option>
                      <option>GST Government</option>
                      <option>GST Diplomat</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <label style={{ width: '80px' }}>CTX State</label>
                    <select className="input-field" value={addressFormData.ctxState || ''} onChange={(e) => {
                        const selectedStateName = e.target.value;
                        setAddressFormData(prev => ({...prev, ctxState: selectedStateName, ctxCode: selectedStateName ? taxCodeOf(addressFormData.country, selectedStateName) : ''}));
                    }} style={{ flex: 1, border: '1px solid var(--border-color, #cbd5e1)' }}>
                        <option value="">SELECT</option>
                        {globalLocations.find(c => c.code === addressFormData.country)?.states?.map(s => <option key={s.id} value={s.stateName}>{s.stateName}</option>)}
                      </select>
                    <input type="text" className="input-field" placeholder="CODE" value={addressFormData.ctxCode || ''} onChange={(e) => setAddressFormData(prev => ({...prev, ctxCode: e.target.value}))} style={{ width: '60px' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <label style={{ width: '60px' }}>Reg. No</label>
                      <input type="text" className="input-field" placeholder="REG. NO" value={addressFormData.regNo || addressFormData.gstin || ''} onChange={(e) => setAddressFormData(prev => ({...prev, regNo: e.target.value}))} style={{ flex: 1, border: '1px solid #ef4444' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <label style={{ width: '80px' }}>Phone</label>
                    <input type="text" className="input-field" placeholder="PHONE NO." value={addressFormData.phone || ''} onChange={(e) => setAddressFormData(prev => ({...prev, phone: e.target.value}))} style={{ flex: 1, border: '1px solid #000000' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <label style={{ width: '80px' }}>Mobile</label>
                    <input type="text" className="input-field" placeholder="MOBILE NO." value={addressFormData.mobile || ''} onChange={(e) => setAddressFormData(prev => ({...prev, mobile: e.target.value}))} style={{ flex: 1, border: '1px solid #000000' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <label style={{ width: '60px' }}>Fax</label>
                    <input type="text" className="input-field" placeholder="FAX NO." value={addressFormData.fax || ''} onChange={(e) => setAddressFormData(prev => ({...prev, fax: e.target.value}))} style={{ flex: 1, border: '1px solid #000000' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <label style={{ width: '80px' }}>Email1</label>
                    <input type="text" className="input-field" placeholder="EMAIL ID 1" value={addressFormData.email || ''} onChange={(e) => setAddressFormData(prev => ({...prev, email: e.target.value}))} style={{ flex: 1, border: '1px solid #000000' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <label style={{ width: '80px' }}>Email2</label>
                    <input type="text" className="input-field" placeholder="EMAIL ID 2" value={addressFormData.email2 || ''} onChange={(e) => setAddressFormData(prev => ({...prev, email2: e.target.value}))} style={{ flex: 1, border: '1px solid #000000' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <label style={{ width: '60px' }}>Website</label>
                    <input type="text" className="input-field" placeholder="WEBSITE" value={addressFormData.website || ''} onChange={(e) => setAddressFormData(prev => ({...prev, website: e.target.value}))} style={{ flex: 1, border: '1px solid #000000' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <label style={{ width: '80px' }}>TAN No</label>
                    <input type="text" className="input-field" placeholder="PARTY TAN NO" value={addressFormData.tanNo || ''} onChange={(e) => setAddressFormData(prev => ({...prev, tanNo: e.target.value}))} style={{ flex: 1, border: '1px solid #000000' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <label style={{ width: '100px' }}>UNLOC City</label>
                    <input type="text" className="input-field" placeholder="UNLOC CODE CITY" value={addressFormData.unlocCity || ''} onChange={(e) => setAddressFormData(prev => ({...prev, unlocCity: e.target.value}))} style={{ flex: 1, border: '1px solid #000000', color: 'var(--text-main, var(--text-main, #0f172a))' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Disabled <input type="checkbox" checked={!!addressFormData.disabled} onChange={(e) => setAddressFormData(prev => ({...prev, disabled: e.target.checked}))} /></label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Sez <input type="checkbox" checked={!!addressFormData.sez} onChange={(e) => setAddressFormData(prev => ({...prev, sez: e.target.checked}))} /></label>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '8px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '120px' }}>GST Exempted <input type="checkbox" checked={!!addressFormData.gstExempted} onChange={(e) => setAddressFormData(prev => ({...prev, gstExempted: e.target.checked}))} /></label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <label style={{ width: '130px' }}>SEZ Warehouse Code</label>
                    <input type="text" className="input-field" placeholder="SEZ WAREHOUSE CODE" value={addressFormData.sezWarehouseCode || ''} onChange={(e) => setAddressFormData(prev => ({...prev, sezWarehouseCode: e.target.value}))} style={{ flex: 1, border: '1px solid #000000' }} />
                  </div>
<button className="btn btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '11px', color: '#fff', background: '#3b82f6', borderColor: '#3b82f6', fontWeight: 600 }} onClick={() => {
    let currentP = selectedParty || { name: '', addresses: [] };
    
    const newAddr = { ...addressFormData };
    // 28-Oct-2026: upper case + checks; email / PIN / default go to the saved columns (email1, pinCode, isDefault)
    ['address1', 'address2', 'city', 'regNo', 'tanNo', 'branchName'].forEach(k => { if (typeof newAddr[k] === 'string') newAddr[k] = newAddr[k].trim().toUpperCase(); });
    if (!newAddr.address1) return customAlert("Address Line 1 is mandatory - error");
    if (!newAddr.city) return customAlert("City is mandatory - error");
    if (newAddr.country === 'IN' && newAddr.pinCode && !/^\d{6}$/.test(String(newAddr.pinCode).trim())) return customAlert("PIN code must be 6 digits for India - error");
    if (newAddr.ctxType === 'GSTIN' && newAddr.regNo && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(newAddr.regNo)) return customAlert("GSTIN must be 15 characters like 27ABCDE1234F1Z5 - error");
    if (newAddr.ctxType === 'GSTIN' && newAddr.regNo && newAddr.ctxCode && newAddr.regNo.slice(0, 2) !== String(newAddr.ctxCode).padStart(2, '0')) return customAlert("GSTIN first 2 digits do not match the CTX state code - error");
    if (newAddr.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(newAddr.email).trim())) return customAlert("Email ID 1 is not valid - error");
    newAddr.email1 = newAddr.email || '';
    newAddr.zip = newAddr.pinCode || '';
    newAddr.gstin = newAddr.regNo || '';
    newAddr.isDefault = !!newAddr.default;
    
    // Check for duplicate entry (same GSTIN or same Address1) before adding
    const isDuplicate = (currentP.addresses || []).some(a => 
        a.branchSrNo !== newAddr.branchSrNo && (
          // 14-Nov-2026: one GSTIN can have many places of business (DGFT lists them), so only the same Address1 is a duplicate
          (a.address1 && newAddr.address1 && a.address1.trim().toLowerCase() === newAddr.address1.trim().toLowerCase())
        )
    );
    
    if (isDuplicate) {
        return customAlert("Duplicate Entry Blocked: this Address1 already exists in the grid!");
    }

    if (!newAddr.branchSrNo) {
        newAddr.branchSrNo = String((currentP.addresses || []).length + 1);
    }
    
    const existingIndex = (currentP.addresses || []).findIndex(a => a.branchSrNo === newAddr.branchSrNo);
    let updatedAddresses = [...(currentP.addresses || [])];
    
    if (existingIndex >= 0) {
        updatedAddresses[existingIndex] = newAddr;
    } else {
        updatedAddresses.push(newAddr);
    }
    // only one default address; the first one is default when none is marked
    if (newAddr.default) updatedAddresses = updatedAddresses.map(a => a === newAddr ? a : { ...a, default: false, isDefault: false });
    if (!updatedAddresses.some(a => a.default)) updatedAddresses[0] = { ...updatedAddresses[0], default: true, isDefault: true };
    
    setSelectedParty(prev => ({ ...(prev || {}), ...formData, addresses: updatedAddresses }));
    setAddressFormData({}); // clear form
}}>
<PlusCircle size={14}/> { ((selectedParty?.addresses || []).some(a => a.branchSrNo === addressFormData.branchSrNo)) ? 'Update' : 'Add' }</button>
                </div>

                {/* Grid showing added addresses */}
                <div style={{ overflowX: 'auto', border: '1px solid #000000', borderRadius: '6px', marginTop: '0.5rem', flex: 1 }}>
                  <table style={{ width: '100%', minWidth: '2200px', borderCollapse: 'collapse', fontSize: '11px', whiteSpace: 'nowrap' }}>
                    <thead style={{ background: '#fffbeb' }}>
                      <tr>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Edit</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Delete</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Sr. No</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Default</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Branch Name</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Address1</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Address2</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>City</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Pin Code</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>State</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Country</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>CTX Type</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>CTX State</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Reg. No</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Phone</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Mobile</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Fax</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Email1</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Email2</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Website</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>TAN No</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>UNLOC City</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Disabled</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>SEZ</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>GST Exempted</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>SEZ Warehouse Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedParty?.addresses || []).map((addr, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
                          <td style={{ padding: '0.5rem' }}><span style={{ color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setAddressFormData(withCtxCode(addr))}>Edit</span></td>
                          <td style={{ padding: '0.5rem' }}><span style={{ color: '#ef4444', cursor: 'pointer', fontWeight: 600 }} onClick={() => setDeleteConfirm({ isOpen: true, type: 'ADDRESS', payload: idx })}>Delete</span></td>
                          <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600, color: 'var(--primary-color)' }}>{addr.branchSrNo}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <input type="radio" name="default_addr" checked={!!addr.default} onChange={() => setSelectedParty(prev => ({ ...(prev || {}), ...formData, addresses: (prev?.addresses || []).map((a, i) => ({ ...a, default: i === idx, isDefault: i === idx })) }))} />
                          </td>
                          <td style={{ padding: '0.5rem', fontWeight: 500 }}>{addr.branchName || addr.branch}</td>
                          <td style={{ padding: '0.5rem', whiteSpace: 'normal', minWidth: '200px' }}>{addr.address1 || addr.address}</td>
                          <td style={{ padding: '0.5rem' }}>{addr.address2}</td>
                          <td style={{ padding: '0.5rem' }}>{addr.city}</td>
                            <td style={{ padding: '0.5rem' }}>{addr.pinCode || addr.zip}</td>
                            <td style={{ padding: '0.5rem' }}>{addr.state}</td>
                            <td style={{ padding: '0.5rem' }}>{addr.country}</td>
                            <td style={{ padding: '0.5rem' }}>{addr.ctxType}</td>
                            <td style={{ padding: '0.5rem' }}>{addr.ctxState}</td>
                            <td style={{ padding: '0.5rem' }}>{addr.regNo || addr.gstin}</td>
                            <td style={{ padding: '0.5rem' }}>{addr.phone}</td>
                            <td style={{ padding: '0.5rem' }}>{addr.mobile}</td>
                            <td style={{ padding: '0.5rem' }}>{addr.fax}</td>
                            <td style={{ padding: '0.5rem' }}>{addr.email1}</td>
                            <td style={{ padding: '0.5rem' }}>{addr.email2}</td>
                            <td style={{ padding: '0.5rem' }}>{addr.website}</td>
                            <td style={{ padding: '0.5rem' }}>{addr.tanNo}</td>
                            <td style={{ padding: '0.5rem' }}>{addr.unlocCity}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}><input type="checkbox" checked={addr.disabled} disabled /></td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}><input type="checkbox" checked={addr.sez} disabled /></td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}><input type="checkbox" checked={addr.gstExempted} disabled /></td>
                            <td style={{ padding: '0.5rem' }}>{addr.sezWarehouseCode}</td>
                          </tr>
                      ))}
                      {(!selectedParty?.addresses || selectedParty.addresses.length === 0) && (
                        <tr>
                          <td colSpan="26" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            No branch addresses saved for this party.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
    </>
  );
}
