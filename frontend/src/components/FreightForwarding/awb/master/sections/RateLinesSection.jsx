// Form section: No. of PCs
// Split out of CreateMasterWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Eye } from 'lucide-react';
import React from 'react';

export default function RateLinesSection({ ctx }) {
  const { densityGroup, dimRows, handleGridChange, mcUnit, natureOfGoods, noDimensions, rateLines, setActiveRowIndex, setDensityGroup, setMcUnit, setNatureOfGoods, setRateLines, setShowRateLine, setVolume, totalAmountSum, totalChgWt, totalGrossWt, totalPcs, totalVolWt, volume } = ctx;
  return (
    <>
    <div style={{ padding: '8px', overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 0.8fr 1.2fr 0.8fr 1.5fr 1.2fr 1.5fr 1.5fr 1.5fr 1.2fr 1.5fr 0.8fr 2fr 70px', gap: '4px', marginBottom: '4px', padding: '4px 0', alignItems: 'center', backgroundColor: 'var(--grid-head-bg, #e2e8f0)' }} className="rl-head">
                  <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: '1.2', paddingLeft: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--grid-head-fg, #0f172a)' }} title="No. of pieces">Pcs</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: '1.2', paddingLeft: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--grid-head-fg, #0f172a)' }} title="Shipper's load and count">SLAC</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: '1.2', paddingLeft: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--grid-head-fg, #0f172a)' }} title="Gross weight">Gross Wt</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: '1.2', paddingLeft: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--grid-head-fg, #0f172a)' }} title="Weight unit">KG/LB</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: '1.2', paddingLeft: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--grid-head-fg, #0f172a)' }} title="Volumetric weight">Vol. Wt</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: '1.2', paddingLeft: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--grid-head-fg, #0f172a)' }} title="Rate class code">Rate Class</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: '1.2', paddingLeft: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--grid-head-fg, #0f172a)' }} title="Rate class percentage">Class %</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: '1.2', paddingLeft: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--grid-head-fg, #0f172a)' }} title="Commodity item number">Commodity No</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: '1.2', paddingLeft: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--grid-head-fg, #0f172a)' }} title="Chargeable weight">Chg. Wt</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: '1.2', paddingLeft: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--grid-head-fg, #0f172a)' }} title="Rate / charge">Rate/Chg</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: '1.2', paddingLeft: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--grid-head-fg, #0f172a)' }} title="Total amount">Total Amount</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: '1.2', paddingLeft: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--grid-head-fg, #0f172a)' }} title="Rate combination point">RCP</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: '1.2', paddingLeft: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--grid-head-fg, #0f172a)' }} title="Goods description">Goods Description</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: '1.2', color: 'var(--grid-head-fg, #0f172a)', textAlign: 'center' }}>Action</div>
              </div>
                
                                              <div className="rate-line-container">
                  {rateLines.map((row, index) => (
                <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '0.8fr 0.8fr 1.2fr 0.8fr 1.5fr 1.2fr 1.5fr 1.5fr 1.5fr 1.2fr 1.5fr 0.8fr 2fr 70px', gap: '4px', marginBottom: '4px' }}>
                  <input type="text" autoComplete="off" value={row.noOfPcs || ''} onChange={(e) => handleGridChange(index, 'noOfPcs', e.target.value.replace(/[^0-9]/g, ''))} className="premium-input" style={{ width: '100%', border: '1px solid #ef4444', backgroundColor: '#ffffff', padding: '4px 2px', fontSize: '10px' }} />
                  <input type="text" autoComplete="off" value={row.slac || ''} onChange={(e) => handleGridChange(index, 'slac', e.target.value.replace(/[^0-9]/g, ''))} className="premium-input" style={{ width: '100%', border: '1px solid #94a3b8', padding: '4px 2px', fontSize: '10px' }} />
                  <input type="text" autoComplete="off" value={row.grossWeight || ''} onChange={(e) => handleGridChange(index, 'grossWeight', e.target.value.replace(/[^0-9.]/g, ''))} className="premium-input" style={{ width: '100%', border: '1px solid #ef4444', backgroundColor: '#ffffff', padding: '4px 2px', fontSize: '10px' }} />
                  <select className="premium-input" value={row.gwUnit || 'K'} onChange={(e) => handleGridChange(index, 'gwUnit', e.target.value)} style={{ width: '100%', border: '1px solid #94a3b8', padding: '4px 0px', fontSize: '10px', color: 'var(--primary-color-end, #2563eb)', fontWeight: 'bold' }}><option value="K">K</option><option value="L">L</option></select>
                  <input type="text" autoComplete="off" value={row.volumetricWeight || ''} onChange={(e) => handleGridChange(index, 'volumetricWeight', e.target.value.replace(/[^0-9.]/g, ''))} className="premium-input" style={{ width: '100%', border: '1px solid #94a3b8', padding: '4px 2px', fontSize: '10px' }} />
                  <select className="premium-input" value={row.rateClassCode || ''} onChange={(e) => handleGridChange(index, 'rateClassCode', e.target.value)} style={{ width: '100%', border: '1px solid #94a3b8', padding: '4px 0px', fontSize: '10px', color: 'var(--primary-color-end, #2563eb)', fontWeight: 'bold' }}><option value="">-</option><option value="Q">Q</option><option value="M">M</option><option value="N">N</option><option value="B">B</option><option value="K">K</option><option value="C">C</option><option value="R">R</option><option value="S">S</option></select>
                  <input type="text" autoComplete="off" value={row.rateClassPercentage || ''} onChange={(e) => handleGridChange(index, 'rateClassPercentage', e.target.value)} className="premium-input" style={{ width: '100%', border: '1px solid #94a3b8', padding: '4px 2px', fontSize: '10px' }} />
                  <input type="text" autoComplete="off" value={row.commodityItemNumber || ''} onChange={(e) => handleGridChange(index, 'commodityItemNumber', e.target.value)} className="premium-input" style={{ width: '100%', border: '1px solid #94a3b8', padding: '4px 2px', fontSize: '10px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#ffffff', border: '1px solid #ef4444' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', borderBottom: '1px solid #dc2626' }} title="IATA: chargeable weight is rounded up to the next 0.5 kg (next whole lb). Untick only if the airline asks for the exact weight.">
                      <span style={{ fontSize: '8px', color: '#b91c1c', fontWeight: 'bold', cursor: 'help' }}>ROUND 0.5</span>
                      <input type="checkbox" checked={row.isRounded !== false} onChange={(e) => handleGridChange(index, 'isRounded', e.target.checked)} style={{ cursor: 'pointer', margin: '2px 0', width: '10px', height: '10px' }} />
                    </div>
                    <input type="text" autoComplete="off" value={row.chargeableWeight || ''} onChange={(e) => handleGridChange(index, 'chargeableWeight', e.target.value.replace(/[^0-9.]/g, ''))} title={row.cwManual ? 'Typed by hand - changes to gross / volumetric weight recalculate it' : 'Higher of gross and volumetric weight'} className="premium-input" style={{ width: '100%', border: 'none', backgroundColor: 'transparent', padding: '2px 2px', fontSize: '10px' }} />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input type="text" autoComplete="off" value={row.rateCharge || ''} onChange={(e) => handleGridChange(index, 'rateCharge', e.target.value)} className="premium-input" placeholder={index===0 ? "F7" : ""} style={{ width: '100%', border: '1px solid #ef4444', backgroundColor: '#ffffff', padding: '4px 2px', fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))' }} />
                  </div>
                  <input type="text" autoComplete="off" value={row.totalAmount || ''} onChange={(e) => handleGridChange(index, 'totalAmount', e.target.value.replace(/[^0-9.]/g, ''))} className="premium-input" style={{ width: '100%', border: '1px solid #ef4444', backgroundColor: '#ffffff', padding: '4px 2px', fontSize: '10px' }} />
                  <input type="text" autoComplete="off" value={row.rcp || ''} onChange={(e) => handleGridChange(index, 'rcp', e.target.value)} className="premium-input" style={{ width: '100%', border: '1px solid #94a3b8', padding: '4px 2px', fontSize: '10px' }} />
                  <input type="text" autoComplete="off" value={row.goodsDescription || (index === 0 && typeof natureOfGoods !== 'undefined' ? natureOfGoods : "")} onChange={(e) => { if(index===0 && typeof setNatureOfGoods !== 'undefined') setNatureOfGoods(e.target.value); handleGridChange(index, 'goodsDescription', e.target.value); }} className="premium-input" placeholder="Nature & Qty of Goods" style={{ width: '100%', border: '1px solid #94a3b8', padding: '4px', fontSize: '11px' }} />
                  
                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'}}>
                    <button type="button" onClick={() => { setActiveRowIndex(index); setShowRateLine(true); }} title="View Details" style={{ color: 'var(--primary-text, #0284c7)', backgroundColor: '#f8fafc', border: '1px solid #7dd3fc', cursor: 'pointer', borderRadius: '4px', width: '24px', height: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Eye size={14} />
                    </button>
                    <button type="button" onClick={() => setRateLines(rateLines.filter((_, idx) => idx !== index))} title="Delete Row" style={{ color: 'var(--text-main, #0f172a)', backgroundColor: '#ffffff', border: '1px solid #ef4444', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px', width: '24px', height: '24px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      ×
                    </button>
                  </div>

                </div>
              ))}
              {/* 22-Nov-2026: the four locked dummy rows are gone; a line says what to do and "+ Add line" sits under the grid */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '3px 3px', fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                {rateLines.length === 0 && <span>No rate line yet.</span>}
                <button type="button" onClick={() => { setActiveRowIndex(null); setShowRateLine(true); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'var(--theme-base, #0284c7)', whiteSpace: 'nowrap' }}>+ Add line</button>
              </div>
              </div>
              {/* Totals Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 0.8fr 1.2fr 0.8fr 1.5fr 1.2fr 1.5fr 1.5fr 1.5fr 1.2fr 1.5fr 0.8fr 2fr 70px', gap: '4px', marginTop: '2px', padding: '3px 0', borderTop: '1px solid var(--lg-line, #bae6fd)' }} className="rl-total">
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <span style={{ fontWeight: 600, fontSize: '11px', color: 'var(--lg-head, #0f4c6e)', paddingLeft: '3px' }} title="Totals">Tot</span>
                  <input type="text" autoComplete="off" className="premium-input" disabled value={totalPcs} style={{ width: '100%', border: '1px solid #94a3b8', backgroundColor: '#ffffff', padding: '4px 2px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)', textAlign: 'center' }} />
                </div>
                <div></div>
                <input type="text" autoComplete="off" className="premium-input" disabled value={totalGrossWt} style={{ width: '100%', border: '1px solid #94a3b8', backgroundColor: '#ffffff', padding: '4px 2px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }} />
                <div></div>
                <input type="text" autoComplete="off" className="premium-input" disabled value={totalVolWt} style={{ width: '100%', border: '1px solid #94a3b8', backgroundColor: '#ffffff', padding: '4px 2px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }} />
                <div></div>
                <div></div>
                <div></div>
                <input type="text" autoComplete="off" className="premium-input" disabled value={totalChgWt} style={{ width: '100%', border: '1px solid #94a3b8', backgroundColor: '#ffffff', padding: '4px 2px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }} />
                <div></div>
                <input type="text" autoComplete="off" className="premium-input" disabled value={totalAmountSum} style={{ width: '100%', border: '1px solid #94a3b8', backgroundColor: '#ffffff', padding: '4px 2px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }} />
                <div></div>
                <div></div>
                <div></div>
              </div>

              {/* Density and Volume Row */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginTop: '4px', borderTop: '1px solid var(--lg-line, #bae6fd)', paddingTop: '4px', paddingBottom: '4px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '150px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #1e293b))' }} title="Volume ratio used for the volumetric weight (IATA standard 1:6 = 6000 cm3 per kg)">Density Group / Ratio</span>
                  <select value={densityGroup} onChange={e => setDensityGroup(e.target.value)} className="premium-input" style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #94a3b8', outline: 'none', backgroundColor: '#ffffff', borderRadius: '2px' }}>
                    <option value="1:6">1:6 - IATA 6000 cm3/kg (166.67 kg/cbm)</option>
                    <option value="1:5">1:5 - 5000 cm3/kg (courier / express)</option>
                    <option value="1:7">1:7 - 7000 cm3/kg (airline rate)</option>
                    <option value="1:8">1:8 - 8000 cm3/kg (airline rate)</option>
                    <option value="DG1">DG1 (Dangerous Goods)</option>
                    <option value="OOG">Out of Gauge</option>
                  </select>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '120px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Volume</span>
                  <input type="text" value={volume} onChange={e => setVolume(e.target.value.replace(/[^0-9.]/g, ''))} readOnly={!noDimensions && dimRows.length > 0} placeholder={!noDimensions && dimRows.length === 0 ? 'Enter Dims above' : ''} autoComplete="off" className="premium-input" style={{ width: '100%', padding: '4px 6px', fontSize: '11px', border: '1px solid #94a3b8', outline: 'none', backgroundColor: (!noDimensions && dimRows.length > 0) ? '#f1f5f9' : 'transparent', borderRadius: '2px' }} />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #1e293b))' }}>MC</span>
                  <select value={mcUnit} onChange={e => setMcUnit(e.target.value)} className="premium-input" style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #94a3b8', outline: 'none', backgroundColor: '#ffffff', borderRadius: '2px' }}>
                      <option value="MC">MC - Cubic Metres</option>
                      <option value="CC">CC - Cubic Centimetres</option>
                      <option value="CF">CF - Cubic Feet</option>
                      <option value="CI">CI - Cubic Inches</option>
                    </select>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '6px' }}>
                  <input type="checkbox" id="noDimensions" checked={noDimensions} disabled style={{ cursor: 'not-allowed', opacity: 0.7 }} />
                  <label htmlFor="noDimensions" style={{ fontSize: '12px', color: 'var(--text-main, var(--text-main, #1e293b))', cursor: 'pointer' }}>No Dimensions Available</label>
                </div>
              </div>

            {/* Remarks */}
          </div>

                      {/* Bottom Split Section */}
    </>
  );
}
