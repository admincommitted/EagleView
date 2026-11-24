import React, { useState } from 'react';
import { Shield, X, Box, Anchor, Activity, Globe, CheckCircle, AlertTriangle } from 'lucide-react';
import AircraftBlueprintViewer from './AircraftBlueprintViewer';

const AircraftCommandCenter = ({ aircraft, onClose }) => {
  const [activeTab, setActiveTab] = useState('blueprint');
  
  // Loadability State
  const [cargoL, setCargoL] = useState('');
  const [cargoW, setCargoW] = useState('');
  const [cargoH, setCargoH] = useState('');
  const [cargoWgt, setCargoWgt] = useState('');
  
  // CG Simulator State
  const [cgPosition, setCgPosition] = useState(50); // 0=FWD, 100=AFT

  if (!aircraft) return null;

  // Loadability Logic
  let fitsDim = null;
  let fitsWgt = null;
  let loadMsg = "";
  if (cargoL && cargoW && cargoH && cargoWgt) {
     fitsDim = (Number(cargoL) <= aircraft.maxLengthCm && Number(cargoW) <= aircraft.maxWidthCm && Number(cargoH) <= aircraft.maxHeightCm);
     fitsWgt = (Number(cargoWgt) <= aircraft.maxKgsPerPiece);
     if (fitsDim && fitsWgt) loadMsg = "CARGO CLEAR TO LOAD";
     else if (!fitsDim) loadMsg = "DIMENSIONS EXCEED AIRCRAFT LIMITS";
     else if (!fitsWgt) loadMsg = "WEIGHT EXCEEDS MAX KGS/PIECE";
  }

  // Range/CO2 Logic
  const rangePct = Math.min((aircraft.maxRangeKm / 15000) * 100, 100);
  const getCo2Grade = (idx) => {
     if (idx < 0.85) return { grade: 'A', color: '#10b981' };
     if (idx < 1.0) return { grade: 'B', color: '#84cc16' };
     if (idx < 1.25) return { grade: 'C', color: '#f59e0b' };
     return { grade: 'D', color: '#ef4444' };
  };
  const co2Data = getCo2Grade(aircraft.co2EmissionIndex || 1.0);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ width: '900px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        {/* HEADER */}
        <div style={{ padding: '20px', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <Shield color="#38bdf8" size={28} />
            <div>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                 AIRCRAFT: {aircraft.aircraftType} <span style={{ color: '#38bdf8' }}>({aircraft.iataCode})</span>
              </h2>
              <p style={{ margin: 0, color: '#475569', fontSize: '13px', marginTop: '2px', textTransform: 'uppercase' }}>
                 {aircraft.make} � {aircraft.bodyType} � {aircraft.deckType}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X color="#94a3b8" size={24} />
          </button>
        </div>
        
        {/* TABS */}
        <div style={{ display: 'flex', borderBottom: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}>
          <button onClick={() => setActiveTab('blueprint')} style={{ flex: 1, padding: '12px', background: activeTab === 'blueprint' ? '#f1f5f9' : 'transparent', color: activeTab === 'blueprint' ? '#0284c7' : '#64748b', border: 'none', borderBottom: activeTab === 'blueprint' ? '2px solid #0284c7' : '2px solid transparent', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Activity size={16} /> HOLOGRAM BLUEPRINT
          </button>
          <button onClick={() => setActiveTab('loadability')} style={{ flex: 1, padding: '12px', background: activeTab === 'loadability' ? '#f1f5f9' : 'transparent', color: activeTab === 'loadability' ? '#0284c7' : '#64748b', border: 'none', borderBottom: activeTab === 'loadability' ? '2px solid #0284c7' : '2px solid transparent', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Box size={16} /> LOADABILITY CHECKER
          </button>
          <button onClick={() => setActiveTab('cg')} style={{ flex: 1, padding: '12px', background: activeTab === 'cg' ? '#f1f5f9' : 'transparent', color: activeTab === 'cg' ? '#0284c7' : '#64748b', border: 'none', borderBottom: activeTab === 'cg' ? '2px solid #0284c7' : '2px solid transparent', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Anchor size={16} /> WEIGHT & BALANCE
          </button>
          <button onClick={() => setActiveTab('esg')} style={{ flex: 1, padding: '12px', background: activeTab === 'esg' ? '#f1f5f9' : 'transparent', color: activeTab === 'esg' ? '#0284c7' : '#64748b', border: 'none', borderBottom: activeTab === 'esg' ? '2px solid #0284c7' : '2px solid transparent', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Globe size={16} /> RANGE & ESG
          </button>
        </div>

        {/* CONTENT */}
        <div style={{ padding: '20px', backgroundColor: '#ffffff', flex: 1 }}>
           
           {/* TAB 1: BLUEPRINT */}
           {activeTab === 'blueprint' && (
             <div>
               <AircraftBlueprintViewer aircraft={aircraft} tilt={0} />
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginTop: '20px' }}>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '15px', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
                     <p style={{ margin: 0, fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>Max Payload</p>
                     <p style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 'bold' }}>{aircraft.maxPayloadTons} TONS</p>
                  </div>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '15px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                     <p style={{ margin: 0, fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>Volume Capacity</p>
                     <p style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 'bold' }}>{aircraft.maxVolumeCbm} CBM</p>
                  </div>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '15px', borderRadius: '8px', borderLeft: '3px solid #38bdf8' }}>
                     <p style={{ margin: 0, fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>Max Door Size</p>
                     <p style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 'bold' }}>{aircraft.doorSize}</p>
                  </div>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '15px', borderRadius: '8px', borderLeft: '3px solid #f43f5e' }}>
                     <p style={{ margin: 0, fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>Max Kgs/Piece</p>
                     <p style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 'bold' }}>{aircraft.maxKgsPerPiece} KG</p>
                  </div>
               </div>
             </div>
           )}

           {/* TAB 2: LOADABILITY */}
           {activeTab === 'loadability' && (
             <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: 1, backgroundColor: '#f1f5f9', padding: '20px', borderRadius: '8px' }}>
                   <h3 style={{ margin: '0 0 15px 0', color: '#0f172a' }}>CARGO DIMENSIONS</h3>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div>
                         <label style={{ color: '#475569', fontSize: '12px' }}>LENGTH (CM)</label>
                         <input type="number" value={cargoL} onChange={e=>setCargoL(e.target.value)} style={{ width: '100%', padding: '10px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '4px', marginTop: '5px' }} />
                      </div>
                      <div>
                         <label style={{ color: '#475569', fontSize: '12px' }}>WIDTH (CM)</label>
                         <input type="number" value={cargoW} onChange={e=>setCargoW(e.target.value)} style={{ width: '100%', padding: '10px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '4px', marginTop: '5px' }} />
                      </div>
                      <div>
                         <label style={{ color: '#475569', fontSize: '12px' }}>HEIGHT (CM)</label>
                         <input type="number" value={cargoH} onChange={e=>setCargoH(e.target.value)} style={{ width: '100%', padding: '10px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '4px', marginTop: '5px' }} />
                      </div>
                      <div>
                         <label style={{ color: '#475569', fontSize: '12px' }}>WEIGHT PER PIECE (KG)</label>
                         <input type="number" value={cargoWgt} onChange={e=>setCargoWgt(e.target.value)} style={{ width: '100%', padding: '10px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '4px', marginTop: '5px' }} />
                      </div>
                   </div>
                </div>
                
                <div style={{ flex: 1, backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                   {!loadMsg && <div style={{ color: '#64748b' }}>ENTER DIMENSIONS TO SCAN LOADABILITY</div>}
                   {loadMsg === 'CARGO CLEAR TO LOAD' && (
                      <div style={{ animation: 'pulse 2s infinite' }}>
                         <CheckCircle color="#10b981" size={80} style={{ margin: '0 auto 15px auto' }} />
                         <h3 style={{ color: '#10b981', margin: 0 }}>CLEAR TO LOAD</h3>
                         <p style={{ color: '#475569', fontSize: '13px' }}>Dimensions and weight are within {aircraft.aircraftType} limits.</p>
                      </div>
                   )}
                   {loadMsg && loadMsg !== 'CARGO CLEAR TO LOAD' && (
                      <div style={{ animation: 'pulse 2s infinite' }}>
                         <AlertTriangle color="#ef4444" size={80} style={{ margin: '0 auto 15px auto' }} />
                         <h3 style={{ color: '#ef4444', margin: 0 }}>LOAD REJECTED</h3>
                         <p style={{ color: '#ef4444', fontSize: '13px', fontWeight: 'bold' }}>{loadMsg}</p>
                      </div>
                   )}
                   
                   <div style={{ marginTop: '30px', width: '100%', borderTop: '1px solid #cbd5e1', paddingTop: '15px' }}>
                      <p style={{ color: '#475569', margin: '0 0 5px 0', fontSize: '11px', textAlign: 'left' }}>AIRCRAFT LIMITS:</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0f172a', fontSize: '12px' }}>
                        <span>L: {aircraft.maxLengthCm}cm</span>
                        <span>W: {aircraft.maxWidthCm}cm</span>
                        <span>H: {aircraft.maxHeightCm}cm</span>
                        <span>WGT: {aircraft.maxKgsPerPiece}kg</span>
                      </div>
                   </div>
                </div>
             </div>
           )}

           {/* TAB 3: WEIGHT & BALANCE */}
           {activeTab === 'cg' && (
             <div>
               {/* Pass tilt to Blueprint Viewer to rotate it! */}
               <AircraftBlueprintViewer aircraft={aircraft} tilt={(cgPosition - 50) * 0.4} />
               
               <div style={{ marginTop: '20px', backgroundColor: '#f1f5f9', padding: '20px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>
                     <span style={{ color: cgPosition < 30 ? '#ef4444' : '#94a3b8' }}>FWD (NOSE HEAVY)</span>
                     <span>CENTER OF GRAVITY (CG)</span>
                     <span style={{ color: cgPosition > 70 ? '#ef4444' : '#94a3b8' }}>AFT (TAIL TIP RISK)</span>
                  </div>
                  <input type="range" min="0" max="100" value={cgPosition} onChange={(e) => setCgPosition(e.target.value)} style={{ width: '100%', cursor: 'pointer', accentColor: (cgPosition > 70 || cgPosition < 30) ? '#ef4444' : '#10b981' }} />
                  
                  {cgPosition > 75 && (
                    <div style={{ marginTop: '15px', backgroundColor: 'rgba(239, 68, 68, 0.2)', padding: '10px', borderRadius: '4px', border: '1px solid #ef4444', color: '#ef4444', display: 'flex', gap: '10px', alignItems: 'center' }}>
                       <AlertTriangle size={20} />
                       <strong>CRITICAL: TAIL-TIPPING RISK DETECTED. REDISTRIBUTE LOAD FORWARD.</strong>
                    </div>
                  )}
                  {cgPosition < 25 && (
                    <div style={{ marginTop: '15px', backgroundColor: 'rgba(245, 158, 11, 0.2)', padding: '10px', borderRadius: '4px', border: '1px solid #f59e0b', color: '#f59e0b', display: 'flex', gap: '10px', alignItems: 'center' }}>
                       <AlertTriangle size={20} />
                       <strong>WARNING: NOSE-HEAVY LOAD DETECTED. AIRCRAFT ROTATION MAY BE COMPROMISED.</strong>
                    </div>
                  )}
               </div>
             </div>
           )}

           {/* TAB 4: RANGE & ESG */}
           {activeTab === 'esg' && (
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', height: '380px' }}>
                <div style={{ backgroundColor: '#f1f5f9', padding: '30px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                   <h3 style={{ color: '#0f172a', margin: '0 0 5px 0' }}>MAXIMUM RANGE</h3>
                   <p style={{ color: '#475569', fontSize: '13px', margin: '0 0 30px 0' }}>Flight capability at maximum payload.</p>
                   
                   <div style={{ display: 'flex', alignItems: 'end', gap: '10px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '40px', fontWeight: 'bold', color: '#38bdf8', lineHeight: '1' }}>{aircraft.maxRangeKm || 'N/A'}</span>
                      <span style={{ color: '#475569', paddingBottom: '5px' }}>KM</span>
                   </div>
                   
                   <div style={{ width: '100%', height: '10px', backgroundColor: '#ffffff', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{ width: `${rangePct}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #818cf8)' }}></div>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', color: '#64748b', fontSize: '11px' }}>
                      <span>0 KM</span>
                      <span>INTERCONTINENTAL (15000+ KM)</span>
                   </div>
                </div>

                <div style={{ backgroundColor: '#f1f5f9', padding: '30px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                   <Globe size={40} color={co2Data.color} style={{ marginBottom: '15px' }} />
                   <h3 style={{ color: '#0f172a', margin: '0 0 5px 0' }}>ESG CARBON RATING</h3>
                   <p style={{ color: '#475569', fontSize: '13px', margin: '0 0 20px 0' }}>Environmental Impact / Efficiency Index</p>
                   
                   <div style={{ width: '100px', height: '100px', borderRadius: '50%', border: `5px solid ${co2Data.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', fontWeight: 'bold', color: co2Data.color, marginBottom: '10px' }}>
                      {co2Data.grade}
                   </div>
                   <p style={{ color: '#0f172a', fontSize: '14px', margin: 0 }}>Index Score: {aircraft.co2EmissionIndex}</p>
                </div>
             </div>
           )}

        </div>
      </div>
    </div>
  );
};

export default AircraftCommandCenter;
