import React, { useState, useEffect, useRef } from 'react';
import JobFilesPanel from '../../common/JobFilesPanel';
import toast from 'react-hot-toast';
import { Lock, Clock, Ban, CheckCircle, Search, Filter, MoreVertical, Plus, Download, FolderOpen, FileCheck, CheckSquare, FileText, UploadCloud, AlertTriangle, PenTool, Edit2, Copy, Link, ClipboardList, FolderPlus, FolderMinus, FileSpreadsheet, Folder, Edit3, MapPin, Trash2, ChevronDown, MessageSquare, Table, Eye } from 'lucide-react';
import RowContextMenu from '../../common/RowContextMenu'; // 18-Nov-2026: right-click menu of a job row
import DsrExcelGrid from './DsrExcelGrid';
import { useNavigate } from 'react-router-dom';
import DocketRegisterModal, { docketPath } from '../../DocketRegisterModal'; // 10-Nov-2026: register shipment from the list
import QueryResolutionDrawer from './QueryResolutionDrawer';
import ModernDatePicker from '../../common/ModernDatePicker';
import { downloadInvoiceSample } from './InvoiceGridTabParts/invoiceExcel';
import { downloadJobWorkbook, downloadItemCsv } from './jobExcel';

// ---- job list filters (mode, BE type, date range on job date, search field) ----
const ymdLocal = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : NaN; };
const anyText = (row, keys) => keys.some(k => row[k] !== undefined && row[k] !== null && String(row[k]).toLowerCase().includes(row.__term));
function applyJobFilters(rows, f) {
  const from = ymdLocal(f.fromDate), to = ymdLocal(f.toDate);
  const term = String(f.searchTerm || '').trim().toLowerCase();
  const beOf = (row) => { const t = String(row.boeType || row.beType || '').toUpperCase(); return t.startsWith('W') || t === 'IN_BOND' ? 'W' : (t.startsWith('EX') || t === 'X' ? 'X' : (t ? 'H' : '')); };
  const modeOf = (row) => { const m = String(row.shipmentMode || row.mode || '').toUpperCase(); return m.startsWith('A') ? 'AIR' : m.startsWith('L') ? 'LAND' : m ? 'SEA' : ''; };
  const keys = {
    JOB_NO: ['jobNo'], BE_NO: ['beNo'], IMPORTER: ['importer', 'nameOfImporter', 'autoField_4'], SUB_AGENT: ['subagentName'],
    INVOICE: ['invNo', 'invoiceNo'], MAWB_MBL: ['mawbNo', 'mawbblNo'], HAWB_HBL: ['hawbNo', 'hawbhblNo']
  };
  return (rows || []).filter(row => {
    const t = ymdLocal(isoDay(row.jobDateRaw)) || new Date(row.createdAt).getTime();
    if (!isNaN(from) && !isNaN(t) && t < from) return false;
    if (!isNaN(to) && !isNaN(t) && t >= to + 86400000) return false;
    if (f.statusFilter && f.statusFilter !== 'All' && row.status !== f.statusFilter) return false;
    if (f.filterMode && f.filterMode !== 'ALL' && modeOf(row) !== f.filterMode) return false;
    if (f.filterBeType && f.filterBeType !== 'ALL' && beOf(row) !== f.filterBeType) return false;
    if (!term) return true;
    const r = { ...row, __term: term };
    const list = keys[f.searchType] || [].concat(...Object.values(keys), ['supplier', 'supplierName', 'igmNumber', 'iecCode', 'autoField_5']);
    return anyText(r, list);
  });
}

// ---- sample files: each one is what the matching reader accepts (28-Oct-2026: the old Invoice / Item samples had
// column names the readers did not use, and there was no sample for Read Flat File / Read XML) ----
const SAMPLE_FILES = [
  { key: 'invoice', label: 'Invoice Excel (invoices sheet only)', hint: '3. Invoices > Read Excel' },
  { key: 'job', label: 'Job Excel - invoices + items + containers + SW + e-Sanchit docs (sample)', hint: '3. Invoices > Read Excel or 4. Items > Read File (the other ERP\'s ImportExcel .xls also works)' },
  { key: 'jobtpl', label: 'Job Excel - blank template', hint: '3. Invoices > Read Excel or 4. Items > Read File' },
  { key: 'itemcsv', label: 'Item CSV', hint: '4. Items > Read File' },
  { key: 'json', label: 'BE JSON (ICEGATE CACHI01)', hint: 'Read XML / file upload' },
  { key: 'xml', label: 'BE XML', hint: 'Read XML' },
  { key: 'flat', label: 'BE Flat File (.be, ICES 1.5)', hint: 'Read Flat File' },
];
async function downloadSample(kind) {
  try {
    if (kind === 'invoice') return downloadInvoiceSample();
    if (kind === 'job') return downloadJobWorkbook(true);
    if (kind === 'jobtpl') return downloadJobWorkbook(false);
    if (kind === 'itemcsv') return downloadItemCsv();
    // BE files are made by the backend with the same builder as the ICEGATE JSON (dummy data)
    const res = await fetch('/api/import-jobs/sample/' + kind);
    if (!res.ok) { let m = res.statusText; try { m = (await res.json()).error || m; } catch (e) { /* not json */ } throw new Error(m); }
    const blob = await res.blob();
    const name = ({ json: 'Sample_BE_CACHI01.json', xml: 'Sample_BE_CACHI01.xml', flat: 'SAMPLE01.be' })[kind];
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch (e) { toast.error('Could not create the sample: ' + e.message); }
}
// dates arrive as YYYY-MM-DD, YYYYMMDD, dd/mm/yyyy or ISO; new Date() of the first two gave "Invalid Date"
const showDate = (v) => {
  const t = String(v || '').trim(); if (!t) return ''; let m;
  if ((m = /^(\d{4})-?(\d{2})-?(\d{2})(?:$|T|\s)/.exec(t))) return `${m[3]}/${m[2]}/${m[1]}`;
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t))) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
  const d = new Date(t); return isNaN(d) ? t : d.toLocaleDateString('en-GB');
};
const isoDay = (v) => { const t = String(v || '').trim(); let m; if ((m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(t))) return `${m[1]}-${m[2]}-${m[3]}`; if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return t; };

export default function QueryTab({ onAction, refreshKey }) {
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const downloadMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target)) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 22-Nov-2026: the text typed in the search box is kept in a ref, not in state - with state every key drew the whole
  // job list again (typing felt stuck). It is read when Search / Enter is pressed, as before.
  const searchTermRef = useRef('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [currentLogs, setCurrentLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Documents of a job: its e-Sanchit rows (BE / invoice / item) and every PDF kept in its archive folder. 29-Oct-2026
  const [docsModal, setDocsModal] = useState(null); // { job, rows, files, loading }
  const handleViewDocs = async (job) => {
    setDocsModal({ job, rows: [], files: [], loading: true });
    const pj = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } return Array.isArray(v) ? v : []; };
    try {
      const j = await window.fetch(`/api/import-jobs/${job.id}`).then(r => r.json());
      const d = (j && j.data) || {};
      const rows = [];
      pj(d.esanchitDocs).forEach(x => rows.push({ level: String(x.docFor || 'HEADER').toUpperCase() === 'HEADER' ? 'BE' : 'Invoice ' + (x.invSrNo || ''), docCode: x.docCode, docName: x.docName, irn: x.irn, fileName: x.fileName, fileUrl: x.fileUrl, issuerName: x.issuerName, issueDate: x.issueDate }));
      (d.invoices || []).forEach((inv, k) => (inv.items || []).forEach(it => pj(it.docsData).forEach(x => {
        const lvl = String(x.docFor || 'ITEM').toUpperCase();
        rows.push({ level: lvl === 'ITEM' ? `Item ${k + 1}/${it.itemSrNo || it.itemNo || ''}` : lvl === 'INVOICE' ? 'Invoice ' + (k + 1) : 'BE', docCode: x.docCode, docName: x.docName, irn: x.irn, fileName: x.fileName, fileUrl: x.fileUrl, issuerName: x.issuerName, issueDate: x.issueDate || x.date });
      })));
      const keys = [...new Set([job.jobNo, 'job-' + job.id].filter(Boolean))];
      const files = [];
      for (const k of keys) { try { const a = await window.fetch('/api/icegate/esanchit-archive?jobNo=' + encodeURIComponent(k)).then(r => r.json()); (a && a.data || []).forEach(f => files.push(f)); } catch (e) { /* no archive */ } }
      (d.finalDocs ? pj(d.finalDocs) : []).forEach(f => { if (f && f.fileUrl) files.push({ fileName: (f.docType || 'FINAL') + ' - ' + (f.fileName || f.fileUrl.split('/').pop()), fileUrl: f.fileUrl, final: true }); });
      const seen = new Set();
      setDocsModal({ job, rows, files: files.filter(f => { if (seen.has(f.fileUrl)) return false; seen.add(f.fileUrl); return true; }), loading: false });
    } catch (e) { toast.error('Could not load the documents: ' + e.message); setDocsModal(m => m ? { ...m, loading: false } : m); }
  };

  const handleViewLogs = async (job) => {
    setLogsModalOpen(true);
    setLogsLoading(true);
    try {
      const response = await window.fetch(`/api/import-jobs/${job.id}/logs`);
      if (response.ok) {
        const data = await response.json();
        setCurrentLogs(data);
      } else {
        toast.error("Failed to fetch logs");
      }
    } catch (e) {
      toast.error("Error fetching logs");
    } finally {
      setLogsLoading(false);
    }
  };


  const [searchType, setSearchType] = useState('ALL');
  const [filterBeType, setFilterBeType] = useState('ALL');

  const [filterMode, setFilterMode] = useState('ALL');
  const [appliedFilters, setAppliedFilters] = useState({
    searchTerm: '',
    fromDate: '',
    toDate: '',
    statusFilter: 'All',
    searchType: 'ALL',
    filterMode: 'ALL',
    filterBeType: 'ALL'
  });

  // One filter used both for the "Found N jobs" message and for the table (they used different rules before). 28-Oct-2026
  // 09-Nov-2026: the filters now run on the server over all jobs (the list brought only the latest 500 and searched
  // those, so an older job could not be found); the count comes back with the list
  const searchToast = useRef(false);
  const handleSearchClick = () => {
    const f = { searchTerm: searchTermRef.current, fromDate, toDate, statusFilter, searchType, filterMode, filterBeType };
    searchToast.current = true;
    setAppliedFilters(f);
  };

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchWrapperRef = useRef(null);
  
  useEffect(() => {
    function handleClickOutsideSearch(event) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutsideSearch);
    return () => document.removeEventListener("mousedown", handleClickOutsideSearch);
  }, []);
  
  const [openMenuRow, setOpenMenuRow] = useState(null);
  
  // Drawer state
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);

  const menuRef = useRef(null);

  // Close context menu if clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuRow(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [dashboardData, setDashboardData] = useState([]);
  // 10-Nov-2026: Docket No column - UN-REGISTERED makes the docket (Register Shipment), a docket no opens it
  const nav = useNavigate();
  const [docketJob, setDocketJob] = useState(null);
  const openDocket = (d) => nav(docketPath(d.division || d.docketDivision, d.docketNo));

  // 18-Nov-2026: right-click on a job = every action of the row icons and of the job's ACTIONS menu, without opening
  // the job. BE file / .be / Preview / Amendment are made from the saved job; Send to ICEGATE and AI PDF Extract need
  // the job on the screen, so they open it and start by themselves. The row icons stay as they were.
  const [rowMenu, setRowMenu] = useState(null);
  const closeRowMenu = React.useCallback(() => setRowMenu(null), []);
  const openUrl = (u) => { if (u) window.open(u, '_blank', 'noopener'); };
  const rowMenuItems = (row) => {
    const isVoid = row.status === 'VOID' || row.status === 'CANCELLED' || row.isVoid;
    const isLocked = row.status === 'LOCKED' || row.isLocked;
    const fd = (t) => ((row.finalDocs || []).find(d => d.docType === t) || {}).fileUrl;
    const act = (a) => () => onAction && onAction(a, row);
    const locked = isLocked ? 'Locked job' : '';
    return [
      { head: 'Job ' + (row.jobNo || '') },
      { label: 'Open job', icon: Edit2, onClick: act('edit'), disabled: isLocked, title: locked },
      { label: 'Documents (e-Sanchit + files)', icon: FolderOpen, onClick: () => handleViewDocs(row) },
      { label: 'Duplicate job', icon: Copy, onClick: act('duplicate'), disabled: isLocked, title: locked },
      { label: 'View logs', icon: Clock, onClick: () => handleViewLogs(row) },
      { label: 'Timeline / chat', icon: MessageSquare, onClick: act('timeline') },
      { sep: true },
      { head: 'BE files - without opening the job' },
      { label: 'Preview JSON', icon: Eye, onClick: act('list-preview') },
      { label: 'Download BE File (CACHI01 JSON)', icon: Download, onClick: act('list-json') },
      { label: 'Download BE Flat File (.be)', icon: Download, onClick: act('list-flat') },
      { label: 'BE Amendment', icon: FileText, onClick: act('list-amend') },
      { sep: true },
      { head: 'Opens the job and starts' },
      { label: 'Send to ICEGATE', icon: UploadCloud, iconColor: '#16a34a', onClick: act('open-send'), disabled: isLocked || isVoid, title: isVoid ? 'Void job' : locked },
      { label: 'AI PDF Extract (supplier invoice)', icon: UploadCloud, iconColor: '#a855f7', onClick: act('open-ai'), disabled: isLocked, title: locked },
      { sep: true },
      row.docketNo === 'UN-REGISTERED'
        ? { label: 'Register shipment (make docket)', icon: ClipboardList, onClick: () => setDocketJob(row), disabled: isVoid }
        : { label: 'Open docket ' + (row.docketNo || ''), icon: ClipboardList, onClick: () => openDocket(row), disabled: !row.docketNo },
      { label: 'First copy', icon: FileCheck, onClick: () => openUrl(fd('FIRST_COPY')), disabled: !row.hasFirstCopy, note: row.hasFirstCopy ? '' : 'not yet' },
      { label: 'OOC copy', icon: FileCheck, onClick: () => openUrl(fd('OOC_COPY')), disabled: !row.hasOocCopy, note: row.hasOocCopy ? '' : 'not yet' },
      { label: 'Gate pass', icon: FileCheck, onClick: () => openUrl(fd('GATEPASS')), disabled: !row.hasGatepass, note: row.hasGatepass ? '' : 'not yet' },
      { sep: true },
      { label: 'Delete job', icon: Trash2, danger: true, onClick: act('delete'), disabled: isLocked, title: locked },
    ];
  };
  const [listInfo, setListInfo] = useState({ total: 0, limit: 0, loading: false });
  useEffect(() => {
    const f = appliedFilters || {};
    const qs = new URLSearchParams();
    qs.set('limit', '100'); // latest 100 only (user, 09-Nov-2026); Search / dates reach the older jobs
    if (f.fromDate) qs.set('from', String(f.fromDate).slice(0, 10));
    if (f.toDate) qs.set('to', String(f.toDate).slice(0, 10));
    if (f.filterMode && f.filterMode !== 'ALL') qs.set('mode', f.filterMode);
    if (f.filterBeType && f.filterBeType !== 'ALL') qs.set('beType', f.filterBeType);
    if (f.statusFilter && f.statusFilter !== 'All') qs.set('status', f.statusFilter);
    if (String(f.searchTerm || '').trim()) { qs.set('q', String(f.searchTerm).trim()); qs.set('field', f.searchType || 'ALL'); }
    setListInfo(o => ({ ...o, loading: true }));
    const loadJobs = () => fetch('/api/import-jobs' + (qs.toString() ? '?' + qs.toString() : '')).then(res=>res.json()).then(data => {
       setListInfo({ total: data.total || 0, limit: data.limit || 0, loading: false });
       if (searchToast.current) {
           searchToast.current = false;
           if (!data.success) toast.error(data.error || 'Could not load the jobs');
           else if (!(data.data || []).length) toast.error("No data found for the selected criteria.");
           else toast.success(`Found ${data.total || data.data.length} jobs` + ((data.total || 0) > data.data.length ? ` (showing the latest ${data.data.length})` : '') + '.');
       }
       if(data.success) {
           setDashboardData(data.data.map(job => ({
               ...job,
               id: job.id, 
               jobNo: job.jobNo, 
               docketNo: job.docketNo || 'UN-REGISTERED', 
               jobDate: showDate(job.jobDate || job.createdAt), 
               jobDateRaw: job.jobDate || job.createdAt,
               importer: job.importer || job.importerName || job.nameOfImporter || job.autoField_4 || '',
               supplier: job.supplier || job.supplierName || '',
               beNo: job.beNo || '', beDate: showDate(job.beDate), invDt: showDate(job.invDt),
               enteredDate: new Date(job.createdAt).toLocaleString(), 
               enteredBy: job.createdBy || job.updatedBy || '', // 30-Oct-2026: the login that created the job (updatedBy for older rows)
               origin: job.origin || '', 
               destination: job.destination || job.portCode || job.autoField_2 || ''
           })));
       }
    }).catch(err => { setListInfo(o => ({ ...o, loading: false })); console.error('Dashboard fetch error:', err); });
    
    loadJobs();
  }, [refreshKey, appliedFilters]);

  const handleQueryClick = (job) => {
    setSelectedJob(job);
    setDrawerOpen(true);
  };

  const filteredData = applyJobFilters(dashboardData, appliedFilters);

  const handleBulkZip = async () => {
    const urls = filteredData.map(row => row.finalDocs?.find(d => d.docType === 'OOC_COPY')?.fileUrl).filter(Boolean);
    if (urls.length === 0) {
      toast.error(`None of the ${filteredData.length} listed job(s) has an OOC copy yet (column Docs > O). Filter the jobs and try again.`);
      return;
    }
    
    try {
      const response = await fetch('/api/bulk-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: urls, zipName: 'OOC_Copies_Bulk.zip' })
      });
      
      if (!response.ok) { let m = 'Failed to download bulk ZIP'; try { m = (await response.json()).error || m; } catch (e) { /* binary */ } throw new Error(m); }
      
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = 'OOC_Copies_Bulk.zip'; toast.success(`Zipping ${urls.length} OOC cop${urls.length > 1 ? 'ies' : 'y'}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
      toast.error('Error downloading ZIP: ' + e.message);
    }
  };

  const handleExportExcel = () => {
    const headers = ['Job No', 'Job Date', 'Importer', 'Supplier', 'Inv No', 'Inv Date', 'BE No', 'BE Date', 'Origin', 'Destination'];
    const rows = filteredData.map(row => [
      row.jobNo || '', row.jobDate || '', row.importer || '', row.supplier || '', row.invNo || '', row.invDate || '', row.beNo || '', row.beDate || '', row.origin || '', row.destination || ''
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.map(c => '"' + c + '"').join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'Import_Jobs.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
      const handleDsrSave = async (jobId, field, value) => {
      try {
          const res = await fetch('/api/import-jobs/' + jobId + '/dsr', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ field, value })
          });
          const data = await res.json();
          if (!data.success) {
              console.error('Save failed:', data.message);
          }
      } catch (err) {
          console.error('API Error:', err);
      }
  };;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', paddingRight: '0.5rem', position: 'relative' }}>
      
      <QueryResolutionDrawer isOpen={isDrawerOpen} onClose={() => setDrawerOpen(false)} job={selectedJob} />
      {docketJob && <DocketRegisterModal side="Import" job={docketJob} onClose={() => setDocketJob(null)} onOpen={(d) => { setDocketJob(null); openDocket(d); }}
        onDone={(d) => setDashboardData(rows => rows.map(r => r.id === docketJob.id ? { ...r, docketNo: d.docketNo, docketDivision: d.division, docketId: d.id } : r))} />}

      {/* Log column: job history (the modal was never rendered before) */}
      {docsModal && (
        <div onClick={() => setDocsModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-panel, #fff)', borderRadius: '10px', width: '100%', maxWidth: '900px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '10px 14px', background: 'linear-gradient(135deg, var(--primary-color-start, #0ea5e9), var(--primary-color-end, #2563eb))', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '13px' }}>Documents - Job {docsModal.job.jobNo}{docsModal.job.beNo ? ` / BE ${docsModal.job.beNo}` : ''}</strong>
              <button onClick={() => setDocsModal(null)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '16px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '10px 14px', overflowY: 'auto', fontSize: '12px' }}>
              {docsModal.loading ? 'Loading...' : (<>
                <div style={{ fontWeight: 700, color: 'var(--primary-text, #0369a1)', margin: '2px 0 6px' }}>e-Sanchit documents ({docsModal.rows.length})</div>
                {docsModal.rows.length ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontSize: '10px' }}>
                      {['Level', 'Doc code', 'IRN', 'Issued by', 'Issue date', 'PDF'].map(h => <th key={h} style={{ padding: '4px 6px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>{h}</th>)}</tr></thead>
                    <tbody>{docsModal.rows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                        <td style={{ padding: '4px 6px', fontWeight: 600 }}>{r.level}</td>
                        <td style={{ padding: '4px 6px' }} title={r.docName}>{r.docCode}{r.docName ? ` - ${String(r.docName).slice(0, 30)}` : ''}</td>
                        <td style={{ padding: '4px 6px', fontFamily: 'monospace', color: r.irn ? '#15803d' : '#b91c1c' }}>{r.irn || 'no IRN'}</td>
                        <td style={{ padding: '4px 6px' }}>{r.issuerName}</td>
                        <td style={{ padding: '4px 6px' }}>{r.issueDate ? String(r.issueDate).slice(0, 10) : ''}</td>
                        <td style={{ padding: '4px 6px' }}>{r.fileUrl ? <a href={r.fileUrl} target="_blank" rel="noreferrer" title={r.fileName || r.fileUrl} style={{ color: '#2563eb', fontWeight: 600 }}>{/_signed\.pdf$/i.test(String(r.fileUrl)) ? 'Signed PDF' : 'PDF'}</a> : <span style={{ color: 'var(--text-muted, #94a3b8)' }}>{r.fileName ? 'not kept' : '-'}</span>}</td>
                      </tr>))}</tbody>
                  </table>) : <div style={{ color: 'var(--text-muted, #64748b)', marginBottom: '6px' }}>No e-Sanchit document on this job (4. Items &gt; Supporting Docs).</div>}
                {/* 18-Nov-2026: e-Sanchit PDFs as one line per document (attached + signed copy), unused ones can be removed, other shipment documents uploaded by hand */}
                <JobFilesPanel module="Import" jobId={docsModal.job.id} finals={docsModal.files.filter(f => f.final)} />
              </>)}
            </div>
          </div>
        </div>
      )}

      {logsModalOpen && (
        <div onClick={() => setLogsModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-panel, #fff)', borderRadius: '10px', width: '100%', maxWidth: '560px', maxHeight: '75vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', background: 'linear-gradient(135deg, var(--primary-color-start, #0ea5e9), var(--primary-color-end, #2563eb))', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '13px' }}>Job Log</strong>
              <button onClick={() => setLogsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '16px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '10px 14px', overflowY: 'auto', fontSize: '12px' }}>
              {logsLoading ? 'Loading...' : (Array.isArray(currentLogs) && currentLogs.length ? currentLogs.map((l, i) => (
                <div key={i} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', padding: '6px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <strong style={{ color: 'var(--primary-text, #0369a1)' }}>{l.action}</strong>
                    <span style={{ color: 'var(--text-muted, #64748b)' }}>{l.time ? new Date(l.time).toLocaleString() : ''}</span>
                  </div>
                  <div style={{ color: 'var(--text-main, #334155)' }}>{l.details}{l.user ? ' — ' + l.user : ''}</div>
                </div>
              )) : 'No log entries yet.')}
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="glass-panel qry-bar" style={{ zIndex: 50, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        
        {/* ROW 1 */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            
            {/* Mode Filter */}
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mode</span>
              <select className="input-field" style={{ height: '26px', width: '70px', padding: '0 8px', fontSize: '11px', borderColor: '#cbd5e1', borderRadius: '4px', color: '#334155', fontWeight: 600, outline: 'none' }} value={filterMode} onChange={(e) => setFilterMode(e.target.value)}>
                <option value="ALL">ALL</option>
                <option value="AIR">AIR</option>
                <option value="SEA">SEA</option>
                <option value="LAND">LAND</option>
              </select>
            </div>

            {/* BE Type Filter */}
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>BE Type</span>
              <select className="input-field" style={{ height: '26px', width: '80px', padding: '0 8px', fontSize: '11px', borderColor: '#cbd5e1', borderRadius: '4px', color: '#334155', fontWeight: 600, outline: 'none' }} value={filterBeType} onChange={(e) => setFilterBeType(e.target.value)}>
                <option value="ALL">ALL BE</option>
                <option value="H">HOME (H)</option>
                <option value="W">IN-BOND (W)</option>
                <option value="X">EX-BOND (X)</option>
              </select>
            </div>
            
            {/* Search Container */}
            <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px', height: '26px' }}>
              <select style={{ height: '100%', border: 'none', background: 'transparent', padding: '0 8px', fontSize: '11px', color: '#475569', fontWeight: 600, outline: 'none', borderRight: '1px solid #e2e8f0', width: '90px' }} value={searchType} onChange={(e) => setSearchType(e.target.value)}>
                <option value="ALL">ALL FIELDS</option>
                <option value="JOB_NO">JOB NO</option>
                <option value="BE_NO">BE NO</option>
                <option value="IMPORTER">IMPORTER</option>
                <option value="SUB_AGENT">SUB AGENT</option>
                <option value="INVOICE">INVOICE</option>
                <option value="MAWB_MBL">MAWB/MBL</option>
                <option value="HAWB_HBL">HAWB/HBL</option>
              </select>
              <div style={{ position: 'relative', width: '130px', height: '100%' }}>
                <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  type="text" 
                  placeholder="Enter Search Term..." 
                  defaultValue=""
                  onChange={(e) => { searchTermRef.current = e.target.value; }}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchClick()}
                  style={{ height: '100%', width: '100%', border: 'none', background: 'transparent', paddingLeft: '28px', paddingRight: '8px', fontSize: '11px', outline: 'none', color: '#0f172a' }}
                />
              </div>
            </div>
            
            {/* Date Range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>From</span>
              <ModernDatePicker className="input-field" style={{ height: '26px', width: '85px', padding: '0 8px', fontSize: '11px', borderColor: '#cbd5e1', borderRadius: '4px', textAlign: 'center' }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>To</span>
              <ModernDatePicker className="input-field" style={{ height: '26px', width: '85px', padding: '0 8px', fontSize: '11px', borderColor: '#cbd5e1', borderRadius: '4px', textAlign: 'center' }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>

            <button className="btn btn-primary" style={{ height: '26px', padding: '0 16px', display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', fontWeight: 600, borderRadius: '4px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', border: 'none', color: '#fff', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }} onClick={handleSearchClick}>
              <Search size={14} /> Search
            </button>
        </div>

        {/* ROW 2 */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <button 
                onClick={() => setViewMode('list')}
                style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 600, background: viewMode === 'list' ? '#fff' : 'transparent', color: viewMode === 'list' ? '#0f172a' : '#64748b', border: 'none', borderRadius: '4px', boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}>
                LIST VIEW
              </button>
              <button 
                onClick={() => setViewMode('dsr')}
                style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 600, background: viewMode === 'dsr' ? '#fff' : 'transparent', color: viewMode === 'dsr' ? '#10b981' : '#64748b', border: 'none', borderRadius: '4px', boxShadow: viewMode === 'dsr' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Table size={12} /> EXCEL DSR
              </button>
            </div>
            
            <button className="btn btn-secondary" style={{ padding: '0 12px', height: '26px', fontSize: '11px', background: '#ecfdf5', color: '#047857', border: '1px solid #10b981', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }} onClick={handleBulkZip}>
              <FolderOpen size={14} /> Bulk OOC Zip
            </button>
            
            <button className="btn btn-success" onClick={() => onAction('new')} style={{ padding: '0 12px', height: '26px', fontSize: '11px', background: '#22c55e', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px', cursor: 'pointer' }}>
              <Plus size={14} /> New Job
            </button>
            <button className="btn btn-success" onClick={() => onAction && onAction('import-file', 'flat')} style={{ padding: '0 12px', height: '26px', fontSize: '11px', background: '#22c55e', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
              <FileText size={14} /> Read Flat File
            </button>
            <button className="btn btn-success" onClick={() => onAction && onAction('import-file', 'xml')} style={{ padding: '0 12px', height: '26px', fontSize: '11px', background: '#22c55e', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
              <FileText size={14} /> Read XML
            </button>

            <div style={{ position: 'relative' }} ref={downloadMenuRef}>
              <button 
                className="btn btn-warning" 
                style={{ padding: '0 12px', height: '26px', fontSize: '11px', background: '#f59e0b', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', borderRadius: '4px' }}
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              >
                <Download size={14} /> Download Sample <ChevronDown size={14} />
              </button>
              {showDownloadMenu && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: '#fff', border: '1px solid #fde68a', borderRadius: '6px', boxShadow: '0 8px 20px rgba(0,0,0,0.12)', zIndex: 50, minWidth: '280px', display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
                  {/* the old links pointed to /downloads/*.xls files that do not exist; these are made on the spot and match what Read Excel / Read File accept */}
                  {SAMPLE_FILES.map(sf => (
                    <button key={sf.key} type="button" className="dropdown-item" onClick={() => { downloadSample(sf.key); setShowDownloadMenu(false); }} style={{ padding: '6px 12px', color: '#1e3a8a', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Download size={12}/> <span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 600 }}>{sf.label}</span><span style={{ fontSize: '10px', color: '#64748b' }}>for {sf.hint}</span></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      
<div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel, #ffffff)' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--primary-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>Active Import Jobs Dashboard <span style={{ background: 'var(--primary-bg-light, #e0f2fe)', color: 'var(--primary-color, #0369a1)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>{filteredData.length}</span>{listInfo.loading ? <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>loading...</span> : listInfo.total > filteredData.length ? <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>latest {filteredData.length} of {listInfo.total} - use Search / dates for older jobs</span> : null}<span style={{ marginLeft: 'auto', fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Right-click a job for all its actions</span></h3>
        </div>
        
        <div style={{ flex: 1, overflow: 'auto' }}>
          {viewMode === 'list' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', whiteSpace: 'nowrap' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--primary-bg-light, var(--primary-bg-light))' }}>
              <tr style={{ textTransform: 'uppercase', color: 'var(--text-muted, var(--text-muted, #475569))' }}>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center', width: '60px' }}>Docs</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center', width: '44px' }} title="e-Sanchit documents and PDFs kept with the job">Files</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center', width: '40px' }}>Edit</th>
                  <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center', width: '40px' }} title="Duplicate">Dup</th>
                  <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center', width: '40px' }} title="Delete">Del</th>
<th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center', width: '40px' }} title="Audit Logs">Log</th>
                  <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center', width: '40px' }}>Chat</th>
                  <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Job No</th>
                  <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Job Date</th>
                  <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Docket No</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Importer</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Supplier</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Origin</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Destination</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Inv No</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Inv Dt</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Container No</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'right' }}>Inv Value</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'right' }}>Ass. Value</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'right' }}>Duty Value</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>BE No</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>BE Date</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}>BE Track</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}>Print Checklist</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Submission Status</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}>Submit Job</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}>Status</th>
                
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}>Excel</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}>eSanchit</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}>Duty</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}>Lic</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}>Amend</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}>Track...</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Locked By</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Entered By</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Entered Date</th>
              </tr>
            </thead>
            <tbody>
                {filteredData.map((row) => {
                  let rowBg = '';
                  let textColor = 'inherit';
                  let textDecor = 'none';
                  let isVoid = row.status === 'VOID' || row.status === 'CANCELLED' || row.isVoid;
                  let isLocked = row.status === 'LOCKED' || row.isLocked;
                  let hasBe = row.beNo && row.beNo.trim() !== '' && row.beNo !== 'N/A';
                  
                  if (isLocked) {
                    rowBg = '#fee2e2'; 
                    textColor = '#dc2626'; 
                  } else if (isVoid) {
                    rowBg = '#ffedd5'; 
                    textColor = '#ea580c';
                    textDecor = 'line-through red'; 
                  } else if (hasBe) {
                    rowBg = '#f0fdf4'; 
                    textColor = '#166534';
                  }

                  return (
                  <tr key={row.id} className="hover-row" onContextMenu={(e) => { e.preventDefault(); setRowMenu({ x: e.clientX, y: e.clientY, items: rowMenuItems(row) }); }} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', backgroundColor: rowBg, color: textColor, textDecoration: textDecor }}>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                      {row.hasFirstCopy ? <a href={'' + row.finalDocs.find(d => d.docType === 'FIRST_COPY')?.fileUrl} target="_blank" title="First Copy Downloaded" style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '11px', padding: '3px 7px', borderRadius: '4px', textDecoration: 'none', fontWeight: 700, border: '1px solid #93c5fd', boxShadow: '0 0 6px rgba(37, 99, 235, 0.4)' }}>F</a> : <span style={{ background: '#f8fafc', color: '#cbd5e1', fontSize: '11px', padding: '3px 7px', borderRadius: '4px', fontWeight: 700, border: '1px solid #e2e8f0', cursor: 'not-allowed' }}>F</span>}
                      {row.hasOocCopy ? <a href={'' + row.finalDocs.find(d => d.docType === 'OOC_COPY')?.fileUrl} target="_blank" title="OOC Copy Downloaded" className="doc-btn doc-active" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', boxShadow: '0 0 6px rgba(22, 163, 74, 0.4)' }}>O</a> : <span className="doc-btn doc-inactive" onClick={() => toast.error('OOC Copy not available')} title="OOC Not Available">O</span>}
                      {row.hasGatepass ? <a href={'' + row.finalDocs.find(d => d.docType === 'GATEPASS')?.fileUrl} target="_blank" title="Gatepass Downloaded" className="doc-btn doc-active" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', boxShadow: '0 0 6px rgba(217, 119, 6, 0.4)' }}>G</a> : <span className="doc-btn doc-inactive" onClick={() => toast.error('Gatepass not available')} title="Gatepass Not Available">G</span>}
                    </div>
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <FolderOpen size={20} color="#0d9488" className="action-btn" style={{ cursor: 'pointer' }} onClick={() => handleViewDocs(row)} title="Documents of this job (e-Sanchit + PDFs)" />
                  </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      {isLocked ? <Edit2 size={20} color="#94a3b8" style={{ cursor: 'not-allowed', opacity: 0.5 }} title="Locked Job" /> : <Edit2 size={20} color="var(--primary-color-start, #0ea5e9)" className="action-btn edit-btn" style={{ cursor: 'pointer' }} onClick={() => onAction && onAction('edit', row)} title="Edit Job" />}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      {isLocked ? <Copy size={20} color="#94a3b8" style={{ cursor: 'not-allowed', opacity: 0.5 }} title="Locked Job" /> : <Copy size={20} color="#8b5cf6" className="action-btn duplicate-btn" style={{ cursor: 'pointer' }} onClick={() => onAction && onAction('duplicate', row)} title="Duplicate Job" />}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                        {isLocked ? <Trash2 size={20} color="#94a3b8" style={{ cursor: 'not-allowed', opacity: 0.5 }} title="Locked Job" /> : <Trash2 size={20} color="#ef4444" className="action-btn delete-btn" style={{ cursor: 'pointer' }} onClick={() => onAction && onAction('delete', row)} title="Delete Job" />}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <Clock size={20} color="#f59e0b" className="action-btn" style={{ cursor: 'pointer' }} onClick={() => handleViewLogs(row)} title="View Logs" />
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <MessageSquare size={20} color="#10b981" style={{ cursor: 'pointer' }} onClick={() => onAction && onAction('timeline', row)} title="Timeline Log" />
                      </td>
                    <td style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {isLocked && <Lock size={12} strokeWidth={2.5} color="#dc2626" />}
                      {row.jobNo}
                    </td>
                    <td style={{ padding: '8px' }}>{row.jobDate}</td>
                    <td style={{ padding: '8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {row.docketNo === 'UN-REGISTERED'
                        ? (isVoid ? row.docketNo : <span role="button" tabIndex={0} onClick={() => setDocketJob(row)} onKeyDown={(e) => { if (e.key === 'Enter') setDocketJob(row); }} title="Click to register the shipment: makes the docket no and the entry in Shipment Registration"
                            style={{ cursor: 'pointer', color: '#1d4ed8', borderBottom: '1px dashed #1d4ed8' }}>UN-REGISTERED</span>)
                        : <span role="button" tabIndex={0} onClick={() => openDocket(row)} onKeyDown={(e) => { if (e.key === 'Enter') openDocket(row); }} title="Open the docket in Shipment Registration"
                            style={{ cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '3px' }}>{row.docketNo}</span>}
                    </td>
                  <td style={{ padding: '8px' }}>{row.importer}</td>
                  <td style={{ padding: '8px' }}>{row.supplier}</td>
                  <td style={{ padding: '8px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{row.origin}</td>
                  <td style={{ padding: '8px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{row.destination}</td>
                  <td style={{ padding: '8px' }}>{row.invNo}</td>
                  <td style={{ padding: '8px' }}>{row.invDt}</td>
                  <td style={{ padding: '8px' }}>{row.containerNo === 'N/A' ? '' : row.containerNo}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{row.invValue}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{row.assessableValue}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{row.dutyValue}</td>
                  
                  {/* Action Icons identical to export style */}
                    <td style={{ padding: '8px' }}>{row.beNo}</td>
                    <td style={{ padding: '8px' }}>{row.beDate}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}><div onClick={(() => toast(row.icegateUniqueId ? ('ICEGATE: ' + (row.icegateStatus || 'SENT') + ' | Unique ID ' + row.icegateUniqueId) : (row.beNo ? ('BE No ' + row.beNo) : 'Not filed on ICEGATE yet')))} style={{ background: '#22c55e', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', cursor: 'pointer' }}><Link size={10} /></div></td>
                  <td style={{ padding: '8px', textAlign: 'center' }}><ClipboardList onClick={(() => onAction && onAction('open:reports', row))} size={16} color="var(--text-muted, var(--text-muted, #64748b))" style={{ cursor: 'pointer' }} /></td>
                  <td style={{ padding: '8px', fontSize: '10px' }}>{row.icegateStatus || row.status || 'DRAFT'}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}><ClipboardList onClick={(() => onAction && onAction('open:reports', row))} size={16} color="var(--primary-color-start)" style={{ cursor: 'pointer' }} /></td>
                  <td style={{ padding: '8px', textAlign: 'center' }}><ClipboardList onClick={(() => onAction && onAction('open:reports', row))} size={16} color="var(--primary-color-start)" style={{ cursor: 'pointer' }} /></td>
                  <td style={{ padding: '8px', textAlign: 'center' }}><FileSpreadsheet onClick={(() => onAction && onAction('open:reports', row))} size={16} color="#22c55e" style={{ cursor: 'pointer' }} /></td>
                  <td style={{ padding: '8px', textAlign: 'center' }}><Folder onClick={(() => onAction && onAction('open:esanchit', row))} size={16} color="var(--primary-color-start, #0ea5e9)" style={{ cursor: 'pointer' }} /></td>
                  <td style={{ padding: '8px', textAlign: 'center' }}><div onClick={(() => onAction && onAction('open:items', row))} style={{ background: '#22c55e', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', cursor: 'pointer' }}><Link size={10} /></div></td>
                  <td style={{ padding: '8px', textAlign: 'center' }}><Edit3 onClick={(() => onAction && onAction('open:items', row))} size={16} color="var(--primary-color-start, #0ea5e9)" style={{ cursor: 'pointer' }} /></td>
                  <td style={{ padding: '8px', textAlign: 'center' }}><Edit3 onClick={(() => onAction && onAction('amend', row))} size={16} color="var(--primary-color-start, #0ea5e9)" style={{ cursor: 'pointer' }} /></td>
                  <td style={{ padding: '8px', textAlign: 'center' }}><MapPin onClick={(() => onAction && onAction('timeline', row))} size={16} color="#ef4444" style={{ cursor: 'pointer' }} /></td>
                  <td style={{ padding: '8px' }}>{row.lockedBy}</td>
                  <td style={{ padding: '8px' }}>{row.enteredBy}</td>
                  <td style={{ padding: '8px', fontSize: '10px' }}>{row.enteredDate}</td>
                </tr>
                  );
                })}
            </tbody>
          </table>
          ) : (
            <DsrExcelGrid data={filteredData} onSave={handleDsrSave} />
          )}
        </div>

        {/* Status Legend */}
        <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-panel, #ffffff)', borderTop: '1px solid var(--border-color, #cbd5e1)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', padding: '6px 14px', fontSize: '11px', background: '#fee2e2', fontWeight: 600, borderRadius: '999px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Lock size={12} strokeWidth={2.5} /> LOCKED JOB
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ffedd5', color: '#ea580c', padding: '6px 14px', fontSize: '11px', fontWeight: 600, borderRadius: '999px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Ban size={12} strokeWidth={2.5} /> VOID JOB
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fef08a', color: '#a16207', padding: '6px 14px', fontSize: '11px', fontWeight: 600, borderRadius: '999px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <CheckCircle size={12} strokeWidth={2.5} /> RECEIVED BE NO
          </span>
        </div>
      </div>
      <RowContextMenu menu={rowMenu} onClose={closeRowMenu} />
    </div>
  );
}

