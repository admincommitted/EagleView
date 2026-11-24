import React, { useState } from 'react';

export default function PrintOptionsModal({ isOpen, onClose, onPrint }) {
  const [copies, setCopies] = useState({
    neutral: true,
    shipper: false,
    consignee: false,
    carrier: false,
    delivery: false,
    extra: false
  });
  
  const [includeTerms, setIncludeTerms] = useState(true);

  if (!isOpen) return null;

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setCopies(prev => ({ ...prev, [name]: checked }));
  };

  const handleProceed = (actionType) => {
    // Array of selected copies
    const selectedCopies = [];
    if (copies.shipper) selectedCopies.push("ORIGINAL 3 (FOR SHIPPER)");
    if (copies.consignee) selectedCopies.push("ORIGINAL 2 (FOR CONSIGNEE)");
    if (copies.carrier) selectedCopies.push("ORIGINAL 1 (FOR ISSUING CARRIER)");
    if (copies.delivery) selectedCopies.push("COPY 4 (DELIVERY RECEIPT)");
    if (copies.extra) selectedCopies.push("EXTRA COPY");
    if (copies.neutral) selectedCopies.push("");

    if (selectedCopies.length === 0) {
      alert("Please select at least one copy to print.");
      return;
    }

    onPrint({ selectedCopies, includeTerms, actionType });
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex',
        justifyContent: 'center', alignItems: 'center', zIndex: 9999
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal-box"
        style={{
          backgroundColor: '#ffffff', borderRadius: '8px', width: '400px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{ backgroundColor: '#0f172a', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>🖨️ AWB PRINT OPTIONS</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '16px', cursor: 'pointer' }}>✖</button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155' }}>Select Copies to Generate:</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#1e293b' }}>
              <input type="checkbox" name="neutral" checked={copies.neutral} onChange={handleCheckboxChange} style={{ width: '16px', height: '16px', accentColor: '#475569' }} />
              BLANK / NEUTRAL COPY (NO FOOTER)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#1e293b' }}>
              <input type="checkbox" name="shipper" checked={copies.shipper} onChange={handleCheckboxChange} style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }} />
              Original 3 (For Shipper) - <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>Blue</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#1e293b' }}>
              <input type="checkbox" name="consignee" checked={copies.consignee} onChange={handleCheckboxChange} style={{ width: '16px', height: '16px', accentColor: '#ec4899' }} />
              Original 2 (For Consignee) - <span style={{ color: '#ec4899', fontWeight: 'bold' }}>Pink</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#1e293b' }}>
              <input type="checkbox" name="carrier" checked={copies.carrier} onChange={handleCheckboxChange} style={{ width: '16px', height: '16px', accentColor: '#22c55e' }} />
              Original 1 (For Issuing Carrier) - <span style={{ color: '#22c55e', fontWeight: 'bold' }}>Green</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#1e293b' }}>
              <input type="checkbox" name="delivery" checked={copies.delivery} onChange={handleCheckboxChange} style={{ width: '16px', height: '16px', accentColor: '#eab308' }} />
              Copy 4 (Delivery Receipt) - <span style={{ color: '#eab308', fontWeight: 'bold' }}>Yellow</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#1e293b' }}>
              <input type="checkbox" name="extra" checked={copies.extra} onChange={handleCheckboxChange} style={{ width: '16px', height: '16px', accentColor: '#64748b' }} />
              EXTRA COPY (WHITE)
            </label>
          </div>

          <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }}></div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>
            <input type="checkbox" checked={includeTerms} onChange={(e) => setIncludeTerms(e.target.checked)} style={{ width: '16px', height: '16px' }} />
            Print Terms & Conditions (Back Side)
          </label>

        </div>

        {/* Footer */}
        <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0' }}>
          <button onClick={() => handleProceed('print')} style={{ backgroundColor: '#06b6d4', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s' }}>PRINT</button>
          <button onClick={() => handleProceed('pdf')} style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s' }}>DOWNLOAD PDF</button>
        </div>

      </div>
    </div>
  );
}







