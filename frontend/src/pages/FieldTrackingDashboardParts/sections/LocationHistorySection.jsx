// Screen section: Location History
// Split out of FieldTrackingDashboard.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { BellRing, Briefcase, CheckCircle, History, ShieldAlert } from 'lucide-react';
import React from 'react';

export default function LocationHistorySection({ ctx }) {
  const { addAgentModal, agents, dispatchData, dispatchModal, fetchReport, handleAddAgent, handleAssignTask, handleGlobalDispatch, handlePingSiren, historyModal, locationHistory, newAgentData, newTask, reportData, reportDate, reportLoading, reportModal, selectedAgent, setAddAgentModal, setDispatchData, setDispatchModal, setHistoryModal, setLocationHistory, setNewAgentData, setNewTask, setReportDate, setReportModal, setSirenModal, setSirenMsg, setTaskModal, sirenModal, sirenMsg, taskModal } = ctx;
  return (
    <>
    {historyModal && (
                <div style={{ position: 'fixed', top: '70px', left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '520px', borderRadius: '16px', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}><History size={18} style={{ marginRight: '8px' }} />Location History</h3>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>{selectedAgent?.name} · Last 8 hours</span>
                        </div>
                        {locationHistory.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>No location history found for today.</div>
                        ) : (
                            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                                {locationHistory.slice().reverse().map((loc, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                                        <div style={{ fontSize: '11px', color: '#94a3b8', minWidth: '80px' }}>{new Date(loc.recordedAt).toLocaleTimeString()}</div>
                                        <div style={{ fontSize: '13px', color: '#0f172a' }}>
                                            {loc.locationName || `${loc.lat?.toFixed(4)}, ${loc.lng?.toFixed(4)}`}
                                        </div>
                                        {loc.speed !== null && <div style={{ fontSize: '11px', color: '#64748b', marginLeft: 'auto' }}>{Math.round(loc.speed)} km/h</div>}
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <button onClick={() => { setHistoryModal(false); setLocationHistory([]); }} style={{ padding: '10px 24px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Agent Modal */}
            {addAgentModal && (
                <div style={{ position: 'fixed', top: '70px', left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '400px', borderRadius: '16px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '800', marginBottom: '24px', color: '#0f172a' }}>Add New Agent</h3>
                        {[
                            { label: 'Full Name *', key: 'name', type: 'text', placeholder: '' },
                            { label: 'Phone Number *', key: 'phone', type: 'text', placeholder: '+91 98765 43210' },
                            { label: 'Vehicle Number', key: 'vehicleNumber', type: 'text', placeholder: 'DL 1C AA 1234' }
                        ].map(f => (
                            <div key={f.key} style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>{f.label}</label>
                                <input type={f.type} placeholder={f.placeholder} value={newAgentData[f.key]}
                                    onChange={(e) => setNewAgentData({ ...newAgentData, [f.key]: e.target.value })}
                                    style={{ width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }} />
                            </div>
                        ))}
                        <div style={{ marginBottom: '28px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Role</label>
                            <select value={newAgentData.role} onChange={(e) => setNewAgentData({ ...newAgentData, role: e.target.value })}
                                style={{ width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }}>
                                <option>Fleet Driver</option>
                                <option>Doc Collection</option>
                                <option>Customs Clerk</option>
                                <option>Airport Runner</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                            <button onClick={() => setAddAgentModal(false)} style={{ padding: '12px 24px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}>Cancel</button>
                            <button onClick={handleAddAgent} style={{ padding: '12px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}>Add Agent</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Dispatch Modal */}
            {dispatchModal && (
                <div style={{ position: 'fixed', top: '70px', left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '480px', borderRadius: '16px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#0f172a', marginBottom: '24px' }}>
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '50%' }}><Briefcase size={32} /></div>
                            <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '800' }}>Global Dispatch</h3>
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Select Agent *</label>
                            <select value={dispatchData.agentId} onChange={(e) => setDispatchData({ ...dispatchData, agentId: e.target.value })}
                                style={{ width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }}>
                                <option value="">-- Choose Agent --</option>
                                {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
                            </select>
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Task Title *</label>
                            <input type="text" value={dispatchData.title} onChange={(e) => setDispatchData({ ...dispatchData, title: e.target.value })}
                                style={{ width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ marginBottom: '28px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Location / Destination</label>
                            <input type="text" value={dispatchData.location} onChange={(e) => setDispatchData({ ...dispatchData, location: e.target.value })}
                                style={{ width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                            <button onClick={() => setDispatchModal(false)} style={{ padding: '12px 24px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}>Cancel</button>
                            <button onClick={handleGlobalDispatch} style={{ padding: '12px 24px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}>Dispatch Task</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Task Modal */}
            {taskModal && (
                <div style={{ position: 'fixed', top: '70px', left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '480px', borderRadius: '16px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#0ea5e9', marginBottom: '24px' }}>
                            <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: '50%' }}><Briefcase size={32} /></div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Assign Task</h3>
                                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', marginTop: '4px' }}>Agent: {selectedAgent?.name}</div>
                            </div>
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Task Title *</label>
                            <input type="text" placeholder="e.g. Deliver LCL Cargo to Okhla" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                style={{ width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Location (Optional)</label>
                            <input type="text" placeholder="e.g. Connaught Place" value={newTask.location} onChange={(e) => setNewTask({ ...newTask, location: e.target.value })}
                                style={{ width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ marginBottom: '28px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Priority</label>
                            <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                                style={{ width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                                <option>Low</option><option>Normal</option><option>High</option><option>Urgent</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                            <button onClick={() => setTaskModal(false)} style={{ padding: '12px 24px', background: '#fff', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}>Cancel</button>
                            <button onClick={handleAssignTask} style={{ padding: '12px 24px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)' }}>
                                <CheckCircle size={18} /> Assign Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Siren Modal */}
            {sirenModal && (
                <div style={{ position: 'fixed', top: '70px', left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '480px', borderRadius: '16px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #fee2e2' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#dc2626', marginBottom: '24px' }}>
                            <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '50%' }}><ShieldAlert size={32} /></div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '800' }}>Emergency Siren</h3>
                                <div style={{ fontSize: '13px', color: '#ef4444', fontWeight: '600', marginTop: '4px' }}>Target: {selectedAgent?.name}</div>
                            </div>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #ef4444', marginBottom: '24px' }}>
                            <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: '1.6', fontWeight: '500' }}>
                                This action sends an emergency alert notification to the agent's device.
                            </p>
                        </div>
                        <div style={{ marginBottom: '28px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Message to display</label>
                            <input type="text" value={sirenMsg} onChange={(e) => setSirenMsg(e.target.value)}
                                style={{ width: '100%', padding: '14px 16px', border: '2px solid #cbd5e1', borderRadius: '8px', fontSize: '15px', fontWeight: '500', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                            <button onClick={() => setSirenModal(false)} style={{ padding: '12px 24px', background: '#fff', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}>Cancel</button>
                            <button onClick={handlePingSiren} style={{ padding: '12px 24px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)' }}>
                                <BellRing size={18} /> Send Alert Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Daily Report Modal ──────────────────────────────────────────── */}
            {reportModal && (
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'16px' }}>
                    <div style={{ background:'white', borderRadius:'20px', padding:'28px', width:'100%', maxWidth:'680px', maxHeight:'85vh', overflow:'auto', boxShadow:'0 25px 60px rgba(0,0,0,0.3)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
                            <div>
                                <h3 style={{ margin:0, fontSize:'22px', fontWeight:'800', color:'#0f172a' }}>📊 Daily Activity Report</h3>
                                <p style={{ margin:'4px 0 0', fontSize:'13px', color:'#64748b' }}>Today's performance — details of every agent</p>
                            </div>
                            <button onClick={() => setReportModal(false)} style={{ background:'#f1f5f9', border:'none', borderRadius:'10px', padding:'8px 14px', cursor:'pointer', fontWeight:'700', fontSize:'14px', color:'#475569' }}>✕ Close</button>
                        </div>
                        <div style={{ display:'flex', gap:'10px', marginBottom:'20px' }}>
                            <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
                                style={{ flex:1, padding:'10px 14px', border:'1px solid #e2e8f0', borderRadius:'10px', fontSize:'14px', color:'#0f172a' }} />
                            <button onClick={fetchReport} disabled={reportLoading}
                                style={{ padding:'10px 24px', background: reportLoading ? '#94a3b8' : 'linear-gradient(to right,#0ea5e9,#0284c7)', color:'white', border:'none', borderRadius:'10px', fontWeight:'700', fontSize:'14px', cursor: reportLoading ? 'not-allowed' : 'pointer' }}>
                                {reportLoading ? '⏳ Loading…' : '🔍 Generate'}
                            </button>
                        </div>
                        {!reportData && !reportLoading && (
                            <div style={{ textAlign:'center', padding:'40px 0', color:'#94a3b8' }}>
                                <div style={{ fontSize:'40px', marginBottom:'12px' }}>📊</div>
                                Date chunein aur Generate dabao
                            </div>
                        )}
                        {reportData && (
                            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'8px' }}>
                                    {[
                                        { label:'Total Agents', val: reportData.length, icon:'👥' },
                                        { label:'Active Today',  val: reportData.filter(r=>r.totalPings>0).length, icon:'✅', color:'#10b981' },
                                        { label:'Total Distance', val: reportData.reduce((s,r)=>s+(r.distanceKm||0),0).toFixed(1)+' km', icon:'🛣️', color:'#0ea5e9' },
                                    ].map(({ label, val, icon, color }) => (
                                        <div key={label} style={{ background:'#f8fafc', borderRadius:'12px', padding:'14px', textAlign:'center', border:'1px solid #e2e8f0' }}>
                                            <div style={{ fontSize:'24px', marginBottom:'4px' }}>{icon}</div>
                                            <div style={{ fontSize:'20px', fontWeight:'800', color: color||'#0f172a' }}>{val}</div>
                                            <div style={{ fontSize:'11px', color:'#64748b', fontWeight:'700', textTransform:'uppercase' }}>{label}</div>
                                        </div>
                                    ))}
                                </div>
                                {reportData.map(r => (
                                    <div key={r.agentId} style={{ background:'#f8fafc', borderRadius:'14px', padding:'16px', border:'1px solid #e2e8f0' }}>
                                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: r.totalPings > 0 ? '12px' : '0' }}>
                                            <div>
                                                <div style={{ fontWeight:'800', fontSize:'16px', color:'#0f172a' }}>{r.agentName}</div>
                                                <div style={{ fontSize:'12px', color:'#64748b', marginTop:'2px' }}>{r.role} · {r.agentId}</div>
                                            </div>
                                            <div style={{ fontSize:'11px', fontWeight:'700', padding:'4px 12px', borderRadius:'20px', background: r.totalPings > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)', color: r.totalPings > 0 ? '#10b981' : '#94a3b8' }}>
                                                {r.totalPings > 0 ? '● Active' : '○ No Activity'}
                                            </div>
                                        </div>
                                        {r.totalPings > 0 ? (
                                            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
                                                {[['📍','Pings',r.totalPings,''],['🛣️','Distance',r.distanceKm,' km'],['⏱️','Active',r.activeHours,' hrs'],['🏃','Avg Speed',r.avgSpeed,' km/h']].map(([icon,label,val,unit]) => (
                                                    <div key={label} style={{ background:'white', borderRadius:'10px', padding:'10px', textAlign:'center', border:'1px solid #e2e8f0' }}>
                                                        <div style={{ fontSize:'16px', marginBottom:'4px' }}>{icon}</div>
                                                        <div style={{ fontSize:'18px', fontWeight:'800', color:'#0f172a' }}>{val}{unit}</div>
                                                        <div style={{ fontSize:'10px', color:'#64748b', fontWeight:'700', textTransform:'uppercase' }}>{label}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ color:'#94a3b8', fontSize:'13px', paddingTop:'4px' }}>No activity recorded on this day</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
    </>
  );
}
