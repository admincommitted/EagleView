import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AirExportActionTabs from './AirExportActionTabs';
import { Search, CheckCircle2, RefreshCw, FileSpreadsheet, Bell, ExternalLink, History } from 'lucide-react';
import TrackTimelineModal from './TrackTimelineModal';
import CustomerUpdatesModal from './CustomerUpdatesModal';
import { exportRowsToExcel } from './awbExcel';
import ModernDatePicker from '../common/ModernDatePicker';
import CustomAutocomplete from '../CustomAutocomplete';

export default function TrackShipments() {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState([]);
  const [timeline, setTimeline] = useState(null);      // { awbNumber, hawbNumber, row }
  const [showUpdates, setShowUpdates] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pollMsg, setPollMsg] = useState('');
  const [airlines, setAirlines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(50);

  const filtersRef = useRef({});
  const entriesRef = useRef(50);
  useEffect(() => { entriesRef.current = entriesPerPage; }, [entriesPerPage]);
  const [filters, setFilters] = useState({
    documentType: 'ALL',
    airline: '',
    awbNumber: (location.state && location.state.trackAwb) || '',
    shipper: '',
    status: 'ALL',
    origin: '',
    destination: '',
    dateType: 'ALL',
    fromDate: '',
    toDate: ''
  });

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const EMPTY = { documentType: 'ALL', airline: '', awbNumber: '', shipper: '', status: 'ALL', origin: '', destination: '', dateType: 'ALL', fromDate: '', toDate: '' };
  const clearFilters = () => { setFilters(EMPTY); filtersRef.current = EMPTY; };

  useEffect(() => { filtersRef.current = filters; }, [filters]);

  // silent = the 15-second refresh: keeps the page the user is on (before it jumped back to page 1)
  const fetchTrackings = async (silent = false, useFilters = null) => {
    if (!silent) setLoading(true);
    try {
      const queryParams = new URLSearchParams(useFilters || filtersRef.current).toString();
      const res = await fetch(`/api/awb/tracking?${queryParams}`);
      const result = await res.json();
      if (result.success) {
        const rows = result.data || [];
        setData(rows);
        if (result.airlines) setAirlines(result.airlines);
        if (silent) setCurrentPage((p) => Math.min(p, Math.max(1, Math.ceil(rows.length / entriesRef.current))));
        else setCurrentPage(1);
      } else if (Array.isArray(result)) { // Fallback if API wasn't updated properly
        setData(result);
        setCurrentPage(1);
      }
    } catch (err) {
      console.error(err);
    }
    if (!silent) setLoading(false);
  };

  // ask the airline mailbox (SFTP) for new FSU files now, then reload
  const fetchStatusNow = async () => {
    setPolling(true); setPollMsg('');
    try {
      const r = await fetch('/api/awb/fsu-poll', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.success === false || j.error) throw new Error(j.error || j.message || 'Could not fetch status');
      if (j.skipped) throw new Error('Airline connection (SFTP) is not set up - see Settings → SFTP');
      setPollMsg(`Status fetched: ${j.processed || 0} new update(s)`);
      await fetchTrackings(true);
    } catch (e) { setPollMsg('Error: ' + e.message); } finally { setPolling(false); }
  };
  const STAGE_TEXT = { SAVED: 'Saved', SUBMITTED: 'Submitted', REJECTED: 'Rejected', READY_FOR_CARRIAGE: 'Ready for carriage', DEPARTED: 'Departed', DELIVERED: 'Delivered' };
  const exportExcel = () => {
    const when = (v) => { if (!v) return ''; const d = new Date(v); return isNaN(d) ? String(v) : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
    exportRowsToExcel('AWB_Tracking', 'Tracking', [
      ['documentType', 'Document'], ['awbNumber', 'AWB / MAWB'], ['hawbNumber', 'HAWB'], ['stage', 'Status', (r) => STAGE_TEXT[r.stage] || r.stage],
      ['shipperName', 'Shipper'], ['consigneeName', 'Consignee'], ['origin', 'Origin'], ['destination', 'Destination'], ['flight', 'Flight'],
      ...['fna', 'fma', 'foh', 'rcs', 'dep', 'arr', 'tfd', 'rcf', 'nfd', 'dlv'].map((k) => [k, k.toUpperCase(), (r) => when(r[k])]),
      ['totalPieces', 'Pieces'], ['grossWeight', 'Gross Wt'],
    ], data);
  };
  const airlineLink = (row) => {
    const b = String(row.awbNumber || '').replace(/\D/g, '');
    const a = airlines.find((x) => String(x.prefix || '') === b.slice(0, 3));
    if (!a || !a.trackingUrl || b.length !== 11) return null;
    return String(a.trackingUrl).replace(/\{awb\}/gi, b).replace(/\{prefix\}/gi, b.slice(0, 3)).replace(/\{serial\}/gi, b.slice(3)).replace(/\{awbdash\}/gi, `${b.slice(0, 3)}-${b.slice(3)}`);
  };

  useEffect(() => {
    fetchTrackings();
    const interval = setInterval(() => fetchTrackings(true), 15000);
    return () => clearInterval(interval);
  }, []);

  const panelStyle = {
    border: '1px solid #cbd5e1',
    background: 'var(--bg-panel, var(--bg-panel, #ffffff))',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
    overflow: 'hidden'
  };

  const headerStyle = {
    background: 'transparent',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border-color, #e2e8f0)',
    color: 'var(--text-main, var(--text-main, #0f172a))',
    fontWeight: '700',
    fontSize: '15px',
    textTransform: 'uppercase',
    letterSpacing: '-0.5px'
  };

  const labelStyle = { fontSize: '11px', fontWeight: '600', color: 'var(--text-main, #334155)', marginBottom: '4px', letterSpacing: '0.5px' };
  const inputStyle = {
    padding: '4px 8px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '13px',
    width: '100%',
    color: '#0f172a',
    background: '#ffffff',
    outline: 'none',
    transition: 'all 0.2s',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
  };

  const btnStyle = {
    background: '#3b82f6',
    color: 'var(--bg-panel, var(--bg-panel, #ffffff))',
    border: 'none',
    padding: '6px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
    transition: 'background 0.2s'
  };

  const tableHeaderStyle = { background: 'var(--bg-input, var(--bg-input, #f1f5f9))', color: 'var(--text-main, var(--text-main, #1e293b))', fontWeight: 'bold', fontSize: '10px', padding: '6px 6px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center', whiteSpace: 'nowrap' };
  const tableCellStyle = { padding: '6px 6px', fontSize: '11px', color: 'var(--text-main, var(--text-main, #1e293b))', borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-panel, var(--bg-panel, #ffffff))', textAlign: 'center', whiteSpace: 'nowrap' };

  const renderDocBadge = (type) => {
      if (!type) return null;
      let t = 'A', bg = '#dcfce7', txt = '#15803d', border = '#86efac';
      const upper = type.toUpperCase();
      if (upper === 'MASTER' || upper === 'MAWB') {
          t = 'M'; bg = '#e0e7ff'; txt = '#4338ca'; border = '#a5b4fc';
      } else if (upper === 'HOUSE' || upper === 'HAWB') {
          t = 'H'; bg = '#fef3c7'; txt = '#b45309'; border = '#fcd34d';
      }
      return (
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '4px', background: bg, color: txt, border: `1px solid ${border}`, fontWeight: 'bold', fontSize: '11px', margin: '0 auto' }}>
              {t}
          </div>
      );
    };
    
    const fmtWhen = (v) => { const d = new Date(v); return isNaN(d) ? String(v) : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };
    // milestone: tick with the time under it (before the raw timestamp text was shown); FNA = rejection, in red
    const renderIcon = (status, bad = false) => {
    if (status === true || status === 'true' || status === 'Y') return <CheckCircle2 size={14} color="#16a34a" />;
    if (status) return <span title={fmtWhen(status)} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}><span style={{ color: bad ? '#dc2626' : '#16a34a', fontWeight: 800 }}>{bad ? '✕' : '✓'}</span><span style={{ fontSize: '9px', color: '#64748b' }}>{fmtWhen(status)}</span></span>;
    return <span style={{ color: 'var(--border-color, var(--border-color, #cbd5e1))' }}>-</span>;
  };
  const STAGE = { SAVED: ['Saved', '#64748b'], SUBMITTED: ['Submitted', '#2563eb'], REJECTED: ['Rejected', '#dc2626'], READY_FOR_CARRIAGE: ['Ready for carriage', '#059669'], DEPARTED: ['Departed', '#7c3aed'], DELIVERED: ['Delivered', '#15803d'] };
  const openRow = (row) => {
    if (row.documentType === 'HOUSE') navigate('/freight/create-hawb', { state: { loadAwbNumber: row.hawbNumber } });
    else if (row.documentType === 'MASTER') navigate('/freight/create-mawb', { state: { loadAwbNumber: row.awbNumber } });
    else navigate('/freight/create-awb', { state: { loadAwbNumber: row.awbNumber } });
  };

  const currentData = data.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      <AirExportActionTabs activeTab="track" />
      
      <div style={{ padding: '8px 0px', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '40px' }}>
        
        {/* Search Criteria */}
        <div style={panelStyle}>
          <div style={headerStyle}>SEARCH CRITERIA</div>
          
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>DOCUMENT TYPE</span>
                <select name="documentType" value={filters.documentType} onChange={handleFilterChange} style={inputStyle}>
                  <option value="ALL">ALL</option>
                  <option value="AIR WAYBILL">AIR WAYBILL</option>
                  <option value="MASTER">MASTER</option>
                  <option value="HOUSE">HOUSE</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>AIRLINE NAME</span>
                <CustomAutocomplete
                  name="airline"
                  value={filters.airline}
                  onChange={handleFilterChange}
                  onSelect={(opt) => setFilters(prev => ({ ...prev, airline: opt.id }))}
                  staticData={airlines.map(a => ({
                    id: a.name,
                    title: a.name,
                    subtitle: `${a.code2 || ''} ${a.prefix || ''}`.trim(),
                    raw: a
                  }))}
                  placeholder=""
                  style={{...inputStyle, padding: '4px 8px'}}
                />
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>AWB / HAWB NUMBER</span>
                <CustomAutocomplete
                  name="awbNumber"
                  value={filters.awbNumber}
                  onChange={handleFilterChange}
                  onSelect={(opt) => setFilters(prev => ({ ...prev, awbNumber: opt.title }))}
                  fetchUrl="/api/awb/list"
                  mapData={(res) => { const seen = new Set(); const rows = Array.isArray(res) ? res : (Array.isArray(res && res.data) ? res.data : []); return rows.map(x => (x.type === 'HAWB' ? { no: x.hawbNumber, sub: `HAWB of ${x.awbNumber || '-'}` } : { no: x.awbNumber, sub: `${x.type || ''} ${x.destination || ''}`.trim() })).filter(x => x.no && !seen.has(x.no) && seen.add(x.no)).map(x => ({ id: x.no, title: x.no, subtitle: x.sub })); }}
                  placeholder=""
                  style={{...inputStyle, padding: '4px 8px'}}
                />
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>STATUS</span>
                <select name="status" value={filters.status} onChange={handleFilterChange} style={inputStyle}>
                  <option value="ALL">ALL</option>
                  <option value="PENDING">PENDING (NOT DELIVERED)</option>
                  <option value="FINISHED">FINISHED (DELIVERED)</option>
                  <option value="SAVED">SAVED, NOT SUBMITTED</option>
                  <option value="SUBMITTED">SUBMITTED, PENDING RCS</option>
                  <option value="REJECTED">REJECTED (FNA)</option>
                  <option value="READY_FOR_CARRIAGE">READY FOR CARRIAGE (RCS)</option>
                  <option value="DEPARTED">DEPARTED</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>ORIGIN</span>
                <CustomAutocomplete
                  name="origin"
                  value={filters.origin}
                  onChange={handleFilterChange}
                  onSelect={(opt) => setFilters(prev => ({ ...prev, origin: opt.countryCode || opt.title.substring(0,3) }))}
                  fetchUrl="/api/masters/airports"
                  mapData={(res) => Array.isArray(res) ? res.map(a => ({ id: a.id, title: a.code, subtitle: a.name, countryCode: a.code })) : []}
                  placeholder=""
                  maxLength={3}
                  style={{...inputStyle, padding: '4px 8px'}}
                />
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>DESTINATION</span>
                <CustomAutocomplete
                  name="destination"
                  value={filters.destination}
                  onChange={handleFilterChange}
                  onSelect={(opt) => setFilters(prev => ({ ...prev, destination: opt.countryCode || opt.title.substring(0,3) }))}
                  fetchUrl="/api/masters/airports"
                  mapData={(res) => Array.isArray(res) ? res.map(a => ({ id: a.id, title: a.code, subtitle: a.name, countryCode: a.code })) : []}
                  placeholder=""
                  maxLength={3}
                  style={{...inputStyle, padding: '4px 8px'}}
                />
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>SHIPPER / CONSIGNEE</span>
                <input type="text" name="shipper" value={filters.shipper} onChange={handleFilterChange} onKeyDown={(e) => { if (e.key === 'Enter') fetchTrackings(false, filters); }} placeholder="Name contains" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>DATE TYPE</span>
                <select name="dateType" value={filters.dateType} onChange={handleFilterChange} style={inputStyle}>
                  <option value="ALL">ALL</option>
                  <option value="DEPARTURE">DEPARTURE</option>
                  <option value="ARRIVAL">ARRIVAL</option>
                </select>
              </div>
              <div style={{ flex: 0.5 }}>
                <span style={labelStyle}>FROM DATE</span>
                <ModernDatePicker name="fromDate" value={filters.fromDate} onChange={handleFilterChange} style={inputStyle} />
              </div>
              <div style={{ flex: 0.5 }}>
                <span style={labelStyle}>TO DATE</span>
                <ModernDatePicker name="toDate" value={filters.toDate} onChange={handleFilterChange} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '8px' }}>
              <button style={{ ...btnStyle, background: 'var(--bg-input, var(--bg-input, #f1f5f9))', color: '#ef4444', border: '1px solid #cbd5e1', boxShadow: 'none' }} onClick={() => { clearFilters(); fetchTrackings(false, EMPTY); }}>CLEAR</button>
              <button style={btnStyle} onClick={() => fetchTrackings(false, filters)}><Search size={14} /> SEARCH</button>
            </div>
          </div>
        </div>

        <datalist id="trackAirlineList">
          {airlines.map(a => <option key={a.id} value={a.name} />)}
        </datalist>

        {/* Results */}
        <div style={panelStyle}>
          <div style={headerStyle}>SEARCH RESULT</div>
          <div style={{ padding: '12px 16px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155', marginBottom: '12px' }}>
              <span style={{ marginRight: 'auto', color: '#64748b' }}>{data.length} records · refreshes every 15 seconds · click a row for its history, double-click to open the AWB</span>
              <button onClick={fetchStatusNow} disabled={polling} title="Ask the airline mailbox for new status (FSU) now" style={{ ...btnStyle, background: '#0f766e', padding: '4px 10px', fontSize: '12px' }}><RefreshCw size={13} className={polling ? 'spin-icon' : ''} /> {polling ? 'Fetching...' : 'Fetch status now'}</button>
              <button onClick={exportExcel} disabled={!data.length} style={{ ...btnStyle, background: '#15803d', padding: '4px 10px', fontSize: '12px', opacity: data.length ? 1 : 0.5 }}><FileSpreadsheet size={13} /> Excel</button>
              <button onClick={() => setShowUpdates(true)} title="Automatic email / WhatsApp to customers on milestones" style={{ ...btnStyle, background: '#7c3aed', padding: '4px 10px', fontSize: '12px' }}><Bell size={13} /> Customer updates</button>
              <span style={{ marginLeft: '8px' }}>SHOW</span>
              <select value={entriesPerPage} onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }} style={{ padding: '4px 8px', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px', outline: 'none' }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>ENTRIES</span>
            </div>

            {pollMsg && <div style={{ fontSize: '12px', marginBottom: '8px', color: pollMsg.startsWith('Error') ? '#dc2626' : '#059669' }}>{pollMsg}</div>}
            <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>DOCUMENT TYPE</th>
                    <th style={tableHeaderStyle}>AWB/MASTER AWB NUMBER</th>
                    <th style={tableHeaderStyle}>HOUSE WAYBILL NUMBER</th>
                    <th style={tableHeaderStyle}>STATUS</th>
                    <th style={tableHeaderStyle}>SAVED</th>
                    <th style={tableHeaderStyle}>SUBMITTED TO AIRLINE</th>
                    <th style={tableHeaderStyle}>FNA</th>
                    <th style={tableHeaderStyle}>FMA</th>
                    <th style={tableHeaderStyle}>FOH</th>
                    <th style={tableHeaderStyle}>RCS</th>
                    <th style={tableHeaderStyle}>DEP</th>
                    <th style={tableHeaderStyle}>ARR</th>
                    <th style={tableHeaderStyle}>TFD</th>
                    <th style={tableHeaderStyle}>RCF</th>
                    <th style={tableHeaderStyle}>NFD</th>
                    <th style={tableHeaderStyle}>DLV</th>
                    <th style={tableHeaderStyle}>ORIGIN</th>
                    <th style={tableHeaderStyle}>DESTINATION</th>
                    <th style={tableHeaderStyle}>FLIGHT</th>
                    <th style={tableHeaderStyle}>DEPARTURE</th>
                    <th style={tableHeaderStyle}>SHIPPER</th>
                    <th style={tableHeaderStyle}>LINKS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="22" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Loading tracking data...</td></tr>
                  ) : data.length === 0 ? (
                    <tr><td colSpan="22" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 'bold' }}>NO TRACKING DATA FOUND</td></tr>
                  ) : (
                    currentData.map((row, i) => (
                      <tr key={row.type + row.id} className="table-row-hover" onClick={() => setTimeline({ awbNumber: row.awbNumber, hawbNumber: row.documentType === 'HOUSE' ? row.hawbNumber : null, row })} onDoubleClick={() => openRow(row)} title="Click: history · Double-click: open AWB" style={{ cursor: 'pointer' }}>
                        <td style={tableCellStyle}>{renderDocBadge(row.documentType)}</td>
                        <td style={{ ...tableCellStyle, fontWeight: 'bold' }}>{row.awbNumber}</td>
                        <td style={tableCellStyle}>{row.hawbNumber || '-'}</td>
                        <td style={{ ...tableCellStyle, fontWeight: 700, color: (STAGE[row.stage] || [])[1] || '#64748b' }}>{(STAGE[row.stage] || [row.stage || '-'])[0]}</td>
                        <td style={tableCellStyle}>{renderIcon(row.saved)}</td>
                        <td style={tableCellStyle}>{renderIcon(row.submittedToAirline)}</td>
                        <td style={tableCellStyle}>{renderIcon(row.fna, true)}</td>
                        <td style={tableCellStyle}>{renderIcon(row.fma)}</td>
                        <td style={tableCellStyle}>{renderIcon(row.foh)}</td>
                        <td style={tableCellStyle}>{renderIcon(row.rcs)}</td>
                        <td style={tableCellStyle}>{renderIcon(row.dep)}</td>
                        <td style={tableCellStyle}>{renderIcon(row.arr)}</td>
                        <td style={tableCellStyle}>{renderIcon(row.tfd)}</td>
                        <td style={tableCellStyle}>{renderIcon(row.rcf)}</td>
                        <td style={tableCellStyle}>{renderIcon(row.nfd)}</td>
                        <td style={tableCellStyle}>{renderIcon(row.dlv)}</td>
                        <td style={tableCellStyle}>{row.origin || '-'}</td>
                        <td style={tableCellStyle}>{row.destination || '-'}</td>
                        <td style={tableCellStyle}>{row.flight || '-'}</td>
                        <td style={tableCellStyle}>{row.departureDate ? fmtWhen(row.departureDate) : '-'}</td>
                        <td style={{ ...tableCellStyle, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.shipperName || ''}>{row.shipperName || '-'}</td>
                        <td style={tableCellStyle} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                          <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                            <button title="Status history" onClick={() => setTimeline({ awbNumber: row.awbNumber, hawbNumber: row.documentType === 'HOUSE' ? row.hawbNumber : null, row })} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563eb', padding: 0 }}><History size={14} /></button>
                            {airlineLink(row) ? <a href={airlineLink(row)} target="_blank" rel="noopener noreferrer" title="Airline tracking website" style={{ color: '#2563eb' }}><ExternalLink size={14} /></a> : <span title="Add the tracking link in Masters → Airline" style={{ color: '#cbd5e1' }}><ExternalLink size={14} /></span>}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-main, #334155)' }}>
                <div>Showing {((currentPage - 1) * entriesPerPage) + 1} to {Math.min(currentPage * entriesPerPage, data.length)} of {data.length} entries</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', background: currentPage === 1 ? 'var(--bg-app, var(--bg-app, #f8fafc))' : 'var(--bg-panel, var(--bg-panel, #ffffff))', color: currentPage === 1 ? 'var(--border-color, var(--border-color, #cbd5e1))' : '#334155', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>Previous</button>
                  <span>Page</span>
                  <select value={currentPage} onChange={(e) => setCurrentPage(Number(e.target.value))} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', background: 'var(--bg-panel, var(--bg-panel, #ffffff))', color: '#334155', cursor: 'pointer' }}>
                    {Array.from({ length: Math.ceil(data.length / entriesPerPage) }).map((_, i) => (<option key={i + 1} value={i + 1}>{i + 1}</option>))}
                  </select>
                  <span>of {Math.ceil(data.length / entriesPerPage)}</span>
                  <button disabled={currentPage === Math.ceil(data.length / entriesPerPage)} onClick={() => setCurrentPage(prev => prev + 1)} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', background: currentPage === Math.ceil(data.length / entriesPerPage) ? 'var(--bg-app, var(--bg-app, #f8fafc))' : 'var(--bg-panel, var(--bg-panel, #ffffff))', color: currentPage === Math.ceil(data.length / entriesPerPage) ? 'var(--border-color, var(--border-color, #cbd5e1))' : '#334155', borderRadius: '6px', cursor: currentPage === Math.ceil(data.length / entriesPerPage) ? 'not-allowed' : 'pointer' }}>Next</button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
      {timeline && <TrackTimelineModal awbNumber={timeline.awbNumber} hawbNumber={timeline.hawbNumber} onClose={() => setTimeline(null)} onChanged={() => fetchTrackings(true)} onOpenAwb={() => { const r = timeline.row; setTimeline(null); openRow(r); }} />}
      {showUpdates && <CustomerUpdatesModal onClose={() => setShowUpdates(false)} />}
    </div>
  );
}

