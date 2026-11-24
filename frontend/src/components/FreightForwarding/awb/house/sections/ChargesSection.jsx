// Form section: Prepaid / Collect Charge Declaration
// Split out of CreateHouseWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import FieldAutocomplete from '../../../../FieldAutocomplete';
import ModernDatePicker from '../../../../common/ModernDatePicker';
import React from 'react';
import { showSuccessToast } from '../../../printLogic';

export default function ChargesSection({ ctx }) {
  const { awbDropList, awbFocusedIndex, ccChargesDest, destinationCurrency, dueAgentCC, dueAgentPP, dueCarrierCC, dueCarrierPP, executedDate, executedPlace, handleOtherChargeChange, otherCharges, otherPC, setAwbFocusedIndex, setAwbPrefix, setAwbSuffix, setCcChargesDest, setDestinationCurrency, setExecutedDate, setExecutedPlace, setOtherCharges, setShowAwbDrop, setSignatureCarrier, setSignatureShipper, setTaxCC, setTaxPP, setValChargeCC, setValChargePP, setWeightChargeCC, setWeightChargePP, showAwbDrop, signatureCarrier, signatureShipper, taxCC, taxPP, totalCC, totalPP, valChargeCC, valChargePP, weightChargeCC, weightChargePP } = ctx;
  return (
    <>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '12px', backgroundColor: '#ffffff', borderTop: '1px solid #94a3b8' }}>
          
          {/* Left: Prepaid/Collect */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #94a3b8', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <div style={{ backgroundColor: 'var(--primary-bg-light, #fce7f3)', borderLeft: '4px solid var(--primary-color-start, #ec4899)', color: '#334155', padding: '6px 12px', borderBottom: '1px solid #94a3b8', fontSize: '13px', fontWeight: '800' }}>
              Prepaid / Collect Charge Declaration
            </div>
            <div style={{ padding: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 130px 130px', gap: '8px', marginBottom: '4px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', height: '18px', alignItems: 'end' }}>
                <div></div><div>Prepaid</div><div>Collect</div>
              </div>
              
              
                <div style={{ display: 'grid', gridTemplateColumns: '150px 130px 130px', gap: '8px', marginBottom: '4px', alignItems: 'center', height: '24px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Weight Charge</div>
                  <input type="text" autoComplete="off" value={weightChargePP} onChange={e => setWeightChargePP(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, ''))} onKeyDown={(e) => {
                              if (!showAwbDrop || awbDropList.length === 0) return;
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setAwbFocusedIndex(prev => (prev < awbDropList.length - 1 ? prev + 1 : prev));
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setAwbFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (awbFocusedIndex >= 0 && awbFocusedIndex < awbDropList.length) {
                                  const a = awbDropList[awbFocusedIndex];
                                  if (a.status === 'TRANSMITTED' || a.transmissionStatus === 'TRANSMITTED') {
                                     showSuccessToast('Error', 'AWB is already TRANSMITTED and cannot be selected/edited!', true);
                                  } else {
                                     const parts = (a.awbNumber || '').split('-');
                                     if (parts[0]) setAwbPrefix(parts[0]);
                                     if (parts[1]) setAwbSuffix(parts[1]);
                                     setShowAwbDrop(false);
                                     setAwbFocusedIndex(-1);
                                  }
                                }
                              }
                            }}
                        onBlur={e => e.target.value && !isNaN(parseFloat(e.target.value)) && setWeightChargePP(parseFloat(e.target.value).toFixed(2))} className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', color: 'var(--primary-color-end, #2563eb)', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }} />
                  <input type="text" autoComplete="off" value={weightChargeCC} onChange={e => setWeightChargeCC(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, ''))} onKeyDown={(e) => {
                              if (!showAwbDrop || awbDropList.length === 0) return;
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setAwbFocusedIndex(prev => (prev < awbDropList.length - 1 ? prev + 1 : prev));
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setAwbFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (awbFocusedIndex >= 0 && awbFocusedIndex < awbDropList.length) {
                                  const a = awbDropList[awbFocusedIndex];
                                  if (a.status === 'TRANSMITTED' || a.transmissionStatus === 'TRANSMITTED') {
                                     showSuccessToast('Error', 'AWB is already TRANSMITTED and cannot be selected/edited!', true);
                                  } else {
                                     const parts = (a.awbNumber || '').split('-');
                                     if (parts[0]) setAwbPrefix(parts[0]);
                                     if (parts[1]) setAwbSuffix(parts[1]);
                                     setShowAwbDrop(false);
                                     setAwbFocusedIndex(-1);
                                  }
                                }
                              }
                            }}
                        onBlur={e => e.target.value && !isNaN(parseFloat(e.target.value)) && setWeightChargeCC(parseFloat(e.target.value).toFixed(2))} className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', color: 'var(--primary-color-end, #2563eb)', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 130px 130px', gap: '8px', marginBottom: '4px', alignItems: 'center', height: '24px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Valuation Charge</div>
                  <input type="text" autoComplete="off" value={valChargePP} onChange={e => setValChargePP(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, ''))} onKeyDown={(e) => {
                              if (!showAwbDrop || awbDropList.length === 0) return;
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setAwbFocusedIndex(prev => (prev < awbDropList.length - 1 ? prev + 1 : prev));
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setAwbFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (awbFocusedIndex >= 0 && awbFocusedIndex < awbDropList.length) {
                                  const a = awbDropList[awbFocusedIndex];
                                  if (a.status === 'TRANSMITTED' || a.transmissionStatus === 'TRANSMITTED') {
                                     showSuccessToast('Error', 'AWB is already TRANSMITTED and cannot be selected/edited!', true);
                                  } else {
                                     const parts = (a.awbNumber || '').split('-');
                                     if (parts[0]) setAwbPrefix(parts[0]);
                                     if (parts[1]) setAwbSuffix(parts[1]);
                                     setShowAwbDrop(false);
                                     setAwbFocusedIndex(-1);
                                  }
                                }
                              }
                            }}
                        onBlur={e => e.target.value && !isNaN(parseFloat(e.target.value)) && setValChargePP(parseFloat(e.target.value).toFixed(2))} className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', color: 'var(--primary-color-end, #2563eb)', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }} />
                  <input type="text" autoComplete="off" value={valChargeCC} onChange={e => setValChargeCC(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, ''))} onKeyDown={(e) => {
                              if (!showAwbDrop || awbDropList.length === 0) return;
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setAwbFocusedIndex(prev => (prev < awbDropList.length - 1 ? prev + 1 : prev));
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setAwbFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (awbFocusedIndex >= 0 && awbFocusedIndex < awbDropList.length) {
                                  const a = awbDropList[awbFocusedIndex];
                                  if (a.status === 'TRANSMITTED' || a.transmissionStatus === 'TRANSMITTED') {
                                     showSuccessToast('Error', 'AWB is already TRANSMITTED and cannot be selected/edited!', true);
                                  } else {
                                     const parts = (a.awbNumber || '').split('-');
                                     if (parts[0]) setAwbPrefix(parts[0]);
                                     if (parts[1]) setAwbSuffix(parts[1]);
                                     setShowAwbDrop(false);
                                     setAwbFocusedIndex(-1);
                                  }
                                }
                              }
                            }}
                        onBlur={e => e.target.value && !isNaN(parseFloat(e.target.value)) && setValChargeCC(parseFloat(e.target.value).toFixed(2))} className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', color: 'var(--primary-color-end, #2563eb)', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 130px 130px', gap: '8px', marginBottom: '4px', alignItems: 'center', height: '24px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Tax</div>
                  <input type="text" autoComplete="off" value={taxPP} onChange={e => setTaxPP(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, ''))} onKeyDown={(e) => {
                              if (!showAwbDrop || awbDropList.length === 0) return;
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setAwbFocusedIndex(prev => (prev < awbDropList.length - 1 ? prev + 1 : prev));
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setAwbFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (awbFocusedIndex >= 0 && awbFocusedIndex < awbDropList.length) {
                                  const a = awbDropList[awbFocusedIndex];
                                  if (a.status === 'TRANSMITTED' || a.transmissionStatus === 'TRANSMITTED') {
                                     showSuccessToast('Error', 'AWB is already TRANSMITTED and cannot be selected/edited!', true);
                                  } else {
                                     const parts = (a.awbNumber || '').split('-');
                                     if (parts[0]) setAwbPrefix(parts[0]);
                                     if (parts[1]) setAwbSuffix(parts[1]);
                                     setShowAwbDrop(false);
                                     setAwbFocusedIndex(-1);
                                  }
                                }
                              }
                            }}
                        onBlur={e => e.target.value && !isNaN(parseFloat(e.target.value)) && setTaxPP(parseFloat(e.target.value).toFixed(2))} className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', color: 'var(--primary-color-end, #2563eb)', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }} />
                  <input type="text" autoComplete="off" value={taxCC} onChange={e => setTaxCC(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, ''))} onKeyDown={(e) => {
                              if (!showAwbDrop || awbDropList.length === 0) return;
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setAwbFocusedIndex(prev => (prev < awbDropList.length - 1 ? prev + 1 : prev));
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setAwbFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (awbFocusedIndex >= 0 && awbFocusedIndex < awbDropList.length) {
                                  const a = awbDropList[awbFocusedIndex];
                                  if (a.status === 'TRANSMITTED' || a.transmissionStatus === 'TRANSMITTED') {
                                     showSuccessToast('Error', 'AWB is already TRANSMITTED and cannot be selected/edited!', true);
                                  } else {
                                     const parts = (a.awbNumber || '').split('-');
                                     if (parts[0]) setAwbPrefix(parts[0]);
                                     if (parts[1]) setAwbSuffix(parts[1]);
                                     setShowAwbDrop(false);
                                     setAwbFocusedIndex(-1);
                                  }
                                }
                              }
                            }}
                        onBlur={e => e.target.value && !isNaN(parseFloat(e.target.value)) && setTaxCC(parseFloat(e.target.value).toFixed(2))} className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', color: 'var(--primary-color-end, #2563eb)', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 130px 130px', gap: '8px', marginBottom: '4px', alignItems: 'center', height: '24px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Total Due Agent</div>
                  <input type="text" autoComplete="off" value={dueAgentPP > 0 ? dueAgentPP.toFixed(2) : ''} readOnly className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', color: 'var(--text-main, #0f172a)', fontWeight: 'bold', backgroundColor: 'transparent' }} />
                  <input type="text" autoComplete="off" value={dueAgentCC > 0 ? dueAgentCC.toFixed(2) : ''} readOnly className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', color: 'var(--text-main, #0f172a)', fontWeight: 'bold', backgroundColor: 'transparent' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 130px 130px', gap: '8px', marginBottom: '4px', alignItems: 'center', height: '24px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Total Due Carrier</div>
                  <input type="text" autoComplete="off" value={dueCarrierPP > 0 ? dueCarrierPP.toFixed(2) : ''} readOnly className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', color: 'var(--text-main, #0f172a)', fontWeight: 'bold', backgroundColor: 'transparent' }} />
                  <input type="text" autoComplete="off" value={dueCarrierCC > 0 ? dueCarrierCC.toFixed(2) : ''} readOnly className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', color: 'var(--text-main, #0f172a)', fontWeight: 'bold', backgroundColor: 'transparent' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 130px 130px', gap: '8px', marginBottom: '4px', alignItems: 'center', height: '24px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Total</div>
                  <input type="text" autoComplete="off" value={totalPP > 0 ? totalPP.toFixed(2) : ''} readOnly className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', color: 'var(--text-main, #0f172a)', fontWeight: 'bold', backgroundColor: '#ffffff' }} />
                  <input type="text" autoComplete="off" value={totalCC > 0 ? totalCC.toFixed(2) : ''} readOnly className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', color: 'var(--text-main, #0f172a)', fontWeight: 'bold', backgroundColor: '#ffffff' }} />
                </div>

            </div>

            {/* Charges Collect Summary */}
            <div style={{ borderTop: '1px solid #94a3b8' }}>
              <div style={{ backgroundColor: 'var(--primary-bg-light, #fce7f3)', borderLeft: '4px solid var(--primary-color-start, #ec4899)', color: '#334155', padding: '6px 12px', borderBottom: '1px solid #94a3b8', fontSize: '13px', fontWeight: '800' }}>
                Charges Collect Summary
              </div>
              <div style={{ padding: '4px 8px' }}>
                {/* 22-Nov-2026: the five boxes in one line; the carrier note is one line above them */}
                <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', marginBottom: '3px', textTransform: 'none' }}>For carrier's use only at destination</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <label title="Destination currency" style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Dest. Currency</label>
                    <FieldAutocomplete listType="currency" autoComplete="off" value={destinationCurrency} onChange={e => setDestinationCurrency(e.target.value.toUpperCase())} className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px' }} maxLength={3} placeholder="USD" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <label title="Currency conversion rates" style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Conv. Rate</label>
                    <input type="text" autoComplete="off" className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <label title="CC charges in destination currency" style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>CC Charges</label>
                    <input type="text" autoComplete="off" value={ccChargesDest} onChange={e => setCcChargesDest(e.target.value.replace(/[^0-9.]/g, ''))} className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <label title="Charges at destination" style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>At Destination</label>
                    <input type="text" autoComplete="off" className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <label title="Total collect charges" style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Total Collect</label>
                    <input type="text" autoComplete="off" defaultValue="" disabled className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', backgroundColor: '#ffffff' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Dimension Details (now Other Charges) */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #94a3b8', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            {/* Other Charges */}
            <div style={{ backgroundColor: 'var(--primary-bg-light, #fce7f3)', borderLeft: '4px solid var(--primary-color-start, #ec4899)', borderBottom: '1px solid #94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px' }}>
              <span style={{ color: 'var(--lg-head, #0f4c6e)', fontSize: '13px', fontWeight: 600 }}>Other Charges</span>
              <div style={{ display: 'flex', gap: '8px', fontSize: '11px', fontWeight: 600 }}>
                
                  <span onClick={() => setOtherCharges([...otherCharges, {id: Date.now()}])} className="oc-add" style={{ color: 'var(--theme-base, #0284c7)', cursor: 'pointer' }}>+ Add row</span>
                <span style={{ color: 'var(--text-muted, var(--text-muted, #64748b))' }}>|</span>
                <span onClick={() => setOtherCharges([])} style={{ color: '#b91c1c', cursor: 'pointer' }}>Clear all rows</span>
              </div>
            </div>
            
            <div style={{ padding: '8px', overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 60px 60px 60px 1fr 1fr 40px', gap: '8px', marginBottom: '4px', height: '18px', alignItems: 'end' }}>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: '1.1', color: 'var(--text-main, #0f172a)' }}>CODE</div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: '1.1', color: 'var(--text-main, #0f172a)', textAlign: 'center' }}>AGENT</div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: '1.1', color: 'var(--text-main, #0f172a)', textAlign: 'center' }}>CARRIER</div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: '1.1', color: 'var(--text-main, #0f172a)', textAlign: 'center' }}>PP/CC</div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: '1.1', color: 'var(--text-main, #0f172a)' }}>RATE</div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: '1.1', color: 'var(--text-main, #0f172a)' }}>AMOUNT</div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: '1.1', color: 'var(--text-main, #0f172a)', textAlign: 'center' }}>DEL</div>
              </div>
                
              
                {otherCharges.map((row, index) => (
                  <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '180px 60px 60px 60px 1fr 1fr 40px', gap: '8px', marginBottom: '4px', alignItems: 'center', height: '24px' }}>
                    <FieldAutocomplete 
                        listType="charge" 
                        value={row.code} 
                        onChange={(e) => handleOtherChargeChange(row.id, 'code', e.target.value.toUpperCase().substring(0, 2))}
                        onSelect={(opt) => handleOtherChargeChange(row.id, 'code', opt.title)}
                        placeholder="e.g. AW" 
                        className="premium-input" 
                        style={{ width: '100%', border: '1px solid #94a3b8', padding: '4px 4px', fontSize: '11px', color: 'var(--text-main, #0f172a)' }} 
                      />
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <input type="radio" name={'due_' + row.id} checked={row.entitlement === 'agent'} onChange={() => handleOtherChargeChange(row.id, 'entitlement', 'agent')} style={{ cursor: 'pointer' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <input type="radio" name={'due_' + row.id} checked={row.entitlement === 'carrier'} onChange={() => handleOtherChargeChange(row.id, 'entitlement', 'carrier')} style={{ cursor: 'pointer' }} />
                    </div>
                    <select value={row.ppcc || (otherPC === 'C' ? 'CC' : 'PP')} onChange={(e) => handleOtherChargeChange(row.id, 'ppcc', e.target.value)} style={{ width: '100%', border: '1px solid #94a3b8', padding: '2px', fontSize: '10px', height: '24px', boxSizing: 'border-box', borderRadius: '2px', textAlign: 'center', fontWeight: 'bold' }}>
                      <option value="PP">PP</option>
                      <option value="CC">CC</option>
                    </select>
                    <input type="text" className="premium-input" placeholder="Rate" value={row.rate || ''} onChange={(e) => handleOtherChargeChange(row.id, 'rate', e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1'))} style={{ width: '100%', border: '1px solid #94a3b8', padding: '4px 8px', fontSize: '11px', color: 'var(--text-main, #0f172a)', boxSizing: 'border-box', height: '24px' }} />
                    <input type="text" className="premium-input" value={row.amount} onChange={(e) => handleOtherChargeChange(row.id, 'amount', e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, ''))} onBlur={e => e.target.value && !isNaN(parseFloat(e.target.value)) && handleOtherChargeChange(row.id, 'amount', parseFloat(e.target.value).toFixed(2))} style={{ width: '100%', border: '1px solid #94a3b8', padding: '4px 8px', fontSize: '11px', color: 'var(--text-main, #0f172a)', boxSizing: 'border-box', height: '24px' }} />
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <button type="button" onClick={() => setOtherCharges(otherCharges.filter(r => r.id !== row.id))} title="Delete Row" className="oc-del" style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', lineHeight: 1, width: '20px', height: '20px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ×
                      </button>
                    </div>
                  </div>
                ))}

            </div>

            {/* Shipper Certification */}
            <div style={{ borderTop: '1px solid #94a3b8' }}>
              <div style={{ backgroundColor: 'var(--primary-bg-light, #fce7f3)', borderLeft: '4px solid var(--primary-color-start, #ec4899)', color: '#334155', padding: '6px 12px', borderBottom: '1px solid #94a3b8', fontSize: '13px', fontWeight: '800' }}>
                Shipper Certification
              </div>
              <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <input type="checkbox" defaultChecked style={{ marginTop: '2px', cursor: 'pointer' }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted, #475569)', lineHeight: '1.4', textTransform: 'none' }}>
                    Shipper certifies that the particulars on the face hereof are correct and that insofar as any part of the consignment contains dangerous goods, such part is properly described by name and is in proper condition for carriage by air according to the applicable Dangerous Goods Regulations.
                  </span>
                </div>
                
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Shipper's Name or his Agent <span style={{color: 'var(--text-main, #0f172a)'}}>*</span></label>
                  <input type="text" autoComplete="off" className="premium-input" maxLength={20} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', border: '1px solid #ef4444', backgroundColor: '#ffffff' }} value={signatureShipper} onChange={e => setSignatureShipper(e.target.value)} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '130px 150px minmax(0, 1fr)', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Executed on (Date) <span style={{color: 'var(--text-main, #0f172a)'}}>*</span></label>
                      <ModernDatePicker  autoComplete="off" id="awb-executed-date" className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '12px', border: '1px solid #ef4444', backgroundColor: '#ffffff' }} value={executedDate}  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); try { e.target.showPicker(); } catch(_){} } }} onChange={e => setExecutedDate(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Executed at (Place) <span style={{color: 'var(--text-main, #0f172a)'}}>*</span></label>
                      <input type="text" autoComplete="off" id="awb-executed-place" className="premium-input awb-place" maxLength={17} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', border: '1px solid #ef4444', backgroundColor: '#ffffff' }} value={executedPlace} onChange={e => setExecutedPlace(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Name of Issuing Carrier or its Agent <span style={{color: 'var(--text-main, #0f172a)'}}>*</span></label>
                      <input type="text" autoComplete="off" className="premium-input" maxLength={20} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', border: '1px solid #ef4444', backgroundColor: '#ffffff' }} value={signatureCarrier} onChange={e => setSignatureCarrier(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
    </>
  );
}
