// Screen section: Field Operations
// Split out of FieldTrackingDashboard.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Activity, AlertCircle, Battery, Briefcase, Clock, Crosshair, History, Loader2, MapPin, Navigation, Phone, Plus, RefreshCw, Search, ShieldAlert, ShieldCheck, Users, Wifi } from 'lucide-react';
import { LayersControl, MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import React from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../helpers';
import PhoneAccessModal from './PhoneAccessModal';

export default function FieldOperationsSection({ ctx }) {
  const { MapController, agents, createCustomIcon, fetchAgents, filteredAgents, getBatteryColor, getStatusColor, handleRouteReplay, handleViewHistory, isReplaying, loading, locationHistory, mapCenter, searchQuery, selectedAgent, setAddAgentModal, setAgents, setDispatchModal, setReportModal, setSearchQuery, setSelectedAgent, setSirenModal, setTaskModal } = ctx;
  // 09-Nov-2026: the field app's internet link while start_field_internet.bat is running
  const [publicUrl, setPublicUrl] = React.useState(null);
  const [phoneAccess, setPhoneAccess] = React.useState(false); // 14-Nov-2026: office code / old app / registered phones
  React.useEffect(() => {
    const load = () => apiFetch('/public-url').then(r => setPublicUrl(r && r.url ? r.url + '/field-app' : null)).catch(() => {});
    load(); const t = setInterval(load, 30000); return () => clearInterval(t);
  }, []);
  return (
    <>
    <style dangerouslySetInnerHTML={{__html: `
                @keyframes ping {
                    0% { transform: scale(0.5); opacity: 1; }
                    100% { transform: scale(2.5); opacity: 0; }
                }
                .leaflet-marker-icon { transition: transform 3s linear !important; }
                .leaflet-container { width: 100%; height: 100%; background: #e2e8f0; z-index: 1; }
                .leaflet-control-container .leaflet-top { z-index: 999; }
                .custom-leaflet-icon { background: transparent; border: none; }
            `}} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'linear-gradient(135deg, #0284c7, #2563eb)', padding: '8px', borderRadius: '8px', color: '#fff', boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)' }}>
                        <Crosshair size={20} />
                    </div>
                    <div style={{ marginRight: '16px' }}>
                        <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '800', letterSpacing: '-0.5px' }}>Field Operations</h2>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Monitor fleet &amp; live tracking
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#dcfce7', color: '#16a34a', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', fontWeight: '700' }}>
                                <span style={{ width: '6px', height: '6px', background: '#16a34a', borderRadius: '50%', display: 'inline-block', animation: 'ping 2s infinite' }} />
                                LIVE
                            </span>
                            {publicUrl
                                ? <span title="Field app on mobile data - send this link to field boys" style={{ textTransform: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '10px', padding: '1px 8px', fontSize: '10px' }}>
                                    <Wifi size={10} /> Phone link: <b>{publicUrl}</b>
                                    <button onClick={() => { navigator.clipboard && navigator.clipboard.writeText(publicUrl); toast.success('Link copied'); }} style={{ border: 'none', background: '#2563eb', color: '#fff', borderRadius: '6px', padding: '0 6px', fontSize: '10px', cursor: 'pointer' }}>Copy</button>
                                  </span>
                                : <span title="Run start_field_internet.bat to put the field app on the internet" style={{ textTransform: 'none', fontSize: '10px', color: '#94a3b8' }}>Internet link off (office Wi-Fi only)</span>}
                        </div>
                    </div>
                </div>

                {/* KPI Pills */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', flex: 1, justifyContent: 'center' }}>
                    {[
                        { icon: <Users size={12} color="#0284c7" />, label: 'TOTAL', value: agents.length, color: '#0284c7' },
                        { icon: <Activity size={12} color="#10b981" />, label: 'IN TRANSIT', value: agents.filter(a => a.status === 'In Transit').length, color: '#10b981' },
                        { icon: <Clock size={12} color="#f59e0b" />, label: 'IDLE', value: agents.filter(a => a.status === 'Idle').length, color: '#f59e0b' },
                        { icon: <AlertCircle size={12} color="#ef4444" />, label: 'OFFLINE', value: agents.filter(a => a.status === 'Offline').length, color: '#ef4444' },
                    ].map(({ icon, label, value, color }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                            {icon}
                            <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>{label}</span>
                            <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{loading ? '…' : value}</span>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginLeft: '16px' }}>
                    <button onClick={fetchAgents} title="Refresh" style={{ padding: '6px 10px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <RefreshCw size={14} />
                    </button>
                    <button onClick={() => setPhoneAccess(true)} title="Office code for the field app, and which phones are registered" style={{ padding: '6px 12px', background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <ShieldCheck size={14} /> Phone access
                    </button>
                    <button onClick={() => { setReportModal(true); }} style={{ padding: '6px 12px', background: 'linear-gradient(to right,#0ea5e9,#0284c7)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        📊 Report
                    </button>
                    <button onClick={() => setDispatchModal(true)} style={{ padding: '6px 12px', background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                        <Briefcase size={14} /> Dispatch Task
                    </button>
                    <button onClick={() => setAddAgentModal(true)} style={{ padding: '6px 12px', background: 'linear-gradient(to right, #0ea5e9, #2563eb)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}>
                        <Plus size={14} /> Add Agent
                    </button>
                </div>

            </div>

            {/* Main Content */}
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '16px', flex: 1, minHeight: 0 }}>

                {/* Agent Sidebar */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        <div style={{ fontWeight: '700', fontSize: '16px', color: '#0f172a', marginBottom: '12px' }}>Active Agents</div>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
                            <input type="text" placeholder="Search by name or role..." value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box', background: '#fff' }} />
                        </div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {loading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px', color: '#64748b' }}>
                                <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                                <span style={{ fontSize: '13px' }}>Loading agents...</span>
                            </div>
                        ) : filteredAgents.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '8px', color: '#94a3b8' }}>
                                <Users size={32} />
                                <span style={{ fontSize: '13px' }}>No field agents yet</span>
                                <span style={{ fontSize: '11px', textAlign: 'center', maxWidth: '240px', lineHeight: 1.5, textTransform: 'none' }}>Add an agent here, or the field boy opens <b>http://&lt;this PC's IP&gt;:5001/field-app</b> on his phone (office Wi-Fi) and registers with his name and mobile. His location shows here once he starts.</span>
                                <button onClick={() => setAddAgentModal(true)} style={{ marginTop: '8px', padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>+ Add First Agent</button>
                            </div>
                        ) : filteredAgents.map(agent => (
                            <div
                                key={agent.id}
                                onClick={() => setSelectedAgent(agent)}
                                style={{
                                    padding: '12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                                    background: selectedAgent?.id === agent.id ? '#f0f9ff' : '#fff',
                                    borderLeft: selectedAgent?.id === agent.id ? '4px solid #0ea5e9' : '4px solid transparent',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                    <div>
                                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>{agent.name}</div>
                                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', marginTop: '2px' }}>{agent.role}</div>
                                    </div>
                                    <div style={{ padding: '2px 6px', borderRadius: '12px', background: `${getStatusColor(agent.status)}20`, color: getStatusColor(agent.status), fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: getStatusColor(agent.status) }} />
                                        {agent.status}
                                    </div>
                                </div>
                                <div style={{ fontSize: '12px', color: '#475569', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', padding: '6px', borderRadius: '6px' }}>
                                    <MapPin size={12} color="#0ea5e9" />
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.location}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '500', color: '#64748b' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: getBatteryColor(agent.battery) }}>
                                        <Battery size={12} /> {agent.battery}%
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {agent.lastSeen}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Map + Details Panel */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>

                    <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                        <MapContainer center={mapCenter} zoom={11} zoomControl={true} scrollWheelZoom={true} attributionControl={false} style={{ height: '100%', width: '100%' }}>
                            <LayersControl position="topright">
                                {/* 1. Standard Street View - OpenStreetMap */}
                                <LayersControl.BaseLayer checked name="🗺️ Street View">
                                    <TileLayer
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        attribution='&copy; OpenStreetMap contributors'
                                        maxZoom={19}
                                    />
                                </LayersControl.BaseLayer>

                                {/* 2. Satellite View - Esri World Imagery */}
                                <LayersControl.BaseLayer name="🛰️ Satellite View">
                                    <TileLayer
                                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                        attribution='&copy; Esri &mdash; Source: Esri, USDA, USGS'
                                        maxZoom={19}
                                    />
                                </LayersControl.BaseLayer>

                                {/* 3. Dark Mode - CartoDB Dark Matter */}
                                <LayersControl.BaseLayer name="🌙 Dark Mode">
                                    <TileLayer
                                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                        attribution='&copy; OpenStreetMap &copy; CARTO'
                                        maxZoom={19}
                                    />
                                </LayersControl.BaseLayer>

                                {/* 4. Light Clean - CartoDB Positron */}
                                <LayersControl.BaseLayer name="⬜ Light Clean">
                                    <TileLayer
                                        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                                        attribution='&copy; OpenStreetMap &copy; CARTO'
                                        maxZoom={19}
                                    />
                                </LayersControl.BaseLayer>

                                {/* 5. Terrain View */}
                                <LayersControl.BaseLayer name="🏔️ Terrain View">
                                    <TileLayer
                                        url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                                        attribution='Map data: &copy; OpenStreetMap contributors'
                                        maxZoom={17}
                                    />
                                </LayersControl.BaseLayer>
                            </LayersControl>

                            <MapController selectedAgent={selectedAgent} />

                            {/* History trail polyline */}
                            {locationHistory.length > 1 && (
                                <Polyline positions={locationHistory.map(p => [p.lat, p.lng])} color="#0ea5e9" weight={3} opacity={0.7} dashArray="6" />
                            )}

                            {/* Agent markers */}
                            {agents.map(agent => {
                                if (agent.status === 'Offline' || !agent.lat) return null;
                                const isSelected = selectedAgent?.id === agent.id;
                                return (
                                    <Marker
                                        key={agent.id}
                                        position={[agent.lat, agent.lng]}
                                        icon={createCustomIcon(agent, isSelected)}
                                        eventHandlers={{ click: () => setSelectedAgent(agent) }}
                                    >
                                        <Popup>
                                            <div style={{ fontFamily: 'Inter, sans-serif' }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>{agent.name}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b' }}>{agent.role}</div>
                                                <div style={{ marginTop: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Battery size={12} /> {agent.battery}% | {agent.speed}
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>📍 {agent.location}</div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                );
                            })}
                        </MapContainer>

                        {/* Live badge */}
                        <div style={{ position: 'absolute', bottom: '30px', right: '20px', zIndex: 1000, pointerEvents: 'none' }}>
                            <div style={{ background: '#fff', padding: '8px 16px', borderRadius: '24px', fontSize: '13px', fontWeight: '700', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 0 3px #ecfdf5', animation: 'ping 2s infinite' }} />
                                Live Fleet Tracking
                            </div>
                        </div>
                    </div>

                    {/* Selected Agent Control Panel */}
                    {selectedAgent && (
                        <div style={{ background: '#fff', borderTop: '1px solid #e2e8f0', padding: '8px 12px', zIndex: 100, boxShadow: '0 -4px 20px rgba(0,0,0,0.05)', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                        <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: '800' }}>{selectedAgent.name}</h3>
                                        <span style={{ fontSize: '10px', padding: '2px 8px', background: '#f1f5f9', color: '#475569', borderRadius: '12px', fontWeight: '600' }}>{selectedAgent.id}</span>
                                        {selectedAgent.isStale && (
                                            <span style={{ fontSize: '10px', padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: '12px', fontWeight: '700', border: '1px solid #fcd34d' }}>
                                                ⚠️ No Ping
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>{selectedAgent.role} · {selectedAgent.vehicleNumber}</span>
                                        {selectedAgent.phone && (
                                            <a href={`tel:${selectedAgent.phone}`}
                                               style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 10px', background:'linear-gradient(to right,#10b981,#059669)', color:'white', borderRadius:'8px', fontWeight:'700', fontSize:'12px', textDecoration:'none' }}>
                                                📞 {selectedAgent.phone}
                                            </a>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button onClick={handleViewHistory} style={{ padding: '6px 12px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <History size={14} /> History
                                    </button>
                                    <button onClick={handleRouteReplay} disabled={isReplaying} style={{ padding: '6px 12px', background: isReplaying ? '#94a3b8' : 'linear-gradient(to right,#7c3aed,#4f46e5)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: isReplaying ? 'not-allowed' : 'pointer' }}>
                                        {isReplaying ? '⏳ Replaying…' : '▶️ Replay'}
                                    </button>
                                    <button onClick={() => setTaskModal(true)} style={{ padding: '6px 12px', background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        Assign Task
                                    </button>

                                    {selectedAgent?.taskStatus === 'Pending' && (
                                        <button
                                            onClick={async () => {
                                                await toast.promise(
                                                    apiFetch(`/agents/${selectedAgent.id}/task-complete`, { method: 'PATCH' }),
                                                    { loading: 'Marking done…', success: '✅ Task complete!', error: e => e.message }
                                                );
                                                setAgents(prev => prev.map(a => a.id === selectedAgent.id ? { ...a, taskStatus: 'Done', status: 'Idle' } : a));
                                            }}
                                            style={{ padding: '6px 12px', background: 'linear-gradient(to right,#10b981,#059669)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                            ✅ Mark Done
                                        </button>
                                    )}
                                    <button onClick={() => setSirenModal(true)} style={{ padding: '6px 12px', background: 'linear-gradient(to right, #ef4444, #dc2626)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)' }}>
                                        <ShieldAlert size={14} /> Siren
                                    </button>
                                </div>

                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Current Speed</div>
                                    <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}><Navigation size={14} color="#0ea5e9" /> {selectedAgent.speed}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Contact</div>
                                    <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={14} color="#10b981" /> {selectedAgent.phone}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Active Task</div>
                                    <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}><Briefcase size={14} color="#8b5cf6" /> {selectedAgent.task}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Last Synced</div>
                                    <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}><Wifi size={14} color="#f59e0b" /> {selectedAgent.lastSeen}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── MODALS ─────────────────────────────────────────────────────────────── */}

            {phoneAccess && <PhoneAccessModal onClose={() => setPhoneAccess(false)} />}
            {/* History Modal */}
    </>
  );
}
