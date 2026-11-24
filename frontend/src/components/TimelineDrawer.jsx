import React, { useState, useEffect } from 'react';
import { X, Send, FileText, Hash, Calendar, User, Briefcase, MapPin, Clock, Trash2 } from 'lucide-react';

import toast from 'react-hot-toast';


export default function TimelineDrawer({ isOpen, onClose, jobId, module = 'IMPORT' }) {
  const [logs, setLogs] = useState([]);
  const [newRemark, setNewRemark] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [jobInfo, setJobInfo] = useState(null);
  const [dbStatuses, setDbStatuses] = useState([]);
  const [chaNames, setChaNames] = useState({}); // 14-Nov-2026: CHA code -> name for the Agent box

  // Fetch DB Statuses and compute Smart Statuses
  let masterStatuses = [];
  
  if (dbStatuses.length === 0) {
    // Fallback if DB not set up yet
    masterStatuses = module === 'EXPORT' 
      ? ['DRAFT', 'JOB CREATED', 'SUBMITTED TO ICEGATE', 'TD DONE', 'XRAY DONE', 'LEO RECEIVED', 'GATE PASS ISSUED', 'HANDOVER TO AIRLINE', 'DEPARTED', 'DELIVERED', 'CANCELLED'] 
      : ['DRAFT', 'JOB CREATED', 'SUBMITTED TO ICEGATE', 'QUERY RAISED', 'REPLY FILED', 'ASSESSMENT DONE', 'DUTY PENDING', 'DUTY PAID', 'OOC PENDING', 'OOC ISSUED', 'GATE PASS ISSUED', 'DELIVERED', 'CANCELLED'];
  } else {
    // 1. Find all statuses that are marked as "Enables" by ANY other status.
    // These should be HIDDEN BY DEFAULT until their parent is reached!
    const allEnables = new Set();
    dbStatuses.forEach(st => {
      if (st.enables) {
        st.enables.split(',').map(s => s.trim().toUpperCase()).forEach(es => allEnables.add(es));
      }
    });

    const pastRemarks = (logs || []).map(l => (l.message || '').toUpperCase().trim());
    let disabledSet = new Set();
    let triggeredEnables = new Set();

    // 2. See what has happened in the past
    dbStatuses.forEach(st => {
      if (pastRemarks.includes(st.code.toUpperCase())) {
        if (st.disables) {
          st.disables.split(',').map(s => s.trim().toUpperCase()).forEach(ds => disabledSet.add(ds));
        }
        if (st.enables) {
          st.enables.split(',').map(s => s.trim().toUpperCase()).forEach(es => triggeredEnables.add(es));
        }
      }
    });

    // 3. Build the final array respecting Sequence and Visibility
    const finalAllowed = dbStatuses.filter(st => {
      const code = st.code.toUpperCase();
      // If it's disabled by something in the past, hide it
      if (disabledSet.has(code)) return false;
      // If it's a special 'Enabled' exception, only show it if the trigger happened
      if (allEnables.has(code) && !triggeredEnables.has(code)) return false;
      return true;
    });

    // Since dbStatuses is already sorted by sequence, finalAllowed is also sorted!
    masterStatuses = finalAllowed.map(s => s.code);
  }

  // the user of the login token (the backend writes the same name as author); "user" in localStorage is not always set
  let loggedInUser = '';
  try { const t = localStorage.getItem('token'); if (t) loggedInUser = JSON.parse(atob(t.split('.')[1])).username || ''; } catch (e) { /* no token */ }
  if (!loggedInUser) { try { const u = JSON.parse(localStorage.getItem('user') || '{}'); loggedInUser = u.username || ''; } catch (e) { /* no user */ } }
  if (!loggedInUser) loggedInUser = 'User';

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const m8 = /^(\d{4})(\d{2})(\d{2})$/.exec(String(dateStr).trim()); // ICEGATE files give YYYYMMDD
      const d = m8 ? new Date(+m8[1], +m8[2] - 1, +m8[3]) : new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr; // fallback if invalid
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch(e) { return dateStr; }
  };


    useEffect(() => {
    fetch('/api/status-master')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const modStatuses = d.data.filter(s => s.module === module).sort((a,b) => (a.sequence || 0) - (b.sequence || 0));
          setDbStatuses(modStatuses);
        }
      }).catch(console.error);
  }, [module]);

  useEffect(() => {
    if (!isOpen || Object.keys(chaNames).length) return;
    fetch('/api/masters/cha-master').then(r => r.json()).then(d => {
      const arr = Array.isArray(d) ? d : (d && d.success ? d.data : []);
      const m = {}; (arr || []).forEach(c => { if (c && c.chaCode) m[String(c.chaCode).trim().toUpperCase()] = c.chaName || ''; });
      setChaNames(m);
    }).catch(() => {});
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isOpen && jobId) {
      // Clear immediately for fast UX
      setLogs([]);
      setJobInfo(null);
      fetchLogs();
      fetchJobInfo();
    }
  }, [isOpen, jobId]);

  const fetchJobInfo = async () => {
    try {
      const endpoint = module === 'EXPORT' ? `/api/export-jobs/${jobId}` : `/api/import-jobs/${jobId}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setJobInfo(data.data || data);
      }
    } catch (err) {
      console.error('Error fetching job info', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`/api/timeline/${module}/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  // A text picked from the status list is sent as a STATUS: the backend also sets the job status (dashboard / job list
  // follow it). Anything else is a plain remark. 28-Oct-2026
  const handleAddRemark = async (textOverride = null) => {
    const textToSubmit = String(typeof textOverride === 'string' ? textOverride : newRemark).trim();
    if (!textToSubmit) return;
    const isStatus = masterStatuses.some(s => String(s).toUpperCase() === textToSubmit.toUpperCase());
    setLoading(true);
    try {
      const payload = {
        jobId,
        module,
        eventType: isStatus ? 'STATUS' : 'REMARK',
        message: isStatus ? textToSubmit.toUpperCase() : textToSubmit,
        author: loggedInUser
      };
      
      const res = await fetch('/api/timeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        setNewRemark('');
        fetchLogs();
        if (d.statusUpdated) fetchJobInfo();
        if (d.statusUpdated) toast.success('Job status set to ' + d.statusUpdated.replace(/_/g, ' '));
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error('Failed to add remark' + (d.message ? ': ' + d.message : ''));
      }
    } catch (err) {
      toast.error('Error adding remark');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteRemark = async (log) => {
    if (!window.confirm('Delete this remark?')) return;
    try {
      const r = await fetch('/api/timeline/' + log.id, { method: 'DELETE' });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.success) fetchLogs(); else toast.error(d.message || 'Could not delete');
    } catch (e) { toast.error('Could not delete: ' + e.message); }
  };

  if (!isOpen) return null;

  // Calculate TAT
  // 14-Nov-2026: rows without a time are left out (an iCAFFE job's 'created' row had none, so the banner counted from 1970:
  // "Clearance delayed by 20771d"). An import job counts from the inward date (IGM) when the job has one; without it the
  // banner only shows the time since the job was made and never says DELAYED (a draft is not a delayed clearance).
  let tatBlock = null;
  const okTime = (v) => v && !isNaN(new Date(v).getTime());
  const timedLogs = logs.filter(l => okTime(l.timestamp));
  const inwardOf = (j) => {
    if (!j || module === 'EXPORT') return null;
    let v = j.inwardDate || j.autoField_17;
    if (!v) { try { const rows = typeof j._igmRows === 'string' ? JSON.parse(j._igmRows) : j._igmRows; const r = (rows || []).find(x => x && x.inwardDate); v = r && r.inwardDate; } catch (e) { /* no IGM rows */ } }
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  const inward = inwardOf(jobInfo);
  if (timedLogs.length > 0 || inward) {
    const sortedLogs = [...timedLogs].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    const startLog = sortedLogs[0];
    // Find if end status exists
    const endLog = sortedLogs.slice().reverse().find(l => {
        const msg = (l.message || '').toUpperCase();
        return msg.includes('GATE PASS') || msg.includes('DELIVERED') || msg.includes('OOC ISSUED') || msg.includes('OOC COPY RECEIVED');
    });
    const startTime = inward || new Date(startLog.timestamp);
    const endTime = endLog ? new Date(endLog.timestamp) : new Date();
    const diffMs = Math.max(0, endTime - startTime);
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffDays = Math.floor(diffHrs / 24);
    const remainingHrs = diffHrs % 24;
    let timeString = '';
    if (diffDays > 0) timeString += `${diffDays}d `;
    if (remainingHrs > 0) timeString += `${remainingHrs}h `;
    if (diffDays === 0) timeString += `${diffMins}m`;
    if (!timeString.trim()) timeString = 'Just now';
    const isComplete = !!endLog;
    const countsDelay = module === 'EXPORT' || !!inward;
    const isDelayed = !isComplete && countsDelay && diffHrs > 48;
    let bannerBg = isComplete ? '#dcfce7' : (isDelayed ? '#fee2e2' : '#fef9c3');
    let bannerText = isComplete ? '#166534' : (isDelayed ? '#991b1b' : '#854d0e');
    let bannerBorder = isComplete ? '#bbf7d0' : (isDelayed ? '#fecaca' : '#fef08a');
    let iconColor = isComplete ? '#22c55e' : (isDelayed ? '#ef4444' : '#eab308');
    let title = isComplete ? (inward ? 'Clearance time from inward:' : 'Total Clearance Time:') : (isDelayed ? (inward ? 'Delayed since inward by:' : 'Clearance Delayed By:') : (inward ? 'Time since inward:' : (module === 'EXPORT' ? 'Time Elapsed:' : 'Time since job created:')));
    tatBlock = (
      <div style={{ background: bannerBg, borderBottom: `1px solid ${bannerBorder}`, padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={14} color={iconColor} />
          <span style={{ fontSize: '11px', fontWeight: 600, color: bannerText, textTransform: 'uppercase' }}>{title}</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: bannerText }}>{timeString}</span>
        </div>
        {isComplete && <span style={{ fontSize: '9px', background: '#22c55e', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>CLEARED</span>}
        {!isComplete && isDelayed && <span style={{ fontSize: '9px', background: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>DELAYED</span>}
        {!isComplete && !isDelayed && <span style={{ fontSize: '9px', background: '#eab308', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>IN PROGRESS</span>}
      </div>
    );
  }

  return (
    <>

      <div style={{
      position: 'fixed',
      top: '76px', right: 0, bottom: '80px',
      width: '350px',
      background: '#f8fafc',
      boxShadow: '-4px 0 15px rgba(0,0,0,0.1)',
      zIndex: 999999,
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid #e2e8f0'
    }}>
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'white'
      }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 600 }}>Timeline & Logs</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
          <X size={20} />
        </button>
      </div>
        {tatBlock}

      {jobInfo && (
        <div style={{
          background: '#f8fafc',
          borderBottom: '1px solid #cbd5e1',
          padding: '10px 14px',
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '8px'
        }}>
          {/* Row 1 Left: Job No + Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
               <FileText size={12} color="#0ea5e9" />
               <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>JOB NO</span>
             </div>
             <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
               <span style={{ fontSize: '11px', color: '#0f172a', fontWeight: 700 }}>{jobInfo.jobNo || '-'}</span>
               {jobInfo.status && <span style={{ fontSize: '8px', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '6px', fontWeight: 700 }}>{String(jobInfo.status).replace(/_/g, ' ')}</span>}
               <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 500 }}>{jobInfo.jobDate ? formatDate(jobInfo.jobDate).split(' ')[0] + ' ' + formatDate(jobInfo.jobDate).split(' ')[1] + ' ' + formatDate(jobInfo.jobDate).split(' ')[2] : ''}</span>
             </div>
          </div>

          {/* Row 1 Right: BE/SB No + Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
               <Hash size={12} color="#8b5cf6" />
               <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>{module === 'EXPORT' ? 'SB NO' : 'BE NO'}</span>
             </div>
             <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
               <span style={{ fontSize: '11px', color: '#0f172a', fontWeight: 700 }}>{module === 'EXPORT' ? (jobInfo.sbNo || '-') : (jobInfo.beNumber || jobInfo.beNo || '-')}</span>
               <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 500 }}>
                 {module === 'EXPORT' ? (jobInfo.sbDate ? formatDate(jobInfo.sbDate).split(' ')[0] + ' ' + formatDate(jobInfo.sbDate).split(' ')[1] + ' ' + formatDate(jobInfo.sbDate).split(' ')[2] : '') : (jobInfo.beDate ? formatDate(jobInfo.beDate).split(' ')[0] + ' ' + formatDate(jobInfo.beDate).split(' ')[1] + ' ' + formatDate(jobInfo.beDate).split(' ')[2] : '')}
               </span>
             </div>
          </div>

          {/* Row 2 Left: Importer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
               <User size={12} color="#10b981" />
               <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>{module === 'EXPORT' ? 'EXPORTER' : 'IMPORTER'}</span>
             </div>
             <span style={{ fontSize: '11px', color: '#1e293b', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
               {module === 'EXPORT' ? (jobInfo.shipperName || jobInfo.exporterName || '-') : (jobInfo.autoField_4 || jobInfo.importerName || jobInfo.nameOfImporter || '-')}
             </span>
          </div>

          {/* Row 2 Right: Agent */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
               <Briefcase size={12} color="#f43f5e" />
               <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>AGENT</span>
             </div>
             <span style={{ fontSize: '11px', color: '#1e293b', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
               {(() => { const code = String(jobInfo.chaCode || jobInfo.autoField_3 || jobInfo.customHouseAgent || '').trim(); const nm = chaNames[code.toUpperCase()]; return code ? (nm ? <span title={code}>{nm}</span> : code) : '-'; })()}
             </span>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {!jobId && (
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginTop: '20px', lineHeight: 1.5 }}>
            No job selected.<br />
            <span style={{ fontSize: '0.75rem' }}>The timeline is kept per saved job: save this job (Job Header &gt; Save) or open one from 1. Job Query, then open Timeline Log again.</span>
          </div>
        )}
        {jobId && logs.length === 0 && (
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9rem', marginTop: '20px' }}>
            No timeline logs found.
          </div>
        )}
        {logs.map((log, idx) => {
            // the job's own events (created / saved / ICEGATE / BE No / OOC) - from the job itself, not remarks
            if (log.system) return (
              <div key={log.id || idx} style={{ alignSelf: 'center', fontSize: '0.7rem', color: '#64748b', background: '#eef2f7', borderRadius: '999px', padding: '3px 10px', textAlign: 'center', maxWidth: '95%' }}>
                {log.message} · {formatDate(log.timestamp)}
              </div>
            );
            const isMe = String(log.author || '').toUpperCase() === String(loggedInUser).toUpperCase() || log.author === 'User';
            
            const msg = (log.message || '').toUpperCase().trim();
            const masterStatus = [...dbStatuses]
              .sort((a, b) => (b.code?.length || 0) - (a.code?.length || 0))
              .find(s => msg.includes(s.code.toUpperCase()));
              
            let statusColor = '#94a3b8'; // fallback
            if (msg.includes('PENDING') || msg.includes('DRAFT')) statusColor = '#f59e0b';
            else if (msg.includes('PAID') || msg.includes('ISSUED') || msg.includes('DELIVERED') || msg.includes('DONE') || msg.includes('RECEIVED')) statusColor = '#10b981';
            else if (msg.includes('QUERY')) statusColor = '#ef4444';
            
            const bubbleStyle = masterStatus && masterStatus.bubbleStyle ? masterStatus.bubbleStyle : 'LEFT_BORDER';
            const baseBg = masterStatus && masterStatus.colorCode ? masterStatus.colorCode : (isMe ? '#e0f2fe' : 'white');
            const baseText = masterStatus && masterStatus.textColor ? masterStatus.textColor : '#0f172a';
            
            let dynamicStyles = {
              background: baseBg,
              padding: '8px 12px',
              borderRadius: '8px',
              borderBottomRightRadius: isMe ? '2px' : '8px',
              borderBottomLeftRadius: isMe ? '8px' : '2px',
              border: '1px solid',
              borderColor: masterStatus && masterStatus.textColor ? `${masterStatus.textColor}30` : (isMe ? '#bae6fd' : '#e2e8f0'),
              borderLeft: `4px solid ${masterStatus && masterStatus.textColor ? masterStatus.textColor : statusColor}`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              alignSelf: isMe ? 'flex-end' : 'flex-start',
              maxWidth: '90%',
              minWidth: '60%',
              position: 'relative'
            };

            let bubbleTextColor = baseText;

            if (bubbleStyle === 'SOLID') {
              dynamicStyles.background = masterStatus && masterStatus.colorCode ? masterStatus.colorCode : '#3b82f6';
              dynamicStyles.borderLeft = 'none';
              dynamicStyles.border = 'none';
              bubbleTextColor = masterStatus && masterStatus.textColor ? masterStatus.textColor : '#ffffff';
            } else if (bubbleStyle === 'OUTLINE') {
              dynamicStyles.background = 'transparent';
              dynamicStyles.borderLeft = 'none';
              dynamicStyles.border = `2px solid ${masterStatus && masterStatus.colorCode ? masterStatus.colorCode : '#3b82f6'}`;
              bubbleTextColor = masterStatus && masterStatus.textColor ? masterStatus.textColor : '#0f172a';
            } else if (bubbleStyle === 'GLOW') {
              dynamicStyles.background = masterStatus && masterStatus.colorCode ? masterStatus.colorCode : '#000000';
              dynamicStyles.borderLeft = 'none';
              dynamicStyles.border = 'none';
              dynamicStyles.boxShadow = `0 0 10px ${masterStatus && masterStatus.textColor ? masterStatus.textColor : '#38bdf8'}`;
              bubbleTextColor = masterStatus && masterStatus.textColor ? masterStatus.textColor : '#ffffff';
            } else if (bubbleStyle === 'DASHED') {
              dynamicStyles.background = 'transparent';
              dynamicStyles.borderLeft = 'none'; 
              dynamicStyles.border = `2px dashed ${masterStatus && masterStatus.colorCode ? masterStatus.colorCode : '#3b82f6'}`;
              bubbleTextColor = masterStatus && masterStatus.textColor ? masterStatus.textColor : '#0f172a';
            } else if (bubbleStyle === 'GRADIENT') {
              dynamicStyles.background = `linear-gradient(135deg, ${masterStatus && masterStatus.colorCode ? masterStatus.colorCode : '#3b82f6'}, ${masterStatus && masterStatus.colorCode ? masterStatus.colorCode : '#3b82f6'}80)`;
              dynamicStyles.borderLeft = 'none'; 
              dynamicStyles.border = 'none';
              bubbleTextColor = masterStatus && masterStatus.textColor ? masterStatus.textColor : '#ffffff';
            } else if (bubbleStyle === 'BOTTOM_BORDER') {
              dynamicStyles.background = 'white';
              dynamicStyles.borderLeft = 'none'; 
              dynamicStyles.border = 'none';
              dynamicStyles.borderBottom = `4px solid ${masterStatus && masterStatus.colorCode ? masterStatus.colorCode : '#3b82f6'}`;
              bubbleTextColor = masterStatus && masterStatus.textColor ? masterStatus.textColor : '#0f172a';
            } else if (bubbleStyle === 'SOFT_SHADOW') {
              dynamicStyles.background = 'white';
              dynamicStyles.borderLeft = `4px solid ${masterStatus && masterStatus.colorCode ? masterStatus.colorCode : '#3b82f6'}`; 
              dynamicStyles.border = 'none';
              dynamicStyles.boxShadow = `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)`;
              bubbleTextColor = masterStatus && masterStatus.textColor ? masterStatus.textColor : '#0f172a';
            } else if (bubbleStyle === 'PILL') {
              dynamicStyles.background = masterStatus && masterStatus.colorCode ? masterStatus.colorCode : '#e0f2fe';
              dynamicStyles.borderLeft = 'none'; 
              dynamicStyles.border = `1px solid ${masterStatus && masterStatus.textColor ? masterStatus.textColor : '#3b82f6'}30`;
              dynamicStyles.borderRadius = '30px';
              bubbleTextColor = masterStatus && masterStatus.textColor ? masterStatus.textColor : '#0f172a';
            } else if (bubbleStyle === 'GLASSMORPHISM') {
              dynamicStyles.background = `${masterStatus && masterStatus.colorCode ? masterStatus.colorCode : '#ffffff'}80`;
              dynamicStyles.backdropFilter = 'blur(10px)';
              dynamicStyles.borderLeft = 'none'; 
              dynamicStyles.border = `1px solid ${masterStatus && masterStatus.colorCode ? masterStatus.colorCode : '#ffffff'}40`;
              dynamicStyles.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.1)';
              bubbleTextColor = masterStatus && masterStatus.textColor ? masterStatus.textColor : '#0f172a';
            } else if (bubbleStyle === 'MATERIAL_ACCENT') {
              dynamicStyles.background = '#f8fafc';
              dynamicStyles.borderLeft = `6px solid ${masterStatus && masterStatus.colorCode ? masterStatus.colorCode : '#3b82f6'}`; 
              dynamicStyles.borderTop = 'none'; dynamicStyles.borderRight = 'none'; dynamicStyles.borderBottom = 'none';
              dynamicStyles.borderRadius = '4px';
              dynamicStyles.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
              bubbleTextColor = masterStatus && masterStatus.textColor ? masterStatus.textColor : '#0f172a';
            } else if (bubbleStyle === 'NEUMORPHISM') {
              dynamicStyles.background = '#f1f5f9';
              dynamicStyles.borderLeft = 'none'; dynamicStyles.border = 'none';
              dynamicStyles.borderRadius = '12px';
              dynamicStyles.boxShadow = '5px 5px 10px #d9dddf, -5px -5px 10px #ffffff';
              bubbleTextColor = masterStatus && masterStatus.textColor ? masterStatus.textColor : '#334155';
            } else if (bubbleStyle === 'FOLDED_RIBBON') {
              dynamicStyles.background = masterStatus && masterStatus.colorCode ? masterStatus.colorCode : '#3b82f6';
              dynamicStyles.borderLeft = 'none'; dynamicStyles.border = 'none';
              dynamicStyles.borderTopLeftRadius = '0px'; dynamicStyles.borderBottomLeftRadius = '0px';
              dynamicStyles.borderTopRightRadius = '8px'; dynamicStyles.borderBottomRightRadius = '8px';
              dynamicStyles.boxShadow = '-4px 4px 0px rgba(0,0,0,0.1)';
              bubbleTextColor = masterStatus && masterStatus.textColor ? masterStatus.textColor : '#ffffff';
            } else if (bubbleStyle === 'HOLLOW_NEON') {
              dynamicStyles.background = '#0f172a';
              dynamicStyles.borderLeft = 'none'; 
              dynamicStyles.border = `1px solid ${masterStatus && masterStatus.textColor ? masterStatus.textColor : '#38bdf8'}`;
              dynamicStyles.boxShadow = `inset 0 0 8px ${masterStatus && masterStatus.textColor ? masterStatus.textColor : '#38bdf8'}40, 0 0 8px ${masterStatus && masterStatus.textColor ? masterStatus.textColor : '#38bdf8'}40`;
              bubbleTextColor = masterStatus && masterStatus.textColor ? masterStatus.textColor : '#38bdf8';
            }

            return (
            <div key={idx} style={dynamicStyles}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', alignItems: 'baseline', gap: '8px' }}>
                <strong style={{ fontSize: '0.65rem', color: bubbleTextColor, textTransform: 'uppercase' }}>{log.author === 'User' ? loggedInUser : log.author}</strong>
                <span style={{ 
                  fontSize: '0.60rem', 
                  color: (bubbleStyle === 'SOLID' || bubbleStyle === 'GLOW' || bubbleStyle === 'GRADIENT' || bubbleStyle === 'FOLDED_RIBBON') ? '#ffffff' : bubbleTextColor, 
                  background: (bubbleStyle === 'SOLID' || bubbleStyle === 'GLOW' || bubbleStyle === 'GRADIENT' || bubbleStyle === 'FOLDED_RIBBON') ? 'rgba(255,255,255,0.25)' : `${masterStatus && masterStatus.colorCode ? masterStatus.colorCode : '#0284c7'}15`, 
                  padding: '2px 6px', 
                  borderRadius: '10px', 
                  fontWeight: 'bold',
                  letterSpacing: '0.3px'
                }}>
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: bubbleTextColor, lineHeight: 1.2, wordBreak: 'break-word', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '8px', fontWeight: masterStatus ? '600' : 'normal' }}>
                <span>{log.eventType === 'STATUS' && <span style={{ fontSize: '0.6rem', opacity: 0.7, marginRight: '4px' }}>STATUS:</span>}{log.message}</span>
                <span style={{ fontSize: '0.55rem', color: bubbleTextColor, whiteSpace: 'nowrap', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}>
                   {log.timestamp ? new Date(log.timestamp).toLocaleDateString([], {day:'2-digit', month:'short'}) : ''}
                   {isMe && log.id && <Trash2 size={11} style={{ cursor: 'pointer' }} onClick={() => deleteRemark(log)} title="Delete this remark" />}
                </span>
              </div>
            </div>
          )})}
      </div>

      <div style={{
        padding: '16px',
        background: 'white',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          {showSuggestions && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0,
              background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px',
              maxHeight: '160px', overflowY: 'auto', boxShadow: '0 -4px 10px rgba(0,0,0,0.1)',
              zIndex: 10, marginBottom: '6px', padding: '4px 0'
            }}>
              {masterStatuses.filter(s => s.toLowerCase().includes(newRemark.toLowerCase())).map((st, i) => (
                   <div 
                     key={st}
                     id={`suggestion-item-${i}`}
                     onMouseDown={(e) => { e.preventDefault(); setNewRemark(st); setShowSuggestions(false); setSelectedIndex(-1); }}
                     style={{ 
                       padding: '8px 12px', 
                       fontSize: '0.85rem', 
                       cursor: 'pointer', 
                       borderBottom: '1px solid #f8fafc', 
                       color: selectedIndex === i ? '#0ea5e9' : '#334155', 
                       fontWeight: 500,
                       background: selectedIndex === i ? '#e0f2fe' : 'white'
                     }}
                     onMouseEnter={() => setSelectedIndex(i)}
                   >
                     {st}
                   </div>
                ))}
            </div>
          )}
          <input
              value={newRemark}
              onChange={e => { setNewRemark(e.target.value); setShowSuggestions(true); setSelectedIndex(-1); }}
              onFocus={() => { setShowSuggestions(true); setSelectedIndex(-1); }}
              onBlur={() => setShowSuggestions(false)}
              onKeyDown={e => {
                const filtered = masterStatuses.filter(s => s.toLowerCase().includes(newRemark.toLowerCase()));
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSelectedIndex(prev => {
                    const next = prev < filtered.length - 1 ? prev + 1 : prev;
                    setTimeout(() => { document.getElementById('suggestion-item-' + next)?.scrollIntoView({ block: 'nearest' }) }, 10);
                    return next;
                  });
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelectedIndex(prev => {
                    const next = prev > 0 ? prev - 1 : 0;
                    setTimeout(() => { document.getElementById('suggestion-item-' + next)?.scrollIntoView({ block: 'nearest' }) }, 10);
                    return next;
                  });
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (showSuggestions && selectedIndex >= 0 && selectedIndex < filtered.length) {
                    const sel = filtered[selectedIndex];
                    setNewRemark(sel);
                    setShowSuggestions(false);
                    setSelectedIndex(-1);
                  } else if (jobId && !loading && newRemark.trim()) {
                    setShowSuggestions(false);
                    handleAddRemark(newRemark);
                  }
                }
              }}
              placeholder="Type status or remark..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
                outline: 'none'
              }}
              disabled={!jobId || loading}
            />
        </div>
        <button
          type="button"
          onClick={() => handleAddRemark()}
          disabled={!jobId || loading || !newRemark.trim()}
          style={{
            background: '#0ea5e9',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: (!jobId || loading || !newRemark.trim()) ? 'not-allowed' : 'pointer',
            opacity: (!jobId || loading || !newRemark.trim()) ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Send size={16} /> Add Remark
        </button>
      </div>
    </div>
    </>
  );
}
