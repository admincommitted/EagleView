import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Briefcase, Clock, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, Search, FileText, Pin } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState([]);
  const [recentJobs, setRecentJobs] = useState([]);
  const [expiringAssets, setExpiringAssets] = useState([]);
  const navigate = useNavigate();
  const [jobFilter, setJobFilter] = useState('');
  const shownJobs = recentJobs.filter(j => !jobFilter || [j.jobNo, j.boeType, j.importerName, j.igmNo]
    .some(v => String(v || '').toLowerCase().includes(jobFilter.toLowerCase())));
  const exportJobsExcel = async () => {
    if (!shownJobs.length) { return; }
    const XLSX = await import('xlsx');
    const rows = shownJobs.map(j => ({ 'Job No': j.jobNo, Type: j.boeType, Importer: j.importerName || '', 'IGM No': j.igmNo || '',
      Date: j.jobDate ? new Date(j.jobDate).toLocaleDateString('en-GB') : '', Status: j.status || '' }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Recent jobs');
    XLSX.writeFile(wb, 'recent-jobs-' + new Date().toISOString().slice(0, 10) + '.xlsx');
  };

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/assets/alerts/expiring', { headers: { Authorization: `Bearer ${token}` }});
        setExpiringAssets(res.data);
      } catch (err) {
        console.error("Alerts error:", err);
      }
    }
    fetchAlerts();
  }, []);
  
  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#94a3b8'];

  useEffect(() => {
    fetch('/api/dashboard/live-tracking')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const s = data.summary;
          // 17-Nov-2026: the summary has no assessed / duty_paid counts (undefined + numbers = NaN on the card); it sends total
          const n = (v) => Number(v) || 0;
          const total = s.total !== undefined ? n(s.total) : n(s.draft) + n(s.submitted) + n(s.query_raised) + n(s.assessed) + n(s.duty_paid) + n(s.ooc);
          
          setStats([
            { title: 'Total Jobs', value: total, icon: <Briefcase size={20} color="#0ea5e9" />, trend: 'Live', trendUp: true },
            { title: 'Pending Submissions', value: s.draft, icon: <Clock size={20} color="#f59e0b" />, trend: 'Action', trendUp: false },
            { title: 'Queries Raised', value: s.query_raised, icon: <AlertTriangle size={20} color="#ef4444" />, trend: 'Attention', trendUp: false },
            { title: 'OOC Given', value: s.ooc, icon: <CheckCircle size={20} color="#10b981" />, trend: 'Cleared', trendUp: true }
          ]);
          setRecentJobs(data.recentJobs || []);
        }
      })
      .catch(err => console.error(err));
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'DRAFT': return { bg: '#f1f5f9', text: '#64748b' };
      case 'SUBMITTED': return { bg: '#e0f2fe', text: '#0284c7' };
      case 'QUERY_RAISED': return { bg: '#fef2f2', text: '#ef4444' };
      case 'ASSESSED': return { bg: '#f3e8ff', text: '#9333ea' };
      case 'DUTY_PAID': return { bg: '#fffbeb', text: '#d97706' };
      case 'OOC': return { bg: '#ecfdf5', text: '#10b981' };
      default: return { bg: '#f1f5f9', text: '#64748b' };
    }
  };

  return (
    <div style={{ padding: '0.5rem', background: 'var(--bg-app, var(--bg-app, #f8fafc))', minHeight: '100%', borderRadius: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main, var(--text-main, #0f172a))', letterSpacing: '-0.5px' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-muted, var(--text-muted, #64748b))', marginTop: '0.25rem', fontSize: '13px' }}>Welcome back. Here is the operational overview.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" value={jobFilter} onChange={e => setJobFilter(e.target.value)} placeholder="Search job no / importer / IGM" style={{ padding: '0.5rem 1rem 0.5rem 2.25rem', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', fontSize: '13px', width: '250px', outline: 'none' }} />
          </div>
          <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', boxShadow: '0 4px 12px rgba(14,165,233,0.3)', border: 'none', padding: '0.5rem 1.25rem', fontWeight: 600 }} onClick={() => navigate('/job-entry')}>
            + New Job
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        {stats.map((stat, i) => (
          <div key={i} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
            {/* Subtle Gradient Background */}
            <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: stat.trendUp ? 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(239,68,68,0.1) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}></div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '12px', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5)' }}>
                {stat.icon}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: stat.trendUp ? '#10b981' : '#ef4444', background: stat.trendUp ? '#ecfdf5' : '#fef2f2', padding: '4px 8px', borderRadius: '20px' }}>
                {stat.trendUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {stat.trend}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>{stat.title}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main, var(--text-main, #0f172a))', marginTop: '0.25rem', letterSpacing: '-0.5px' }}>{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      
      {/* Warranty Alerts */}
      {expiringAssets.length > 0 && (
      <div style={{ background: '#fffbeb', padding: '1.5rem', borderRadius: '16px', border: '1px solid #fde68a', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#b45309', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={18} color="#f59e0b" />
          Expiring Asset Warranties
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {expiringAssets.map(asset => {
                const days = Math.ceil((new Date(asset.warrantyExpiryDate) - new Date()) / (1000 * 60 * 60 * 24));
                const isExpired = days < 0;
                return (
                    <div key={asset.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'white', borderLeft: `4px solid ${isExpired ? '#ef4444' : '#f59e0b'}`, borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                        <div>
                            <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block', marginBottom: '4px' }}>{asset.assetName}</strong>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>Assigned: {asset.assignedTo || 'Unassigned'}</span>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: isExpired ? '#ef4444' : '#d97706', display: 'flex', alignItems: 'center' }}>
                            {isExpired ? 'Expired' : `${days} Days Left`}
                        </div>
                    </div>
                )
            })}
        </div>
      </div>
      )}

      {/* Live ICEGATE Pipeline */}
      <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>Live ICEGATE Pipeline / Job Tracking</h2>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            {/* 30-Oct-2026: both buttons did nothing. Filtering now runs off the header search box;
                Export Excel writes exactly the rows on screen. */}
            <button className="btn btn-secondary" onClick={exportJobsExcel}>Export Excel</button>
          </div>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Job No</th>
                <th style={{ padding: '0.75rem 1rem' }}>BOE Type</th>
                <th style={{ padding: '0.75rem 1rem' }}>Importer</th>
                <th style={{ padding: '0.75rem 1rem' }}>IGM No</th>
                <th style={{ padding: '0.75rem 1rem' }}>Job Date</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {shownJobs.map((job) => {
                const colors = getStatusColor(job.status);
                return (
                  <tr key={job.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--primary-color-start)' }}>{job.jobNo}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{job.boeType}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{job.importerName || 'N/A'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{job.igmNo || 'N/A'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{new Date(job.jobDate).toLocaleDateString('en-GB')}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ 
                        background: colors.bg, 
                        color: colors.text, 
                        padding: '4px 8px', 
                        borderRadius: '20px', 
                        fontWeight: 600, 
                        fontSize: '11px' 
                      }}>
                        {job.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {recentJobs.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No recent jobs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
