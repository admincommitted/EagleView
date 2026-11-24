// State and logic
// Split out of ReportTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { JobContext } from '../../JobContext';
import React, { useContext, useState } from 'react';
import toast from 'react-hot-toast';
import { printReport } from './printReport';
import { buildImportWorkbook } from './excelExport';
// static import like the other Excel screens: a dynamic import('xlsx') of this CommonJS package gave a module without
// .utils in the Vite build, so the Excel buttons of this tab did nothing (28-Oct-2026)
import * as XLSXNS from 'xlsx';
import { computeItemDuty } from '../ItemGridTabParts/helpers';
const XLSXLIB = XLSXNS.utils ? XLSXNS : (XLSXNS.default || XLSXNS);

const REPORT_NAMES = { eannex: 'BE_Checklist', chachecklist: 'CHA_Checklist', fields: 'BE_Checklist_Detailed', invoicewise: 'Invoice_Wise_Checklist', dutysheet: 'Duty_Sheet', classification: 'Classification', exemption: 'Duty_Exemption', invparticulars: 'Invoice_Particulars', annexure: 'Invoice_Item_Annexure', igm: 'IGM_Details', containers: 'Containers', bond: 'Bond_Details', docs: 'Supporting_Documents', duty: 'Duty_Summary', adc: 'ADC_Sheet', stampduty: 'Stamp_Duty_Sheet' };

export default function useReportTab(ctx) {
  const [reportView, setReportView] = useState('checklist');
  const [checklistLayout, setChecklistLayout] = useState('eannex');
  const { jobData, items, esanchitDocs, masters } = useContext(JobContext);
  // Get Report (28-Oct-2026): report picked, paper, watermark, refresh key; printing goes through printReport()
  const [reportType, setReportType] = useState('eannex');
  const [landscape, setLandscape] = useState(false);
  const [watermark, setWatermark] = useState(!(jobData && jobData.beNo));
  const [refreshKey, setRefreshKey] = useState(0);
  const onRefresh = () => setRefreshKey(k => k + 1);
  // print from a report row: wait until that report is on screen (the checklist loads from the server)
  const [pendingPrint, setPendingPrint] = useState(null);
  const printReportId = (id) => setPendingPrint({ id, at: Date.now() });
  React.useEffect(() => {
    if (!pendingPrint || reportType !== pendingPrint.id) return undefined;
    const t = setInterval(() => {
      const el = document.getElementById('report-print-area');
      const txt = (el && el.textContent) || '';
      const ready = el && txt.length > 80 && !/Preparing checklist/.test(txt);
      if (ready || Date.now() - pendingPrint.at > 15000) { clearInterval(t); setPendingPrint(null); if (ready) onPrint(); else toast.error('Report did not load - try again'); }
    }, 300);
    return () => clearInterval(t);
  }, [pendingPrint, reportType]);

  // "Send checklist to mail": the report shown, as the mail body (screen-only notes removed)
  const sendReportMail = async (to, subject) => {
    const el = document.getElementById('report-print-area');
    if (!el || (el.textContent || '').length < 50) { toast.error('Report is not ready yet'); return false; }
    const copy = el.cloneNode(true);
    copy.querySelectorAll('.no-print, style').forEach(n => n.remove());
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#000">${copy.innerHTML}<p style="color:#64748b;font-size:11px;margin-top:16px">Sent from ${'EDI'} - this is a draft checklist for checking; final values are as filed / assessed by Customs.</p></div>`;
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

  // Excel of the report shown (28-Oct-2026): every table row of the report, in order, one sheet. Amounts like
  // "1,234.50" become numbers; codes (CTH, IEC, AWB) stay text so leading zeros are kept.
  const exportReportExcel = () => {
    if (reportView === 'checklist' && reportType === 'chachecklist') return handleExportExcel();
    const el = document.getElementById('report-print-area');
    if (!el || (el.textContent || '').length < 50) { toast.error('Report is not ready yet'); return; }
    const title = (REPORT_NAMES[reportView === 'duty' ? 'duty' : reportType] || 'Report');
    Promise.resolve(XLSXLIB).then(XLSX => {
      const aoa = [[title.replace(/_/g, ' ')], [`Job No: ${jobData?.jobNo || 'DRAFT'}`], []];
      const merges = [];
      const val = (t) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return /^-?[\d,]+\.\d+$/.test(s) ? parseFloat(s.replace(/,/g, '')) : s; };
      let lastTable = null;
      el.querySelectorAll('table').forEach(tbl => {
        // skip screen-only notes and nested tables (the whole Report tab sits in a .no-print panel, so look inside the report only)
        const np = tbl.closest('.no-print'); if ((np && el.contains(np)) || (tbl.parentElement && tbl.parentElement.closest('table'))) return;
        if (lastTable) aoa.push([]);
        lastTable = tbl;
        tbl.querySelectorAll('tr').forEach(tr => {
          const row = []; let col = 0;
          tr.querySelectorAll('th, td').forEach(td => {
            const span = parseInt(td.getAttribute('colspan'), 10) || 1;
            row[col] = val(td.textContent);
            if (span > 1) merges.push({ s: { r: aoa.length, c: col }, e: { r: aoa.length, c: col + span - 1 } });
            col += span;
          });
          if (row.some(v => v !== '' && v !== undefined)) aoa.push(Array.from(row, v => (v === undefined ? '' : v)));
        });
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!merges'] = merges;
      const widths = []; aoa.forEach(r => r.forEach((v, i) => { widths[i] = Math.min(45, Math.max(widths[i] || 8, String(v).length + 2)); }));
      ws['!cols'] = widths.map(w => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
      XLSX.writeFile(wb, `${title}_${String(jobData?.jobNo || 'DRAFT').replace(/[^\w.-]+/g, '_')}.xlsx`);
      toast.success('Excel downloaded');
    }).catch(e => toast.error('Excel failed: ' + e.message));
  };

  const onPrint = () => {
    const el = document.getElementById('report-print-area');
    if (!el || !el.innerHTML.trim()) { toast.error('Nothing to print yet - wait for the report to load'); return; }
    if (/Preparing checklist/.test(el.textContent || '') && el.textContent.trim().length < 40) { toast.error('Checklist is still loading'); return; }
    const names = REPORT_NAMES;
    printReport(el, { title: `${names[reportView === 'duty' ? 'duty' : reportType] || 'Report'}_${jobData?.jobNo || 'DRAFT'}`.replace(/[^\w.-]+/g, '_'), landscape: reportView === 'checklist' && reportType !== 'eannex' && landscape, watermark: watermark ? 'DRAFT' : '' });
  };
  
  // Collect all items across all invoices
  const allItems = items?.length > 0 ? items : 
    (jobData?.invoices?.flatMap(inv => inv.items || []) || []);
  
  // Duty calculations
  // 30-Oct-2026: assessable value in INR (item value x exchange rate + freight / insurance share) - it was a sum of
  // the invoice-currency item values labelled as rupees
  const totalAssessableValue = allItems.reduce((s, it) => { const d = computeItemDuty(it, jobData?.invoices || [], jobData || {}); return s + (d.rateFound ? d.av : parseFloat(it.assessableValueInr || 0) || 0); }, 0);
  const totalBCD = allItems.reduce((s,it) => s + parseFloat(it.bcdAmount||it.basicCustomsDuty||0), 0);
  const totalSWS = allItems.reduce((s,it) => s + parseFloat(it.swsAmount||0), 0);
  const totalIGST = allItems.reduce((s,it) => {
    let amt = parseFloat(it.igst || it.igstAmount || 0);
    if (!amt && it.igstData) {
      try {
        const parsed = typeof it.igstData === 'string' ? JSON.parse(it.igstData) : it.igstData;
        amt = parseFloat(parsed?.amount || 0);
      } catch (e) {}
    }
    return s + amt;
  }, 0);
  const totalCVD = allItems.reduce((s,it) => s + parseFloat(it.cvdAmount||0), 0);
  const totalAdlCVD = allItems.reduce((s,it) => s + parseFloat(it.adlCvdAmount||0), 0);
  const totalHealthCess = allItems.reduce((s,it) => s + parseFloat(it.healthCessAmount||0), 0);
  const totalSAPTA = allItems.reduce((s,it) => s + parseFloat(it.saptaAmount||0), 0);
  const grandTotal = totalBCD + totalSWS + totalIGST + totalCVD + totalAdlCVD + totalHealthCess + totalSAPTA;
  const fmt = (n) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const handleExportExcel = () => {
    try {
      const wb = buildImportWorkbook(XLSXLIB, { jobData, items: allItems, esanchitDocs });
      XLSXLIB.writeFile(wb, `BE_Checklist_${String(jobData?.jobNo || 'DRAFT').replace(/[^\w.-]+/g, '_')}.xlsx`);
      toast.success('Excel file downloaded!');
    } catch (e) { toast.error('Excel failed: ' + e.message); }
  };

  // Helpers
  const Row = ({ label, value }) => (
    <tr>
      <td style={{ border:'1px solid #cbd5e1', padding:'5px 8px', width:'35%', background:'#f8fafc', fontWeight:600, fontSize:'11px', color:'#334155' }}>{label}</td>
      <td style={{ border:'1px solid #cbd5e1', padding:'5px 8px', fontSize:'11px' }}>{value || <span style={{color:'#94a3b8'}}>—</span>}</td>
    </tr>
  );
  
  const SectionHeader = ({ title }) => (
    <tr>
      <td colSpan="2" style={{ background:'#1e3a5f', color:'white', padding:'6px 10px', fontWeight:700, fontSize:'12px', textTransform:'uppercase', letterSpacing:'0.5px' }}>{title}</td>
    </tr>
  );
  return { exportReportExcel, printReportId, sendReportMail, toastError, reportType, setReportType, landscape, setLandscape, watermark, setWatermark, refreshKey, onRefresh, onPrint, checklistLayout, setChecklistLayout, masters, Row, SectionHeader, allItems, esanchitDocs, fmt, grandTotal, handleExportExcel, items, jobData, reportView, setReportView, totalAdlCVD, totalAssessableValue, totalBCD, totalCVD, totalHealthCess, totalIGST, totalSAPTA, totalSWS };
}
