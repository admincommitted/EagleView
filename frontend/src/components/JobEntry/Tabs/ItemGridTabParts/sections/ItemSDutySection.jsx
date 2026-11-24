// Screen section: Item's Duty Details
// Split out of ItemGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Info } from 'lucide-react';
import React from 'react';
import { FLAG_NAMES, itemAssessableINR, computeItemDuty, refreshItemDutyBoxes, dutyBasisText } from '../helpers';

export default function ItemSDutySection({ ctx }) {
  const { openAntiDumpingModal, openCustomsCvdModal, openOtherDutyModal, openSchemeCategoryModal, openSupportingDocsModal, openSwInfoModal, selectedItem,
    openSwConstModal, openSwProductionModal, openSwControlModal, openSwStatementModal, openReimportModal, openRspModal, openNcdModal, openLicenceModal } = ctx;
  // Every popup opens through its open...() function, which loads THIS item's saved rows (the SW Constituent / Production /
  // Control / Statement, Re-Import, RSP and NCD boxes used to open with the previous item's data). 28-Oct-2026
  const OPEN = { 'Scheme Code Category': openSchemeCategoryModal, 'Licence': openLicenceModal, 'Re-Import': openReimportModal, 'RSP Duty': openRspModal,
    'NCD Custom Duty': openNcdModal, 'Anti Dumping Duty': openAntiDumpingModal, 'Other Duty': openOtherDutyModal,
    'SW Infotype': openSwInfoModal, 'SW Constituent': openSwConstModal, 'SW Production': openSwProductionModal, 'SW Control': openSwControlModal,
    'SW Statement': openSwStatementModal, 'Supporting Docs': openSupportingDocsModal, 'Customs CVD': openCustomsCvdModal };
  // flag box shows Y when the item already has that popup's data (e.g. an imported BE) even if the flag was never typed
  const DATA_KEY = { schemeCodCategoryFlag: 'schemeCatData', licenceFlag: 'licenceData', reImportFlag: 'reimportData', ncdCustomDutyFlag: 'ncdData',
    antiDumpingDutyFlag: 'addData', otherDutyFlag: 'otherDutyData', swInfotypeFlag: 'swInfoData', swConstituentFlag: 'swConstData', swProductionFlag: 'swProdData',
    swControlFlag: 'swCtrlData', swStatementFlag: 'swStmtData', supportingDocsFlag: 'docsData', customsCvdFlag: 'cvdData' };
  const hasData = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return false; } } if (Array.isArray(v)) return v.length > 0;
    return !!v && typeof v === 'object' && Object.entries(v).some(([k, x]) => !['flag', 'type', 'id'].includes(k) && String(x ?? '').trim() !== ''); };
  // Duty estimate on the assessable value in INR (exchange rate + freight / insurance share). The old code used the
  // item's invoice-currency total as rupees. ICEGATE calculates the real duty; this is only for the checklist. 28-Oct-2026
  const { invoices, jobData } = ctx;
  const avNow = () => {
    const f = typeof document !== 'undefined' ? document.getElementById('item-form') : null;
    const get = (n) => (f && f.elements[n] ? f.elements[n].value : '');
    return itemAssessableINR({ itemValue: get('value') || selectedItem.value, invNo: get('invNo') || selectedItem.invNo, invSrNo: selectedItem.invSrNo }, invoices, jobData);
  };
  const recalcDuty = () => refreshItemDutyBoxes(selectedItem, invoices, jobData);

  const avText = () => { const r = avNow(); return r.rateFound ? `Ass. value ₹ ${r.av.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (estimate)` : `Exchange rate for ${r.currency || 'invoice currency'} missing - duty not calculated`; };
  // 09-Nov-2026: BE / invoice level statements and supporting documents are kept once on the job; the item's popup
  // shows them, so the box shows Y for them too
  const rowsOf = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };
  const inv = String(selectedItem.invSrNo || '');
  const SHARED = {
    swStatementFlag: () => rowsOf(jobData && jobData._statements).some(r => { const i = String(r.invoiceSerialNumber ?? r.invoiceSrNo ?? '0'), t = String(r.itemSerialNumber ?? r.itemSrNo ?? '0'); return t === '0' && (i === '0' || i === inv); }),
    supportingDocsFlag: () => rowsOf(ctx.esanchitDocs).some(d => { const f = String(d.docFor || 'HEADER').toUpperCase(); return f === 'HEADER' || (f === 'INVOICE' && String(d.invSrNo || '') === inv); }),
  };
  const flagValue = (name) => selectedItem[name] || (DATA_KEY[name] && hasData(selectedItem[DATA_KEY[name]]) ? 'Y' : '') || (SHARED[name] && SHARED[name]() ? 'Y' : '');
  return (
    <>
    <div style={{ display: 'flex', gap: '8px' }}>
          
          {/* Duty Details */}
          <div style={{ flex: 2, background: 'var(--bg-panel, #ffffff)', border: '1px solid var(--primary-border)', borderRadius: '4px' }}>
            <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase' }}>
              Item's Duty Details <span id="item-av-hint" style={{ float: 'right', fontWeight: 'normal', textTransform: 'none', fontSize: '11px' }}>{avText()}</span>
            </div>
            <div style={{ padding: '8px' }}>
              <table className="dense-form-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '10px' }}>
                    <th style={{ textAlign: 'left', width: '80px' }}></th>
                    <th style={{ textAlign: 'left' }}>Notification</th>
                    <th style={{ textAlign: 'left' }}>Serial No.</th>
                    <th style={{ textAlign: 'left' }}>Rate (%)</th>
                    <th style={{ textAlign: 'left' }}>Flag</th>
                    <th style={{ textAlign: 'left' }}>Amount</th>
                    <th style={{ textAlign: 'left' }}>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 'bold', color: '#334155' }}>BCD</td>
                    <td><input type="text" name="bcdNotificationNo" className="input-field" defaultValue={selectedItem.bcdNotificationNo || ''} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                    <td><input type="text" name="bcdSrNo" className="input-field" defaultValue={selectedItem.bcdSrNo || ''} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                    <td><input type="text" 
                      name="bcdRate" 
                      className="input-field" 
                      defaultValue={selectedItem.bcdRate || ''} 
                      style={{ width: '100%', border: '1px solid #cbd5e1', color: 'var(--primary-color-end)' }} 
                      onChange={recalcDuty}
                    /></td>
                    <td><input type="text" name="bcdFlag" className="input-field" defaultValue={selectedItem.bcdFlag || ''} style={{ width: '100%', border: '1px solid #cbd5e1', color: 'var(--primary-color-end)' }} /></td>
                    <td><input type="text" name="bcdAmount" className="input-field" defaultValue={selectedItem.bcdAmount || ''} style={{ width: '100%' }} /></td>
                    <td><input type="text" name="bcdUnit" className="input-field" defaultValue={selectedItem.bcdUnit || ''} onChange={recalcDuty} title="Unit the specific BCD rate is per (from the tariff, e.g. KGS)" style={{ width: '100%', textTransform: 'uppercase' }} /></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', color: '#334155' }}>CVD</td>
                    <td><input type="text" name="cvdNotificationNo" className="input-field" defaultValue={selectedItem.cvdNotificationNo || ''} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                    <td><input type="text" name="cvdSrNo" className="input-field" defaultValue={selectedItem.cvdSrNo || ''} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                    <td><input type="text" name="cvdRate" className="input-field" defaultValue={selectedItem.cvdRate || ''} style={{ width: '100%', border: '1px solid #cbd5e1', color: 'var(--primary-color-end)' }} /></td>
                    <td><input type="text" name="cvdFlag" className="input-field" defaultValue={selectedItem.cvdFlag || ''} style={{ width: '100%', border: '1px solid #cbd5e1', color: 'var(--primary-color-end)' }} /></td>
                    <td><input type="text" name="cvdAmount" className="input-field" defaultValue={selectedItem.cvdAmount || ''} style={{ width: '100%' }} /></td>
                    <td><input type="text" name="cvdUnit" className="input-field" defaultValue={selectedItem.cvdUnit || ''} style={{ width: '100%' }} /></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', color: '#334155' }}>Adl. CVD</td>
                    <td><input type="text" name="adlCvdNotificationNo" className="input-field" defaultValue={selectedItem.adlCvdNotificationNo || ''} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                    <td><input type="text" name="adlCvdSrNo" className="input-field" defaultValue={selectedItem.adlCvdSrNo || ''} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                    <td><input type="text" name="adlCvdRate" className="input-field" defaultValue={selectedItem.adlCvdRate || ''} style={{ width: '100%', border: '1px solid #cbd5e1', color: 'var(--primary-color-end)' }} /></td>
                    <td><input type="text" name="adlCvdFlag" className="input-field" defaultValue={selectedItem.adlCvdFlag || ''} style={{ width: '100%', border: '1px solid #cbd5e1', color: 'var(--primary-color-end)' }} /></td>
                    <td><input type="text" name="adlCvdAmount" className="input-field" defaultValue={selectedItem.adlCvdAmount || ''} style={{ width: '100%' }} /></td>
                    <td><input type="text" name="adlCvdUnit" className="input-field" defaultValue={selectedItem.adlCvdUnit || ''} style={{ width: '100%' }} /></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', color: '#334155' }}>SWS</td>
                    <td><input type="text" name="swsNotificationNo" className="input-field" defaultValue={selectedItem.swsNotificationNo || ''} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                    <td><input type="text" name="swsSrNo" className="input-field" defaultValue={selectedItem.swsSrNo || ''} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                    <td><input type="text" name="swsRate" onChange={recalcDuty} className="input-field" defaultValue={selectedItem.swsRate || '10'} style={{ width: '100%', border: '1px solid #cbd5e1', color: 'var(--primary-color-end)' }} /></td>
                    <td><input type="text" name="swsFlag" className="input-field" defaultValue={selectedItem.swsFlag || 'A'} style={{ width: '100%', border: '1px solid #cbd5e1', color: 'var(--primary-color-end)' }} /></td>
                    <td><input type="text" name="swsAmount" className="input-field" defaultValue={selectedItem.swsAmount || ''} style={{ width: '100%' }} /></td>
                    <td><input type="text" name="swsUnit" className="input-field" defaultValue={selectedItem.swsUnit || ''} style={{ width: '100%' }} /></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', color: '#334155' }}>SAPTA</td>
                    <td><input type="text" name="saptaNotificationNo" className="input-field" defaultValue={selectedItem.saptaNotificationNo || ''} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                    <td><input type="text" name="saptaSrNo" className="input-field" defaultValue={selectedItem.saptaSrNo || ''} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                    <td><input type="text" name="saptaRate" className="input-field" defaultValue={selectedItem.saptaRate || ''} style={{ width: '100%', border: '1px solid #cbd5e1', color: 'var(--primary-color-end)' }} /></td>
                    <td><input type="text" name="saptaFlag" className="input-field" defaultValue={selectedItem.saptaFlag || ''} style={{ width: '100%', border: '1px solid #cbd5e1', color: 'var(--primary-color-end)' }} /></td>
                    <td><input type="text" name="saptaAmount" className="input-field" defaultValue={selectedItem.saptaAmount || ''} style={{ width: '100%' }} /></td>
                    <td><input type="text" name="saptaUnit" className="input-field" defaultValue={selectedItem.saptaUnit || ''} style={{ width: '100%' }} /></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', color: '#334155' }}>Health Cess</td>
                    <td><input type="text" name="healthCessNotificationNo" className="input-field" defaultValue={selectedItem.healthCessNotificationNo || ''} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                    <td><input type="text" name="healthCessSrNo" className="input-field" defaultValue={selectedItem.healthCessSrNo || ''} style={{ width: '100%', border: '1px solid #cbd5e1' }} /></td>
                    <td><input type="text" name="healthCessRate" onChange={recalcDuty} className="input-field" defaultValue={selectedItem.healthCessRate || ''} style={{ width: '100%', border: '1px solid #cbd5e1', color: 'var(--primary-color-end)' }} /></td>
                    <td><input type="text" name="healthCessFlag" className="input-field" defaultValue={selectedItem.healthCessFlag || ''} style={{ width: '100%', border: '1px solid #cbd5e1', color: 'var(--primary-color-end)' }} /></td>
                    <td><input type="text" name="healthCessAmount" className="input-field" defaultValue={selectedItem.healthCessAmount || ''} style={{ width: '100%' }} /></td>
                    <td><input type="text" name="healthCessUnit" className="input-field" defaultValue={selectedItem.healthCessUnit || ''} style={{ width: '100%' }} /></td>
                  </tr>
                </tbody>
              </table>
              {/* 30-Oct-2026: a tariff line is not always a percentage - most of chapters 50-63 read "20% or Rs 115
                  per kg, whichever is higher", and cigarettes / gold / bulk oils are per unit only. The Rate (%) box
                  could not say any of that, so those BEs were under-estimated. The Unit box above (which nothing used
                  to read) is the unit the specific rate is per. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--primary-border)', fontSize: '11px', textTransform: 'none' }}>
                <label style={{ color: '#334155', fontWeight: 'bold', whiteSpace: 'nowrap' }} title="Rupees per unit of the BCD Unit above - from the tariff, e.g. Rs 115 per KGS">Specific rate &#8377;</label>
                <input type="text" name="bcdSpecAmount" inputMode="decimal" className="input-field" defaultValue={selectedItem.bcdSpecAmount || ''}
                  onChange={recalcDuty} placeholder="per unit" style={{ width: '80px', border: '1px solid #cbd5e1', color: 'var(--primary-color-end)' }} />
                <span style={{ color: 'var(--text-muted, #64748b)' }}>per {String(selectedItem.bcdUnit || '').toUpperCase() || 'BCD Unit'}</span>
                <label style={{ color: '#334155', fontWeight: 'bold', whiteSpace: 'nowrap', marginLeft: '6px' }} title="How the tariff says to apply the two rates">Basis</label>
                <select name="bcdRateBasis" className="input-field" defaultValue={selectedItem.bcdRateBasis || ''} onChange={recalcDuty}
                  style={{ width: '150px', border: '1px solid #cbd5e1', color: 'var(--primary-color-end)' }}>
                  <option value="">Auto</option>
                  <option value="A">Rate % only</option>
                  <option value="S">Specific only</option>
                  <option value="H">Whichever is higher</option>
                  <option value="L">Whichever is lower</option>
                  <option value="B">Both added</option>
                </select>
                <label style={{ color: '#334155', fontWeight: 'bold', whiteSpace: 'nowrap', marginLeft: '6px' }} title="Only needed when the item quantity is in a different unit than the specific rate (fabric billed in metres, duty per kg)">Qty in duty unit</label>
                <input type="text" name="specQty" inputMode="decimal" className="input-field" defaultValue={selectedItem.specQty || ''}
                  onChange={recalcDuty} placeholder={String(selectedItem.bcdUnit || '').toUpperCase() || 'same as item qty'} style={{ width: '90px', border: '1px solid #cbd5e1' }} />
                <span id="item-bcd-basis-note" style={{ color: 'var(--text-muted, #64748b)', flex: 1, minWidth: '180px' }}>{dutyBasisText(computeItemDuty(selectedItem, invoices, jobData).bcdBasis)}</span>
              </div>
            </div>
          </div>

          {/* Other Duty */}
          <div style={{ flex: 1, background: 'var(--bg-panel, #ffffff)', border: '1px solid var(--primary-border)', borderRadius: '4px' }}>
            <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase' }}>
              Other Duty
            </div>
            <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                'Scheme Code Category', 'Licence', 'Re-Import', 
                { label: 'RSP Duty', note: '[Y,S/N/Q/T/D]' }, 
                'NCD Custom Duty', 'Anti Dumping Duty', 'Other Duty'
              ].map((field, idx) => {
                const label = typeof field === 'string' ? field : field.label;
                const note = typeof field === 'string' ? '' : field.note;
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ color: '#334155', fontWeight: 'bold' }}>
                      {label} <span style={{fontWeight: 'normal', color: '#94a3b8'}}>{note}</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '62px', justifyContent: 'flex-start' }}>
                      <input 
                        type="text" 
                        name={FLAG_NAMES[label] || (label.replace(/[^a-zA-Z]/g, '').charAt(0).toLowerCase() + label.replace(/[^a-zA-Z]/g, '').slice(1)) + 'Flag'}
                          className="input-field"
                          defaultValue={flagValue(FLAG_NAMES[label] || (label.replace(/[^a-zA-Z]/g, '').charAt(0).toLowerCase() + label.replace(/[^a-zA-Z]/g, '').slice(1)) + 'Flag')}
                          style={{ width: '40px', border: '1px solid #cbd5e1', color: 'var(--primary-color-end, var(--primary-color-end))', textAlign: 'center' }}
                        onChange={(e) => {
                          // RSP flag is a code (Y/S/N/Q/T/D), only Y opens the popup
                          if (e.target.value.toUpperCase() === 'Y' && OPEN[label]) OPEN[label]();
                        }}
                      />
                      {OPEN[label] && (
                        <Info size={14} color="var(--primary-color-end, var(--primary-color-end))" style={{ cursor: 'pointer' }} onClick={OPEN[label]} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Single Window */}
          <div style={{ flex: 1, background: 'var(--bg-panel, #ffffff)', border: '1px solid var(--primary-border)', borderRadius: '4px' }}>
            <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase' }}>
              Single Window
            </div>
            <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                'SW Infotype', 'SW Constituent', 'SW Production', 'SW Control', 
                'SW Statement', 'Supporting Docs', 'Customs CVD'
              ].map((field, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ color: '#334155', fontWeight: 'bold' }}>{field}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '62px', justifyContent: 'flex-start' }}>
                    <input 
                      type="text" 
                      name={FLAG_NAMES[field] || (field.replace(/[^a-zA-Z]/g, '').charAt(0).toLowerCase() + field.replace(/[^a-zA-Z]/g, '').slice(1)) + 'Flag'}
                            className="input-field"
                            defaultValue={flagValue(FLAG_NAMES[field] || (field.replace(/[^a-zA-Z]/g, '').charAt(0).toLowerCase() + field.replace(/[^a-zA-Z]/g, '').slice(1)) + 'Flag')}
                            style={{ width: '40px', border: idx === 0 ? '1px solid #ef4444' : '1px solid #93c5fd', color: idx === 0 ? '#ef4444' : 'var(--primary-color-end, var(--primary-color-end))', textAlign: 'center' }} 
                      onChange={(e) => { if (e.target.value.toUpperCase() === 'Y' && OPEN[field]) OPEN[field](); }}
                    />
                    {OPEN[field] && (
                      <Info size={14} color="var(--primary-color-end, var(--primary-color-end))" style={{ cursor: 'pointer' }} onClick={OPEN[field]} />
                    )}
                    
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>

        {/* Additional Details */}
    </>
  );
}

