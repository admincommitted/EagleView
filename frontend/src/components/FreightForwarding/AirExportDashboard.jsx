import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, FileText, CheckCircle2, User, Settings, Home, HelpCircle, LogOut, Plane, CheckCircle , Mail, Phone , Info, BarChart2, Bell, Newspaper, ExternalLink, Clock, ChevronRight } from 'lucide-react';
import AirExportActionTabs from './AirExportActionTabs';
import { AIRLINE_MASTER } from './mastersData';
import SftpStatusBadge from '../common/SftpStatusBadge';
import AirExportInsights from './AirExportInsights';

export default function AirExportDashboard() {
  // 29-Oct-2026: cards count by stage from the server (before: total / submitted / not-departed / delivered were shown
  // under the wrong headings, e.g. REJECTED showed every AWB not yet departed)
  const [stats, setStats] = useState({ saved: 0, submitted: 0, rejected: 0, ready: 0 });
  const [stageFilter, setStageFilter] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
    const navigate = useNavigate();
  
  
    
  // Live Database Fetch
  const refreshStats = async () => {
    setIsRefreshing(true);
    await fetch('/api/masters/airlines?all=1').then(r=>r.json()).then(d=>{ window.__AIRLINES__=d; fetchData(); }).catch(fetchData);
    // Simulate minor delay for UI spin effect
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  
  const panelStyle = {
    border: '1px solid #000000',
    borderRadius: '6px',
    background: 'white',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    overflow: 'hidden'
  };

  const headerStyle = {
    background: '#ffffff',
    padding: '12px 16px',
    borderBottom: '1px solid #e2e8f0',
    color: 'var(--text-main, var(--text-main, #0f172a))',
    fontWeight: 'bold',
    fontSize: '12px',
    textTransform: 'uppercase'
  };

  const [tableData, setTableData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  
  useEffect(() => { fetch('/api/masters/airlines?all=1').then(r=>r.json()).then(d=>{ window.__AIRLINES__=d; fetchData(); }).catch(fetchData); }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/awb/list?limit=1000');
      const json = await res.json();
      const arr = (json.success && Array.isArray(json.data)) ? json.data : [];
      const kpi = json.kpi || {};
      const typeMap = { 'MAWB': 'M', 'HAWB': 'H', 'AWB': 'A' };
      const bgMap = { 'MAWB': '#e0e7ff', 'HAWB': '#fef3c7', 'AWB': '#dcfce7' };
      const textMap = { 'MAWB': '#4338ca', 'HAWB': '#b45309', 'AWB': '#15803d' };
      const borderMap = { 'MAWB': '#a5b4fc', 'HAWB': '#fcd34d', 'AWB': '#86efac' };
      setTableData(arr.map(a => ({
        id: a.id,
        docType: a.type,
        type: typeMap[a.type] || 'A',
        bgCol: bgMap[a.type] || '#dcfce7',
        textCol: textMap[a.type] || '#15803d',
        borderCol: borderMap[a.type] || '#86efac',
        awb: a.awbNumber || '',
        hawb: a.type === 'HAWB' ? (a.hawbNumber || '') : '',
        stage: a.stage || 'SAVED',
        submitted: !!a.submittedToAirline,
        fna: a.fna, fma: a.fma, foh: a.foh, rcs: a.rcs, dep: a.dep, arr: a.arr, tfd: a.tfd, rcf: a.rcf, nfd: a.nfd, dlv: a.dlv,
        shipper: a.shipperName || '-',
        consignee: a.consigneeName || '-'
      })));
      setStats({
        saved: kpi.savedNotSubmitted ?? 0,
        submitted: kpi.submittedPendingRcs ?? 0,
        rejected: kpi.rejected ?? 0,
        ready: kpi.readyForCarriage ?? 0
      });
    } catch (err) {
      console.error("Failed to fetch AWBs:", err);
    }
  };

  // table rows: a clicked card filters the table to that stage (click again to show all)
  const visibleRows = stageFilter ? tableData.filter(r => r.stage === stageFilter) : tableData;
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / itemsPerPage));
  const pickStage = (st) => { setStageFilter(prev => (prev === st ? '' : st)); setCurrentPage(1); };
  const openRow = (row) => {
    if (row.docType === 'HAWB') navigate('/freight/create-hawb', { state: { loadAwbNumber: row.hawb } });
    else if (row.docType === 'MAWB') navigate('/freight/create-mawb', { state: { loadAwbNumber: row.awb } });
    else navigate('/freight/create-awb', { state: { loadAwbNumber: row.awb } });
  };
  const fmtWhen = (v) => { const d = new Date(v); return isNaN(d) ? String(v) : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };
  const mile = (v, bad) => (v ? <span title={fmtWhen(v)} style={{ color: bad ? '#dc2626' : '#059669', fontWeight: 700 }}>{bad ? '✕' : '✓'}</span> : null);
  const STAGE_LABEL = { SAVED: 'Saved', SUBMITTED: 'Submitted', REJECTED: 'Rejected', READY_FOR_CARRIAGE: 'Ready for carriage', DEPARTED: 'Departed', DELIVERED: 'Delivered' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'transparent', position: 'relative', zIndex: 1 }}>
      
      <style>
        {`
          @keyframes spin-anim {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin-icon {
            animation: spin-anim 1s linear infinite;
          }
          .table-row-hover {
            transition: background-color 0.2s ease;
          }
          .table-row-hover:hover {
            background-color: #f0f9ff !important;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.05), inset 0 -2px 4px rgba(0,0,0,0.05) !important;
          }
          .kpi-card-float {
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
          }
          .kpi-card-float:hover {
            transform: translateY(-8px);
            box-shadow: 0 12px 20px -3px rgba(0,0,0,0.15);
          }
          @keyframes pulse-red {
            0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
            70% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
            100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
          }
          .breaking-dot {
            animation: pulse-red 2s infinite;
          }
          .news-scroll::-webkit-scrollbar {
            width: 6px;
          }
          .news-scroll::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 4px;
          }
          .news-scroll::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }
          .news-scroll::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
        `}
      </style>

      <AirExportActionTabs activeTab="dashboard" />

      <div style={{ padding: '16px 0px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>

      {/* Top Banner Message */}
      <div style={{ 
        display: 'flex', alignItems: 'center', gap: '12px',
        background: 'linear-gradient(to right, #eff6ff, #ffffff)', 
        padding: '12px 20px', 
        border: '1px solid #bfdbfe',
        borderLeft: '4px solid #3b82f6',
        color: '#1e40af', 
        fontSize: '13px', 
        fontWeight: '700', 
        borderRadius: '6px', 
        boxShadow: '0 2px 4px rgba(59, 130, 246, 0.05)',
        width: 'fit-content', 
        textTransform: 'uppercase',
        letterSpacing: '0.3px'
      }}>
        <div style={{ background: '#dbeafe', padding: '6px', borderRadius: '50%', display: 'flex' }}>
          <Info size={18} color="#2563eb" />
        </div>
        <span>You can use EagleView 360 to send e-AWBs, and also you can generate laser-printed/plain paper AWBs.</span>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {/* Blue Card */}
        <div className="kpi-card-float" onClick={() => pickStage('SAVED')} title="Click to show only these in the table" style={{ cursor: 'pointer', outline: stageFilter === 'SAVED' ? '3px solid #0f172a' : 'none', outlineOffset: '2px',  background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: 'white', padding: '16px', borderRadius: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', minHeight: '120px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.05em' }}>SAVED NOT SUBMITTED</div>
          <div style={{ alignSelf: 'flex-end', fontSize: '48px', fontWeight: 'bold', lineHeight: '1', transition: 'all 0.5s' }}>{stats.saved}</div>
          <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} onClick={(e) => { e.stopPropagation(); refreshStats(); }} style={{ position: 'absolute', top: '16px', right: '16px', cursor: 'pointer' }} />
          <div style={{ position: 'absolute', top: '20px', left: '20px', opacity: 0.1, transform: 'scale(4)' }}><FileText /></div>
        </div>

        {/* Yellow Card */}
        <div className="kpi-card-float" onClick={() => pickStage('SUBMITTED')} title="Click to show only these in the table" style={{ cursor: 'pointer', outline: stageFilter === 'SUBMITTED' ? '3px solid #0f172a' : 'none', outlineOffset: '2px',  background: 'linear-gradient(135deg, #facc15, #eab308)', color: 'var(--text-main, var(--text-main, #1e293b))', padding: '16px', borderRadius: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', minHeight: '120px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.05em' }}>SUBMITTED AND PENDING RCS</div>
          <div style={{ alignSelf: 'flex-end', fontSize: '48px', fontWeight: 'bold', lineHeight: '1', transition: 'all 0.5s' }}>{stats.submitted}</div>
          <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} onClick={(e) => { e.stopPropagation(); refreshStats(); }} style={{ position: 'absolute', top: '16px', right: '16px', cursor: 'pointer' }} />
          <div style={{ position: 'absolute', top: '20px', left: '20px', opacity: 0.1, transform: 'scale(4)' }}>✈</div>
        </div>

        {/* Red Card */}
        <div className="kpi-card-float" onClick={() => pickStage('REJECTED')} title="Click to show only these in the table" style={{ cursor: 'pointer', outline: stageFilter === 'REJECTED' ? '3px solid #0f172a' : 'none', outlineOffset: '2px',  background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: 'white', padding: '16px', borderRadius: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', minHeight: '120px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.05em' }}>REJECTED</div>
          <div style={{ alignSelf: 'flex-end', fontSize: '48px', fontWeight: 'bold', lineHeight: '1', transition: 'all 0.5s' }}>{stats.rejected}</div>
          <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} onClick={(e) => { e.stopPropagation(); refreshStats(); }} style={{ position: 'absolute', top: '16px', right: '16px', cursor: 'pointer' }} />
          <div style={{ position: 'absolute', top: '20px', left: '20px', opacity: 0.1, transform: 'scale(4)', fontWeight: 'bold' }}>A-</div>
        </div>

        {/* Green Card */}
        <div className="kpi-card-float" onClick={() => pickStage('READY_FOR_CARRIAGE')} title="Click to show only these in the table" style={{ cursor: 'pointer', outline: stageFilter === 'READY_FOR_CARRIAGE' ? '3px solid #0f172a' : 'none', outlineOffset: '2px',  background: 'linear-gradient(135deg, #84cc16, #65a30d)', color: 'white', padding: '16px', borderRadius: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', minHeight: '120px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.05em' }}>READY FOR CARRIAGE</div>
          <div style={{ alignSelf: 'flex-end', fontSize: '48px', fontWeight: 'bold', lineHeight: '1', transition: 'all 0.5s' }}>{stats.ready}</div>
          <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} onClick={(e) => { e.stopPropagation(); refreshStats(); }} style={{ position: 'absolute', top: '16px', right: '16px', cursor: 'pointer' }} />
          <div style={{ position: 'absolute', top: '20px', left: '20px', opacity: 0.1, transform: 'scale(4)' }}><CheckCircle size={48} /></div>
        </div>
      </div>

      {/* Alerts, AWB stock, business numbers, activity, connection (29-Oct-2026) */}
      <AirExportInsights />

      {/* Recent Transactions Status */}
      <div className="modern-panel" style={{ ...panelStyle, flex: 1 }}>
        <div style={{ ...headerStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Recent Transactions Status</span>
          <SftpStatusBadge />
        </div>
        
        <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)', textTransform: 'uppercase' }}>
            SHOW 
            <select className="input-field" value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} style={{ width: '60px', padding: '2px 4px', border: '1px solid #000000' }}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            ENTRIES
            {stageFilter && <span style={{ marginLeft: '12px', background: '#0f172a', color: '#fff', padding: '2px 8px', borderRadius: '10px', cursor: 'pointer' }} onClick={() => pickStage(stageFilter)}>{STAGE_LABEL[stageFilter]} ✕</span>}
            <span style={{ marginLeft: 'auto', fontWeight: 'normal', textTransform: 'none', color: '#64748b' }}>Double-click a row to open it</span>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px', flex: 1 }}>
            <table style={{ minWidth: '100%', width: 'max-content', borderCollapse: 'collapse', fontSize: '11px', minWidth: '1400px', tableLayout: 'auto', whiteSpace: 'nowrap' }}>
              <thead style={{ background: '#f8fafc', color: 'var(--text-main, #0f172a)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>
                <tr>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>Document Type</th>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>AWB/Master AWB Number</th>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>House Waybill Number</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>Saved</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>Submitted to Airline</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>FNA</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>FMA</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>FOH</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>RCS</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>DEP</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>ARR</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>TFD</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>RCF</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>NFD</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>DLV</th>
                  <th style={{ padding: '8px', textAlign: 'left', minWidth: '150px', borderBottom: '1px solid #e2e8f0' }}>Exporter Name</th>
                  <th style={{ padding: '8px', textAlign: 'left', minWidth: '150px', borderBottom: '1px solid #e2e8f0' }}>Consignee Name</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((row, idx) => (
                    <tr key={row.docType + row.id} className="table-row-hover" onDoubleClick={() => openRow(row)} title={STAGE_LABEL[row.stage] || ''} style={{ cursor: 'pointer',  background: idx % 2 === 0 ? 'var(--bg-panel, var(--bg-panel, #ffffff))' : 'var(--bg-app, var(--bg-app, #f8fafc))', borderBottom: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }} >
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '4px', background: row.bgCol, color: row.textCol, border: `1px solid ${row.borderCol}`, fontWeight: 'bold', fontSize: '11px' }}>
                          {row.type}
                        </div>
                      </td>
                      <td style={{ padding: '8px', color: 'black' }}>{row.awb}</td>
                      <td style={{ padding: '8px', color: 'black' }}>{row.hawb}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}><CheckCircle2 size={18} color="#0ea5e9" /></td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        {row.submitted && <CheckCircle2 size={18} color="#10b981" />}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{mile(row.fna, true)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{mile(row.fma)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{mile(row.foh)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{mile(row.rcs)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{mile(row.dep)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{mile(row.arr)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{mile(row.tfd)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{mile(row.rcf)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{mile(row.nfd)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{mile(row.dlv)}</td>
                      <td style={{ padding: '8px', color: 'black' }}>{row.shipper || '-'}</td>
                      <td style={{ padding: '8px', color: 'black' }}>{row.consignee || '-'}</td>
                    </tr>
                  ))}
                  {/* Fill empty space to reserve 5 rows */}
                  {Array.from({ length: Math.max(0, 5 - visibleRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).length) }).map((_, idx) => (
                      <tr key={`empty-${idx}`} style={{ height: '41px', borderBottom: '1px solid var(--bg-input, #f1f5f9)' }}>
                          <td colSpan="17"></td>
                      </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '11px', color: 'var(--text-main, #0f172a)', textTransform: 'uppercase' }}>
            <div>SHOWING {Math.min(visibleRows.length, (currentPage - 1) * itemsPerPage + 1)} TO {Math.min(visibleRows.length, currentPage * itemsPerPage)} OF {visibleRows.length} ENTRIES</div>
            <div style={{ display: 'flex', gap: '2px' }}>
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ padding: '4px 10px', border: '1px solid var(--border-color, #cbd5e1)', background: 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: '#334155' }}>&lt;</button>
              {Array.from({ length: Math.min(7, pageCount) }).map((_, idx) => {
                  // at most 7 page buttons, kept around the current page
                  const first = Math.min(Math.max(1, currentPage - 3), Math.max(1, pageCount - 6));
                  const p = first + idx;
                  return (
                      <button key={p} onClick={() => setCurrentPage(p)} style={{ padding: '4px 10px', border: p === currentPage ? '1px solid #000000' : '1px solid var(--border-color, #cbd5e1)', background: p === currentPage ? 'var(--text-main, var(--text-main, #0f172a))' : 'white', color: p === currentPage ? 'white' : '#334155', cursor: 'pointer', fontWeight: p === currentPage ? 'bold' : 'normal' }}>{p}</button>
                  )
              })}
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, pageCount))} disabled={currentPage === pageCount || visibleRows.length === 0} style={{ padding: '4px 10px', border: '1px solid var(--border-color, #cbd5e1)', background: 'white', cursor: (currentPage === pageCount || visibleRows.length === 0) ? 'not-allowed' : 'pointer', color: '#334155' }}>&gt;</button>
            </div>
          </div>
        </div>

      
      {/* Premium Support and Contact Information Footer */}
      <div style={{ 
        background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', 
        color: 'var(--bg-panel, var(--bg-panel, #ffffff))', 
        padding: '16px 24px', 
        marginTop: '16px', 
        borderRadius: '8px', 
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        border: '1px solid #000000'
      }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 10px rgba(255,255,255,0.1)' }}>
            <HelpCircle size={22} color="var(--bg-panel, var(--bg-panel, #ffffff))" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '0.05em', color: 'var(--bg-panel, var(--bg-panel, #ffffff))', textTransform: 'uppercase', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>IT & Operations Support</div>
            <div style={{ fontSize: '11px', color: '#dbeafe', marginTop: '2px' }}>24/7 dedicated assistance for your EDI workflows</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.15)', padding: '8px 16px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(4px)' }}>
            <Phone size={14} color="var(--bg-panel, var(--bg-panel, #ffffff))" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--bg-panel, var(--bg-panel, #ffffff))', letterSpacing: '0.05em' }}>+91 9654997939</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.15)', padding: '8px 16px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
            <Mail size={14} color="var(--bg-panel, var(--bg-panel, #ffffff))" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--bg-panel, var(--bg-panel, #ffffff))', letterSpacing: '0.05em' }}>admin@committedcargo.com</span>
          </div>
        </div>
      </div>

    </div>
    </div>
    </div>
  );
}