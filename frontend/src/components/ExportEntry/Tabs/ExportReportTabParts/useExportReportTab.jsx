import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { errorMessage } from '@/services/axiosInstance';
import { useExportContext } from '../../ExportContext';
import { useMasterList } from '../../useExportCalc';
import { exportEntryApi } from '../../exportEntryApi';
import { isRosctlItem } from '../Schemes/schemeUtils';
import { printReport } from '../../../JobEntry/Tabs/ReportTabParts/printReport';
import { reportMailHtml } from '../../../JobEntry/Tabs/ReportTabParts/reportCss';
import { downloadReportPdf } from '../../../JobEntry/Tabs/ReportTabParts/downloadReportPdf';
import { buildChecklist, checklistTotals, docTypeTextOf, infoCodeTextOf, shippingBillRequest, singleWindowRows } from './checklistData';
import { checklistSheetRows } from './sbChecklistExcel';

const REPORT_FILE = {
  checklist: 'SB_Checklist', invoicewise: 'Invoice_Wise_Checklist', rodtep: 'RoDTEP_Checklist', dbk: 'Drawback_Particulars', licence: 'Licence_Particulars',
  ar4: 'AR4_Particulars', reexport: 'ReExport_Particulars', invparticulars: 'Invoice_Particulars', annexure: 'SB_Annexure_Items', contannex: 'Container_Annexure',
  shipment: 'Shipment_Containers', swinfo: 'SW_Info_Statements', docs: 'Supporting_Documents',
};
const PREVIEW_DELAY_MS = 600;
const PRINT_DELAY_MS = 250;

const printArea = () => document.getElementById('report-print-area');
const shownTextLength = (el) => (el?.textContent || '').length;
const printedOnText = () => 'Printed On : ' + new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

// the text of a cell, a line break read as a space ("EXPINV-01<br>18/11/2026" is not one word)
const cellText = (cell) => {
  const copy = cell.cloneNode(true);
  copy.querySelectorAll('br').forEach((lineBreak) => lineBreak.replaceWith(' '));
  return copy.textContent;
};

// amounts like "1,234.50" become numbers in Excel; codes stay text
const sheetValue = (text) => {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return /^-?[\d,]+\.\d+$/.test(value) ? parseFloat(value.replace(/,/g, '')) : value;
};

// every table row of the report shown, in order; a cell spanning columns is followed by blank cells
function reportSheetRows(el, title, jobNo) {
  const rows = [[title.replace(/_/g, ' ')], [`Job No: ${jobNo || 'DRAFT'}`], []];
  el.querySelectorAll('table').forEach((table, tableIndex) => {
    if (tableIndex) rows.push([]);
    table.querySelectorAll('tr').forEach((tableRow) => {
      const row = [];
      tableRow.querySelectorAll('th, td').forEach((cell) => {
        row.push(sheetValue(cellText(cell)));
        const span = parseInt(cell.getAttribute('colspan'), 10) || 1;
        for (let extra = 1; extra < span; extra++) row.push('');
      });
      if (row.some((value) => value !== '')) rows.push(row);
    });
  });
  return rows;
}

const columnWidths = (rows) => {
  const widths = [];
  rows.forEach((row) => row.forEach((value, column) => { widths[column] = Math.min(45, Math.max(widths[column] || 8, String(value).length + 2)); }));
  return widths.map((width) => ({ wch: width }));
};

export default function useExportReportTab() {
  const { exportData, items, containers, dbkItems, licenseItems } = useExportContext();
  const chaDisplayName = exportData?.chaName || exportData?.chaNo || '';
  const jobNo = exportData?.jobNo;
  const jobTag = String(jobNo || 'DRAFT').replace(/[^\w.-]+/g, '_');

  const [viewMode, setViewMode] = useState('CHECKLIST');
  const [reportType, setReportType] = useState('checklist');
  const [landscape, setLandscape] = useState(false);
  const [watermark, setWatermark] = useState(!(exportData && (exportData.sbNo || exportData.sbNumber)));
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingPrint, setPendingPrint] = useState(null);
  const [sbJson, setSbJson] = useState(null);
  const [cache01, setCache01] = useState(null);
  const reportRef = useRef(null);

  const rodteps = useMasterList('/masters/rodteps');
  const schemeMaster = useMasterList('/masters/schemecodes');
  const chaMaster = useMasterList('/masters/cha-master');
  const hasRosctl = (items || []).some(isRosctlItem);
  const rosctlMaster = useMasterList('/masters/rosctls', hasRosctl);
  const stateMaster = useMasterList('/masters/states');
  const docMaster = useMasterList('/masters/esanchits');

  // the Shipping Bill the server builds (CACHE01) gives the checklist its SW statements / info / documents
  useEffect(() => {
    if (!exportData || !(items || []).length) { setCache01(null); return undefined; }
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const result = await exportEntryApi.previewSb(shippingBillRequest({ exportData, items, dbkItems, licenseItems }));
        if (live) setCache01(result && result.success && result.cache01 ? result.cache01 : null);
      } catch {
        if (live) setCache01(null);
      }
    }, PREVIEW_DELAY_MS);
    return () => { live = false; clearTimeout(timer); };
  }, [exportData, items, dbkItems, licenseItems]);

  const singleWindow = useMemo(() => singleWindowRows(cache01, exportData, items), [cache01, exportData, items]);
  const checklist = useMemo(
    () => buildChecklist({ exportData, items, dbkItems, rodteps, rosctlMaster, schemeMaster, chaMaster, cache01 }),
    [exportData, items, dbkItems, rodteps, rosctlMaster, schemeMaster, chaMaster, cache01],
  );
  const totals = checklistTotals(exportData, items);
  const infoCodeText = infoCodeTextOf(stateMaster, singleWindow.infos);
  const docTypeText = docTypeTextOf(docMaster);

  const onRefresh = () => setRefreshKey((key) => key + 1);

  const onPrint = () => {
    const el = printArea();
    if (!el || !el.innerHTML.trim()) { toast.error('Nothing to print yet'); return; }
    // the S/B checklist prints "Printed On" and "Page x of y" on every page, as iCAFFE prints it
    const isChecklist = reportType === 'checklist';
    printReport(el, {
      title: `${REPORT_FILE[reportType] || 'Report'}_${jobTag}`,
      landscape: !isChecklist && landscape,
      watermark: watermark ? 'DRAFT' : '',
      pageHeader: isChecklist ? { left: printedOnText(), right: 'Job ' + (jobNo || 'DRAFT') } : null,
    });
  };

  // print from a report row: the report is printed once it is on the screen
  const printReportId = (id) => setPendingPrint({ id, at: Date.now() });
  useEffect(() => {
    if (!pendingPrint || reportType !== pendingPrint.id) return undefined;
    const timer = setTimeout(() => { setPendingPrint(null); onPrint(); }, PRINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pendingPrint, reportType]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendReportMail = async (to, subject) => {
    const el = printArea();
    if (shownTextLength(el) < 50) { toast.error('Report is not ready yet'); return false; }
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#000">${reportMailHtml(el)}<p style="color:#64748b;font-size:11px;margin-top:16px">Draft checklist for checking; final values are as filed / assessed by Customs.</p></div>`;
    try {
      const result = await exportEntryApi.reportSendMail({ to, subject, html });
      if (result.success === false) throw new Error(result.error || 'Mail not sent');
      toast.success('Mail sent to ' + to);
      return true;
    } catch (error) {
      toast.error('Mail failed: ' + errorMessage(error) + ' (check Settings > Email)');
      return false;
    }
  };

  // the S/B checklist in one Excel file, the same values as on the screen
  const handleDownloadExcel = () => {
    const rows = checklistSheetRows({ exportData, containers, checklist, singleWindow, totals, infoCodeText, docTypeText });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Checklist');
    XLSX.writeFile(workbook, `Shipping_Bill_${jobTag}.xlsx`);
  };

  // Excel of the report shown (the S/B checklist keeps its own detailed Excel)
  const exportReportExcel = () => {
    if (reportType === 'checklist') { handleDownloadExcel(); return; }
    const el = printArea();
    if (shownTextLength(el) < 30) { toast.error('Report is not ready yet'); return; }
    const title = REPORT_FILE[reportType] || 'Report';
    const rows = reportSheetRows(el, title, jobNo);
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = columnWidths(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, title.slice(0, 31));
    XLSX.writeFile(workbook, `${title}_${jobTag}.xlsx`);
    toast.success('Excel downloaded');
  };

  const handleDownloadPDF = async () => {
    const result = await downloadReportPdf(reportRef.current, { fileName: `Shipping_Bill_${jobTag}`, watermark: watermark ? 'DRAFT' : '' });
    if (result === 'long') {
      toast('This report is too long for a PDF file - Print opens now; choose "Save as PDF" there', { duration: 7000 });
      onPrint();
    }
    return result;
  };

  // CACHE01 preview: the JSON the software really sends (built by the server)
  const loadSbJson = async () => {
    setSbJson({ loading: true });
    try {
      const result = await exportEntryApi.previewSb(shippingBillRequest({ exportData, items, dbkItems, licenseItems }));
      if (!result.success) throw new Error(result.error || 'could not build the SB');
      setSbJson({ json: result.cache01, validation: result.validation });
    } catch (error) {
      setSbJson({ error: errorMessage(error) });
    }
  };

  // saves the job (same as Save on the SB Header)
  const handleSaveToBackend = () => { window.dispatchEvent(new Event('export-save')); };

  return {
    exportData, jobData: exportData, items, allItems: items, containers, dbkItems, licenseItems, rodteps, chaDisplayName,
    checklist, singleWindow, totals, infoCodeText, docTypeText,
    viewMode, setViewMode, reportType, setReportType, landscape, setLandscape, watermark, setWatermark, refreshKey, onRefresh, reportRef,
    onPrint, printReportId, sendReportMail, exportReportExcel, handleExportExcel: handleDownloadExcel, handleDownloadPDF,
    sbJson, loadSbJson, handleSaveToBackend,
  };
}
