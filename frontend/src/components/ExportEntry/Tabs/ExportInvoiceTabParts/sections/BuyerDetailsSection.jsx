// Screen section: Buyer Details
// Split out of ExportInvoiceTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';
import RichAutocomplete from '../../../../common/RichAutocomplete';

export default function BuyerDetailsSection({ ctx }) {
  const { buyerDetails, parties, setBuyerDetails, setFormData, setShowBuyerModal, showBuyerModal, setConsigneeSame } = ctx;
  // buyers of the party master first (then the rest)
  const buyerOptions = [...parties.filter(p => p.isBuyer || p.isConsignee), ...parties.filter(p => !(p.isBuyer || p.isConsignee))];
  return (
    <>
    {showBuyerModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: '4px', padding: '1rem', width: '500px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontFamily: 'sans-serif' }}>
            <h3 style={{ margin: '0 0 1rem 0', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', color: '#334155', fontWeight: 'normal' }}>Buyer Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <label style={{ width: '100px', fontWeight: '500', fontSize: '12px' }}>Buyer Name</label>
                <RichAutocomplete 
                  options={buyerOptions}
                  value={buyerDetails.name}
                  onChange={v => setBuyerDetails({...buyerDetails, name: v})}
                  onSelect={p => {
                      const branch = p.branches && p.branches.length > 0 ? p.branches.find(b => b.isDefault) || p.branches[0] : null;
                      setBuyerDetails({
                        ...buyerDetails, 
                        name: p.name, 
                        address1: branch?.address1 || p.street || '', 
                        address2: branch?.address2 || '',
                        address3: [branch?.city || p.city, branch?.state || p.stateProvince, branch?.pinCode || p.zipPostcode].filter(Boolean).join(' ').slice(0, 35),
                        address4: p.countryCode || '',
                        city: branch?.city || p.city || ''
                      });
                    }}
                  searchFilter={(p, q) => p.name?.toLowerCase()?.includes(q?.toLowerCase())}
                  renderOption={p => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{p.name}</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{p.street}, {p.city}</div>
                    </>
                  )}
                  placeholder="BUYER NAME"
                  inputStyle={{ border: '1px solid red' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <label style={{ width: '100px', fontSize: '12px' }}>Address1</label>
                <input type="text" className="input-field" placeholder="ADDRESS 1" style={{ flex: 1, border: '1px solid #0284c7' }} value={buyerDetails.address1} onChange={e => setBuyerDetails({...buyerDetails, address1: e.target.value})} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <label style={{ width: '100px', fontSize: '12px' }}>Address2</label>
                <input type="text" className="input-field" placeholder="ADDRESS 2" style={{ flex: 1, border: '1px solid #0284c7' }} value={buyerDetails.address2} onChange={e => setBuyerDetails({...buyerDetails, address2: e.target.value})} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <label style={{ width: '100px', fontSize: '12px' }}>Address3</label>
                <input type="text" className="input-field" placeholder="ADDRESS 3" style={{ flex: 1, border: '1px solid #0284c7' }} value={buyerDetails.address3} onChange={e => setBuyerDetails({...buyerDetails, address3: e.target.value})} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <label style={{ width: '100px', fontSize: '12px' }}>Address4</label>
                <input type="text" className="input-field" placeholder="ADDRESS 4" style={{ flex: 1, border: '1px solid #0284c7' }} value={buyerDetails.address4} onChange={e => setBuyerDetails({...buyerDetails, address4: e.target.value})} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button className="btn btn-success" style={{ padding: '0.25rem 1rem', background: '#4ade80', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={() => {
                  // buyer fields of the invoice (OK used to write the buyer into the THIRD PARTY fields)
                  if (!String(buyerDetails.name || '').trim()) { window.alert('Enter the buyer name'); return; }
                  setFormData(prev => ({
                    ...prev,
                    buyer: buyerDetails.name, buyerName: buyerDetails.name,
                    buyerAddress1: buyerDetails.address1 || '', buyerAddress2: buyerDetails.address2 || '',
                    buyerAddress3: buyerDetails.address3 || '', buyerAddress4: buyerDetails.address4 || '', buyerCity: buyerDetails.city || '',
                  }));
                  setShowBuyerModal(false);
                }}>OK</button>
              <button className="btn btn-secondary" style={{ padding: '0.25rem 1rem', background: '#fff', color: '#333', border: '1px solid var(--primary-border)', borderRadius: '4px', cursor: 'pointer' }} onClick={() => { setShowBuyerModal(false); if (!String(buyerDetails.name || '').trim() && setConsigneeSame) setConsigneeSame('Y'); }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
