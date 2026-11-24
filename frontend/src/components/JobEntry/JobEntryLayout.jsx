import toast from 'react-hot-toast';
import React, { useState, useEffect, useRef } from 'react';
import { Save, CheckCircle, UploadCloud, FileText, Download, Eye, X, Loader, FolderOpen, Warehouse, HelpCircle, MessageSquare } from 'lucide-react';

import QueryTab from './Tabs/QueryTab';
import JobHeaderTab from './Tabs/JobHeaderTab';
import InvoiceGridTab from './Tabs/InvoiceGridTab';
import ItemGridTab from './Tabs/ItemGridTab';
import ReportTab from './Tabs/ReportTab';
import ImportDashboardTab from './Tabs/ImportDashboardTab';
import { JobProvider, JobContext } from './JobContext';
import { useGlobalContext } from '../../GlobalContext';
import ImportFileModal from '../common/ImportFileModal';
import WhBeSelectorModal from './WhBeSelectorModal';
import IcegateSubmitModal from '../common/IcegateSubmitModal';
import BeAmendModal from './BeAmendModal'; // BE amendment .be file (CACHI01_A), 29-Oct-2026
import IcegateAckModal from './IcegateAckModal';
import askConfirm, { askUnsavedEdits, askText } from '../common/askConfirm'; // EagleView question window in place of the browser's OK / Cancel box, 20-Nov-2026
import IcegateIdPickModal from '../common/IcegateIdPickModal'; // ICEGATE ID for Download JSON / .be / Preview, 17-Nov-2026 // ICEGATE reply (getAck) of a filed BE, 29-Oct-2026
import ValidationResultModal from '../common/ValidationResultModal';
import HelpViewer from '../HelpViewer';
import TimelineDrawer from '../TimelineDrawer';
import DocketFromJob from '../DocketFromJob'; // 05-Nov-2026: Register Shipment (docket) from the BE job
import { usePermissions } from '../../utils/permissions';
// 22-Nov-2026: screen ids of item rows. Before: Date.now() + Math.random() - at this size a number keeps only ~4,000
// different fractions per millisecond, so in a job of 200+ items made in one go (ex-bond from a WH BE, a loaded job) two
// items often got the SAME id: Modify / Delete of one then also changed / deleted the other.
let rowSeq = 0; const rowBase = Date.now() * 1000; const newRowId = () => rowBase + (++rowSeq);

// 18-Nov-2026: a saved job (GET /api/import-jobs/:id) as the job screen holds it - jobData, items (with the popup rows put
// back on each item), e-Sanchit documents, transport mode and BE type. Taken out of loadJobForEditing word for word, so
// the job list's right-click menu (BE file / .be / Preview without opening the job) builds the same file as the screen.
export function mapLoadedImportJob(loaded) {
              
              let loadedInvoices = loaded.invoices || [];
              let loadedItems = [];
              // 29-Oct-2026: the invoice an item belongs to is the one it was saved under (importInvoiceId) - its Inv Sr No /
              // Inv No on the screen come from that invoice's position and number, not from a stale value on the item
              loadedInvoices.forEach((inv, k) => {
                  if (inv.items) {
                      loadedItems = [...loadedItems, ...inv.items.map(it => ({ ...it, invSrNo: String(k + 1), invNo: String(inv.invNo || inv.invoiceNo || it.invNo || '') }))];
                  }
              });
              
              // replace, do not merge: merging kept fields of the job that was open before
              const jobDataOut = {
                  ...loaded,
                  invoices: loadedInvoices
              };
              
              
                // Map extendedData arrays back into items for the UI modals
                loadedItems = loadedItems.map(item => {
                    const invNo = String(item.invSrNo || '1');
                    const itmNo = String(item.itemSrNo || item.itemNo || '1');
                    // popup data saved on the item itself comes back as text: read it, it wins over the job-level rows. 28-Oct-2026
                    ['swInfoData', 'swConstData', 'swProdData', 'swCtrlData', 'swStmtData', 'docsData', 'dutyRows', 'igstData', 'licenceData', 'schemeCatData', 'addData', 'antiDumpingData',
                      'cvdData', 'svbData', 'otherDutyData', 'policyParaData', 'prevBeData', 'reimportData', 'rspData', 'ncdData'].forEach(k => {
                        if (typeof item[k] === 'string') { try { item[k] = JSON.parse(item[k]); } catch (e) { /* keep text */ } }
                    });
                    const match = (arr) => { if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch (e) { arr = []; } } return (Array.isArray(arr) ? arr : []).filter(r => String(r.invoiceSerialNumber || r.invoiceSrNo || r.invSrNo) === invNo && String(r.itemSerialNumber || r.itemSrNo || r.itmNo) === itmNo); };

                    // 1. InfoTypes
                    const infoData = match(loaded._infoTypes || loaded._infoTypeModel || loaded._infotypemodel);
                    // ICEGATE key names (infoMsr = quantity, infoUqc = unit; old code put infoMsr into uqc). 28-Oct-2026
                    if (infoData.length > 0 && !Array.isArray(item.swInfoData)) item.swInfoData = infoData.map(r => ({ agency: r.agencyCode || 'ALL', type: r.infoType || '', qualifier: r.infoQualifier || '', code: r.infoCode || '', text: r.infoText || '', qty: r.infoMsr || r.infoQty || '', uqc: r.infoUqc || '', id: Date.now()+Math.random() }));

                    // 2. Constituents
                    const constData = match(loaded._sw_ConstModel || loaded._sw_constmodel);
                    if (constData.length > 0 && !Array.isArray(item.swConstData)) item.swConstData = constData.map(r => ({ srNo: r.constituentSrNo || r.constituentSerialNumber || '', name: r.constituentElementName || '', code: r.constituentElementCode || '', percent: r.constituentPercentage || '', yield: r.constituentYieldPercentage || '', active: r.activeIngredientFlag || r.activeIngredient || '', id: Date.now()+Math.random() }));

                    // 3. Production
                    const prodData = match(loaded._sw_ProdModel || loaded._sw_prodmodel);
                    if (prodData.length > 0 && !Array.isArray(item.swProdData)) item.swProdData = prodData.map(r => ({ batch: r.productionBatchIdentifier || r.batchNumber || '', qty: r.productionBatchQuantity || r.manufacturingQuantity || '', uqc: r.unitQuantityCode || '', mnfDate: r.dateOfManufacturing || '', expDate: r.dateOfExpiry || '', bestBefore: r.bestBefore || '', id: Date.now()+Math.random() }));

                    // 4. Control
                    const ctrlData = match(loaded._ctrlModel || loaded._ctrlmodel);
                    if (ctrlData.length > 0 && !Array.isArray(item.swCtrlData)) item.swCtrlData = ctrlData.map(r => ({ typeCode: r.controlTypeCode || '', location: r.controlLocation || '', startDate: r.controlStartDate || '', endDate: r.controlEndDate || '', resultCode: r.controlResultCode || '', resultText: r.controlResultText || '', msr: r.controlMsr || '', uqc: r.controlUqc || '', id: Date.now()+Math.random() }));

                    // 5. Statement
                    const stmtData = match(loaded._statements || loaded._statementModel || loaded._statementmodel);
                    if (stmtData.length > 0 && !Array.isArray(item.swStmtData)) item.swStmtData = stmtData.map(r => ({ typeCode: r.statementType || '', stmtCode: r.statementCode || '', stmtText: r.statementText || '', stmtFor: r.statementFor || '', id: Date.now()+Math.random() }));

                    // 6. Supporting Docs - the file's whole row in the panel's keys (drn, issuer*, bene*, expiry); before only
                    // name / address 1 / ref / date / place were kept, so the rest was lost when the BE was built again. 19-Nov-2026
                    const docsData = match(loaded._supportingDocsModel || loaded._supportingdocsmodel);
                    if (docsData.length > 0 && !Array.isArray(item.docsData)) item.docsData = docsData.map(r => ({ icegateId: r.icegateUserId || '', docCode: r.documentTypeCode || r.documentClassCode || '', docName: '', irn: r.imageReferenceNo || '', drn: r.documentReferenceNo || r.documentReferenceNumber || '', issueDate: r.documentIssueDate || '', expiryDate: r.documentExpiryDate || '', placeOfIssue: r.placeOfIssue || r.documentIssueLocation || '', issuerCode: r.documentIssuingPartyCode || '', issuerName: r.documentIssuingPartyName || r.documentIssuerName || '', issuerAddr1: r.documentIssuingPartyNameAddress1 || r.documentIssuerAddress || '', issuerAddr2: r.documentIssuingPartyNameAddress2 || '', issuerCity: r.documentIssuingPartyNameCity || '', issuerPin: r.documentIssuingPartyNamePin || '', beneCode: r.documentBeneficiaryPartyCode || '', beneName: r.documentBeneficiaryPartyName || '', beneAddr1: r.documentBeneficiaryPartyNameAddress1 || '', beneAddr2: r.documentBeneficiaryPartyNameAddress2 || '', beneCity: r.documentBeneficiaryPartyNameCity || '', benePin: r.documentBeneficiaryPartyPin || '', fileType: String(r.fileType || 'PDF').toUpperCase(), docFor: 'ITEM', id: Date.now()+Math.random() }));

                    return item;
                });


              let esanchitDocsOut = [];
              {
                  const pj = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } return Array.isArray(v) ? v : null; };
                  const savedDocs = pj(loaded.esanchitDocs);
                  if (savedDocs && savedDocs.length > 0) {
                      esanchitDocsOut = savedDocs;
                  } else {
                    let eDocs = pj(loaded.finalDocs) || [];
                    const allDocs = pj(loaded._supportingDocsModel) || pj(loaded._supportingdocsmodel) || [];
                    // BE-level (0/0) and invoice-level (inv/0) documents both belong to this tab. 28-Oct-2026
                    const headerDocs = (Array.isArray(allDocs) ? allDocs : []).filter(d => String(d.itemSerialNumber || '0') === "0");
                    if (headerDocs.length > 0) {
                        eDocs = headerDocs.map((d, i) => ({
                            id: newRowId(),
                            srNo: i + 1,
                            docFor: String(d.invoiceSerialNumber || '0') === '0' ? 'HEADER' : 'INVOICE',
                            invSrNo: String(d.invoiceSerialNumber || '0') === '0' ? '' : String(d.invoiceSerialNumber),
                            icegateId: d.icegateUserId || '',
                            fileType: d.fileType || 'PDF',
                            irn: d.imageReferenceNo || '',
                            drn: d.documentReferenceNo || '',
                            docCode: d.documentTypeCode || '',
                            fileName: d.fileType || '',
                            issuerCode: d.documentIssuingPartyCode || '',
                            issuerName: d.documentIssuingPartyName || '',
                            issuerAddr1: d.documentIssuingPartyNameAddress1 || '',
                            issuerAddr2: d.documentIssuingPartyNameAddress2 || '',
                            issuerCity: d.documentIssuingPartyNameCity || '',
                            issuerPin: d.documentIssuingPartyNamePin || '',
                            beneCode: d.documentBeneficiaryPartyCode || '',
                            beneName: d.documentBeneficiaryPartyName || '',
                            beneAddr1: d.documentBeneficiaryPartyNameAddress1 || '',
                            beneAddr2: d.documentBeneficiaryPartyNameAddress2 || '',
                            beneCity: d.documentBeneficiaryPartyNameCity || '',
                            benePin: d.documentBeneficiaryPartyPin || '',
                            placeOfIssue: d.placeOfIssue || '',
                            issueDate: d.documentIssueDate || '',
                            expiryDate: d.documentExpiryDate || ''
                        }));
                    }
                    esanchitDocsOut = eDocs;
                  }
                }
              
              const transportModeOut = loaded.shipmentMode === 'AIR' ? 'A' : loaded.shipmentMode === 'LAND' ? 'L' : 'S';
              
              const beTypeOut = loaded.boeType === 'WAREHOUSE' ? 'W' : loaded.boeType === 'EX_BOND' ? 'X' : 'H';
              
              return { jobData: jobDataOut, items: loadedItems, esanchitDocs: esanchitDocsOut, transportMode: transportModeOut, beType: beTypeOut };
}

function InnerLayout() {
  const [activeTab, setActiveTab] = useState('dashboard');
  // 30-Oct-2026: tabs the user has no View right for are hidden (Master > User Management > Bill of Entry (Import) forms)
  // 10-Nov-2026: a duplicated job is a new job of today - not the docket / iCAFFE record / amendment of the one it was
  // copied from; where an invoice has the freight / insurance rate AND the amount worked out from it (jobs read from
  // iCAFFE), the rate is kept (a fresh BE takes one of the two)
  const dupClean = (j) => {
    const o = { ...j, jobDate: new Date(Date.now() + 19800000).toISOString().slice(0, 10) };
    ['docketNo', 'icaffeRowId', 'icaffeShipmentId', 'icaffeEnteredBy', 'icaffeFile', '_amendmentId', '_amendOfJobId', '_amendOfJobNo', '_amendNo', '_amendDate', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt'].forEach(k => { delete o[k]; });
    const has = (v) => v !== undefined && v !== null && String(v).trim() !== '' && Number(String(v).replace(/,/g, '')) !== 0;
    let cleared = 0;
    o.invoices = (o.invoices || []).map(inv => {
      const x = { ...inv };
      if (has(x.insuranceRate) && (has(x.insuranceValue) || has(x.insuranceAmount))) { x.insuranceValue = ''; x.insuranceAmount = ''; cleared++; }
      if (has(x.freightRate) && (has(x.freightValue) || has(x.freightAmount))) { x.freightValue = ''; x.freightAmount = ''; cleared++; }
      return x;
    });
    if (cleared) setTimeout(() => toast('Freight / insurance: the rate is kept and the amount worked out from it cleared on ' + cleared + ' invoice line(s) - check 3. Invoices', { id: 'dup-rate', icon: 'ℹ️', duration: 7000 }), 300);
    return o;
  };
  const P = usePermissions();
  const tabAllowed = (t) => P.canOpen('/job-entry#' + t);
  useEffect(() => { if (!tabAllowed(activeTab)) { const first = ['dashboard', 'query', 'header', 'invoices', 'items', 'reports'].find(tabAllowed); if (first) setActiveTab(first); } }, [activeTab, P.restricted]);
  const [refreshKey, setRefreshKey] = useState(0);
  const { jobData, setJobData, items, setItems: setGlobalItems, resetJobContext, setEsanchitDocs, esanchitDocs, pendingEditsMessage } = React.useContext(JobContext);
  // 30-Oct-2026: the Items / Invoices forms only reach the job on MODIFY / ADD, so a row typed and left behind
  // was validated and filed with its OLD values without a word. Both tabs register a check (JobContext); it is
  // asked before anything is built from the job. Nothing half-typed is applied by itself - the operator decides.
  // 20-Nov-2026: asked in an EagleView window with named buttons ("Build the file anyway" / "Go back to MODIFY"), not the
  // browser's "localhost:5174 says ... OK / Cancel" box. Resolves true = stop (go back).
  const unsavedEdits = async (what) => {
    const msg = typeof pendingEditsMessage === 'function' ? pendingEditsMessage() : '';
    if (!msg) return false;
    return !(await askUnsavedEdits(msg, what, 'Go back to MODIFY'));
  };
  // "+ CREATE NEW JOB (RESET)" resets the form in place (30-Oct-2026: the browser drafts are gone, nothing to clear)
  const [resetNonce, setResetNonce] = useState(0);
  const handleCreateNewJob = async () => {
    if (!(await askConfirm({ title: 'Start a new job?', message: 'Unsaved changes on this job will be cleared.', okLabel: 'Start new job', cancelLabel: 'Stay on this job' }))) return;
    resetToNewJob();
    toast.success('New job ready');
  };
  // shared by "+ CREATE NEW JOB" and the "New Job" button of the job list
  const resetToNewJob = () => {
    resetJobContext();
    setTransportMode('A');
    setBeType('H');
    setLinkedWhJob(null);
    setIcegateState({ loading: false, result: null, error: null });
    setResetNonce(n => n + 1);
    setActiveTab('header');
  };
  const { activeBranch, activeYear } = useGlobalContext();
  const [transportMode, setTransportMode] = useState('A');
  const [beType, setBeType] = useState('H');
  // 29-Oct-2026: the Mode / BE Type boxes of the Job Header live here (transportMode / beType) and reached jobData only on
  // save, so the checklist, duty reports and validator of an unsaved job saw the default SEA / Home: keep them in step
  React.useEffect(() => {
    const shipmentMode = ({ A: 'AIR', S: 'SEA', L: 'LAND' })[transportMode] || 'SEA';
    const boeType = ({ H: 'HOME_CONSUMPTION', W: 'WAREHOUSE', X: 'EX_BOND' })[beType] || 'HOME_CONSUMPTION';
    setJobData(prev => (prev.shipmentMode === shipmentMode && prev.boeType === boeType && prev.autoField_52 === transportMode && prev.autoField_51 === beType) ? prev
      : { ...prev, shipmentMode, boeType, autoField_52: transportMode, autoField_51: beType });
  }, [transportMode, beType]); // eslint-disable-line
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineTargetJobId, setTimelineTargetJobId] = useState(null);

  // ICEGATE states
  const [icegateState, setIcegateState] = useState({ loading: false, result: null, error: null });
  // 30-Oct-2026: a BE that went to ICEGATE (Filed / Accepted / Amended) is locked - every auto-save was overwriting the
  // filed data. "Unlock for amendment" (reason asked, written to the job timeline) opens it again until the next filing.
  const FILED_STATUSES = ['Filed', 'Accepted', 'Amended'];
  const [amendMode, setAmendMode] = useState(false);
  const [amendReason, setAmendReason] = useState('');
  const isFiled = FILED_STATUSES.includes(String(jobData?.icegateStatus || ''));
  const isFiledLocked = isFiled && !jobData?.amendUnlockedAt && !amendMode;
  // 20-Nov-2026: asked in an EagleView window (the browser's prompt box is not shown in every browser)
  const unlockForAmendment = async () => {
    const why = await askText({ title: 'Unlock for amendment', message: `This BE was ${jobData.icegateStatus} on ICEGATE (${jobData.icegateUniqueId || ''}).\nUnlock it for an amendment? The copy sent to ICEGATE stays on the job.`,
      label: 'Reason (goes to the job log)', required: false, okLabel: 'Unlock' });
    if (why === null) return;
    setAmendReason(String(why).trim()); setAmendMode(true);
    toast('Unlocked for amendment - changes are saved with Save / Modify; file the amendment from Reports & Submission', { icon: '🔓', duration: 6000 });
  };
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [previewJson, setPreviewJson] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState(null); // which tab the import window opens on (file / json)
  const [showWhSelector, setShowWhSelector] = useState(false);
  const [linkedWhJob, setLinkedWhJob] = useState(null);

  // the linked WH job follows the job on screen (saved as inBondJobId / inBondJobNo); before, it lived only in this
  // state, so a saved Ex-Bond job opened the WH BE selector again every time it was loaded. 28-Oct-2026
  useEffect(() => {
    setLinkedWhJob(jobData?.inBondJobId ? { id: jobData.inBondJobId, jobNo: jobData.inBondJobNo || jobData.inBondJobId, warehouseCode: jobData.warehouseCode || '' } : null);
  }, [jobData?.inBondJobId, jobData?.inBondJobNo, jobData?.warehouseCode]);

  // 22-Nov-2026: the "WH Bal / Left" figures were the ones taken when the WH BE was linked. They are read again when a
  // saved ex-bond is opened and after each save (one light query), so an ex-bond filed meanwhile shows at once.
  const balSeen = React.useRef(''); const openJobId = React.useRef(null); openJobId.current = jobData?.id;
  useEffect(() => {
    const whId = jobData?.inBondJobId, id = jobData?.id;
    if ((beType || '').toUpperCase() !== 'X' || !whId || !id || !(items || []).length) return;
    const mark = id + '|' + whId + '|' + (jobData.updatedAt || '');
    if (balSeen.current === mark) return; balSeen.current = mark;
    fetch(`/api/warehouse-be/balances/${whId}?excludeJobId=${id}`).then(r => r.json()).then(j => {
      if (String(openJobId.current) !== String(id) || !j || !j.success || !j.data) return;
      const { whQty = {}, byKey = {} } = j.data; const n = (v) => { const x = parseFloat(v); return Number.isFinite(x) ? x : 0; };
      let moved = 0; const over = [];
      setGlobalItems(prev => {
        if (!Array.isArray(prev)) return prev;
        moved = 0; over.length = 0;
        const next = prev.map(it => {
          const k = String(it.invSrNo || '1').trim() + '/' + String(it.itemSrNo || it.itemNo || '').trim();
          if (!(k in whQty)) return it;
          const b = byKey[k] || {}; const orig = n(whQty[k]), cleared = n(b.cleared), draft = n(b.draft); const bal = Math.max(0, +(orig - cleared).toFixed(6));
          if (n(it.qty || it.quantity) > bal + 1e-6) over.push(String(it.itemSrNo || ''));
          if (it._whBalanceQty !== undefined && n(it._whBalanceQty) === bal && n(it._whClearedQty) === cleared && n(it._whDraftQty) === draft && n(it._whOriginalQty) === orig) return it;
          moved++; return { ...it, _whOriginalQty: orig, _whClearedQty: cleared, _whDraftQty: draft, _whBalanceQty: bal };
        });
        return moved ? next : prev;
      });
      setTimeout(() => {
        if (over.length) toast.error(`Warehouse balance: ${over.length} item(s) of this ex-bond are now above what is left in the warehouse (Item Sr No ${over.slice(0, 8).join(', ')}${over.length > 8 ? ' ...' : ''}) - another ex-bond of WH BE ${j.data.jobNo || ''} was filed. Reduce their quantity.`, { duration: 12000 });
        else if (moved) toast(`Warehouse balance refreshed on ${moved} item(s)`, { icon: 'ℹ️', duration: 5000 });
      }, 50);
    }).catch(() => { balSeen.current = ''; });
  }, [jobData?.id, jobData?.inBondJobId, jobData?.updatedAt, beType, (items || []).length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // open the selector for a new Ex-Bond only (not when it is linked, or the WH BE No is already given)
    if ((beType || '') === 'X' && !jobData?.inBondJobId && !String(jobData?.warehouseBENo || '').trim()) setShowWhSelector(true);
  }, [beType]);

  // Link a WH BE: fills the WH BE No / Date / warehouse code / custom site, the importer (when the Ex-Bond has none yet)
  // and the invoices / items with the quantity still in the warehouse. 28-Oct-2026: before, the WH BE No and Date were
  // never filled, the warehouse code was also written into "Bulk shipment" (autoField_18), the port code into the
  // Location name, and the full WH quantity was copied even when earlier ex-bonds had cleared part of it.
  const whValueFor = (item, bal) => {
    const px = parseFloat(String(item.price ?? item.unitPrice ?? '').replace(/,/g, '')); const orig = parseFloat(item.quantity || item.qty) || 0;
    if (!(px > 0) || !(bal > 0) || Math.abs(bal - orig) < 1e-9) return null;
    const v = (bal * px).toFixed(2); return { value: v, assessableValue: v };
  };
  const sec65For = (item, whCode) => {
    let has = item.swCtrlData; if (typeof has === 'string') { try { has = JSON.parse(has); } catch (e) { has = null; } }
    if ((Array.isArray(has) && has.length) || !String(whCode || '').trim()) return null;
    return { swCtrlData: [{ id: newRowId(), typeCode: 'SEC65', location: String(whCode).trim().toUpperCase(), startDate: '', endDate: '', resultCode: '', resultText: String(item.cth || item.ritc || '').trim(), slNo: String(item.itemSrNo || item.itemNo || '').trim() }], swControlFlag: 'Y' };
  };
  const handleWhBeSelected = async (whJob) => {
    const hasItems = (items || []).length > 0 || (jobData?.invoices || []).some(iv => (iv.items || []).length);
    let data = null;
    try {
        const res = await fetch(`/api/warehouse-be/by-id/${whJob.id}${jobData?.id ? '?excludeJobId=' + jobData.id : ''}`);
        data = await res.json();
    } catch (err) {
        console.error('Failed to fetch WH job details', err);
    }
    const wh = (data && data.success && data.data) || {};
    let invoicesToCopy = [];
    let itemsToCopy = [];
    let fullyCleared = 0;
    (wh.invoices || []).forEach((inv, k) => {
      const its = (inv.items || []).map(item => {
        const bal = item._whBalanceQty !== undefined ? item._whBalanceQty : (parseFloat(item.quantity || item.qty) || 0);
        // a fresh screen id (the item grid edits / deletes by id); the database gives its own id on save
        return { ...item, id: newRowId(), importInvoiceId: undefined, invSrNo: String(item.invSrNo || k + 1),
          _whOriginalQty: item.quantity || item.qty, _whClearedQty: item._whClearedQty || 0, _whBalanceQty: bal,
          _whOriginalValue: item.value || item.assessableValue, qty: String(bal), quantity: String(bal),
          // 22-Nov-2026: the value follows the quantity (value = qty x unit price). Before, the item kept the value of the
          // FULL warehouse quantity, and Save refused every item ("Value ... does not match Qty x Unit price").
          ...(whValueFor(item, bal) || {}),
          // 22-Nov-2026: every ex-bond item of a Sec 65 warehouse carries a SEC65 control row (seen in two filed X BEs):
          // warehouse code, the item's CTH and the W BE item no are known here; the dates and the result code are typed
          // once on any item and copied with "Apply to All Items". An item that already has control rows keeps them.
          ...(sec65For(item, whJob.warehouseCode || wh.warehouseCode) || {}) };
      }).filter(it => { if (parseFloat(it._whBalanceQty) > 0) return true; fullyCleared++; return false; });
      invoicesToCopy.push({ ...inv, id: undefined, importJobId: undefined, items: its });
      itemsToCopy = [...itemsToCopy, ...its];
    });
    // 30-Oct-2026: the balance counts only ex-bonds that reached customs; other ex-bond DRAFTS of this WH BE do not
    // reduce it, so the operator is told they exist
    if (wh.exBondDraftCount > 0) { const dq = itemsToCopy.reduce((s, it) => s + (parseFloat(it._whDraftQty) || 0), 0); toast(`${wh.exBondDraftCount} other ex-bond job(s) of WH BE ${whJob.jobNo || ''} are still drafts (not filed)${dq ? ` - ${dq} qty is in them and is NOT deducted from the balance shown` : ''}`, { icon: '⚠️', duration: 9000 }); }
    const copyItems = invoicesToCopy.length > 0 && (!hasItems || await askConfirm({ title: 'Replace the invoices / items?', message: 'The invoices / items of this Ex-Bond are replaced with the balance quantity of WH job ' + (whJob.jobNo || '') + '.', note: 'Quantities and SEC65 rows typed on this job are lost.', okLabel: 'Replace', cancelLabel: 'Keep what is here' }));
    const keep = (k, v) => (v !== undefined && v !== null && String(v).trim() !== '' ? { [k]: v } : {});
    setJobData(prev => {
      const blank = (k) => !String(prev[k] || '').trim();
      const imp = {};
      // importer of the WH BE, only into empty boxes
      [['autoField_4', 'nameOfImporter'], ['autoField_5', 'iecCode'], ['autoField_6', 'address1'], ['autoField_7', 'address2'], ['autoField_8', 'city'], ['autoField_9', 'state'], ['autoField_10', 'pin'],
       ['autoField_48', 'branchSrNo'], ['autoField_49', 'aeoCode']].forEach(([af, nm]) => { const v = wh[af] || wh[nm]; if (blank(af) && v) { imp[af] = v; imp[nm] = v; } });
      ['autoField_11', 'autoField_12', 'autoField_13', 'autoField_50', 'importerPartyId'].forEach(k => { if (blank(k) && wh[k]) imp[k] = wh[k]; });
      const port = whJob.customsPort || wh.portCode || wh.autoField_2;
      // 22-Nov-2026: an ex-bond repeats these from its warehouse BE (compared with a filed X BE) - they were typed again
      // by hand before. Only into boxes that are still empty; a Y/N box counts as empty while it is N.
      ['countryOfOrigin', 'countryOfOriginName', 'autoField_20', 'portOfOrigin', 'portOfOriginName', 'autoField_22', 'portOfShipment', 'portOfShipmentName', 'autoField_23',
       'countryOfConsignment', 'countryOfConsignmentName', 'autoField_21', 'importerType', 'autoField_53', 'govtPrivate', 'importerClass', 'beClass', 'pkg', 'grossWtUnit']
        .forEach(k => { if (blank(k) && wh[k] !== undefined && wh[k] !== null && String(wh[k]).trim() !== '') imp[k] = wh[k]; });
      const rowsOf = (v) => { let r = v; if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { r = []; } } return Array.isArray(r) ? r : []; };
      [['bond', '_bondRows'], ['certificate', '_certRows'], ['highSeaSaleFlag', '_hssRows']].forEach(([flag, rows]) => {
        if (String(wh[flag] || '').toUpperCase() === 'Y' && String(prev[flag] || 'N').toUpperCase() !== 'Y' && !rowsOf(prev[rows]).length) { imp[flag] = 'Y'; if (rowsOf(wh[rows]).length) imp[rows] = wh[rows]; }
      });
      return {
        ...prev, ...imp,
        _inBondJobId: whJob.id, inBondJobId: whJob.id, inBondJobNo: whJob.jobNo || wh.jobNo || '',
        // 30-Oct-2026: linking a DIFFERENT WH job replaces the WH BE No / Date / code (keep() only filled blanks, so a
        // re-link left the old BE No and the ex-bond was filed against one WH BE while linked to another)
        ...((String(prev.inBondJobId || '') && String(prev.inBondJobId) !== String(whJob.id))
          ? { warehouseCode: whJob.warehouseCode || wh.warehouseCode || '', warehouseBENo: whJob.beNo || wh.beNo || '', warehouseBEDate: whJob.beDate || wh.beDate || '', warehouseCustomSiteId: port || '' }
          : { ...keep('warehouseCode', whJob.warehouseCode || wh.warehouseCode), ...keep('warehouseBENo', whJob.beNo || wh.beNo), ...keep('warehouseBEDate', whJob.beDate || wh.beDate), ...keep('warehouseCustomSiteId', port) }),
        ...(blank('portCode') && port ? { portCode: port, autoField_2: port, ...(wh.locationName || wh.autoField_1 ? { locationName: wh.locationName || wh.autoField_1, autoField_1: wh.locationName || wh.autoField_1 } : {}) } : {}),
        // 22-Nov-2026: _importedItems / _importedFinalDocs (a second full copy of the items, read by nothing) are no longer kept:
        // on a 207-item ex-bond they went to the server with every save and tripled the data on the Reports tab
        ...(copyItems ? { invoices: invoicesToCopy, _importedItems: null, _importedFinalDocs: null } : {}),
      };
    });
    if (whJob.shipmentMode || wh.shipmentMode) { const m = whJob.shipmentMode || wh.shipmentMode; setTransportMode(m === 'AIR' ? 'A' : m === 'LAND' ? 'L' : 'S'); }
    if (copyItems) setGlobalItems(itemsToCopy);
    // the e-Sanchit documents of the warehouse BE (the ex-bond is filed with the same IRNs), when this job has none yet
    const whDocs = Array.isArray(wh.esanchitDocs) ? wh.esanchitDocs : [];
    if (whDocs.length && !(esanchitDocs || []).length && setEsanchitDocs) setEsanchitDocs(whDocs.map((d, k) => ({ ...d, id: Date.now() + k })));
    const sec = copyItems ? itemsToCopy.filter(it => (it.swCtrlData || []).some && (it.swCtrlData || []).some(r => r.typeCode === 'SEC65' && !r.resultCode)).length : 0;
    if (sec) toast(`SEC65 control row added on ${sec} item(s). Open SW Control on one item, fill Start Date, End Date and Result Code, then "Apply to All Items".`, { icon: 'ℹ️', duration: 12000 });
    toast.success(`Linked WH job ${whJob.jobNo || ''}${whJob.beNo ? ' (WH BE ' + whJob.beNo + ')' : ''}${copyItems ? ' - ' + itemsToCopy.length + ' item(s) with balance qty' : ''}`);
    if (fullyCleared) toast(`${fullyCleared} item(s) of the WH BE are fully cleared by earlier ex-bonds and were not copied`, { duration: 6000 });
    if (!(whJob.beNo || wh.beNo)) toast('The WH job has no BE No yet - enter the WH BE No / Date in the Job Header', { icon: '⚠️', duration: 6000 });
  };

  const loadJobForEditing = async (jobId) => {
      // 30-Oct-2026: the result banner / validation / preview of the previous job stayed on screen after switching
      setIcegateState({ loading: false, result: null, error: null }); setValResult(null); setPreviewJson(null); setAmendMode(false); setAmendReason('');
      try {
          const res = await fetch(`/api/import-jobs/${jobId}`);
          const json = await res.json();
          if (json.success && json.data) {
              const loaded = json.data;
              const m = mapLoadedImportJob(loaded);
              // replace, do not merge: merging kept fields of the job that was open before
              setJobData(m.jobData);
              setGlobalItems(m.items);
              if (setEsanchitDocs) setEsanchitDocs(m.esanchitDocs);
              setTransportMode(m.transportMode);
              setBeType(m.beType);
              setActiveTab('header');
          }
      } catch (e) {
          console.error("Failed to load job", e);
      }
  };

  const handleImport = ({ directSavedJobId, jobData: imported, invoices, items, duties, exchangeRates, infoTypes, statements }) => {
      if (directSavedJobId) {
            setShowImport(false);
            setRefreshKey(prev => prev + 1);
            loadJobForEditing(directSavedJobId);
            setActiveTab('header');
            return;
        }
    if (imported.autoField_52) {
       const m = imported.autoField_52.toUpperCase();
       setTransportMode(m.includes('A') ? 'A' : (m.includes('S') || m.includes('SEA') ? 'S' : 'L'));
    }
    if (imported.autoField_51) {
       const b = imported.autoField_51.toUpperCase();
       setBeType(b.includes('W') ? 'W' : (b.includes('X') ? 'X' : 'H'));
    }
    // (30-Oct-2026: no default CTX type for a file without one - the validator asks for it)

    const extraData = {};
      if (duties?.length > 0) extraData._duties = duties;
      if (exchangeRates?.length > 0) extraData._exchangeRates = exchangeRates;
      if (infoTypes?.length > 0) extraData._infoTypes = infoTypes;
      if (statements?.length > 0) extraData._statements = statements;
      setJobData(prev => ({ ...prev, ...imported, ...extraData, ...(invoices?.length > 0 ? { invoices } : {}) }));
      if (items?.length > 0) {
        setGlobalItems(items);
      }
    };

  // The old flat-file route (/api/JobEntry/GenerateLegacyFlatFile) never existed. ICEGATE now takes the CACHI01 JSON,
  // so this downloads the same JSON that "Send to ICEGATE" would send (for signing / upload on the ICEGATE site). 28-Oct-2026
  // 17-Nov-2026: Download JSON / .be / Preview JSON ask which ICEGATE ID goes in the file (they always used the default
  // ID, so the downloaded file did not match the one sent as SHERSINGHDANU from the Submit window)
  const [idPick, setIdPick] = useState(null); // { what: 'json' | 'flat' | 'preview' }
  const handleDownloadLegacy = async (profileId, loginId, src) => {
    // 18-Nov-2026: src = a job read for the job list's right-click menu (not the job open on the screen)
    const S = src || { jobData, items, esanchitDocs, beType, transportMode };
    // 14-Nov-2026: an amended job (AMD/...) is sent as an amendment file (CACHI01_A) from the amendment window. This menu
    // item built a full NEW BE file of the copy (same name, e.g. 3288.be) - uploaded by mistake it would file a new BE.
    if (S.jobData?._amendmentId) { toast('This is an amended job - its file for ICEGATE is the amendment file. Make / download it here.', { icon: '📝', duration: 6000 }); if (src) setListAmendJob(S.jobData); else setShowBeAmend(true); return; }
    if (!src && await unsavedEdits('build the file')) return;
    try {
      const res = await fetch('/api/icegate/preview-be', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobData: { ...S.jobData, esanchitDocs: S.esanchitDocs || [] }, items: S.items, invoices: S.jobData.invoices || [], beType: S.beType, transportMode: S.transportMode, forFiling: true, profileId }),
      });
      const data = await res.json();
      if (!data.success) { toast.error('Could not build the BE file: ' + (data.error || '')); return; }
      const v = data.validation;
      if (v && v.errors && v.errors.length) toast(`${v.errors.length} validation error(s) - fix them before filing`, { icon: '⚠️' });
      if (data.filedNote) toast(data.filedNote, { icon: '⚠️', duration: 9000 });
      const blob = new Blob([JSON.stringify(data.cachi01, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const sender = (data.cachi01 && data.cachi01.headerField && data.cachi01.headerField.senderID) || loginId || '';
      a.download = 'BE_' + String(S.jobData?.jobNo || 'DRAFT').replace(/[^\w-]+/g, '_') + (sender ? '_' + String(sender).replace(/[^\w-]+/g, '_') : '') + '_CACHI01.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      if (sender) toast.success('BE file downloaded - ICEGATE ID ' + sender);
    } catch (e) {
      toast.error('Could not build the BE file: ' + e.message);
    }
  };

  // ICES 1.5 flat file (.be) of the same BE, for upload on ICEGATE / the BE filing utility (29-Oct-2026)
  const handleDownloadFlatBe = async (profileId, loginId, src) => {
    // 18-Nov-2026: src = a job read for the job list's right-click menu (not the job open on the screen)
    const S = src || { jobData, items, esanchitDocs, beType, transportMode };
    // 14-Nov-2026: an amended job (AMD/...) is sent as an amendment file (CACHI01_A) from the amendment window. This menu
    // item built a full NEW BE file of the copy (same name, e.g. 3288.be) - uploaded by mistake it would file a new BE.
    if (S.jobData?._amendmentId) { toast('This is an amended job - its file for ICEGATE is the amendment file. Make / download it here.', { icon: '📝', duration: 6000 }); if (src) setListAmendJob(S.jobData); else setShowBeAmend(true); return; }
    if (!src && await unsavedEdits('build the file')) return;
    try {
      const res = await fetch('/api/icegate/flat-be', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobData: { ...S.jobData, esanchitDocs: S.esanchitDocs || [] }, items: S.items, invoices: S.jobData.invoices || [], beType: S.beType, transportMode: S.transportMode, profileId }),
      });
      const data = await res.json();
      if (!data.success) { toast.error('Could not build the .be file: ' + (data.error || '')); return; }
      if (loginId) toast.success('.be file made - ICEGATE ID ' + loginId);
      const v = data.validation;
      if (v && v.errors && v.errors.length) toast(`${v.errors.length} validation error(s) - fix them before filing`, { icon: '⚠️' });
      if (data.filedNote) toast(data.filedNote, { icon: '⚠️', duration: 9000 });
      if (data.unconfirmedTables && data.unconfirmedTables.length) toast(`Check on ICEGATE: section name(s) ${data.unconfirmedTables.join(', ')} not yet seen in a filed .be`, { icon: 'ℹ️', duration: 6000 });
      const blob = new Blob([data.content], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = data.fileName || 'BE.be';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      toast.error('Could not build the .be file: ' + e.message);
    }
  };

  // returns the saved job (or null). A click event passed by a button is ignored: "Save Draft" used onClick={handleSaveDraft},
  // so the event object was merged into the job and the save failed. 28-Oct-2026
  // 30-Oct-2026: a row added in 3. Invoices / 4. Items used to save the WHOLE job at once. On a job whose header was
  // not filled yet that meant "Importer Name is mandatory" on every Add, and on a filled one a "Job saved" toast and a
  // database write per row. Row changes now go through autoSave(): they are kept quiet, joined together (one save for
  // a burst of edits) and skipped completely until the job itself has been saved once.
  const autoTimer = React.useRef(null);
  const autoPending = React.useRef({});
  const hintedRef = React.useRef(false);
  const autoSave = (overrides = {}) => {
    if (!jobData.id) {
      if (!hintedRef.current) { hintedRef.current = true; toast('Rows are kept on the screen - press SAVE in 1. Job Header to create the job', { duration: 7000, icon: 'ℹ️' }); }
      return;
    }
    autoPending.current = { ...autoPending.current, ...(overrides && typeof overrides === 'object' && !overrides.nativeEvent ? overrides : {}) };
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => { const o = autoPending.current; autoPending.current = {}; handleSaveDraft(o, true); }, 800);
  };
  React.useEffect(() => () => { if (autoTimer.current) clearTimeout(autoTimer.current); }, []);

  // 22-Nov-2026: what the last successful save wrote. An item Modify on a saved job then sends only the changed items
  // (POST /api/import-jobs/:id/items-patch) when nothing else differs - same items in the same order with the same
  // Item Sr Nos, header / invoices / documents as saved. Anything else goes through the full save as before.
  const savedSnap = React.useRef(null);
  const VOLATILE = ['id', 'jobNo', 'updatedAt', 'updatedBy', 'createdBy', 'amendUnlockedAt', 'amendUnlockedBy', 'itemTotal'];
  const itemKey = (it) => String(it.invSrNo || it.invoiceSrNo || '1').trim() + '/' + String(it.itemSrNo || it.itemNo || '').trim();
  const changedItemsOnly = (overrides, allItems) => {
    const s = savedSnap.current;
    if (!s || !jobData.id || String(s.id) !== String(jobData.id) || amendMode) return null;
    if (Object.keys(overrides).some(k => k !== 'items')) return null;
    if ((esanchitDocs || []) !== s.docs && JSON.stringify(esanchitDocs || []) !== JSON.stringify(s.docs)) return null;
    for (const k of new Set([...Object.keys(jobData), ...Object.keys(s.job)])) if (!VOLATILE.includes(k) && jobData[k] !== s.job[k]) return null;
    if (!Array.isArray(allItems) || allItems.length !== s.items.length) return null;
    const changed = [];
    for (let k = 0; k < allItems.length; k++) {
      const it = allItems[k], was = s.items[k];
      if (it === was) continue;
      if (itemKey(it) !== itemKey(was) || !String(it.itemSrNo || it.itemNo || '').trim()) return null;
      if (JSON.stringify(it) !== JSON.stringify(was)) changed.push(it);
      if (changed.length > 25) return null;
    }
    return changed.length ? changed : null;
  };

  const handleSaveDraft = async (overrides = {}, auto = false) => {
      if (!overrides || typeof overrides !== 'object' || overrides.nativeEvent || overrides.target || Array.isArray(overrides)) overrides = {};
      // 18-Nov-2026: Save / Modify / Delete in Items and Invoices save the job in the background with no message, so
      // "Modify" looked dead. They now pass _notify, shown when the save went through (errors were always shown).
      const notify = overrides._notify; if (notify) { overrides = { ...overrides }; delete overrides._notify; }
      try {
        const modeMap = { 'A': 'AIR', 'S': 'SEA', 'L': 'LAND' };
        const boeMap = { 'H': 'HOME_CONSUMPTION', 'W': 'WAREHOUSE', 'X': 'EX_BOND' };
        
        const payload = { ...jobData, ...overrides };
        if (isFiledLocked) { toast.error(`This BE was ${jobData.icegateStatus} on ICEGATE and is locked. Click "Unlock for amendment" (top bar) to change it.`, { duration: 6000 }); return null; }
        if (amendMode) { payload._amendMode = true; payload._amendReason = amendReason; }
        delete payload.filedJson; delete payload.hasFiledJson;
        if (payload.id && payload.updatedAt) payload._loadedAt = payload.updatedAt; // the version we loaded (server refuses when someone saved since)
      payload.shipmentMode = modeMap[transportMode] || 'SEA';
      payload.boeType = boeMap[beType] || 'HOME_CONSUMPTION';
      if (!payload.jobNo) payload.jobNo = 'DRAFT';
      
      if (activeBranch && !activeBranch.isAll) payload.branchId = activeBranch.id;
      if (activeYear) payload.financialYearId = activeYear.id;
      // 18-Nov-2026: a save started from a timer (autoSave, Read File) sees the docs of an older render - docs read from
      // an Excel were left out until the next SAVE. The caller can pass the docs it has just set.
      payload.esanchitDocs = Array.isArray(overrides.esanchitDocs) ? overrides.esanchitDocs : (esanchitDocs || []);
      if (payload._importedItems) payload._importedItems = null; if (payload._importedFinalDocs) payload._importedFinalDocs = null; // old ex-bond jobs: drop the unused copy on the next save
      
      const currentItems = overrides.items || items;
      const allItems = currentItems || jobData.items || [];
      // 30-Oct-2026: the saved item total follows the items on every save (it was refreshed only by Recalculate)
      { const tot = allItems.reduce((s, it) => s + ((parseFloat(it.qty || it.quantity) * parseFloat(it.price || it.unitPrice)) || parseFloat(it.value) || 0), 0); payload.itemTotal = allItems.length ? tot.toFixed(2) : ''; }
      if (payload.invoices && payload.invoices.length > 0) {
        payload.invoices = payload.invoices.map((inv, idx) => {
          // Items belong to the invoice by their Inv Sr No (screen field invSrNo). The old match looked at invoiceSrNo,
          // which screen items do not have, so EVERY item was saved under invoice 1. 28-Oct-2026
          const srOf = (it) => String(it.invSrNo || it.invoiceSrNo || '').trim();
          const invItems = allItems.filter(it => {
            const sr = srOf(it);
            // 30-Oct-2026: a numeric Inv Sr No is a position only - matching it against the invoice NUMBER too saved an
            // item under two invoices when invoice numbers were plain digits ("1", "2"); a non-numeric value is an old
            // record that held the invoice number itself
            if (sr) return /^\d+$/.test(sr) ? sr === String(idx + 1) : (!!inv.invNo && sr.toUpperCase() === String(inv.invNo).trim().toUpperCase());
            if (it.importInvoiceId && inv.id) return String(it.importInvoiceId) === String(inv.id);
            return idx === 0; // no invoice given -> first invoice
          });
          return { ...inv, items: invItems };
        });
        // 30-Oct-2026: items pointing to an invoice that is not on the job are not moved to invoice 1 any more (the
        // server refuses that too) - the operator fixes the item's invoice first
        const placed = new Set(payload.invoices.flatMap(inv => inv.items));
        const lost = allItems.filter(it => !placed.has(it));
        if (lost.length) {
          toast.error(`${lost.length} item(s) point to an invoice that is not on this job (Inv Sr No ${[...new Set(lost.map(it => it.invSrNo || it.invoiceSrNo || '?'))].join(', ')}) - open them in 4. Items, choose the invoice and Modify, then save`, { duration: 8000 });
          return;
        }
      } else if (currentItems && currentItems.length > 0) {
        // 29-Oct-2026: items without any invoice used to be saved under an invented "DUMMY-INV" invoice.
        // 30-Oct-2026: not saved at all - the server refuses a blank invoice with items too; add the invoice first
        toast.error(`${currentItems.length} item(s) have no invoice - enter the invoice in 3. Invoices first (Save), then save the job`, { duration: 7000 });
        return;
      }
      
      
        if (!payload.autoField_4) { toast.error('Validation Error: Importer Name is mandatory in Job Header.'); return; }
        if (!payload.autoField_5) { toast.error('Validation Error: IEC Code is mandatory in Job Header.'); return; }
        if (!payload.autoField_48) { toast.error('Validation Error: Branch Sr. No is mandatory in Job Header.'); return; }
        
        if (payload.boeType === 'WAREHOUSE') {
          // bonds added with "Add" sit in _bondRows (the form fields are cleared after adding)
          let bondRows = payload._bondRows;
          if (typeof bondRows === 'string') { try { bondRows = JSON.parse(bondRows); } catch (e) { bondRows = []; } }
          const hasBondRow = Array.isArray(bondRows) && bondRows.some(b => b && b.bondNo);
          if (!hasBondRow) {
            if (!payload.autoField_24) { toast.error('Validation Error: Bond No is mandatory for WAREHOUSE jobs.'); return; }
            if (!payload.autoField_26) { toast.error('Validation Error: Bond Code is mandatory for WAREHOUSE jobs.'); return; }
            if (!payload.autoField_27) { toast.error('Validation Error: Bond Port is mandatory for WAREHOUSE jobs.'); return; }
          }
        }
        
        if (payload.boeType === 'EX_BOND') {
          if (!payload.inBondJobId && !(String(payload.warehouseBENo || '').trim() && String(payload.warehouseBEDate || '').trim())) { toast.error('Ex-Bond: click "Select WH BE" to link the warehouse BE, or enter the WH BE No and Date in Job Header.'); setShowWhSelector(true); return; }
          // certificates added with "Add" sit in _certRows (the form fields are cleared after adding). 28-Oct-2026
          let certRows = payload._certRows;
          if (typeof certRows === 'string') { try { certRows = JSON.parse(certRows); } catch (e) { certRows = []; } }
          if (!(Array.isArray(certRows) && certRows.some(c => c && c.certNo))) {
            if (!payload.autoField_30) { toast.error('Validation Error: Cert. No is mandatory for EX-BOND jobs.'); return; }
            if (!payload.autoField_31) { toast.error('Validation Error: Cert. Date is mandatory for EX-BOND jobs.'); return; }
            if (!payload.autoField_32) { toast.error('Validation Error: Cert. Type is mandatory for EX-BOND jobs.'); return; }
          }
          if (!payload.warehouseCode) { toast.error('Validation Error: Warehouse Code is mandatory for EX-BOND jobs.'); return; }
        }

        if (!payload.boeType) { toast.error('Validation Error: Bill of Entry Type is mandatory.'); return; }

      let response = null, data = null;
      const onlyThese = auto ? changedItemsOnly(overrides, allItems) : null;
      if (onlyThese) {
        const pr = await fetch(`/api/import-jobs/${payload.id}/items-patch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _loadedAt: payload._loadedAt, itemTotal: payload.itemTotal, items: onlyThese }) });
        const pj = await pr.json().catch(() => null);
        if (pj && (pj.success || !pj.fallback)) data = pj; // refused for a reason (stale, bad value, over the balance): shown below; "fallback" = full save
      }
      if (!data) {
      response = await fetch('/api/import-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      data = await response.json();
      }
        // 10-Nov-2026: a new job repeating the invoice / HAWB of another job (e.g. a duplicated job) - save only if the operator says so
        if (!data.success && data.duplicate) {
          // 22-Nov-2026: asked in the program window (the browser box could not name its buttons); an ex-bond always repeats the invoice of its warehouse BE
          if (auto || !(await askConfirm({ title: 'Same invoice / HAWB on another job', message: data.error, note: (beType === 'X' ? 'An ex-bond repeats the invoice of its warehouse BE and of earlier ex-bonds - that is expected.\n' : '') + 'Save anyway: this new job is saved.\nDo not save: check the invoice / HAWB first.', okLabel: 'Save anyway', cancelLabel: 'Do not save' }))) { if (!auto) toast('Not saved - ' + data.error, { icon: '⚠️', duration: 8000 }); return null; }
          response = await fetch('/api/import-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, _dupOk: true }) });
          data = await response.json();
        }
        if (data.success) {
          // what is on the server now: the header only after a full save, the items after either
          savedSnap.current = data.patched && savedSnap.current ? { ...savedSnap.current, items: allItems } : { id: data.data.id, job: { ...jobData, ...Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== 'items' && k !== 'esanchitDocs')) }, docs: payload.esanchitDocs, items: allItems };
          if (!auto) toast.success(`Job ${data.data.jobNo} saved successfully!`);
          else if (notify) toast.success(notify + ` - job ${data.data.jobNo} saved`, { duration: 4000 });
          // Ensure we update the context with the saved DB id and jobNo so subsequent saves update instead of creating new
          setJobData(prev => ({ ...prev, id: data.data.id, jobNo: data.data.jobNo, updatedAt: data.data.updatedAt || prev.updatedAt, updatedBy: data.data.updatedBy || prev.updatedBy, createdBy: data.data.createdBy || prev.createdBy, amendUnlockedAt: data.data.amendUnlockedAt || prev.amendUnlockedAt, amendUnlockedBy: data.data.amendUnlockedBy || prev.amendUnlockedBy }));
          return data.data;
        } else if (data.stale) {
          toast.error(data.error, { duration: 10000 });
          if (await askConfirm({ title: 'Job changed elsewhere', message: data.error, note: 'Re-open: the saved job is loaded and your unsaved changes on this screen are lost.', okLabel: 'Re-open the job', cancelLabel: 'Stay here', tone: 'danger' })) loadJobForEditing(payload.id);
        } else {
        // 30-Oct-2026: the server refuses impossible values and lists them (problems[])
        if (Array.isArray(data.problems) && data.problems.length) toast.error('Not saved - fix these:\n' + data.problems.slice(0, 6).map(x => '- ' + x).join('\n') + (data.problems.length > 6 ? `\n...and ${data.problems.length - 6} more` : ''), { duration: 12000, style: { whiteSpace: 'pre-line', maxWidth: '560px' } });
        else toast.error((data.locked ? 'Locked: ' : 'Error saving: ') + data.error, { duration: 7000 });
      }
    } catch (error) {
      console.error(error);
      toast.error('Error saving draft');
    }
    return null;
  };

  // Preview CACHI01 JSON without submitting
  const handlePreviewJson = async (profileId, src) => {
    // 18-Nov-2026: src = a job read for the job list's right-click menu (not the job open on the screen)
    const S = src || { jobData, items, esanchitDocs, beType, transportMode };
    setLoadingPreview(true);
    try {
      const res = await fetch('/api/icegate/preview-be', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobData: { ...S.jobData, esanchitDocs: S.esanchitDocs || [] },
          items: S.items,
          invoices: S.jobData.invoices || [],
          beType: S.beType,
          transportMode: S.transportMode,
          forFiling: true, // 16-Nov-2026: the preview is the file to submit - a filed job's BE No is left blank
          profileId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewJson(data.cachi01);
        setPreviewOf(src ? S.jobData : null);
        setShowJsonPreview(true);
        const v = data.validation;
        if (v && (v.errors.length || v.warnings.length)) {
          toast(`${v.errors.length} error(s), ${v.warnings.length} warning(s) found in this BE`, { icon: v.errors.length ? '⛔' : '⚠️' });
          setValResult({ ...v, title: 'Bill of Entry - Pre-Validation' });
        }
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
  const [showBeAmend, setShowBeAmend] = useState(false);
  // 18-Nov-2026: job list right-click menu - the BE amendment window of a job that is not open, and an action that
  // runs by itself once the job has opened (Send to ICEGATE needs the job on the screen: save + checks first)
  const [listAmendJob, setListAmendJob] = useState(null);
  const [pendingRun, setPendingRun] = useState(null);
  const latestSend = useRef(null); // the Send of the latest screen state (set below, after handleSendToIcegateClick)
  const [previewOf, setPreviewOf] = useState(null); // the list's job whose JSON the preview window shows (null = the job on the screen)
  useEffect(() => {
    if (!pendingRun || !jobData || String(jobData.id) !== String(pendingRun.id)) return;
    setPendingRun(null);
    // Send waits a moment for the screen to settle and uses the Send of the latest screen state
    if (pendingRun.what === 'send') setTimeout(() => { if (latestSend.current) latestSend.current(); }, 1500);
  }, [pendingRun, jobData]); // eslint-disable-line react-hooks/exhaustive-deps
  // 10-Nov-2026: /job-entry?openJob=<id>[&amend=1] opens that job (from Customs > BE Amendments)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search); const id = sp.get('openJob');
    if (!id) return;
    const amend = sp.get('amend') === '1';
    window.history.replaceState(null, '', window.location.pathname);
    (async () => { await loadJobForEditing(id); setActiveTab('header'); if (amend) setShowBeAmend(true); })();
  }, []); // eslint-disable-line
  const [showAck, setShowAck] = useState(false); // ICEGATE reply window, 29-Oct-2026
  const [showActionMenu, setShowActionMenu] = useState(false);

  // Trigger modal when Send to ICEGATE is clicked
  
  const fileInputRefAI = useRef(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleAiUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setIsAiLoading(true);
      
      const formData = new FormData();
      formData.append('pdf', file);
      
      try {
          const res = await fetch('/api/ai-extractor/extract-invoice', {
              method: 'POST',
              body: formData
          });
          const json = await res.json();
          if (json.success && json.data) {
              const aiData = json.data;
              // 28-Oct-2026: the PDF is ADDED as a new invoice with its items (it used to replace every invoice and item of
              // the job, and wrote invNo / supplier into the job header). An invoice no already on the job is not added twice.
              const extractedItems = Array.isArray(aiData) ? aiData : (Array.isArray(aiData.items) ? aiData.items : []);
              const invNo = String(aiData.invoiceNo || aiData.invoice_no || '').trim();
              const curInvs = jobData.invoices || [];
              if (invNo && curInvs.some(iv => String(iv.invNo || iv.invoiceNo || '').trim().toUpperCase() === invNo.toUpperCase())) {
                  toast.error(`Invoice ${invNo} is already on this job - nothing added`, { duration: 6000 });
                  return;
              }
              const invSrNo = String(curInvs.length + 1);
              const num = (v) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return isNaN(x) ? '' : String(x); };
              const newItems = extractedItems.map((it, idx) => {
                  const qty = num(it.qty || it.quantity), price = num(it.unitPrice || it.unit_price || it.price);
                  const value = num(it.amount || it.total_item_amount || it.value) || (qty && price ? String(+(qty * price).toFixed(2)) : '');
                  const ritc = String(it.ritc || it.hs_code || it.hsCode || '').replace(/\D/g, '').slice(0, 8);
                  const unit = String(it.unit || it.uqc || '').toUpperCase();
                  return { id: Date.now() + idx + Math.random(), srNo: idx + 1, itemSrNo: String(idx + 1), itemNo: String(idx + 1), invSrNo, invNo,
                    desc: it.desc || it.description || '', productDescription: it.desc || it.description || '', ritc, hsCode: ritc, cth: ritc, ceth: 'NOEXCISE',
                    qty, quantity: qty, unit, uqc: unit, price, unitPrice: price, value, swsRate: '10' };
              });
              const total = num(aiData.invoiceValue || aiData.totalValue) || String(+newItems.reduce((s, it) => s + (parseFloat(it.value) || 0), 0).toFixed(2));
              const newInvoice = { id: Date.now(), invNo, invoiceNo: invNo, invDate: aiData.invoiceDate || aiData.invoice_date || '', currency: String(aiData.currency || '').toUpperCase(),
                  value: total, supplierName: aiData.supplierName || aiData.shipper || '', items: newItems };
              setJobData(prev => ({ ...prev, invoices: [...(prev.invoices || []), newInvoice] }));
              if (newItems.length) setGlobalItems(prev => [...(prev || []), ...newItems]);
              toast.success(`AI read invoice ${invNo || '(no number)'}: ${newItems.length} item(s) added as invoice ${invSrNo}. Check them in 3. Invoices / 4. Items.`, { duration: 6000 });
          } else {
              toast.error('AI Extraction Failed: ' + json.error, { duration: 5000 });
          }
      } catch (err) {
          toast.error('Error calling AI API: ' + err.message, { duration: 5000 });
      } finally {
          setIsAiLoading(false);
          e.target.value = null; // reset
      }
  };

  // ICEGATE pre-validation of the exact JSON that will be sent (backend utils/icegateValidate.js). 28-Oct-2026
  const [valResult, setValResult] = useState(null);
  // The job is saved first (the filed BE and the saved job must match, and the ICEGATE Unique ID is written to the saved
  // job - an unsaved job was filed without any record). 28-Oct-2026
  const handleSendToIcegateClick = async () => {
    // 10-Nov-2026: an amended job goes to ICEGATE as an amendment file (CACHI01_A), never as a fresh BE
    if (jobData?._amendmentId) { toast.error('This is an amended job - send it from the BE Amendment window (file / sign / send to ICEGATE)'); setShowBeAmend(true); return; }
    // 16-Nov-2026: a job with a BE No was filed - sending it again would file a second BE
    if (String(jobData?.beNo || '').trim()) { toast.error(`This job already has BE No ${jobData.beNo} - it was filed. For a change use ACTIONS > BE Amendment. If the BE No is wrong, clear it in Job Header > BE Filing Details and save.`, { duration: 9000 }); return; }
    const saved = await handleSaveDraft();
    if (!saved) { toast.error('The job could not be saved, so it was not sent to ICEGATE'); return; }
    try {
      const res = await fetch('/api/icegate/preview-be', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobData: { ...jobData, esanchitDocs: esanchitDocs || [] }, items, invoices: jobData.invoices || [], beType, transportMode }),
      });
      const data = await res.json();
      const v = data && data.validation;
      if (!data.success) { toast.error('Validation error: ' + (data.error || 'could not build the BE')); return; }
      if (v && (v.errors.length || v.warnings.length)) {
        setValResult({ ...v, title: 'Bill of Entry - Pre-Validation', onContinue: () => setShowIcegateModal(true) });
        return;
      }
    } catch (e) {
      toast.error('Could not validate: ' + e.message);
      return;
    }
    setShowIcegateModal(true);
  };
  latestSend.current = handleSendToIcegateClick;

  // "Validate Job" (4. Items): the same pre-validation as Send to ICEGATE, without saving or sending. 30-Oct-2026
  const handleValidateOnly = async () => {
    if (await unsavedEdits('validate')) return;
    const t = toast.loading('Validating the Bill of Entry...');
    try {
      const res = await fetch('/api/icegate/preview-be', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobData: { ...jobData, esanchitDocs: esanchitDocs || [] }, items, invoices: jobData.invoices || [], beType, transportMode, forFiling: true }),
      });
      const data = await res.json();
      toast.dismiss(t);
      if (!data.success) { toast.error('Could not build the BE: ' + (data.error || 'unknown error')); return; }
      const v = data.validation || { errors: [], warnings: [] };
      if (!v.errors.length && !v.warnings.length) { toast.success('No errors - this job is ready to file'); return; }
      setValResult({ ...v, title: 'Bill of Entry - Validation' });
    } catch (e) { toast.dismiss(t); toast.error('Could not validate: ' + e.message); }
  };

  // "Download signed file (not sent)" in the Submit window: the BE signed with the token exactly as Confirm Submit signs
  // it, downloaded for a check on ICEGATE's signer site - nothing goes to ICEGATE. 17-Nov-2026
  const handleSignOnly = async (profileId, tokenPin) => {
    if (await unsavedEdits('make the signed file')) return;
    try {
      const res = await fetch('/api/icegate/sign-be-file', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobData: { ...jobData, esanchitDocs: esanchitDocs || [] }, items, invoices: jobData.invoices || [], beType, transportMode, profileId, pin: tokenPin })
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

  // Actual submit logic called by the modal
  const handleActualSubmit = async (profileId, tokenPin, isAmendment, amendmentType, amendReason) => {
    if (await unsavedEdits('file the BE')) return;
    setIcegateState({ loading: true, result: null, error: null });
    try {
      const res = await fetch('/api/icegate/submit-be', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobData: { ...jobData, esanchitDocs: esanchitDocs || [] },
          items,
          invoices: jobData.invoices || [],
          beType,
          transportMode,
          indicator: 'P',
          profileId,
          pin: tokenPin,       // backend expects 'pin' not 'tokenPin'
          tokenPin,            // keep both for backward compat
          amendment: isAmendment,
          amendmentType,
          amendReason
        })
      });
      const data = await res.json();
      if (data.success) {
        setIcegateState({ loading: false, result: data, error: null });
        setShowIcegateModal(false);
        setJobData(prev => ({ ...prev, icegateStatus: isAmendment ? 'Amended' : 'Filed', icegateUniqueId: data.uniqueId, isAmended: !!isAmendment, filedAt: new Date().toISOString(), hasFiledJson: true, amendUnlockedAt: null, amendUnlockedBy: null }));
        setAmendMode(false); setAmendReason('');
        toast.success('Sent to ICEGATE - Unique ID ' + (data.uniqueId || ''), { duration: 6000 });
      } else {
        setIcegateState({ loading: false, result: null, error: data.error || data.details?.errorMessage || 'Filing failed' });
        if (data.validation) { setShowIcegateModal(false); setValResult({ ...data.validation, title: 'Bill of Entry - Not sent' }); }
        // Don't close modal on error, so user can see it or try another profile
      }
    } catch (e) {
      setIcegateState({ loading: false, result: null, error: 'Network error: ' + e.message });
    }
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* GLOBAL AI LOADING OVERLAY */}
      {isAiLoading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#ffffff', padding: '24px 32px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', borderTop: '4px solid #8b5cf6', width: '340px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: '#f3e8ff', marginBottom: '16px' }}>
              <Loader size={24} color="#8b5cf6" className="animate-spin" />
            </div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>Extracting AI Data...</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', textAlign: 'center', lineHeight: '1.4' }}>Reading your PDF documents.<br/>Please wait 15-45 seconds.</p>
          </div>
        </div>
      )}

      
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', padding: '0.15rem 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
           <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0, color: 'var(--text-main, var(--text-main, #0f172a))', fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.2px' }}>
             <FileText size={14} color="var(--primary-text, #0284c7)" /> IMPORT BILL OF ENTRY (CACHI01)
           </h3>
           <button onClick={handleCreateNewJob} style={{ padding: '2px 8px', fontSize: '10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ CREATE NEW JOB (RESET)</button>
          </div>
          <div className="job-strip" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 500, letterSpacing: '0.3px', marginTop: '2px' }}>
            <span>JOB: <strong style={{ color: 'var(--text-main, var(--text-main, #0f172a))' }}>{jobData?.jobNo || ''}</strong></span>
            {/* 18-Nov-2026: the job no ICEGATE knows (its mails / replies name it) - the number of the first filing, else the
                running number of the job no (DEL-AI-1002 -> 1002); not shown when it is the job no itself (iCAFFE jobs) */}
            {(() => { const jn = String(jobData?.jobNo || ''); const g = jn.match(/\d+/g) || []; const run = /^\d+$/.test(jn) ? parseInt(jn, 10) : parseInt([...g].reverse().find(x => x.length >= 3) || g[g.length - 1] || '0', 10);
              const icg = parseInt(jobData?.icegateJobNo, 10) || run; if (!icg || String(icg) === jn) return null;
              return <span title="Job no. in ICEGATE mails and replies; search the job list by it too">ICEGATE JOB NO: <strong style={{ color: 'var(--text-main, var(--text-main, #0f172a))' }}>{icg}</strong></span>; })()}
            <DocketFromJob side="Import" job={jobData} />
            <span style={{ color: 'var(--border-color, var(--border-color, #cbd5e1))' }}>|</span>
            <span>TYPE: <strong style={{ color: 'var(--text-main, var(--text-main, #0f172a))' }}>{beType?.toUpperCase() === 'W' ? 'WAREHOUSE (W)' : beType?.toUpperCase() === 'X' ? 'EX-BOND (X)' : 'HOME CONSUMPTION (H)'}</strong></span>
            <span style={{ color: 'var(--border-color, var(--border-color, #cbd5e1))' }}>|</span>
            <span>MODE: <strong style={{ color: 'var(--primary-text, #0369a1)' }}>{transportMode === 'A' ? 'AIR' : transportMode === 'L' ? 'LAND' : 'SEA'}</strong></span>
            <span style={{ color: 'var(--border-color, var(--border-color, #cbd5e1))' }}>|</span>
            <span>STATUS: <span style={{ color: /rejected/i.test(jobData?.icegateStatus || '') ? '#b91c1c' : (icegateState.result || jobData?.icegateStatus) ? '#16a34a' : 'var(--primary-text, #0284c7)', fontWeight: 600 }}>
              {icegateState.result ? `${icegateState.result.message?.includes('mend') ? 'AMENDED' : 'FILED'} (${icegateState.result.uniqueId})` : (jobData?.icegateStatus ? `${jobData.icegateStatus.toUpperCase()} (${jobData.icegateUniqueId || ''})` : 'DRAFT')}
              </span></span>
            {isFiled && (isFiledLocked
              ? <span style={{ marginLeft: '6px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '1px 8px', fontSize: '10px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '4px', color: '#92400e', fontWeight: 700 }}>
                  🔒 LOCKED{jobData?.filedAt ? ` - sent ${new Date(jobData.filedAt).toLocaleString('en-GB')}` : ''}
                  <button type="button" onClick={unlockForAmendment} style={{ padding: '0 6px', fontSize: '10px', background: '#fff', border: '1px solid #f59e0b', borderRadius: '3px', cursor: 'pointer', color: '#92400e', fontWeight: 600 }}>Unlock for amendment</button>
                </span>
              : <span style={{ marginLeft: '6px', padding: '1px 8px', fontSize: '10px', background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '4px', color: '#991b1b', fontWeight: 700 }} title={jobData?.amendUnlockedBy ? `Unlocked by ${jobData.amendUnlockedBy}` : ''}>🔓 AMENDMENT MODE - the filed copy is kept; file the amendment when done</span>)}
            {jobData?._amendmentId && (
              <span style={{ marginLeft: '6px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '1px 8px', fontSize: '10px', background: '#ede9fe', border: '1px solid #a78bfa', borderRadius: '4px', color: '#5b21b6', fontWeight: 700 }}>
                AMENDMENT {jobData._amendNo} of BE job {jobData._amendOfJobNo} - changes here do not touch the filed job
                <button type="button" onClick={() => setShowBeAmend(true)} style={{ padding: '0 6px', fontSize: '10px', background: '#fff', border: '1px solid #a78bfa', borderRadius: '3px', cursor: 'pointer', color: '#5b21b6', fontWeight: 600 }}>Changes & file</button>
                {jobData._amendOfJobId && <button type="button" onClick={() => loadJobForEditing(jobData._amendOfJobId)} style={{ padding: '0 6px', fontSize: '10px', background: '#fff', border: '1px solid #a78bfa', borderRadius: '3px', cursor: 'pointer', color: '#5b21b6', fontWeight: 600 }}>Back to BE job</button>}
              </span>
            )}
            {/* 17-Nov-2026: shown on every saved job - a job sent before the "accepted shown as failed" fix has no Unique ID
                on it, and the Unique ID from the ICEGATE mail is typed in this window */}
            {(jobData?.id || jobData?.icegateUniqueId || (icegateState.result && icegateState.result.uniqueId)) && (
              <button type="button" onClick={() => setShowAck(true)} title="Ask ICEGATE what ICES answered: BE No / Date or the error list" style={{ marginLeft: '6px', padding: '1px 8px', fontSize: '10px', background: /accepted/i.test(jobData?.icegateStatus || '') ? '#dcfce7' : /rejected/i.test(jobData?.icegateStatus || '') ? '#fee2e2' : '#e0f2fe', color: /rejected/i.test(jobData?.icegateStatus || '') ? '#991b1b' : '#075985', border: '1px solid ' + (/rejected/i.test(jobData?.icegateStatus || '') ? '#fca5a5' : '#bae6fd'), borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}>
                {jobData?.beNo && /accepted/i.test(jobData?.icegateStatus || '') ? `BE ${jobData.beNo}` : /rejected/i.test(jobData?.icegateStatus || '') ? 'REJECTED - WHY?' : 'ICEGATE REPLY'}
              </button>
            )}
          </div>
        </div>
        
          {/* WH Job linked badge - shows when Ex-Bond */}
          {linkedWhJob && (
            <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'3px 10px', background:'#ede9fe', border: '1px solid #cbd5e1', borderRadius:'20px', cursor:'pointer' }} onClick={() => setShowWhSelector(true)}>
              <Warehouse size={11} color="#7c3aed" />
              <span style={{ fontSize:'10px', fontWeight:700, color:'#6d28d9' }}>WH Linked: Job {linkedWhJob.jobNo}</span>
              <span style={{ fontSize:'10px', color:'#7c3aed' }}>· {linkedWhJob.warehouseCode}</span>
            </div>
          )}
          {beType?.toUpperCase() === 'X' && !linkedWhJob && (
            <button
              onClick={() => setShowWhSelector(true)}
              style={{ padding:'2px 10px', fontSize:'10px', background:'#faf5ff', border: '1px solid #cbd5e1', color:'#7c3aed', borderRadius:'20px', cursor:'pointer', fontWeight:700, display:'flex', alignItems:'center', gap:'4px', animation:'pulse 1.5s infinite' }}
            >
              <Warehouse size={11} /> Select WH BE
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsHelpOpen(true)}
              style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
              title="Help & Logic"
            >
              <HelpCircle size={16} />
            </button>
            {/* AI PDF file picker lives outside the menu: inside it, the menu closed while the file dialog was open and the
                picker was removed, so the chosen PDF was never read. 28-Oct-2026 */}
            <input type="file" accept=".pdf,application/pdf" ref={fileInputRefAI} style={{ display: 'none' }} onChange={handleAiUpload} />
            <div 
              style={{ position: 'relative' }} 
              onMouseEnter={() => setShowActionMenu(true)} 
              onMouseLeave={() => setShowActionMenu(false)}
            >
              <button
                type="button"
                onClick={() => setShowActionMenu(v => !v)}
                style={{ padding: '6px 16px', fontSize: '12px', background: 'var(--primary-color-start, #0ea5e9)', border: 'none', color: '#fff', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
              >
                Actions &#9660;</button>

              {showActionMenu && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', minWidth: '220px', zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => { setShowActionMenu(false); setImportTab(null); setShowImport(true); }}
                    style={{ padding: '10px 14px', fontSize: '12px', background: '#fff', border: 'none', borderBottom: '1px solid #f1f5f9', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, textAlign: 'left', width: '100%' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                  >
                    <FolderOpen size={14} /> Import from File
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowActionMenu(false); setIdPick({ what: 'preview' }); }}
                    disabled={loadingPreview}
                    style={{ padding: '10px 14px', fontSize: '12px', background: '#fff', border: 'none', borderBottom: '1px solid #f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500, textAlign: 'left', width: '100%' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                  >
                    {loadingPreview ? <Loader size={14} className="animate-spin" /> : <Eye size={14} color="#64748b" />} Preview JSON
                  </button>
                  {/* 14-Nov-2026: not on an amended job - its file is made in the amendment window */}
                  {!jobData?._amendmentId && <>
                  <button 
                    type="button"
                    onClick={() => { setShowActionMenu(false); if (jobData?._amendmentId) { handleDownloadLegacy(); return; } setIdPick({ what: 'json' }); }} 
                    style={{ padding: '10px 14px', fontSize: '12px', background: '#fff', border: 'none', borderBottom: '1px solid #f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500, textAlign: 'left', width: '100%' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                  >
                    <Download size={14} color="#64748b" /> Download BE File (CACHI01 JSON)
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setShowActionMenu(false); if (jobData?._amendmentId) { handleDownloadFlatBe(); return; } setIdPick({ what: 'flat' }); }} 
                    style={{ padding: '10px 14px', fontSize: '12px', background: '#fff', border: 'none', borderBottom: '1px solid #f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                  >
                    <Download size={14} color="#64748b" /> Download BE Flat File (.be)
                  </button>
                  </>}
                  <button 
                    type="button"
                    title="Amendment of a filed BE as an ICEGATE flat file (e.g. prior BE made final with the IGM details)"
                    onClick={() => { setShowActionMenu(false); setShowBeAmend(true); }} 
                    style={{ padding: '10px 14px', fontSize: '12px', background: '#fff', border: 'none', borderBottom: '1px solid #f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                  >
                    <FileText size={14} color="#64748b" /> {jobData?._amendmentId ? 'This Amendment (file / sign / send)' : 'BE Amendment'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setShowActionMenu(false); handleSaveDraft(); }} 
                    style={{ padding: '10px 14px', fontSize: '12px', background: '#fff', border: 'none', borderBottom: '1px solid #f1f5f9', color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500, textAlign: 'left', width: '100%' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f0f9ff'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                  >
                    <Save size={14} /> Save Draft
                  </button>
                  
                  <button 
                    type="button"
                    title="Reads a supplier invoice PDF with AI and adds it as a new invoice with its items"
                    onClick={() => { setShowActionMenu(false); if (fileInputRefAI.current) fileInputRefAI.current.click(); }} 
                    disabled={isAiLoading}
                    style={{ padding: '10px 14px', fontSize: '12px', background: 'linear-gradient(135deg, #8b5cf6, #d946ef)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', cursor: isAiLoading ? 'not-allowed' : 'pointer', fontWeight: 600, textAlign: 'left', width: '100%', borderRadius: '4px' }}
                  >
                    {isAiLoading ? <Loader size={14} className="animate-spin" /> : <UploadCloud size={14} />} 
                    {isAiLoading ? 'Extracting AI...' : 'AI PDF Extract'}
                  </button>
                  <button
                    type="button"
                    title="Saves the job, checks it and sends the signed BE JSON to ICEGATE"
                    onClick={() => { setShowActionMenu(false); handleSendToIcegateClick(); }}
                    disabled={icegateState.loading}
                    style={{ padding: '10px 14px', fontSize: '12px', background: icegateState.loading ? '#94a3b8' : '#16a34a', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', cursor: icegateState.loading ? 'not-allowed' : 'pointer', fontWeight: 600, textAlign: 'left', width: '100%' }}
                    onMouseEnter={(e) => { if(!icegateState.loading) e.currentTarget.style.background = '#15803d'; }}
                    onMouseLeave={(e) => { if(!icegateState.loading) e.currentTarget.style.background = '#16a34a'; }}
                  >
                    {icegateState.loading ? <><Loader size={14} className="animate-spin" /> Submitting...</> : <><UploadCloud size={14} /> Send to ICEGATE</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* ICEGATE Result Banner */}
      {icegateState.result && (
        <div style={{ background: '#f0fdf4', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 12px', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
            <CheckCircle size={14} color="#16a34a" />
            <span style={{ color: '#166534', fontWeight: 600 }}>BE Filed Successfully to ICEGATE!</span>
            <span style={{ color: '#166534' }}>Unique ID: <strong>{icegateState.result.uniqueId}</strong></span>
            <span style={{ color: '#4ade80' }}>|</span>
            <span style={{ color: '#166534' }}>{icegateState.result.message}</span>
          </div>
          <button onClick={() => setIcegateState({ loading: false, result: null, error: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534' }}>
            <X size={14} />
          </button>
        </div>
      )}
      {/* ICEGATE Error Banner */}
      {icegateState.error && (
        <div style={{ background: '#fef2f2', border: '1px solid #ef4444', borderRadius: '6px', padding: '8px 12px', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
            <X size={14} color="#dc2626" />
            <span style={{ color: '#991b1b', fontWeight: 600 }}>ICEGATE Submission Failed:</span>
            <span style={{ color: '#991b1b' }}>{icegateState.error}</span>
          </div>
          <button onClick={() => setIcegateState({ loading: false, result: null, error: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>
            <X size={14} />
          </button>
        </div>
      )}
      {/* Tabs Layout */}
      {/* 21-Nov-2026: "entry-lg" / "entry-lg-body" = the plainer entry-form look (index.css), colours from the theme */}
      <div className="glass-panel entry-lg" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', overflowY: 'auto' }}>
        
        {/* Tab Headers */}
        <div style={{ padding: '0.75rem 0.5rem 0 0.5rem', background: 'var(--bg-input, var(--bg-input, #f1f5f9))' }}>
          <div className="tab-container">
            {tabAllowed('dashboard') && <div className={`custom-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
              0. Dashboard
            </div>}
            {tabAllowed('query') && <div className={`custom-tab ${activeTab === 'query' ? 'active' : ''}`} onClick={() => setActiveTab('query')}>
              1. Job Query
            </div>}
            {tabAllowed('header') && <div className={`custom-tab ${activeTab === 'header' ? 'active' : ''}`} onClick={() => setActiveTab('header')}>
              2. Job Header
            </div>}
            {tabAllowed('invoices') && <div className={`custom-tab ${activeTab === 'invoices' ? 'active' : ''}`} onClick={() => setActiveTab('invoices')}>
              3. Invoices
            </div>}
            {tabAllowed('items') && <div className={`custom-tab ${activeTab === 'items' ? 'active' : ''}`} onClick={() => setActiveTab('items')}>
              4. Items
            </div>}
            {/* 29-Oct-2026: tab "5. Supporting Docs" removed - BE / invoice / item e-Sanchit docs are all entered from the item's
                Supporting Docs popup (Doc. for: this item / its invoice / BE); the job-level rows (esanchitDocs) stay as they were */}
            {tabAllowed('reports') && <div className={`custom-tab ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
              5. Reports & Submission
            </div>}
            
            <div 
              className="custom-tab" 
              onClick={() => { setTimelineTargetJobId(null); setIsTimelineOpen(true); }} 
              style={{ background: '#f8fafc', color: '#475569', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
            >
              <MessageSquare size={14} /> Timeline Log
            </div>
          </div>
        </div>

        {/* Tab Content Area */}
        <div key={'tabs-' + resetNonce} className="entry-lg-body" style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
          {activeTab === 'dashboard' && <ImportDashboardTab onGoToQuery={() => setActiveTab('query')} onOpenJob={(id) => { loadJobForEditing(id); setActiveTab('header'); }} />}
          {activeTab === 'query' && <QueryTab refreshKey={refreshKey} onAction={async (action, row) => { 
 if (action === 'new') { 
      resetToNewJob(); 
  } 
  else if (action === 'import-file') {
      // "Read Flat File" / "Read XML" buttons of the job list
      setImportTab(row || 'file');
      setShowImport(true);
  } 
  else if (typeof action === 'string' && action.startsWith('open:') && row) {
      // job list icons: open the job on a given tab (reports / items / header)
      await loadJobForEditing(row.id);
      // 30-Oct-2026: tab "5. Supporting Docs" was removed on 29-Oct and the list's e-Sanchit icon still asked for it,
      // so it opened a blank screen. The documents are now in the Items tab (Supporting Docs window).
      const tab = action.slice(5);
      if (tab === 'esanchit') {
        setActiveTab('items');
        toast('e-Sanchit documents are in 4. Items > Supporting Docs (Doc. for: BE / invoice / item)', { duration: 6000, icon: '📎' });
      } else setActiveTab(tab);
  } 
  else if (action === 'edit' && row) { 
        loadJobForEditing(row.id);
        setActiveTab('header');
    }
  else if (action === 'duplicate' && row) { 
      await loadJobForEditing(row.id);
      // Remove IDs and filing results to make it a new job (the backend gives invoices/items new ids)
      setJobData(prev => dupClean({ ...prev, id: undefined, jobNo: 'DRAFT', beNo: null, beDate: null, assessmentDate: null, dutyPaidDate: null, challanNo: null, oocDate: null, icegateStatus: null, icegateUniqueId: null, icegateAck: null, icegateAckAt: null, isAmended: null, filedAt: null, filedFileName: null, filedSigner: null, hasFiledJson: false, amendUnlockedAt: null, amendUnlockedBy: null, status: 'DRAFT'  }));
      setAmendMode(false); setAmendReason('');
      toast.success('Copy of job ' + (row.jobNo || '') + ' opened - click Save to create it');
      setActiveTab('header');
  }
  else if (action === 'timeline' && row) {
      setTimelineTargetJobId(row.id);
      setIsTimelineOpen(true);
  }
  // 30-Oct-2026: the job list's "Amend" icon opened the Job Header; it now opens the job and its BE amendment window
  else if (action === 'amend' && row) {
      await loadJobForEditing(row.id);
      setActiveTab('header');
      setShowBeAmend(true);
  }
  // 18-Nov-2026: right-click menu of the job list - BE file / .be / Preview / Amendment of a saved job without opening
  // it. The job is read and put in the same shape as the screen (mapLoadedImportJob), so the file is the same.
  else if ((action === 'list-preview' || action === 'list-json' || action === 'list-flat' || action === 'list-amend') && row) {
      try {
          const r = await fetch(`/api/import-jobs/${row.id}`).then(x => x.json());
          if (!r || !r.success || !r.data) { toast.error('Could not read job ' + (row.jobNo || '') + (r && r.error ? ': ' + r.error : '')); return; }
          const src = mapLoadedImportJob(r.data);
          if (action === 'list-amend') { setListAmendJob(src.jobData); return; }
          if (src.jobData._amendmentId) { toast('Job ' + (src.jobData.jobNo || '') + ' is an amended job - its file for ICEGATE is the amendment file. Make / download it here.', { icon: '📝', duration: 6000 }); setListAmendJob(src.jobData); return; }
          setIdPick({ what: action === 'list-flat' ? 'flat' : action === 'list-preview' ? 'preview' : 'json', src });
      } catch (e) { toast.error('Could not read job ' + (row.jobNo || '') + ': ' + e.message); }
  }
  // actions that need the job on the screen: the job opens and the action starts by itself
  else if ((action === 'open-send' || action === 'open-ai') && row) {
      await loadJobForEditing(row.id);
      if (action === 'open-ai') {
          setTimeout(() => { if (fileInputRefAI.current) fileInputRefAI.current.click(); }, 50);
          toast('Job ' + (row.jobNo || '') + ' opened - choose the supplier invoice PDF (if no window opened: Actions > AI PDF Extract)', { icon: '🤖', duration: 7000 });
      } else setPendingRun({ id: row.id, what: 'send' });
  }
  else if (action === 'delete' && row) {
      if (await askConfirm({ title: 'Delete this job?', message: `Job No ${row.jobNo} is deleted with its invoices and items.`, okLabel: 'Delete job', cancelLabel: 'Keep the job', tone: 'danger' })) {
          try {
              const res = await fetch(`/api/import-jobs/${row.id}`, { method: 'DELETE' });
              const json = await res.json();
              if(json.success) {
                  toast.success('Job deleted successfully!');
                  setRefreshKey(prev => prev + 1);
              } else {
                  toast.error('Error deleting job: ' + json.error);
              }
          } catch(e) {
              console.error(e);
          }
      }
  }
}} />}
          {activeTab === 'header' && <JobHeaderTab transportMode={transportMode} setTransportMode={setTransportMode} beType={beType} setBeType={setBeType} onSave={handleSaveDraft} />}
          {activeTab === 'invoices' && <InvoiceGridTab onSave={autoSave} />}
          {activeTab === 'items' && <ItemGridTab transportMode={transportMode} onSave={autoSave} onValidate={handleValidateOnly} />}
          {activeTab === 'reports' && <ReportTab />}
        </div>
        
      </div>

      {/* Import File Modal */}
      {showImport && (
        <ImportFileModal type="be" initialTab={importTab} onImport={handleImport} onClose={() => { setShowImport(false); setImportTab(null); }} />
      )}

      {/* WH BE Selector Modal — auto-opens when BE Type = X (Ex-Bond) */}
      {showWhSelector && (
        <WhBeSelectorModal
          importerName={jobData?.autoField_4 || jobData?.nameOfImporter}
          iecCode={jobData?.autoField_5 || jobData?.iecCode}
          customsPort={jobData?.portCode || jobData?.autoField_2}
          excludeJobId={jobData?.id}
          onSelect={handleWhBeSelected}
          onManual={() => { setActiveTab('header'); toast('Enter the WH BE No, WH BE Date and Warehouse Code in Job Header (Ex-Bond box)', { duration: 6000 }); }}
          onClose={() => setShowWhSelector(false)}
        />
      )}

      <ValidationResultModal result={valResult} onClose={() => setValResult(null)} />

      <IcegateIdPickModal open={!!idPick} chaCode={(idPick && idPick.src ? idPick.src.jobData : jobData)?.autoField_3}
        title={(idPick && idPick.what === 'flat' ? 'BE flat file (.be) - ICEGATE ID' : idPick && idPick.what === 'preview' ? 'Preview JSON - ICEGATE ID' : 'BE file (JSON) - ICEGATE ID') + (idPick && idPick.src ? ' - job ' + (idPick.src.jobData.jobNo || '') : '')}
        actionLabel={idPick && idPick.what === 'preview' ? 'Show JSON' : 'Download'}
        onClose={() => setIdPick(null)}
        onPick={(pid, login) => { const w = idPick && idPick.what; const src = (idPick && idPick.src) || undefined; setIdPick(null); if (w === 'flat') handleDownloadFlatBe(pid, login, src); else if (w === 'preview') handlePreviewJson(pid, src); else handleDownloadLegacy(pid, login, src); }} />

      <BeAmendModal open={showBeAmend} onClose={() => setShowBeAmend(false)} jobData={jobData} onOpenJob={async (id) => { await loadJobForEditing(id); setActiveTab('header'); }} />
      {/* 18-Nov-2026: BE Amendment from the job list's right-click menu (the job is not opened) */}
      <BeAmendModal open={!!listAmendJob} onClose={() => setListAmendJob(null)} jobData={listAmendJob} onOpenJob={async (id) => { setListAmendJob(null); await loadJobForEditing(id); setActiveTab('header'); }} />
      <IcegateAckModal open={showAck} onClose={() => setShowAck(false)} jobId={jobData?.id} uniqueId={jobData?.icegateUniqueId || (icegateState.result && icegateState.result.uniqueId)}
        onResult={(d) => { setJobData(prev => ({ ...prev, icegateStatus: (d.job && d.job.icegateStatus) || prev.icegateStatus, icegateUniqueId: (d.job && d.job.icegateUniqueId) || prev.icegateUniqueId, beNo: prev.beNo || (d.job && d.job.beNo) || prev.beNo, beDate: prev.beDate || (d.job && d.job.beDate) || prev.beDate })); if (d.state !== 'pending') setIcegateState(s => ({ ...s, result: null })); }} />

      {/* ICEGATE Submit Modal */}
      {showIcegateModal && (
        <IcegateSubmitModal allowAmendment={false} 
          chaCode={jobData?.autoField_3} 
          onSubmit={handleActualSubmit}
          onSignOnly={handleSignOnly}
          onClose={() => setShowIcegateModal(false)}
          loading={icegateState.loading}
        />
      )}

      {/* JSON Preview Modal */}
      {showJsonPreview && previewJson && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--text-main, var(--text-main, #1e293b))', borderRadius: '8px', width: '80vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #334155' }}>
              <span style={{ color: 'var(--border-color, var(--border-color, #cbd5e1))', fontWeight: 600, fontSize: '13px' }}>📄 CACHI01 JSON Preview — {(previewOf || jobData)?._amendmentId ? 'amended job: for checking only (the file for ICEGATE is the amendment file, BE Amendment window)' : 'Ready to Submit'}</span>
              <button onClick={() => setShowJsonPreview(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            {/* 16-Nov-2026: textTransform none - the app's ALL CAPS style showed the keys / values in capitals (the file itself is camelCase), as Export already does */}
            <pre style={{ flex: 1, overflow: 'auto', padding: '16px', margin: 0, color: '#16a34a', fontSize: '11px', lineHeight: '1.5', fontFamily: 'monospace', textTransform: 'none' }}>
              {JSON.stringify(previewJson, null, 2)}
            </pre>
            <div style={{ padding: '10px 16px', borderTop: '1px solid #334155', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              {!(previewOf || jobData)?._amendmentId && <button
                type="button"
                onClick={() => { const blob = new Blob([JSON.stringify(previewJson, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                  a.download = 'BE_' + String((previewOf || jobData)?.jobNo || 'DRAFT').replace(/[^\w-]+/g, '_') + (previewJson.headerField && previewJson.headerField.senderID ? '_' + String(previewJson.headerField.senderID).replace(/[^\w-]+/g, '_') : '') + '_CACHI01.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }}
                style={{ padding: '5px 12px', fontSize: '11px', background: '#334155', border: 'none', color: 'var(--border-color, var(--border-color, #cbd5e1))', borderRadius: '4px', cursor: 'pointer' }}
              >
                Download JSON
              </button>}
              <button
                type="button"
                onClick={() => { try { navigator.clipboard.writeText(JSON.stringify(previewJson, null, 2)); toast.success('JSON copied'); } catch (e) { toast.error('Copy not allowed by the browser'); } }}
                style={{ padding: '5px 12px', fontSize: '11px', background: '#334155', border: 'none', color: 'var(--border-color, var(--border-color, #cbd5e1))', borderRadius: '4px', cursor: 'pointer' }}
              >
                Copy JSON
              </button>
              {/* 18-Nov-2026: a preview made from the job list sends THAT job - it opens first (Send needs it on the screen);
                  before, this button sent whatever job was open on the screen */}
              <button
                onClick={() => { setShowJsonPreview(false); if (previewOf && previewOf.id && String(previewOf.id) !== String(jobData?.id || '')) { const id = previewOf.id; setPreviewOf(null); (async () => { await loadJobForEditing(id); setPendingRun({ id, what: 'send' }); })(); return; } setPreviewOf(null); handleSendToIcegateClick(); }}
                style={{ padding: '5px 14px', fontSize: '11px', background: '#16a34a', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
              >
                {previewOf && String(previewOf.id) !== String(jobData?.id || '') ? '✅ Open job ' + (previewOf.jobNo || '') + ' and send to ICEGATE' : '✅ Send this to ICEGATE'}
              </button>
            </div>
          </div>
        </div>
      )}

      <HelpViewer isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} topic={activeTab} />
      <TimelineDrawer isOpen={isTimelineOpen} onClose={() => setIsTimelineOpen(false)} jobId={timelineTargetJobId || jobData?.id} module="IMPORT" />
    </div>
  );
}

export default function JobEntryLayout() {
  return (
    <JobProvider>
      <InnerLayout />
    </JobProvider>
  );
}
