// Screen section: Party Details
// Split out of PartyMasterForm.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';
import { Search, Users } from 'lucide-react';
import DgftIecModal from './DgftIecModal';
import { mercView } from '../dgftMatch';

export default function PartyDetailsSection({ ctx }) {
  const { customAlert, formData, handleFetchIecFromUlip, setFormData, dgftOpen, setDgftOpen, openDgft, addDgftBranches, fillPartyFromDgft, applyDgftName, selectedParty } = ctx;
  return (
    <>
    {/* Primary Details (Shipper Details) */}
            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)', flexShrink: 0 }}>
              <div style={{ background: '#f0f9ff', padding: '0.5rem 1rem', borderBottom: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ color: 'var(--primary-text, #0369a1)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '11px' }}>
                  <Users size={14} /> Party Details
                </h3>
              </div>

              <div style={{ padding: '8px', display: 'flex', gap: '2rem' }}>
                {/* Left Col */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '6px 10px', borderRadius: '6px', border: '1px solid #000000' }}>
                      <label style={{ width: '120px', fontWeight: 'bold', color: 'var(--primary-text, #0369a1)', fontSize: '11px' }}>PARTY TYPE:</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', flex: 1 }}>
                        <label style={{display:'flex', alignItems:'center', gap:'4px', cursor:'pointer', fontSize: '11px'}}><input type="checkbox" className="role-cb" value="isShipper" checked={formData.isShipper} onChange={e => setFormData(prev => ({...prev, isShipper: e.target.checked}))} /> Exporter / Importer</label>
                        <label style={{display:'flex', alignItems:'center', gap:'4px', cursor:'pointer', fontSize: '11px'}}><input type="checkbox" className="role-cb" value="isConsignee" checked={formData.isConsignee} onChange={e => setFormData(prev => ({...prev, isConsignee: e.target.checked}))} /> Consignee / Supplier</label>
                        <label style={{display:'flex', alignItems:'center', gap:'4px', cursor:'pointer', fontSize: '11px'}}><input type="checkbox" className="role-cb" value="isNotifyParty" checked={formData.isNotifyParty} onChange={e => setFormData(prev => ({...prev, isNotifyParty: e.target.checked}))} /> Notify</label>
                        <label style={{display:'flex', alignItems:'center', gap:'4px', cursor:'pointer', fontSize: '11px'}}><input type="checkbox" className="role-cb" value="isBuyer" checked={formData.isBuyer} onChange={e => setFormData(prev => ({...prev, isBuyer: e.target.checked}))} /> Buyer</label>
                        <label style={{display:'flex', alignItems:'center', gap:'4px', cursor:'pointer', fontSize: '11px'}}><input type="checkbox" className="role-cb" value="isSubAgent" checked={formData.isSubAgent} onChange={e => setFormData(prev => ({...prev, isSubAgent: e.target.checked}))} /> Sub Agent</label>
                        <label style={{display:'flex', alignItems:'center', gap:'4px', cursor:'pointer', fontSize: '11px'}}><input type="checkbox" className="role-cb" value="isOverseasAgent" checked={formData.isOverseasAgent} onChange={e => setFormData(prev => ({...prev, isOverseasAgent: e.target.checked}))} /> Overseas Agnt</label>
                        <label style={{display:'flex', alignItems:'center', gap:'4px', cursor:'pointer', fontSize: '11px'}}><input type="checkbox" className="role-cb" value="isShipline" checked={!!formData.isShipline} onChange={e => setFormData(prev => ({...prev, isShipline: e.target.checked}))} /> Shipline</label>
                        <label style={{display:'flex', alignItems:'center', gap:'4px', cursor:'pointer', fontSize: '11px'}}><input type="checkbox" className="role-cb" value="isBank" checked={!!formData.isBank} onChange={e => setFormData(prev => ({...prev, isBank: e.target.checked}))} /> Bank BRO</label>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ width: '130px' }}>Party Name <span style={{color: 'red'}}>*</span></label>
                    <input type="text" className="input-field" maxLength="50" title="ICEGATE takes 50 characters; AWB / IATA EDI keeps the first 35" name="name" placeholder="NAME" style={{ flex: 1, border: '1px solid #ef4444', boxShadow: (formData.name || '').length >= 50 ? '0 0 4px red' : 'none' }} value={formData.name} onChange={e => setFormData(prev => ({...prev, name: e.target.value}))} />
                    {(formData.name || '').length > 35 && <span style={{ fontSize: '10px', color: '#b45309', whiteSpace: 'nowrap', textTransform: 'none' }} title="ICEGATE takes 50 characters; AWB / IATA EDI keeps the first 35">{(formData.name || '').length}/50, AWB keeps 35</span>}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', border: '1px solid #000000', padding: '4px 8px', borderRadius: '4px', color: '#047857', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }} title="Mark as KYC Verified">
                        <input type="checkbox" name="kycApproved" checked={formData.kycApproved} style={{ cursor: 'pointer', width: '14px', height: '14px' }} onChange={(e) => { setFormData(prev => ({...prev, kycApproved: e.target.checked})); if(e.target.checked) customAlert('KYC marked as APPROVED! Make sure documents are uploaded in the Vault.'); }} /> KYC APPROVED ✅
                    </label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ width: '130px' }}>Extended Name</label><input type="text" className="input-field" name="extendedName" value={formData.extendedName} onChange={e => setFormData(prev => ({...prev, extendedName: e.target.value}))} placeholder="EXTENDED NAME" style={{ flex: 1, border: '1px solid #000000' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ width: '130px' }}>[R]Merc / [F]Manuf</label>
                      <select className="input-field" name="mercManuf" value={mercView(formData.mercManuf)} onChange={e => setFormData(prev => ({...prev, mercManuf: e.target.value}))} style={{ flex: 1, border: '1px solid #ef4444', color: 'var(--primary-color-end, #2563eb)' }}>
                        <option value="Manufacturer">Manufacturer</option>
                        <option value="Merchant">Merchant</option>
                        <option value="Merchant Exporter Courier [C]">Merchant Exporter Courier [C]</option>
                        <option value="Manufacturer Exporter Courier [D]">Manufacturer Exporter Courier [D]</option>
                      </select>
                  </div>
                    
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ width: '130px' }}>RBI Number</label>
                    <input type="text" className="input-field" name="rbiNumber" placeholder="RBI NUMBER" style={{ flex: 1 }} value={formData.rbiNumber} onChange={e => setFormData(prev => ({...prev, rbiNumber: e.target.value}))} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ width: '130px' }}>Marketing Person2</label>
                    <input type="text" className="input-field" name="marketingPerson2" placeholder="MARKETING PERSON2" value={formData.marketingPerson2} onChange={e => setFormData(prev => ({...prev, marketingPerson2: e.target.value}))} style={{ flex: 1, border: '1px solid #000000', color: 'var(--text-main, var(--text-main, #0f172a))' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ width: '130px' }}>Branch</label>
                    <input type="text" className="input-field" placeholder="BRANCH" style={{ flex: 1, border: '1px solid #000000', color: 'var(--text-main, var(--text-main, #0f172a))' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <label style={{ width: '130px' }}>SEZ Warehouse Code</label>
                      <input type="text" className="input-field" name="sezWarehouseCode" value={formData.sezWarehouseCode} onChange={e => setFormData(prev => ({...prev, sezWarehouseCode: e.target.value}))} placeholder="SEZ WAREHOUSE CODE" style={{ flex: 1 }} />
                    </div>
                </div>

                {/* Right Col */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ width: '130px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>IEC / TAX ID / EORI <input type="checkbox" name="iecNoReqd" checked={formData.iecNoReqd} onChange={e => setFormData(prev => ({...prev, iecNoReqd: e.target.checked}))} /></label>
                    <input type="text" className="input-field" placeholder="IEC / EORI / VAT" style={{ flex: 1, border: '1px solid #ef4444', color: '#94a3b8' }} value={formData.taxId} onChange={e => setFormData(prev => ({...prev, taxId: e.target.value}))} />
                      <button className="btn btn-secondary" style={{ padding: '0 8px', height: '24px', fontSize: '10px', background: 'linear-gradient(135deg, var(--primary-color-start, #0284c7), var(--primary-color-end, #075985))', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={openDgft} title="Opens the DGFT captcha here and lists all IEC branches">
                        <Search size={12} /> Fetch from DGFT
                      </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ width: '130px' }}>Class</label>
                      <select className="input-field" name="classType" value={formData.classType} onChange={e => setFormData(prev => ({...prev, classType: e.target.value}))} style={{ flex: 1, border: '1px solid #ef4444', color: 'var(--primary-color-end, #2563eb)' }}>
                        <option value="Private">Private</option>
                        <option value="Government">Government</option>
                        <option value="Undertaking">Undertaking</option>
                        <option value="Others">Others</option>
                        <option value="Warehouse Shipping Bill [W]">Warehouse Shipping Bill [W]</option>
                      </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {/* 17-Nov-2026: not mandatory - an individual importer may have only Aadhar / passport (CTX type on the branch) */}
                    <label style={{ width: '130px' }} title="Optional - individuals may have only Aadhar or a passport">PAN Number</label>
                    <input type="text" className="input-field" placeholder="PAN NUMBER (IF ANY)" style={{ flex: 1, border: '1px solid #000000' }} value={formData.panNumber} onChange={e => setFormData(prev => ({...prev, panNumber: e.target.value}))} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ width: '130px' }}>Marketing Person1</label>
                    <input type="text" className="input-field" name="marketingPerson1" placeholder="MARKETING PERSON1" value={formData.marketingPerson1} onChange={e => setFormData(prev => ({...prev, marketingPerson1: e.target.value}))} style={{ flex: 1, border: '1px solid #000000', color: 'var(--text-main, var(--text-main, #0f172a))' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ width: '130px' }}>Marketing Person3</label>
                    <input type="text" className="input-field" name="marketingPerson3" placeholder="MARKETING PERSON3" value={formData.marketingPerson3} onChange={e => setFormData(prev => ({...prev, marketingPerson3: e.target.value}))} style={{ flex: 1, border: '1px solid #000000', color: 'var(--text-main, var(--text-main, #0f172a))' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '2px 0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '180px' }}>Payment Method Deffered? <input type="checkbox" name="paymentDeferred" checked={formData.paymentDeferred} onChange={e => setFormData(prev => ({...prev, paymentDeferred: e.target.checked}))} /></label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Black List <input type="checkbox" name="blackList" checked={formData.blackList} onChange={e => setFormData(prev => ({...prev, blackList: e.target.checked}))} /></label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ width: '130px' }}>Insurance Rate(%)</label>
                    <input type="text" className="input-field" name="insuranceRate" placeholder="INSURANCE RATE" value={formData.insuranceRate} onChange={e => setFormData(prev => ({...prev, insuranceRate: e.target.value}))} style={{ flex: 1 }} />
                  </div>
                </div>
              </div>
              <div style={{ padding: '0 8px 8px 8px', display: 'flex', gap: '4px' }}>
                <label style={{ width: '130px' }}>Remarks</label><input type="text" className="input-field" name="remarks" value={formData.remarks} onChange={e => setFormData(prev => ({...prev, remarks: e.target.value}))} style={{ flex: 1 }} />
              </div>
            </div>

            {/* Address Details */}
    <DgftIecModal open={dgftOpen} onClose={() => setDgftOpen(false)} iec={formData.taxId} name={formData.name} merc={formData.mercManuf} onUseName={applyDgftName} addresses={(selectedParty && selectedParty.addresses) || []} onAddBranches={addDgftBranches} onFillParty={fillPartyFromDgft} />
    </>
  );
}
