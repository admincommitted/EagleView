// Toolbar of Export > Get Report. Reworked 29-Oct-2026: "Get Report" (report list + report) and "CACHE01 Preview"
// (the JSON the software really sends, built by the server); Refresh rebuilds the report (it reloaded the whole
// page before and lost unsaved changes); Save saves the job; print / mail / Excel are in the report panel.
import { CheckSquare, Code, Copy, Download, RefreshCw, Save } from 'lucide-react';
import React from 'react';
import toast from 'react-hot-toast';

export default function SBChecklistSection({ ctx }) {
  const { handleDownloadPDF, handleSaveToBackend, setViewMode, viewMode, reportType, onRefresh, loadSbJson, sbJson } = ctx;
  const b = { padding: '0.25rem 0.75rem', fontSize: '11px' };
  return (
    <div className="no-print" style={{ padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel, #fff)', gap: '0.5rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" className={`btn ${viewMode === 'CHECKLIST' ? 'btn-primary' : 'btn-secondary'}`} style={b} onClick={() => setViewMode('CHECKLIST')}><CheckSquare size={12} /> Get Report</button>
        <button type="button" className={`btn ${viewMode === 'JSON' ? 'btn-primary' : 'btn-secondary'}`} style={b} onClick={() => { setViewMode('JSON'); loadSbJson(); }}><Code size={12} /> CACHE01 Preview</button>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {viewMode === 'CHECKLIST' && reportType === 'checklist' && <button type="button" className="btn btn-secondary" onClick={handleDownloadPDF} style={b} title="Download the S/B checklist as a PDF file (with page numbers)"><Download size={12} /> PDF file</button>}
        {viewMode === 'CHECKLIST' && <button type="button" className="btn btn-secondary" style={b} onClick={onRefresh} title="Rebuild the report from the job on screen"><RefreshCw size={12} /> Refresh</button>}
        {viewMode === 'JSON' && <>
          <button type="button" className="btn btn-secondary" style={b} onClick={loadSbJson}><RefreshCw size={12} /> Rebuild</button>
          <button type="button" className="btn btn-secondary" style={b} disabled={!sbJson || !sbJson.json} onClick={() => { navigator.clipboard.writeText(JSON.stringify(sbJson.json, null, 2)).then(() => toast.success('JSON copied')).catch(() => toast.error('Copy not allowed by the browser')); }}><Copy size={12} /> Copy JSON</button>
        </>}
        <button type="button" className="btn btn-primary" onClick={handleSaveToBackend} style={b} title="Save the job (Ctrl+S)"><Save size={12} /> Save Job</button>
      </div>
    </div>
  );
}
