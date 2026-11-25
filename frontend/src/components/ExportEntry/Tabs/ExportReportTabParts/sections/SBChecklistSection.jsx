// Toolbar of Export > Get Report: "Get Report" (report list + report) or "CACHE01 Preview" (the JSON the software
// really sends); Refresh rebuilds the report without reloading the page; Save saves the job. Print / mail / Excel
// are in the report panel.
import { useState } from 'react';
import toast from 'react-hot-toast';
import { CheckSquare, Code, Copy, Download, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui';

const VIEWS = [
  { view: 'CHECKLIST', label: 'Get Report', icon: CheckSquare },
  { view: 'JSON', label: 'CACHE01 Preview', icon: Code },
];

export default function SBChecklistSection({ ctx }) {
  const { handleDownloadPDF, handleSaveToBackend, setViewMode, viewMode, reportType, onRefresh, loadSbJson, sbJson } = ctx;
  const [pdfBusy, setPdfBusy] = useState(false);
  const isJsonView = viewMode === 'JSON';

  const openView = (view) => {
    setViewMode(view);
    if (view === 'JSON') loadSbJson();
  };

  const savePdf = async () => {
    setPdfBusy(true);
    try {
      await handleDownloadPDF();
    } catch {
      toast.error('PDF file could not be made - use Print and "Save as PDF"');
    } finally {
      setPdfBusy(false);
    }
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(sbJson.json, null, 2));
      toast.success('JSON copied');
    } catch {
      toast.error('Copy not allowed by the browser');
    }
  };

  return (
    <div className="no-print tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-border tw:bg-card tw:px-2 tw:py-[0.35rem]">
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        {VIEWS.map(({ view, label, icon: Icon }) => (
          <Button key={view} variant={viewMode === view ? 'default' : 'outline'} onClick={() => openView(view)}>
            <Icon /> {label}
          </Button>
        ))}
      </div>
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        {!isJsonView && reportType === 'checklist' && (
          <Button onClick={savePdf} disabled={pdfBusy} title="Download the S/B checklist as a PDF file (with page numbers)">
            <Download /> {pdfBusy ? 'Making PDF - wait...' : 'PDF file'}
          </Button>
        )}
        {!isJsonView && <Button onClick={onRefresh} title="Rebuild the report from the job on screen"><RefreshCw /> Refresh</Button>}
        {isJsonView && (
          <>
            <Button onClick={loadSbJson}><RefreshCw /> Rebuild</Button>
            <Button disabled={!sbJson || !sbJson.json} onClick={copyJson}><Copy /> Copy JSON</Button>
          </>
        )}
        <Button variant="default" onClick={handleSaveToBackend} title="Save the job (Ctrl+S)"><Save /> Save Job</Button>
      </div>
    </div>
  );
}
