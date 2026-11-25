import { useState } from 'react';
import { Calculator, CheckSquare, Code, Download, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui';
import { downloadBlob } from '@/lib/download';
import { downloadReportPdf } from '../downloadReportPdf';

const VIEWS = [
  { view: 'checklist', label: 'Get Report', icon: CheckSquare },
  { view: 'duty', label: 'Duty Summary', icon: Calculator },
  { view: 'json', label: 'CACHI01 Preview', icon: Code },
];

const pdfFileName = (reportView, reportType, jobNo) => {
  const report = reportView === 'duty' ? 'Duty_Summary' : (reportType === 'eannex' ? 'BE_Checklist' : (reportType || 'Report'));
  return `${report}_${jobNo || 'DRAFT'}`.replace(/[^\w.-]+/g, '_');
};

export default function BEChecklistSection({ ctx }) {
  const { allItems, esanchitDocs, handleExportExcel, jobData, reportView, setReportView, reportType, landscape, watermark, onPrint } = ctx;
  const [pdfBusy, setPdfBusy] = useState(false);
  const isJsonView = reportView === 'json';

  const savePdf = async () => {
    const el = document.getElementById('report-print-area');
    if (!el || !el.innerHTML.trim()) { toast.error('Nothing to save yet - wait for the report to load'); return; }
    setPdfBusy(true);
    try {
      const result = await downloadReportPdf(el, {
        fileName: pdfFileName(reportView, reportType, jobData?.jobNo),
        landscape: reportView === 'checklist' && reportType !== 'eannex' && !!landscape,
        watermark: watermark ? 'DRAFT' : '',
      });
      if (result === 'ok') toast.success('PDF file downloaded');
      else if (result === 'long') {
        toast('This report is too long for a PDF file - Print opens now; choose "Save as PDF" there', { duration: 7000 });
        onPrint();
      }
    } catch {
      toast.error('PDF file could not be made - use Print and "Save as PDF"');
    } finally {
      setPdfBusy(false);
    }
  };

  const exportJson = () => {
    const data = { jobData, items: allItems, esanchitDocs };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `BE_${jobData?.jobNo || 'draft'}.json`);
    toast.success('JSON downloaded!');
  };

  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-border tw:bg-card tw:px-2 tw:py-[0.35rem]">
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        {VIEWS.map(({ view, label, icon: Icon }) => (
          <Button key={view} variant={reportView === view ? 'default' : 'outline'} onClick={() => setReportView(view)}>
            <Icon /> {label}
          </Button>
        ))}
      </div>
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button onClick={onPrint} disabled={isJsonView} title={isJsonView ? 'Use Export JSON for the CACHI01 file' : 'Print the report shown below (or save it as PDF)'}>
          <Printer /> Print
        </Button>
        <Button onClick={savePdf} disabled={isJsonView || pdfBusy} title="Download the report shown below as a PDF file">
          <Download /> {pdfBusy ? 'Making PDF - wait...' : 'PDF file'}
        </Button>
        <Button variant="default" onClick={handleExportExcel}>
          <Download /> Export to Excel
        </Button>
        <Button onClick={exportJson}>
          <Code /> Export JSON
        </Button>
      </div>
    </div>
  );
}
