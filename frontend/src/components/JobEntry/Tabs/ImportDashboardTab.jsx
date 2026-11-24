import React, { useState, useEffect } from 'react';
import { Activity, FileText, AlertTriangle, CheckCircle, Search, ArrowRight, Loader, Plane, RefreshCw, Server, ShieldCheck, Clock, Zap, MessageCircle, Calculator } from 'lucide-react';
import PenaltyCalculator from '../../PenaltyCalculator';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import toast from 'react-hot-toast';
import { askText } from '../../common/askConfirm'; // EagleView input window, 20-Nov-2026

// 28-Oct-2026: stages come from the backend (macroStatus DRAFT / FILED / QUERY / OOC, see routes/importDashboard.js);
// dates shown dd/mm/yyyy (the card showed "20260917"); the 30-second refresh compares with the latest data (it compared
// with the first, empty list, so no alert ever fired); TAT, activity and the WhatsApp button use real data.
const STAGE = {
  DRAFT: { label: 'DRAFT', bg: '#f1f5f9', fg: '#475569' },
  FILED: { label: 'FILED', bg: '#fffbeb', fg: '#b45309' },
  QUERY: { label: 'QUERY', bg: '#fef2f2', fg: '#b91c1c' },
  OOC: { label: 'OOC', bg: '#ecfdf5', fg: '#047857' },
  CANCELLED: { label: 'CANCELLED', bg: '#f1f5f9', fg: '#94a3b8' },
};
const dmy = (v) => { const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(String(v || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : (v || ''); };
const ago = (v) => { const t = new Date(v).getTime(); if (isNaN(t)) return ''; const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

export default function ImportDashboardTab({ onGoToQuery, onOpenJob }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ draft: 0, pending: 0, queries: 0, ooc: 0 });
  const [tat, setTat] = useState(0);
  const [pipeline, setPipeline] = useState([]);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [deepFilter, setDeepFilter] = useState('ALL');
  const [calcOpen, setCalcOpen] = useState(false);
  const [selectedCalcJob, setSelectedCalcJob] = useState(null);
  const [hoveredRadar, setHoveredRadar] = useState(null);
  const [riskJobs, setRiskJobs] = useState([]);
  const [tatCount, setTatCount] = useState(0);
  const [activity, setActivity] = useState([]);
  const pipelineRef = React.useRef([]);

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 30 seconds for live popup alerts
    const interval = setInterval(() => {
      fetchDashboardData(false); // false means don't show the loading spinner
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const res = await fetch('/api/dashboard/live-tracking');
      const data = await res.json();
      if (data.success) {
        if (data.riskJobs) {
            setRiskJobs(data.riskJobs);
        } else {
            // 29-Oct-2026: the backend works the risk list out from real dates; no invented "penalty accruing" alert
            // for every pending job when it sends none
            setRiskJobs([]);
        }
        setStats({
          draft: data.summary?.draft || 0,
          pending: data.summary?.submitted || 0,
          queries: data.summary?.query_raised || 0,
          ooc: data.summary?.ooc || 0
        });

        // Check for new updates against the previous refresh (a ref: the interval kept the first, empty list)
        const prevList = pipelineRef.current;
        if (prevList.length > 0) {
          data.recentJobs?.forEach(newJob => {
            const oldJob = prevList.find(j => j.id === newJob.id);
            if (oldJob) {
              // Advanced Alert Logic
              const triggerAdvancedAlert = (type, job, message) => {
                toast.custom((t) => (
                  <div style={{
                    background: 'white', padding: '12px 16px', borderRadius: '8px', 
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', borderLeft: type === 'QUERY' ? '4px solid #ef4444' : '4px solid #10b981',
                    display: 'flex', gap: '12px', alignItems: 'center', maxWidth: '350px'
                  }}>
                    {type === 'QUERY' ? <AlertTriangle color="#ef4444" size={24} /> : <CheckCircle color="#10b981" size={24} />}
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: 0, fontSize: '12px', color: '#1e293b', fontWeight: 700 }}>
                        {type === 'QUERY' ? 'ICEGATE Query Raised!' : 'Status Update'}
                      </h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#64748b' }}>
                        {message}
                      </p>
                    </div>
                    <button 
                      onClick={() => { toast.dismiss(t.id); onOpenJob(job.id); }}
                      style={{ padding: '4px 8px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', color: '#0f172a' }}
                    >
                      View
                    </button>
                  </div>
                ), { duration: 6000 });
              };

              if (!oldJob.beNo && newJob.beNo) {
                triggerAdvancedAlert('SUCCESS', newJob, `BE No ${newJob.beNo} generated for Job ${newJob.jobNo}!`);
              }
              if (oldJob.macroStatus !== newJob.macroStatus) {
                if (newJob.macroStatus === 'QUERY') triggerAdvancedAlert('QUERY', newJob, `Customs requires attention on Job ${newJob.jobNo}.`);
                else if (newJob.macroStatus === 'OOC') triggerAdvancedAlert('SUCCESS', newJob, `Clearance (OOC) Issued for Job ${newJob.jobNo}!`);
                else toast.success(`Job ${newJob.jobNo} moved to ${newJob.macroStatus}`, { style: { fontSize: '12px' } });
              }
            }
          });
        }
        
        pipelineRef.current = data.recentJobs || [];
        setPipeline(data.recentJobs || []);
        setTat(data.averageTat || 0);
        setTatCount(data.tatCount || 0);
        setActivity(data.activity || []);
      } else {
          setStats({ draft: 0, pending: 0, queries: 0, ooc: 0 });
          setPipeline([]);
          setTat(0);
        }
      } catch (err) {
        console.error(err);
        setStats({ draft: 0, pending: 0, queries: 0, ooc: 0 });
        setPipeline([]);
          setTat(0);
      } finally {
      setLoading(false);
    }
  };

  const pieData = [
    { name: 'Draft', value: stats.draft, color: '#0284c7' },
    { name: 'Filed', value: stats.pending, color: '#eab308' },
    { name: 'Queries', value: stats.queries, color: '#e11d48' },
    { name: 'Cleared', value: stats.ooc, color: '#65a30d' }
  ];

  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);
  // OOC message to the importer through the WhatsApp module (the old button called a dummy route that always said "sent")
  const sendWhatsapp = async (job) => {
    const mobile = await askText({ title: 'Send OOC on WhatsApp', message: `Job ${job.jobNo}: OOC message to ${job.importerName || 'the importer'}.`, label: 'WhatsApp number (with country code)', value: job.importerPhone || '', placeholder: 'e.g. 919812345678', okLabel: 'Send' });
    if (!mobile || !mobile.trim()) return;
    const text = `Job ${job.jobNo}: Bill of Entry ${job.beNo || ''}${job.beDate ? ' dt ' + dmy(job.beDate) : ''} is cleared - Out of Charge (OOC) given by Customs.`;
    try {
      const r = await fetch('/api/whatsapp/send-status', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partyName: job.importerName || '', mobileNumber: mobile.trim(), awbNumber: job.hawbNo || job.mawbNo || job.beNo || job.jobNo, statusText: text }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.success !== false) toast.success('WhatsApp sent to ' + mobile.trim()); else toast.error('WhatsApp not sent: ' + (d.error || r.statusText || 'check Settings > WhatsApp'));
    } catch (e) { toast.error('WhatsApp not sent: ' + e.message); }
  };

  return (
    <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: '1.5rem', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT COLUMN */}
        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
          
          {/* Stats Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            {[
              { label: 'DRAFT JOBS', value: stats.draft, icon: FileText, bg: '#0284c7', textColor: '#ffffff', filter: 'DRAFT', tip: 'Not sent to ICEGATE yet' },
              { label: 'FILED - AWAITING OOC', value: stats.pending, icon: Plane, bg: '#eab308', textColor: '#0f172a', filter: 'FILED', tip: 'Sent to ICEGATE / BE No received, OOC not yet' },
              { label: 'QUERIES RAISED', value: stats.queries, icon: AlertTriangle, bg: '#e11d48', textColor: '#ffffff', filter: 'QUERY', tip: 'Customs query open' },
              { label: 'OOC ISSUED', value: stats.ooc, icon: CheckCircle, bg: '#65a30d', textColor: '#ffffff', filter: 'OOC', tip: 'Out of charge copy received' },
            ].map((stat, i) => (
              <div key={i} title={stat.tip + ' - click to list them'} onClick={() => { setActiveFilter(stat.filter); setDeepFilter('ALL'); }} style={{ cursor: 'pointer', outline: activeFilter === stat.filter ? '3px solid rgba(15,23,42,0.35)' : 'none', outlineOffset: '2px', 
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
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* TAT KPI Banner */}
          <div style={{ background: '#e0e7ff', padding: '8px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', color: '#3730a3', fontSize: '12px', fontWeight: 600, width: '100%', boxSizing: 'border-box' }}>
            <Clock size={14} /> Average Clearance TAT (Today): {tatCount > 0 ? `${tat} hours from job creation to OOC, ${tatCount} clearance(s) (${tat < 24 ? 'Excellent' : 'Needs Attention'})` : 'No Clearances Today'}
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
                  <option value="ALL">ALL STATUSES (DEEP FILTER)</option>
                  {[...new Set(pipeline.flatMap(j => [j.status, j.icegateStatus]))].filter(Boolean).map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>

                {[
                  { id: 'ALL', label: 'All Jobs' },
                  { id: 'QUERY', label: 'Queries (Urgent)' },
                  { id: 'FILED', label: 'Filed (Awaiting OOC)' },
                  { id: 'DRAFT', label: 'Drafts' },
                  { id: 'OOC', label: 'Cleared (OOC)' }
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
              const filteredPipeline = pipeline.filter(job => 
                (activeFilter === 'ALL' || job.macroStatus === activeFilter) && 
                (deepFilter === 'ALL' || job.status === deepFilter || job.icegateStatus === deepFilter)
              );
              
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
                  }} onClick={() => onOpenJob(job.id)} title="Open this job"
                     onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                     onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '12px', color: '#0f172a', fontWeight: 700 }}>{job.jobNo || 'DRAFT'}</h4>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{dmy(job.jobDate) || 'Recent'} · {job.mode}{job.boeType && job.boeType !== 'HOME_CONSUMPTION' ? ' · ' + job.boeType.replace('_', '-') : ''}</div>
                      </div>
                      <span title={job.icegateStatus ? 'ICEGATE: ' + job.icegateStatus : job.status} style={{ 
                        padding: '2px 8px', borderRadius: '999px', fontSize: '9px', fontWeight: 700,
                        background: (STAGE[job.macroStatus] || STAGE.DRAFT).bg, color: (STAGE[job.macroStatus] || STAGE.DRAFT).fg
                      }}>
                        {(STAGE[job.macroStatus] || STAGE.DRAFT).label}
                      </span>
                    </div>
                    
                    <div style={{ fontSize: '11px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={job.importerName}><strong>Importer:</strong> {job.importerName || job.importer || 'N/A'}</div>
                      {(job.mawbNo || job.hawbNo) && <div style={{ fontSize: '10px', color: '#64748b' }}>{job.mawbNo ? 'MAWB/BL ' + job.mawbNo : ''}{job.hawbNo ? ' · HAWB/HBL ' + job.hawbNo : ''}</div>}
                      {job.beNo && (
                        <div style={{ color: '#0369a1', fontWeight: 600, background: '#f0f9ff', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', alignSelf: 'flex-start' }}>
                          BE No: {job.beNo}{job.beDate ? ' dt ' + dmy(job.beDate) : ''}
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpenJob(job.id); }}
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
                      {job.macroStatus === 'OOC' && (
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); sendWhatsapp(job); }}
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
                  {riskJobs && riskJobs.length > 0 ? (
                    riskJobs.map((rJob, idx) => (
                      <div 
                        key={idx}
                        onMouseEnter={() => setHoveredRadar(rJob.jobNo)} 
                        onMouseLeave={() => setHoveredRadar(null)}
                        style={{ 
                          background: hoveredRadar === rJob.jobNo ? '#f8fafc' : 'white', 
                          padding: '10px', borderRadius: '6px', borderLeft: `4px solid ${rJob.color || '#ef4444'}`, 
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                          cursor: 'pointer', 
                          boxShadow: hoveredRadar === rJob.jobNo ? '0 4px 12px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.05)',
                          transform: hoveredRadar === rJob.jobNo ? 'translateY(-2px)' : 'translateY(0)',
                          transition: 'all 0.2s ease'
                        }} 
                        onClick={() => { setSelectedCalcJob({ jobNo: rJob.jobNo, mode: rJob.mode || 'SEA' }); setCalcOpen(true); }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{rJob.jobNo} {rJob.mode ? `(${rJob.mode})` : ''}
                            {rJob.id && <span onClick={(e) => { e.stopPropagation(); onOpenJob(rJob.id); }} style={{ marginLeft: '6px', fontSize: '10px', color: '#4f46e5', fontWeight: 600 }}>Open</span>}</div>
                          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', textTransform: 'uppercase' }}>{rJob.riskType || 'Penalty Warning!'}</div>
                        </div>
                        <Calculator size={14} color={rJob.color || '#ef4444'} />
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '20px 0', textAlign: 'center', color: '#10b981', fontSize: '12px', fontWeight: 600, background: '#ecfdf5', borderRadius: '6px', border: '1px dashed #6ee7b7' }}>
                      <CheckCircle size={20} color="#10b981" style={{ marginBottom: '8px', opacity: 0.8 }} />
                      <div>ALL CLEAR</div>
                      <div style={{ fontSize: '10px', color: '#34d399', marginTop: '4px' }}>No Pending Penalties</div>
                    </div>
                  )}
                </div>
              </div>

            {/* Job Distribution Chart */}
          <div style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={14} color="#64748b" /> Job Distribution
            </h3>
            {pieTotal === 0 ? <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>No jobs yet.</div> : <>
            <div style={{ height: '140px', width: '100%', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{pieTotal}</div><div style={{ fontSize: '9px', color: '#64748b' }}>JOBS</div>
              </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 10px', marginTop: '8px' }}>
              {pieData.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#475569' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: d.color }} />{d.name}<b style={{ marginLeft: 'auto', color: '#0f172a' }}>{d.value}</b>
                </div>
              ))}
            </div>
            </>}
          </div>

          {/* Live Activity Timeline */}
          <div style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', flex: 1 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={14} color="#64748b" /> Recent Activity
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative' }}>
              {/* Timeline vertical line */}
              <div style={{ position: 'absolute', left: '4px', top: '4px', bottom: '4px', width: '2px', background: '#e2e8f0' }}></div>
              
              {activity.map((a, idx) => (
                <div key={idx} onClick={() => onOpenJob(a.id)} title="Open this job" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', position: 'relative', zIndex: 1, cursor: 'pointer' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4f46e5', border: '2px solid white', marginTop: '2px', flexShrink: 0 }}></div>
                  <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>Job {a.jobNo || 'Draft'}</span>: {a.text}
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>{ago(a.at)}</div>
                  </div>
                </div>
              ))}
              {activity.length === 0 && (
                <div style={{ fontSize: '11px', color: '#94a3b8', paddingLeft: '16px' }}>No recent activity.</div>
              )}
            </div>
          </div>

        </div>

      </div>
      <PenaltyCalculator isOpen={calcOpen} onClose={() => setCalcOpen(false)} job={selectedCalcJob} />
    </div>
  );
}
