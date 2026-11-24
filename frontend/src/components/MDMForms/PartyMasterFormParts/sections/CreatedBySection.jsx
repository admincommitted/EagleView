// Screen section: Created By:
// Split out of PartyMasterForm.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React, { useState } from 'react';
import { Save } from 'lucide-react';

export default function CreatedBySection({ ctx }) {
  const { addressFormData, customAlert, formData, partiesList, selectedParty, setDeleteConfirm, setPartiesList, setSelectedParty, setShowKycVault } = ctx;
  const [savingParty, setSavingParty] = useState(false); // 14-Nov-2026: Save shows "Saving..." and cannot be clicked twice while the server works
  return (
    <>
    <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column-reverse', gap: '0.5rem', borderTop: '1px solid var(--border-color)', marginTop: 'auto', background: 'var(--bg-app, var(--bg-app, #f8fafc))' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '1.5rem', width: '100%', justifyContent: 'flex-start' }}>
            {selectedParty ? (
              <>
                <span><b style={{ color: 'var(--text-main, var(--text-main, #0f172a))' }}>Created By:</b> ADMIN ({new Date(selectedParty.createdAt || Date.now()).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()})</span>
                <span><b style={{ color: 'var(--text-main, var(--text-main, #0f172a))' }}>Last Modified By:</b> ADMIN ({new Date(selectedParty.updatedAt || Date.now()).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()})</span>
              </>
            ) : (
              <span>New Record Mode</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', paddingRight: '0', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                {selectedParty?.kycStatus === 'APPROVED' && <span style={{fontSize: '11px', fontWeight: 'bold', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '12px', whiteSpace: 'nowrap'}}>✅ KYC APPROVED</span>}
                {selectedParty?.kycStatus === 'REJECTED' && <span style={{fontSize: '11px', fontWeight: 'bold', color: '#dc2626', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '12px', whiteSpace: 'nowrap'}}>❌ KYC REJECTED</span>}
                {(!selectedParty?.kycStatus || selectedParty?.kycStatus === 'PENDING') && selectedParty?.id && <span style={{fontSize: '11px', fontWeight: 'bold', color: '#d97706', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '12px', whiteSpace: 'nowrap'}}>⏳ KYC PENDING</span>}
                {selectedParty?.kycLastSentAt && <span style={{fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 'normal', whiteSpace: 'nowrap'}}>Sent for approval: {new Date(selectedParty.kycLastSentAt).toLocaleString()}</span>}
            </div>

            <div style={{display: 'flex', gap: '0.4rem', alignItems: 'center', paddingRight: '70px'}}>
                <button className="btn" style={{ padding: '0.25rem 0.65rem', fontSize: '11px', fontWeight: 600, letterSpacing: '0.2px', background: 'var(--text-muted, var(--text-muted, #64748b))', color: '#fff', border: 'none', whiteSpace: 'nowrap' }} onClick={() => setSelectedParty(null)}>New / Clear</button>
                <button className="btn" style={{ padding: '0.25rem 0.65rem', fontSize: '11px', fontWeight: 600, letterSpacing: '0.2px', background: '#ef4444', color: '#fff', border: 'none', whiteSpace: 'nowrap' }} onClick={() => { if(!selectedParty?.id) return customAlert('Please select a Party to delete.'); setDeleteConfirm({ isOpen: true, type: 'PARTY', payload: selectedParty.id }); }}>Delete</button>
                <button className="btn btn-secondary" onClick={(e) => {
                  e.preventDefault();
                  if(!selectedParty || !selectedParty.id) return customAlert('Please select or save a Party first before uploading KYC documents.');
                  setShowKycVault(true);
                }} style={{ padding: '0.25rem 0.65rem', fontSize: '11px', fontWeight: 600, letterSpacing: '0.2px', color: '#fff', background: '#ec4899', borderColor: '#ec4899', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>🔐 KYC Vault</button>
                <button className="btn btn-primary" style={{ padding: '0.25rem 0.65rem', fontSize: '11px', fontWeight: 500, letterSpacing: '0.2px', background: 'linear-gradient(135deg, #2563eb, #6366f1)', whiteSpace: 'nowrap' }} onClick={() => {
if (savingParty) return;
    // Read from React state — no DOM scraping needed
    const finalName = formData.name.trim().toUpperCase();
    const finalPan = formData.panNumber.trim().toUpperCase();
    const finalIecVal = formData.taxId.trim().toUpperCase();

    // First try grid (if they clicked + ADD), else fallback to addressFormData
    let gridAddress = null;
    let currP = selectedParty || {};
    if (currP.addresses && currP.addresses.length > 0) {
        gridAddress = currP.addresses[0];
    }

    const finalAddr1 = (gridAddress?.address1 || gridAddress?.address || addressFormData.address1 || selectedParty?.street || '').toUpperCase();
    const finalCity = (gridAddress?.city || addressFormData.city || selectedParty?.city || '').toUpperCase();
    const finalState = (gridAddress?.state || addressFormData.state || selectedParty?.stateProvince || '').toUpperCase();
    const finalCountry = (gridAddress?.country || addressFormData.country || selectedParty?.countryCode || '').toUpperCase();
    const finalZip = (gridAddress?.zip || gridAddress?.pinCode || addressFormData.pinCode || selectedParty?.zipPostcode || '').toUpperCase();
    const finalMobile = (gridAddress?.mobile || gridAddress?.phone || addressFormData.mobile || selectedParty?.phoneNumber || '').toUpperCase();
    const finalEmail = (gridAddress?.email || gridAddress?.email1 || addressFormData.email || selectedParty?.email || '');

    if (!finalName) return customAlert("Party Name is mandatory!");
    if (!finalAddr1) return customAlert("Address is mandatory!");
    if (!finalCity) return customAlert("City is mandatory!");
    if (!finalCountry || finalCountry.length !== 2) return customAlert("Country Code must be exactly 2 characters (e.g., IN, US).");

    const isDuplicate = partiesList.some(p => 
        p.id !== selectedParty?.id && (
            (p.name && p.name.toUpperCase() === finalName)
        )
    );
    
    if (isDuplicate) {
        return customAlert("Duplicate Entry Blocked: A Party with this Name already exists in the Master Directory!");
    }

    // 28-Oct-2026: PAN format check (10 characters: AAAAA9999A)
    if (finalPan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(finalPan)) return customAlert("PAN must be 10 characters like ABCDE1234F - error");
    if (finalEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(finalEmail.trim())) return customAlert("Email ID is not valid - error");

    if (formData.iecNoReqd) {
        if (!finalIecVal || finalIecVal.length !== 10 || !/^[A-Z0-9]{10}$/i.test(finalIecVal)) {
            return customAlert("IEC Number is mandatory and must be exactly 10 alphanumeric characters when 'IEC NO. REQD.' is checked!");
        }
    }

    const payload = {
        partyType: "MULTI",
          isShipper: formData.isShipper,
          isConsignee: formData.isConsignee,
          isNotifyParty: formData.isNotifyParty,
          isBuyer: formData.isBuyer,
          isSubAgent: formData.isSubAgent,
          isOverseasAgent: formData.isOverseasAgent,
          isShipline: !!formData.isShipline,
          isIataAgent: !!formData.isIataAgent,
          isBank: !!formData.isBank,
        name: finalName,
        code: (selectedParty && selectedParty.code) || "", // 04-Nov-2026: keep the iCAFFE code (SHP/123) on save
        street: finalAddr1.substring(0, 70),
        city: finalCity.substring(0, 17),
        stateProvince: finalState,
        countryCode: finalCountry.substring(0, 2),
        zipPostcode: finalZip.substring(0, 9),
        phoneNumber: finalMobile,
        email: finalEmail,
        taxId: finalIecVal,
          panNumber: finalPan,
          kycApproved: formData.kycApproved,
          extendedName: formData.extendedName.trim(),
          mercManuf: formData.mercManuf,
          rbiNumber: formData.rbiNumber.trim(),
          marketingPerson1: formData.marketingPerson1.trim(),
          marketingPerson2: formData.marketingPerson2.trim(),
          marketingPerson3: formData.marketingPerson3.trim(),
          sezWarehouseCode: formData.sezWarehouseCode.trim(),
          iecNoReqd: formData.iecNoReqd,
          classType: formData.classType,
          paymentDeferred: formData.paymentDeferred,
          blackList: formData.blackList,
          insuranceRate: formData.insuranceRate.trim(),
          remarks: formData.remarks.trim(),
          aiImportRules: formData.aiImportRules || '',
          aiExportRules: formData.aiExportRules || '',
        branches: currP.addresses || [],
        adCodes: currP.adCodes || [],
        drawbackAccounts: currP.drawbackAccounts || []
    };

    const url = selectedParty?.id 
        ? `/api/masters/parties/${selectedParty.id}`
        : '/api/masters/parties';

    setSavingParty(true);
    fetch(url, {
        method: selectedParty?.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success || data.id) {
            customAlert(`SUCCESS: Party Data ${selectedParty?.id ? 'Updated' : 'Saved'}!`);
            
            // Update UI list
            if (selectedParty?.id) {
setPartiesList(prev => prev.map(p => p.id === selectedParty.id ? { ...p, ...payload, addresses: payload.branches } : p));
            } else {
                const newMapped = {
                    ...(data.data || data),
                    id: (data.data && data.data.id) || data.id || Math.random(),
                    addresses: currP.addresses || []
                };
                setPartiesList(prev => [newMapped, ...prev]);
                setSelectedParty(newMapped);
            }
        } else {
            customAlert("API ERROR: " + (data.error || "Failed to save"));
        }
    })
    .catch(err => {
        console.error(err);
        customAlert("NETWORK ERROR: Could not reach the server.");
    })
    .finally(() => setSavingParty(false));
}} id="partyMasterMainSaveBtn" disabled={savingParty} aria-busy={savingParty}><Save size={13}/> {savingParty ? 'Saving...' : 'Save'}</button>
          </div>
          </div>
        </div>
    </>
  );
}
