// Party Master > Fetch from DGFT (13-Nov-2026)
// Shows the DGFT "View Any IEC" captcha here; the user types it, and the IEC details with all branches come back.
// The party already loaded from the database stays as it is; the user picks which DGFT branches to add.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, X, Download } from 'lucide-react';
import { dgftSrNo, planDgft, dgftMerc, mercView, nameKey } from '../dgftMatch';

const post = async (url, body) => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  let d = {}; try { d = await r.json(); } catch (_) { d = { success: false, error: `Server answered HTTP ${r.status}` }; }
  if (r.status === 404 && !d.error) d.error = 'DGFT service not found. Restart the backend.';
  return d;
};
const up = (v) => String(v || '').trim().toUpperCase();
// DGFT matches the start of the registered name; "IMPERIAL AUTO INDUSTRIES LIMITED.." misses because of the dots, so start with the first word (13-Nov-2026)
const firstWords = (n) => { const w = up(n).replace(/^M\s*\/\s*S\.?\s+/, '').replace(/[^A-Z0-9&.\s-]/g, ' ').split(/\s+/).filter(Boolean); let out = ''; for (const x of w) { out = out ? out + ' ' + x : x; if (out.replace(/[^A-Z0-9]/g, '').length >= 3) break; } return out.replace(/[.\s-]+$/, '') || up(n); };
// DGFT branch code is the branch Sr No in EagleView; a branch with no code is Sr No 0 (13-Nov-2026)
const fullName = (n) => up(n).replace(/[.,\s]+$/, '');
const DETAIL_ORDER = ['IEC Number', 'Firm Name', 'IEC Status', 'DEL Status', 'IEC Issuance Date', 'PAN Number', 'Date of Birth / Incorporation',
  'Nature of Concern / Firm', 'Category of Exporters', 'DGFT RA Office', 'File Number', 'File Date', 'IEC Cancelled Date', 'IEC Suspended Date', 'Address'];

export default function DgftIecModal({ open, onClose, iec, name, merc, addresses, onAddBranches, onFillParty, onUseName }) {
  const [sessionId, setSessionId] = useState('');
  const [picture, setPicture] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [firm, setFirm] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [picked, setPicked] = useState({});
  const [takeName, setTakeName] = useState(true); // 14-Nov-2026: a different DGFT name is applied with Add / update and Fill unless unticked
  const capRef = useRef(null);

  // what Add would do with each DGFT branch: update the matching address here, add it, or skip it (see ../dgftMatch.js)
  const plan = useMemo(() => planDgft((result && result.branches) || [], addresses || []), [result, addresses]);
  const isKnown = (b, i) => !!(plan[i] && plan[i].action === 'skip');

  const start = async () => {
    setBusy('start'); setError(''); setPicture(''); setCaptcha('');
    const d = await post('/api/dgft/iec/start');
    setBusy('');
    if (!d.success) { setError(d.error || 'Could not open the DGFT site.'); return; }
    setSessionId(d.sessionId); setPicture(d.captcha);
    setTimeout(() => capRef.current && capRef.current.focus(), 50);
  };
  const refresh = async () => {
    if (!sessionId) return start();
    setBusy('refresh'); setError(''); setCaptcha('');
    const d = await post('/api/dgft/iec/captcha-refresh', { sessionId });
    setBusy('');
    if (!d.success) return start();
    setPicture(d.captcha);
    capRef.current && capRef.current.focus();
  };

  useEffect(() => {
    if (!open) return;
    setResult(null); setPicked({}); setTakeName(true); setError(''); setFirm(fullName(name)); start();
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchIec = async (e) => {
    e && e.preventDefault();
    if (up(firm).length < 3) { setError('Enter at least the first 3 letters of the firm name.'); return; }
    if (!captcha.trim()) { setError('Type the captcha shown in the picture.'); capRef.current && capRef.current.focus(); return; }
    setBusy('fetch'); setError('');
    const d = await post('/api/dgft/iec/fetch', { sessionId, iec: up(iec), name: firstWords(firm), captcha: captcha.trim() });
    setBusy('');
    if (!d.success) {
      setError(d.error || 'DGFT fetch failed.');
      setCaptcha('');
      if (d.captcha) setPicture(d.captcha); else if (/expired/i.test(d.error || '')) start();
      capRef.current && capRef.current.focus();
      return;
    }
    d.branches = [...(d.branches || [])].sort((a, b) => (parseInt(dgftSrNo(a), 10) || 0) - (parseInt(dgftSrNo(b), 10) || 0));
    setResult(d);
    const pl = planDgft(d.branches, addresses || []); const p = {}; pl.forEach((r, i) => { if (r.action !== 'skip') p[i] = true; }); setPicked(p);
  };

  if (!open) return null;
  const det = (result && result.details) || {};
  const status = det['IEC Status'] || '';
  const active = /^(active|valid)/i.test(status); // DGFT shows "Valid" for a working IEC
  const branches = (result && result.branches) || [];
  const pickedList = branches.filter((b, i) => picked[i]);
  // the DGFT name goes with Add / update and Fill only when it really differs (dots, M/S, PVT / LTD do not count) and the box is ticked
  const nameOpt = () => { const dn = (result && result.details && result.details['Firm Name']) || ''; return { name: takeName && dn && nameKey(dn) !== nameKey(name) ? dn : '' }; };
  const allNew = branches.map((b, i) => i).filter(i => !isKnown(branches[i], i));
  const nUpd = branches.filter((b, i) => picked[i] && plan[i] && plan[i].action === 'update').length;
  const th = { padding: '6px 8px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--primary-text, #334155)', background: 'var(--primary-bg-light, #f1f5f9)', borderBottom: '1px solid #cbd5e1', position: 'sticky', top: 0 };
  const td = { padding: '6px 8px', fontSize: 11, borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' };

  return createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-label="Fetch IEC from DGFT" style={{ background: 'var(--bg-panel, #fff)', color: 'var(--text-main, #0f172a)', width: 'min(980px, 100%)', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', borderRadius: 6, boxShadow: '0 20px 50px rgba(15,23,42,0.35)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'linear-gradient(135deg, var(--primary-color-start, #0284c7), var(--primary-color-end, #075985))', color: '#fff' }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Fetch IEC from DGFT <span style={{ fontWeight: 400, opacity: 0.85 }}>for IEC {up(iec)}</span></div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
        </div>

        <form onSubmit={fetchIec} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', padding: '12px 14px', borderBottom: '1px solid #e2e8f0' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, fontWeight: 600 }}>IEC number
            <input className="input-field" value={up(iec)} readOnly style={{ width: 130, background: '#f8fafc' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, fontWeight: 600, flex: '1 1 220px' }}>Firm name
            <input className="input-field" value={firm} onChange={e => setFirm(e.target.value.toUpperCase())} placeholder="FIRM NAME" />
            <span style={{ fontSize: 10, fontWeight: 400, color: '#64748b', textTransform: 'none' }}>DGFT is searched with: {firstWords(firm) || '-'}</span>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, fontWeight: 600 }}>Captcha
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 150, height: 44, border: '1px solid #cbd5e1', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', overflow: 'hidden' }}>
                {picture ? <img src={picture} alt="DGFT captcha" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <span style={{ fontSize: 10, color: '#64748b', fontWeight: 400 }}>{busy ? 'Loading…' : 'No picture'}</span>}
              </div>
              <button type="button" onClick={refresh} disabled={!!busy} title="New captcha" className="btn btn-secondary" style={{ height: 30, padding: '0 8px', display: 'flex', alignItems: 'center' }}>
                <RefreshCw size={14} className={busy === 'refresh' || busy === 'start' ? 'spin' : ''} />
              </button>
              <style>{'input.input-field.dgft-captcha { text-transform: none !important; }'}</style>
              <input ref={capRef} className="input-field dgft-captcha" value={captcha} onChange={e => setCaptcha(e.target.value)} maxLength={6} placeholder="Type captcha" autoComplete="off" autoCapitalize="off" spellCheck={false} style={{ width: 110, textTransform: 'none' }} />
            </div>
          </div>
          <button type="submit" disabled={!!busy || !sessionId} className="btn" style={{ height: 30, padding: '0 16px', background: 'linear-gradient(135deg, var(--primary-color-start, #0284c7), var(--primary-color-end, #075985))', color: '#fff', border: 'none', fontWeight: 600, fontSize: 12, cursor: busy ? 'wait' : 'pointer' }}>
            {busy === 'fetch' ? 'Fetching…' : 'Fetch'}
          </button>
        </form>

        {error && <div role="alert" style={{ margin: '10px 14px 0', padding: '8px 10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12, borderRadius: 4 }}>{error}</div>}

        <div style={{ overflowY: 'auto', padding: '12px 14px', flex: 1 }}>
          {!result && !error && <div style={{ fontSize: 12, color: '#64748b' }}>Type the captcha from the picture and press Fetch. The party loaded from the database is not changed until you add branches below and save.</div>}
          {result && <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{det['Firm Name'] || up(firm)}</div>
              {status && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: active ? '#dcfce7' : '#fee2e2', color: active ? '#166534' : '#b91c1c' }}>IEC {status}</span>}
            </div>
            {!active && status && <div style={{ fontSize: 11, color: '#b91c1c', marginBottom: 8 }}>This IEC is not active at DGFT. Check with the client before filing.</div>}
            {(() => {
              const dName = det['Firm Name'] || ''; const same = !dName || nameKey(dName) === nameKey(name); // same rule as nameOpt below
              const cat = det['Category of Exporters'] || ''; const m = dgftMerc(cat); const cur = mercView(merc);
              return <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {dName && (same
                  ? <div style={{ fontSize: 11, color: '#166534' }}>Party name matches DGFT.</div>
                  : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '6px 10px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 4, fontSize: 11 }}>
                      <div><div><span style={{ color: '#92400e' }}>Party name in EagleView:</span> <b>{up(name) || '-'}</b></div><div><span style={{ color: '#92400e' }}>Name at DGFT:</span> <b>{dName}</b></div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, cursor: 'pointer', color: '#92400e' }}><input type="checkbox" checked={takeName} onChange={e => setTakeName(e.target.checked)} /> Change the party name to the DGFT name when I add / update branches or fill party fields</label></div>
                      <button type="button" className="btn btn-secondary" onClick={() => onUseName(dName)} style={{ fontSize: 11, padding: '0.25rem 0.7rem', whiteSpace: 'nowrap' }}>Use DGFT name now</button>
                    </div>)}
                {cat && <div style={{ fontSize: 11, color: '#334155' }}>{m
                  ? (m === cur ? <>[R]Merc / [F]Manuf is already <b>{m}</b> (DGFT: {cat}).</> : <>[R]Merc / [F]Manuf will be set to <b>{m}</b> (now {cur}; DGFT: {cat}) when you add / update branches or fill party fields.</>)
                  : <>DGFT category "{cat}" has no Merchant / Manufacturer match; [R]Merc / [F]Manuf stays {cur}.</>}</div>}
              </div>;
            })()}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '4px 18px', fontSize: 11, marginBottom: 14 }}>
              {DETAIL_ORDER.filter(k => det[k] && k !== 'Firm Name' && k !== 'IEC Status').concat(Object.keys(det).filter(k => !DETAIL_ORDER.includes(k))).map(k => (
                <div key={k} style={{ display: 'flex', gap: 6, gridColumn: k === 'Address' ? '1 / -1' : undefined }}>
                  <span style={{ color: '#64748b', minWidth: 150 }}>{k}</span><span style={{ fontWeight: 600 }}>{det[k]}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Branches at DGFT ({branches.length}){branches.some(b => b.overflow) && <span style={{ fontWeight: 600, color: '#b91c1c', marginLeft: 8 }}>{branches.filter(b => b.overflow).length} address(es) longer than ICEGATE allows</span>}</div>
              {branches.length > 0 && <div style={{ fontSize: 11, display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => { const p = {}; allNew.forEach(i => { p[i] = true; }); setPicked(p); }} style={{ background: 'none', border: 'none', color: 'var(--primary-color-end, #2563eb)', cursor: 'pointer', padding: 0 }}>Select all</button>
                <button type="button" onClick={() => setPicked({})} style={{ background: 'none', border: 'none', color: 'var(--primary-color-end, #2563eb)', cursor: 'pointer', padding: 0 }}>Clear</button>
              </div>}
            </div>
            {branches.length === 0 ? <div style={{ fontSize: 11, color: '#64748b' }}>DGFT shows no branches for this IEC.</div> :
              <div style={{ border: '1px solid #cbd5e1', borderRadius: 4, maxHeight: 280, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={{ ...th, width: 28 }}></th><th style={th}>Sr No</th><th style={th}>DGFT address</th><th style={th}>City</th><th style={th}>State</th><th style={th}>PIN</th><th style={th}>GSTIN</th></tr></thead>
                  <tbody>{branches.map((b, i) => {
                    const dup = isKnown(b, i); const pr = plan[i] || {};
                    return <tr key={i} style={{ background: dup ? '#f8fafc' : picked[i] ? 'var(--primary-bg-light, #eff6ff)' : undefined, color: dup ? '#94a3b8' : undefined }}>
                      <td style={td}><input type="checkbox" disabled={dup} checked={!!picked[i]} onChange={e => setPicked(p => ({ ...p, [i]: e.target.checked }))} aria-label={`Select branch ${b.branchCode}`} /></td>
                      <td style={td}>{dgftSrNo(b)}</td>
                      <td style={td}>{b.overflow && <div style={{ fontSize: 10, fontWeight: 700, color: '#b91c1c' }}>Longer than ICEGATE allows (35 + 35). Shorten after adding; left out: {b.overflow}</div>}{b.registered && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary-text, #334155)' }}>Registered office (IEC address)</div>}{b.address}{pr.note && <div style={{ fontSize: 10, fontWeight: pr.action === 'update' ? 600 : 400, color: pr.action === 'update' ? 'var(--primary-color-end, #2563eb)' : '#64748b' }}>{pr.note}</div>}</td>
                      <td style={td}>{b.city}</td><td style={td}>{b.state}</td><td style={td}>{b.pinCode}</td>
                      <td style={{ ...td, fontFamily: 'Consolas, monospace' }}>{b.gstin || b.gstinMasked}{!b.gstin && b.gstinMasked && <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'inherit' }}>Hidden by DGFT</div>}</td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>}

            {(result.people || []).length > 0 && <>
              <div style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>Proprietor / partners / directors</div>
              <div style={{ fontSize: 11, display: 'flex', flexWrap: 'wrap', gap: '4px 18px' }}>
                {result.people.map((p, i) => <span key={i}>{p.Name || Object.values(p).filter(Boolean).slice(1, 2).join(' ')}{p.Designation ? ` (${p.Designation})` : ''}</span>)}
              </div>
            </>}
          </>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ fontSize: 10, color: '#64748b' }}>Where DGFT hides the GSTIN, type it in the branch after adding, then save the party.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {result && <button type="button" className="btn btn-secondary" onClick={() => onFillParty(result, nameOpt())} style={{ fontSize: 12, padding: '0.35rem 0.8rem' }}>Fill empty party fields</button>}
            {result && <button type="button" className="btn" disabled={!pickedList.length} onClick={() => onAddBranches(pickedList, result, nameOpt())}
              style={{ fontSize: 12, padding: '0.35rem 0.9rem', background: pickedList.length ? 'linear-gradient(135deg, var(--primary-color-start, #0284c7), var(--primary-color-end, #075985))' : '#94a3b8', color: '#fff', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={13} /> {nUpd ? `Add / update ${pickedList.length}` : `Add ${pickedList.length || ''}`} selected branch{pickedList.length === 1 ? '' : 'es'}
            </button>}
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12, padding: '0.35rem 0.8rem' }}>Close</button>
          </div>
        </div>
      </div>
    </div>, document.body);
}
