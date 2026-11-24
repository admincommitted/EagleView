import toast from 'react-hot-toast';
import React, { useState, useContext, useEffect, useRef } from 'react';
import Modal from '../common/Modal';
import { Save, CheckCircle, UploadCloud, FileText, Download, Eye, X, Loader, FolderOpen, RefreshCw, MessageSquare, HelpCircle } from 'lucide-react';
import { useGlobalContext } from '../../GlobalContext';
import TimelineDrawer from '../../components/TimelineDrawer';
import DocketFromJob from '../DocketFromJob'; // 05-Nov-2026: Register Shipment (docket) from the SB job

import ExportQueryTab from './Tabs/ExportQueryTab';
import ExportHeaderTab from './Tabs/ExportHeaderTab';
import ExportInvoiceTab from './Tabs/ExportInvoiceTab';
import ExportItemTab from './Tabs/ExportItemTab';
import ExportSchemeTab from './Tabs/ExportSchemeTab';
import ExportContainerTab from './Tabs/ExportContainerTab';
import ExportReportTab from './Tabs/ExportReportTab';
import ExportDashboardTab from './Tabs/ExportDashboardTab';

import ImportFileModal from '../common/ImportFileModal';
import IcegateSubmitModal from '../common/IcegateSubmitModal';
import IcegateIdPickModal from '../common/IcegateIdPickModal'; // ICEGATE ID for Preview / flat file (17-Nov-2026)
import IcegateAckModal from '../JobEntry/IcegateAckModal';    // ICEGATE reply of the SB (17-Nov-2026)
import ValidationResultModal from '../common/ValidationResultModal';
import BodyPortal from '../common/BodyPortal';

import { ExportProvider, ExportContext } from './ExportContext';
import { apportionInvoiceCharges, validateFullJob } from '../../utils/calculations';
import { validateIcegateRules } from '../../utils/IcegateValidators';
import { usePermissions } from '../../utils/permissions';
import useExportCalc from './useExportCalc';
import { withItemLists } from '../../utils/asList';
import askConfirm, { askUnsavedEdits, askText } from '../common/askConfirm'; // EagleView question window in place of the browser's OK / Cancel box, 20-Nov-2026

function InnerLayout() {
  const [validationErrors, setValidationErrors] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  // 30-Oct-2026: tabs the user has no View right for are hidden (Master > User Management > Shipping Bill (Export) forms)
  const P = usePermissions();
  const tabAllowed = (t) => P.canOpen('/export-entry#' + t);
  useEffect(() => { if (!tabAllowed(activeTab)) { const first = ['dashboard', 'query', 'header', 'invoices', 'items', 'scheme', 'reports'].find(tabAllowed); if (first) setActiveTab(first); } }, [activeTab, P.restricted]);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineTargetJobId, setTimelineTargetJobId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { exportData, setExportData, items, setItems, containers, setContainers, docs, setDocs, dbkItems, setDbkItems, licenseItems, setLicenseItems, resetExportContext, pendingEditsMessage } = useContext(ExportContext);
  // 17-Nov-2026: the Items / Invoices forms reach the job only on Save / Modify, so a changed item was saved, checked and
  // sent with its OLD values without a word (as on the Import screen before 30-Oct-2026). Both tabs register a check
  // (ExportContext); it is asked before the job is saved, checked or built, and before the tab is left (the form goes).
  // 20-Nov-2026: asked in an EagleView window with named buttons ("Validate anyway" / "Go back to SAVE / MODIFY"), not the
  // browser's "localhost:5174 says ... OK / Cancel" box. Resolves true = stop (go back).
  const unsavedEdits = async (what) => {
    const msg = typeof pendingEditsMessage === 'function' ? pendingEditsMessage() : '';
    if (!msg) return false;
    return !(await askUnsavedEdits(msg, what, 'Go back to SAVE / MODIFY'));
  };
  const goTab = async (t) => {
    if (t !== activeTab && (activeTab === 'items' || activeTab === 'invoices') && typeof pendingEditsMessage === 'function') {
      const msg = pendingEditsMessage(activeTab);
      if (msg && !(await askConfirm({ title: 'Changes not put in', message: msg,
        note: 'Leave the tab: the changes in the form are dropped.\nStay here: press SAVE / MODIFY first, then change the tab.',
        okLabel: 'Leave the tab', cancelLabel: 'Stay here' }))) return;
    }
    setActiveTab(t);
  };
  // 19-Nov-2026: New Job, Read Flat File / Import from File and Create Job from Excel replace what is on the screen. Read
  // Flat File put the file INTO the open job (same id and job no), so Save Draft overwrote that job with another SB and
  // the duplicate check did not run; New Job cleared a job being typed without a word. They now start a clean new job and
  // ask first when a job is on the screen.
  const screenJob = () => {
    const d = exportData || {};
    if (d.id) return 'Job ' + (d.jobNo || '') + ' on the screen is not changed by this. Changes on it that are not saved are dropped.';
    if (d.shipperName || d.consigneeName || (d.invoices || []).length || (items || []).length) return 'The job on the screen is not saved - it will be cleared.';
    return '';
  };
  const okToClearScreen = (question) => { const s = screenJob(); return !s || window.confirm(question + '\n\n' + s); };
  const { activeBranch, activeYear } = useGlobalContext();
  // 12-Nov-2026: FOB, drawback amounts, FOB Rs / DBK Rs, port names follow the data whichever tab is open
  useExportCalc();

  const [predictedJobNo, setPredictedJobNo] = useState(null);

  useEffect(() => {
    if (!exportData?.jobNo || exportData.jobNo === 'DRAFT') {
      const fetchNext = async () => {
        try {
          const branchId = (activeBranch && !activeBranch.isAll && activeBranch.id) || '';
          const shipmentMode = exportData?.shipmentMode || 'AIR';
          const finYear = activeYear?.id || '';
          const res = await fetch(`/api/export-jobs/next-sequence?branchId=${branchId}&shipmentMode=${shipmentMode}&financialYearId=${finYear}`);
          const data = await res.json();
          if (data.success) {
            setPredictedJobNo(data.nextJobNo);
          }
        } catch (e) {
          console.error('Error fetching predicted job no', e);
        }
      };
      fetchNext();
    } else {
      setPredictedJobNo(null);
    }
  }, [exportData?.jobNo, exportData?.shipmentMode, activeBranch, activeYear]);


  // ICEGATE states
  const [icegateState, setIcegateState]   = useState({ loading: false, result: null, error: null });
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [previewJson, setPreviewJson]     = useState(null);
  // 17-Nov-2026: Preview JSON / Export Flat File ask which ICEGATE ID goes in the file (they always used the default ID);
  // the ICEGATE REPLY window of the SB (as the Import job)
  const [idPick, setIdPick] = useState(null); // { what: 'flat' | 'preview' }
  // 18-Nov-2026: job list right-click menu - an action that runs by itself once the job has opened. On Export the files
  // (Preview JSON / .sb) are made from the open job too: the screen fills values on opening (FOB INR, drawback rows,
  // Nature of Cargo, party master class / branch, port names), so a file made from the saved job alone was different.
  const [pendingRun, setPendingRun] = useState(null);
  const latestSend = useRef(null); // the Send of the latest screen state (set below, after handleSendToIcegateClick)
  useEffect(() => {
    if (!pendingRun || !exportData || String(exportData.id) !== String(pendingRun.id)) return;
    const what = pendingRun.what;
    setPendingRun(null);
    // Send waits until the screen has filled its values too (the check ran on the job as saved, e.g. Nature of Cargo blank)
    if (what === 'send') { setTimeout(() => { if (latestSend.current) latestSend.current(); }, 1500); return; }
    // the ICEGATE ID window comes up after the screen has filled its values; the file is made when the ID is chosen
    if (what === 'preview' || what === 'flat') setTimeout(() => setIdPick({ what }), 1200);
  }, [pendingRun, exportData]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showReply, setShowReply] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [valResults, setValResults] = useState({errors:[], warnings:[]});
  const [loadingPreview, setLoadingPreview] = useState(false);

  // FETCH ACK LOGIC
  const [ackState, setAckState] = useState({ loading: false, result: null, error: null });
  const [showAckModal, setShowAckModal] = useState(false);

  const handleFetchAck = async () => {
    const uniqueIdToFetch = (icegateState.result && icegateState.result.uniqueId) || exportData?.icegateUniqueId || exportData?.uniqueId || exportData?.autoField_30; // the job keeps it in icegateUniqueId
    if (!uniqueIdToFetch) {
      toast.error("No Unique ID found. Please submit the job first.");
      return;
    }
    
    setAckState({ loading: true, result: null, error: null });
    setShowAckModal(true);
    try {
      const res = await fetch('/api/icegate/get-ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uniqueId: uniqueIdToFetch, profileId: 1 })
      });
      const data = await res.json();
      if (data.success) {
        setAckState({ loading: false, result: data, error: null });
        if (data.data && data.data.sbNo) {
            setExportData({ ...exportData, sbNo: data.data.sbNo, sbDate: data.data.sbDate, status: 'PROCESSED' });
        }
      } else {
        setAckState({ loading: false, result: null, error: data.error || 'Failed to fetch ACK' });
      }
    } catch (e) {
      setAckState({ loading: false, result: null, error: 'Network error: ' + e.message });
    }
  };

  // Import modal
  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState(null);

  const handleAction = async (action, id, row) => {
    if (action === 'timeline') { setTimelineTargetJobId(id); setIsTimelineOpen(true); return; }
    // 18-Nov-2026: right-click menu of the job list - actions that need the job on the screen: it opens and the action
    // starts by itself (Preview JSON / .sb: the ICEGATE ID window comes up; Send: save + checks + submit window)
    if ((action === 'open-send' || action === 'open-ai' || action === 'open-preview' || action === 'open-flat') && id) {
      await handleAction('edit', id);
      if (action === 'open-ai') {
        setTimeout(() => { if (fileInputRefAI.current) fileInputRefAI.current.click(); }, 50);
        toast('Job ' + ((row && row.jobNo) || '') + ' opened - choose the invoice PDF (if no window opened: Actions > AI PDF Extract)', { icon: '🤖', duration: 7000 });
      } else setPendingRun({ id, what: action.slice(5) });
      return;
    }
    // job list: "Read Flat File" opens the import window; "Create Job from Excel" fills a new job (Save to keep it). 28-Oct-2026
    if (action === 'import-file') { if (!okToClearScreen('Read the file as a NEW job?')) return; setImportTab(id || 'file'); setShowImport(true); return; }
    if (action === 'excel-job' && id) {
      if (!okToClearScreen('Fill a NEW job from this Excel?')) return;
      resetExportContext();
      setExportData(prev => ({ ...prev, ...id.exportData }));
      setItems(id.items || []);
      setActiveTab('header');
      toast.success(`Job filled from Excel (${(id.items || []).length} item(s)) - check and click Save Draft`);
      return;
    }
    if (action === 'new') {
      if (!okToClearScreen('Start a new job?')) return;
      resetExportContext();
      setActiveTab('header');
      toast.success('New job ready');
      return;
    }
    if (action === 'delete' && id) {
      const jobNo = row?.jobNo || `ID ${id}`;
      if (window.confirm(`Are you sure you want to delete Job "${jobNo}"? This action cannot be undone.`)) {
        try {
          let res = await fetch(`/api/export-jobs/${id}`, { method: 'DELETE' });
          let json = await res.json();
          // 12-Nov-2026: a filed job is refused; an admin may still delete it after typing the job no
          if (!json.success && json.filed) {
            if (!json.canForce) { toast.error(json.error, { duration: 8000 }); return; }
            // 20-Nov-2026: an EagleView window (the browser's prompt box is not shown in every browser)
            const typed = await askText({ title: 'Delete a filed job', message: json.error + '\n\nThe SB stays with Customs. To delete this job from EagleView anyway, type the job no ' + jobNo + '.',
              label: 'Job No', okLabel: 'Delete from EagleView', check: (t) => (t.toUpperCase() === String(jobNo).trim().toUpperCase() ? '' : 'Job no does not match') });
            if (typed === null) return;
            if (String(typed).trim().toUpperCase() !== String(jobNo).trim().toUpperCase()) { toast.error('Job no does not match - not deleted'); return; }
            res = await fetch(`/api/export-jobs/${id}?force=1`, { method: 'DELETE' });
            json = await res.json();
          }
          if (json.success) {
            toast.success(`Job ${jobNo} deleted successfully!`);
            setRefreshKey(prev => prev + 1);
            // If the deleted job was currently open, reset
            if (exportData?.id === id) { resetExportContext(); setActiveTab('query'); }
          } else {
            toast.error('Delete failed: ' + (json.error || 'Unknown error'));
          }
        } catch (err) {
          toast.error('Server error while deleting job');
        }
      }
      return;
    }
    if ((action === 'edit' || action === 'duplicate' || action === 'print_checklist' || action === 'scheme' || action === 'esanchit' || action === 'amend') && id) {
      try {
        const res = await fetch(`/api/export-jobs/${id}`);
        const data = await res.json();
        if (data.success && data.data) {
          const jobData = data.data;
          if (action === 'duplicate') {
            delete jobData.id;
            delete jobData.jobNo;
            // a copy is a new, unfiled job
            ['sbNo', 'sbNumber', 'sbDate', 'icegateStatus', 'icegateUniqueId', 'uniqueId', 'isAmended', 'leoDate', 'leoNo'].forEach(k => { delete jobData[k]; });
            // 10-Nov-2026: the copy is made by whoever duplicates it, today - not the docket / iCAFFE record of the original
            ['enteredBy', 'createdAt', 'updatedAt', 'docketNo', 'icaffeRowId', 'icaffeShipmentId', 'icaffeEnteredBy', 'icaffeFile', 'egmNo', 'egmDate'].forEach(k => { delete jobData[k]; });
            jobData.status = 'DRAFT';
            // 12-Nov-2026: e-Sanchit documents (IRN / DRN) belong to the shipment they were uploaded for - the copy starts
            // without them (they were copied, so the new SB pointed at the old shipment's documents). SW statements /
            // SW info (declarations, origin, RoDTEP) are about the goods and stay.
            jobData.eSanchitList = [];
            if (jobData.invoices) jobData.invoices.forEach(inv => { (inv.items || []).forEach(it => { it.eSanchitList = []; it.suppDocs = 'N'; }); });
            toast('Copy made without the e-Sanchit documents of the old shipment - upload this shipment\'s documents', { icon: 'ℹ️', duration: 6000 });
            if(jobData.invoices) jobData.invoices.forEach(inv => { (inv.items || []).forEach(it => { delete it.id; delete it.exportInvoiceId; }); });
            jobData.jobDate = new Date().toISOString().split('T')[0];
            if(jobData.invoices) jobData.invoices.forEach(inv => { delete inv.id; delete inv.exportJobId; });
            if(jobData.items) jobData.items.forEach(it => { delete it.id; delete it.exportInvoiceId; });
            if(jobData.containers) jobData.containers.forEach(c => { delete c.id; delete c.exportJobId; });
            if(jobData.docs) jobData.docs.forEach(d => { delete d.id; delete d.exportJobId; });
            if(jobData.dbkItems) jobData.dbkItems.forEach(d => { delete d.id; delete d.exportJobId; });
            if(jobData.licenseItems) jobData.licenseItems.forEach(l => { delete l.id; delete l.exportJobId; });
          }

          // Amend (job list): the job opens marked for amendment; "Send to ICEGATE" sends it as an amendment. 29-Oct-2026
          // jobs saved before the header list was kept (or read from a file) only have the containers rows: show them in the header list
          if (!(Array.isArray(jobData.Containers) && jobData.Containers.length) && (jobData.containers || []).length) { jobData.Containers = toHeaderContainers(jobData.containers); jobData.containerFlag = 'Y'; }
          if (action === 'amend') jobData._amend = { amendmentType: (row && row.amendmentType) || 'General', amendReason: (row && row.amendReason) || '' };
          else delete jobData._amend;
          setExportData(jobData);
          if (action === 'amend') toast(`Job ${jobData.jobNo} opened for amendment - make the change, Save, then Send to ICEGATE`, { icon: '✏️', duration: 6000 });
          // items of ALL invoices (was: only the first invoice's items were loaded)
          // 12-Nov-2026: item lists that come back as text (older backend) are lists again
          if (jobData.invoices && jobData.invoices.length > 0) setItems(jobData.invoices.flatMap((inv, idx) => (inv.items || []).map(it => withItemLists({ ...it, invSr: it.invSr || idx + 1 }))));
          else setItems([]);
          
          setContainers(jobData.containers || []);
          setDocs(jobData.docs || []);
          setDbkItems(jobData.dbkItems || []);
          setLicenseItems(jobData.licenseItems || []);
          
          if (action === 'print_checklist') {
              setActiveTab('reports');
          } else if (action === 'scheme') {
              setActiveTab('scheme');
          } else if (action === 'esanchit') {
              // e-Sanchit documents ab Items tab ke andar manage hote hain
              setActiveTab('items');
          } else {
              setActiveTab('header');
          }
        }
      } catch (err) {
        console.error('Error fetching job:', err);
      }
    } else {
      setActiveTab('header');
    }
  };

  // Handle imported SB data — merge into exportData
  const handleImport = ({ exportData: imported, invoices, items: importedItems, containers: importedConts, docs: importedDocs, dbkItems: importedDbk, licenseItems: importedLic }) => {
    // 19-Nov-2026: a file is always read as a new job (it was merged into the job on the screen, keeping its id / job no)
    resetExportContext();
    // containers read from a file are shown in SB Header > Container Details (that list is the one saved / filed). 29-Oct-2026
    const hc = toHeaderContainers(importedConts);
    // 12-Nov-2026: Nature of Cargo comes from the file (the blank new job gets P for air; a sea SB read from a file kept it)
    setExportData(prev => ({ ...prev, natureOfCargo: '', ...imported, ...(invoices?.length > 0 ? { invoices } : {}), ...(hc.length && !(imported && (imported.Containers || []).length) ? { Containers: hc, containerFlag: 'Y' } : {}) }));
    if (importedItems) setItems(importedItems);
    if (importedConts) setContainers(importedConts);
    if (importedDocs) setDocs(importedDocs);
    if (importedDbk) setDbkItems(importedDbk);
    if (importedLic) setLicenseItems(importedLic);
    setActiveTab('header');
  };

  // Export Flat File (.sb) - the ICES 1.5 flat file of this SB, built by the server from the same CACHE01 data and
  // checked first (29-Oct-2026; it only showed a message before). Errors stop it, warnings ask.
  const [flatBusy, setFlatBusy] = useState(false);
  const handleDownloadLegacy = async (profileId, loginId) => {
    setShowActionMenu(false);
    setFlatBusy(true);
    try {
      const res = await fetch('/api/icegate/flat-sb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exportData: withSchemes(), items, invoices: exportData?.invoices || [], profileId }) });
      const data = await res.json();
      if (!data.success) { toast.error('Flat file not made: ' + (data.error || 'error')); return; }
      const download = () => {
        const blob = new Blob([data.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = data.fileName || 'SB.sb'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast.success(`${data.fileName} downloaded${loginId ? ' (ICEGATE ID ' + loginId + ')' : ''} - upload it on ICEGATE (sign it first if your port asks)`);
        if (data.filedNote) toast(data.filedNote, { icon: 'ℹ️', duration: 8000 });
      };
      const screenErrors = validateIcegateRules(exportData, items, exportData?.invoices || []).map(e => 'Screen: ' + e);
      const v = data.validation || { errors: [], warnings: [] };
      const all = { errors: [...screenErrors, ...v.errors], warnings: v.warnings };
      if (all.errors.length) { setValResult({ ...all, title: 'Flat file (.sb) - fix these first' }); return; }
      if (all.warnings.length) { setValResult({ ...all, title: 'Flat file (.sb) - please check', onContinue: download, continueLabel: 'Download anyway' }); return; }
      download();
    } catch (e) { toast.error('Flat file not made: ' + e.message); } finally { setFlatBusy(false); }
  };

  // Validate Job: screen checks + job totals + the ICEGATE pre-check of the JSON that will be sent, in one window
  // (29-Oct-2026; it ran only the job-total checks, so it said "ready" for SBs that ICEGATE / Send rejected).
  const [validating, setValidating] = useState(false);
  const handleValidate = async () => {
      setShowActionMenu(false);
      if (await unsavedEdits('validate')) return;
      const payload = { ...exportData };
      if (payload.invoices && payload.invoices.length > 0) {
          const nInv = payload.invoices.length;
          const invIdxOf = (it) => { const k = parseInt(it.invSr, 10); return k >= 1 && k <= nInv ? k - 1 : 0; };
          payload.invoices = payload.invoices.map((inv, idx) => ({ ...inv, items: (items || []).filter(it => invIdxOf(it) === idx) }));
      }
      const job = validateFullJob(payload);
      const screen = validateIcegateRules(exportData, items, exportData?.invoices || []);
      const errors = [...new Set([...screen, ...job.errors].map(e => 'Screen: ' + e))];
      let warnings = job.warnings.map(w => 'Screen: ' + w);
      setValidating(true);
      try {
        const res = await fetch('/api/icegate/preview-sb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exportData: withSchemes(), items, invoices: exportData?.invoices || [], amendment: !!exportData?._amend }) });
        const data = await res.json();
        if (data.success && data.validation) { errors.push(...data.validation.errors); warnings = [...warnings, ...data.validation.warnings]; }
        else errors.push('ICEGATE check: ' + (data.error || 'could not build the SB'));
      } catch (e) { errors.push('ICEGATE check: server not reached (' + e.message + ')'); } finally { setValidating(false); }
      if (!errors.length && !warnings.length) toast.success('Job validated - no problems found');
      setValResult({ errors, warnings, title: errors.length ? 'Validate Job - fix before sending' : 'Validate Job' });
  };

  const fileInputRefAI = useRef(null);
  // "Import PDF" in the Items tab opens the same AI PDF reader as the toolbar button
  useEffect(() => {
    const open = () => fileInputRefAI.current && fileInputRefAI.current.click();
    window.addEventListener('export-open-ai-pdf', open);
    return () => window.removeEventListener('export-open-ai-pdf', open);
  }, []);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // AI PDF Extract (29-Oct-2026): the export prompt is used (the import one was), the invoice / items get the field
  // names the Invoices and Items tabs use (invNo / invDate / unitPrice were not shown), asks before replacing.
  const handleAiUpload = async (e) => {
      const input = e.target; const file = input.files && input.files[0];
      if (!file) return;
      setShowActionMenu(false);
      if (((exportData?.invoices || []).length || (items || []).length) && !window.confirm('Replace the invoices and items of this job with the ones read from the PDF?')) { input.value = null; return; }
      setIsAiLoading(true);
      const tId = toast.loading('Reading the PDF with AI...');
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('module', 'EXPORT');
      try {
          const res = await fetch('/api/ai-extractor/extract-invoice', { method: 'POST', body: formData });
          const json = await res.json();
          if (!json.success || !json.data) { toast.error('AI could not read the PDF: ' + (json.error || 'no data'), { id: tId }); return; }
          const d = json.data;
          const iso = (v) => { const t = String(v || '').trim(); const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : (/^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : ''); };
          const num = (v) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return isFinite(x) ? x : 0; };
          const cur = String(d.currency || '').toUpperCase().slice(0, 3);
          const newItems = (Array.isArray(d.items) ? d.items : []).map((it, idx) => {
            const qty = num(it.qty), rate = num(it.unitPrice), amt = num(it.amount) || qty * rate;
            const unit = String(it.unit || '').toUpperCase().slice(0, 3);
            return { id: Date.now() + idx + 1, invSr: 1, itemSr: idx + 1, scheme: '', ritc: String(it.ritc || '').replace(/\D/g, '').slice(0, 8), desc: String(it.desc || '').toUpperCase(),
              qty: qty ? String(qty) : '', unit, rateUnit: unit, per: '1', rate: rate ? String(rate) : '', totalFc: amt ? amt.toFixed(2) : '', igstPayStatus: 'Select', endUse: '' };
          });
          const total = newItems.reduce((a, it) => a + num(it.totalFc), 0);
          const invoice = { id: 1, no: String(d.invoiceNo || '').toUpperCase().slice(0, 17), date: iso(d.invoiceDate), currency: cur, value: num(d.totalValue || d.invoiceValue) ? String(num(d.totalValue || d.invoiceValue)) : (total ? total.toFixed(2) : ''), contractType: 'FOB', addFreight: 'N' };
          setExportData(prev => ({ ...prev, invoices: [invoice], ...(d.buyerName && !prev.consigneeName ? { consigneeName: String(d.buyerName).toUpperCase().slice(0, 35) } : {}) }));
          setItems(newItems);
          toast.success(`Read from PDF: invoice ${invoice.no || '(no number)'} with ${newItems.length} item(s) - check the Invoices and Items tabs (rate, scheme, end use)`, { id: tId, duration: 7000 });
      } catch (err) {
          toast.error('AI service not reached: ' + err.message, { id: tId });
      } finally {
          setIsAiLoading(false);
          input.value = null;
      }
  };
  // one save at a time: a double click on Save made two jobs (the first save had not returned the job id yet). 29-Oct-2026
  const savingRef = useRef(false);
const handleSaveDraft = async () => {
    if (await unsavedEdits('save the job')) return;
    if (savingRef.current) { toast('Saving... please wait', { icon: '⏳' }); return; }
    savingRef.current = true;
    const tId = toast.loading(exportData?.id ? 'Saving changes...' : 'Saving new job...');
    try {
      const payload = { ...exportData };
      if (activeBranch && !activeBranch.isAll) payload.branchId = activeBranch.id;
      if (activeYear) payload.financialYearId = activeYear.id;
      
      if (payload.invoices && payload.invoices.length > 0) {
          // each item goes under its own invoice (Inv Sr); before, all items were saved under invoice 1
          const nInv = payload.invoices.length;
          const invIdxOf = (it) => { const k = parseInt(it.invSr, 10); return k >= 1 && k <= nInv ? k - 1 : 0; };
          payload.invoices = payload.invoices.map((inv, idx) => ({ ...inv, items: (items || []).filter(it => invIdxOf(it) === idx) }));
      } else if (items && items.length > 0) {
          payload.invoices = [{ invoiceNo: `${payload.jobNo || 'DRAFT'}-INV`, items: items }];
      }

      // Merge containers: ExportContainerTab uses context containers[], ExportHeaderTab uses exportData.Containers
      // Normalize and merge both sources — context array takes priority
      let mergedContainers = [];
      if (payload.Containers && Array.isArray(payload.Containers)) {
        // Normalize ExportHeaderTab's PascalCase field names to lowercase for DB
        mergedContainers = payload.Containers.map(c => ({
          containerNo: c.ContainerNumber || c.containerNo || '',
          size: c.ContainerSize || c.size || '20',
          type: c.ContainerType || c.type || '',
          sealNo: c.ExciseSealNo || c.sealNo || '',
          exciseSealNo: c.ExciseSealNo || c.exciseSealNo || '',
          sealDate: c.SealDate || c.sealDate || '',
          deviceId: c.SealDeviceID || c.deviceId || '',
          vgmWeight: c.VGM || c.vgmWeight || 0,
          stuffedPkgs: c.NoOfPktsStuffed || c.stuffedPkgs || 0,
          sealType: c.SealTypeIndicator || c.sealType || '',
          docType: c.MovementDocumentType || c.docType || '',
          // were dropped on save (the SB JSON built from a saved job lost them). 29-Oct-2026
          docNo: c.MovementDocumentNumber || c.docNo || '',
          eqmntType: c.EqmntType || c.eqmntType || '',
          eqmntQty: c.EqmntQty || c.eqmntQty || '',
          eqmntQtyCode: c.EqmntQtyCode || c.eqmntQtyCode || '',
        }));
      }
      // the SB Header list (exportData.Containers) is the one shown on screen; when it is empty the containers loaded
      // with the job / read from a file are kept (they were deleted on every save)
      payload.containers = mergedContainers.length ? mergedContainers : (containers || []).filter(c => c && (c.containerNo || c.ContainerNumber));
      payload.docs = docs;
      payload.dbkItems = dbkItems;
      payload.licenseItems = licenseItems;

      if (payload.invoices) {
          payload.invoices = apportionInvoiceCharges(payload.invoices);
      }
    
      // a plain message (these opened the "ICEGATE Pre-Validation Failed" window although nothing was sent)
      if (!payload.shipmentMode) { toast.error('Shipment Mode is mandatory.', { id: tId }); return; }
      if (!payload.shipperId && !String(payload.shipperName || '').trim()) { toast.error('Not saved: select or enter the Exporter (SB Header).', { id: tId }); return; }
      if (!payload.consigneeId && !String(payload.consigneeName || '').trim()) { toast.error('Not saved: select or enter the Consignee (SB Header).', { id: tId }); return; }

      if (!payload.jobNo) payload.jobNo = 'DRAFT';
      if (!payload.shipmentMode) payload.shipmentMode = 'AIR';
      
      // ── FIX: Use /api/ proxy path (consistent with preview-sb, submit-sb, etc.)
      // Previously was hardcoded '/api/export-jobs' which bypasses Vite proxy
      let response = await fetch('/api/export-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      let data = await response.json();
      // 10-Nov-2026: a new job repeating the invoice / HAWB of another job (e.g. a duplicated job) - save only if the operator says so
      if (!data.success && data.duplicate) {
        if (!window.confirm(data.error + '\n\nOK = save this new job anyway\nCancel = do not save (check the invoice / HAWB first)')) { toast('Not saved - ' + data.error, { id: tId, icon: '⚠️', duration: 8000 }); return; }
        response = await fetch('/api/export-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, _dupOk: true }) });
        data = await response.json();
      }
      if (data.success) {
        toast.success('Job ' + data.data.jobNo + (exportData?.id ? ' updated' : ' saved') + ' successfully!', { id: tId });
        setExportData(data.data);
        setRefreshKey(k => k + 1); // job list / dashboard show the saved job
      } else {
        // 10-Nov-2026: the server lists what is wrong (problems[])
        if (Array.isArray(data.problems) && data.problems.length) toast.error('Not saved - fix these:\n' + data.problems.slice(0, 6).map(x => '- ' + x).join('\n') + (data.problems.length > 6 ? `\n...and ${data.problems.length - 6} more` : ''), { id: tId, duration: 10000 });
        else toast.error('Error saving draft: ' + (data.error || 'unknown error'), { id: tId });
      }
    } catch (error) {
      console.error(error);
      toast.error('Error saving draft: ' + error.message, { id: tId });
    } finally {
      savingRef.current = false;
    }
  };
  // Save / Modify buttons of the SB Header tab (they sent a fake Ctrl+S key press before)
  useEffect(() => {
    const onSave = () => handleSaveDraft();
    window.addEventListener('export-save', onSave);
    return () => window.removeEventListener('export-save', onSave);
  });

  // ── FIX: Ctrl+S shortcut inside InnerLayout (correct scope — handleSaveDraft is defined here)
  useEffect(() => {
    const handleCtrlS = (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSaveDraft();
      }
    };
    window.addEventListener('keydown', handleCtrlS);
    return () => window.removeEventListener('keydown', handleCtrlS);
  }, [exportData, items, containers, docs, dbkItems, licenseItems]);

  // Drawback / licence rows of the Scheme tab live outside exportData: preview and Send to ICEGATE sent the rows loaded
  // with the job (or none), not the ones on the screen. 29-Oct-2026
  const withSchemes = () => ({ ...(exportData || {}), dbkItems: dbkItems || [], licenseItems: licenseItems || [] });

  const [previewVal, setPreviewVal] = useState(null);
  const handlePreviewJson = async (profileId) => {
    setLoadingPreview(true);
    try {
      const res = await fetch('/api/icegate/preview-sb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exportData: withSchemes(),
          items,
          invoices: exportData?.invoices || [],
          amendment: !!exportData?._amend,
          profileId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewJson(data.cache01);
        setShowJsonPreview(true);
        // the check result is shown in the preview header (a second window opened over the preview before)
        setPreviewVal(data.validation || null);
      } else {
        toast.error('Preview error: ' + data.error);
      }
    } catch (e) {
      toast.error('Network error: ' + e.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const [showIcegateModal, setShowIcegateModal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const actionMenuRef = useRef(null);
  useEffect(() => {
    if (!showActionMenu) return undefined;
    const close = (e) => { if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) setShowActionMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showActionMenu]);
  
  // Screen checks + ICEGATE pre-validation of the exact JSON that will be sent (backend utils/icegateValidate.js). 28-Oct-2026
  const [valResult, setValResult] = useState(null);
  // 12-Nov-2026: Esc closes the JSON preview (a check window opened from it is closed first)
  useEffect(() => {
    if (!showJsonPreview) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !valResult) setShowJsonPreview(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showJsonPreview, valResult]);
  const handleSendToIcegateClick = async () => {
    // 16-Nov-2026: a job with an SB No was filed - sending it again would file a second Shipping Bill (the server stops it too)
    const filedNo = String(exportData?.sbNo || exportData?.sbNumber || '').trim();
    if (filedNo && !exportData?._amend) {
      toast.error(`This job already has SB No ${filedNo}${exportData?.sbDate ? ' dt ' + exportData.sbDate : ''} - it was filed. For a change use Amend in the Export job list.`, { duration: 7000 });
      return;
    }
    if (await unsavedEdits('check and send the SB')) return;
    const screenErrors = validateIcegateRules(exportData, items, exportData?.invoices || []).map(e => 'Screen: ' + e);
    let v = { errors: [], warnings: [] };
    try {
      const res = await fetch('/api/icegate/preview-sb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exportData: withSchemes(), items, invoices: exportData?.invoices || [], amendment: !!exportData?._amend }),
      });
      const data = await res.json();
      if (!data.success) { toast.error('Validation error: ' + (data.error || 'could not build the SB')); return; }
      v = data.validation || v;
    } catch (e) {
      toast.error('Could not validate: ' + e.message);
      return;
    }
    const all = { errors: [...screenErrors, ...v.errors], warnings: v.warnings };
    if (all.errors.length || all.warnings.length) {
      setValResult({ ...all, title: 'Shipping Bill - Pre-Validation', onContinue: () => setShowIcegateModal(true) });
      return;
    }
    setShowIcegateModal(true);
  };
  latestSend.current = handleSendToIcegateClick;

  // "Download signed file (not sent)" in the Submit window: the SB signed with the token exactly as Confirm Submit signs it,
  // downloaded for a check on ICEGATE's signer site - nothing goes to ICEGATE. 17-Nov-2026
  const handleSignOnly = async (profileId, pin) => {
    try {
      const res = await fetch('/api/icegate/sign-sb-file', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exportData: withSchemes(), items, invoices: exportData?.invoices || [], profileId, pin,
          ...(exportData && exportData._amend ? { amendment: true, amendmentType: exportData._amend.amendmentType, amendReason: exportData._amend.amendReason } : {}) })
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'The file could not be signed', { duration: 8000 }); return; }
      const url = URL.createObjectURL(new Blob([data.json], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = data.fileName; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success(`Signed file downloaded (ICEGATE ID ${data.senderId || '-'}, signed by ${data.signerCn || '-'}). It was NOT sent to ICEGATE - check it on filesign.icegate.gov.in (Verify).`, { duration: 10000 });
      if (!data.certificate) toast.error('The signer did not put the certificate in the file - update the signer tool', { duration: 8000 });
    } catch (e) { toast.error('Could not make the signed file: ' + e.message); }
  };

  const handleActualSubmit = async (profileId, pin, resendOk = false) => {
    setIcegateState({ loading: true, result: null, error: null });
    try {
      const res = await fetch('/api/icegate/submit-sb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exportData: withSchemes(),
          items,
          invoices: exportData && exportData.invoices ? exportData.invoices : [],
          indicator: 'P',
          profileId,
          pin,
          ...(resendOk ? { resendOk: true } : {}),
          // amendment opened from the job list (Amend)
          ...(exportData && exportData._amend ? { amendment: true, amendmentType: exportData._amend.amendmentType, amendReason: exportData._amend.amendReason } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIcegateState({ loading: false, result: data, error: null });
        setShowIcegateModal(false);
        // the job on screen follows the server (a later Save sent the old empty ICEGATE status back). 29-Oct-2026
        setExportData(prev => { const n = { ...prev, icegateStatus: prev && prev._amend ? 'Amended' : 'Filed', icegateUniqueId: data.uniqueId || prev?.icegateUniqueId, isAmended: !!(prev && prev._amend) };
          if (!n.status || n.status === 'DRAFT') n.status = 'SUBMITTED'; delete n._amend; return n; });
      } else {
        // sent before and accepted by ICEGATE, SB No not back yet: only on the operator's word (16-Nov-2026)
        if (data.sent && !resendOk && window.confirm(data.error + '\n\nSend this SB to ICEGATE again?')) return handleActualSubmit(profileId, pin, true);
        setIcegateState({ loading: false, result: null, error: data.error || (data.details && data.details.errorMessage) || 'SB Filing failed' });
        if (data.validation) { setShowIcegateModal(false); setValResult({ ...data.validation, title: 'Shipping Bill - Not sent' }); }
      }
    } catch (e) {
      setIcegateState({ loading: false, result: null, error: 'Network error: ' + e.message });
    }
  };


  return (
    <>

      {showValidationModal && (
        <Modal isOpen={showValidationModal} onClose={() => setShowValidationModal(false)} title="Job Validation Results">
          <div style={{ padding: '15px' }}>
            {valResults.errors.length === 0 && valResults.warnings.length === 0 ? (
              <div style={{ color: '#10b981', fontWeight: 'bold' }}>✅ All checks passed! Ready for ICEGATE.</div>
            ) : null}
            
            {valResults.errors.length > 0 && (
              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ color: '#ef4444', borderBottom: '1px solid #ef4444', paddingBottom: '4px' }}>🚨 Errors (Must Fix)</h4>
                <ul style={{ color: '#ef4444', paddingLeft: '20px', fontSize: '12px', listStyleType: 'disc' }}>
                  {valResults.errors.map((e, idx) => <li key={idx} style={{marginBottom: '4px'}}>{e}</li>)}
                </ul>
              </div>
            )}
            
            {valResults.warnings.length > 0 && (
              <div>
                <h4 style={{ color: '#f59e0b', borderBottom: '1px solid #f59e0b', paddingBottom: '4px' }}>⚠️ Warnings</h4>
                <ul style={{ color: '#f59e0b', paddingLeft: '20px', fontSize: '12px', listStyleType: 'disc' }}>
                  {valResults.warnings.map((w, idx) => <li key={idx} style={{marginBottom: '4px'}}>{w}</li>)}
                </ul>
              </div>
            )}
          </div>
        </Modal>
      )}

    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* Top Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', padding: '0.15rem 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
             <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0, fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.2px' }}>
               <FileText size={14} color="var(--primary-text, #0284c7)" /> EXPORT SHIPPING BILL (CACHE01)
             </h3>
             <button onClick={() => { if (!window.confirm('Start a new job? Unsaved changes on this job will be cleared.')) return; resetExportContext(); setActiveTab('header'); toast.success('New job ready'); }} style={{ padding: '4px 10px', fontSize: '11px', background: 'var(--primary-color-start, #dc2626)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ CREATE NEW JOB (RESET)</button>
            </div>
            <div className="job-strip" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 500, letterSpacing: '0.3px', marginTop: '2px' }}>
              <span>JOB: <strong style={{ color: 'var(--text-main, var(--text-main, #0f172a))' }}>{exportData?.jobNo && exportData.jobNo !== 'DRAFT' ? exportData.jobNo : (predictedJobNo || 'NEW')}</strong></span>
              <DocketFromJob side="Export" job={exportData} />
              <span style={{ color: 'var(--border-color, var(--border-color, #cbd5e1))' }}>|</span>
              <span>MODE: <strong style={{ color: 'var(--primary-text, #0369a1)' }}>{exportData?.shipmentMode || exportData?.ShipmentMode || '---'}</strong></span>
              <span style={{ color: 'var(--border-color, var(--border-color, #cbd5e1))' }}>|</span>
              <span>STATUS: <span style={{ color: /rejected/i.test(exportData?.icegateStatus || '') ? '#b91c1c' : (icegateState.result || exportData?.icegateStatus) ? '#16a34a' : 'var(--primary-text, #0284c7)', fontWeight: 600 }}>
              {icegateState.result ? `${icegateState.result.message?.includes('mend') ? 'AMENDED' : 'FILED'} (${icegateState.result.uniqueId})` : (exportData?.icegateStatus ? `${exportData.icegateStatus.toUpperCase()} (${exportData.icegateUniqueId || ''})` : 'DRAFT')}
              </span></span>
              {/* 17-Nov-2026: ICEGATE reply of the SB (status, errors, SB No) - on every saved job; a job with no Unique ID takes it from the ICEGATE mail */}
              {(exportData?.id || exportData?.icegateUniqueId) && (
                <button type="button" onClick={() => setShowReply(true)} title="Ask ICEGATE what ICES answered: SB No / Date or the error list" style={{ marginLeft: '6px', padding: '1px 8px', fontSize: '10px', background: /accepted/i.test(exportData?.icegateStatus || '') ? '#dcfce7' : /rejected/i.test(exportData?.icegateStatus || '') ? '#fee2e2' : '#e0f2fe', color: /rejected/i.test(exportData?.icegateStatus || '') ? '#991b1b' : '#075985', border: '1px solid ' + (/rejected/i.test(exportData?.icegateStatus || '') ? '#fca5a5' : '#bae6fd'), borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}>
                  {(exportData?.sbNo || exportData?.sbNumber) && /accepted/i.test(exportData?.icegateStatus || '') ? `SB ${exportData.sbNo || exportData.sbNumber}` : /rejected/i.test(exportData?.icegateStatus || '') ? 'REJECTED - WHY?' : 'ICEGATE REPLY'}
                </button>
              )}
            </div>
          </div>
          
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => goTab('help')}
            style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
            title="Help & Logic"
          >
            <HelpCircle size={16} />
          </button>
          {/* the PDF picker stays mounted outside the menu: inside it, it existed only while the menu was open, so the
              Items tab "Import PDF" button found no picker and did nothing (29-Oct-2026) */}
          <input type="file" accept="application/pdf" ref={fileInputRefAI} onChange={handleAiUpload} style={{ display: 'none' }} />
          {/* opens on hover and on click / keyboard (hover only before); closes after a choice, Esc or a click outside */}
          <div 
            ref={actionMenuRef}
            style={{ position: 'relative' }} 
            onMouseEnter={() => setShowActionMenu(true)} 
            onMouseLeave={() => setShowActionMenu(false)}
            onKeyDown={e => { if (e.key === 'Escape') setShowActionMenu(false); }}
          >
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={showActionMenu}
              onClick={() => setShowActionMenu(true)}
              style={{ padding: '6px 16px', fontSize: '12px', background: 'var(--primary-color-start, #0ea5e9)', border: 'none', color: '#fff', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
            >
              Actions &#9660;</button>

            {showActionMenu && (
              <div role="menu" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0', borderTop: '4px solid transparent', backgroundClip: 'padding-box', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', minWidth: '220px', zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <button
                  onClick={() => { setShowActionMenu(false); if (!okToClearScreen('Read the file as a NEW job?')) return; setShowImport(true); }}
                  style={{ padding: '10px 14px', fontSize: '12px', background: '#fff', border: 'none', borderBottom: '1px solid #f1f5f9', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, textAlign: 'left', width: '100%' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                >
                  <FolderOpen size={14} /> Import from File
                </button>
                <button
                  onClick={async () => { setShowActionMenu(false); if (await unsavedEdits('build the JSON')) return; setIdPick({ what: 'preview' }); }}
                  disabled={loadingPreview}
                  style={{ padding: '10px 14px', fontSize: '12px', background: '#fff', border: 'none', borderBottom: '1px solid #f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500, textAlign: 'left', width: '100%' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                >
                  {loadingPreview ? <Loader size={14} /> : <Eye size={14} color="#64748b" />} Preview JSON
                </button>
                <button 
 onClick={async () => { setShowActionMenu(false); if (await unsavedEdits('build the flat file')) return; setIdPick({ what: 'flat' }); }} 
                  style={{ padding: '10px 14px', fontSize: '12px', background: '#fff', border: 'none', borderBottom: '1px solid #f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500, textAlign: 'left', width: '100%' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                >
                  {flatBusy ? <Loader size={14} /> : <Download size={14} color="#64748b" />} Export Flat File (.sb)
                </button>
                <button 
                  onClick={handleValidate} 
                  style={{ padding: '10px 14px', fontSize: '12px', background: '#fff', border: 'none', borderBottom: '1px solid #f1f5f9', color: 'var(--primary-color-start, #0ea5e9)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500, textAlign: 'left', width: '100%' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f0f9ff'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                >
                  {validating ? <Loader size={14} /> : <CheckCircle size={14} />} Validate Job
                </button>
                <button 
                  onClick={() => { setShowActionMenu(false); handleSaveDraft(); }} 
                  style={{ padding: '10px 14px', fontSize: '12px', background: '#fff', border: 'none', borderBottom: '1px solid #f1f5f9', color: 'var(--primary-color-start, #0ea5e9)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500, textAlign: 'left', width: '100%' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f0f9ff'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                >
                  <Save size={14} /> Save Draft
                </button>
                
                  <button
                    onClick={() => { setShowActionMenu(false); fileInputRefAI.current?.click(); }}
                    disabled={isAiLoading}
                    style={{ padding: '10px 14px', fontSize: '12px', background: '#c026d3', border: 'none', borderBottom: '1px solid #f1f5f9', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, textAlign: 'left', width: '100%' }}
                  >
                    {isAiLoading ? <Loader size={14} /> : <UploadCloud size={14} />} AI PDF EXTRACT
                  </button>
                  <button
                    onClick={() => { setShowActionMenu(false); handleSendToIcegateClick(); }}
                  disabled={icegateState.loading}
                  style={{ padding: '10px 14px', fontSize: '12px', background: icegateState.loading ? '#94a3b8' : '#16a34a', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', cursor: icegateState.loading ? 'not-allowed' : 'pointer', fontWeight: 600, textAlign: 'left', width: '100%' }}
                  onMouseEnter={(e) => { if(!icegateState.loading) e.currentTarget.style.background = '#15803d'; }}
                  onMouseLeave={(e) => { if(!icegateState.loading) e.currentTarget.style.background = '#16a34a'; }}
                >
                  {icegateState.loading ? <><Loader size={14} /> Submitting...</> : <><UploadCloud size={14} /> Send to ICEGATE</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

        {/* ICEGATE Result Banner */}
        {icegateState.result && (
          <div style={{ background: '#f0fdf4', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '6px', padding: '8px 12px', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
              <CheckCircle size={14} color="#16a34a" />
              <span style={{ color: '#166534', fontWeight: 600 }}>SB Filed Successfully to ICEGATE!</span>
              <span style={{ color: '#166534' }}>Unique ID: <strong>{icegateState.result.uniqueId}</strong></span>
              <span style={{ color: '#4ade80' }}>|</span>
              <span style={{ color: '#166534' }}>{icegateState.result.message}</span>
            </div>
            <button onClick={() => setIcegateState({ loading: false, result: null, error: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534' }}>
              <X size={14} />
            </button>
          </div>
        )}
        {icegateState.error && (
          <div style={{ background: '#fef2f2', border: '1px solid #ef4444', borderRadius: '6px', padding: '8px 12px', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '11px', color: '#991b1b' }}>
              <strong>ICEGATE Filing Error:</strong> {icegateState.error}
            </div>
            <button onClick={() => setIcegateState({ loading: false, result: null, error: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Tabs Layout */}
        {/* 21-Nov-2026: "entry-lg" / "entry-lg-body" = the plainer entry-form look (index.css), colours from the theme */}
        <div className="glass-panel entry-lg" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
          
          <div style={{ padding: '0.25rem 0.5rem 0 0.5rem', background: 'var(--bg-input)' }}>
            <div className="tab-container" style={{ gap: '0.25rem', display: 'flex', width: '100%' }}>
              {tabAllowed('dashboard') && <div className={`custom-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => goTab('dashboard')}>0. Dashboard</div>}
              {tabAllowed('query') && <div className={`custom-tab ${activeTab === 'query' ? 'active' : ''}`} onClick={() => goTab('query')}>Query / Search</div>}
              {tabAllowed('header') && <div className={`custom-tab ${activeTab === 'header' ? 'active' : ''}`} onClick={() => goTab('header')}>1. SB Header</div>}
              {tabAllowed('invoices') && <div className={`custom-tab ${activeTab === 'invoices' ? 'active' : ''}`} onClick={() => goTab('invoices')}>2. Invoices ({exportData?.invoices?.length || 0})</div>}
              {tabAllowed('items') && <div className={`custom-tab ${activeTab === 'items' ? 'active' : ''}`} onClick={() => goTab('items')}>3. Items ({items?.length || 0})</div>}
              {tabAllowed('scheme') && <div className={`custom-tab ${activeTab === 'scheme' ? 'active' : ''}`} onClick={() => goTab('scheme')}>Scheme / DBK</div>}
              {tabAllowed('reports') && <div className={`custom-tab ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => goTab('reports')}>4. Report / Checklist</div>}
              <div className="custom-tab" onClick={() => { setTimelineTargetJobId(null); setIsTimelineOpen(true); }} style={{ marginLeft: 'auto' }}><MessageSquare size={14} style={{ marginRight: '4px' }}/> Timeline Log</div>
            </div>
          </div>

          {/* Tab Content Area */}
          <div className="entry-lg-body" style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
            {activeTab === 'dashboard'  && <ExportDashboardTab onGoToQuery={() => setActiveTab('query')} onOpenJob={(id) => handleAction('edit', id)} />}
            {activeTab === 'query'      && <ExportQueryTab onAction={handleAction} refreshKey={refreshKey} />}
            {activeTab === 'header'     && <ExportHeaderTab />}
            {activeTab === 'invoices'   && <ExportInvoiceTab />}
            {activeTab === 'items'      && <ExportItemTab />}
            {activeTab === 'scheme'     && <ExportSchemeTab />}
            {activeTab === 'reports'    && <ExportReportTab />}
            {activeTab === 'help'       && <div style={{ padding: '20px' }}><h2>Help & Logic</h2><p>Documentation coming soon.</p></div>}
          </div>
          
        </div>

      {/* JSON Preview Modal */}
      {showJsonPreview && previewJson && (<BodyPortal>
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--text-main, var(--text-main, #1e293b))', borderRadius: '8px', width: '80vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #334155' }}>
              <span style={{ color: 'var(--primary-bg-light, #e0f2fe)', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>📄 CACHE01 JSON Preview (SB)
                {previewVal && (previewVal.errors.length || previewVal.warnings.length)
                  ? <button type="button" onClick={() => setValResult({ ...previewVal, title: 'Shipping Bill - Pre-Validation' })} style={{ fontSize: '11px', fontWeight: 700, border: 'none', borderRadius: '10px', padding: '2px 10px', cursor: 'pointer', background: previewVal.errors.length ? '#dc2626' : '#d97706', color: '#fff' }}>{previewVal.errors.length} error(s), {previewVal.warnings.length} warning(s) - show</button>
                  : <span style={{ fontSize: '11px', color: '#4ade80' }}>✓ no problems found</span>}
              </span>
              <button onClick={() => setShowJsonPreview(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <pre style={{ flex: 1, overflow: 'auto', padding: '16px', margin: 0, color: '#16a34a', fontSize: '11px', lineHeight: '1.5', fontFamily: 'monospace', textTransform: 'none' }}>
              {JSON.stringify(previewJson, null, 2)}
            </pre>
            <div style={{ padding: '10px 16px', borderTop: '1px solid #334155', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { navigator.clipboard.writeText(JSON.stringify(previewJson, null, 2)).then(() => toast.success('JSON copied')).catch(() => toast.error('Copy not allowed by the browser')); }}
                style={{ padding: '5px 12px', fontSize: '11px', background: '#334155', border: 'none', color: 'var(--primary-bg-light, #e0f2fe)', borderRadius: '4px', cursor: 'pointer' }}
              >
                Copy JSON
              </button>
              {/* the CACHE01 file itself, for signing (DSC) and upload on ICEGATE; 29-Oct-2026 */}
              <button
                onClick={() => {
                  if (previewVal && previewVal.errors.length && !window.confirm(`This SB has ${previewVal.errors.length} error(s) - ICEGATE will reject it. Download the JSON anyway?`)) return;
                  const job = String((previewJson.headerField || {}).jobNumber || 'SB');
                  const blob = new Blob([JSON.stringify(previewJson, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const snd = String((previewJson.headerField || {}).senderID || '').replace(/[^\w-]+/g, '_');
                  const fname = `SB_${job}${snd ? '_' + snd : ''}_CACHE01.json`;
                  const a = document.createElement('a'); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 2000);
                  toast.success(`${fname} downloaded - sign it with your DSC before uploading on ICEGATE`, { duration: 6000 });
                }}
                style={{ padding: '5px 12px', fontSize: '11px', background: '#0369a1', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
              >
                Download JSON
              </button>
              <button
                onClick={() => { setShowJsonPreview(false); handleSendToIcegateClick(); }}
                style={{ padding: '5px 14px', fontSize: '11px', background: '#16a34a', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
              >
                ✅ Send this SB to ICEGATE
              </button>
            </div>
          </div>
        </div>
      </BodyPortal>)}

      {/* Import File Modal */}
      {showImport && (
        <ImportFileModal type="sb" initialTab={importTab} onImport={handleImport} onClose={() => { setShowImport(false); setImportTab(null); }} />
      )}

      <ValidationResultModal result={valResult} onClose={() => setValResult(null)} />

      <Modal isOpen={validationErrors.length > 0} onClose={() => setValidationErrors([])} title="ICEGATE Pre-Validation Failed">
        <div style={{ color: '#b91c1c', fontSize: '13px', background: '#fef2f2', border: '1px solid #f87171', padding: '12px', borderRadius: '4px' }}>
          <strong style={{ display: 'block', marginBottom: '8px' }}>Please fix the following errors before proceeding:</strong>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {validationErrors.map((err, i) => <li key={i} style={{ marginBottom: '4px' }}>{err}</li>)}
          </ul>
        </div>
      </Modal>

      {/* ICEGATE Submit Modal */}
      {showIcegateModal && (
        <IcegateSubmitModal 
          chaCode={exportData?.chaId || exportData?.autoField_3} 
          onSubmit={handleActualSubmit}
          onSignOnly={handleSignOnly}
          onClose={() => setShowIcegateModal(false)}
          loading={icegateState.loading}
        />
      )}

      <IcegateIdPickModal open={!!idPick} chaCode={exportData?.chaId || exportData?.autoField_3}
        title={idPick && idPick.what === 'flat' ? 'SB flat file (.sb) - ICEGATE ID' : 'Preview JSON (SB) - ICEGATE ID'}
        actionLabel={idPick && idPick.what === 'flat' ? 'Download' : 'Show JSON'}
        onClose={() => setIdPick(null)}
        onPick={(pid, login) => { const w = idPick && idPick.what; setIdPick(null); if (w === 'flat') handleDownloadLegacy(pid, login); else handlePreviewJson(pid); }} />

      <IcegateAckModal kind="SB" open={showReply} onClose={() => setShowReply(false)} jobId={exportData?.id} uniqueId={exportData?.icegateUniqueId || (icegateState.result && icegateState.result.uniqueId)}
        onResult={(d) => { const j = d.job || {}; setExportData(prev => ({ ...prev, icegateStatus: j.icegateStatus || prev.icegateStatus, icegateUniqueId: j.icegateUniqueId || prev.icegateUniqueId, sbNo: prev.sbNo || j.sbNo || prev.sbNo, sbDate: prev.sbDate || j.sbDate || prev.sbDate, status: j.status || prev.status })); if (d.state !== 'pending') setIcegateState(s => ({ ...s, result: null })); }} />

      <TimelineDrawer isOpen={isTimelineOpen} onClose={() => setIsTimelineOpen(false)} jobId={timelineTargetJobId || exportData?.id} module="EXPORT" />
    </div>
    </>
  );
}

// containers rows (DB / file: containerNo, size ...) -> SB Header Container Details rows (ContainerNumber ...). 29-Oct-2026
const toHeaderContainers = (list) => (Array.isArray(list) ? list : []).filter(c => c && (c.containerNo || c.ContainerNumber)).map(c => ({
  ContainerNumber: c.ContainerNumber || c.containerNo || '', ContainerSize: c.ContainerSize || c.size || '', ContainerType: c.ContainerType || c.type || '',
  ExciseSealNo: c.ExciseSealNo || c.exciseSealNo || c.sealNo || '', SealDate: c.SealDate || c.sealDate || '', SealTypeIndicator: c.SealTypeIndicator || c.sealType || '',
  SealDeviceID: c.SealDeviceID || c.deviceId || '', NoOfPktsStuffed: c.NoOfPktsStuffed || c.stuffedPkgs || '', VGM: c.VGM || c.vgmWeight || '',
  MovementDocumentType: c.MovementDocumentType || c.docType || '', MovementDocumentNumber: c.MovementDocumentNumber || c.docNo || '',
  EqmntType: c.EqmntType || c.eqmntType || '', EqmntQty: c.EqmntQty || c.eqmntQty || '', EqmntQtyCode: c.EqmntQtyCode || c.eqmntQtyCode || '',
}));

export default function ExportEntryLayout() {

  // Global Keyboard Shortcuts (Tab/Enter navigation only)
  // NOTE: Ctrl+S is handled inside InnerLayout where handleSaveDraft is in scope
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
         e.preventDefault();
         const formElements = Array.from(document.querySelectorAll('input, select, textarea, button'));
         const index = formElements.indexOf(e.target);
         if (index > -1 && index < formElements.length - 1) {
            formElements[index + 1].focus();
         }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <ExportProvider>
      <InnerLayout />
    
    </ExportProvider>
  );
}



