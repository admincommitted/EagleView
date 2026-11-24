// Screen section: Section 7: Country Rules (Import/Export/Transit)
// Split out of TactMasterForm.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';
import { DgrLabel, generateLabelPdf, getChargeName } from '../helpers';

export default function Section7CountrySection({ ctx }) {
  const { activeSubTab, filteredCarrier, filteredCountry, filteredDgr, filteredEquipment, filteredExchangeRates, filteredSurcharges, filteredTactRates, getCompanyLogo, setSelectedAircraft } = ctx;
  return (
    <>
    {/* COUNTRY RULES */}
        {activeSubTab === 'country' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Section 7: Country Rules (Import/Export/Transit)</h3>
              <span style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', color: '#ffffff', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                Total Records: {filteredCountry.length}
              </span>
            </div>
            <div style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table className="tact-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', textAlign: 'left', fontSize: '14px', color: '#ffffff', position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Country</th>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Type</th>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Category</th>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Description</th>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Blocking</th>
                </tr>
              </thead>
              <tbody>
                {filteredCountry.map(rule => (
                  <tr key={rule.id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '14px' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold', border: '1px solid #e2e8f0' }}>{rule.countryCode}</td>
                    <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>{rule.ruleType}</td>
                    <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>{rule.category}</td>
                    <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>{rule.description}</td>
                    <td style={{ padding: '12px', color: rule.isBlocking ? '#ef4444' : '#f59e0b', fontWeight: 'bold', border: '1px solid #e2e8f0' }}>{rule.isBlocking ? 'Yes' : 'Warning'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>

              
            </div>
          )}

        {/* CARRIER EMBARGOES */}
        {activeSubTab === 'carrier' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Section 8: Carrier Embargoes</h3>
              <span style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', color: '#ffffff', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                Total Records: {filteredCarrier.length}
              </span>
            </div>
            <div style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table className="tact-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', textAlign: 'left', fontSize: '14px', color: '#ffffff', position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Carrier</th>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>SHC</th>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Description</th>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredCarrier.map(rule => (
                  <tr key={rule.id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '14px' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold', border: '1px solid #e2e8f0' }}>{rule.carrierCode}</td>
                    <td style={{ padding: '12px', border: '1px solid #e2e8f0', color: '#8b5cf6', fontWeight: 'bold' }}>{rule.shcCode}</td>
                    <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>{rule.description}</td>
                    <td style={{ padding: '12px', color: rule.isBlocking ? '#ef4444' : '#f59e0b', fontWeight: 'bold', border: '1px solid #e2e8f0' }}>{rule.isBlocking ? 'Active Block' : 'Warning'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>

              
            </div>
          )}

        {/* DGR MASTERS */}
          
        {activeSubTab === 'gcr' && (
            <div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>IATA General Cargo Rates (GCR) & Specific Commodity (SCR)</h3>
                  <span style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', color: '#ffffff', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                    Total Sectors: {filteredTactRates.length}
                  </span>
                </div>
                
                <div style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table className="tact-table" style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', textAlign: 'center', fontSize: '14px', color: '#ffffff', position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      <th style={{ padding: '12px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Origin</th>
                      <th style={{ padding: '12px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Dest</th>
                      <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Carrier</th>
                      <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Curr</th>
                      <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>MIN (M)</th>
                      <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>NORM (N)</th>
                      <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>+45 KG</th>
                      <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>+100 KG</th>
                      <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>+300 KG</th>
                      <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>+500 KG</th>
                      <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>+1000 KG</th>
                      <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>SCR / Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTactRates.map(sector => {
                      const getRate = (code, wt = 0) => {
                         const r = sector.rateDetails?.find(d => d.rateClassCode === code && d.weightBreak === wt);
                         return r ? r.rateAmount.toFixed(2) : '-';
                      };
                      const getSCR = () => {
                         const scrs = sector.rateDetails?.filter(d => d.rateClassCode === 'C' || d.rateClassCode === 'S');
                         if(!scrs || scrs.length === 0) return '-';
                         return scrs.map(r => `${r.rateClassCode} (${r.commodityItemNo}): ${r.rateAmount.toFixed(2)}`).join(' | ');
                      };
                      return (
                      <tr key={sector.id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '14px', textAlign: 'center' }}>
                        <td style={{ padding: '12px', border: '1px solid #e2e8f0', textAlign: 'left', fontWeight: 'bold', color: '#0f172a' }}>{sector.originCode}</td>
                        <td style={{ padding: '12px', border: '1px solid #e2e8f0', textAlign: 'left', fontWeight: 'bold', color: '#0f172a' }}>{sector.destinationCode}</td>
                        <td style={{ padding: '12px', border: '1px solid #e2e8f0', fontWeight: sector.carrierCode !== 'ALL' ? 'bold' : 'normal', color: sector.carrierCode !== 'ALL' ? '#ef4444' : 'inherit' }}>{sector.carrierCode}</td>
                        <td style={{ padding: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>{sector.currencyCode}</td>
                        <td style={{ padding: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>{getRate('M', 0)}</td>
                        <td style={{ padding: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>{getRate('N', 0)}</td>
                        <td style={{ padding: '12px', border: '1px solid #e2e8f0', color: '#059669', fontWeight: 'bold' }}>{getRate('Q', 45)}</td>
                        <td style={{ padding: '12px', border: '1px solid #e2e8f0', color: '#059669', fontWeight: 'bold' }}>{getRate('Q', 100)}</td>
                        <td style={{ padding: '12px', border: '1px solid #e2e8f0', color: '#059669', fontWeight: 'bold' }}>{getRate('Q', 300)}</td>
                        <td style={{ padding: '12px', border: '1px solid #e2e8f0', color: '#059669', fontWeight: 'bold' }}>{getRate('Q', 500)}</td>
                        <td style={{ padding: '12px', border: '1px solid #e2e8f0', color: '#059669', fontWeight: 'bold' }}>{getRate('Q', 1000)}</td>
                        <td style={{ padding: '12px', border: '1px solid #e2e8f0', color: '#d97706', fontWeight: 'bold' }}>{getSCR()}</td>
                      </tr>
                    )})}
                  </tbody>
                </table>
                    </div>
                  </div>
            </div>
        )}
    
{activeSubTab === 'dgr' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>IATA DGR Master Database</h3>
                <span style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', color: '#ffffff', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                  Total Records: {filteredDgr.length}
                </span>
              </div>
              <div style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table className="tact-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', textAlign: 'left', fontSize: '14px', color: '#ffffff', position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>UN Number</th>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Proper Shipping Name</th>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Class / Label</th>
                      <th style={{ padding: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>Label Size</th>
                      <th style={{ padding: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>Packing Group</th>
                      <th style={{ padding: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>CAO Only (Cargo Aircraft)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDgr.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '14px' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold', border: '1px solid #e2e8f0', color: '#ef4444' }}>{item.unNumber}</td>
                        <td style={{ padding: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#0f172a' }}>{item.properShippingName}</td>
                        <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '16px' }}>
                            <div onClick={() => generateLabelPdf(item)} style={{ cursor: "pointer", transition: "transform 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.2)"} onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"} title="Click to print HD PDF Label">
                              <DgrLabel classCode={item.classDivision} unNumber={item.unNumber} properName={item.properShippingName} />
                            </div>
                            <span style={{ fontWeight: 'bold', color: '#334155' }}>{item.classDivision}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#64748b', fontSize: '13px' }}>100x100 mm</td>
                        <td style={{ padding: '12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: item.packingGroup.includes('YES') || item.packingGroup.includes('FORBIDDEN') ? '#ef4444' : 'inherit' }}>{item.packingGroup}</td>
                        <td style={{ padding: '12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: item.caoOnly.startsWith('Yes') ? 'bold' : '600', color: item.caoOnly.startsWith('Yes') ? '#ef4444' : 'inherit' }}>{item.caoOnly}</td>
                      </tr>
                  ))}
                </tbody>
              </table>
              </div>

              
            </div>
          )}
  
          {/* EQUIPMENT LIMITS */}
        {activeSubTab === 'equipment' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Aircraft Equipment & Dimensions Limit</h3>
              <span style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', color: '#ffffff', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                Total Records: {filteredEquipment.length}
              </span>
            </div>
            <div style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table className="tact-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', textAlign: 'left', fontSize: '14px', color: '#ffffff', position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Make</th>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Aircraft Type</th>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>IATA Code</th>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Body Type</th>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Deck Type</th>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Max Payload (Tons)</th>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Max Volume (CBM)</th>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>ULD Compatibility</th>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Door Size</th>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Max Length (cm)</th>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Max Width (cm)</th>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Max Height (cm)</th>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Max Kgs / Piece</th>
                </tr>
              </thead>
              <tbody>
                {filteredEquipment.map(eq => (
                  <tr key={eq.id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '14px' }} onClick={() => setSelectedAircraft(eq)}>
                    <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>{getCompanyLogo(eq.manufacturer)}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold', border: '1px solid #e2e8f0', color: '#1e3a8a' }}>{eq.aircraftType}</td>
                      <td style={{ padding: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#10b981' }}>{eq.iataCode || 'TBA'}</td>
                    <td style={{ padding: '12px', border: '1px solid #e2e8f0', color: (eq.bodyType || '').includes('Freighter') ? '#7c3aed' : '#1e3a8a', fontWeight: 'bold' }}>{eq.bodyType || 'N/A'}</td>
                    <td style={{ padding: '12px', border: '1px solid #e2e8f0', color: (eq.deckType || '').includes('Main Deck') ? '#dc2626' : '#0f172a', fontWeight: (eq.deckType || '').includes('Main Deck') ? 'bold' : '600' }}>{eq.deckType || 'N/A'}</td>
                      <td style={{ padding: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#0ea5e9' }}>{eq.maxPayloadTons ? eq.maxPayloadTons + ' TON' : 'N/A'}</td>
                      <td style={{ padding: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#8b5cf6' }}>{eq.maxVolumeCbm ? eq.maxVolumeCbm + ' CBM' : 'N/A'}</td>
                      <td style={{ padding: '12px', border: '1px solid #e2e8f0', fontSize: '12.5px' }}>{eq.compatibleUlds || 'N/A'}</td>
                    <td style={{ padding: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>{eq.doorSize}</td>
                    <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>{eq.maxLengthCm} cm</td>
                    <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>{eq.maxWidthCm} cm</td>
                    <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>{eq.maxHeightCm} cm</td>
                    <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>{eq.maxKgsPerPiece} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>

              
            </div>
          )}

        {/* RATES & SURCHARGES */}
        {activeSubTab === 'rates' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>TACT Rates, FSC, and SSC Surcharges</h3>
              <span style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', color: '#ffffff', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                Total Records: {filteredSurcharges.length}
              </span>
            </div>
            <div style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table className="tact-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', textAlign: 'left', fontSize: '14px', color: '#ffffff', position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Charge Code</th>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Charge Name / Description</th>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>Carrier</th>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Basis</th>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Amount</th>
                  <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Min Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredSurcharges.map(sc => (
                  <tr key={sc.id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '14px' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold', border: '1px solid #e2e8f0', color: '#0ea5e9' }}>{sc.chargeCode}</td>
                      <td style={{ padding: '12px', border: '1px solid #e2e8f0', fontWeight: '600', color: '#334155' }}>{getChargeName(sc.chargeCode)}</td>
                      <td style={{ padding: '12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: sc.carrierCode !== 'ALL' ? 'bold' : 'normal', color: sc.carrierCode !== 'ALL' ? '#ef4444' : 'inherit' }}>{sc.carrierCode}</td>
                    <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>{sc.chargeBasis}</td>
                    <td style={{ padding: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#10b981' }}>{sc.amount}</td>
                    <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>{sc.minimumAmount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
                
                
                </div>
              </div>
            )}


            
          {/* IATA EXCHANGE RATES */}
          {activeSubTab === 'icer' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>IATA Currency Exchange Rates (ICER)</h3>
                <span style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', color: '#ffffff', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                  Total Records: {filteredExchangeRates.length}
                </span>
              </div>
              <div style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table className="tact-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', textAlign: 'left', fontSize: '14px', color: '#ffffff', position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Billing Month</th>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Currency Code</th>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>IATA ROE (Rate of Exchange)</th>
                    <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>SDR Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExchangeRates.map(rate => (
                    <tr key={rate.id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '14px' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold', border: '1px solid #e2e8f0', color: '#1e3a8a' }}>{rate.billingMonth}</td>
                      <td style={{ padding: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#0ea5e9' }}>{rate.currencyCode}</td>
                      <td style={{ padding: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#10b981' }}>{rate.iataRoe.toFixed(4)}</td>
                      <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>{rate.sdrValue ? rate.sdrValue.toFixed(4) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SHC CONFLICTS */}
    </>
  );
}
