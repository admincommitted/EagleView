import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { errorMessage } from '@/services/axiosInstance';
import { useJobContext } from '../../JobContext';
import { jobEntryApi } from '../../jobEntryApi';
import { computeItemDuty } from '../ItemGridTabParts/helpers';
import { buildImportWorkbook } from './excelExport';
import { printReport } from './printReport';
import { reportMailHtml } from './reportCss';

const REPORT_NAMES = { eannex: 'BE_Checklist', chachecklist: 'CHA_Checklist', fields: 'BE_Checklist_Detailed', invoicewise: 'Invoice_Wise_Checklist', dutysheet: 'Duty_Sheet', classification: 'Classification', exemption: 'Duty_Exemption', invparticulars: 'Invoice_Particulars', annexure: 'Invoice_Item_Annexure', igm: 'IGM_Details', containers: 'Containers', bond: 'Bond_Details', docs: 'Supporting_Documents', duty: 'Duty_Summary', adc: 'ADC_Sheet', stampduty: 'Stamp_Duty_Sheet' };
const LOADING_TEXT = /Preparing checklist/;
const PRINT_WAIT_MS = 15000;

const printArea = () => document.getElementById('report-print-area');
const isReady = (el) => el && (el.textContent || '').length >= 50;
const safeFileName = (text) => String(text).replace(/[^\w.-]+/g, '_');
const amount = (value) => parseFloat(value || 0);
const sumOf = (items, valueOf) => items.reduce((total, item) => total + valueOf(item), 0);

const parseObject = (value) => {
  if (value && typeof value === 'object') return value;
  try {
    return JSON.parse(value || '{}') || {};
  } catch {
    return {};
  }
};
const isFilled = (value) => value !== undefined && value !== null && String(value).trim() !== '';

function storedIgstAmount(item) {
  const stored = parseFloat(item.igst || item.igstAmount || 0);
  return stored || parseFloat(parseObject(item.igstData).amount || 0);
}

// the duty of an item as 4. Items, the other reports and the Excel file work it out; an item whose invoice currency has
// no exchange rate keeps the amounts saved on it
function itemDuty(item, job) {
  const duty = computeItemDuty(item, job.invoices || [], job);
  if (duty.rateFound) return duty;
  const bcd = amount(item.bcdAmount || item.basicCustomsDuty);
  const sws = amount(item.swsAmount);
  const igst = storedIgstAmount(item);
  const cvd = amount(item.cvdAmount);
  const adlCvd = amount(item.adlCvdAmount);
  const health = amount(item.healthCessAmount);
  const sapta = amount(item.saptaAmount);
  return {
    av: parseFloat(item.assessableValueInr || 0) || 0,
    bcd, sws, igst, cvd, adlCvd, health, sapta, add: 0, other: 0, compCess: 0, foregone: 0,
    total: bcd + sws + igst + cvd + adlCvd + health + sapta,
  };
}

// items with no IGST rate, amount or exemption: their duty leaves IGST out
const itemsWithoutIgst = (allItems) => allItems
  .filter((item) => {
    const igst = parseObject(item.igstData);
    return !isFilled(igst.rate) && !isFilled(igst.amount) && !isFilled(igst.exmpNotnNo) && !storedIgstAmount(item);
  })
  .map((item) => `${item.invSrNo || 1}/${item.itemSrNo || item.itemNo || '?'} (${item.ritc || item.cth || 'no RITC'})`);

// the text of a cell, a line break read as a space (invoice no<br>date is not one word)
const cellText = (cell) => {
  const copy = cell.cloneNode(true);
  copy.querySelectorAll('br').forEach((lineBreak) => lineBreak.replaceWith(' '));
  return copy.textContent;
};

// Amounts like "1,234.50" become numbers; codes (CTH, IEC, AWB) stay text so leading zeros are kept.
const cellValue = (text) => {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return /^-?[\d,]+\.\d+$/.test(value) ? parseFloat(value.replace(/,/g, '')) : value;
};

// Every table row of the report, in order, as one sheet (screen-only notes and nested tables left out).
function reportSheetRows(el, title, jobNo) {
  const rows = [[title.replace(/_/g, ' ')], [`Job No: ${jobNo || 'DRAFT'}`], []];
  const merges = [];
  let tableCount = 0;
  el.querySelectorAll('table').forEach((table) => {
    const screenOnly = table.closest('.no-print');
    if ((screenOnly && el.contains(screenOnly)) || table.parentElement?.closest('table')) return;
    if (tableCount++) rows.push([]);
    table.querySelectorAll('tr').forEach((tableRow) => {
      const row = [];
      let column = 0;
      tableRow.querySelectorAll('th, td').forEach((cell) => {
        const span = parseInt(cell.getAttribute('colspan'), 10) || 1;
        row[column] = cellValue(cellText(cell));
        if (span > 1) merges.push({ s: { r: rows.length, c: column }, e: { r: rows.length, c: column + span - 1 } });
        column += span;
      });
      if (row.some((value) => value !== '' && value !== undefined)) rows.push(Array.from(row, (value) => (value === undefined ? '' : value)));
    });
  });
  return { rows, merges };
}

// the Duty Summary and the Detailed Checklist totals: the same estimate as 4. Items and the other reports
function dutyTotals(allItems, jobData) {
  const job = jobData || {};
  const duties = allItems.map((item) => itemDuty(item, job));
  const total = (pick) => sumOf(duties, (duty) => pick(duty) || 0);
  return {
    totalAssessableValue: total((duty) => duty.av),
    totalBCD: total((duty) => duty.bcd),
    totalSWS: total((duty) => duty.sws),
    totalIGST: total((duty) => duty.igst),
    totalCVD: total((duty) => duty.cvd),
    totalAdlCVD: total((duty) => duty.adlCvd),
    totalHealthCess: total((duty) => duty.health),
    totalSAPTA: total((duty) => duty.sapta),
    totalADD: total((duty) => duty.add),
    totalOtherDuty: total((duty) => duty.other),
    totalCompCess: total((duty) => duty.compCess),
    totalForegone: total((duty) => duty.foregone),
    grandTotal: total((duty) => duty.total),
    itemsWithoutIgst: itemsWithoutIgst(allItems),
  };
}

const fmt = (number) => Number(number).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function useReportTab() {
  const { jobData, items, esanchitDocs, masters } = useJobContext();
  const [reportView, setReportView] = useState('checklist');
  const [reportType, setReportType] = useState('eannex');
  const [landscape, setLandscape] = useState(false);
  const [watermark, setWatermark] = useState(!jobData?.beNo);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingPrint, setPendingPrint] = useState(null);

  const allItems = items?.length > 0 ? items : (jobData?.invoices?.flatMap((invoice) => invoice.items || []) || []);
  const jobNo = jobData?.jobNo;
  const shownReportName = REPORT_NAMES[reportView === 'duty' ? 'duty' : reportType] || 'Report';

  const onRefresh = () => setRefreshKey((key) => key + 1);

  const onPrint = () => {
    const el = printArea();
    if (!el || !el.innerHTML.trim()) { toast.error('Nothing to print yet - wait for the report to load'); return; }
    if (LOADING_TEXT.test(el.textContent || '') && el.textContent.trim().length < 40) { toast.error('Checklist is still loading'); return; }
    printReport(el, {
      title: safeFileName(`${shownReportName}_${jobNo || 'DRAFT'}`),
      landscape: reportView === 'checklist' && reportType !== 'eannex' && landscape,
      watermark: watermark ? 'DRAFT' : '',
    });
  };

  // print from a report row: wait until that report is on screen (the checklist loads from the server)
  const printReportId = (id) => setPendingPrint({ id, at: Date.now() });
  useEffect(() => {
    if (!pendingPrint || reportType !== pendingPrint.id) return undefined;
    const timer = setInterval(() => {
      const el = printArea();
      const text = el?.textContent || '';
      const ready = el && text.length > 80 && !LOADING_TEXT.test(text);
      if (!ready && Date.now() - pendingPrint.at <= PRINT_WAIT_MS) return;
      clearInterval(timer);
      setPendingPrint(null);
      if (ready) onPrint();
      else toast.error('Report did not load - try again');
    }, 300);
    return () => clearInterval(timer);
  }, [pendingPrint, reportType]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendReportMail = async (to, subject) => {
    const el = printArea();
    if (!isReady(el)) { toast.error('Report is not ready yet'); return false; }
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#000">${reportMailHtml(el)}<p style="color:#64748b;font-size:11px;margin-top:16px">Sent from EDI - this is a draft checklist for checking; final values are as filed / assessed by Customs.</p></div>`;
    try {
      const result = await jobEntryApi.sendEmail({ to, subject, html });
      if (result.success === false) throw new Error(result.error || 'Mail not sent');
      toast.success('Mail sent to ' + to);
      return true;
    } catch (error) {
      toast.error('Mail failed: ' + errorMessage(error) + ' (check Settings > Email)');
      return false;
    }
  };

  const handleExportExcel = () => {
    try {
      const workbook = buildImportWorkbook(XLSX, { jobData, items: allItems, esanchitDocs });
      XLSX.writeFile(workbook, `BE_Checklist_${safeFileName(jobNo || 'DRAFT')}.xlsx`);
      toast.success('Excel file downloaded!');
    } catch (error) {
      toast.error('Excel failed: ' + error.message);
    }
  };

  const exportReportExcel = () => {
    if (reportView === 'checklist' && reportType === 'chachecklist') { handleExportExcel(); return; }
    const el = printArea();
    if (!isReady(el)) { toast.error('Report is not ready yet'); return; }
    try {
      const { rows, merges } = reportSheetRows(el, shownReportName, jobNo);
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      sheet['!merges'] = merges;
      const widths = [];
      rows.forEach((row) => row.forEach((value, column) => { widths[column] = Math.min(45, Math.max(widths[column] || 8, String(value).length + 2)); }));
      sheet['!cols'] = widths.map((width) => ({ wch: width }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, shownReportName.slice(0, 31));
      XLSX.writeFile(workbook, `${shownReportName}_${safeFileName(jobNo || 'DRAFT')}.xlsx`);
      toast.success('Excel downloaded');
    } catch (error) {
      toast.error('Excel failed: ' + error.message);
    }
  };

  return {
    jobData, items, allItems, esanchitDocs, masters,
    reportView, setReportView, reportType, setReportType, landscape, setLandscape, watermark, setWatermark, refreshKey, onRefresh,
    onPrint, printReportId, sendReportMail, handleExportExcel, exportReportExcel,
    fmt, ...dutyTotals(allItems, jobData),
  };
}
