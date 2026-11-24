// Form section: SPH: SPECIAL HANDLING CODE
// Split out of CreateAirWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import CustomAutocomplete from '../../../../CustomAutocomplete';
import FWBTextArea from '../../../../FWBTextArea';
import FieldAutocomplete from '../../../../FieldAutocomplete';
import React from 'react';
import { OCI_COUNTRY_CODES, OCI_CUSTOMS_IDS, OCI_INFO_IDENTIFIERS } from '../constants';

export default function HandlingOciSection({ ctx }) {
  const { handleAutoFilleCSD, handleOciChange, handleSmartAutoFillOCI, masterSph, ociRows, osiText, sci, setActiveRowIndex, setOciRows, setOsiText, setSci, setShowRateLine, setSphCodes, setSsrText, sphCodes, ssrText } = ctx;
  return (
    <>
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#ffffff' }}>

          

          {/* SPH & SCI */}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>

              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>SPH: SPECIAL HANDLING CODE</span>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {sphCodes.filter(c => c).map((code, idx) => {
                      const desc = masterSph.find(m => m.code === code)?.description || '';
                      return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc', border: '1px solid #7dd3fc', borderRadius: '16px', padding: '2px 8px', fontSize: '11px', color: '#0369a1', fontWeight: 'bold', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)' }}>
                          <span title={desc}>{code}</span>
                          <button type="button" onClick={() => {
                              const newCodes = [...sphCodes];
                              const targetIdx = newCodes.indexOf(code);
                              if(targetIdx > -1) newCodes[targetIdx] = '';
                              setSphCodes(newCodes);
                          }} style={{ background: 'none', border: 'none', color: '#0369a1', marginLeft: '6px', cursor: 'pointer', fontSize: '14px', padding: 0, lineHeight: 1 }}>&times;</button>
                      </div>);
                                })}
                  {sphCodes.filter(c => c).length < 9 && (
                      <FieldAutocomplete 
                          key={sphCodes.join(',')}
                          listType="sph" 
                          placeholder="+ Add SPH Code"
                          value=""
                          onSelect={(opt) => {
                              if (!opt || !opt.title) return;
                              const newCodes = [...sphCodes];
                              const emptyIdx = newCodes.findIndex(c => !c);
                              if(emptyIdx > -1 && !newCodes.includes(opt.title)) {
                                  newCodes[emptyIdx] = opt.title;
                                  setSphCodes(newCodes);
                              }
                          }}
                          style={{ width: '150px', padding: '2px 8px', fontSize: '11px', border: '1px dashed #94a3b8', boxSizing: 'border-box', height: '24px', borderRadius: '4px', color: 'var(--text-main, #0f172a)', outline: 'none', backgroundColor: '#f8fafc' }}
                      />
                  )}
                </div>

            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>

              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#ea580c' }} title="Special Customs Information (e.g., T1, T2, X)">SCI</span>

                              <select value={typeof sci !== 'undefined' ? sci : ''} onChange={e => setSci(e.target.value)} className="premium-input" style={{ width: '120px', padding: '4px 8px', fontSize: '12px', border: '1px solid #ea580c', borderRadius: '4px', outline: 'none', backgroundColor: '#fff7ed', color: '#ea580c', cursor: 'pointer', fontWeight: 'bold' }}>
                  <option value="">SELECT</option>
                  <option value="C">C - Community</option>
                  <option value="F">F - Fiscal</option>
                  <option value="T1">T1 - Non-Free</option>
                  <option value="T2">T2 - Free Circ.</option>
                  <option value="TD">TD - Transit</option>
                  <option value="TF">TF - Int. Transit</option>
                  <option value="X">X - Export</option>
                </select>

            </div>

          </div>



          {/* SSR & OSI */}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>

              <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>SSR: Special Service Request</span>
              <div style={{ position: 'relative' }}>
                <FWBTextArea value={ssrText} onChange={(e) => setSsrText(e.target.value)} maxLines={3} maxCharsPerLine={65} className="premium-input" placeholder="EXAMPLES: DO NOT FEED..." style={{ backgroundColor: "var(--bg-theme-light)", width: '100%', minHeight: '60px', padding: '6px', fontSize: '11px', border: sphCodes.some(c => ['PER','AVI','DGD','VAL'].includes(c)) ? '1px solid #ef4444' : '1px solid #94a3b8', borderRadius: '2px', outline: 'none', resize: 'none', overflow: 'hidden' }} />
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                  {sphCodes.includes('PER') && (
                    <div style={{ backgroundColor: '#111827', color: 'var(--bg-panel)', padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      ⚠️ PER: Ensure temperature requirements are mentioned in OSI.
                    </div>
                  )}
                  {sphCodes.includes('AVI') && (
                    <div style={{ backgroundColor: '#f59e0b', color: 'var(--bg-panel)', padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      ⚠️ AVI: Health Certificate & IATA Shipper's Cert are mandatory.
                    </div>
                  )}
                  {sphCodes.includes('DGD') && (
                    <div style={{ backgroundColor: '#ef4444', color: 'var(--bg-panel)', padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      ⚠️ DGD: Ensure UN Number & Proper Shipping Name exactly match DGD.
                    </div>
                  )}
                  {sphCodes.includes('FIL') && (
                    <div style={{ backgroundColor: '#3b82f6', color: 'var(--bg-panel)', padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      ⚠️ FIL: Attach "DO NOT X-RAY" physical labels on packages.
                    </div>
                  )}
                  {sphCodes.includes('CAO') && (
                    <div style={{ backgroundColor: '#f97316', color: 'var(--bg-panel)', padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      ⚠️ CAO: Ensure "CARGO AIRCRAFT ONLY" labels are attached to all packages.
                    </div>
                  )}
                  {sphCodes.includes('VAL') && (
                    <div style={{ backgroundColor: '#8b5cf6', color: 'var(--bg-panel)', padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      ⚠️ VAL: High Value Cargo. Security escort may be required.
                    </div>
                  )}
                  {sphCodes.includes('HUM') && (
                    <div style={{ backgroundColor: 'var(--text-muted, var(--text-muted, #475569))', color: 'var(--bg-panel)', padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      ⚠️ HUM: Ensure death certificate & embalming cert are attached.
                    </div>
                  )}
                  {sphCodes.includes('AOG') && (
                    <div style={{ backgroundColor: '#10b981', color: 'var(--bg-panel)', padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      ⚠️ AOG: Urgent Aircraft Part. Expedite handling.
                    </div>
                  )}
                  {(sphCodes.includes('ELI') || sphCodes.includes('ELM')) && (
                    <div style={{ backgroundColor: '#eab308', color: 'var(--bg-panel)', padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      ⚠️ ELI/ELM: Ensure Lithium Battery Mark is visible on all packages.
                    </div>
                  )}
                  {(sphCodes.includes('COL') || sphCodes.includes('CRT') || sphCodes.includes('ACT')) && (
                    <div style={{ backgroundColor: 'var(--primary-color-start, #0ea5e9)', color: 'var(--bg-panel)', padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      ⚠️ COL/CRT/ACT: Temperature-controlled cargo. Verify limits.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>OSI: Other Service Information</span>

              <FWBTextArea value={osiText} onChange={(e) => setOsiText(e.target.value)} maxLines={3} maxCharsPerLine={65} className="premium-input" placeholder="EXAMPLES: SHIPPERS CERTIFICATION FOR LIVE ANIMALS ATTACHED..." style={{ backgroundColor: "var(--bg-theme-light)", width: '100%', minHeight: '60px', padding: '6px', fontSize: '11px', border: '1px solid #94a3b8', borderRadius: '2px', outline: 'none', resize: 'none', overflow: 'hidden', }} />

            </div>

          </div>



          {/* OCI */}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>

            <details style={{ border: '1px solid #94a3b8', borderRadius: '4px', backgroundColor: '#f8fafc', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)' }}>
<summary style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  <span>&#9654; OCI: OTHER CUSTOMS, SECURITY AND REGULATORY CONTROL INFORMATION <span style={{ fontSize: "10px", color: "#b45309", backgroundColor: "#fef3c7", padding: "2px 6px", borderRadius: "4px", marginLeft: "8px", border: "1px solid #fde68a", fontWeight: 'bold' }}>*(Optional)</span></span>
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '10px' }}>
      <span onClick={(e) => { e.preventDefault(); handleAutoFilleCSD(); }} style={{ color: '#7c3aed', cursor: 'pointer', fontWeight: 'bold', textTransform: 'uppercase' }}>&#9889; AUTO e-CSD</span>
      <span style={{ color: '#94a3b8' }}>|</span>
    <span onClick={(e) => { e.preventDefault(); handleSmartAutoFillOCI(); }} style={{ color: '#334155', cursor: 'pointer', fontWeight: 'bold', textTransform: 'uppercase' }}>&#9889; SMART AUTO-FILL</span>
    <span style={{ color: '#94a3b8' }}>|</span>
    <span onClick={(e) => { e.preventDefault(); setOciRows([...ociRows, { id: Date.now(), countryCode: '', infoId: '', customsId: '', suppInfo: '' }]); }} style={{ color: '#334155', cursor: 'pointer', fontWeight: 'bold', textTransform: 'uppercase' }}>+ ADD ROW</span>
    <span style={{ color: '#94a3b8' }}>|</span>
    <span onClick={(e) => { e.preventDefault(); setOciRows([]); }} style={{ color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', textTransform: 'uppercase' }}>CLEAR ALL</span>
  </div>
</summary>
<div style={{ padding: '12px', borderTop: '1px solid #94a3b8', backgroundColor: '#ffffff' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '15% 20% 25% 1fr 30px', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: '1.1', color: 'var(--text-main, #0f172a)' }}>COUNTRY CODE</div>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: '1.1', color: 'var(--text-main, #0f172a)' }}>INFORMATION IDENTIFIER</div>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: '1.1', color: 'var(--text-main, #0f172a)' }}>CUSTOMS INFORMATION IDENTIFIER</div>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: '1.1', color: 'var(--text-main, #0f172a)' }}>SUPPLEMENTARY CUSTOMS INFORMATION</div>
                    <div></div>
                </div>
                  
                {ociRows.map((row, i) => (
                  <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '15% 20% 25% 1fr 30px', gap: '8px', marginBottom: '4px' }}>
                    <CustomAutocomplete
                        value={row.countryCode || ''}
                        onChange={(e) => handleOciChange(row.id, 'countryCode', e.target.value)}
                        onSelect={(opt) => handleOciChange(row.id, 'countryCode', opt.title)}
                        staticData={OCI_COUNTRY_CODES}
                        placeholder="SELECT"
                        style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #94a3b8', borderRadius: '2px', outline: 'none', height: '24px', boxSizing: 'border-box' }}
                      />
                    <select value={row.infoId || ''} onChange={(e) => handleOciChange(row.id, 'infoId', e.target.value)} className="premium-input" style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #94a3b8', borderRadius: '2px', outline: 'none', height: '24px', boxSizing: 'border-box' }}><option value="">SELECT</option>{OCI_INFO_IDENTIFIERS.map(opt => <option key={opt.val} value={opt.val}>{opt.label}</option>)}</select>
                    <select value={row.customsId || ''} onChange={(e) => handleOciChange(row.id, 'customsId', e.target.value)} className="premium-input" style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #94a3b8', borderRadius: '2px', outline: 'none', height: '24px', boxSizing: 'border-box' }}><option value="">SELECT</option>{OCI_CUSTOMS_IDS.map(opt => <option key={opt.val} value={opt.val}>{opt.label}</option>)}</select>
                    <input type="text" value={row.suppInfo || ''} onChange={(e) => handleOciChange(row.id, 'suppInfo', e.target.value)} autoComplete="off" className="premium-input" placeholder="Enter Tax ID, EORI, PAN, etc." maxLength={35} style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', borderRadius: '2px', outline: 'none', height: '24px', boxSizing: 'border-box' }} />
                    <button type="button" onClick={() => setOciRows(ociRows.filter((_, idx) => idx !== i))} style={{ color: 'var(--text-main, #0f172a)', backgroundColor: '#ffffff', border: '1px solid #ef4444', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', lineHeight: '1', alignSelf: 'center' }}>X</button>
                  </div>
                ))}
              </div>

            <div style={{ textAlign: 'right', fontSize: '9px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontStyle: 'italic', marginTop: '4px' }}>

              [ENTER INFORMATION IDENTIFYING A PARTY OR A LOCATION RELATED TO CUSTOMS, SECURITY AND REGULATORY CONTROL]</div>
</details>
</div>

        </div>

        {/* Consignment Rating Details */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0 0 0', padding: '1px 0 2px 0', borderBottom: '1px solid var(--lg-line, #bae6fd)' }}>
              <span style={{ color: 'var(--lg-head, #0f4c6e)', fontSize: '13px', fontWeight: 600 }}>Consignment Rating Details</span>
              <button type="button" onClick={() => { setActiveRowIndex(null); setShowRateLine(true); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'var(--theme-base, #0284c7)' }}>+ Add line</button>
            </div>
    </>
  );
}
