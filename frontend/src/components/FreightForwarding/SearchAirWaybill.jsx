import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AirExportActionTabs from './AirExportActionTabs';
import { Search, Printer, RefreshCw, FileSpreadsheet, Pencil, Copy, Ban, History, Send, ArrowUp, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';
import ModernDatePicker from '../common/ModernDatePicker';
import CustomAutocomplete from '../CustomAutocomplete';
import TrackTimelineModal from './TrackTimelineModal';
import { exportRowsToExcel } from './awbExcel';

// 29-Oct-2026: Excel, row actions (open / print / duplicate / void / history), origin / destination / status / flight-date
// filters, sorting, paging, tick rows to print or send FWB / FHL together, and the last search is remembered.
const EMPTY_FILTERS = { awbType: 'ALL', awbNature: 'BOTH', routing: 'ALL', fromDate: '', toDate: '', dateBasis: 'AWB', shipper: '', airline: '', awbNo: '', flightNo: '', hawbNo: '', consignee: '', origin: '', destination: '', stage: 'ALL' };
const STORE_KEY = 'awbSearch.last.v1';
const STAGE_TEXT = { SAVED: ['Saved', '#64748b'], SUBMITTED: ['Submitted', '#2563eb'], REJECTED: ['Rejected', '#dc2626'], READY_FOR_CARRIAGE: ['Ready (RCS)', '#059669'], DEPARTED: ['Departed', '#7c3aed'], DELIVERED: ['Delivered', '#15803d'] };
const rowKey = (r) => `${r.type}:${r.id}`;
const readStore = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { return null; } };
const writeStore = (v) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch (e) { /* private window */ } };

export default function SearchAirWaybill() {
  const navigate = useNavigate();
  const [selectedRow, setSelectedRow] = useState(null);
  const [rowData, setRowData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [parties, setParties] = useState([]);
  const [airlinesList, setAirlinesList] = useState([]);
  const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS, ...((readStore() || {}).filters || {}) }));
  const [message, setMessage] = useState('');
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [picked, setPicked] = useState(() => new Set());
  const [history, setHistory] = useState(null);
  const [busy, setBusy] = useState('');
  const [results, setResults] = useState(null); // bulk send results [{ no, ok, text }]

  // Fetch autocomplete options
  useEffect(() => {
    fetch('/api/reports/forwarder-transactions?docType=All')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.parties) setParties(data.parties);
          if (data.airlines) setAirlinesList(data.airlines);
        }
      })
      .catch(err => console.error(err));
  }, []);

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setRowData([]); setMessage(''); setSelectedRow(null); setPicked(new Set()); setResults(null);
    writeStore(null);
  };

  const hasCriteria = (f) => f.awbType !== 'ALL' || f.awbNature !== 'BOTH' || f.routing !== 'ALL' || f.stage !== 'ALL'
    || ['fromDate', 'toDate', 'shipper', 'airline', 'awbNo', 'flightNo', 'hawbNo', 'consignee', 'origin', 'destination'].some((k) => String(f[k] || '').trim());

  const handleSearch = async (f = filters, quiet = false) => {
    // a type / nature / routing / status choice is also a criteria (e.g. all MAWBs with routing pending)
    if (!hasCriteria(f)) {
        toast.error('Please enter at least one search criteria (Date Range, AWB No, Party, etc.) to perform a search.', { id: 'query-toast' });
        return;
    }
    setLoading(true);
    try {
      const queryParams = new URLSearchParams(f).toString();
      const res = await fetch(`/api/search/awb-query?${queryParams}`);
      const result = await res.json();
      if (result.success) {
        const fetchedData = result.data || [];
        setRowData(fetchedData); setSelectedRow(null); setMessage(result.message || ''); setPage(1);
        setPicked((p) => new Set([...p].filter((k) => fetchedData.some((r) => rowKey(r) === k))));
        writeStore({ filters: f, searched: true });
        if (!quiet) {
          if (fetchedData.length === 0) toast.error('No airwaybill records found for the selected criteria.', { id: 'query-toast' });
          else toast.success('Found ' + fetchedData.length + ' records.', { id: 'query-toast' });
        }
      } else {
        toast.error(result.error || 'Failed to fetch data.', { id: 'query-toast' });
      }
    } catch (err) {
      console.error(err);
      toast.error('Error fetching data.', { id: 'query-toast' });
    }
    setLoading(false);
  };
  // coming back to the screen: run the last search again
  useEffect(() => { const s = readStore(); if (s && s.searched && s.filters && hasCriteria({ ...EMPTY_FILTERS, ...s.filters })) handleSearch({ ...EMPTY_FILTERS, ...s.filters }, true); }, []); // eslint-disable-line

  // sorting + paging
  const NUM = ['pkgs', 'grWt', 'chgWt', 'totalFreight'];
  const sorted = useMemo(() => {
    const k = sort.key; const m = sort.dir === 'asc' ? 1 : -1;
    const val = (r) => (k === 'createdAt' ? new Date(r.createdAt).getTime() || 0 : NUM.includes(k) ? parseFloat(r[k]) || 0 : String(r[k] ?? '').toUpperCase());
    return [...rowData].sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * m; });
  }, [rowData, sort]); // eslint-disable-line
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);
  const sortBy = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: NUM.includes(key) || key === 'createdAt' ? 'desc' : 'asc' }));

  const pickedRows = sorted.filter((r) => picked.has(rowKey(r)));
  const togglePick = (r) => setPicked((p) => { const n = new Set(p); const k = rowKey(r); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => picked.has(rowKey(r)));
  const togglePage = () => setPicked((p) => { const n = new Set(p); pageRows.forEach((r) => (allOnPage ? n.delete(rowKey(r)) : n.add(rowKey(r)))); return n; });

  const totals = rowData.reduce((s, r) => ({ pkgs: s.pkgs + (parseInt(r.pkgs, 10) || 0), gr: s.gr + (parseFloat(r.grWt) || 0), chg: s.chg + (parseFloat(r.chgWt) || 0) }), { pkgs: 0, gr: 0, chg: 0 });

  const COLS = [['type', 'Type'], ['stage', 'Status', (r) => (STAGE_TEXT[r.stage] || [r.stage])[0]], ['flight', 'Flight'], ['flightDate', 'Flight Date', (r) => String(r.flightDate || '').slice(0, 10)], ['awbDate', 'AWB Dt.'], ['awbNo', 'AWB No'], ['hawbNo', 'HAWB No'], ['shipper', 'Shipper'], ['consignee', 'Consignee'], ['origin', 'Origin'], ['dstn', 'Dstn'], ['pc', 'P/C'], ['pkgs', 'Pkgs'], ['grWt', 'Gr.Wt'], ['chgWt', 'Chg.Wt'], ['totalFreight', 'Freight'], ['currency', 'Cur'], ['subagt', 'Sub Agt'], ['tieup', 'Tie-up'], ['routingStatus', 'Routing'], ['cargoType', 'Cargo'], ['remarks', 'Remarks']];
  const exportExcel = () => exportRowsToExcel('AWB_Search', 'AWB Search', COLS, pickedRows.length ? pickedRows : sorted);

  // PRINT GRID (29-Oct-2026: the button did nothing) - prints the ticked rows, or all rows
  const printGrid = () => {
    const rows = pickedRows.length ? pickedRows : sorted;
    const t2 = rows.reduce((s, r) => ({ pkgs: s.pkgs + (parseInt(r.pkgs, 10) || 0), gr: s.gr + (parseFloat(r.grWt) || 0), chg: s.chg + (parseFloat(r.chgWt) || 0) }), { pkgs: 0, gr: 0, chg: 0 });
    const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const cols = [['type', 'Type'], ['stage', 'Status', (r) => (STAGE_TEXT[r.stage] || [r.stage])[0]], ['flight', 'Flight'], ['awbDate', 'AWB Dt.'], ['awbNo', 'AWB No'], ['hawbNo', 'HAWB No'], ['shipper', 'Shipper'], ['consignee', 'Consignee'], ['dstn', 'Dstn'], ['pc', 'P/C'], ['pkgs', 'Pkgs'], ['grWt', 'Gr.Wt'], ['chgWt', 'Chg.Wt'], ['totalFreight', 'Freight', (r) => `${r.totalFreight} ${r.currency || ''}`], ['subagt', 'Sub Agt'], ['routingStatus', 'Routing']];
    const head = cols.map(([, l]) => `<th>${l}</th>`).join('');
    const body = rows.map((r) => `<tr>${cols.map(([k, , fn]) => `<td>${esc(fn ? fn(r) : r[k])}</td>`).join('')}</tr>`).join('');
    const html = `<!doctype html><html><head><title>AWB Search</title><style>body{font-family:Arial,sans-serif;font-size:10px;margin:12px}h3{margin:0 0 6px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:3px 4px;text-align:left}th{background:#eee}@page{size:landscape;margin:10mm}</style></head><body><h3>Airwaybill Query - ${rows.length} records</h3><div style="margin-bottom:6px">Printed ${esc(new Date().toLocaleString())} · Pkgs ${t2.pkgs} · Gr.Wt ${t2.gr.toFixed(2)} · Chg.Wt ${t2.chg.toFixed(2)}</div><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);
    frame.contentDocument.open(); frame.contentDocument.write(html); frame.contentDocument.close();
    setTimeout(() => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } finally { setTimeout(() => frame.remove(), 1000); } }, 300);
  };

  // ---- row actions ----
  const openRow = (row, autoPrint = false) => {
    const state = { loadAwbNumber: row.type === 'HAWB' ? row.hawbNo : row.awbNo, ...(autoPrint ? { autoPrint: true } : {}) };
    if (row.type === 'HAWB') navigate('/freight/create-hawb', { state });
    else if (row.type === 'MAWB') navigate('/freight/create-mawb', { state });
    else navigate('/freight/create-awb', { state });
  };
  const call = async (url, opts = {}) => {
    const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) throw new Error(j.error || j.message || `Failed (${r.status})`);
    return j;
  };
  const duplicateRow = async (row) => {
    const no = row.type === 'HAWB' ? row.hawbNo : row.awbNo;
    let newAwbNumber;
    if (row.type === 'HAWB') {
      newAwbNumber = window.prompt(`New HAWB number for the copy of ${no}:`, '');
      if (!newAwbNumber) return;
    } else if (!window.confirm(`Make a copy of ${no} with the next free AWB number of this airline?`)) return;
    setBusy(rowKey(row));
    try {
      const j = await call(`/api/awb/duplicate/${row.id}`, { method: 'POST', body: JSON.stringify({ type: row.type, newAwbNumber: newAwbNumber ? newAwbNumber.trim() : undefined }) });
      toast.success(`Copied as ${j.newAwbNumber}`);
      await handleSearch(filters, true);
    } catch (e) { toast.error('Duplicate failed: ' + e.message); } finally { setBusy(''); }
  };
  const voidRow = async (row) => {
    const no = row.type === 'HAWB' ? row.hawbNo : row.awbNo;
    if (!window.confirm(`VOID ${row.type} ${no}? It will no longer show in lists and its number can be used again.`)) return;
    setBusy(rowKey(row));
    try {
      await call(`/api/awb/void/${row.id}`, { method: 'PUT', body: JSON.stringify({ type: row.type === 'HAWB' ? 'HAWB' : 'MAWB' }) });
      toast.success(`${no} voided`);
      await handleSearch(filters, true);
    } catch (e) { toast.error('Void failed: ' + e.message); } finally { setBusy(''); }
  };

  // ---- send ticked rows to the airline ----
  const sendFwb = async () => {
    const rows = pickedRows.filter((r) => r.type !== 'HAWB');
    if (!rows.length) return toast.error('Tick AWB / MAWB rows to send their FWB');
    if (!window.confirm(`Send FWB to the airline for ${rows.length} AWB(s)?\n${rows.map((r) => r.awbNo).join(', ')}`)) return;
    setBusy('bulk'); const out = [];
    for (const r of rows) {
      try { const j = await call(`/api/awb/${r.id}/send-xfwb`, { method: 'POST', body: '{}' }); out.push({ no: r.awbNo, ok: true, text: `FWB sent${j.fileName ? ' · ' + j.fileName : ''}` }); }
      catch (e) { out.push({ no: r.awbNo, ok: false, text: e.message }); }
    }
    setResults(out); setBusy(''); await handleSearch(filters, true);
  };
  const sendFhl = async () => {
    const masters = new Map();
    const skipped = [];
    pickedRows.forEach((r) => {
      if (r.type === 'MAWB') masters.set(r.id, r.awbNo);
      else if (r.type === 'HAWB') { if (r.masterId) masters.set(r.masterId, r.awbNo); else skipped.push({ no: r.hawbNo, ok: false, text: 'MAWB not saved - link the HAWB first' }); }
    });
    if (!masters.size) return toast.error(skipped.length ? 'The ticked HAWBs have no saved MAWB' : 'Tick MAWB or HAWB rows to send FHL');
    if (!window.confirm(`Send FHL (all houses) for ${masters.size} MAWB(s)?\n${[...masters.values()].join(', ')}`)) return;
    setBusy('bulk'); const out = [...skipped];
    for (const [id, no] of masters) {
      try { const j = await call(`/api/awb/${id}/send-xfhl`, { method: 'POST', body: '{}' }); out.push({ no, ok: true, text: `FHL sent${j.fileName ? ' · ' + j.fileName : ''}` }); }
      catch (e) { out.push({ no, ok: false, text: e.message }); }
    }
    setResults(out); setBusy(''); await handleSearch(filters, true);
  };

  const labelStyle = { display: 'block', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted, #64748b)', marginBottom: '2px', letterSpacing: '0.3px', textTransform: 'uppercase' };
  const groupStyle = { display: 'inline-flex', alignItems: 'center', gap: '10px' };
  const groupTitle = { fontSize: '10px', color: 'var(--text-muted, #64748b)', letterSpacing: '0.3px' };
  const inputStyle = { padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', width: '100%', boxSizing: 'border-box', background: 'var(--bg-app, #ffffff)', color: 'var(--text-main, #0f172a)', height: '26px', outline: 'none', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' };
  const radioLabelStyle = { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-main, #334155)', cursor: 'pointer', fontWeight: '600' };
  const radioStyle = { margin: 0, cursor: 'pointer' };

  const btnStyle = { background: '#3b82f6', color: 'var(--bg-panel, var(--bg-panel, #ffffff))', border: 'none', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)', transition: 'background 0.2s' };

  const tableHeaderStyle = { background: 'var(--bg-input, var(--bg-input, #f1f5f9))', color: 'var(--text-main, var(--text-main, #1e293b))', fontWeight: 'bold', fontSize: '10px', padding: '8px 6px', borderRight: '1px solid var(--border-color, #e2e8f0)', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center', whiteSpace: 'nowrap' };
  const tableCellStyle = { padding: '8px 6px', fontSize: '11px', color: 'var(--text-main, var(--text-main, #1e293b))', borderRight: '1px solid var(--border-color, #e2e8f0)', borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-panel, var(--bg-panel, #ffffff))', textAlign: 'center', whiteSpace: 'nowrap' };
  
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      <AirExportActionTabs activeTab="search" />
      
      <div style={{ padding: '12px 0px', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '40px' }}>
        
        {/* Main Panel */}
        <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
          {/* compact query panel (29-Oct-2026): buttons in the title bar, the three choices on one line, all filters in one grid */}
          <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-main, #0f172a)', fontWeight: '700', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '-0.3px', marginRight: 'auto' }}>AIRWAYBILL QUERY</span>
            <button style={btnStyle} onClick={() => handleSearch()}><Search size={13} /> QUERY</button>
            <button style={{ ...btnStyle, background: 'var(--text-muted, #64748b)' }} onClick={clearFilters}><RefreshCw size={13} /> CLEAR</button>
            <button style={{ ...btnStyle, background: '#0f766e', opacity: rowData.length ? 1 : 0.5 }} disabled={!rowData.length} onClick={printGrid}><Printer size={13} /> PRINT</button>
            <button style={{ ...btnStyle, background: '#15803d', opacity: rowData.length ? 1 : 0.5 }} disabled={!rowData.length} onClick={exportExcel}><FileSpreadsheet size={13} /> EXCEL</button>
          </div>

          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 24px', alignItems: 'center' }}>
              <span style={groupStyle}><b style={groupTitle}>TYPE</b>
                <label style={radioLabelStyle}><input type="radio" name="awbType" value="ALL" checked={filters.awbType === 'ALL'} onChange={handleFilterChange} style={radioStyle} /> ALL</label>
                <label style={radioLabelStyle}><input type="radio" name="awbType" value="NORMAL" checked={filters.awbType === 'NORMAL'} onChange={handleFilterChange} style={radioStyle} /> DIRECT AWB</label>
                <label style={radioLabelStyle}><input type="radio" name="awbType" value="MASTER" checked={filters.awbType === 'MASTER'} onChange={handleFilterChange} style={radioStyle} /> MASTER (MAWB)</label>
                <label style={radioLabelStyle}><input type="radio" name="awbType" value="HOUSE" checked={filters.awbType === 'HOUSE'} onChange={handleFilterChange} style={radioStyle} /> HOUSE (HAWB)</label>
              </span>
              <span style={groupStyle}><b style={groupTitle}>NATURE</b>
                <label style={radioLabelStyle}><input type="radio" name="awbNature" value="BOTH" checked={filters.awbNature === 'BOTH'} onChange={handleFilterChange} style={radioStyle} /> BOTH</label>
                <label style={radioLabelStyle}><input type="radio" name="awbNature" value="PREPAID" checked={filters.awbNature === 'PREPAID'} onChange={handleFilterChange} style={radioStyle} /> PREPAID</label>
                <label style={radioLabelStyle}><input type="radio" name="awbNature" value="COLLECT" checked={filters.awbNature === 'COLLECT'} onChange={handleFilterChange} style={radioStyle} /> COLLECT</label>
              </span>
              <span style={groupStyle}><b style={groupTitle}>ROUTING</b>
                <label style={radioLabelStyle}><input type="radio" name="routing" value="ALL" checked={filters.routing === 'ALL'} onChange={handleFilterChange} style={radioStyle} /> ALL</label>
                <label style={radioLabelStyle} title="Flight number and date filled in"><input type="radio" name="routing" value="FINISHED" checked={filters.routing === 'FINISHED'} onChange={handleFilterChange} style={radioStyle} /> FINISHED</label>
                <label style={radioLabelStyle} title="Flight not given yet"><input type="radio" name="routing" value="PENDING" checked={filters.routing === 'PENDING'} onChange={handleFilterChange} style={radioStyle} /> PENDING</label>
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(138px, 1fr))', gap: '6px 10px' }}>
              <div><span style={labelStyle}>FROM</span><ModernDatePicker name="fromDate" value={filters.fromDate} onChange={handleFilterChange} style={inputStyle} /></div>
              <div><span style={labelStyle}>TO</span><ModernDatePicker name="toDate" value={filters.toDate} onChange={handleFilterChange} style={inputStyle} /></div>
              <div><span style={labelStyle}>DATE IS</span>
                <select name="dateBasis" value={filters.dateBasis} onChange={handleFilterChange} style={inputStyle}>
                  <option value="AWB">AWB DATE</option>
                  <option value="FLIGHT">FLIGHT DATE</option>
                </select>
              </div>
              <div><span style={labelStyle}>AWB NO</span>
                <CustomAutocomplete
                  name="awbNo"
                  value={filters.awbNo}
                  onChange={handleFilterChange}
                  onSelect={(opt) => setFilters(prev => ({ ...prev, awbNo: opt.title }))}
                  fetchUrl="/api/awb/list"
                  mapData={(res) => { const seen = new Set(); return (Array.isArray(res.data) ? res.data : []).filter(x => x.type !== 'HAWB' && x.awbNumber && !seen.has(x.awbNumber) && seen.add(x.awbNumber)).map(x => ({ id: x.type + x.id, title: x.awbNumber, subtitle: `${x.type} ${x.destination || ''}`.trim() })); }}
                  placeholder=""
                  style={inputStyle}
                />
              </div>
              <div><span style={labelStyle}>HAWB NO</span>
                <CustomAutocomplete
                  name="hawbNo"
                  value={filters.hawbNo}
                  onChange={handleFilterChange}
                  onSelect={(opt) => setFilters(prev => ({ ...prev, hawbNo: opt.title }))}
                  fetchUrl="/api/awb/list"
                  mapData={(res) => Array.isArray(res.data) ? res.data.filter(x => x.type === 'HAWB' && x.hawbNumber).map(x => ({ id: 'H' + x.id, title: x.hawbNumber, subtitle: `MAWB ${x.awbNumber || '-'}` })) : []}
                  placeholder=""
                  style={inputStyle}
                />
              </div>
              <div><span style={labelStyle}>FLIGHT NO</span><input type="text" name="flightNo" value={filters.flightNo} onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }} onChange={(e) => setFilters({ ...filters, flightNo: e.target.value.toUpperCase() })} placeholder="EK511" style={inputStyle} /></div>
              <div><span style={labelStyle}>AIRLINE</span>
                <CustomAutocomplete
                  name="airline"
                  value={filters.airline}
                  onChange={handleFilterChange}
                  onSelect={(opt) => setFilters(prev => ({ ...prev, airline: opt.title }))}
                  staticData={airlinesList.map(a => ({
                    id: a.id,
                    title: a.name,
                    subtitle: `${a.code2 || ''} ${a.prefix || ''}`.trim(),
                    raw: a
                  }))}
                  placeholder=""
                  style={inputStyle}
                />
              </div>
              <div><span style={labelStyle}>SHIPPER</span>
                <CustomAutocomplete
                  name="shipper"
                  value={filters.shipper}
                  onChange={handleFilterChange}
                  onSelect={(opt) => setFilters(prev => ({ ...prev, shipper: opt.title }))}
                  staticData={parties.map(p => ({
                    id: p.id,
                    title: p.name,
                    subtitle: p.partyType || '',
                    raw: p
                  }))}
                  placeholder=""
                  style={inputStyle}
                />
              </div>
              <div><span style={labelStyle}>CONSIGNEE</span>
                <CustomAutocomplete
                  name="consignee"
                  value={filters.consignee}
                  onChange={handleFilterChange}
                  onSelect={(opt) => setFilters(prev => ({ ...prev, consignee: opt.title }))}
                  staticData={parties.map(p => ({
                    id: p.id,
                    title: p.name,
                    subtitle: p.partyType || '',
                    raw: p
                  }))}
                  placeholder=""
                  style={inputStyle}
                />
              </div>
              <div><span style={labelStyle}>ORIGIN</span><input type="text" name="origin" value={filters.origin} maxLength={3} placeholder="DEL" onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }} onChange={(e) => setFilters({ ...filters, origin: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })} style={inputStyle} /></div>
              <div><span style={labelStyle}>DESTINATION</span><input type="text" name="destination" value={filters.destination} maxLength={3} placeholder="DXB" onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }} onChange={(e) => setFilters({ ...filters, destination: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })} style={inputStyle} /></div>
              <div><span style={labelStyle}>STATUS</span>
                <select name="stage" value={filters.stage} onChange={handleFilterChange} style={inputStyle}>
                  <option value="ALL">ALL</option>
                  <option value="SAVED">SAVED, NOT SUBMITTED</option>
                  <option value="SUBMITTED">SUBMITTED, PENDING RCS</option>
                  <option value="REJECTED">REJECTED (FNA)</option>
                  <option value="READY_FOR_CARRIAGE">READY (RCS)</option>
                  <option value="DEPARTED">DEPARTED</option>
                  <option value="DELIVERED">DELIVERED</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <datalist id="partyList">
          {parties.map(p => <option key={p.id} value={p.name} />)}
        </datalist>
        <datalist id="airlineList">
          {airlinesList.map(a => <option key={a.id} value={a.name} />)}
        </datalist>

        {/* Results Panel */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', background: 'var(--bg-panel, var(--bg-panel, #ffffff))', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)' }}>
          <div style={{ background: 'transparent', padding: '8px 12px', borderBottom: '1px solid var(--border-color, #e2e8f0)', color: 'var(--text-main, var(--text-main, #0f172a))', fontWeight: '700', fontSize: '15px', textTransform: 'uppercase', letterSpacing: '-0.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span>SEARCH RESULTS - TOTAL AWB: {rowData.length}{message ? <span style={{ color: '#dc2626', fontSize: '12px', marginLeft: '10px', textTransform: 'none' }}>{message}</span> : null}</span>
            {rowData.length > 0 && <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'none' }}>PKGS {totals.pkgs} · GR.WT {totals.gr.toFixed(2)} · CHG.WT {totals.chg.toFixed(2)} kg</span>}
          </div>

          {rowData.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderBottom: '1px solid var(--border-color, #e2e8f0)', fontSize: '12px', flexWrap: 'wrap', background: pickedRows.length ? '#eff6ff' : 'transparent' }}>
              <b>{pickedRows.length ? `${pickedRows.length} ticked` : 'Tick rows to work on several at once'}</b>
              {pickedRows.length > 0 && <>
                <button disabled={!!busy} onClick={printGrid} style={{ ...btnStyle, padding: '3px 10px', fontSize: '12px', background: '#0f766e' }}><Printer size={12} /> Print ticked</button>
                <button disabled={!!busy} onClick={exportExcel} style={{ ...btnStyle, padding: '3px 10px', fontSize: '12px', background: '#15803d' }}><FileSpreadsheet size={12} /> Excel ticked</button>
                <button disabled={!!busy} onClick={sendFwb} style={{ ...btnStyle, padding: '3px 10px', fontSize: '12px', background: '#7c3aed' }}><Send size={12} /> Send FWB</button>
                <button disabled={!!busy} onClick={sendFhl} style={{ ...btnStyle, padding: '3px 10px', fontSize: '12px', background: '#9333ea' }}><Send size={12} /> Send FHL</button>
                <button disabled={!!busy} onClick={() => setPicked(new Set())} style={{ ...btnStyle, padding: '3px 10px', fontSize: '12px', background: '#64748b' }}>Clear ticks</button>
              </>}
              {busy === 'bulk' && <span style={{ color: '#2563eb' }}>Sending, please wait...</span>}
              <span style={{ marginLeft: 'auto' }}>SHOW </span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                {[25, 50, 100, 250].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
          {results && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color, #e2e8f0)', fontSize: '12px', background: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>Send result: {results.filter((x) => x.ok).length} sent, {results.filter((x) => !x.ok).length} failed</b><button onClick={() => setResults(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>close</button></div>
              {results.map((x, i) => <div key={i} style={{ color: x.ok ? '#059669' : '#dc2626' }}>{x.ok ? '✓' : '✕'} {x.no} - {x.text}</div>)}
            </div>
          )}

          <div style={{ overflowX: 'auto', width: '100%', maxHeight: '520px' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th style={tableHeaderStyle}><input type="checkbox" aria-label="Tick all on this page" checked={allOnPage} onChange={togglePage} /></th>
                  <th style={tableHeaderStyle}>ACTIONS</th>
                  {[['type', 'TYPE'], ['stage', 'STATUS'], ['flight', 'FLIGHT'], ['createdAt', 'AWB DT.'], ['awbNo', 'AWB NO'], ['hawbNo', 'HAWB NO'], ['shipper', 'SHIPPER'], ['consignee', 'CONSIGNEE'], ['dstn', 'DSTN'], ['pc', 'P/C'], ['pkgs', 'PKGS'], ['grWt', 'GR.WT'], ['chgWt', 'CHG.WT'], ['totalFreight', 'TOTAL FREIGHT'], ['subagt', 'SUBAGT'], ['tieup', 'TIEUP'], ['routingStatus', 'ROUTING STATUS'], ['cargoType', 'CARGO TYPE DESCRIPTION'], ['remarks', 'REMARKS']].map(([k, l]) => (
                    <th key={k} style={{ ...tableHeaderStyle, cursor: 'pointer', userSelect: 'none' }} onClick={() => sortBy(k)} title="Click to sort">
                      {l}{sort.key === k ? (sort.dir === 'asc' ? <ArrowUp size={10} style={{ marginLeft: 2 }} /> : <ArrowDown size={10} style={{ marginLeft: 2 }} />) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="21" style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>
                ) : rowData.length === 0 ? (
                  <tr><td colSpan="21" style={{ textAlign: 'center', padding: '20px' }}>No records found.</td></tr>
                ) : (
                  pageRows.map((row) => {
                    const k = rowKey(row); const st = STAGE_TEXT[row.stage] || [row.stage || '-', '#64748b'];
                    const iconBtn = { border: 'none', borderRadius: '4px', padding: '3px 5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', color: '#fff' };
                    return (
                    <tr key={k} className="table-row-hover" onClick={() => setSelectedRow(k)} onDoubleClick={() => openRow(row)}
                      style={{ background: picked.has(k) ? '#dbeafe' : selectedRow === k ? 'var(--primary-border, #bae6fd)' : 'white', cursor: 'pointer', opacity: busy === k ? 0.5 : 1 }}>
                      <td style={tableCellStyle} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Tick ${row.hawbNo || row.awbNo}`} checked={picked.has(k)} onChange={() => togglePick(row)} /></td>
                      <td style={tableCellStyle} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                        <span style={{ display: 'inline-flex', gap: '3px' }}>
                          <button title="Open / edit" onClick={() => openRow(row)} style={{ ...iconBtn, background: '#2563eb' }}><Pencil size={12} /></button>
                          <button title="Print AWB" onClick={() => openRow(row, true)} style={{ ...iconBtn, background: '#0284c7' }}><Printer size={12} /></button>
                          <button title="Duplicate" disabled={!!busy} onClick={() => duplicateRow(row)} style={{ ...iconBtn, background: '#0f766e' }}><Copy size={12} /></button>
                          <button title="Status history and log" onClick={() => setHistory({ awbNumber: row.awbNo, hawbNumber: row.type === 'HAWB' ? row.hawbNo : null, row })} disabled={!row.awbNo} style={{ ...iconBtn, background: row.awbNo ? '#7c3aed' : '#cbd5e1' }}><History size={12} /></button>
                          <button title="Void" disabled={!!busy} onClick={() => voidRow(row)} style={{ ...iconBtn, background: '#dc2626' }}><Ban size={12} /></button>
                        </span>
                      </td>
                      <td style={tableCellStyle}>{renderDocBadge(row.type)}</td>
                      <td style={{ ...tableCellStyle, color: st[1], fontWeight: 700 }}>{st[0]}</td>
                      <td style={tableCellStyle} title={row.flightDate || ''}>{row.flight ? `${row.flight}${row.flightDate ? ' / ' + String(row.flightDate).slice(0, 10) : ''}` : '-'}</td>
                      <td style={tableCellStyle}>{row.awbDate}</td>
                      <td style={tableCellStyle}>
                        {row.awbNo && (
                            <span style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}
                                onClick={(e) => { e.stopPropagation(); if (row.type === 'HAWB') navigate('/freight/create-mawb', { state: { loadAwbNumber: row.awbNo } }); else openRow(row); }}>
                                {row.awbNo}
                            </span>
                        )}
                      </td>
                      <td style={tableCellStyle}>
                        {row.hawbNo && (
                            <span style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}
                                onClick={(e) => { e.stopPropagation(); navigate('/freight/create-hawb', { state: { loadAwbNumber: row.hawbNo } }); }}>
                                {row.hawbNo}
                            </span>
                        )}
                      </td>
                      <td style={tableCellStyle}>{row.shipper}</td>
                      <td style={tableCellStyle}>{row.consignee}</td>
                      <td style={tableCellStyle}>{row.dstn}</td>
                      <td style={tableCellStyle}>{row.pc}</td>
                      <td style={tableCellStyle}>{row.pkgs}</td>
                      <td style={tableCellStyle}>{row.grWt}</td>
                      <td style={tableCellStyle}>{row.chgWt}</td>
                      <td style={tableCellStyle}>{row.totalFreight}{row.currency ? ' ' + row.currency : ''}</td>
                      <td style={tableCellStyle}>{row.subagt}</td>
                      <td style={tableCellStyle}>{row.tieup}</td>
                      <td style={tableCellStyle}>{row.routingStatus}</td>
                      <td style={tableCellStyle}>{row.cargoType}</td>
                      <td style={tableCellStyle}>{row.remarks}</td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {rowData.length > pageSize && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', fontSize: '12px' }}>
              <span>Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, sorted.length)} of {sorted.length}</span>
              <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ padding: '3px 10px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Prev</button>
                Page <select value={page} onChange={(e) => setPage(Number(e.target.value))}>{Array.from({ length: pages }).map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select> of {pages}
                <button disabled={page === pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} style={{ padding: '3px 10px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Next</button>
              </span>
            </div>
          )}
        </div>
        {history && <TrackTimelineModal awbNumber={history.awbNumber} hawbNumber={history.hawbNumber} onClose={() => setHistory(null)} onChanged={() => handleSearch(filters, true)} onOpenAwb={() => { const r = history.row; setHistory(null); openRow(r); }} />}
      </div>
    </div>
  );
}

