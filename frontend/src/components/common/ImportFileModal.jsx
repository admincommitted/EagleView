import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { X, Upload, FileText, CheckCircle, AlertCircle, Clipboard, FolderOpen } from 'lucide-react';

/**
 * ImportFileModal — Import BE/SB data from JSON or flat file
 * Props:
 *   type: 'be' | 'sb'
 *   onImport(result): callback — result = { jobData/exportData, invoices, items }
 *   onClose()
 */
// XML -> the same JSON shape (repeated tags become lists; *Model tags are always lists). 28-Oct-2026
function xmlToJsonText(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('This is not a valid XML file');
  const conv = (el) => {
    const kids = Array.from(el.children);
    if (!kids.length) return (el.textContent || '').trim();
    const o = {};
    for (const k of kids) {
      const name = k.localName || k.nodeName;
      const v = conv(k);
      if (o[name] !== undefined) { if (!Array.isArray(o[name])) o[name] = [o[name]]; o[name].push(v); }
      else o[name] = /Model$|^invoices$|^items$/i.test(name) ? [v] : v;
    }
    return o;
  };
  return JSON.stringify(conv(doc.documentElement));
}

export default function ImportFileModal({ type, onImport, onClose, initialTab }) {
  const [activeTab, setActiveTab]   = useState((initialTab === 'xml' || initialTab === 'flat') ? 'file' : (initialTab || 'json'));
  const [jsonText, setJsonText]     = useState('');
  const [flatText, setFlatText]     = useState('');
  const [dragOver, setDragOver]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [preview, setPreview]       = useState(null);
  const [error, setError]           = useState('');
  const fileInputRef = useRef();
  const isbe = type === 'be';
  // "Read Flat File" / "Read XML" of the job list open the upload tab for that kind of file. 28-Oct-2026
  const pick = initialTab === 'xml' || initialTab === 'flat' ? initialTab : null;
  const acceptExt = pick === 'xml' ? '.xml,.json' : pick === 'flat' ? '.be,.sb,.txt' : '.json,.xml,.be,.sb,.txt';

  const endpoint = isbe ? '/api/import-jobs/import-json-direct' : '/api/import-file/sb';
  const dataKey  = isbe ? 'jobData' : 'exportData';

  async function handleParse(text, format, dupOk) {
    if (!text?.trim()) { setError('Please paste a file or JSON first'); return; }
    setLoading(true); setError(''); setPreview(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonText: text, format, ...(dupOk ? { _dupOk: true } : {}) }),
      });
      const data = await res.json();
      // 16-Nov-2026: the file repeats the invoice / HAWB of a job that is already there (e.g. the same file uploaded
      // twice, or a job loaded from iCAFFE) - ask before a second job is made
      if (!data.success && data.duplicate && isbe) {
        setLoading(false);
        if (window.confirm((data.error || 'This shipment is already on another job.') + '\n\nMake a new draft job from this file anyway?')) return await handleParse(text, format, true);
        setError('Not imported - this shipment is already on job ' + ((data.matches || []).map(m => m.jobNo).filter(Boolean).join(', ') || 'another job') + '. Open that job from 1. Job Query.');
        return;
      }
      if (data.success) {
          toast.success(data.message || 'Successfully saved direct to DB! Job No: ' + (data.data ? data.data.jobNo : ''));
          if (data.data && data.data.id) {
              onImport({ directSavedJobId: data.data.id });
          } else {
              onImport(data);
          }
          onClose();
      } else {
        setError(data.error || 'Parse failed');
      }
    } catch (e) {
      setError('Network error: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(file) {
    if (!file) return;
    setLoading(true); setError(''); setPreview(null);
    let text = await file.text();
    const ext  = file.name.toLowerCase();
    if (ext.endsWith('.xml') || /^\s*<\?xml|^\s*<[A-Za-z]/.test(text)) {
      try { text = xmlToJsonText(text); } catch (e) { setLoading(false); setError(e.message); return; }
    }
    const format = (ext.endsWith('.be') || ext.endsWith('.sb') || ext.endsWith('.txt')) && !text.trim().startsWith('{') ? 'flat' : 'json';
    if (format === 'flat') setFlatText(text); else setJsonText(text);
    handleParse(text, format);
  }

  function handleApply() {
    if (!preview) return;
    onImport({
      [dataKey]: preview[dataKey] || {},
      invoices:       preview.invoices || [],
      items:          preview.items    || [],
      duties:         preview.duties   || [],
      exchangeRates:  preview.exchangeRates || [],
      infoTypes:      preview.infoTypes || [],
      statements:     preview.statements || [],
      format:         preview.detectedFormat,
    });
    onClose();
  }

  const previewFields = preview ? Object.entries(preview[dataKey] || {}) : [];
  const fmtLabel = { CACHI01: '✅ ICEGATE CACHI01', CACHE01: '✅ ICEGATE CACHE01', BE_GENERIC: '🔄 Generic BE JSON', SB_GENERIC: '🔄 Generic SB JSON', FLAT_FILE_BE: '📄 Flat File (BE)', FLAT_FILE_SB: '📄 Flat File (SB)', UNKNOWN: '❓ Unknown' };

  const sampleJson = isbe
    ? JSON.stringify({ importerName: 'TATA MOTORS LTD', iecCode: '0301234567', address1: '123 Main Road', city: 'Mumbai', state: 'Maharashtra', pin: '400001', igmNo: 'NSA0012345', blNo: 'MAEU1234567', countryOfOrigin: 'CN', portOfShipment: 'SGSIN', invoices: [{ invoiceNo: 'INV-001', invoiceDate: '2026-08-01', currency: 'USD', value: 50000 }], items: [{ hsnCode: '84073200', description: 'AUTO PARTS', quantity: 100, unit: 'NOS', assessableValue: 50000 }] }, null, 2)
    : JSON.stringify({ shipperName: 'TATA EXPORTS LTD', iecCode: '0300123456', address1: '456 Export Zone', city: 'Mumbai', shipmentMode: 'SEA', countryOfDestination: 'US', portOfDestination: 'USLAX', portOfLoading: 'INNSAV1', vesselOrFlightNo: 'MAERSK-001', invoices: [{ invoiceNo: 'EXP-001', invoiceDate: '2026-08-01', currency: 'USD', value: 25000 }], items: [{ hsnCode: '62041900', description: 'GARMENTS', quantity: 500, unit: 'PCS', fobValue: 25000 }] }, null, 2);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '10px', width: '1100px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-app, var(--bg-app, #f8fafc))', borderRadius: '10px 10px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderOpen size={18} color="var(--primary-text, #0284c7)" />
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main, var(--text-main, #0f172a))' }}>
              Import {isbe ? 'BE' : 'SB'} Data from ERP File
            </span>
            <span style={{ fontSize: '11px', background: '#dbeafe', color: 'var(--primary-color-end, #1d4ed8)', padding: '2px 8px', borderRadius: '10px', fontWeight: 500 }}>
              {pick === 'xml' ? 'XML' : pick === 'flat' ? 'Flat File (.be)' : 'JSON / XML / Flat File'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, var(--text-muted, #64748b))' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* LEFT — Input Panel */}
          <div style={{ width: '350px', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-app, var(--bg-app, #f8fafc))' }}>
              {[['json', '{ } JSON Paste'], ['file', '📂 File Upload'], ['flat', '📄 Flat File']].map(([t, label]) => (
                <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '8px 16px', fontSize: '11px', fontWeight: activeTab === t ? 700 : 500, color: activeTab === t ? 'var(--primary-text, #0284c7)' : 'var(--text-muted, var(--text-muted, #64748b))', borderBottom: activeTab === t ? '2px solid #0284c7' : '2px solid transparent', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, padding: '14px', overflowY: 'auto' }}>
              {/* JSON Tab */}
              {activeTab === 'json' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 600 }}>Paste JSON (from any ERP)</span>
                    <button onClick={() => setJsonText(sampleJson)} style={{ fontSize: '10px', background: 'var(--bg-input, var(--bg-input, #f1f5f9))', border: '1px solid var(--border-color, #cbd5e1)', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-muted, var(--text-muted, #475569))' }}>
                      Sample Load
                    </button>
                  </div>
                  <textarea
                    value={jsonText}
                    onChange={e => { setJsonText(e.target.value); setPreview(null); setError(''); }}
                    placeholder={'{\n  "importerName": "...",\n  "iecCode": "...",\n  "invoices": [...],\n  "items": [...]\n}'}
                    style={{ flex: 1, minHeight: '300px', fontFamily: 'monospace', fontSize: '11px', padding: '10px', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '6px', resize: 'none', color: 'var(--text-main, var(--text-main, #1e293b))', background: '#fafafa' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleParse(jsonText, 'json')}
                      disabled={loading || !jsonText.trim()}
                      style={{ flex: 1, padding: '8px', background: loading ? '#94a3b8' : 'var(--primary-text, #0284c7)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                    >
                      {loading ? 'Parsing...' : '🔍 Parse JSON'}
                    </button>
                    <button onClick={async () => { const t = await navigator.clipboard.readText(); setJsonText(t); }} style={{ padding: '8px 12px', background: 'var(--bg-input, var(--bg-input, #f1f5f9))', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-muted, var(--text-muted, #475569))' }}>
                      <Clipboard size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* File Upload Tab */}
              {activeTab === 'file' && (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files[0]); }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: `2px dashed ${dragOver ? 'var(--primary-text, #0284c7)' : 'var(--border-color, var(--border-color, #cbd5e1))'}`, borderRadius: '10px', padding: '40px', textAlign: 'center', cursor: 'pointer', background: dragOver ? '#eff6ff' : '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', minHeight: '250px', justifyContent: 'center' }}
                >
                  <input ref={fileInputRef} type="file" accept={acceptExt} style={{ display: 'none' }} onChange={e => { handleFileUpload(e.target.files[0]); e.target.value = null; }} />
                  <Upload size={36} color={dragOver ? 'var(--primary-text, #0284c7)' : '#94a3b8'} />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main, var(--text-main, #0f172a))', marginBottom: '4px' }}>Drag a file here or click to browse</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>
                      {pick === 'xml' ? 'BE in XML (CACHI01 tags) - sample: Job Query > Download Sample > BE XML'
                        : pick === 'flat' ? 'ICEGATE ICES 1.5 BE flat file (.be) - sample: Job Query > Download Sample > BE Flat File'
                        : 'Supported: .json, .xml, .be, .sb, .txt (max 5MB)'}
                    </div>
                  </div>
                  {loading && <div style={{ fontSize: '12px', color: 'var(--primary-text, #0284c7)', fontWeight: 600 }}>Parsing...</div>}
                </div>
              )}

              {/* Flat File Tab */}
              {activeTab === 'flat' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 600 }}>
                    Paste an ICEGATE ICES 1.5 flat file (.be): fields separated by the GS character (ASCII 29), sections &lt;TABLE&gt;BE / INVOICE / ITEMS
                  </span>
                  <div style={{ fontSize: '10px', background: '#f0fdf4', border: '1px solid #000000', borderRadius: '6px', padding: '8px', color: '#166534', fontFamily: 'monospace' }}>
                    Layout (␝ = GS):<br />
                    HREC␝ZZ␝&lt;sender&gt;␝ZZ␝INDEL4␝ICES1_5␝P␝␝CACHI01␝&lt;seq&gt;␝&lt;yyyymmdd&gt;<br />
                    &lt;TABLE&gt;BE<br />
                    F␝␝&lt;job no&gt;␝&lt;job date&gt;␝␝␝H␝&lt;IEC&gt;␝&lt;branch&gt;␝&lt;importer&gt;␝...<br />
                    &lt;TABLE&gt;INVOICE ... &lt;TABLE&gt;ITEMS ...<br />
                    TREC␝&lt;seq&gt;<br />
                    Easiest: upload the .be file in File Upload (sample: Job Query &gt; Download Sample &gt; BE Flat File).
                  </div>
                  <textarea
                    value={flatText}
                    onChange={e => { setFlatText(e.target.value); setPreview(null); setError(''); }}
                    placeholder="Paste the flat file content here..."
                    style={{ flex: 1, minHeight: '200px', fontFamily: 'monospace', fontSize: '11px', padding: '10px', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '6px', resize: 'none', color: 'var(--text-main, var(--text-main, #1e293b))', background: '#fafafa' }}
                  />
                  <button
                    onClick={() => handleParse(flatText, 'flat')}
                    disabled={loading || !flatText.trim()}
                    style={{ padding: '8px', background: loading ? '#94a3b8' : 'var(--primary-text, #0284c7)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                  >
                    {loading ? 'Parsing...' : '🔍 Parse Flat File'}
                  </button>
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{ marginTop: '10px', background: '#fef2f2', border: '1px solid #dc2626', borderRadius: '6px', padding: '10px', fontSize: '11px', color: '#991b1b', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <AlertCircle size={14} /> {error}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Preview Panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-app, var(--bg-app, #f8fafc))', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color, #e2e8f0)', fontWeight: 700, fontSize: '12px', color: 'var(--text-main, var(--text-main, #0f172a))', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={14} color="var(--primary-text, #0284c7)" /> Parsed Fields Preview
            </div>

            {!preview && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                Parse JSON or upload a file � fields will appear here
              </div>
            )}

            {preview && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                {/* Format Badge */}
                <div style={{ marginBottom: '10px', padding: '6px 10px', background: '#dbeafe', borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--primary-color-end, #1d4ed8)' }}>
                  {fmtLabel[preview.detectedFormat] || preview.detectedFormat}
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #000000', borderRadius: '6px', padding: '6px', textAlign: 'center', fontSize: '11px' }}>
                    <div style={{ fontWeight: 700, color: '#166534', fontSize: '16px' }}>{previewFields.length}</div>
                    <div style={{ color: '#166534' }}>Fields</div>
                  </div>
                  <div style={{ flex: 1, background: '#eff6ff', border: '1px solid #000000', borderRadius: '6px', padding: '6px', textAlign: 'center', fontSize: '11px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--primary-color-end, #1d4ed8)', fontSize: '16px' }}>{(preview.invoices || []).length}</div>
                    <div style={{ color: 'var(--primary-color-end, #1d4ed8)' }}>Invoices</div>
                  </div>
                  <div style={{ flex: 1, background: '#faf5ff', border: '1px solid #000000', borderRadius: '6px', padding: '6px', textAlign: 'center', fontSize: '11px' }}>
                    <div style={{ fontWeight: 700, color: '#7c3aed', fontSize: '16px' }}>{(preview.items || []).length}</div>
                    <div style={{ color: '#7c3aed' }}>Items</div>
                  </div>
                </div>

                {/* Fields List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {previewFields.map(([key, val]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#fff', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '4px', fontSize: '11px' }}>
                      <CheckCircle size={11} color="#16a34a" style={{ flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-muted, var(--text-muted, #64748b))', minWidth: '90px', fontFamily: 'monospace' }}>{key}</span>
                      <span style={{ color: 'var(--text-main, var(--text-main, #0f172a))', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{String(val)}</span>
                    </div>
                  ))}
                  {(preview.invoices || []).length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ padding: '6px 10px', background: '#eff6ff', border: '1px solid #000000', borderRadius: '6px 6px 0 0', fontSize: '11px', color: 'var(--primary-color-end, #1d4ed8)', fontWeight: 700 }}>
                        📋 {preview.invoices.length} INVOICE(S)
                      </div>
                      <div style={{ border: '1px solid #000000', borderTop: 'none', borderRadius: '0 0 6px 6px', maxHeight: '150px', overflowY: 'auto', background: '#fff' }}>
                        <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                          <thead style={{ background: 'var(--bg-app, var(--bg-app, #f8fafc))', color: 'var(--text-muted, var(--text-muted, #64748b))', position: 'sticky', top: 0 }}>
                            <tr>
                              <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>No</th>
                              <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>Date</th>
                              <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>Terms</th>
                              <th style={{ padding: '6px', textAlign: 'right', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>Value</th>
                              <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>Cur</th>
                              <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>Supplier/Buyer</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.invoices.map((inv, idx) => (
                              <tr key={idx}>
                                <td style={{ padding: '6px', borderBottom: '1px solid var(--bg-input, #f1f5f9)', fontWeight: 500 }}>{inv.invoiceNo}</td>
                                <td style={{ padding: '6px', borderBottom: '1px solid var(--bg-input, #f1f5f9)' }}>{inv.invoiceDate}</td>
                                <td style={{ padding: '6px', borderBottom: '1px solid var(--bg-input, #f1f5f9)' }}>{inv.terms || inv.termsOfInvoice || '-'}</td>
                                <td style={{ padding: '6px', borderBottom: '1px solid var(--bg-input, #f1f5f9)', textAlign: 'right' }}>{inv.invoiceValue || inv.value}</td>
                                <td style={{ padding: '6px', borderBottom: '1px solid var(--bg-input, #f1f5f9)' }}>{inv.currency}</td>
                                <td style={{ padding: '6px', borderBottom: '1px solid var(--bg-input, #f1f5f9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px' }} title={inv.supplierName || inv.buyerName}>{inv.supplierName || inv.buyerName || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {(preview.items || []).length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ padding: '6px 10px', background: '#faf5ff', border: '1px solid #000000', borderRadius: '6px 6px 0 0', fontSize: '11px', color: '#7c3aed', fontWeight: 700 }}>
                        📦 {preview.items.length} ITEM(S)
                      </div>
                      <div style={{ border: '1px solid #000000', borderTop: 'none', borderRadius: '0 0 6px 6px', maxHeight: '200px', overflowY: 'auto', background: '#fff' }}>
                        <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                          <thead style={{ background: 'var(--bg-app, var(--bg-app, #f8fafc))', color: 'var(--text-muted, var(--text-muted, #64748b))', position: 'sticky', top: 0 }}>
                            <tr>
                              <th style={{ width: '15%', padding: '6px', textAlign: 'center', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>Inv#</th>
                              <th style={{ width: '25%', padding: '6px', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>RITC</th>
                              <th style={{ width: '30%', padding: '6px', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>Desc</th>
                              <th style={{ width: '20%', padding: '6px', textAlign: 'right', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>Qty / UQC</th>
                              <th style={{ width: '25%', padding: '6px', textAlign: 'right', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>Value (INR)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.items.map((it, idx) => (
                              <tr key={idx}>
                                <td style={{ padding: '6px', borderBottom: '1px solid var(--bg-input, #f1f5f9)', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{it.invoiceSrNo || 1}</td>
                                <td style={{ padding: '6px', borderBottom: '1px solid var(--bg-input, #f1f5f9)', fontFamily: 'monospace', fontWeight: 600 }}>{it.hsnCode || it.ritc}</td>
                                <td style={{ padding: '6px', borderBottom: '1px solid var(--bg-input, #f1f5f9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={it.description}>{it.description}</td>
                                <td style={{ padding: '6px', borderBottom: '1px solid var(--bg-input, #f1f5f9)', textAlign: 'right' }}>{it.quantity} {it.unit || it.uqc}</td>
                                <td style={{ padding: '6px', borderBottom: '1px solid var(--bg-input, #f1f5f9)', textAlign: 'right', fontWeight: 500, color: 'var(--text-main, var(--text-main, #0f172a))' }}>{it.assessableValue || it.fobValue || it.value || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Apply Button */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
              <button
                onClick={handleApply}
                disabled={!preview}
                style={{ width: '100%', padding: '10px', background: preview ? '#16a34a' : 'var(--border-color, var(--border-color, #cbd5e1))', color: '#fff', border: 'none', borderRadius: '6px', cursor: preview ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <CheckCircle size={15} /> Apply to Form
              </button>
              {preview && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))', textAlign: 'center', marginTop: '4px' }}>
                  These fields will be merged into the form
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
