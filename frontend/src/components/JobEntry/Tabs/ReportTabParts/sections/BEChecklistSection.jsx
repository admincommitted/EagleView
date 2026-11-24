// Screen section: B/E Checklist
// Split out of ReportTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Calculator, CheckSquare, Code, Download, Printer } from 'lucide-react';
import React from 'react';
import toast from 'react-hot-toast';
import { downloadReportPdf } from '../downloadReportPdf';

export default function BEChecklistSection({ ctx }) {
  const { allItems, esanchitDocs, handleExportExcel, jobData, reportView, setReportView, onPrint } = ctx;
  // 21-Nov-2026: "PDF file" - the report shown, saved as a PDF file (the export Report tab has the same button)
  const [pdfBusy, setPdfBusy] = React.useState(false);
  const onPdf = async () => {
    const el = document.getElementById('report-print-area');
    if (!el || !el.innerHTML.trim()) { toast.error('Nothing to save yet - wait for the report to load'); return; }
    setPdfBusy(true);
    try {
      const name = `${reportView === 'duty' ? 'Duty_Summary' : (ctx.reportType === 'eannex' ? 'BE_Checklist' : (ctx.reportType || 'Report'))}_${jobData?.jobNo || 'DRAFT'}`.replace(/[^\w.-]+/g, '_');
      const r = await downloadReportPdf(el, { fileName: name, landscape: reportView === 'checklist' && ctx.reportType !== 'eannex' && !!ctx.landscape, watermark: ctx.watermark ? 'DRAFT' : '' });
      if (r === 'ok') toast.success('PDF file downloaded');
      else if (r === 'long') { toast('This report is too long for a PDF file - Print opens now; choose "Save as PDF" there', { duration: 7000 }); onPrint(); }
    } catch (e) { toast.error('PDF file could not be made - use Print and "Save as PDF"'); }
    finally { setPdfBusy(false); }
  };
  return (
    <>
    {/* Toolbar */}
        <div style={{ padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel, #ffffff)' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className={`btn ${reportView === 'checklist' ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ padding: '0.25rem 0.75rem', fontSize: '11px' }}
              onClick={() => setReportView('checklist')}
            >
              <CheckSquare size={12} /> Get Report
            </button>
            <button 
              className={`btn ${reportView === 'duty' ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ padding: '0.25rem 0.75rem', fontSize: '11px' }}
              onClick={() => setReportView('duty')}
            >
              <Calculator size={12} /> Duty Summary
            </button>
            <button 
              className={`btn ${reportView === 'json' ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ padding: '0.25rem 0.75rem', fontSize: '11px' }}
              onClick={() => setReportView('json')}
            >
              <Code size={12} /> CACHI01 Preview
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.25rem 0.75rem', fontSize: '11px' }}
              onClick={onPrint}
              disabled={reportView === 'json'}
              title={reportView === 'json' ? 'Use Export JSON for the CACHI01 file' : 'Print the report shown below (or save it as PDF)'}
            >
              <Printer size={12} /> Print
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.75rem', fontSize: '11px' }}
              onClick={onPdf}
              disabled={reportView === 'json' || pdfBusy}
              title="Download the report shown below as a PDF file"
            >
              <Download size={12} /> {pdfBusy ? 'Making PDF - wait...' : 'PDF file'}
            </button>
            <button 
              className="btn btn-primary" 
              style={{ padding: '0.25rem 0.75rem', fontSize: '11px' }}
              onClick={handleExportExcel}
            >
              <Download size={12} /> Export to Excel
            </button>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.25rem 0.75rem', fontSize: '11px' }}
              onClick={() => {
                const data = { jobData, items: allItems, esanchitDocs };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url;
                a.download = `BE_${jobData?.jobNo || 'draft'}.json`; a.click();
                toast.success('JSON downloaded!');
              }}
            >
              <Code size={12} /> Export JSON
            </button>
          </div>
        </div>

        {/* Content Area */}
    </>
  );
}
