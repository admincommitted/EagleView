// Screen section: Capture AWB
// Split out of EFreightAWBForm.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Edit2, Plane } from 'lucide-react';
import React from 'react';
import { CustomDropdown } from '../helpers';

export default function CaptureAwbSection({ ctx }) {
  // 30-Oct-2026: Print and Save were both dead. onSubmit already existed in the hook and posted to
  // /api/awb/create - it was simply never called from anywhere.
  const { airlines, awbStocks, handleSubmit, iataAgents, onSubmit, printAwb, selectedIataAgentName, setRightSidebarMode, setValue, theme, watchedAwb } = ctx;
  return (
    <>
    {/* Top Header - Capture AWB */}
      <div style={{ background: 'linear-gradient(90deg, #ffffff 0%, #f8fafc 100%)', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
        <h2 style={{ margin: 0, fontSize: '20px', color: theme.textMain, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}><Plane size={24} color={theme.primary} /> Capture AWB</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" onClick={printAwb} className='btn-outline' style={{ padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Print</button>
          <button type="button" onClick={handleSubmit(onSubmit)} className='btn-primary' style={{ padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Save</button>
        </div>
      </div>

      {/* AWB Info Bar */}
              <div style={{ background: 'white', padding: '16px 24px', display: 'grid', gridTemplateColumns: '3.5fr 1.5fr 1fr 1fr 0.8fr', borderBottom: '1px solid #e5e7eb', fontSize: '13px' }}>
          <div>
            <div style={{ color: theme.blueText, fontSize: '11px', marginBottom: '4px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AWB NUMBER</div>
            <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
              <CustomDropdown 
                  options={awbStocks.map(s => {
                    const formatted = s.fullAwbNumber.length === 11 ? s.fullAwbNumber.substring(0,3) + '-' + s.fullAwbNumber.substring(3) : s.fullAwbNumber;
                    return { label: formatted, value: formatted };
                  })}
                  value={watchedAwb}
                  onChange={(val) => setValue('awbNumber', val)}
                  placeholder="Select AWB No"
                  style={{ border: 'none', borderBottom: '1px dashed #ccc', fontWeight: 'bold', width: '120px', outline: 'none', color: '#1f2937' }}
                />
              <Edit2 size={14} color={theme.primary} style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => setRightSidebarMode('awb')} />
              {(() => {
                const prefix = (watchedAwb || '').substring(0, 3);
                const airline = airlines.find(a => a.prefix === prefix);
                if (!airline) return null;
                const cdnLogo = airline.code2 ? `https://pics.avs.io/200/200/${airline.code2}.png` : null;
                const logoSrc = airline.customLogo || cdnLogo;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px', paddingLeft: '8px', borderLeft: '1px solid #e5e7eb', flexShrink: 0 }}>
                    {logoSrc ? (
                      <img 
                        src={logoSrc} 
                        alt={airline.name} 
                        style={{ height: '32px', width: 'auto', borderRadius: '2px', objectFit: 'contain' }} 
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'block';
                        }} 
                      />
                    ) : null}
                    <div style={{ display: logoSrc ? 'none' : 'block' }}>
                      <Plane size={16} color={theme.primary} />
                    </div>
                    <span style={{ fontSize: '14px', color: '#1f2937', fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {airline.name}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
          
          <div>
            <div style={{ color: theme.blueText, fontSize: '11px', marginBottom: '4px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>IATA AGENT NAME</div>
            <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CustomDropdown 
                  options={iataAgents.map(a => ({ label: a.name, value: a.name }))}
                  value={selectedIataAgentName}
                  onChange={(val) => setValue('iataAgent', val)}
                  placeholder="Select IATA Agent"
                  style={{ border: 'none', borderBottom: '1px dashed #ccc', fontWeight: 'bold', width: '280px', outline: 'none', color: '#1f2937' }}
                />
              <Edit2 size={14} color={theme.primary} style={{ cursor: 'pointer' }} onClick={() => setRightSidebarMode('iata')} />
            </div>
          </div>

          <div>
            <div style={{ color: theme.blueText, fontSize: '11px', marginBottom: '4px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>STATION</div>
            <div style={{ fontWeight: 'bold' }}>DEL</div>
          </div>

          <div>
            <div style={{ color: theme.blueText, fontSize: '11px', marginBottom: '4px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>IATA CODE</div>
            <div style={{ fontWeight: 'bold' }}>{(() => {
                  const agt = iataAgents.find(a => a.name === selectedIataAgentName);
                  return agt ? agt.iataCode : '---';
              })()}</div>
          </div>

          <div>
            <div style={{ color: theme.blueText, fontSize: '11px', marginBottom: '4px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>STATUS</div>
            <div style={{ background: theme.primary, color: 'white', padding: '2px 8px', borderRadius: '12px', display: 'inline-block', fontSize: '11px', fontWeight: 'bold' }}>NEW</div>
          </div>
        </div>
    </>
  );
}
