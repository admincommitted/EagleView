// Screen section: Special Handling Code (SHC) Conflicts
// Split out of TactMasterForm.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import AircraftCommandCenter from '../../AircraftCommandCenter';
import React from 'react';

export default function SpecialHandlingCodeSection({ ctx }) {
  const { activeSubTab, filteredAddons, filteredShcConflicts, selectedAircraft, setSelectedAircraft } = ctx;
  return (
    <>
    {activeSubTab === 'shc' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Special Handling Code (SHC) Conflicts</h3>
                <span style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', color: '#ffffff', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                  Total Records: {filteredShcConflicts.length}
                </span>
              </div>
              <div style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table className="tact-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', textAlign: 'left', fontSize: '14px', color: '#ffffff', position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Primary SHC</th>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Conflicting SHC</th>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Conflict Type</th>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShcConflicts.map(shc => (
                    <tr key={shc.id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '14px' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold', border: '1px solid #e2e8f0', color: '#ef4444' }}>{shc.shcCode1}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold', border: '1px solid #e2e8f0', color: '#ef4444' }}>{shc.shcCode2}</td>
                      <td style={{ padding: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#f59e0b' }}>{shc.isProhibited ? 'PROHIBITED' : 'WARNING'}</td>
                      <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>{shc.conflictReason || shc.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </div>
          )}

          
          {/* TACT PROPORTIONAL ADD-ONS */}
          {activeSubTab === 'addons' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>TACT Proportional (Add-on) Rates</h3>
                <span style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', color: '#ffffff', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                  Total Records: {filteredAddons.length}
                </span>
              </div>
              <div style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table className="tact-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', textAlign: 'left', fontSize: '14px', color: '#ffffff', position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Gateway Airport (Hub)</th>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Local Airport (Spoke)</th>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Add-on Amount</th>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Currency</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAddons.map(addon => (
                    <tr key={addon.id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '14px' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold', border: '1px solid #e2e8f0', color: '#1e40af' }}>{addon.gatewayAirport}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold', border: '1px solid #e2e8f0', color: '#0f766e' }}>{addon.localAirport}</td>
                      <td style={{ padding: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#b45309' }}>{addon.addonAmount.toFixed(2)}</td>
                      <td style={{ padding: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>{addon.currencyCode}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AIRCRAFT COMMAND CENTER MODAL */}


      {selectedAircraft && <AircraftCommandCenter aircraft={selectedAircraft} onClose={() => setSelectedAircraft(null)} />}
    </>
  );
}
