import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, FileText, CheckCircle, MapPin, Anchor, Ship, Plane, AlertTriangle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// 30-Oct-2026: the three freight dashboards (Air Import, Sea Import, Sea Export) each listed invented
// shipments - "CMAU999888777 on CMA CGM MARCO POLO V.42", "176-99887766 on EK 512" - with hardcoded
// KPI numbers, and every action button on them was dead. All three were also near-identical copies,
// so they share this one component now: the rows are the real import / export jobs and the buttons
// record real operational events.
//
// Said plainly on screen, because it matters: recording an IGM, VGM or manifest / AMS here is a record
// of what your office did. It does NOT transmit anything to SCMTR / ICEGATE, the shipping line's VGM
// portal, or US customs - each of those needs that system's own credentials and channel.
const STATUS_COLOURS = [
    [/OOC|DELIVERED|CLEARED|SAILED|SHIPPED/, '#dcfce7', '#166534'],
    [/QUERY|HOLD|RMS/, '#fee2e2', '#991b1b'],
    [/FILED|SUBMITTED|SENT|ASSESS|DUTY/, '#fef9c3', '#854d0e'],
];
const colourFor = (st) => {
    for (const [re, bg, fg] of STATUS_COLOURS) if (re.test(String(st || '').toUpperCase())) return [bg, fg];
    return ['#e0f2fe', '#0369a1'];
};

export default function FreightDashboard({ kind, title, subtitle, accent, icon, actions, newJobPath, kpiCards }) {
    const navigate = useNavigate();
    const [rows, setRows] = useState([]);
    const [kpis, setKpis] = useState({});
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [eventFor, setEventFor] = useState(null);     // { row, type }
    const [evForm, setEvForm] = useState({ refNo: '', detail: '', eventDate: new Date().toISOString().slice(0, 10) });
    const [saving, setSaving] = useState(false);

    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const r = await fetch('/api/freight/dashboard?kind=' + kind, { headers: auth() });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            setRows(j.data || []);
            setKpis(j.kpis || {});
            setMeta(j);
        } catch (err) {
            setRows([]); setKpis({}); setMeta(null); setError(err.message);
        }
        setLoading(false);
    }, [kind]);
    useEffect(() => { load(); }, [load]);

    const shown = rows.filter(r => !search || [r.docNo, r.houseNo, r.jobNo, r.party, r.carrier, r.origin, r.destination, r.igmNo]
        .some(v => String(v || '').toLowerCase().includes(search.toLowerCase())));

    const openEvent = (row, type) => {
        if (!row) {
            // the toolbar buttons act on a shipment, so one has to be chosen first
            toast.error('Pick a shipment row first - these actions are recorded against one job');
            return;
        }
        setEventFor({ row, type });
        setEvForm({ refNo: '', detail: '', eventDate: new Date().toISOString().slice(0, 10) });
    };

    const saveEvent = async (allowRepeat) => {
        if (!eventFor) return;
        setSaving(true);
        try {
            const r = await fetch('/api/freight/events', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({
                    jobNo: eventFor.row.jobNo, jobKind: eventFor.row.jobKind, eventType: eventFor.type,
                    eventDate: evForm.eventDate, refNo: evForm.refNo, detail: evForm.detail, allowRepeat: !!allowRepeat,
                }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) {
                if (/already recorded/.test(j.error || '') && window.confirm(j.error)) { setSaving(false); return saveEvent(true); }
                throw new Error(j.error || ('HTTP ' + r.status));
            }
            toast.success(j.note || 'Recorded', { duration: j.transmitted === false && !j.data.isInternal ? 8000 : 4000 });
            setEventFor(null);
            await load();
        } catch (err) { toast.error('Not recorded: ' + err.message); }
        setSaving(false);
    };

    const typeMeta = (t) => ((meta && meta.eventTypes) || []).find(x => x.type === t) || { label: t, internal: true };
    const externalNote = (t) => (meta && meta.externalNotes && meta.externalNotes[t]) || '';

    const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
    const thStyle = { padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', borderBottom: '2px solid #e2e8f0', background: '#f8fafc' };
    const tdStyle = { padding: '12px', fontSize: '13px', color: '#1e293b', borderBottom: '1px solid #f1f5f9' };
    const Icon = icon === 'plane' ? Plane : icon === 'ship' ? Ship : Anchor;
    const [selected, setSelected] = useState(null);
    const selectedRow = rows.find(r => r.jobNo === selected) || null;

    return (
        <div style={{ padding: '24px', maxWidth: '1500px', margin: '0 auto', fontFamily: 'Segoe UI' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: accent, padding: '12px', borderRadius: '8px', color: '#fff' }}><Icon size={24} /></div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: 'bold' }}>{title}</h2>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{subtitle}</div>
                    </div>
                </div>
                <button onClick={() => navigate(newJobPath)} style={{ padding: '8px 16px', background: accent, color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <Plus size={16}/> {kind.endsWith('import') ? 'New Import Job' : 'New Export Job'}
                </button>
            </div>

            {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>
            )}

            {/* KPI cards - every number here is counted from the rows below */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + kpiCards.length + ', 1fr)', gap: '20px', marginBottom: '24px' }}>
                {kpiCards.map(c => (
                    <div key={c.key} style={{...cardStyle, borderLeft: '4px solid ' + c.colour}}>
                        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>{c.label}</div>
                        <div style={{ fontSize: '28px', fontWeight: '900', color: c.strong || '#0f172a' }}>
                            {kpis[c.key] == null ? '—' : kpis[c.key]}
                        </div>
                        {c.hint && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{c.hint}</div>}
                    </div>
                ))}
            </div>

            {/* Action bar - each one records an event against the selected shipment */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {actions.map(a => {
                    const tm = typeMeta(a.type);
                    return (
                        <button key={a.type} onClick={() => openEvent(selectedRow, a.type)}
                            title={tm.internal ? tm.label : externalNote(a.type)}
                            style={{ padding: '10px 20px', background: '#fff', border: '1px solid ' + (tm.internal ? '#cbd5e1' : '#fcd34d'), borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                            {a.type === 'DO' ? <CheckCircle size={16}/> : a.type === 'DESTUFF' ? <MapPin size={16}/> : <FileText size={16}/>}
                            {a.label}
                            {!tm.internal && <AlertTriangle size={14} color="#d97706" />}
                        </button>
                    );
                })}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>
                {selectedRow ? <>Acting on <b>{selectedRow.jobNo}</b>{selectedRow.docNo ? ' (' + selectedRow.docNo + ')' : ''}. </> : <>Click a shipment row below to pick it, then use these. </>}
                <span style={{ color: '#b45309' }}>
                    <AlertTriangle size={12} style={{ verticalAlign: '-2px' }} /> marked actions are recorded here only - this software does not transmit them to the portal.
                </span>
            </div>

            {eventFor && (
                <div style={{ background: typeMeta(eventFor.type).internal ? '#f0f9ff' : '#fffbeb',
                    border: '1px solid ' + (typeMeta(eventFor.type).internal ? '#bae6fd' : '#fcd34d'),
                    borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                            {typeMeta(eventFor.type).label} &mdash; {eventFor.row.jobNo}
                        </div>
                        <button onClick={() => setEventFor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={16}/></button>
                    </div>
                    {!typeMeta(eventFor.type).internal && (
                        <div style={{ fontSize: '12px', color: '#92400e', margin: '8px 0 12px', fontWeight: 600 }}>
                            {externalNote(eventFor.type)}
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '12px', marginTop: '12px' }}>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Date</label>
                            <input type="date" value={evForm.eventDate} onChange={e => setEvForm({ ...evForm, eventDate: e.target.value })}
                                style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                                Reference / document no{['DO', 'MBL', 'HBL', 'IGM', 'VGM'].includes(eventFor.type) ? ' (required)' : ''}
                            </label>
                            <input type="text" value={evForm.refNo} onChange={e => setEvForm({ ...evForm, refNo: e.target.value })}
                                placeholder={eventFor.type === 'DO' ? 'DO/26/0001' : eventFor.type === 'VGM' ? 'VGM reference' : eventFor.type === 'IGM' ? 'IGM number' : ''}
                                style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Detail</label>
                            <input type="text" value={evForm.detail} onChange={e => setEvForm({ ...evForm, detail: e.target.value })}
                                placeholder={eventFor.type === 'DESTUFF' ? 'CFS name, date of de-stuffing...' : eventFor.type === 'VGM' ? 'Declared weight, method...' : 'Anything worth keeping'}
                                style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }} />
                        </div>
                    </div>
                    <button onClick={() => saveEvent(false)} disabled={saving}
                        style={{ marginTop: '12px', padding: '8px 18px', background: saving ? '#94a3b8' : accent, color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 700, fontSize: '13px', cursor: saving ? 'wait' : 'pointer' }}>
                        {saving ? 'Recording...' : 'Record it'}
                    </button>
                </div>
            )}

            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>
                        {kind.endsWith('import') ? 'Incoming shipments' : 'Outgoing shipments'}
                        <span style={{ fontWeight: 400, fontSize: '12px', color: '#64748b' }}> &nbsp;{loading ? 'loading...' : shown.length + ' of ' + rows.length}</span>
                    </h3>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '8px', color: '#94a3b8' }}/>
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search job / MBL / MAWB / party / vessel"
                            style={{ padding: '6px 10px 6px 30px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none', minWidth: '280px' }} />
                    </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Job / {kind.startsWith('air') ? 'MAWB' : 'Master B/L'}</th>
                            <th style={thStyle}>Party</th>
                            <th style={thStyle}>{kind.startsWith('air') ? 'Flight' : 'Vessel / Voyage'}</th>
                            <th style={thStyle}>Routing</th>
                            <th style={thStyle}>{kind.endsWith('import') ? 'ETA' : 'ETD'}</th>
                            <th style={thStyle}>Recorded</th>
                            <th style={{...thStyle, textAlign: 'center'}}>Status</th>
                            <th style={{...thStyle, textAlign: 'center'}}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>Loading shipments...</td></tr>}
                        {!loading && !shown.length && (
                            <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                {search ? 'No shipment matches that search.' : (meta && meta.note) || 'No shipment yet.'}
                            </td></tr>
                        )}
                        {shown.map(s => {
                            const [bg, fg] = colourFor(s.status);
                            const isSel = selected === s.jobNo;
                            return (
                                <tr key={s.jobNo || s.id} onClick={() => setSelected(isSel ? null : s.jobNo)}
                                    style={{ cursor: 'pointer', background: isSel ? '#eff6ff' : '#fff' }}>
                                    <td style={{...tdStyle, fontWeight: 'bold', color: '#0284c7'}}>
                                        {s.jobNo}
                                        <div style={{ fontSize: '11px', color: '#475569', fontWeight: 400 }}>
                                            {s.docNo || <span style={{ color: '#b45309' }}>no master document no on the job</span>}
                                            {s.houseNo ? ' / ' + s.houseNo : ''}
                                        </div>
                                        {s.igmNo && <div style={{ fontSize: '10px', color: '#94a3b8' }}>IGM {s.igmNo}</div>}
                                    </td>
                                    <td style={tdStyle}>{s.party || '—'}</td>
                                    <td style={tdStyle}>
                                        {s.carrier || '—'}
                                        {s.modeUnknown && <div style={{ fontSize: '10px', color: '#b45309' }}>shipment mode not set on this job</div>}
                                    </td>
                                    <td style={tdStyle}>{[s.origin, s.destination].filter(Boolean).join(' → ') || '—'}</td>
                                    <td style={tdStyle}>{(kind.endsWith('import') ? s.eta : s.etd) || '—'}</td>
                                    <td style={tdStyle}>
                                        {s.events && s.events.length ? (
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                {s.events.slice(0, 5).map(e => (
                                                    <span key={e.id} title={(e.refNo || '') + ' ' + (e.detail || '') + (e.isInternal ? '' : ' (recorded only, not transmitted)')}
                                                        style={{ fontSize: '10px', padding: '2px 5px', borderRadius: '4px', fontWeight: 700,
                                                            background: e.isInternal ? '#e0f2fe' : '#fef3c7', color: e.isInternal ? '#0369a1' : '#92400e' }}>
                                                        {e.eventType}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : <span style={{ color: '#cbd5e1', fontSize: '11px' }}>nothing yet</span>}
                                    </td>
                                    <td style={{...tdStyle, textAlign: 'center'}}>
                                        <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: bg, color: fg }}>
                                            {s.status}
                                        </span>
                                        {s.beNo && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>BE {s.beNo}</div>}
                                        {s.sbNo && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>SB {s.sbNo}</div>}
                                    </td>
                                    <td style={{...tdStyle, textAlign: 'center'}}>
                                        <button onClick={(e) => { e.stopPropagation(); navigate(newJobPath + '?jobNo=' + encodeURIComponent(s.jobNo)); }}
                                            style={{ background: 'none', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                                            Open job
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {meta && meta.note && (
                    <div style={{ padding: '10px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '11px', color: '#64748b' }}>
                        {meta.note}
                    </div>
                )}
            </div>

        </div>
    );
}
