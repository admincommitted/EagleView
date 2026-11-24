// State and logic
// Split out of ExportReportTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React, { useRef, useState } from 'react';
import { rateText } from '../../../../utils/cbicExchange';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import { shrunkCopy } from '../../../JobEntry/Tabs/ReportTabParts/downloadReportPdf'; // 21-Nov-2026: smaller letters in the PDF, like the import PDF
import { useExportContext } from '../../ExportContext';
import { useGlobalContext } from '../../../../GlobalContext';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { printReport } from '../../../JobEntry/Tabs/ReportTabParts/printReport';
import { num, schemeCodeOf, claimsRodtep, isRodtepItem, isRosctlItem, itemFobInr, rodtepAmount, rosctlRowsOf, rodtepRowOf, rodtepRateOf, rodtepQtyOf, itemUnitPmv, itemTotalPmv } from '../Schemes/schemeUtils';
import { districtsOf } from '../ExportItemTabParts/districtCodes';
import { CHECKLIST_PRINT_CSS } from './checklistPrintCss';
import { invoiceRate, invoiceFobFc, contractOf } from '../../../../utils/exportFob';
import { useMasterList } from '../../useExportCalc';

export default function useExportReportTab(ctx) {
  const { exportData, items, containers, dbkItems, licenseItems } = useExportContext();
  const { activeBranch } = useGlobalContext();
  // CHA name: prefer from exportData (if CHA was selected in header), fallback to activeBranch info
  // CHA name: only show actual CHA data from job — do NOT fall back to branch name
  // (branch name would incorrectly show "DELHI CUSTOMS" when no job is loaded)
  const chaDisplayName = exportData?.chaName || exportData?.chaNo || '';
  const [allSwStatements, setAllSwStatements] = React.useState([]);
  const [allSwInfos, setAllSwInfos] = React.useState([]);
  const [allSuppDocs, setAllSuppDocs] = React.useState([]);

  // 12-Nov-2026: SW statements / SW info / supporting documents of the S/B checklist are the rows of the Shipping Bill
  // that will be filed (CACHE01 built by the server). The checklist read them only from the items, while a job read
  // from a file keeps them with the job (13 RS001 statements, 65 SW info rows and 2 documents of job 8874 printed
  // "not found"). Until the server answers, the rows of the screen are shown.
  const [ckJson, setCkJson] = React.useState(null);
  React.useEffect(() => {
    if (!exportData || !(items || []).length) { setCkJson(null); return undefined; }
    let live = true;
    const t = setTimeout(() => {
      fetch('/api/icegate/preview-sb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exportData: { ...(exportData || {}), dbkItems: dbkItems || [], licenseItems: licenseItems || [] }, items, invoices: exportData?.invoices || [] }) })
        .then(r => r.json()).then(d => { if (live) setCkJson(d && d.success && d.cache01 ? d.cache01 : null); }).catch(() => { if (live) setCkJson(null); });
    }, 600);
    return () => { live = false; clearTimeout(t); };
  }, [exportData, items, dbkItems, licenseItems]);

  React.useEffect(() => {
    const arr = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };
    const ymd = (v) => { const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(String(v || '')); return m ? `${m[3]}-${m[2]}-${m[1]}` : String(v || ''); };
    const lvl = (inv, itm) => (String(itm || '0') !== '0' ? 'ITEM' : (String(inv || '0') !== '0' ? 'INVOICE' : 'SB'));
    const m = ckJson && ckJson.master;
    if (m) {
      setAllSwStatements(arr(m.statement).map(r => ({ invItemNo: `${r.invoiceSerialNumber} / ${r.itemSerialNumber}`, statementFor: lvl(r.invoiceSerialNumber, r.itemSerialNumber), statementType: r.statementType, statementCode: r.statementCode, statementText: r.statementText })));
      setAllSwInfos(arr(m.infoType).map(r => ({ invItemNo: `${r.invoiceSerialNumber} / ${r.itemSerialNumber}`, type: r.infoType, qualifier: r.infoQualifier, code: r.infoCode, text: r.infoText, measurement: r.infoMeasure, unit: r.infouqc })));
      setAllSuppDocs(arr(m.supportingDocs).map(r => ({ invItemNo: `${r.invoiceSerialNumber} / ${r.itemSerialNumber}`, statementFor: lvl(r.invoiceSerialNumber, r.itemSerialNumber), irnNo: r.imageReferenceNumber, docType: r.documentTypeCode, issuedParty: r.documentIssuingPartyName, refNo: r.documentReferenceNo, place: r.placeOfIssue, issueDt: ymd(r.documentIssueDate), expDt: ymd(r.documentExpiryDate), bnfParty: r.documentBeneficiaryPartyName, fileName: r.fileType, ceSanchitId: r.icegateId })));
      return;
    }
    // rows of the screen: the items' own rows and the rows kept with the job (read from a file)
    const stmts = [], infos = [], docs = [];
    const pair = (r, inv, itm) => `${r.invoiceSerialNumber ?? r.invSr ?? inv} / ${r.itemSerialNumber ?? r.itemSr ?? itm}`;
    arr(exportData && exportData._statements).forEach(r => stmts.push({ invItemNo: pair(r, 0, 0), statementFor: lvl(r.invoiceSerialNumber, r.itemSerialNumber), statementType: r.statementType, statementCode: r.statementCode, statementText: r.statementText }));
    arr(exportData && exportData._infoTypes).forEach(r => infos.push({ invItemNo: pair(r, 0, 0), type: r.infoType, qualifier: r.infoQualifier, code: r.infoCode, text: r.infoText, measurement: r.infoMeasure, unit: r.infouqc }));
    (items || []).forEach((item, idx) => {
      const itm = item.itemSr || (idx + 1), inv = item.invSr || 1, prefix = `${inv} / ${itm}`;
      arr(item.swStatements).forEach(s => stmts.push({ ...s, invItemNo: prefix, statementFor: s.statementFor || 'ITEM', statementType: s.statementType || s.stmtType || s.type, statementCode: s.statementCode || s.stmtCode || s.code }));
      arr(item.swInfos).forEach(r => infos.push({ invItemNo: prefix, type: r.swInfoField1 || r.type, qualifier: r.swInfoField2 || r.qual || r.qualifier, code: r.swInfoField3 || r.code, text: r.swInfoField4 || r.text, measurement: r.swInfoField5 || r.msr || r.measurement, unit: r.swInfoField6 || r.uqc || r.unit }));
      arr(item.supportDocs || item.eSanchitList).forEach(d => docs.push({ invItemNo: prefix, statementFor: String(d.docFor || 'ITEM').toUpperCase(), irnNo: d.irn, docType: d.docCode, issuedParty: d.issuerName || d.issuingParty, refNo: d.refNo || d.drn, place: d.placeOfIssue, issueDt: ymd(d.issueDate), expDt: ymd(d.expiryDate), bnfParty: d.beneficiaryName || d.beneficiaryParty, fileName: d.fileName || d.fileType }));
    });
    arr(exportData && exportData.eSanchitList).forEach(d => { const g = d && d._icegate; docs.push(g ? { invItemNo: `${g.invoiceSerialNumber} / ${g.itemSerialNumber}`, statementFor: lvl(g.invoiceSerialNumber, g.itemSerialNumber), irnNo: g.imageReferenceNumber, docType: g.documentTypeCode, issuedParty: g.documentIssuingPartyName, refNo: g.documentReferenceNo, place: g.placeOfIssue, issueDt: ymd(g.documentIssueDate), expDt: ymd(g.documentExpiryDate), bnfParty: g.documentBeneficiaryPartyName, fileName: g.fileType, ceSanchitId: g.icegateId } : { invItemNo: '0 / 0', statementFor: 'SB', irnNo: d.irn, docType: d.docCode, issuedParty: d.issuerName || d.issuingParty, refNo: d.refNo || d.drn, place: d.placeOfIssue, issueDt: ymd(d.issueDate), expDt: ymd(d.expiryDate), bnfParty: d.beneficiaryName || d.beneficiaryParty, fileName: d.fileType }); });
    setAllSwStatements(stmts); setAllSwInfos(infos); setAllSuppDocs(docs);
  }, [ckJson, items, exportData]);

  // ---- Get Report (29-Oct-2026): same report panel as Import > Report ----
  const [reportType, setReportType] = useState('checklist');
  const [landscape, setLandscape] = useState(false);
  const [watermark, setWatermark] = useState(!(exportData && (exportData.sbNo || exportData.sbNumber)));
  const [refreshKey, setRefreshKey] = useState(0);
  const onRefresh = () => setRefreshKey(k => k + 1);
  const [rodteps, setRodteps] = useState([]);
  React.useEffect(() => { fetch('/api/masters/rodteps').then(r => r.json()).then(d => setRodteps(Array.isArray(d) ? d : (d && Array.isArray(d.data) ? d.data : []))).catch(() => setRodteps([])); }, []);
  const REPORT_FILE = { checklist: 'SB_Checklist', invoicewise: 'Invoice_Wise_Checklist', rodtep: 'RoDTEP_Checklist', dbk: 'Drawback_Particulars', licence: 'Licence_Particulars', ar4: 'AR4_Particulars', reexport: 'ReExport_Particulars', invparticulars: 'Invoice_Particulars', annexure: 'SB_Annexure_Items', contannex: 'Container_Annexure', shipment: 'Shipment_Containers', swinfo: 'SW_Info_Statements', docs: 'Supporting_Documents' };
  const jobTag = String(exportData?.jobNo || 'DRAFT').replace(/[^\w.-]+/g, '_');
  const onPrint = () => {
    const el = document.getElementById('report-print-area');
    if (!el || !el.innerHTML.trim()) { toast.error('Nothing to print yet'); return; }
    // 12-Nov-2026: the checklist prints with its own CSS (the app's table rules are not in the print frame, so the
    // tables came out at 16px next to 10px text) and "Page x of y / Printed On" on every page, as iCAFFE prints it
    const ck1 = reportType === 'checklist';
    printReport(el, { title: `${REPORT_FILE[reportType] || 'Report'}_${jobTag}`, landscape: !ck1 && landscape, watermark: watermark ? 'DRAFT' : '',
      css: ck1 ? CHECKLIST_PRINT_CSS : '', pageHeader: ck1 ? { left: 'Printed On : ' + new Date().toLocaleDateString('en-GB').replace(/\//g, '-'), right: 'Job ' + (exportData?.jobNo || 'DRAFT') } : null });
  };
  const [pendingPrint, setPendingPrint] = useState(null);
  const printReportId = (id) => setPendingPrint({ id, at: Date.now() });
  React.useEffect(() => {
    if (!pendingPrint || reportType !== pendingPrint.id) return undefined;
    const t = setTimeout(() => { setPendingPrint(null); onPrint(); }, 250);
    return () => clearTimeout(t);
  }, [pendingPrint, reportType]);
  // the report shown, as the mail body
  const sendReportMail = async (to, subject) => {
    const el = document.getElementById('report-print-area');
    if (!el || (el.textContent || '').length < 50) { toast.error('Report is not ready yet'); return false; }
    const copy = el.cloneNode(true);
    copy.querySelectorAll('.no-print, style').forEach(x => x.remove());
    const css = reportType === 'checklist' ? `<style>${CHECKLIST_PRINT_CSS}</style>` : '';
    const html = `${css}<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#000">${copy.innerHTML}<p style="color:#64748b;font-size:11px;margin-top:16px">Draft checklist for checking; final values are as filed / assessed by Customs.</p></div>`;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/email/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ to, subject, html }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.success === false) throw new Error(d.error || 'Mail not sent');
      toast.success('Mail sent to ' + to);
      return true;
    } catch (e) { toast.error('Mail failed: ' + e.message + ' (check Settings > Email)'); return false; }
  };
  const toastError = (m) => toast.error(m);
  // Excel of the report shown: every table row in order (the S/B checklist keeps its own detailed Excel)
  const exportReportExcel = () => {
    if (reportType === 'checklist') { handleDownloadExcel(); return; }
    const el = document.getElementById('report-print-area');
    if (!el || (el.textContent || '').length < 30) { toast.error('Report is not ready yet'); return; }
    const title = REPORT_FILE[reportType] || 'Report';
    const aoa = [[title.replace(/_/g, ' ')], [`Job No: ${exportData?.jobNo || 'DRAFT'}`], []];
    const val = (t) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return /^-?[\d,]+\.\d+$/.test(s) ? parseFloat(s.replace(/,/g, '')) : s; };
    let first = true;
    el.querySelectorAll('table').forEach(tbl => {
      if (!first) aoa.push([]); first = false;
      tbl.querySelectorAll('tr').forEach(tr => { const row = []; tr.querySelectorAll('th, td').forEach(td => { row.push(val(td.textContent)); const span = parseInt(td.getAttribute('colspan'), 10) || 1; for (let k = 1; k < span; k++) row.push(''); }); if (row.some(v => v !== '')) aoa.push(row); });
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const widths = []; aoa.forEach(r => r.forEach((v, i) => { widths[i] = Math.min(45, Math.max(widths[i] || 8, String(v).length + 2)); }));
    ws['!cols'] = widths.map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
    XLSX.writeFile(wb, `${title}_${jobTag}.xlsx`);
    toast.success('Excel downloaded');
  };
  // CACHE01 preview: the JSON the software really sends (built by the server); the old preview was a made-up shape
  const [sbJson, setSbJson] = useState(null);
  const loadSbJson = async () => {
    setSbJson({ loading: true });
    try {
      const res = await fetch('/api/icegate/preview-sb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exportData: { ...(exportData || {}), dbkItems: dbkItems || [], licenseItems: licenseItems || [] }, items, invoices: exportData?.invoices || [] }) });
      const d = await res.json();
      if (!d.success) throw new Error(d.error || 'could not build the SB');
      setSbJson({ json: d.cache01, validation: d.validation });
    } catch (e) { setSbJson({ error: e.message }); }
  };
  const [viewMode, setViewMode] = useState('CHECKLIST'); // 'JSON' or 'CHECKLIST'
  const reportRef = useRef(null);

  // 12-Nov-2026: total PMV = per-unit PMV x qty when the item has no total (a job read from a file printed 0.00)
  const calcTotalPmv = (items || []).reduce((sum, item) => sum + itemTotalPmv(item), 0).toFixed(2);
  const calcTotalTaxable = (items || []).reduce((sum, item) => sum + (parseFloat(item.taxableValue) || 0), 0).toFixed(2);
  const calcTotalIgst = (items || []).reduce((sum, item) => sum + (parseFloat(item.igstAmt) || 0), 0).toFixed(2);
  
  const displayTotalPmv = num(calcTotalPmv) > 0 ? calcTotalPmv : (exportData?.totalPmv || calcTotalPmv);
  const displayTotalTaxable = exportData?.totalTaxableValue || calcTotalTaxable;
  const displayTotalIgst = exportData?.totalIgstAmount || calcTotalIgst;

  // ---- 12-Nov-2026: S/B checklist values, read from the fields the screens really use ----
  // The checklist printed fields nothing fills: Nature Cargo showed the User Job No (autoField_13), Exp Type was
  // always MERCHANT (the screen keeps mercManuf F / M), GSTIN / PAN / branch came out blank (shipperGstin,
  // shipperGstinType, autoField_12, shipperBranchSrNo), User Job No repeated the job no, FOB was blank, drawback
  // rows showed 0, RoDTEP rates 0, no RoSCTL. ck holds every value once, for the screen and the Excel.
  const schemeMaster = useMasterList('/api/masters/schemecodes');
  const chaMaster = useMasterList('/api/masters/cha-master');
  const hasRosctl = (items || []).some(isRosctlItem);
  const rosctlMaster = useMasterList('/api/masters/rosctls', hasRosctl);
  // 12-Nov-2026: names next to the codes, as iCAFFE prints them (SW info "06 - HARYANA", "60 - FARIDABAD"; doc type
  // "331000 Commercial invoice which includes a packing list")
  const stateMaster = useMasterList('/api/masters/states');
  const docMaster = useMasterList('/api/masters/esanchits');
  const infoCodeText = (r) => {
    const q = String(r.qualifier || '').toUpperCase(), code = String(r.code || '').trim();
    if (!code) return '';
    if (q === 'STO') { const s = (stateMaster || []).find(x => String(parseInt(x.taxCode, 10)) === String(parseInt(code, 10))); return s ? `${code} - ${s.stateName}` : code; }
    if (q === 'DOO') {
      const sto = (allSwInfos || []).find(x => x.invItemNo === r.invItemNo && String(x.qualifier || '').toUpperCase() === 'STO');
      const dd = sto ? districtsOf(sto.code).find(([c]) => String(c) === code) : null;
      return dd ? `${code} - ${dd[1]}` : code;
    }
    return code;
  };
  const docTypeText = (code) => { const c = String(code || '').trim(); const m = c && (docMaster || []).find(x => String(x.documentCode) === c); return m ? `${c} ${m.description}` : c; };
  const ck = React.useMemo(() => {
    const d = exportData || {};
    const dmy = (v) => { const t = String(v || ''); if (/invalid/i.test(t)) return ''; const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(t); return m ? `${m[3]}-${m[2]}-${m[1]}` : t; };
    const val = (...ks) => { for (const k of ks) { const v = d[k]; if (v !== undefined && v !== null && String(v).trim() !== '') return String(v); } return ''; };
    const f2 = (v) => num(v).toFixed(2);
    const EXP = { F: 'MANUFACTURER', M: 'MERCHANT', C: 'MERCHANT EXPORTER COURIER', D: 'MANUFACTURER EXPORTER COURIER' };
    const NATURE = { P: 'P - PACKAGED', C: 'C - CONTAINERISED', CP: 'CP - CONTAINERISED & PACKAGED', LB: 'LB - LIQUID BULK', DB: 'DB - DRY BULK' };
    // 19 / 60 as ICEGATE has them (the Scheme Code master says 60 = RoDTEP; ICEGATE 60 = Drawback + RoSCTL)
    const OWN = { '19': 'DRAWBACK (DBK)', '60': 'DRAWBACK AND ROSCTL' };
    const schemeDesc = (code) => OWN[code] || ((schemeMaster || []).find(x => String(x.code) === code) || {}).desc || '';
    const invs = d.invoices || [];
    const invOfItem = (it) => invs[(parseInt(it.invSr, 10) || 1) - 1] || {};
    const portTxt = (code, name) => (code ? `${name || ''} ( ${code} )`.trim() : (name || ''));
    // 12-Nov-2026: Appendix 4RE rate for AA / EOU / SEZ items; RoDTEP qty = SW info DTY / RDT in the schedule unit
    const rateOfRodtep = (it) => rodtepRateOf(rodtepRowOf(rodteps, it), it);
    const infoRows = (ckJson && ckJson.master && Array.isArray(ckJson.master.infoType)) ? ckJson.master.infoType : (Array.isArray(d._infoTypes) ? d._infoTypes : []);
    const itemRows = (items || []).map((it, idx) => {
      const inv = invOfItem(it); const ex = invoiceRate(inv); const fob = itemFobInr(it);
      const code = schemeCodeOf(it);
      const taxable = num(it.taxableValue), igstAmt = num(it.igstAmt || it.igstAmount);
      return { it, idx, invSr: it.invSr || 1, itemSr: it.itemSr || idx + 1, invNo: inv.no || inv.invoiceNo || '', invDate: dmy(inv.date || inv.invoiceDate), qty: it.qty || it.quantity || '', unit: it.unit || it.uqc || '',
        rate: it.rate || it.price || it.unitPrice || '', total: it.totalFc || it.total || '', fobFc: ex && fob ? f2(fob / ex) : '', fobInr: fob ? f2(fob) : '', cur: inv.currency || '',
        // 18-Nov-2026: the item's RoDTEP / Reward switches first (as the SB); a file's rewardItem only when the item has neither
        scheme: code ? `${code}${schemeDesc(code) ? ' - ' + schemeDesc(code) : ''}` : '', reward: String(((it.rodtep || it.reward) ? (/^Y/i.test(String(it.rodtep || '')) || /^Y/i.test(String(it.reward || '')) ? 'Y' : 'N') : '') || it.rewardItem || (isRosctlItem(it) || claimsRodtep(it) ? 'Y' : 'N')).toUpperCase().slice(0, 1) || 'N',
        rodtep: claimsRodtep(it) ? 'Y' : 'N', rosctl: isRosctlItem(it) ? 'Y' : 'N',
        unitPmv: itemUnitPmv(it) ? f2(itemUnitPmv(it)) : '', totalPmv: itemTotalPmv(it) ? f2(itemTotalPmv(it)) : '',
        igstRate: taxable > 0 && igstAmt > 0 ? (Math.round(igstAmt / taxable * 100000) / 1000).toFixed(3) : '',
        hawb: it.hawb || it.hawbNo || '', totalPkg: it.totalPkgs || it.totalPackage || '0', accessory: it.accessory || it.accessoryStatus || '',
        mfgType: it.mfgType || '', mfgCode: it.mfgCode || '', mfgAddr: [it.mfgAddress1, it.mfgAddress2, it.mfgCity, it.mfgState, it.mfgPin].filter(Boolean).join(', '),
        sourceState: it.sourceState || '', transitCountry: it.transitCountry || '' };
    });
    const dbkRows = (dbkItems || []).map(r => ({ ...r, amt: String(r.dbkVal ?? '').trim() === '' ? null : num(r.dbkVal) }));
    const rodtepRows = (items || []).map((it, idx) => ({ it, idx })).filter(({ it }) => isRodtepItem(it) && claimsRodtep(it)).map(({ it, idx }) => {
      const m = rateOfRodtep(it); const fob = itemFobInr(it); const q = rodtepQtyOf(it, infoRows, m && m.uqc);
      return { invSr: it.invSr || 1, itemSr: it.itemSr || idx + 1, fob, qty: q.qty ? String(q.qty) : '', unit: q.unit || '', rate: m ? m.rate : 0, cap: m ? m.cap : 0, rsPerUqc: m ? m.rsPerUqc : 0, appendix: m ? m.appendix : '',
        amt: m ? rodtepAmount({ fob, qty: q.qty, rate: m.rate, cap: m.cap, rsPerUqc: m.rsPerUqc }) : 0, noRate: !m, noQty: !!m && q.from === 'NONE' };
    });
    const rosctlRows = hasRosctl ? rosctlRowsOf(items, dbkItems, rosctlMaster) : [];
    const sum = (list) => list.reduce((a, r) => a + (r.amt === null || r.amt === undefined ? 0 : num(r.amt)), 0);
    const byCur = {}; invs.forEach(inv => { const c = inv.currency || ''; byCur[c] = (byCur[c] || 0) + num(inv.value || inv.invoiceValue); });
    const codes = [...new Set(itemRows.map(r => schemeCodeOf(r.it)).filter(Boolean))];
    return {
      jobDate: dmy(val('jobDate') || (d.etpDetails && d.etpDetails.JobDate) || ''), userJobNo: val('autoField_13'), sbNo: val('sbNo', 'sbNumber'), sbDate: dmy(val('autoField_26', 'sbDate')),
      iec: val('shipperIec', 'ieCode'), branch: val('shipperBranchSrNo', 'branchSrNo') || '0', gstinType: val('shipperGstinType', 'gstnType'), gstinId: val('shipperGstin', 'gstnId'), pan: val('autoField_12', 'panNo'),
      expType: EXP[val('mercManuf').toUpperCase()] || val('exporterType', 'ExpType'), cha: val('chaNo'),
      chaName: val('chaName') || (((chaMaster || []).find(c => String(c.chaCode || '').trim() === val('chaNo').trim()) || {}).chaName || ''),
      loadPort: portTxt(val('customsPortCode', 'loadingPortCode'), val('customsPortName', 'loadingPortName')),
      destCountry: val('destCountryName') || val('destCountryCode'), destPort: portTxt(val('destPortCode'), val('destPortName')),
      discCountry: val('discCountryName', 'destCountryName') || val('discCountryCode', 'destCountryCode'), discPort: portTxt(val('discPortCode', 'destPortCode'), val('discPortName', 'destPortName')),
      consigneeCountry: val('consigneeCountry', 'consigneeCountryCode'),
      gross: val('autoField_18', 'grossWeight') ? `${val('autoField_18', 'grossWeight')} ${val('grWtUnit') || 'KGS'}` : '', net: val('autoField_19') ? `${val('autoField_19')} ${val('grWtUnit') || 'KGS'}` : '',
      pkgs: val('autoField_14', 'totalPackages') ? `${val('autoField_14', 'totalPackages')} ${val('pkgsUnit') || 'PKG'}` : '', loose: val('autoField_17') || '0',
      natureCargo: NATURE[val('natureOfCargo').toUpperCase()] || val('natureOfCargo'),
      mawb: [val('autoField_22', 'mawbNo'), dmy(val('autoField_23', 'mawbDate'))].filter(Boolean).join(' / '), hawb: [val('autoField_24', 'hawbNo'), dmy(val('autoField_25', 'hawbDate'))].filter(Boolean).join(' / '),
      schemes: codes.map(c => `${c}${schemeDesc(c) ? ' - ' + schemeDesc(c) : ''}`),
      invoices: invs.map((inv, k) => ({ inv, k, no: inv.no || inv.invoiceNo || '', date: dmy(inv.date || inv.invoiceDate), valInr: invoiceRate(inv) && num(inv.value || inv.invoiceValue) ? f2(num(inv.value || inv.invoiceValue) * invoiceRate(inv)) : '', fobInr: inv.invFobInr ? f2(inv.invFobInr) : '', fobFc: invoiceFobFc(inv), contract: contractOf(inv), rate: rateText(inv.currency, inv.exchRate || inv.exchangeRate, inv.unitInRs),
        buyer: inv.buyer || inv.buyerName || '', buyerAddr: [inv.buyerAddress1, inv.buyerAddress2, inv.buyerAddress3, inv.buyerAddress4].filter(Boolean),
        charges: [['Freight', inv.freightRate, inv.freightCurr, inv.freightAmount], ['Insurance', inv.insuranceRate, inv.insuranceCurr, inv.insuranceAmount], ['Commission', inv.commissionRate, inv.commissionCurr, inv.commissionAmount],
          ['Discount', inv.discountRate, inv.discountCurr, inv.discountAmount], ['Pack Chargs', inv.packingRate, inv.packingCurr, inv.packingAmount], ['Oth. Deduc', inv.otherRate || inv.otherDeductionsRate, inv.otherCurr || inv.otherDeductionsCurr, inv.otherAmount || inv.otherDeductionsAmount]]
          .map(([l, r, c, a]) => ({ l, r: r || '', c: String(a ?? '').trim() !== '' ? (c || inv.currency || '') : (c || ''), a: a ?? '' })),
        items: itemRows.filter(r => String(r.invSr) === String(k + 1)) })),
      itemRows, dbkRows, dbkTotal: sum(dbkRows), rodtepRows, rodtepTotal: sum(rodtepRows), rosctlRows, rosctlTotal: sum(rosctlRows),
      hasRodtep: rodtepRows.length > 0, hasRosctl, invTotal: Object.entries(byCur).filter(([, v]) => v).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(' + '),
      fobTotal: f2(invs.reduce((a, inv) => a + num(inv.invFobInr), 0)), preparedBy: val('enteredBy', 'createdBy'),
    };
  }, [exportData, items, dbkItems, rodteps, rosctlMaster, schemeMaster, hasRosctl, ckJson, chaMaster]);

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `Shipping_Bill_${exportData?.jobNo || 'Checklist'}`,
  });

  const handleDownloadPDF = () => {
    const shown = reportRef.current;
    if (!shown) return;
    const { copy: element, remove } = shrunkCopy(shown, false);
    const opt = {
      margin:       [15, 5, 15, 5], // [top, left, bottom, right] in mm
      filename:     `Shipping_Bill_${exportData?.jobNo || 'Checklist'}.pdf`,
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { scale: 4, y: 0, scrollY: 0, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { avoid: ['.section-avoid-break', 'tr'] }
    };

    html2pdf().set(opt).from(element).toPdf().get('pdf').then(function (pdf) {
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        // Add "PAGE X OF Y" at the top right of every page
        // A4 is 210mm wide. 210 - margin (5) - text width (~20) = ~185
        pdf.text(`PAGE ${i} OF ${totalPages}`, 180, 10);
        // Add "PRINTED ON:" at the top left of every page
        pdf.text(`PRINTED ON: ${new Date().toLocaleDateString('en-GB')}`, 5, 10);
      }
    }).save().then(remove, remove);
  };

  // Excel of the S/B checklist - the same values as the screen (12-Nov-2026: it repeated the screen's wrong fields)
  const handleDownloadExcel = () => {
    const d = exportData || {};
    const w = [];
    w.push(["INDIAN CUSTOM EDI SYSTEM/EXPORT (ICES/E)"]);
    w.push(["SHIPPING BILL FOR EXPORT"]);
    if (ck.chaName) w.push([ck.chaName]);
    w.push([ck.cha]);
    w.push([`Scheme Desc : ${ck.schemes.join(', ')}`]);
    w.push([]);
    w.push(["JOB NO", d.jobNo || '', "JOB DT", ck.jobDate, "USER JOB NO", ck.userJobNo]);
    w.push(["SB NO", ck.sbNo, "SB DT", ck.sbDate, "", ""]);
    w.push(["PORT OF LOADING", ck.loadPort, "", "", "CHA", ck.cha]);
    w.push(["", "", "", "", "STATE/ORIG", d.stateOriginName || d.stateOriginCode || '']);
    w.push([]);
    w.push(["EXPORTER DETAILS", "", "", "CONSIGNEE DETAILS"]);
    w.push([ck.iec, "", "", d.consigneeName || '']);
    w.push([`Branch Code : ${ck.branch}`, "", "", d.consigneeAddress1 || '']);
    w.push([`GSTIN Type : ${ck.gstinType}`, "", "", d.consigneeAddress2 || '']);
    w.push([`GSTIN Id : ${ck.gstinId}`, "", "", `${d.consigneeAddress3 || ''} ${d.consigneeAddress4 || ''}`.trim()]);
    w.push([`PAN No : ${ck.pan}`, "", "", ck.consigneeCountry]);
    w.push([`Exp Type : ${ck.expType}`, "", "", ""]);
    w.push([d.shipperName || '', "", "", ""]);
    w.push([`${d.shipperAddress1 || ''} ${d.shipperAddress2 || ''}`.trim(), "", "", ""]);
    w.push([`${d.shipperCity || ''} ${d.shipperState || ''} ${d.shipperPin || ''}`.trim(), "", "", ""]);
    w.push([]);
    w.push(["PORT OF LOADING", ck.loadPort]);
    w.push(["COUNTRY OF FINAL DEST.", ck.destCountry, "PORT OF FINAL DESTINATION", ck.destPort]);
    w.push(["DISCHARGE COUNTRY", ck.discCountry, "DISCHARGE PORT", ck.discPort]);
    w.push(["GROSS WT.", ck.gross, "NET WT.", ck.net]);
    w.push(["TOTAL PKGS.", ck.pkgs, "LOOSE PKGS", ck.loose]);
    w.push(["NATURE CARGO.", ck.natureCargo, "NO. OF CTNS.", (d.Containers || []).length || containers?.length || 0]);
    w.push(["MASTER AWB / BL", ck.mawb, "HOUSE AWB / BL", ck.hawb]);
    w.push(["DBK BANK A/C NO", d.drawbackAcNo || '', "FOREX BANK A/C NO.", d.forexCode || '']);
    w.push(["SERVICE TAX REFUND(Y/N)", d.serviceTaxRefund || 'N', "AD CODE", d.adCode || '']);
    w.push(["RBI WAI. NO / RBI WAI. DATE", [d.rbiWaiverNo, d.rbiWaiverDate].filter(Boolean).join(' / '), "IFSC CODE", d.ifscCd || '']);
    w.push(["MARKS & NO.", `${d.autoField_16 || ''}\n${d.thisDisplayOnlyInChecklistNotInCustomFlatFile || ''}`.trim()]);
    w.push(["TOTAL TAXABLE VALUE", displayTotalTaxable, "TOTAL IGST AMT", displayTotalIgst]);
    ck.invoices.forEach(({ inv, k, no, date, fobInr, fobFc, contract, rate, buyer, buyerAddr, charges }) => {
      w.push([]);
      w.push(["INVOICE DETAILS", `INVOICE NO. ${k + 1} of ${ck.invoices.length}`]);
      w.push(["INV. VAL", inv.value || inv.invoiceValue || '', inv.currency || '', ck.invoices[k].valInr ? ck.invoices[k].valInr + ' (INR)' : '']);
      w.push(["FOB VAL (INR)", fobInr, "FOB FC", fobFc ? `${fobFc} (${inv.currency || ''})` : '']);
      w.push(["INVOICE NO.", no, "INVOICE DATE", date]);
      w.push(["INV CURR", inv.currency || '', "NATURE OF CONTRACT", contract]);
      w.push(["EXCHANGE RATE", rate, "CONTRACT NO.", inv.contractNo || '']);
      w.push(["", "RATE", "CUR", "AMOUNT"]);
      charges.forEach(c => { const hide = c.l === 'Insurance' && ['CF', 'FOB', 'EXW'].includes(contract); w.push([c.l.toUpperCase(), hide ? '' : c.r, hide ? '' : c.c, hide ? '' : c.a]); });
      w.push(["NATURE OF PAYMENT", String(inv.pymtNature || '').split('||')[0].trim(), "PAYMENT PRD.", inv.pymtPeriod ? inv.pymtPeriod + ' DAYS' : '']);
      w.push(["BUYER'S NAME & ADDRESS", [buyer, ...buyerAddr].join('\n')]);
    });
    w.push([]);
    w.push(["ITEM DETAILS"]);
    w.push(["INV SR", "INV NO", "ITEM NO", "RITC", "DESCRIPTION", "QTY", "UNIT", "RATE", "TOTAL VALUE", "FOB (FC)", "FOB (INR)", "SCHEME", "REWARD", "RODTEP", "PMV (INR/UNIT)", "TOTAL PMV (INR)", "END USE", "IGST PAY STATUS", "TAXABLE VALUE", "IGST %", "IGST AMT", "HAWB NO", "TOTAL PKG", "SOURCE STATE", "TRANSIT COUNTRY"]);
    ck.itemRows.forEach(r => {
      const it = r.it; const igstAmt = parseFloat(it?.igstAmt || 0);
      w.push([r.invSr, r.invNo, r.itemSr, it.ritc || '', it.desc || it.description || '', r.qty, r.unit, r.rate, r.total, r.fobFc, r.fobInr, r.scheme, r.reward, r.rosctl === 'Y' ? 'RoSCTL' : r.rodtep,
        r.unitPmv, r.totalPmv, it.endUse || '', igstAmt > 0 ? 'PAYMENT' : (it.igstPayStatus && it.igstPayStatus !== 'Select' ? it.igstPayStatus : 'LUT'), parseFloat(it.taxableValue || 0).toFixed(2), r.igstRate, igstAmt.toFixed(2), r.hawb, r.totalPkg, r.sourceState, r.transitCountry]);
    });
    if (ck.dbkRows.length) {
      w.push([]); w.push(["DRAWBACK DETAILS"]);
      w.push(["INV NO", "ITEM NO", "DBK SR NO", "RATE %", "RATE RS/UNIT", "CAP RS/UNIT", "DBK QTY", "UNIT", "DBK AMT (INR)"]);
      ck.dbkRows.forEach(r => w.push([r.invNo, r.itemNo, r.dbkNo || '', r.dbkRtAdv || '', r.dbkRtSpe || '', r.dbkCap || '', r.dbkQty || '', r.accUnit || '', r.amt === null ? '' : r.amt.toFixed(2)]));
      w.push(["", "", "", "", "", "", "", "TOTAL", ck.dbkTotal.toFixed(2)]);
    }
    if (ck.rosctlRows.length) {
      w.push([]); w.push(["ROSCTL DETAILS"]);
      w.push(["INV NO", "ITEM NO", "ROSCTL SL NO", "STATE %", "STATE CAP", "CENTRAL %", "CENTRAL CAP", "QTY", "FOB (INR)", "ROSCTL AMT (INR)"]);
      ck.rosctlRows.forEach(r => w.push([r.inv, r.itm, r.slNo || 'NOT IN SCHEDULE', r.split ? r.split.stateRate : r.rate, r.split ? r.split.stateCap : '', r.split ? r.split.centralRate : '', r.split ? r.split.centralCap : '', r.qty, r.fob.toFixed(2), r.amt === null ? '' : (r.amt || 0).toFixed(2)]));
      w.push(["", "", "", "", "", "", "", "", "TOTAL", ck.rosctlTotal.toFixed(2)]);
    }
    if (ck.rodtepRows.length) {
      w.push([]); w.push(["RODTEP DETAILS"]);
      w.push(["INV SR", "ITEM SR", "FOB (INR)", "QTY", "UNIT", "RATE %", "CAP", "RODTEP AMT (INR)", "APPENDIX"]);
      ck.rodtepRows.forEach(r => w.push([r.invSr, r.itemSr, r.fob.toFixed(2), r.qty, r.unit, r.noRate ? 'NOT IN MASTER' : (r.rsPerUqc && !r.rate ? `RS ${r.rsPerUqc}/${r.unit}` : r.rate), r.cap || '', r.amt === null ? '' : (r.amt || 0).toFixed(2), r.appendix]));
      w.push(["", "", "", "", "", "", "TOTAL", ck.rodtepTotal.toFixed(2)]);
    }
    if (allSwStatements.length > 0) {
      w.push([]); w.push(["SINGLE WINDOW STATEMENT"]);
      w.push(["INV NO/ITEM NO", "STATEMENT FOR", "STATEMENT TYPE", "STATEMENT CODE"]);
      allSwStatements.forEach(r => w.push([r.invItemNo, r.statementFor || '', r.statementType || '', r.statementCode || r.statementText || '']));
    }
    if (allSwInfos.length > 0) {
      w.push([]); w.push(["SINGLE WINDOW INFO"]);
      w.push(["INV NO/ITEM NO", "TYPE", "QUALIFIER", "CODE", "TEXT", "MEASUREMENT", "UNIT"]);
      allSwInfos.forEach(r => w.push([r.invItemNo, r.type || '', r.qualifier || '', infoCodeText(r), r.text || '', r.measurement || '', r.unit || '']));
    }
    if (allSuppDocs.length > 0) {
      w.push([]); w.push(["SINGLE WINDOW SUPPORTING DOCUMENT"]);
      w.push(["INV NO/ITEM NO", "STATEMENT FOR", "IRN NO", "DOC TYPE", "ISSUED PARTY", "REF NO", "PLACE", "ISSUE DT", "EXP DT", "BNF PARTY", "FILE", "ICEGATE ID"]);
      allSuppDocs.forEach(r => w.push([r.invItemNo, r.statementFor || '', r.irnNo || '', docTypeText(r.docType), r.issuedParty || '', r.refNo || '', r.place || '', r.issueDt || '', r.expDt || '', r.bnfParty || '', r.fileName || '', r.ceSanchitId || '']));
    }
    w.push([]);
    w.push(["TOTAL INV. VALUE (FC)", ck.invTotal, "TOTAL FOB (INR)", ck.fobTotal]);
    w.push(["TOTAL DBK (INR)", ck.dbkTotal.toFixed(2), ck.hasRosctl ? "TOTAL ROSCTL (INR)" : "", ck.hasRosctl ? ck.rosctlTotal.toFixed(2) : ""]);
    if (ck.hasRodtep) w.push(["TOTAL RODTEP (INR)", ck.rodtepTotal.toFixed(2)]);
    w.push(["TOTAL PMV (INR)", displayTotalPmv, "TOTAL TAXABLE (INR)", displayTotalTaxable]);
    w.push(["TOTAL IGST (INR)", displayTotalIgst]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(w);
    XLSX.utils.book_append_sheet(wb, ws, "Checklist");
    XLSX.writeFile(wb, `Shipping_Bill_${exportData?.jobNo || 'Checklist'}.xlsx`);
  };

  const mapToBackendSchema = () => {
    return {
      Header: {
        JobNumber: parseInt(exportData?.jobNo?.replace(/\D/g, '') || '0') || 0,
        JobDate: exportData?.jobDate || ''
      },
      SB: {
        JobNumber: parseInt(exportData?.jobNo?.replace(/\D/g, '') || '0') || 0,
        TypeOfExporter: exportData?.exporterType || exportData?.ExpType || 'MERCHANT',
        ImporterExporterCode: exportData?.ieCode || '',
        BranchSrNoOfExporter: parseInt(exportData?.branchSrNo || '0') || 0,
        PortOfLoading: exportData?.customsPortCode ? `${exportData.customsPortName || ''} ( ${exportData.customsPortCode} )` : (exportData?.customsPortName || ''),
        StateOfOriginOfGoods: exportData?.stateOriginName || ''
      },
      Invoices: [
        {
          InvoiceSerialNumber: 1,
          ActualInvoiceNo: exportData?.invoices?.[0]?.no || '',
          InvoiceCurrency: exportData?.invoices?.[0]?.currency || '',
          InvoiceValueFOB: parseFloat(exportData?.invoices?.[0]?.value || '0') || 0,
          NatureOfContract: exportData?.invoices?.[0]?.contractType || '',
          Items: items.map((item, index) => {
            const igstAmt = parseFloat(item?.igstAmt || 0);
            return {
              ItemSerialNumberInvoice: item.invSr || index + 1,
              EndUseOfItem: item.endUse || '',
              IgstPaymentStatus: igstAmt > 0 ? 'PAYMENT' : (item.igstPayStatus === 'Select' ? 'LUT' : (item.igstPayStatus || 'LUT')),
              TaxableValue: parseFloat(item.taxableValue || 0),
              IgstAmount: igstAmt,
              Quantity: parseFloat(item.qty || 0),
              UnitOfMeasurement: item.uqc || '',
              RitcCode: item.ritc || '',
              GoodsDescription: item.desc || '',
              Drawback: []
            };
          })
        }
      ],
      Containers: [],
      PackingLists: [],
      SupportingDocs: [],
      Amendments: [],
      DigiSigns: []
    };
  };

  const dummyPayload = mapToBackendSchema();

  // saves the job (same as Save on the SB Header); it showed a message box before
  const handleSaveToBackend = () => { window.dispatchEvent(new Event('export-save')); };

  const hrStyle = { border: 'none', borderTop: '1px solid #000', margin: '8px 0' };
  const thStyle = { textAlign: 'left', fontWeight: 'bold', padding: '1px 2px', textTransform: 'uppercase' };
  const tdStyle = { padding: '1px 2px', verticalAlign: 'top', textTransform: 'uppercase' };
  // 12-Nov-2026: the "Full S/B checklist in one Excel file" button asked for handleExportExcel, which was not given -
  // the button did nothing
  const handleExportExcel = handleDownloadExcel;
  return { ck, handleExportExcel, reportType, setReportType, landscape, setLandscape, watermark, setWatermark, refreshKey, onRefresh, onPrint, printReportId, sendReportMail, toastError, exportReportExcel, rodteps, sbJson, loadSbJson, jobData: exportData, allItems: items,
    infoCodeText, docTypeText, activeBranch, allSuppDocs, allSwInfos, allSwStatements, calcTotalIgst, calcTotalPmv, calcTotalTaxable, chaDisplayName, containers, dbkItems, displayTotalIgst, displayTotalPmv, displayTotalTaxable, dummyPayload, exportData, handleDownloadExcel, handleDownloadPDF, handlePrint, handleSaveToBackend, hrStyle, items, licenseItems, mapToBackendSchema, reportRef, setAllSuppDocs, setAllSwInfos, setAllSwStatements, setViewMode, tdStyle, thStyle, viewMode };
}
