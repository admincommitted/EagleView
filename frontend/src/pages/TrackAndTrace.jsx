import React, { useState } from 'react';
import { Search, MapPin, Navigation, Anchor, Plane, CheckCircle, Clock, Package, FileText, Download } from 'lucide-react';

export default function TrackAndTrace() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searched, setSearched] = useState(false);

    // 30-Oct-2026: whatever number was typed, this screen showed ONE fixed shipment written into the file -
    // AWB 176-99887766 for "TechCorp Exports" to Frankfurt, with an invented timeline. A customer told that his
    // cargo had departed would have been told it about someone else's. It looks the AWB up for real now.
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [trackingData, setTrackingData] = useState(null);
    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };

    const handleSearch = async (e) => {
        e.preventDefault();
        const q = String(searchQuery || '').trim();
        if (!q) return;
        setSearched(true); setLoading(true); setError(''); setTrackingData(null);
        try {
            const ar = await fetch('/api/awb/search/' + encodeURIComponent(q), { headers: auth() });
            if (ar.status === 404) { setError('No AWB / House AWB with that number'); setLoading(false); return; }
            const awb = await ar.json();
            if (!ar.ok) throw new Error(awb.error || ('HTTP ' + ar.status));
            const no = awb.awbNumber || q;
            let events = [], tr = null, airlineUrl = '';
            try {
                const er = await fetch('/api/awb/tracking/events?awbNumber=' + encodeURIComponent(no), { headers: auth() });
                const ed = await er.json();
                if (er.ok && ed.success) { events = ed.events || []; tr = ed.tracking || null; airlineUrl = ed.airlineTrackingUrl || ''; }
            } catch (err) { /* the AWB still shows without its milestones */ }
            // 30-Oct-2026: the document pouch was hardcoded to [] here, so the list never appeared and
            // its download button could never be reached. These are the AWB's real attachments.
            let docs = [];
            try {
                const q = new URLSearchParams({ awbId: String(awb.id || ''), awbType: awb.type || 'MAWB' });
                const dr = await fetch('/api/awb/docs/none?' + q.toString(), { headers: auth() });
                const dj = await dr.json().catch(() => []);
                docs = (Array.isArray(dj) ? dj : []).map(d => ({
                    name: d.originalName || d.fileName || 'document',
                    size: d.size ? Math.round(d.size / 1024) + ' KB' : '',
                    type: (d.mimeType || '').split('/').pop().toUpperCase() || 'FILE',
                    path: d.filePath || '',
                }));
            } catch (err) { /* no pouch is not an error */ }
            setTrackingData({
                awb: no,
                client: awb.shipperName || awb.consigneeName || '',
                origin: awb.origin || (tr && tr.origin) || '',
                dest: awb.destination || (tr && tr.destination) || '',
                status: (tr && tr.status) || awb.status || 'No milestone yet',
                flight: awb.flightNumber || awb.flightNo || '',
                pieces: awb.pieces || awb.noOfPieces || '',
                weight: awb.grossWeight ? awb.grossWeight + ' kg' : '',
                airlineUrl,
                timeline: events.map(ev => ({
                    date: ev.eventAt ? new Date(ev.eventAt).toLocaleString('en-GB') : '',
                    event: ev.name || ev.code,
                    location: [ev.station, ev.flight].filter(Boolean).join(' · '),
                    status: 'done',
                })),
                documents: docs,
            });
        } catch (err) {
            setError('Could not look that up: ' + err.message);
        }
        setLoading(false);
    };

    const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };

    return (
        <div style={{ padding: '40px 24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Segoe UI' }}>
            
            {/* Header / Brand */}
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', background: '#eff6ff', padding: '12px 24px', borderRadius: '30px', color: '#1e3a8a', fontWeight: 'bold', fontSize: '24px', marginBottom: '16px' }}>
                    <Navigation size={28} /> Logistics Track & Trace Portal
                </div>
                <p style={{ color: '#64748b', fontSize: '15px' }}>Enter your AWB, BL, or Job Reference Number to get real-time tracking.</p>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', maxWidth: '600px', margin: '0 auto 40px auto' }}>
                <input 
                    type="text" 
                    placeholder="Enter Tracking Number (e.g. 176-99887766)" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ flex: 1, padding: '16px 20px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '16px', outline: 'none' }}
                />
                <button type="submit" style={{ padding: '0 32px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Search size={20}/> Track
                </button>
            </form>

            {searched && loading && (
                <div style={{ ...cardStyle, textAlign: 'center', color: '#64748b' }}>Looking it up...</div>
            )}
            {searched && !loading && error && (
                <div style={{ ...cardStyle, textAlign: 'center', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca' }}>{error}</div>
            )}
            {searched && !loading && trackingData && (
                <div style={cardStyle}>
                    {/* Status Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px', marginBottom: '24px' }}>
                        <div>
                            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>AWB / Tracking Number</div>
                            <h2 style={{ margin: 0, fontSize: '28px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {trackingData.awb}
                                <span style={{ background: '#fef08a', color: '#854d0e', padding: '4px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' }}>{trackingData.status}</span>
                            </h2>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>Flight / Vessel</div>
                            <div style={{ fontSize: '18px', color: '#0f172a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                <Plane size={18} color="#2563eb"/> {trackingData.flight}
                            </div>
                        </div>
                    </div>

                    {/* Route & Cargo Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '40px', marginBottom: '40px' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#f8fafc', padding: '20px', borderRadius: '8px' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>ORIGIN</div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>{trackingData.origin}</div>
                                </div>
                                <div style={{ color: '#cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                    <Plane size={24} color="#94a3b8"/>
                                    <div style={{ width: '100%', height: '2px', background: '#e2e8f0', marginTop: '8px' }}></div>
                                </div>
                                <div style={{ flex: 1, textAlign: 'right' }}>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>DESTINATION</div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>{trackingData.dest}</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Package size={20} color="#64748b"/>
                                <div><div style={{ fontSize: '11px', color: '#64748b' }}>TOTAL PIECES</div><div style={{ fontWeight: 'bold' }}>{trackingData.pieces} Cartons</div></div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Anchor size={20} color="#64748b"/>
                                <div><div style={{ fontSize: '11px', color: '#64748b' }}>GROSS WEIGHT</div><div style={{ fontWeight: 'bold' }}>{trackingData.weight}</div></div>
                            </div>
                        </div>
                    </div>

                    {/* Timeline & Documents */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '40px' }}>
                        
                        {/* Timeline */}
                        <div>
                            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#0f172a' }}>Tracking History</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
                                {/* Vertical line */}
                                <div style={{ position: 'absolute', left: '11px', top: '10px', bottom: '10px', width: '2px', background: '#e2e8f0', zIndex: 0 }}></div>
                                
                                {!trackingData.timeline.length && (
                                    <div style={{ fontSize: '13px', color: '#64748b', paddingLeft: '32px' }}>
                                        No milestone recorded for this AWB yet{trackingData.airlineUrl ? <> - <a href={trackingData.airlineUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>check on the airline's site</a></> : null}
                                    </div>
                                )}
                                {trackingData.timeline.map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '16px', zIndex: 1, opacity: item.status === 'pending' ? 0.5 : 1 }}>
                                        <div style={{ 
                                            width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                            background: item.status === 'done' ? '#10b981' : (item.status === 'active' ? '#3b82f6' : '#f1f5f9'),
                                            border: item.status === 'pending' ? '2px solid #cbd5e1' : 'none'
                                        }}>
                                            {item.status === 'done' && <CheckCircle size={14} color="#fff"/>}
                                            {item.status === 'active' && <Clock size={14} color="#fff"/>}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 'bold', color: item.status === 'active' ? '#2563eb' : '#0f172a', fontSize: '14px' }}>{item.event}</div>
                                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{item.location} &bull; {item.date}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Documents */}
                        <div>
                            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#0f172a' }}>Available Documents</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {!trackingData.documents.length && (
                                    <div style={{ fontSize: '13px', color: '#64748b' }}>Documents are kept with the AWB - open it in Freight &gt; Air Waybill.</div>
                                )}
                                {trackingData.documents.map((doc, idx) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <FileText size={20} color="#dc2626"/>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155' }}>{doc.name}</div>
                                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{doc.type || 'FILE'}{doc.size ? ' \u2022 ' + doc.size : ''}</div>
                                            </div>
                                        </div>
                                        <a href={doc.path} target="_blank" rel="noreferrer" download
                                            title={doc.path ? 'Open ' + doc.name : 'This document has no file on disk'}
                                            style={{ background: 'none', border: 'none', color: doc.path ? '#2563eb' : '#cbd5e1', cursor: doc.path ? 'pointer' : 'not-allowed', display: 'inline-flex' }}
                                            onClick={e => { if (!doc.path) { e.preventDefault(); } }}><Download size={18}/></a>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
