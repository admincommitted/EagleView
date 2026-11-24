// Screen section: Bill Of Entry Specification
// Split out of JobHeaderTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';

// Y/N boxes take only Y or N (any other letter was saved and sent to ICEGATE as typed). 28-Oct-2026
export const yn = (v, allowA) => { const c = String(v || '').trim().toUpperCase().slice(-1); return c === 'Y' || c === 'N' || (allowA && c === 'A') ? c : ''; };
// importer type: the value saved is the ICEGATE code (G|U|P|O|J|R|D|E|H|I); names saved by older jobs are mapped back. 30-Oct-2026
export const IMP_TYPE = { G: 'Government', U: 'Undertaking (PSU)', P: 'Private', O: 'Others', J: 'Jobbing', R: 'Repairing', D: 'Destruction', E: 'Exhibition', H: 'Hand Carry Jeweller', I: 'Unclaimed Cargo' };
const IMP_NAME_TO_CODE = { GOVERNMENT: 'G', UNDERTAKING: 'U', 'UNDERTAKING (PSU)': 'U', PRIVATE: 'P', OTHERS: 'O', JOBBING: 'J', REPAIRING: 'R', DESTRUCTION: 'D', EXHIBITION: 'E', 'HAND CARRY JEWELLER': 'H', 'HAND CARRY': 'H', 'UNCLAIMED CARGO': 'I', 'UNCLIAMED CARGO': 'I' };
export const impCode = (v) => { const t = String(v || '').trim().toUpperCase(); if (!t || t === 'SELECT') return ''; if (/^[GUOPERJDTSVAHIMBF]$/.test(t)) return t; return IMP_NAME_TO_CODE[t] || ''; };
// Payment Method: ICEGATE code T / D (the select had no values, so "Transaction" was never sent)
const payCode = (v) => { const t = String(v || '').trim().toUpperCase(); return t.startsWith('D') ? 'D' : t.startsWith('T') ? 'T' : ''; };

// 04-Nov-2026: shipping line names (Shipping Line master) offered in the Shipping Line box; any name can still be typed
let shippingLinesCache = null;
const loadShippingLines = () => {
  if (!shippingLinesCache) shippingLinesCache = fetch('/api/masters/shippinglines').then(r => (r.ok ? r.json() : [])).then(d => (Array.isArray(d) ? d : [])).catch(() => { shippingLinesCache = null; return []; });
  return shippingLinesCache;
};

export default function BillOfEntrySection({ ctx }) {
  const [shippingLines, setShippingLines] = React.useState([]);
  React.useEffect(() => { let live = true; loadShippingLines().then(d => { if (live) setShippingLines(d); }); return () => { live = false; }; }, []);
  const { addtlDetails, firstCheck, handleChange, highSeaSale, jobData, priorBE, section48, setAddtlDetails, setFirstCheck, setHighSeaSale, setIsFirstCheckModalOpen, setIsHighSeaSaleModalOpen, setIsProvAssessModalOpen, setIsSection48ModalOpen, setJobData, setPriorBE, setProvAssess, setSection48, transportMode, updateJobFlag } = ctx;
  return (
    <>
    <div style={{ border: '1px solid var(--primary-border)', background: 'transparent', marginBottom: '4px' }}>
        <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase' }}>Bill Of Entry Specification</div>
        <div style={{ padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px 16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ width: '130px', minWidth: '130px', whiteSpace: 'nowrap' }}>Kacha BE [Y/N]</label>
            <input name="kachchaBE" type="text" className="input-field mandatory-field" placeholder="N" maxLength={2} value={jobData["kachchaBE"] || (jobData["kachchaBE"] || jobData["kachaBe"]) || ""} onChange={e => setJobData(prev => ({ ...prev, kachchaBE: yn(e.target.value) }))} style={{ width: '40px', color: '#0f172a', border: '1px solid #f87171' }} />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ width: '130px', minWidth: '130px', whiteSpace: 'nowrap' }}>Importer Type</label>
            <select name="importerType" className="input-field mandatory-field" title="Mandatory on every BE (ICEGATE importer type)" style={{ width: '120px', color: '#0f172a', border: '1px solid #f87171' }} value={impCode(jobData.importerType) || (String(jobData.autoField_53 || '').length === 1 ? impCode(jobData.autoField_53) : '')} onChange={handleChange}>
              <option value="">Select</option>
              {Object.entries(IMP_TYPE).map(([c, n]) => <option key={c} value={c}>{c} - {n}</option>)}
            </select>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ width: '200px', minWidth: '200px', whiteSpace: 'nowrap' }}>Green Channel</label>
            <input name="greenChannel" type="text" className="input-field mandatory-field" placeholder="N" maxLength={2} value={jobData["greenChannel"] || jobData["greenChannelRequested"] || (/^[YN]$/.test(String(jobData.autoField_55 || '')) ? jobData.autoField_55 : '') || ""} onChange={e => setJobData(prev => ({ ...prev, greenChannel: yn(e.target.value), greenChannelRequested: yn(e.target.value) }))} style={{ width: '40px', color: '#0f172a', border: '1px solid #f87171' }} />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ width: '130px', minWidth: '130px', whiteSpace: 'nowrap' }}>High Sea Sale</label>
            <input type="text" className="input-field mandatory-field" placeholder="N" style={{ width: '40px', color: '#0f172a', border: '1px solid #f87171' }} maxLength={2} value={highSeaSale} onChange={e => { const v = yn(e.target.value); updateJobFlag('highSeaSaleFlag', v, setHighSeaSale); if (v === 'Y') setIsHighSeaSaleModalOpen(true); }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ width: '130px', minWidth: '130px', whiteSpace: 'nowrap' }}>Section[48] [Y/N]</label>
            <input type="text" className="input-field" placeholder="N" maxLength={2} value={section48} onChange={e => { const v = yn(e.target.value); updateJobFlag('section48Requested', v, setSection48); if (v === 'Y') setIsSection48ModalOpen(true); }} style={{ width: '40px', color: '#0f172a', border: '1px solid #f87171' }} />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ width: '130px', minWidth: '130px', whiteSpace: 'nowrap' }}>Prior BE [Y/N]</label>
            <input type="text" className="input-field" placeholder="N" maxLength={2} value={priorBE} onChange={e => updateJobFlag('whetherPriorBE', yn(e.target.value), setPriorBE)} style={{ width: '40px', color: '#0f172a', border: '1px solid #f87171' }} />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ width: '130px', minWidth: '130px', whiteSpace: 'nowrap' }}>Payment Method</label>
            <select name="paymentMethodCode" className="input-field" style={{ width: '120px', color: '#0f172a', border: '1px solid #f87171' }} value={payCode(jobData.paymentMethodCode || jobData.paymentMethod) || 'T'} onChange={e => setJobData(prev => ({ ...prev, paymentMethodCode: e.target.value, paymentMethod: e.target.value }))}>
              <option value="T">Transaction</option>
              <option value="D">Deferred</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ width: '200px', minWidth: '200px', whiteSpace: 'nowrap' }}>Provisional Assessment [Y/N]</label>
            <input type="text" className="input-field" placeholder="N" maxLength={2} value={jobData.provAssess || 'N'} onChange={e => { const v = yn(e.target.value); setProvAssess(v); setJobData(prev => ({...prev, provAssess: v})); if (v === 'Y') setIsProvAssessModalOpen(true); }} style={{ width: '40px', color: '#0f172a', border: '1px solid #f87171' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ width: '130px', minWidth: '130px', whiteSpace: 'nowrap' }}>First Check [Y/N]</label>
            <input type="text" className="input-field" placeholder="N" maxLength={2} value={firstCheck} onChange={e => { const v = yn(e.target.value); updateJobFlag('firstCheckRequested', v, setFirstCheck); if (v === 'Y') setIsFirstCheckModalOpen(true); }} style={{ width: '40px', color: '#0f172a', border: '1px solid #f87171' }} />
          </div>
          
          {/* 30-Oct-2026: UCR (unique consignment reference) and its type had no box - the checklist printed them but
              nothing could fill them. Optional on a BE; used when the consignment is tracked by a reference. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ width: '130px', minWidth: '130px', whiteSpace: 'nowrap' }}>UCR No</label>
            <input name="ucr" type="text" className="input-field" maxLength={35} placeholder="unique consignment reference" title="Unique Consignment Reference quoted on the BE (optional)" style={{ flex: 1, color: '#0f172a', border: '1px solid var(--primary-border)' }} value={jobData.ucr || ''} onChange={handleChange} />
            <label style={{ width: '70px', minWidth: '70px', whiteSpace: 'nowrap', textAlign: 'right' }}>UCR Type</label>
            <input name="ucrType" list="ucr-type-list" type="text" className="input-field" maxLength={6} placeholder="AWB" title="What the reference is (AWB, BL, ...)" style={{ width: '90px', color: '#0f172a', border: '1px solid var(--primary-border)', textTransform: 'uppercase' }} value={jobData.ucrType || ''} onChange={e => handleChange({ target: { name: 'ucrType', value: e.target.value.toUpperCase() } })} />
            <datalist id="ucr-type-list"><option value="AWB">Air waybill</option><option value="BL">Bill of lading</option><option value="IGM">IGM</option></datalist>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ width: '130px', minWidth: '130px', whiteSpace: 'nowrap' }}>Additional Details</label>
            <input type="text" className="input-field" placeholder="N" maxLength={2} value={jobData.addtlDetails || 'N'} onChange={e => { const v = yn(e.target.value); setAddtlDetails(v); setJobData(prev => ({...prev, addtlDetails: v})); }} style={{ width: '40px', color: '#0f172a', border: '1px solid var(--primary-border)' }} />
          </div>
          
          
          {addtlDetails?.toUpperCase() === 'Y' && (
              <div style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', borderTop: '1px solid var(--primary-border)', paddingTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#dcfce7', padding: '4px' }}>
                <label style={{ width: '120px', minWidth: '100px', fontSize: '11px', whiteSpace: 'nowrap' }}>Delivery Date</label>
                <input name="deliveryDate" type="text" className="input-field" placeholder="DATE" style={{ width: '120px', border: '1px solid var(--primary-color-start)' }} value={(jobData["deliveryDate"] ?? jobData["date"]) || ""} onChange={handleChange} />
                
                <label style={{ width: '60px', minWidth: '60px', fontSize: '11px', marginLeft: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>GRN No.</label>
                <input name="grnNo" type="text" className="input-field" placeholder="NO" style={{ width: '120px', border: '1px solid var(--primary-color-start)' }} value={(jobData["grnNo"] ?? jobData["no"]) || ""} onChange={handleChange} />
                
                <label style={{ width: '50px', minWidth: '50px', fontSize: '11px', marginLeft: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>PO No.</label>
                <input name="poNo" type="text" className="input-field" placeholder="PO NO." style={{ width: '120px', border: '1px solid var(--primary-color-start)' }} value={jobData["poNo"] || ""} onChange={handleChange} />
                
                <label style={{ width: '70px', minWidth: '70px', fontSize: '11px', marginLeft: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>Head Desc.</label>
                <input name="headDesc" type="text" className="input-field" placeholder="HEAD DESC." style={{ flex: 1, border: '1px solid var(--primary-color-start)' }} value={jobData["headDesc"] || ""} onChange={handleChange} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef9c3', padding: '4px' }}>
                <label style={{ width: '120px', minWidth: '100px', fontSize: '11px', whiteSpace: 'nowrap' }}>{transportMode === 'A' ? 'Air Line' : 'Shipping Line'}</label>
                <input name="lineName" type="text" list={transportMode === 'S' ? 'be-shipping-lines' : undefined} className="input-field" placeholder="LINE NAME" style={{ width: '180px', border: '1px solid var(--primary-color-start)' }} value={jobData["lineName"] || ""} onChange={handleChange} />
                {transportMode === 'S' && (
                  <datalist id="be-shipping-lines">
                    {shippingLines.map(l => <option key={l.id} value={l.name} />)}
                  </datalist>
                )}
                
                {transportMode === 'S' ? (
                  <>
                    <label style={{ width: '60px', minWidth: '60px', fontSize: '11px', textAlign: 'right', whiteSpace: 'nowrap' }}>Vessel</label>
                    <input name="vessel" type="text" className="input-field" placeholder="VESSEL" style={{ flex: 1, border: '1px solid var(--primary-color-start)' }} value={jobData["vessel"] || ""} onChange={handleChange} />
                  </>
                ) : (
                  <div style={{ flex: 1 }}></div>
                )}

                <label style={{ width: '70px', minWidth: '70px', fontSize: '11px', marginLeft: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{transportMode === 'A' ? 'Flight No' : 'Voyage No'}</label>
                <input name="flightVoyage" type="text" className="input-field" placeholder="FLIGHT & VOYAGE" style={{ width: '120px', border: '1px solid var(--primary-color-start)' }} value={jobData["flightVoyage"] || ""} onChange={handleChange} />

                <label style={{ width: '40px', minWidth: '40px', fontSize: '11px', marginLeft: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>ETA</label>
                <input name="eta" type="text" className="input-field" placeholder="ETA" style={{ width: '120px', border: '1px solid var(--primary-color-start)' }} value={jobData["eta"] || ""} onChange={handleChange} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef9c3', padding: '4px' }}>
                <label style={{ width: '120px', minWidth: '120px', fontSize: '11px', whiteSpace: 'nowrap' }}>Chargable Weight</label>
                <input name="chargableWeight" type="text" className="input-field" placeholder="CHARGABLE WEIGHT" style={{ width: '150px', border: '1px solid var(--primary-color-start)' }} value={jobData["chargableWeight"] || ""} onChange={handleChange} />
                
                <label style={{ width: '70px', minWidth: '70px', fontSize: '11px', textAlign: 'right', whiteSpace: 'nowrap' }}>CFS Name</label>
                {/* 30-Oct-2026: these three were selects whose options had no value, so the word "Select" / "SELECT" was
                    saved, and they wrote autoField_53 / 55, which a file import uses for importer type / green channel.
                    Now: own keys (cfsName, movementRemarks, deliveryMode), blank = nothing chosen. */}
                <input name="cfsName" type="text" className="input-field" placeholder="CFS / shed" style={{ flex: 1, border: '1px solid var(--primary-color-start)', color: 'var(--primary-color-start)' }} value={jobData.cfsName || ""} onChange={handleChange} />

                <label style={{ width: '130px', minWidth: '130px', fontSize: '11px', marginLeft: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>Movement Remarks</label>
                <select name="movementRemarks" className="input-field" style={{ width: '120px', border: '1px solid var(--primary-color-start)', color: 'var(--primary-color-start)' }} value={jobData.movementRemarks ?? (/^select$/i.test(String(jobData.autoField_54 || '')) ? '' : (jobData.autoField_54 || ''))} onChange={handleChange}>
                  <option value="">Select</option>
                  {['BILLING PURPOSE', 'EX-BOND', 'PARTY MOVEMENT', 'DPD', 'ICD OTHER', 'IN PROCESS', 'YES', 'LATE DOCUMENT'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>

                <label style={{ width: '85px', minWidth: '85px', fontSize: '11px', marginLeft: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>Delivery Mode</label>
                <select name="deliveryMode" className="input-field" style={{ width: '120px', border: '1px solid var(--primary-color-start)', color: 'var(--primary-color-start)' }} value={jobData.deliveryMode ?? (['DESTUFF', 'LOADED'].includes(String(jobData.autoField_55 || '')) ? jobData.autoField_55 : '')} onChange={handleChange}>
                  <option value="">Select</option>
                  <option value="DESTUFF">DESTUFF</option>
                  <option value="LOADED">LOADED</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* IGM DETAILS */}
    </>
  );
}
