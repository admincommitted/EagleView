// Import job > IGM Details > Fetch from ICEGATE (14-Nov-2026)
// Reads ICEGATE's public Air IGM / Air Console enquiry for the MAWB (no login, no captcha) and fills the IGM boxes
// from the row the user picks. The grid row is still made with the screen's own Add button.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download } from 'lucide-react';

const up = (v) => String(v == null ? '' : v).trim().toUpperCase();
const dmy = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : (v || ''); };
const GRAD = 'linear-gradient(135deg, var(--primary-color-start, #0284c7), var(--primary-color-end, #075985))';

export default function IcegateIgmModal({ open, onClose, mode, location, mawb, hawb, onFill }) {
  const sea = mode === 'S'; // 14-Nov-2026: sea jobs read ICEGATE's sea IGM (old + SAM) enquiries
  const [loc, setLoc] = useState('');
  const [mawbNo, setMawbNo] = useState('');
  const [hawbNo, setHawbNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [pick, setPick] = useState(-1);

  const run = async (l, m, h) => {
    setBusy(true); setError(''); setResult(null); setPick(-1);
    let d = {};
    try {
      const r = await fetch(sea ? '/api/icegate-enquiry/sea-igm' : '/api/icegate-enquiry/air-igm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sea ? { location: l, bl: m, hbl: h } : { location: l, mawb: m, hawb: h }) });
      try { d = await r.json(); } catch (_) { d = { success: false, error: r.status === 404 ? 'ICEGATE enquiry service not found. Restart the backend.' : `Server answered HTTP ${r.status}` }; }
    } catch (e) { d = { success: false, error: 'Could not reach the EagleView server.' }; }
    setBusy(false);
    if (!d.success) { setError(d.error || 'ICEGATE enquiry failed.'); return; }
    // sea rows use BL / HBL names; the table and the fill use the air names
    if (sea) d = { ...d, hawb: d.hbl, hawbFound: d.hblFound, rows: (d.rows || []).map(x => ({ ...x, kind: x.kind === 'HBL' ? 'HAWB' : 'MAWB', mawbNo: x.blNo, hawbNo: x.hblNo, mawbDate: x.blDate, hawbDate: x.hblDate })) };
    setResult(d);
    // the HAWB of this job, when ICEGATE has it, else the first IGM line of the MAWB
    const hi = h ? d.rows.findIndex(x => x.kind === 'HAWB' && up(x.hawbNo).replace(/[^A-Z0-9]/g, '') === up(h).replace(/[^A-Z0-9]/g, '')) : -1;
    setPick(hi >= 0 ? hi : d.rows.findIndex(x => x.kind === 'MAWB'));
  };

  useEffect(() => {
    if (!open) return;
    // 14-Nov-2026: a prior BE keeps "NOMAWB" until the master is known - that is not searched
    const m0 = up(mawb).replace(/[^A-Z0-9]/g, ''); const noNo = /^NO(MAWB|MBL|BL|AWB)?$/.test(m0);
    const l = up(location), m = noNo ? '' : m0, h = up(hawb);
    setLoc(l); setMawbNo(m); setHawbNo(h); setResult(null);
    if (l && m) run(l, m, h); else setError(m ? 'Type the 6-character port (custom site), then press Fetch.' : `Type the ${sea ? 'BL' : 'MAWB'} number${noNo ? ' (this job has ' + up(mawb) + ')' : ''}, then press Fetch.`);
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const rows = (result && result.rows) || [];
  const th = { padding: '6px 8px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--primary-text, #334155)', background: 'var(--primary-bg-light, #f1f5f9)', borderBottom: '1px solid #cbd5e1', position: 'sticky', top: 0, whiteSpace: 'nowrap' };
  const td = { padding: '6px 8px', fontSize: 11, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
  const sel = rows[pick];

  return createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-label="IGM details from ICEGATE" style={{ background: 'var(--bg-panel, #fff)', color: 'var(--text-main, #0f172a)', width: 'min(1100px, 100%)', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', borderRadius: 6, boxShadow: '0 20px 50px rgba(15,23,42,0.35)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: GRAD, color: '#fff' }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>IGM details from ICEGATE <span style={{ fontWeight: 400, opacity: 0.85 }}>{sea ? 'public Sea IGM enquiry' : 'public Air IGM / Console enquiry'}</span></div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); run(up(loc), up(mawbNo).replace(/[^A-Z0-9]/g, ''), up(hawbNo)); }} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', padding: '12px 14px', borderBottom: '1px solid #e2e8f0' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, fontWeight: 600 }}>Port (custom site)
            <input className="input-field" value={loc} onChange={e => setLoc(e.target.value.toUpperCase())} maxLength={6} placeholder={sea ? "INNSA1" : "INDEL4"} style={{ width: 100 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, fontWeight: 600 }}>{sea ? 'BL No' : 'MAWB No'}
            <input className="input-field" value={mawbNo} onChange={e => setMawbNo(e.target.value.toUpperCase())} maxLength={20} placeholder="MAWB NO" style={{ width: 170 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, fontWeight: 600 }}>{sea ? 'HBL No (optional)' : 'HAWB No (optional)'}
            <input className="input-field" value={hawbNo} onChange={e => setHawbNo(e.target.value.toUpperCase())} maxLength={20} placeholder="HAWB NO" style={{ width: 170 }} />
          </label>
          <button type="submit" disabled={busy} className="btn" style={{ height: 30, padding: '0 16px', background: GRAD, color: '#fff', border: 'none', fontWeight: 600, fontSize: 12, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Fetching...' : 'Fetch'}</button>
        </form>

        {error && <div role="alert" style={{ margin: '10px 14px 0', padding: '8px 10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12, borderRadius: 4 }}>{error}</div>}
        {result && result.hawb && result.hawbFound === false && <div style={{ margin: '10px 14px 0', padding: '8px 10px', background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', fontSize: 12, borderRadius: 4 }}>{sea ? 'HBL' : 'HAWB'} {result.hawb} is not in ICEGATE's {sea ? 'IGM' : 'console'} for this {sea ? 'BL' : 'MAWB'} yet. You can still take the {sea ? 'BL' : 'MAWB'} line.</div>}
        {result && (result.errors || []).length > 0 && <div style={{ margin: '10px 14px 0', fontSize: 11, color: '#92400e' }}>Some parts could not be read: {result.errors.join('; ')}</div>}

        <div style={{ overflow: 'auto', padding: '12px 14px', flex: 1 }}>
          {busy && <div style={{ fontSize: 12, color: '#64748b' }}>Reading ICEGATE...</div>}
          {!busy && rows.length > 0 && <>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Pick the line for this job</div>
            <div style={{ border: '1px solid #cbd5e1', borderRadius: 4, overflow: 'auto', maxHeight: 360 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{(sea ? ['', 'Type', 'Source', 'IGM No', 'IGM Date', 'Inward Date', 'Line No', 'Sub Line', 'BL', 'BL Date', 'HBL', 'HBL Date', 'Pkgs', 'Pkg Code', 'Gross Wt', 'Unit', 'Vessel']
                  : ['', 'Type', 'IGM No', 'IGM Date', 'Line No', 'Sub Line', 'MAWB', 'HAWB', 'Pkgs', 'Gross Wt', 'Flight', 'Flight Date', 'Inward Date', 'Origin', 'Status']).map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{rows.map((r, i) => (
                  <tr key={i} onClick={() => setPick(i)} style={{ cursor: 'pointer', background: i === pick ? 'var(--primary-bg-light, #eff6ff)' : undefined }}>
                    <td style={td}><input type="radio" name="igmpick" checked={i === pick} onChange={() => setPick(i)} aria-label={`Pick line ${i + 1}`} /></td>
                    <td style={{ ...td, fontWeight: 600 }}>{r.kind === 'HAWB' ? 'House' : 'Master'}</td>
                    {sea ? <>
                    <td style={td}>{r.source}</td><td style={td}>{r.igmNo}</td><td style={td}>{dmy(r.igmDate)}</td><td style={td}>{dmy(r.inwardDate)}</td><td style={td}>{r.lineNo}</td><td style={td}>{r.subLineNo}</td>
                    <td style={td}>{r.mawbNo}</td><td style={td}>{dmy(r.mawbDate)}</td><td style={{ ...td, fontWeight: r.kind === 'HAWB' ? 600 : 400 }}>{r.hawbNo}</td><td style={td}>{dmy(r.hawbDate)}</td>
                    <td style={td}>{r.totalPkg}</td><td style={td}>{r.pkgCode}</td><td style={td}>{r.grossWt}</td><td style={td}>{r.wtUnit}</td><td style={td}>{r.vessel}</td>
                    </> : <>
                    <td style={td}>{r.igmNo}</td><td style={td}>{dmy(r.igmDate)}</td><td style={td}>{r.lineNo}</td><td style={td}>{r.subLineNo}</td>
                    <td style={td}>{r.mawbNo}</td><td style={{ ...td, fontWeight: r.kind === 'HAWB' ? 600 : 400 }}>{r.hawbNo}</td>
                    <td style={td}>{r.totalPkg}</td><td style={td}>{r.grossWt}</td><td style={td}>{r.flightNo}</td><td style={td}>{dmy(r.flightDate)}</td>
                    <td style={td}>{dmy(r.inwardDate)}</td><td style={td}>{r.portOrg}</td><td style={td}>{r.status}</td>
                    </>}
                  </tr>))}</tbody>
              </table>
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>{sea ? 'Master = the BL line of the IGM, House = an HBL (sub line). IGM = ICEGATE\'s older sea IGM enquiry, SAM = the new Sea Arrival Manifest. Marks are not in this enquiry; fill them yourself.' : 'Master = the MAWB line of the IGM. House = a HAWB from the console (sub line). Package code and marks are not in this enquiry; fill them yourself.'}</div>
          </>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <button type="button" className="btn" disabled={!sel} onClick={() => onFill(sel)}
            style={{ fontSize: 12, padding: '0.35rem 0.9rem', background: sel ? GRAD : '#94a3b8', color: '#fff', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={13} /> Fill IGM details
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12, padding: '0.35rem 0.8rem' }}>Close</button>
        </div>
      </div>
    </div>, document.body);
}
