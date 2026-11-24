// Form section: Airport of Departure*
// Split out of CreateHouseWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import FieldAutocomplete from '../../../../FieldAutocomplete';
import React from 'react';
import ModernDatePicker from '../../../../common/ModernDatePicker';

export default function RoutingSection({ ctx }) {
  const { by1, by2, by3, carriageValue, chargeCode, currencyCode, customsValue, depAirport, destAirport, flightDate1, flightDate2, flightNumber1, flightNumber2, flightTime1, flightTime2, insuranceValue, otherPC, setBy1, setBy2, setBy3, setCarriageValue, setChargeCode, setCurrencyCode, setCustomsValue, setDepAirport, setDestAirport, setDestAirportName, setFlightDate1, setFlightDate2, setFlightNumber1, setFlightNumber2, setFlightTime1, setFlightTime2, setInsuranceValue, setOtherCharges, setOtherPC, setTo1, setTo2, setTo3, setWtValPC, to1, to2, to3, wtValPC } = ctx;
  // 22-Nov-2026: the 2nd and 3rd flight are hidden until "+ Add flight" is clicked; a line that has a value
  // (an old AWB opened) is always shown, so no saved value is hidden. Nothing in the saved data changed.
  const [open2, setOpen2] = React.useState(false);
  const [open3, setOpen3] = React.useState(false);
  const filled = (...v) => v.some(x => String(x == null ? '' : x).trim() !== '');
  const show2 = open2 || filled(to2, by2, flightNumber2, flightDate2, flightTime2);
  const show3 = open3 || filled(to3, by3);
  const fltLink = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'var(--theme-base, #0284c7)', whiteSpace: 'nowrap' };
  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column' }}>

            <div className="flt-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: '8px', padding: '4px 8px' }}>
              <div><label style={{ fontSize: "11px", fontWeight: "bold", color: "#1e3a8a" }}>Airport of Departure*</label><FieldAutocomplete listType="airport" value={depAirport} onChange={e => setDepAirport(e.target.value.toUpperCase())} onSelect={opt => setDepAirport(opt.title)} placeholder="airport" className="premium-input" style={{ width: "100%", padding: "4px 8px", fontSize: "12px", border: "1px solid #ef4444", backgroundColor: "#ffffff" }} /></div>
              <div><label style={{ fontSize: "11px", fontWeight: "bold", color: "#1e3a8a" }}>Airport of Destination*</label><FieldAutocomplete listType="airport" value={destAirport} onChange={e => setDestAirport(e.target.value.toUpperCase())} onSelect={opt => { setDestAirport(opt.title); setDestAirportName(opt.subtitle || ''); }} placeholder="airport" className="premium-input" style={{ width: "100%", padding: "4px 8px", fontSize: "12px", border: "1px solid #ef4444", backgroundColor: "#ffffff" }} /></div>
              <div><label style={{ fontSize: "11px", fontWeight: "bold", color: "#1e3a8a" }}>To*</label><FieldAutocomplete listType="airport" value={to1} onChange={e => setTo1(e.target.value.toUpperCase())} onSelect={opt => setTo1(opt.title)} placeholder="airport" className="premium-input" style={{ width: "100%", padding: "4px 8px", fontSize: "12px", border: "1px solid #ef4444", backgroundColor: "#ffffff" }} /></div>
              <div><label style={{ fontSize: "11px", fontWeight: "bold", color: "#1e3a8a" }}>By First Carrier*</label><FieldAutocomplete listType="airline-code" value={by1} onChange={e => setBy1(e.target.value.toUpperCase())} onSelect={opt => setBy1(opt.title)} placeholder="airline" maxLength={2} className="premium-input" style={{ width: "100%", padding: "4px 8px", fontSize: "12px", border: "1px solid #ef4444", backgroundColor: "#ffffff" }} /></div>
              <div><label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Flt No 1</label><input type="text" autoComplete="off" className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px' }} maxLength={7} placeholder="e.g. BA123" value={flightNumber1} onChange={e => setFlightNumber1(e.target.value)} /></div>
              <div><label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Flt Dt 1</label><ModernDatePicker className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px' }} value={flightDate1} onChange={e => setFlightDate1(e.target.value)} /></div>
              <div><label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Dep Time 1</label><input type="time" autoComplete="off" className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px' }} value={flightTime1} onChange={e => setFlightTime1(e.target.value)} /></div>
              <div><label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>CTO</label><select className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', color: 'var(--primary-color-end, #2563eb)' }}><option>Select</option></select></div>
            </div>
            {show2 && (
            <div className="flt-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: '8px', padding: '4px 8px' }}>
              <div><label style={{ fontSize: "11px", fontWeight: "bold", color: "#1e3a8a" }}>To</label><FieldAutocomplete listType="airport" value={to2} onChange={e => setTo2(e.target.value.toUpperCase())} onSelect={opt => setTo2(opt.title)} placeholder="airport" className="premium-input" style={{ width: "100%", padding: "4px 8px", fontSize: "12px", border: "1px solid var(--text-muted, #64748b)", backgroundColor: "#f8fafc" }} /></div>
              <div><label style={{ fontSize: "11px", fontWeight: "bold", color: "#1e3a8a" }}>By</label><FieldAutocomplete listType="airline-code" value={by2} onChange={e => setBy2(e.target.value.toUpperCase())} onSelect={opt => setBy2(opt.title)} placeholder="airline" maxLength={2} className="premium-input" style={{ width: "100%", padding: "4px 8px", fontSize: "12px", border: "1px solid var(--text-muted, #64748b)", backgroundColor: "#f8fafc" }} /></div>
              <div><label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Flt No 2</label><input type="text" autoComplete="off" className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px' }} maxLength={7} placeholder="e.g. BA123" value={flightNumber2} onChange={e => setFlightNumber2(e.target.value)} /></div>
              <div><label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Flt Dt 2</label><ModernDatePicker className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px' }} value={flightDate2} onChange={e => setFlightDate2(e.target.value)} /></div>
              <div><label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Dep Time 2</label><input type="time" autoComplete="off" className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px' }} value={flightTime2} onChange={e => setFlightTime2(e.target.value)} /></div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '3px' }}><button type="button" tabIndex={-1} style={fltLink} title="Clears flight 2 and hides this line" onClick={() => { setTo2(''); setBy2(''); setFlightNumber2(''); setFlightDate2(''); setFlightTime2(''); setOpen2(false); }}>Remove flight 2</button></div>
            </div>
            )}
            {show3 && (
            <div className="flt-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: '8px', padding: '4px 8px' }}>
              <div><label style={{ fontSize: "11px", fontWeight: "bold", color: "#1e3a8a" }}>To</label><FieldAutocomplete listType="airport" value={to3} onChange={e => setTo3(e.target.value.toUpperCase())} onSelect={opt => setTo3(opt.title)} placeholder="airport" className="premium-input" style={{ width: "100%", padding: "4px 8px", fontSize: "12px", border: "1px solid var(--text-muted, #64748b)", backgroundColor: "#f8fafc" }} /></div>
              <div><label style={{ fontSize: "11px", fontWeight: "bold", color: "#1e3a8a" }}>By</label><FieldAutocomplete listType="airline-code" value={by3} onChange={e => setBy3(e.target.value.toUpperCase())} onSelect={opt => setBy3(opt.title)} placeholder="airline" maxLength={2} className="premium-input" style={{ width: "100%", padding: "4px 8px", fontSize: "12px", border: "1px solid var(--text-muted, #64748b)", backgroundColor: "#f8fafc" }} /></div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '3px' }}><button type="button" tabIndex={-1} style={fltLink} title="Clears flight 3 and hides this line" onClick={() => { setTo3(''); setBy3(''); setOpen3(false); }}>Remove flight 3</button></div>
            </div>
            )}
            {(!show2 || !show3) && (
            <div style={{ display: 'flex', gap: '14px', padding: '0 8px 4px 8px' }}>
              {!show2 && <button type="button" style={fltLink} onClick={() => setOpen2(true)}>+ Add flight 2</button>}
              {show2 && !show3 && <button type="button" style={fltLink} onClick={() => setOpen3(true)}>+ Add flight 3</button>}
            </div>
            )}
          </div>

      {/* Charge Declarations */}
      {/* 22-Nov-2026: no heading band here - the charge boxes are part of the flight block */}

          <div style={{ display: 'grid', gridTemplateColumns: '80px 100px 100px 100px 1.5fr 1.5fr 1fr', gap: '8px', padding: '8px', backgroundColor: '#ffffff' }}>

            <div><label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Currency</label><FieldAutocomplete listType="currency"   autoComplete="off" className="premium-input" maxLength={3} style={{ width: '100%', padding: '4px 8px', fontSize: '11px', boxSizing: 'border-box', height: '24px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', color: 'var(--primary-color-end, #2563eb)', fontWeight: 'bold' }} value={currencyCode} onChange={e => setCurrencyCode(e.target.value.toUpperCase())} /></div>

            <div><label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>CHGS CODE</label><select className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', color: 'var(--primary-color-end, #2563eb)', fontWeight: 'bold' }} value={chargeCode} onChange={e => {
                const val = e.target.value;
                setChargeCode(val);
                const pc = val.charAt(0) === 'P' ? 'P' : 'C'; // PX (prepaid credit) is prepaid too (11-Nov-2026)
                // the accounting text follows when it is still the standard one
                if (typeof ctx.setAccountingInfo === 'function' && /^(FREIGHT (PREPAID|COLLECT))?$/.test(String(ctx.accountingInfo || '').trim())) ctx.setAccountingInfo(pc === 'P' ? 'FREIGHT PREPAID' : 'FREIGHT COLLECT');
                if(typeof setWtValPC === 'function') setWtValPC(pc);
                if(typeof setOtherPC === 'function') { setOtherPC(pc); if(typeof setOtherCharges === 'function') setOtherCharges(prev => prev.map(c => ({...c, ppcc: pc === 'C' ? 'CC' : 'PP'}))); }
              }}>
                    {/* IATA charge codes - this code now goes in the XFWB as chosen (before PP went as PX, every collect code as CX) */}
                    <option value="PP">PP - All prepaid (cash)</option>
                    <option value="PX">PX - All prepaid (credit / CASS)</option>
                    <option value="CC">CC - All collect</option>
                    <option value="CP">CP - Destination collect (cash)</option>
                    <option value="CX">CX - Destination collect (credit)</option>
                    <option value="CG">CG - All collect (GBL)</option>
            </select></div>

            <div><label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Wt/Val(P/C)</label><select className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', color: 'var(--primary-color-end, #2563eb)', fontWeight: 'bold' }} value={wtValPC} onChange={(e) => setWtValPC(e.target.value)}><option value="P">P - Prepaid</option><option value="C">C - Collect</option></select></div>

            <div><label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Other(P/C)</label><select className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', color: 'var(--primary-color-end, #2563eb)', fontWeight: 'bold' }} value={otherPC} onChange={(e) => { const v = e.target.value; setOtherPC(v); if(typeof setOtherCharges === 'function') { setOtherCharges(prev => prev.map(c => ({...c, ppcc: v === 'C' ? 'CC' : 'PP'}))); } }}><option value="P">P - Prepaid</option><option value="C">C - Collect</option></select></div>

            <div><label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Declared Value for Carriage</label><input type="text" autoComplete="off" className="premium-input" maxLength={12} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', border: '1px solid #ef4444', backgroundColor: '#ffffff', color: 'var(--text-main, #0f172a)', fontWeight: 'bold' }} value={carriageValue} onChange={e => setCarriageValue(e.target.value)} /></div>

            <div><label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Declared Value for Customs</label><input type="text" autoComplete="off" className="premium-input" maxLength={12} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', border: '1px solid #ef4444', backgroundColor: '#ffffff', color: 'var(--text-main, #0f172a)', fontWeight: 'bold' }} value={customsValue} onChange={e => setCustomsValue(e.target.value)} /></div>

            <div><label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }} title="If the carrier offers insurance and it is asked for as per its conditions, put the amount to be insured in figures here.">Amount of Insurance <span style={{ fontWeight: 400, color: 'var(--text-muted, #64748b)' }}>(?)</span></label><input type="text" title="If the carrier offers insurance and it is asked for as per its conditions, put the amount to be insured in figures here." autoComplete="off" className="premium-input" maxLength={12} style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', color: 'var(--text-main, #0f172a)', fontWeight: 'bold' }} value={insuranceValue} onChange={e => setInsuranceValue(e.target.value)} /></div>


              </div>

                              {/* Handling Information */}

        <div style={{ backgroundColor: 'var(--primary-bg-light, #fce7f3)', borderLeft: '4px solid var(--primary-color-start, #ec4899)', color: '#334155', padding: '6px 12px', borderBottom: '1px solid #94a3b8', fontSize: '13px', fontWeight: '800', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

          <span>Handling Information</span>

          <span style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 'bold' }}>**SPH, SSR, OCI AND OSI FIELDS ARE EQUIVALENT TO THE "HANDLING INFORMATION BOX"</span>

        </div>
    </>
  );
}
