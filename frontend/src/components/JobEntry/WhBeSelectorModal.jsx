import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Warehouse, Search, Link, AlertCircle, Plane, Ship, Truck, Inbox, RefreshCw, PenLine, CheckCircle } from 'lucide-react';

/**
 * WhBeSelectorModal - choose the warehouse (into-bond, BE type W) BE that an Ex-Bond BE clears.
 *
 * Props:
 *   importerName / iecCode / customsPort - this job's importer and port (matching WH BEs are listed first)
 *   excludeJobId     - this job's own id (so its own quantities are not counted as cleared)
 *   onSelect(whJob)  - called with the chosen WH BE row
 *   onManual()       - "Enter WH BE manually" (WH BE filed outside this software)
 *   onClose()
 *
 * 28-Oct-2026: redesigned - grid rows with the WH BE No / Date, IGM, status and mode; chips for "This importer" /
 * "All" and "Filed only"; keyboard (Up / Down, Enter = link, Esc = close); double-click a row to link.
 */
const C = {
  accent: '#7c3aed', accentDark: '#6d28d9', accentSoft: '#f5f3ff', accentLine: '#ddd6fe',
  text: 'var(--text-main, #0f172a)', muted: 'var(--text-muted, #64748b)', line: 'var(--border-color, #e2e8f0)',
  panel: 'var(--bg-panel, #ffffff)', soft: 'var(--bg-input, #f8fafc)', amber: '#b45309', amberSoft: '#fef3c7', green: '#166534', greenSoft: '#dcfce7',
};
const COLS = '34px minmax(120px,1.1fr) minmax(170px,2fr) minmax(100px,0.9fr) minmax(120px,1.1fr) minmax(110px,1fr) minmax(110px,0.9fr)';

const fmtDate = (d) => {
  if (!d) return '';
  const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(String(d));
  const dt = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
  return isNaN(dt) ? String(d) : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const ModeIcon = ({ mode }) => (mode === 'AIR' ? <Plane size={13} /> : mode === 'SEA' ? <Ship size={13} /> : <Truck size={13} />);

function Chip({ active, onClick, children, title }) {
  return (
    <button type="button" onClick={onClick} title={title}
      style={{ padding: '5px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
        border: `1px solid ${active ? C.accent : C.line}`, background: active ? C.accentSoft : C.panel, color: active ? C.accentDark : C.muted }}>
      {children}
    </button>
  );
}

export default function WhBeSelectorModal({ importerId, importerName, iecCode, customsPort, excludeJobId, onSelect, onClose, onManual }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [scope, setScope] = useState('mine');       // 'mine' = this importer, 'all'
  const [filedOnly, setFiledOnly] = useState(false);
  const listRef = useRef(null);

  useEffect(() => { fetchWhJobs(); }, []); // eslint-disable-line

  async function fetchWhJobs() {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (importerId) params.append('importerId', importerId);
      if (importerName) params.append('importerName', importerName);
      if (iecCode) params.append('iecCode', iecCode);
      if (customsPort) params.append('customsPort', customsPort);
      if (excludeJobId) params.append('excludeJobId', excludeJobId);
      const res = await fetch(`/api/warehouse-be/list?${params}`);
      const data = await res.json();
      if (data.success) setJobs(data.data || []);
      else setError(data.error || 'Could not load the warehouse BEs');
    } catch (e) {
      setError('Network error: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  const mine = jobs.filter(j => j.matchImporter);
  const useMine = scope === 'mine' && mine.length > 0;
  const s = search.trim().toLowerCase();
  const filtered = (useMine ? mine : jobs)
    .filter(j => !filedOnly || j.beNo)
    .filter(j => !s || [j.jobNo, j.beNo, j.iecCode, j.warehouseCode, j.importerName, j.igmNo, j.mawbNo, j.hawbNo, j.invoiceNo]
      .some(v => String(v || '').toLowerCase().includes(s)))
    .slice().sort((a, b) => (b.matchImporter - a.matchImporter) || (b.matchPort - a.matchPort) || (!!b.beNo - !!a.beNo));

  // keep the selection inside the visible list
  useEffect(() => { if (selected && !filtered.some(j => j.id === selected.id)) setSelected(null); }, [search, scope, filedOnly, jobs.length]); // eslint-disable-line

  function link(job) {
    const j = job || selected;
    if (!j) return;
    onSelect(j);
    onClose();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'Enter' && selected) { e.preventDefault(); link(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!filtered.length) return;
      const i = filtered.findIndex(j => j.id === selected?.id);
      const n = e.key === 'ArrowDown' ? Math.min(filtered.length - 1, i + 1) : Math.max(0, i < 0 ? 0 : i - 1);
      setSelected(filtered[n]);
      const row = listRef.current && listRef.current.querySelector(`[data-row="${filtered[n].id}"]`);
      if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
    }
  }

  const th = { fontSize: '10px', fontWeight: 700, color: C.muted, letterSpacing: '0.04em', padding: '8px 10px', whiteSpace: 'nowrap' };
  const cell = { padding: '10px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px' };
  const sub = { fontSize: '10px', color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  const one = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  // 13-Nov-2026: drawn on <body> above the app header - inside the job screen the top menu bar covered the window's
  // title and search box on a 900-px-high screen
  return createPortal(
    <div onKeyDown={onKeyDown} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div role="dialog" aria-label="Select Warehouse BE"
        style={{ background: C.panel, borderRadius: '14px', width: '1000px', maxWidth: '100%', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(15,23,42,0.35)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px 20px 12px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: C.accentSoft, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Warehouse size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: C.text }}>Select Warehouse BE</div>
            <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>
              Link the into-bond (W) BE this Ex-Bond clears. WH BE No, warehouse code and the balance quantity fill in automatically.
            </div>
          </div>
          <button type="button" onClick={onClose} title="Close (Esc)" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '4px', borderRadius: '6px' }}><X size={18} /></button>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', padding: '0 20px 12px' }}>
          <div style={{ position: 'relative', flex: '1 1 320px', minWidth: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} autoFocus
              placeholder="Search job no, WH BE no, warehouse code, importer, IEC, IGM / AWB, invoice..."
              style={{ width: '100%', padding: '9px 30px 9px 32px', border: `1px solid ${C.line}`, borderRadius: '8px', fontSize: '12px', outline: 'none', boxSizing: 'border-box', background: C.soft, color: C.text }} />
            {search && <button type="button" onClick={() => setSearch('')} title="Clear" style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}><X size={14} /></button>}
          </div>
          {mine.length > 0 && mine.length < jobs.length && (
            <>
              <Chip active={useMine} onClick={() => setScope('mine')} title={importerName || iecCode}>This importer · {mine.length}</Chip>
              <Chip active={!useMine} onClick={() => setScope('all')}>All · {jobs.length}</Chip>
            </>
          )}
          <Chip active={filedOnly} onClick={() => setFiledOnly(v => !v)} title="Only WH BEs that already have a BE No">Filed only</Chip>
          <button type="button" onClick={fetchWhJobs} title="Reload" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: C.muted, display: 'flex' }}><RefreshCw size={14} /></button>
        </div>
        {jobs.length > 0 && mine.length === 0 && (importerName || iecCode) && (
          <div style={{ margin: '0 20px 10px', fontSize: '11px', color: C.amber, background: C.amberSoft, padding: '6px 10px', borderRadius: '6px' }}>
            No warehouse BE of this importer was found - showing every warehouse BE.
          </div>
        )}

        {/* List */}
        <div style={{ borderTop: `1px solid ${C.line}`, flex: 1, minHeight: '180px', overflow: 'auto' }} ref={listRef}>
          <div style={{ minWidth: '860px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: COLS, position: 'sticky', top: 0, zIndex: 1, background: C.soft, borderBottom: `1px solid ${C.line}` }}>
              <div />
              <div style={th}>JOB</div><div style={th}>IMPORTER</div><div style={th}>WAREHOUSE</div>
              <div style={th}>WH BE NO / DATE</div><div style={th}>IGM / AWB</div><div style={th}>STATUS</div>
            </div>

            {loading && [0, 1, 2].map(i => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: COLS, borderBottom: `1px solid ${C.line}` }}>
                {Array.from({ length: 7 }).map((_, k) => <div key={k} style={{ padding: '14px 10px' }}>{k > 0 && <div style={{ height: '10px', borderRadius: '4px', background: '#eef2f7', width: `${50 + ((i + k) % 3) * 15}%` }} />}</div>)}
              </div>
            ))}

            {!loading && error && (
              <div style={{ margin: '20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#991b1b', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <AlertCircle size={16} /> {error}
                <button type="button" onClick={fetchWhJobs} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#991b1b', fontSize: '11px' }}>Retry</button>
              </div>
            )}

            {!loading && !error && jobs.length === 0 && (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: C.muted }}>
                <Inbox size={34} style={{ color: '#cbd5e1' }} />
                <div style={{ fontWeight: 700, color: C.text, marginTop: '8px', fontSize: '13px' }}>No warehouse BE saved yet</div>
                <div style={{ fontSize: '11px', marginTop: '4px' }}>Save the warehouse job first (BE Type = W), or enter the WH BE No / Date yourself if it was filed elsewhere.</div>
              </div>
            )}

            {!loading && !error && jobs.length > 0 && filtered.length === 0 && (
              <div style={{ padding: '30px 20px', textAlign: 'center', color: C.muted, fontSize: '12px' }}>
                Nothing matches{search ? <> "<b>{search}</b>"</> : ''}{filedOnly ? ' among filed WH BEs' : ''}.{' '}
                <button type="button" onClick={() => { setSearch(''); setFiledOnly(false); setScope('all'); }} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>Show all</button>
              </div>
            )}

            {!loading && filtered.map(job => {
              const on = selected?.id === job.id;
              return (
                <div key={job.id} data-row={job.id} onClick={() => setSelected(job)} onDoubleClick={() => link(job)} title="Click to select, double-click to link"
                  style={{ display: 'grid', gridTemplateColumns: COLS, cursor: 'pointer', borderBottom: `1px solid ${C.line}`, fontSize: '12px', color: C.text,
                    background: on ? C.accentSoft : C.panel, boxShadow: on ? `inset 3px 0 0 ${C.accent}` : 'none' }}
                  onMouseEnter={e => { if (!on) e.currentTarget.style.background = C.soft; }}
                  onMouseLeave={e => { if (!on) e.currentTarget.style.background = C.panel; }}>
                  <div style={{ ...cell, alignItems: 'center' }}>
                    <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${on ? C.accent : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {on && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.accent }} />}
                    </span>
                  </div>
                  <div style={cell}>
                    <span style={{ ...one, fontWeight: 700, color: on ? C.accentDark : C.text }}>{job.jobNo}</span>
                    <span style={sub}>{fmtDate(job.jobDate)}{job.invoiceNo ? ` · Inv ${job.invoiceNo}` : ''}</span>
                  </div>
                  <div style={cell} title={job.importerName}>
                    <span style={one}>{job.importerName || '—'}</span>
                    <span style={sub}>{job.iecCode ? `IEC ${job.iecCode}` : ''}{job.matchImporter ? ' · same importer' : ''}</span>
                  </div>
                  <div style={cell}>
                    <span style={{ alignSelf: 'flex-start', background: C.accentSoft, color: C.accentDark, padding: '2px 8px', borderRadius: '5px', fontWeight: 700, fontFamily: 'monospace', fontSize: '11px', ...one, maxWidth: '100%' }}>{job.warehouseCode || '—'}</span>
                    <span style={sub}>{job.customsPort || ''}{job.matchPort ? ' · same port' : ''}</span>
                  </div>
                  <div style={cell}>
                    {job.beNo
                      ? <><span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{job.beNo}</span><span style={sub}>{fmtDate(job.beDate)}</span></>
                      : <span style={{ alignSelf: 'flex-start', background: C.amberSoft, color: C.amber, padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700 }}>Not filed</span>}
                  </div>
                  <div style={cell}>
                    <span style={{ ...one, fontFamily: 'monospace' }}>{job.igmNo || job.mawbNo || job.hawbNo || '—'}</span>
                    <span style={sub}>{job.igmNo ? 'IGM' : job.mawbNo ? 'MAWB' : job.hawbNo ? 'HAWB' : ''}</span>
                  </div>
                  <div style={cell}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700,
                        background: job.beNo ? C.greenSoft : '#f1f5f9', color: job.beNo ? C.green : C.muted }}>{job.status || 'DRAFT'}</span>
                      <span style={{ color: C.muted, display: 'flex' }} title={job.shipmentMode}><ModeIcon mode={job.shipmentMode} /></span>
                    </span>
                    {job.exBondCount > 0 && <span style={sub}>{job.exBondCount} ex-bond{job.exBondCount > 1 ? 's' : ''} so far</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.line}`, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', background: C.soft }}>
          <div style={{ flex: '1 1 260px', minWidth: 0, fontSize: '11px', color: C.muted }}>
            {selected ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: C.accentDark, fontWeight: 600, ...one }}>
                  <CheckCircle size={13} /> {selected.jobNo} · {selected.beNo ? `WH BE ${selected.beNo}` : 'WH BE not filed'} · {selected.warehouseCode || 'no WH code'}
                </div>
                {!selected.beNo && <div style={{ color: C.amber, marginTop: '2px' }}>Not filed yet: enter the WH BE No / Date in the Job Header after linking.</div>}
              </>
            ) : (
              <span>{loading ? 'Loading...' : `${filtered.length} of ${jobs.length} warehouse BE${jobs.length !== 1 ? 's' : ''}`} · ↑ ↓ to move, Enter to link</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {onManual && (
              <button type="button" onClick={() => { onManual(); onClose(); }}
                style={{ padding: '8px 14px', background: C.panel, border: `1px solid ${C.line}`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: C.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PenLine size={13} /> Enter WH BE manually
              </button>
            )}
            <button type="button" onClick={onClose}
              style={{ padding: '8px 16px', background: C.panel, border: `1px solid ${C.line}`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: C.muted }}>
              Cancel
            </button>
            <button type="button" onClick={() => link()} disabled={!selected}
              style={{ padding: '8px 18px', background: selected ? C.accent : '#e2e8f0', color: selected ? '#fff' : '#94a3b8', border: 'none', borderRadius: '8px',
                cursor: selected ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Link size={13} /> Link to Ex-Bond
            </button>
          </div>
        </div>
      </div>
    </div>
  , document.body);
}
