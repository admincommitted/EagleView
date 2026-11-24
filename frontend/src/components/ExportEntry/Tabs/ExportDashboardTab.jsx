import React, { useState, useEffect } from 'react';
import { Activity, FileText, AlertTriangle, CheckCircle, Search, ArrowRight, Loader, Plane, RefreshCw, Server, ShieldCheck, Clock, Zap, MessageCircle, Calculator } from 'lucide-react';
import ExportPenaltyCalculator from '../../ExportPenaltyCalculator';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import toast from 'react-hot-toast';
import { askText } from '../../common/askConfirm'; // EagleView input window, 20-Nov-2026
import { useGlobalContext } from '../../../GlobalContext';

// 29-Oct-2026: dates shown as 05-Sep-2026 (were raw ISO text); LEO card also counts gate pass / departed / delivered
const fmtDate = (v) => { if (!v) return ''; const s = String(v).trim(); const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s); const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s); return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'); };
const fmtWhen = (v) => { const d = new Date(v); if (isNaN(d)) return ''; const today = new Date(); return (d.toDateString() === today.toDateString() ? 'Today' : fmtDate(d)) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); };
const AFTER_LEO = ['LEO', 'GATE_PASS', 'DEPARTED', 'DELIVERED'];
const inFilter = (job, f) => f === 'ALL' || (f === 'LEO' ? AFTER_LEO.includes(job.macroStatus) : job.macroStatus === f);
const STAGE_LABEL = { DRAFT: 'DRAFT', SUBMITTED: 'SB FILED', TD_DONE: 'TD DONE', XRAY_DONE: 'X-RAY DONE', LEO: 'LEO', GATE_PASS: 'GATE PASS', DEPARTED: 'DEPARTED', DELIVERED: 'DELIVERED', CANCELLED: 'CANCELLED' };
const STAGE_COLOR = { DRAFT: ['#f1f5f9', '#475569'], SUBMITTED: ['#e0f2fe', '#0369a1'], TD_DONE: ['#e0f2fe', '#0284c7'], XRAY_DONE: ['#eef2ff', '#4338ca'], CANCELLED: ['#fef2f2', '#b91c1c'] };

export default function ExportDashboardTab({ onGoToQuery, onOpenJob }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ draft: 0, td_done: 0, xray_done: 0, leo: 0 });
  const [tat, setTat] = useState(0);
  const [pipeline, setPipeline] = useState([]);
  const [riskJobs, setRiskJobs] = useState([]);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [deepFilter, setDeepFilter] = useState('ALL');
  const [calcOpen, setCalcOpen] = useState(false);
  const [selectedCalcJob, setSelectedCalcJob] = useState(null);
  const [hoveredRadar, setHoveredRadar] = useState(null);
  const [activity, setActivity] = useState([]);
  const [otherJobs, setOtherJobs] = useState(0);
  const { activeBranch, activeYear } = useGlobalContext();

  // only the selected branch / financial year (reloads when they change)
  useEffect(() => {
    fetchDashboardData();
  }, [activeBranch?.id, activeYear?.id]);

  const fetchDashboardData = async (showToast = false) => {
    try {
      setLoading(true);
      const q = new URLSearchParams();
      if (activeBranch?.id && !activeBranch.isAll) q.set('branchId', activeBranch.id);
      if (activeYear?.id) q.set('financialYearId', activeYear.id);
      const res = await fetch('/api/export-dashboard/live-tracking' + (q.toString() ? '?' + q : ''));
      const data = await res.json();
      
      if (data.success) {
        setStats(data.summary);
        setPipeline(data.recentJobs || []);
        setRiskJobs(data.riskJobs || []);
        setActivity(data.recentActivity || []);
        setOtherJobs(data.otherJobs || 0);
        // LEO given today: average hours from SB to LEO (worked out by the server from the real LEO times)
        setTat(data.tatToday && data.tatToday.count ? data.tatToday : 0);
        
        if (showToast) toast.success('Dashboard refreshed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load export metrics');
    } finally {
      setLoading(false);
    }
  };

  let pieData = [
    { name: 'Draft', value: stats.draft || 0, color: '#94a3b8' },
    { name: 'SB Filed', value: stats.submitted || 0, color: '#0284c7' },
    { name: 'TD Done', value: stats.td_done || 0, color: '#0ea5e9' },
    { name: 'X-Ray', value: stats.xray_done || 0, color: '#6366f1' },
    { name: 'LEO', value: stats.leo || 0, color: '#65a30d' }
  ];
  
  const legendData = pieData;
  if (!pieData.some(d => d.value > 0)) {
    pieData = [{ name: 'No Data', value: 1, color: '#e2e8f0' }];
  } else {
    pieData = pieData.filter(d => d.value > 0);
  }

  return (
    <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto' }}>
      
            {/* MAIN DASHBOARD GRID */}
      <div style={{ display: 'flex', gap: '1.5rem', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT COLUMN */}
        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
          
           {/* Top KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
            {[
              { label: 'DRAFT JOBS', value: stats.draft, icon: FileText, bg: '#475569', textColor: '#ffffff', filter: 'DRAFT' },
              { label: 'SB FILED', value: stats.submitted, icon: Plane, bg: '#0284c7', textColor: '#ffffff', filter: 'SUBMITTED' },
              { label: 'TD COMPLETED', value: stats.td_done, icon: Server, bg: '#0ea5e9', textColor: '#ffffff', filter: 'TD_DONE' },
              { label: 'X-RAY CLEARED', value: stats.xray_done, icon: ShieldCheck, bg: '#6366f1', textColor: '#ffffff', filter: 'XRAY_DONE' },
              { label: 'LEO ISSUED', value: stats.leo, icon: CheckCircle, bg: '#65a30d', textColor: '#ffffff', filter: 'LEO' },
            ].map((stat, i) => (
              <div key={i} title={'Show ' + stat.label.toLowerCase()} onClick={() => { setActiveFilter(stat.filter); setDeepFilter('ALL'); }} style={{ 
                cursor: 'pointer', outline: activeFilter === stat.filter ? '3px solid #1e293b' : 'none', outlineOffset: '2px',
                position: 'relative', 
                background: stat.bg, 
                borderRadius: '4px', 
                padding: '12px 16px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between', 
                minHeight: '85px', 
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                overflow: 'hidden'
              }}>
                {/* Background Icon Watermark */}
                <stat.icon 
                  size={80} 
                  color={stat.textColor} 
                  style={{ position: 'absolute', left: '-10px', top: '50%', transform: 'translateY(-50%) rotate(-10deg)', opacity: 0.15 }} 
                />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: stat.textColor, letterSpacing: '0.5px' }}>
                    {stat.label}
                  </div>
                  <RefreshCw size={12} color={stat.textColor} style={{ cursor: 'pointer', opacity: 0.8 }} onClick={(e) => { e.stopPropagation(); fetchDashboardData(true); }} />
                </div>
                
                <div style={{ fontSize: '32px', fontWeight: 800, color: stat.textColor, textAlign: 'right', marginTop: '12px', zIndex: 1, lineHeight: 1 }}>
                  {stat.value || 0}
                </div>
              </div>
            ))}
          </div>

          {otherJobs > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
              {otherJobs} more job(s) are saved under another branch / financial year - change the branch or year at the top to see them.
            </div>
          )}
          {/* TAT KPI Banner */}
          <div style={{ background: '#e0e7ff', padding: '8px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', color: '#3730a3', fontSize: '12px', fontWeight: 600, width: '100%', boxSizing: 'border-box' }}>
            <Clock size={14} /> Average Clearance TAT (Today): {tat && tat.count ? `${tat.hours} Hours from SB to LEO - ${tat.count} job${tat.count > 1 ? 's' : ''} (${tat.hours < 24 ? 'Excellent' : 'Needs Attention'})` : 'No LEO given today'}
          </div>

          {/* Pipeline Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Current Pipeline</h3>
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select 
                  value={deepFilter} 
                  onChange={(e) => setDeepFilter(e.target.value)}
                  style={{
                    padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700,
                    border: '1px solid #cbd5e1', color: '#475569', outline: 'none', cursor: 'pointer',
                    background: '#f1f5f9'
                  }}
                >
                  <option value="ALL">ALL STATUSES (DEEP FILTER) &#9660;</option>
                  {[...new Set(pipeline.map(j => j.status))].filter(Boolean).map(st => (
                    <option key={st} value={st}>{STAGE_LABEL[st] || st}</option>
                  ))}
                </select>

                {[
                  { id: 'ALL', label: 'All Jobs' },
                  { id: 'SUBMITTED', label: 'SB Filed' },
                  { id: 'TD_DONE', label: 'TD Done' },
                  { id: 'XRAY_DONE', label: 'X-Ray Done' },
                  { id: 'DRAFT', label: 'Drafts' },
                  { id: 'LEO', label: 'Cleared (LEO)' }
                ].map(f => (
                  <button 
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    style={{
                      padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', border: '1px solid',
                      background: activeFilter === f.id ? '#1e293b' : '#f8fafc',
                      color: activeFilter === f.id ? 'white' : '#64748b',
                      borderColor: activeFilter === f.id ? '#1e293b' : '#e2e8f0',
                      transition: 'all 0.2s'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <Loader className="animate-spin" size={24} color="#4f46e5" />
              </div>
            ) : (() => {
              const filteredPipeline = pipeline.filter(job => inFilter(job, activeFilter) && (deepFilter === 'ALL' || job.status === deepFilter));
              
              if (filteredPipeline.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                    <p style={{ color: '#64748b', fontSize: '12px' }}>No jobs found for this filter.</p>
                  </div>
                );
              }
              
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                  {filteredPipeline.map(job => (
                  <div key={job.id} style={{ 
                    background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', 
                    padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)', transition: 'transform 0.2s',
                    cursor: 'pointer'
                  }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                     onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '12px', color: '#0f172a', fontWeight: 700 }}>{job.jobNo || 'DRAFT'}</h4>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{fmtDate(job.jobDate || job.createdAt) || 'Recent'} · {job.shipmentMode === 'SEA' ? 'SEA' : 'AIR'}{job.destination ? ' · ' + job.destination : ''}</div>
                      </div>
                      <span style={{ 
                        padding: '2px 8px', borderRadius: '999px', fontSize: '9px', fontWeight: 700,
                        background: (STAGE_COLOR[job.status] || ['#ecfdf5'])[0],
                        color: (STAGE_COLOR[job.status] || [null, '#047857'])[1]
                      }}>
                        {STAGE_LABEL[job.status] || job.status}
                      </span>
                    </div>
                    
                    <div style={{ fontSize: '11px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div><strong>Exporter:</strong> {job.exporterName || job.shipperName || 'N/A'}</div>
                      {job.sbNo && (
                        <div style={{ color: '#0369a1', fontWeight: 600, background: '#f0f9ff', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', alignSelf: 'flex-start' }}>
                          SB No: {job.sbNo}{job.sbDate ? ' / ' + fmtDate(job.sbDate) : ''}
                        </div>
                      )}
                      {job.leoDate && AFTER_LEO.includes(job.status) && (
                        <div style={{ color: '#4d7c0f', fontWeight: 600, fontSize: '10px' }}>LEO: {fmtDate(job.leoDate)}</div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                      <button 
                        onClick={() => onOpenJob(job.id)}
                        style={{ 
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          padding: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px',
                          color: '#4f46e5', fontWeight: 600, fontSize: '11px', cursor: 'pointer', transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                      >
                        Continue Job <ArrowRight size={12} />
                      </button>
                      {AFTER_LEO.includes(job.status) && (
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            // real send (28-Oct-2026): the old call got a fake "sent" answer and nothing was sent
                            const mobile = await askText({ title: 'Send LEO on WhatsApp', message: `Job ${job.jobNo}: LEO message to ${job.exporterName || job.shipperName || 'the exporter'}.`, label: 'WhatsApp number (with country code)', placeholder: 'e.g. 919812345678', okLabel: 'Send' });
                            if (!mobile || !mobile.trim()) return;
                            fetch('/api/notifications/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ mobileNumber: mobile.trim(), partyName: job.exporterName || job.shipperName || '', refNo: job.sbNo || job.jobNo, statusText: `Job ${job.jobNo}: Shipping Bill ${job.sbNo || ''} - Let Export Order (LEO) given by Customs.` }) })
                              .then(async r => { const d = await r.json().catch(() => ({})); if (r.ok && d.success) toast.success('WhatsApp sent to ' + mobile.trim()); else toast.error('WhatsApp not sent: ' + (d.error || 'check Settings > WhatsApp')); })
                              .catch((err) => toast.error('WhatsApp not sent: ' + err.message));
                          }}
                          style={{ 
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                            padding: '6px', background: '#22c55e', border: 'none', borderRadius: '4px',
                            color: '#fff', fontWeight: 600, fontSize: '11px', cursor: 'pointer', transition: 'background 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#16a34a'}
                          onMouseLeave={e => e.currentTarget.style.background = '#22c55e'}
                        >
                          <MessageCircle size={14} /> Send WhatsApp
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ); })()}
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', paddingRight: '5px' }}>
          
           {/* Financial Risk & Penalty Radar */}
            <div style={{ background: 'linear-gradient(135deg, #fef2f2, #fff1f2)', border: '1px solid #fecdd3', borderRadius: '8px', padding: '16px', boxShadow: '0 4px 6px rgba(225, 29, 72, 0.1)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: 800, color: '#be123c', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
                <AlertTriangle size={16} color="#e11d48" /> Financial Risk Radar
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {riskJobs.length === 0 ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: '#10b981', fontSize: '12px', fontWeight: 600, background: '#ecfdf5', borderRadius: '6px', border: '1px dashed #6ee7b7' }}>
                      <CheckCircle size={20} color="#10b981" style={{ marginBottom: '8px', opacity: 0.8 }} />
                      <div>ALL CLEAR</div>
                      <div style={{ fontSize: '10px', color: '#34d399', marginTop: '4px' }}>No Pending Penalties</div>
                    </div>
                ) : riskJobs.map((risk, i) => (
                  <div 
                    key={risk.id || i}
                    onMouseEnter={() => setHoveredRadar(risk.id)} 
                    onMouseLeave={() => setHoveredRadar(null)}
                    style={{ 
                      background: hoveredRadar === risk.id ? '#f8fafc' : 'white', 
                      padding: '10px', borderRadius: '6px',
                      borderLeft: `4px solid ${risk.severity === 'HIGH' ? '#ef4444' : '#f59e0b'}`, 
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                      cursor: 'pointer', 
                      boxShadow: hoveredRadar === risk.id ? '0 4px 12px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.05)',
                      transform: hoveredRadar === risk.id ? 'translateY(-2px)' : 'translateY(0)',
                      transition: 'all 0.2s ease'
                    }} 
                    onClick={() => { setSelectedCalcJob(risk.job); setCalcOpen(true); }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{risk.jobNo}</div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{risk.warning}</div>
                    </div>
                    <Calculator size={14} color={risk.severity === 'HIGH' ? '#ef4444' : '#f59e0b'} />
                  </div>
                ))}
              </div>
            </div>

          {/* Job Distribution Chart */}
          <div style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={14} color="#64748b" /> Job Distribution
            </h3>
            <div style={{ height: '140px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ fontSize: '10px', padding: '4px 8px', borderRadius: '4px' }} itemStyle={{ color: '#333' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', justifyContent: 'center', marginTop: '6px' }}>
              {legendData.map(d => (
                <span key={d.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#475569', fontWeight: 600 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: d.color }} />{d.name} {d.value}
                </span>
              ))}
              {stats.cancelled > 0 && <span style={{ fontSize: '10px', color: '#b91c1c', fontWeight: 600 }}>Cancelled {stats.cancelled}</span>}
            </div>
          </div>
          
          {/* Recent Activity Mini-Feed */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={14} color="#f59e0b" /> Recent Activity
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
              {/* real events: timeline status / remarks, job created / saved / sent to ICEGATE (newest first) */}
              {activity.map((a, idx) => (
                <div key={idx} onClick={() => onOpenJob(a.jobId)} title="Open job" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', position: 'relative', zIndex: 1, cursor: 'pointer' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: a.kind === 'STATUS' ? '#16a34a' : a.kind === 'FILED' ? '#0284c7' : a.kind === 'REMARK' ? '#f59e0b' : '#4f46e5', border: '2px solid white', marginTop: '2px', flexShrink: 0 }}></div>
                  <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{a.jobNo || 'Draft'}</span>{' '}
                    {a.kind === 'STATUS' ? <>status <span style={{ fontWeight: 600 }}>{a.text}</span></> : a.kind === 'REMARK' ? <>remark: {a.text}</> : a.text}
                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>{fmtWhen(a.at)}{a.by ? ' · ' + a.by : ''}</div>
                  </div>
                </div>
              )) }
              {activity.length === 0 && (
                <div style={{ fontSize: '11px', color: '#94a3b8', paddingLeft: '16px' }}>No recent activity.</div>
              )}
            </div>
          </div>

        </div>

      </div>
      <ExportPenaltyCalculator isOpen={calcOpen} onClose={() => setCalcOpen(false)} job={selectedCalcJob} />
    </div>
  );
}
