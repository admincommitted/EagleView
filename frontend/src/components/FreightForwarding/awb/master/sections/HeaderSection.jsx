// Form section: AWB TYPE
// Split out of CreateMasterWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';
import MissingStrip from '../../MissingStrip';
import { TemplatePicker } from '../../awbActions'; // TEMPLATE list with the saved templates (29-Oct-2026)

export default function HeaderSection({ ctx }) {
  const { handleLoadTemplate, navigate, productId, selectedTemplate, setProductId, setSelectedTemplate, setShowAwbVault } = ctx;
  return (
    <>
    {/* AWB Type Selector */}

      <div style={{ backgroundColor: '#f8fafc', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>&#x2708;️</span>
              <h2 style={{ margin: '0', color: '#0f172a', fontSize: '15px', fontWeight: '900', letterSpacing: '0.5px' }}>AWB TYPE</h2>
            </div>
            
            <div style={{ display: 'flex', backgroundColor: 'transparent', padding: '3px', borderRadius: '6px', gap: '2px' }}>
              <label onClick={() => navigate('/freight/create-awb')} style={{ padding: '6px 16px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px', backgroundColor: window.location.pathname.includes('/create-awb') ? '#bfdbfe' : 'transparent', color: window.location.pathname.includes('/create-awb') ? '#1e3a8a' : '#475569', boxShadow: window.location.pathname.includes('/create-awb') ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s ease' }}>
                <input type="radio" name="awbType" value="normal" checked={window.location.pathname.includes('/create-awb')} onChange={() => navigate('/freight/create-awb')} style={{ display: 'none' }} /> DIRECT AWB
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRight: '1px solid #94a3b8', paddingRight: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', whiteSpace: 'nowrap' }}>TYPE:</label>
                <select className="premium-input" value={productId} onChange={e => setProductId(e.target.value)} style={{ padding: '2px 8px', fontSize: '11px', border: '1px solid #94a3b8', height: '26px', boxSizing: 'border-box', borderRadius: '4px', minWidth: '130px', fontWeight: 'bold', color: '#0f172a', backgroundColor: '#f8fafc', cursor: 'pointer' }}>
                  <option value="GEN">GEN — General</option>
                  <option value="EXC">EXC — Express</option>
                </select>
              </div>

              <label onClick={() => navigate('/freight/create-mawb')} style={{ padding: '6px 16px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px', backgroundColor: window.location.pathname.includes('/create-mawb') ? '#bbf7d0' : 'transparent', color: window.location.pathname.includes('/create-mawb') ? '#14532d' : '#475569', boxShadow: window.location.pathname.includes('/create-mawb') ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s ease' }}>
                <input type="radio" name="awbType" value="master" checked={window.location.pathname.includes('/create-mawb')} onChange={() => navigate('/freight/create-mawb')} style={{ display: 'none' }} /> MASTER (MAWB) — CON
              </label>
              <label onClick={() => navigate('/freight/create-hawb')} style={{ padding: '6px 16px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px', backgroundColor: window.location.pathname.includes('/create-hawb') ? '#fef08a' : 'transparent', color: window.location.pathname.includes('/create-hawb') ? '#713f12' : '#475569', boxShadow: window.location.pathname.includes('/create-hawb') ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s ease' }}>
                <input type="radio" name="awbType" value="house" checked={window.location.pathname.includes('/create-hawb')} onChange={() => navigate('/freight/create-hawb')} style={{ display: 'none' }} /> HOUSE (HAWB)
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              {/* 29-Oct-2026: said "all fields are mandatory" (they are not); now it opens the EDI check that lists what is missing */}
              {/* 22-Nov-2026: the fixed "e-AWB needs complete data" button is now a live line of what is still empty */}
              <MissingStrip ctx={ctx} />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={() => setShowAwbVault(true)} style={{ backgroundColor: 'var(--primary-color-start, var(--primary-color-start, #ec4899))', color: 'white', border: 'none', borderRadius: '4px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px var(--primary-shadow, rgba(236,72,153,0.3))' }}>
                  📄 DOCS
                </button>
                
                <TemplatePicker ctx={ctx} type="MAWB" />
              </div>
          </div>
        </div>

      {/* Main Content */}
    </>
  );
}
