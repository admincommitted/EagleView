import React, { useState, useEffect, useRef } from 'react';
import JobFilesPanel from '../../common/JobFilesPanel';
import { Lock, Clock, Ban, CheckCircle, Search, Filter, MoreVertical, Plus, Download, FolderOpen, FileCheck, CheckSquare, FileText, UploadCloud, AlertTriangle, PenTool, Edit2, Copy, Link, ClipboardList, FolderPlus, FolderMinus, FileSpreadsheet, Folder, Edit3, MapPin, MessageSquare, Trash2, Eye } from 'lucide-react';
import RowContextMenu from '../../common/RowContextMenu'; // 18-Nov-2026: right-click menu of a job row
import { useNavigate } from 'react-router-dom';
import DocketRegisterModal, { docketPath } from '../../DocketRegisterModal'; // 13-Nov-2026: Docket No column as on the Import list
import QueryResolutionDrawer from '../../../components/JobEntry/Tabs/QueryResolutionDrawer';
import ModernDatePicker from '../../common/ModernDatePicker';
import BodyPortal from '../../common/BodyPortal';

import toast from 'react-hot-toast';
import { useGlobalContext } from '../../../GlobalContext';
import { getMaster } from '../../../utils/masterCache';
import { toNotation } from '../../../utils/cbicExchange';

// 29-Oct-2026 job list fixes: dates as 05-Sep-2026 and filtered as real dates; status filter by job stage;
// branch / financial year; Search reloads; row colours of the legend; SB Track and Amend work; Excel list download.
// 13-Nov-2026: dd/mm/yyyy, as the Import job list (was 05-Sep-2026)
const fmtD = (v) => { if (!v) return ''; const s = String(v).trim(); let m;
  if ((m = /^(\d{4})-?(\d{2})-?(\d{2})(?:$|T|\s)/.exec(s))) return `${m[3]}/${m[2]}/${m[1]}`;
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s))) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
  const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString('en-GB'); };
const isoD = (v) => { if (!v) return ''; const s = String(v).trim(); const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`; const d = new Date(s); return isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const AFTER_LEO = ['LEO', 'GATE_PASS', 'DEPARTED', 'DELIVERED'];
const STAGE_TXT = { DRAFT: 'DRAFT', SUBMITTED: 'SB FILED', TD_DONE: 'TD DONE', XRAY_DONE: 'X-RAY DONE', LEO: 'LEO', GATE_PASS: 'GATE PASS', DEPARTED: 'DEPARTED', DELIVERED: 'DELIVERED', CANCELLED: 'VOID' };
// legend colours: void = cancelled, locked = LEO given (SB cannot be changed), received SB No = SB No on the job
// 13-Nov-2026: row look of the Import job list - locked red text, void orange struck through, SB No received green
const rowLook = (r) => r.stage === 'CANCELLED' ? { backgroundColor: '#ffedd5', color: '#ea580c', textDecoration: 'line-through red' }
  : AFTER_LEO.includes(r.stage) ? { backgroundColor: '#fee2e2', color: '#dc2626' }
  : (r.sbNo || r.sbNumber) ? { backgroundColor: '#f0fdf4', color: '#166534' } : {};
// 18-Nov-2026: the SB Header keeps MAWB / HAWB in autoField_22 / autoField_24 - search by MAWB / HAWB found nothing, and
// search by Sub Agent matched MAWB / HAWB numbers
const SEARCH_KEYS = { JOB_NO: ['jobNo'], SB_NO: ['sbNo', 'sbNumber'], EXPORTER: ['exporter', 'shipperName'], CONSIGNEE: ['consignee', 'consigneeName'],
  SUB_AGENT: ['subAgentName'], INVOICE: ['invNo'], MAWB: ['mawbNo', 'autoField_22', 'AirWayBillNo'], HAWB: ['hawbNo', 'autoField_24'] };
// first SB number / date found anywhere in an ICEGATE acknowledgement
function findSb(obj) {
  let no = '', dt = '';
  const walk = (o) => { if (!o || typeof o !== 'object' || (no && dt)) return; for (const [k, v] of Object.entries(o)) { const kk = k.toLowerCase().replace(/[^a-z]/g, ''); if (v && typeof v === 'object') walk(v); else if (!no && /^(sbno|sbnumber|shippingbillno|shippingbillnumber)$/.test(kk) && /^\d{5,10}$/.test(String(v).trim())) no = String(v).trim(); else if (!dt && /^(sbdate|shippingbilldate)$/.test(kk) && v) dt = String(v).trim(); } };
  walk(obj); return { sbNo: no, sbDate: dt };
}

// ---- "Create Job from Excel" + sample files. Sheet "Job": one row with the columns below; sheet "Items": item rows. 28-Oct-2026
const JOB_COLS = ['Mode', 'Shipper Name', 'Shipper IEC', 'Consignee Name', 'Consignee Address', 'Consignee Country', 'Port of Loading', 'Port of Discharge', 'Country of Discharge', 'Port of Destination', 'Destination Country', 'Invoice No', 'Invoice Date', 'Currency', 'Invoice Value', 'Terms', 'Exchange Rate', 'Freight', 'Insurance'];
const ITEM_COLS = ['InvSr', 'Scheme', 'RITC', 'Description', 'Qty', 'Unit', 'Rate'];
function downloadExportSample(kind) {
  import('xlsx').then(XLSX => {
    const wb = XLSX.utils.book_new();
    const items = [ITEM_COLS, [1, '00', '85171300', 'MOBILE PHONES', 10, 'NOS', 100]];
    if (kind === 'job') XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([JOB_COLS, ['AIR', 'EXPORTER NAME', 'ABCDE1234F', 'BUYER NAME', 'BUYER ADDRESS', 'US', 'INDEL4', 'USJFK', 'US', 'USJFK', 'US', 'EXP/001', '2026-10-01', 'USD', 1000, 'FOB', '', '', ''], ['', '', '', '', '', '', '', '', '', '', '', 'EXP/002', '2026-10-01', 'USD', 500, 'FOB', '', '', '']]), 'Job');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(items), 'Items');
    XLSX.writeFile(wb, kind === 'job' ? 'Export_Job_Sample.xlsx' : 'Export_Item_Sample.xlsx');
  }).catch(e => toast.error('Could not create the sample: ' + e.message));
}
async function readExportJobExcel(file) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
  const sheet = (n) => { const k = wb.SheetNames.find(x => x.toLowerCase() === n); return k ? XLSX.utils.sheet_to_json(wb.Sheets[k], { defval: '' }) : null; };
  const norm = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.replace(/[^a-z]/gi, '').toLowerCase(), String(v).trim()]));
  const jobRows = sheet('job') || XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const j = norm(jobRows[0] || {});
  if (!j.shippername && !j.consigneename) throw new Error('Sheet "Job" needs at least Shipper Name and Consignee Name (download "Export Job Excel" sample)');
  const mode = String(j.mode || 'AIR').toUpperCase().startsWith('S') ? 'SEA' : 'AIR';
  // header field names of the SB screen (were discPort / destPort / DestinationCountry, which the screen does not read,
  // so ports and countries came up empty). 29-Oct-2026
  const up = (v) => String(v || '').trim().toUpperCase();
  const exportData = {
    shipmentMode: mode, shipperName: j.shippername || '', shipperIec: /^\d{1,9}$/.test(j.shipperiec || '') ? j.shipperiec.padStart(10, '0') : (j.shipperiec || ''), // a numeric IEC cell loses its leading 0 (12-Nov-2026)
    consigneeName: j.consigneename || '', consigneeAddress1: j.consigneeaddress || '', consigneeCountryCode: up(j.consigneecountry),
    loadingPortCode: up(j.portofloading), customsPortCode: up(j.portofloading),
    discPortCode: up(j.portofdischarge), discCountryCode: up(j.countryofdischarge),
    destPortCode: up(j.portofdestination), destCountryCode: up(j.destinationcountry),
  };
  // Excel keeps dates as day numbers (46296) or as text 01-10-2026 / 2026-10-01: the screen wants YYYY-MM-DD
  const xdate = (v) => { const s = String(v || '').trim(); if (/^\d{5}(\.\d+)?$/.test(s)) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(parseFloat(s)) * 864e5); return d.toISOString().slice(0, 10); }
    let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return s; };
  // 12-Nov-2026: one invoice per row of sheet "Job" (only one was made, items of InvSr 2 had no invoice); amounts
  // without commas ("1,250.00" was kept as text and read as 1); the exchange rate from the sheet or the Currency
  // master (the invoice had none); the buyer is the consignee; items get the RITC's leading zero back, invoice
  // serials the job has, and item numbers per invoice.
  const num = (v) => { const t = String(v ?? '').replace(/,/g, '').trim(); if (t === '') return ''; const x = parseFloat(t); return isFinite(x) ? String(x) : ''; };
  const ritc8 = (v) => { const d = String(v ?? '').replace(/\D/g, ''); return d.length === 7 ? '0' + d : d; };
  let curs = []; try { const c = await getMaster('/api/masters/currencies'); curs = Array.isArray(c) ? c : (c && c.data) || []; } catch (e) { curs = []; }
  const rateFor = (cur) => { const m = curs.find(x => String(x.currencyCode || '').toUpperCase() === cur); return m && parseFloat(m.exportRate) > 0 ? toNotation(cur, m.exportRate) : null; };
  const invRows = jobRows.map(norm).filter((r, k) => k === 0 || r.invoiceno);
  const invoices = invRows.map((r, k) => {
    const cur = up(r.currency || j.currency); const terms = up(r.terms || j.terms || 'FOB').replace('C&F', 'CF');
    const typed = num(r.exchangerate || r.exchrate || r.rate); const fromMaster = typed ? null : rateFor(cur);
    return { id: k + 1, no: (r.invoiceno || '').toUpperCase(), date: xdate(r.invoicedate), currency: cur, value: num(r.invoicevalue), contractType: terms, natureOfContract: terms,
      addFreight: ({ CIF: 'B', CI: 'I', CF: 'F', FOB: 'N' })[terms] || 'N', exchRate: typed || (fromMaster ? String(fromMaster.rate) : ''), unitInRs: fromMaster ? fromMaster.unitInRs : (['JPY', 'KRW'].includes(cur) ? 100 : 1),
      freightAmount: num(r.freight), freightCurr: num(r.freight) ? cur : '', insuranceAmount: num(r.insurance), insuranceCurr: num(r.insurance) ? cur : '',
      consigneeSame: 'Y', buyer: exportData.consigneeName, buyerName: exportData.consigneeName, buyerAddress1: exportData.consigneeAddress1 };
  });
  const nextSr = {}; const skipped = [];
  const items = (sheet('items') || []).map(norm).filter(r => r.ritc || r.description).map((r, i) => {
    const invSr = parseInt(r.invsr || '1', 10) || 1;
    if (invSr > invoices.length) { skipped.push(`row ${i + 2} (InvSr ${r.invsr})`); return null; }
    nextSr[invSr] = (nextSr[invSr] || 0) + 1;
    const qty = num(r.qty || r.quantity), rate = num(r.rate || r.price), unit = up(r.unit || 'NOS').slice(0, 3);
    return { id: Date.now() + i, invSr, itemSr: nextSr[invSr], scheme: r.scheme || '', ritc: ritc8(r.ritc), desc: up(r.description),
      qty, unit, per: '1', rate, rateUnit: unit, totalFc: (parseFloat(qty) || 0) && (parseFloat(rate) || 0) ? (parseFloat(qty) * parseFloat(rate)).toFixed(2) : '' };
  }).filter(Boolean);
  if (skipped.length) toast.error(`${skipped.length} item row(s) left out - sheet "Job" has ${invoices.length} invoice(s): ${skipped.slice(0, 4).join(', ')}`, { duration: 8000 });
  const noRate = invoices.filter(v => !v.exchRate).map(v => v.currency || '?');
  if (noRate.length) toast(`No exchange rate for ${[...new Set(noRate)].join(', ')} - enter it on the Invoices tab`, { icon: '⚠️', duration: 7000 });
  return { exportData: { ...exportData, invoices }, items };
}

export default function ExportQueryTab({ onAction, refreshKey = 0 }) {
  
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const downloadMenuRef = useRef(null);
  const downloadMenuBoxRef = useRef(null); // 19-Nov-2026: the menu itself, drawn at the end of <body>
  // the menu is placed on the page (fixed) under the button: inside the toolbar box it was cut off, only the first
  // entry showed. 29-Oct-2026
  const [menuPos, setMenuPos] = useState(null);
  useEffect(() => {
    if (!showDownloadMenu) return;
    const close = () => setShowDownloadMenu(false);
    window.addEventListener('resize', close); window.addEventListener('scroll', close, true);
    const esc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    return () => { window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); document.removeEventListener('keydown', esc); };
  }, [showDownloadMenu]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target) && !(downloadMenuBoxRef.current && downloadMenuBoxRef.current.contains(event.target))) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isAmendModalOpen, setIsAmendModalOpen] = useState(false);
  const [amendJobId, setAmendJobId] = useState(null);
  const [amendmentType, setAmendmentType] = useState('General');
  const [amendReason, setAmendReason] = useState('');
  const searchWrapperRef = useRef(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  const [dashboardData, setDashboardData] = useState([]);
  const [searchType, setSearchType] = useState('ALL');
  const [filterMode, setFilterMode] = useState('ALL');
  // 13-Nov-2026: Files / Log / Docket No columns of the Import job list
  const nav = useNavigate();
  const [docketJob, setDocketJob] = useState(null);
  const openDocket = (d) => nav(docketPath(d.docketDivision || d.division, d.docketNo));
  const [docsModal, setDocsModal] = useState(null); // { job, rows, files, loading }
  const [logsModal, setLogsModal] = useState(null); // { job, logs, loading }
  const handleViewLogs = async (job) => {
    setLogsModal({ job, logs: [], loading: true });
    try { const r = await fetch(`/api/export-jobs/${job.id}/logs`); const d = await r.json(); setLogsModal({ job, logs: Array.isArray(d) ? d : [], loading: false }); if (!r.ok) toast.error(d.error || 'Failed to fetch logs'); }
    catch (e) { toast.error('Error fetching logs'); setLogsModal({ job, logs: [], loading: false }); }
  };
  const handleViewDocs = async (job) => {
    setDocsModal({ job, rows: [], files: [], loading: true });
    const arr = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } return Array.isArray(v) ? v : []; };
    try {
      const j = await fetch(`/api/export-jobs/${job.id}`).then(r => r.json());
      const d = (j && j.data) || {};
      const rows = []; const seenDoc = new Set();
      const add = (level, x) => { if (!x) return; const g = x._icegate || {}; const irn = x.irn || g.imageReferenceNumber || ''; const code = x.docCode || g.documentTypeCode || '';
        const key = level + '|' + irn + '|' + code + '|' + (x.fileName || ''); if (seenDoc.has(key)) return; seenDoc.add(key);
        rows.push({ level, docCode: code, docName: x.docName || '', irn, fileName: x.fileName || g.fileType || '', fileUrl: x.fileUrl || '', issuerName: x.issuerName || x.issuingParty || g.documentIssuingPartyName || '', issueDate: x.issueDate || g.documentIssueDate || '' }); };
      arr(d.eSanchitList).forEach(x => add('SB', x));
      const items = arr(d.items).length ? arr(d.items) : arr(d.invoices).flatMap((inv, k) => arr(inv.items).map(it => ({ ...it, invSr: it.invSr || k + 1 })));
      items.forEach(it => [...arr(it.eSanchitList), ...arr(it.suppDocs), ...arr(it.supportDocs)].forEach(x => add(`Item ${it.invSr || 1}/${it.itemSr || it.itemNo || ''}`, x)));
      const files = [];
      for (const k of [...new Set([job.jobNo, 'job-' + job.id].filter(Boolean))]) { try { const a = await fetch('/api/icegate/esanchit-archive?jobNo=' + encodeURIComponent(k)).then(r => r.json()); (a && a.data || []).forEach(f => files.push(f)); } catch (e) { /* no archive */ } }
      (job.finalDocs || []).forEach(f => { if (f && f.fileUrl) files.push({ fileName: (f.docType || 'FINAL') + ' - ' + String(f.fileUrl).split('/').pop(), fileUrl: f.fileUrl, final: true }); });
      const seen = new Set();
      setDocsModal({ job, rows, files: files.filter(f => { if (seen.has(f.fileUrl)) return false; seen.add(f.fileUrl); return true; }), loading: false });
    } catch (e) { toast.error('Could not load the documents: ' + e.message); setDocsModal(m => m ? { ...m, loading: false } : m); }
  };
  const [loadError, setLoadError] = useState('');
  const [trackJob, setTrackJob] = useState(null);
  const [trackState, setTrackState] = useState({ loading: false, msg: '', raw: null });
  const { activeBranch, activeYear } = useGlobalContext();
  // was declared below this line: typing in the search box crashed the tab ("Cannot access dashboardData before initialization")
  const dropdownResults = (isSearchOpen && searchTerm.length > 0) ? dashboardData.filter(job => 
      (job.jobNo && job.jobNo?.toLowerCase()?.includes(searchTerm?.toLowerCase())) || 
      (job.sbNo && String(job.sbNo).toLowerCase().includes(searchTerm?.toLowerCase())) || 
      (job.autoField_24 && String(job.autoField_24).toLowerCase().includes(searchTerm?.toLowerCase())) || 
      (job.subAgentName && String(job.subAgentName).toLowerCase().includes(searchTerm?.toLowerCase())) || 
      (job.autoField_22 && String(job.autoField_22).toLowerCase().includes(searchTerm?.toLowerCase())) || 
      (job.exporter && job.exporter?.toLowerCase()?.includes(searchTerm?.toLowerCase())) || 
      (job.consignee && job.consignee?.toLowerCase()?.includes(searchTerm?.toLowerCase()))
  ) : [];

  const handleKeyDown = (e) => {
    if (!isSearchOpen || dropdownResults.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev < dropdownResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < dropdownResults.length) {
        setSearchTerm(dropdownResults[focusedIndex].jobNo);
        setIsSearchOpen(false);
        setFocusedIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
      setFocusedIndex(-1);
    }
  };

  
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

  const [reloadKey, setReloadKey] = useState(0);
  // jobs of the selected branch / year; "Show all" lists every branch and year (jobs saved under another branch or
  // year did not show and the list looked empty)
  const [allBranches, setAllBranches] = useState(false);
  const [otherCount, setOtherCount] = useState(0);
  const loadJobs = (announce) => {
    const q = new URLSearchParams();
    if (!allBranches && activeBranch?.id && !activeBranch.isAll) q.set('branchId', activeBranch.id);
    if (!allBranches && activeYear?.id) q.set('financialYearId', activeYear.id);
    return fetch('/api/export-jobs' + (q.toString() ? '?' + q : '')).then(res => res.json()).then(data => {
       if (data.success) {
           setLoadError('');
           const rows = data.data.map(job => ({
               ...job,
               id: job.id, 
               jobNo: job.jobNo, 
               docketNo: job.docketNo || 'UN-REGISTERED', 
               jobDateIso: isoD(job.jobDate || job.createdAt),
               jobDate: fmtD(job.jobDate || job.createdAt),
               enteredAt: job.createdAt,
               exporter: job.exporter || job.shipperName, 
               consignee: job.consignee || job.consigneeName, 
               origin: job.origin || job.customsPort || job.customsPortCode, 
               destination: job.destination || job.destPortCode || job.destCountryCode || job.destCountry || job.DestinationCountry || '',
               stage: job.stage || 'DRAFT',
           }));
           setDashboardData(rows);
           setOtherCount(data.filtered && data.totalAll > rows.length ? data.totalAll - rows.length : 0);
           return rows;
       }
       // the list used to stay empty without a word when the server answered with an error
       const msg = data.error || data.message || 'could not load the job list';
       setLoadError(msg); toast.error('Job list: ' + msg); return null;
    }).catch(err => { setLoadError(err.message); toast.error('Job list: ' + err.message); return null; });
  };
  useEffect(() => { loadJobs(); }, [refreshKey, reloadKey, activeBranch?.id, activeYear?.id, allBranches]);

  const handleQueryClick = (job) => {
    setSelectedJob(job);
    setDrawerOpen(true);
  };

  const filteredData = dashboardData.filter(row => {
      let pass = true;
      if (fromDate && row.jobDateIso < fromDate) pass = false;
      if (toDate && row.jobDateIso > toDate) pass = false;
      if (filterMode !== 'ALL' && (String(row.shipmentMode || '').toUpperCase().startsWith('S') ? 'SEA' : String(row.shipmentMode || '').toUpperCase().startsWith('L') ? 'LAND' : 'AIR') !== filterMode) pass = false;
      if (statusFilter === 'LEO') { if (!AFTER_LEO.includes(row.stage)) pass = false; }
      else if (statusFilter !== 'All' && row.stage !== statusFilter) pass = false;
      return pass;
  }).filter(row => 
      !searchTerm || (searchType !== 'ALL' ? (SEARCH_KEYS[searchType] || []).some(k => row[k] && String(row[k]).toLowerCase().includes(searchTerm.toLowerCase())) : false) || (searchType === 'ALL' && (
      (row.jobNo && row.jobNo?.toLowerCase()?.includes(searchTerm?.toLowerCase())) || 
      (row.sbNo && String(row.sbNo).toLowerCase().includes(searchTerm?.toLowerCase())) || 
      (row.autoField_24 && String(row.autoField_24).toLowerCase().includes(searchTerm?.toLowerCase())) || 
      (row.subAgentName && String(row.subAgentName).toLowerCase().includes(searchTerm?.toLowerCase())) || 
      (row.autoField_22 && String(row.autoField_22).toLowerCase().includes(searchTerm?.toLowerCase())) || 
      (row.exporter && row.exporter?.toLowerCase()?.includes(searchTerm?.toLowerCase())) || 
      (row.consignee && row.consignee?.toLowerCase()?.includes(searchTerm?.toLowerCase())) ||
      (row.invNo && String(row.invNo).toLowerCase().includes(searchTerm?.toLowerCase())))
  ));

  // Search: reload from the server, then say how many jobs match (the list also filters while typing)
  const handleSearchClick = async () => {
    if (fromDate && toDate && fromDate > toDate) { toast.error('From date is after To date'); return; }
    const rows = await loadJobs();
    if (rows) setAnnounce(true);
  };
  const [announce, setAnnounce] = useState(false);
  useEffect(() => {
    if (!announce) return;
    setAnnounce(false);
    if (filteredData.length) toast.success(`${filteredData.length} job(s) found`); else toast.error('No job found for the selected criteria');
  }, [announce, filteredData.length]);

  // SB Track: job stage, SB No and the ICEGATE acknowledgement of the filed SB
  const openTrack = (row) => { setTrackJob(row); setTrackState({ loading: false, msg: '', raw: null }); };

  // 18-Nov-2026: right-click on a job = every action of the row icons and of the job's ACTIONS menu in one place.
  // Preview JSON / flat file (.sb), Send to ICEGATE and AI PDF Extract open the job and start by themselves (the export
  // screen fills values on opening, so the file is made from the open job). The row icons stay as they were.
  const [rowMenu, setRowMenu] = useState(null);
  const closeRowMenu = React.useCallback(() => setRowMenu(null), []);
  const openUrl = (u) => { if (u) window.open(u, '_blank', 'noopener'); };
  const rowMenuItems = (row) => {
    const isLocked = AFTER_LEO.includes(row.stage);
    const isVoid = row.stage === 'CANCELLED';
    const filed = !!(row.sbNo || row.sbNumber || row.icegateStatus);
    const fd = (t) => ((row.finalDocs || []).find(d => d.docType === t) || {}).fileUrl;
    const act = (a) => () => onAction && onAction(a, row.id, row);
    return [
      { head: 'Job ' + (row.jobNo || '') },
      { label: 'Open job', icon: Edit2, onClick: act('edit') },
      { label: 'Documents (e-Sanchit + files)', icon: FolderOpen, onClick: () => handleViewDocs(row) },
      { label: 'Duplicate job', icon: Copy, onClick: act('duplicate') },
      { label: 'View logs', icon: Clock, onClick: () => handleViewLogs(row) },
      { label: 'Timeline / chat', icon: MessageSquare, onClick: act('timeline') },
      { label: 'SB track (ICEGATE reply)', icon: CheckCircle, onClick: () => openTrack(row) },
      { sep: true },
      { head: 'Opens the job and starts' },
      { label: 'Preview JSON', icon: Eye, onClick: act('open-preview'), title: 'The screen fills FOB INR, drawback, party values on opening - the file is made from the open job' },
      { label: 'Download SB Flat File (.sb)', icon: Download, onClick: act('open-flat'), title: 'The screen fills FOB INR, drawback, party values on opening - the file is made from the open job' },
      { label: 'Send to ICEGATE', icon: UploadCloud, iconColor: '#16a34a', onClick: act('open-send'), disabled: isLocked || isVoid, title: isVoid ? 'Cancelled job' : isLocked ? 'LEO given - change it with Amend' : '' },
      { label: 'AI PDF Extract (invoice)', icon: UploadCloud, iconColor: '#a855f7', onClick: act('open-ai'), disabled: isLocked, title: isLocked ? 'LEO given' : '' },
      { label: 'Amend Shipping Bill', icon: Edit3, onClick: () => { setAmendJobId(row.id); setIsAmendModalOpen(true); }, disabled: !filed, title: filed ? '' : 'Not filed yet - change it with Open job' },
      { label: 'Print checklist', icon: ClipboardList, onClick: act('print_checklist') },
      { label: 'e-Sanchit documents (Items tab)', icon: Folder, onClick: act('esanchit') },
      { label: 'Scheme / licence', icon: FileText, onClick: act('scheme') },
      { sep: true },
      row.docketNo === 'UN-REGISTERED'
        ? { label: 'Register shipment (make docket)', icon: ClipboardList, onClick: () => setDocketJob(row), disabled: isVoid }
        : { label: 'Open docket ' + (row.docketNo || ''), icon: ClipboardList, onClick: () => openDocket(row), disabled: !row.docketNo },
      { label: 'First copy', icon: FileCheck, onClick: () => openUrl(fd('FIRST_COPY')), disabled: !row.hasFirstCopy, note: row.hasFirstCopy ? '' : 'not yet' },
      { label: 'LEO copy', icon: FileCheck, onClick: () => openUrl(fd('LEO_COPY')), disabled: !row.hasLeoCopy, note: row.hasLeoCopy ? '' : 'not yet' },
      { label: 'Gate pass', icon: FileCheck, onClick: () => openUrl(fd('GATEPASS')), disabled: !row.hasGatepass, note: row.hasGatepass ? '' : 'not yet' },
      { sep: true },
      { label: 'Delete job', icon: Trash2, danger: true, onClick: act('delete'), disabled: isLocked, title: isLocked ? 'Locked job (LEO given)' : '' },
    ];
  };
  const checkIcegate = async () => {
    const uid = trackJob && (trackJob.icegateUniqueId || trackJob.uniqueId);
    if (!uid) { setTrackState({ loading: false, msg: 'This SB has not been sent to ICEGATE from here (no Unique ID).', raw: null }); return; }
    setTrackState({ loading: true, msg: '', raw: null });
    try {
      // 17-Nov-2026: /sb-ack asks with the ICEGATE ID the SB went out with (get-ack used the default ID: "Authorization
      // failed" for a SB sent with another ID), reads ICEGATE's status text (e.g. "DSC Verification Failed"), saves the
      // SB No / status on the job and writes the job log
      const r = await fetch('/api/icegate/sb-ack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: trackJob.id }) });
      const d = await r.json();
      if (!d.success) { setTrackState({ loading: false, msg: 'ICEGATE: ' + (d.error || 'no answer'), raw: null }); return; }
      const j = d.job || {};
      const sb = { sbNo: d.sbNo || findSb(d.meta).sbNo, sbDate: d.sbDate };
      setTrackJob({ ...trackJob, icegateStatus: j.icegateStatus || trackJob.icegateStatus, sbNo: j.sbNo || trackJob.sbNo, sbDate: j.sbDate || trackJob.sbDate });
      if (j.sbNo && j.sbNo !== String(trackJob.sbNo || '')) toast.success(`SB No ${j.sbNo} saved on job ${trackJob.jobNo}`);
      if (j.icegateStatus !== trackJob.icegateStatus || (j.sbNo && j.sbNo !== String(trackJob.sbNo || ''))) loadJobs();
      const errs = (d.errors || []).filter(e => e.text !== d.message).map(e => (e.code ? e.code + ': ' : '') + e.text);
      const head = { accepted: 'Accepted', rejected: 'REJECTED by ICEGATE', pending: 'Still pending at ICEGATE', error: 'Could not ask ICEGATE' }[d.state] || 'ICEGATE answered';
      setTrackState({ loading: false, msg: sb.sbNo ? `SB No ${sb.sbNo}${sb.sbDate ? ' dated ' + fmtD(sb.sbDate) : ''} received from ICEGATE (asked as ${d.senderId}).` : `${head}${d.message ? ': ' + d.message : ''} (asked as ${d.senderId}).${errs.length ? ' Errors: ' + errs.join('; ') : ''}`, raw: d.meta });
    } catch (e) { setTrackState({ loading: false, msg: 'Could not reach ICEGATE: ' + e.message, raw: null }); }
  };

  // Amend: only a filed SB; the reason goes to the job timeline and the job opens for the change
  const submitAmend = async () => {
    const row = dashboardData.find(r => r.id === amendJobId);
    if (!amendReason.trim()) { toast.error('Enter the reason for the amendment'); return; }
    try {
      await fetch('/api/timeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: amendJobId, module: 'EXPORT', eventType: 'REMARK', message: `AMENDMENT (${amendmentType}): ${amendReason.trim()}` }) });
    } catch (e) { /* remark is not essential */ }
    setIsAmendModalOpen(false);
    onAction && onAction('amend', amendJobId, { amendmentType, amendReason: amendReason.trim(), jobNo: row?.jobNo });
    setAmendReason('');
  };

  const handleBulkZip = async () => {
    const urls = filteredData.map(row => row.finalDocs?.find(d => d.docType === 'LEO_COPY')?.fileUrl).filter(Boolean);
    if (urls.length === 0) {
      toast.error(`No LEO copy in the ${filteredData.length} job(s) listed. LEO copies show as a green "L" in the Docs column.`);
      return;
    }
    const t = toast.loading(`Zipping ${urls.length} LEO cop${urls.length > 1 ? 'ies' : 'y'}...`);
    
    try {
      const response = await fetch('/api/bulk-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: urls, zipName: 'LEO_Copies_Bulk.zip' })
      });
      
      if (!response.ok) { const j = await response.json().catch(() => ({})); throw new Error(j.error || 'Failed to download bulk ZIP'); }
      
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = 'LEO_Copies_Bulk.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('LEO copies downloaded', { id: t });
    } catch (e) {
      console.error(e);
      toast.error('Error downloading ZIP: ' + e.message, { id: t });
    }
  };

  // the listed jobs as an Excel file (was a CSV function with no button; it also broke on "#" and quotes)
  const handleExportExcel = () => {
    if (!filteredData.length) { toast.error('No jobs to download'); return; }
    import('xlsx').then(XLSX => {
      const headers = ['Job No', 'Job Date', 'Stage', 'Exporter', 'Consignee', 'Origin', 'Destination', 'Inv No', 'Inv Date', 'Inv Value', 'FOB Value', 'DBK Value', 'SB No', 'SB Date', 'Entered By'];
      const rows = filteredData.map(row => [row.jobNo || '', row.jobDate || '', STAGE_TXT[row.stage] || row.stage || '', row.exporter || '', row.consignee || '', row.origin || '', row.destination || '', row.invNo || '', fmtD(row.invDt), Number(row.invValue) || 0, Number(row.fobValue) || 0, Number(row.dbkValue) || 0, row.sbNo || row.sbNumber || '', fmtD(row.sbDate || row.autoField_26), row.enteredBy || '']);
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map((h, i) => ({ wch: Math.max(h.length, ...rows.map(r => String(r[i]).length)) + 2 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Export Jobs');
      XLSX.writeFile(wb, `Export_Jobs_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }).catch(e => toast.error('Could not create the Excel file: ' + e.message));
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', paddingRight: '0.5rem', position: 'relative' }}>
      
      <QueryResolutionDrawer module="EXPORT" isOpen={isDrawerOpen} onClose={() => setDrawerOpen(false)} job={selectedJob} />

      {docketJob && <DocketRegisterModal side="Export" job={{ ...docketJob, importer: docketJob.exporter }} onClose={() => setDocketJob(null)} onOpen={(d) => { setDocketJob(null); openDocket(d); }}
        onDone={(d) => setDashboardData(rows => rows.map(r => r.id === docketJob.id ? { ...r, docketNo: d.docketNo, docketDivision: d.division, docketId: d.id } : r))} />}

      {/* Files column: e-Sanchit documents of the SB / items and the PDFs kept with the job (as Import). 13-Nov-2026 */}
      {docsModal && (
        <div onClick={() => setDocsModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-panel, #fff)', borderRadius: '10px', width: '100%', maxWidth: '900px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '10px 14px', background: 'linear-gradient(135deg, var(--primary-color-start, #0ea5e9), var(--primary-color-end, #2563eb))', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '13px' }}>Documents - Job {docsModal.job.jobNo}{(docsModal.job.sbNo || docsModal.job.sbNumber) ? ` / SB ${docsModal.job.sbNo || docsModal.job.sbNumber}` : ''}</strong>
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
                        <td style={{ padding: '4px 6px' }}>{r.issueDate ? fmtD(String(r.issueDate).slice(0, 10)) : ''}</td>
                        <td style={{ padding: '4px 6px' }}>{r.fileUrl ? <a href={r.fileUrl} target="_blank" rel="noreferrer" title={r.fileName || r.fileUrl} style={{ color: '#2563eb', fontWeight: 600 }}>{/_signed\.pdf$/i.test(String(r.fileUrl)) ? 'Signed PDF' : 'PDF'}</a> : <span style={{ color: 'var(--text-muted, #94a3b8)' }}>{r.fileName ? 'not kept' : '-'}</span>}</td>
                      </tr>))}</tbody>
                  </table>) : <div style={{ color: 'var(--text-muted, #64748b)', marginBottom: '6px' }}>No e-Sanchit document on this job (3. Items &gt; e-Sanchit / Supporting Docs).</div>}
                {/* 18-Nov-2026: e-Sanchit PDFs as one line per document (attached + signed copy), unused ones can be removed, other shipment documents uploaded by hand */}
                <JobFilesPanel module="Export" jobId={docsModal.job.id} finals={docsModal.files.filter(f => f.final)} />
              </>)}
            </div>
          </div>
        </div>
      )}

      {/* Log column: job history (as Import) */}
      {logsModal && (
        <div onClick={() => setLogsModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-panel, #fff)', borderRadius: '10px', width: '100%', maxWidth: '560px', maxHeight: '75vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', background: 'linear-gradient(135deg, var(--primary-color-start, #0ea5e9), var(--primary-color-end, #2563eb))', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '13px' }}>Job Log - {logsModal.job.jobNo}</strong>
              <button onClick={() => setLogsModal(null)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '16px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '10px 14px', overflowY: 'auto', fontSize: '12px' }}>
              {logsModal.loading ? 'Loading...' : (logsModal.logs.length ? logsModal.logs.map((l, i) => (
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

      {/* SB Track window */}
      {trackJob && (
        <div onClick={() => setTrackJob(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '8px', width: '440px', maxWidth: '92vw', padding: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', fontSize: '12px', color: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ fontSize: '13px' }}>SB Track - {trackJob.jobNo}</strong>
              <button type="button" onClick={() => setTrackJob(null)} style={{ border: 'none', background: 'transparent', fontSize: '16px', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            {[
              ['Stage', STAGE_TXT[trackJob.stage] || trackJob.stage],
              ['ICEGATE', trackJob.icegateStatus ? `${trackJob.icegateStatus}${trackJob.icegateUniqueId ? ' - ' + trackJob.icegateUniqueId : ''}` : 'Not sent'],
              ['SB No / Date', trackJob.sbNo || trackJob.sbNumber ? `${trackJob.sbNo || trackJob.sbNumber}${trackJob.sbDate ? ' / ' + fmtD(trackJob.sbDate) : ''}` : 'Not received'],
              ['LEO', trackJob.leoDate ? fmtD(trackJob.leoDate) : '-'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}><span style={{ width: '110px', color: '#64748b', fontWeight: 600 }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>
            ))}
            {trackState.msg && <div style={{ marginTop: '10px', padding: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>{trackState.msg}</div>}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button type="button" onClick={() => { const id = trackJob.id; setTrackJob(null); onAction && onAction('timeline', id); }} style={{ height: '28px', padding: '0 12px', fontSize: '11px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Timeline</button>
              <button type="button" disabled={trackState.loading || !(trackJob.icegateUniqueId || trackJob.uniqueId)} onClick={checkIcegate} title={trackJob.icegateUniqueId ? 'Read the ICEGATE acknowledgement; a SB No found in it is saved on the job' : 'Send the SB to ICEGATE first'} style={{ height: '28px', padding: '0 12px', fontSize: '11px', border: 'none', background: (trackJob.icegateUniqueId || trackJob.uniqueId) ? '#2563eb' : '#94a3b8', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>{trackState.loading ? 'Checking...' : 'Check on ICEGATE'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Amend window (the Amend icon set these states but nothing was shown) */}
      {isAmendModalOpen && (
        <div onClick={() => setIsAmendModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '8px', width: '440px', maxWidth: '92vw', padding: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', fontSize: '12px', color: '#0f172a', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <strong style={{ fontSize: '13px' }}>Amend Shipping Bill - {dashboardData.find(r => r.id === amendJobId)?.jobNo}</strong>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 600, color: '#475569' }}>What changes
              <select className="input-field" value={amendmentType} onChange={e => setAmendmentType(e.target.value)} style={{ height: '28px', fontSize: '12px' }}>
                <option value="General">SB details (header)</option>
                <option value="Invoice">Invoice</option>
                <option value="Item">Item</option>
                <option value="ShortShip">Short shipment</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 600, color: '#475569' }}>Reason
              <textarea value={amendReason} onChange={e => setAmendReason(e.target.value)} rows={3} maxLength={200} placeholder="e.g. Gross weight corrected as per airline" style={{ fontSize: '12px', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', resize: 'vertical' }} />
            </label>
            <div style={{ fontSize: '11px', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '4px', padding: '6px 8px' }}>
              The job opens for the change; "Send to ICEGATE" then sends it as an amendment. ICEGATE's advisory says JSON filing of amendments is still being built, so check the acknowledgement - file it on the ICEGATE portal if it is not accepted.
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setIsAmendModalOpen(false)} style={{ height: '28px', padding: '0 12px', fontSize: '11px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={submitAmend} style={{ height: '28px', padding: '0 12px', fontSize: '11px', border: 'none', background: '#2563eb', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Open for amendment</button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="glass-panel qry-bar" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        
        {/* ROW 1 */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Mode filter and search field, as the Import list (13-Nov-2026) */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mode</span>
            <select className="input-field" style={{ height: '26px', width: '70px', padding: '0 8px', fontSize: '11px', borderColor: '#cbd5e1', borderRadius: '4px', color: '#334155', fontWeight: 600, outline: 'none' }} value={filterMode} onChange={(e) => setFilterMode(e.target.value)}>
              <option value="ALL">ALL</option>
              <option value="AIR">AIR</option>
              <option value="SEA">SEA</option>
              <option value="LAND">LAND</option>
            </select>
          </div>
          <select style={{ height: '26px', border: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: '4px', padding: '0 8px', fontSize: '11px', color: '#475569', fontWeight: 600, outline: 'none', width: '100px' }} value={searchType} onChange={(e) => setSearchType(e.target.value)}>
            <option value="ALL">ALL FIELDS</option>
            <option value="JOB_NO">JOB NO</option>
            <option value="SB_NO">SB NO</option>
            <option value="EXPORTER">EXPORTER</option>
            <option value="CONSIGNEE">CONSIGNEE</option>
            <option value="SUB_AGENT">SUB AGENT</option>
            <option value="INVOICE">INVOICE</option>
            <option value="MAWB">MAWB/MBL</option>
            <option value="HAWB">HAWB/HBL</option>
          </select>
          {/* Search Container */}
          <div ref={searchWrapperRef} style={{ position: 'relative', width: '260px' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Enter Search Term..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setIsSearchOpen(true); setFocusedIndex(-1); }}
              onFocus={() => setIsSearchOpen(true)}
              onKeyDown={handleKeyDown}
              style={{ paddingLeft: '2rem', width: '100%', height: '26px', fontSize: '11px' }}
            />
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, var(--text-muted, #64748b))' }} />
            
            {dropdownResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #cbd5e1', borderTop: 'none', zIndex: 50, maxHeight: '250px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                {dropdownResults.map((job, index) => (
                  <div 
                    key={job.id} 
                    onClick={() => { setSearchTerm(job.jobNo); setIsSearchOpen(false); setFocusedIndex(-1); }} 
                    onMouseEnter={() => setFocusedIndex(index)}
                    style={{ 
                        padding: '0.5rem 1rem', 
                        cursor: 'pointer', 
                        borderBottom: '1px solid #e2e8f0', 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        backgroundColor: focusedIndex === index ? '#f1f5f9' : 'white'
                    }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{job.jobNo}</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{job.exporter}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>From</span>
            <ModernDatePicker className="input-field" style={{ height: '26px', width: '85px', padding: '0 8px', fontSize: '11px', borderColor: '#cbd5e1', borderRadius: '4px', textAlign: 'center' }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>To</span>
            <ModernDatePicker className="input-field" style={{ height: '26px', width: '85px', padding: '0 8px', fontSize: '11px', borderColor: '#cbd5e1', borderRadius: '4px', textAlign: 'center' }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</span>
            <select className="input-field" style={{ height: '26px', padding: '0 8px', fontSize: '11px', borderColor: '#cbd5e1', borderRadius: '4px' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">ALL JOBS</option>
              <option value="DRAFT">DRAFT</option>
              <option value="SUBMITTED">SB FILED</option>
              <option value="TD_DONE">TD DONE</option>
              <option value="XRAY_DONE">X-RAY DONE</option>
              <option value="LEO">LEO / CLEARED</option>
              <option value="CANCELLED">VOID</option>
            </select>
          </div>

          <button className="btn btn-primary" style={{ height: '26px', padding: '0 16px', display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', fontWeight: 600, borderRadius: '4px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', border: 'none', color: '#fff', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }} onClick={handleSearchClick}>
            <Search size={14} /> Search
          </button>
          {(searchTerm || fromDate || toDate || statusFilter !== 'All' || filterMode !== 'ALL' || searchType !== 'ALL') && (
            <button type="button" onClick={() => { setSearchTerm(''); setFromDate(''); setToDate(''); setStatusFilter('All'); setFilterMode('ALL'); setSearchType('ALL'); }} style={{ height: '26px', padding: '0 10px', fontSize: '11px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '4px', cursor: 'pointer', color: '#475569' }}>Clear</button>
          )}
        </div>

        {/* ROW 2 */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" style={{ padding: '0 12px', height: '26px', fontSize: '11px', background: '#ecfdf5', color: '#047857', border: '1px solid #10b981', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }} onClick={handleBulkZip}>
              <FolderOpen size={14} /> Bulk LEO Zip
            </button>
            <button className="btn btn-success" style={{ padding: '0 12px', height: '26px', fontSize: '11px', background: '#22c55e', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px', cursor: 'pointer' }} onClick={() => onAction && onAction('new')}>
              <Plus size={14} /> New Job
            </button>
            <button className="btn btn-success" onClick={() => onAction && onAction('import-file', 'flat')} style={{ padding: '0 12px', height: '26px', fontSize: '11px', background: '#22c55e', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px', cursor: 'pointer' }}>
              <FileText size={14} /> Read Flat File
            </button>
            <button className="btn btn-success" onClick={() => document.getElementById('exportJobExcelInput').click()} style={{ padding: '0 12px', height: '26px', fontSize: '11px', background: '#22c55e', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px', cursor: 'pointer' }}>
              <FileSpreadsheet size={14} /> Create Job from Excel
            </button>
            <input id="exportJobExcelInput" type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={async (e) => {
              const f = e.target.files && e.target.files[0]; e.target.value = null; if (!f) return;
              try { const job = await readExportJobExcel(f); onAction && onAction('excel-job', job); }
              catch (err) { toast.error(err.message); }
            }} />
            
            <div style={{ position: 'relative' }} ref={downloadMenuRef}>
              <button 
                className="btn btn-warning" 
                style={{ padding: '0 12px', height: '26px', fontSize: '11px', background: '#f59e0b', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', borderRadius: '4px' }}
                onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenuPos({ top: r.bottom + 4, left: r.left }); setShowDownloadMenu(!showDownloadMenu); }}
              >
                <Download size={14} /> Download Sample
              </button>
              {/* 19-Nov-2026: drawn at the end of <body> - inside the toolbar box (backdrop-filter) a fixed menu was placed
                  ~200 px lower, behind the job list, and a click on it hit a job row */}
              {showDownloadMenu && (<BodyPortal>
                <div role="menu" ref={downloadMenuBoxRef} style={{ position: 'fixed', top: (menuPos && menuPos.top) || 0, left: Math.min((menuPos && menuPos.left) || 0, window.innerWidth - 300), background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 10px 25px rgba(15,23,42,0.18)', zIndex: 2000, width: '290px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {/* the old links pointed to /downloads/*.xls files that do not exist; these match "Create Job from Excel" and the Items tab "Import Excel" */}
                  {[
                    { kind: 'job', title: 'Export Job Excel', note: 'For "Create Job from Excel": sheet Job (exporter, consignee, ports, invoice) + sheet Items' },
                    { kind: 'items', title: 'Item Excel', note: 'For "Import Excel" in 3. Items: one row per item' },
                  ].map(o => (
                    <button key={o.kind} type="button" role="menuitem" onClick={() => { downloadExportSample(o.kind); setShowDownloadMenu(false); toast.success(o.title + ' sample downloaded'); }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      style={{ padding: '8px 12px', color: '#1e3a8a', background: 'transparent', border: 'none', borderBottom: '1px solid #f1f5f9', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <Download size={13} style={{ marginTop: '2px', flexShrink: 0 }} />
                      <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700 }}>{o.title}</span>
                        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500, textTransform: 'none' }}>{o.note}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </BodyPortal>)}
            </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel, #ffffff)' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--primary-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>Active Export Jobs Dashboard <span style={{ background: 'var(--primary-bg-light, #e0f2fe)', color: 'var(--primary-color, #0369a1)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>{filteredData.length}{filteredData.length !== dashboardData.length ? ` of ${dashboardData.length}` : ''}</span><span style={{ marginLeft: 'auto', fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Right-click a job for all its actions</span>
            <button type="button" onClick={handleExportExcel} title="Download the listed jobs as Excel" style={{ marginLeft: 'auto', height: '24px', padding: '0 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #10b981', background: '#ecfdf5', color: '#047857', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}><FileSpreadsheet size={13} /> Excel</button></h3>
          {loadError && <div style={{ marginTop: '6px', fontSize: '11px', color: '#b91c1c' }}>Could not load the job list: {loadError}</div>}
          {!loadError && (otherCount > 0 || allBranches) && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '4px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {allBranches ? 'Showing jobs of all branches and years.' : `${otherCount} more job(s) are saved under another branch / financial year.`}
              <button type="button" onClick={() => setAllBranches(v => !v)} style={{ height: '22px', padding: '0 8px', fontSize: '11px', border: '1px solid #d97706', background: '#fff', color: '#92400e', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>{allBranches ? `Only ${activeBranch?.branchName || activeBranch?.name || 'this branch'}` : 'Show all'}</button>
            </div>
          )}
        </div>
        
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', whiteSpace: 'nowrap' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--primary-bg-light, #e0f2fe)' }}>
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
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Exporter</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Consignee</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Origin</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Destination</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Inv No</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Inv Dt</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Container No</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'right' }}>Inv Value</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'right' }}>Fob Value</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'right' }}>Dbk Value</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>SB No</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>SB Date</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}>SB Track</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}>Print Checklist</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}>eSanchit</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}>Scheme</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}>Lic</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'center' }}>Amend</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Entered By</th>
                <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>Entered Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row) => { const isLocked = AFTER_LEO.includes(row.stage); const isVoid = row.stage === 'CANCELLED'; return (
                <tr key={row.id} className="hover-row" onContextMenu={(e) => { e.preventDefault(); setRowMenu({ x: e.clientX, y: e.clientY, items: rowMenuItems(row) }); }} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', ...rowLook(row) }}>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                      {row.hasFirstCopy ? <a href={row.finalDocs.find(d => d.docType === 'FIRST_COPY')?.fileUrl} target="_blank" title="First Copy Downloaded" style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '11px', padding: '3px 7px', borderRadius: '4px', textDecoration: 'none', fontWeight: 700, border: '1px solid #93c5fd', boxShadow: '0 0 6px rgba(37, 99, 235, 0.4)' }}>F</a> : <span style={{ background: '#f8fafc', color: '#cbd5e1', fontSize: '11px', padding: '3px 7px', borderRadius: '4px', fontWeight: 700, border: '1px solid #e2e8f0', cursor: 'not-allowed', textDecoration: 'none' }}>F</span>}
                      {row.hasLeoCopy ? <a href={row.finalDocs.find(d => d.docType === 'LEO_COPY')?.fileUrl} target="_blank" title="LEO Copy Downloaded" style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', padding: '3px 7px', borderRadius: '4px', textDecoration: 'none', fontWeight: 700, border: '1px solid #86efac', boxShadow: '0 0 6px rgba(22, 163, 74, 0.4)' }}>L</a> : <span style={{ background: '#f8fafc', color: '#cbd5e1', fontSize: '11px', padding: '3px 7px', borderRadius: '4px', fontWeight: 700, border: '1px solid #e2e8f0', cursor: 'not-allowed', textDecoration: 'none' }}>L</span>}
                      {row.hasGatepass ? <a href={row.finalDocs.find(d => d.docType === 'GATEPASS')?.fileUrl} target="_blank" title="Gatepass Downloaded" style={{ background: '#fef3c7', color: '#b45309', fontSize: '11px', padding: '3px 7px', borderRadius: '4px', textDecoration: 'none', fontWeight: 700, border: '1px solid #fcd34d', boxShadow: '0 0 6px rgba(217, 119, 6, 0.4)' }}>G</a> : <span style={{ background: '#f8fafc', color: '#cbd5e1', fontSize: '11px', padding: '3px 7px', borderRadius: '4px', fontWeight: 700, border: '1px solid #e2e8f0', cursor: 'not-allowed', textDecoration: 'none' }}>G</span>}
                    </div>
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <FolderOpen size={20} color="#0d9488" className="action-btn" style={{ cursor: 'pointer' }} onClick={() => handleViewDocs(row)} title="Documents of this job (e-Sanchit + PDFs)" />
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                      {/* a job after LEO still opens (view / print / amend from there); only Delete is closed, as on the Import list */}
                      <Edit2 size={20} color="var(--primary-color-start, #0ea5e9)" className="action-btn edit-btn" style={{ cursor: 'pointer' }} onClick={() => onAction && onAction('edit', row.id)} title={isLocked ? 'LEO given - opens the job (change it with Amend)' : 'Edit Job'} />
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <Copy size={20} color="#8b5cf6" className="action-btn duplicate-btn" style={{ cursor: 'pointer' }} onClick={() => onAction && onAction('duplicate', row.id)} title="Duplicate Job" />
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      {isLocked ? <Trash2 size={20} color="#94a3b8" style={{ cursor: 'not-allowed', opacity: 0.5 }} title="Locked Job (LEO given)" /> : <Trash2 size={20} color="#ef4444" className="action-btn delete-btn" style={{ cursor: 'pointer' }} onClick={() => onAction && onAction('delete', row.id, row)} title="Delete Job" />}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <Clock size={20} color="#f59e0b" className="action-btn" style={{ cursor: 'pointer' }} onClick={() => handleViewLogs(row)} title="View Logs" />
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <MessageSquare size={20} color="#10b981" style={{ cursor: 'pointer' }} onClick={() => onAction && onAction('timeline', row.id)} title="Timeline Log" />
                    </td>
                    <td style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {isLocked && <Lock size={12} strokeWidth={2.5} color="#dc2626" />}
                      {row.jobNo}
                    </td>
                    <td style={{ padding: '8px' }}>{row.jobDate}</td>
                    <td style={{ padding: '8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {row.docketNo === 'UN-REGISTERED'
                        ? (isVoid ? row.docketNo : <span role="button" tabIndex={0} onClick={() => setDocketJob(row)} onKeyDown={(e) => { if (e.key === 'Enter') setDocketJob(row); }} title="Click to register the shipment: makes the docket no and the entry in Shipment Registration"
                            style={{ cursor: 'pointer', color: '#1d4ed8', borderBottom: '1px dashed #1d4ed8', textDecoration: 'none' }}>UN-REGISTERED</span>)
                        : <span role="button" tabIndex={0} onClick={() => openDocket(row)} onKeyDown={(e) => { if (e.key === 'Enter') openDocket(row); }} title="Open the docket in Shipment Registration"
                            style={{ cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '3px' }}>{row.docketNo}</span>}
                    </td>
                  <td style={{ padding: '8px' }}>{row.exporter}</td>
                  <td style={{ padding: '8px' }}>{row.consignee}</td>
                  <td style={{ padding: '8px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{row.origin}</td>
                  <td style={{ padding: '8px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{row.destination}</td>
                  <td style={{ padding: '8px' }}>{row.invNo}</td>
                  <td style={{ padding: '8px' }}>{fmtD(row.invDt)}</td>
                  <td style={{ padding: '8px' }}>{row.containerNo}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{row.invValue}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{row.fobValue}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{row.dbkValue}</td>
                  <td style={{ padding: '8px' }}>{row.sbNo || row.sbNumber || ''}</td>
                  <td style={{ padding: '8px' }}>{fmtD(row.sbDate || row.autoField_26)}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}><div onClick={() => openTrack(row)} title="SB Track: stage, SB No, ICEGATE acknowledgement" style={{ background: (row.icegateUniqueId || row.sbNo) ? '#22c55e' : '#94a3b8', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', cursor: 'pointer' }}><Link size={10} /></div></td>
                  <td style={{ padding: '8px', textAlign: 'center' }}><ClipboardList size={16} color="#3b82f6" style={{ cursor: 'pointer' }} onClick={() => onAction && onAction('print_checklist', row.id)} title="Print Checklist" /></td>
                  <td style={{ padding: '8px', fontSize: '10px', fontWeight: 700, color: row.stage === 'CANCELLED' ? '#c2410c' : AFTER_LEO.includes(row.stage) ? '#15803d' : row.stage === 'DRAFT' ? '#64748b' : '#0369a1' }}>{STAGE_TXT[row.stage] || row.stage}{row.icegateStatus ? ` (${row.icegateStatus})` : ''}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}><Folder size={16} color="var(--primary-color-start, #0ea5e9)" style={{ cursor: 'pointer' }} onClick={() => onAction && onAction('esanchit', row.id)} title="eSanchit (Manage in Items Tab)" /></td>
                  <td style={{ padding: '8px', textAlign: 'center' }}><div style={{ background: '#22c55e', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', cursor: 'pointer' }} onClick={() => onAction && onAction('scheme', row.id)} title="Scheme"><Link size={10} /></div></td>
                  <td style={{ padding: '8px', textAlign: 'center' }}><div style={{ background: '#22c55e', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', cursor: 'pointer' }} onClick={() => onAction && onAction('scheme', row.id)} title="Lic"><Link size={10} /></div></td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <Edit3 size={16} color={(row.sbNo || row.icegateStatus) ? 'var(--primary-color-start, #0ea5e9)' : '#cbd5e1'} style={{ cursor: 'pointer' }} onClick={() => {
                      if (!(row.sbNo || row.sbNumber || row.icegateStatus)) { toast.error(`Job ${row.jobNo} is not filed yet - change it with Edit; only a filed SB is amended.`); return; }
                      setAmendJobId(row.id); setIsAmendModalOpen(true); }} title="Amend Shipping Bill" />
                  </td>
                  <td style={{ padding: '8px' }}>{row.enteredBy || '-'}</td>
                  <td style={{ padding: '8px', fontSize: '10px' }}>{row.enteredAt ? new Date(row.enteredAt).toLocaleString() : ''}</td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>

        {/* Status Legend */}
        <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-input)', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* legend = the row colours of the list (click to show only those jobs) */}
          <span onClick={() => setStatusFilter(statusFilter === 'LEO' ? 'All' : 'LEO')} title="LEO given: the SB is locked" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', padding: '6px 14px', fontSize: '11px', background: '#fee2e2', fontWeight: 600, borderRadius: '999px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', outline: statusFilter === 'LEO' ? '2px solid #dc2626' : 'none' }}>
            <Lock size={12} strokeWidth={2.5} /> LOCKED JOB ({dashboardData.filter(r => AFTER_LEO.includes(r.stage)).length})
          </span>
          <span onClick={() => setStatusFilter(statusFilter === 'CANCELLED' ? 'All' : 'CANCELLED')} title="Cancelled jobs" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', background: '#ffedd5', color: '#ea580c', padding: '6px 14px', fontSize: '11px', fontWeight: 600, borderRadius: '999px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', outline: statusFilter === 'CANCELLED' ? '2px solid #ea580c' : 'none' }}>
            <Ban size={12} strokeWidth={2.5} /> VOID JOB ({dashboardData.filter(r => r.stage === 'CANCELLED').length})
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fef08a', color: '#a16207', padding: '6px 14px', fontSize: '11px', fontWeight: 600, borderRadius: '999px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <CheckCircle size={12} strokeWidth={2.5} /> RECEIVED SB NO ({dashboardData.filter(r => (r.sbNo || r.sbNumber) && !AFTER_LEO.includes(r.stage) && r.stage !== 'CANCELLED').length})
          </span>
        </div>
      </div>
      <RowContextMenu menu={rowMenu} onClose={closeRowMenu} />
    </div>
  );
}
