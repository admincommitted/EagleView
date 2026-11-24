// DOCUMENTS menu of the AWB / MAWB / HAWB screens - 11-Nov-2026.
// One list for all three screens (before: the MAWB screen had none, the security declaration was in no menu). The
// documents its special handling codes call for are marked "needed". Every window fills itself from the saved AWB.
import React from 'react';

const ITEMS = [
  ['Shipment', [
    ['sli', "Shipper's Letter of Instruction (SLI)", 'setShowSli'],
    ['booking', 'Booking confirmation', 'setShowBooking'],
    ['label', 'Cargo labels (with barcode)', 'setShowLabel'],
    ['manifest', 'Cargo manifest (consol)', 'setShowManifest'],
  ]],
  ['Declarations', [
    ['csd', 'Consignment security declaration (CSD)', 'setShowCsd'],
    ['ecsd', 'e-CSD (export)', null],
    ['dgd', "Shipper's declaration - dangerous goods", 'setShowDgd'],
    ['lithium', 'Lithium battery declaration', 'setShowLithium'],
    ['avi', 'Live animals certification', 'setShowAvi'],
    ['temp', 'Temperature control instructions', 'setShowTemp'],
  ]],
  ['Other', [
    ['coo', 'Certificate of origin', 'setShowCoo'],
    ['cca', 'Cargo charges correction advice (CCA)', 'setShowCca'],
    ['do', 'Delivery order', 'setShowDo'],
  ]],
];
// which special handling codes call for which document
const NEEDS = { dgd: ['DGR', 'RCL', 'RCM', 'RCX', 'RFL', 'RFS', 'RFW', 'RIS', 'RMD', 'RNG', 'ROP', 'ROX', 'RPB', 'RPG', 'RRW', 'RRY', 'RRE', 'RSB', 'RSC', 'RXB', 'RXC', 'RXD', 'RXE', 'RXG', 'RXS', 'CAO', 'ICE'],
  lithium: ['ELI', 'ELM', 'RLI', 'RLM'], avi: ['AVI'], temp: ['COL', 'CRT', 'ERT', 'FRO', 'ICE', 'PIL', 'PER', 'ACT'] };

export default function DocumentsMenu({ ctx, type }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const shc = new Set((Array.isArray(ctx.sphCodes) ? ctx.sphCodes : String(ctx.sphCodes || '').split(/[\s,]+/)).map(s => String(s || '').toUpperCase()).filter(Boolean));
  const needed = (k) => (NEEDS[k] || []).some(c => shc.has(c));
  const anyNeeded = Object.keys(NEEDS).some(needed);
  const go = (k, setter) => {
    setOpen(false);
    if (k === 'ecsd') {
      try { localStorage.setItem('ecsd_data', JSON.stringify({ awbPrefix: ctx.awbPrefix || '', awbSuffix: ctx.awbSuffix || '', dep: ctx.depAirport || '', dest: ctx.destAirport || '', nature: ctx.natureOfGoods || '' })); } catch (e) { /* ignore */ }
      if (ctx.navigate) ctx.navigate('/freight/ecsd');
      return;
    }
    if (typeof ctx[setter] === 'function') ctx[setter](true);
  };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        title={anyNeeded ? 'The special handling codes of this AWB need a declaration - see the marked documents' : 'Documents of this AWB, filled from the saved AWB'}
        style={{ backgroundColor: anyNeeded ? '#ea580c' : '#475569', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
        DOCUMENTS ▾
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: '4px', backgroundColor: 'white', border: '1px solid #94a3b8', borderRadius: '6px', boxShadow: '0 8px 20px rgba(15,23,42,.18)', zIndex: 60, minWidth: '300px', padding: '4px 0' }}>
          {!ctx.currentAwbId && <div style={{ padding: '6px 12px', fontSize: '11px', color: '#b45309' }}>Save the AWB first - the documents are filled from the saved AWB.</div>}
          {ITEMS.map(([group, list]) => (
            <div key={group}>
              <div style={{ padding: '6px 12px 2px', fontSize: '10px', fontWeight: 800, color: '#64748b', letterSpacing: '0.04em' }}>{group}</div>
              {list.filter(([k]) => !(k === 'manifest' && type === 'AWB')).map(([k, label, setter]) => (
                <button key={k} type="button" role="menuitem" onClick={() => go(k, setter)}
                  style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '8px', backgroundColor: 'transparent', color: '#0f172a', border: 'none', padding: '6px 12px', textAlign: 'left', fontSize: '12px', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ flex: 1 }}>{label}{k === 'manifest' && type === 'HAWB' ? ' - of its MAWB' : ''}</span>
                  {needed(k) && <span style={{ fontSize: '10px', fontWeight: 800, color: '#ea580c', border: '1px solid #fdba74', borderRadius: '8px', padding: '0 6px' }}>needed</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
