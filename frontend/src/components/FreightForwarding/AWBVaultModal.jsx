import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function AWBVaultModal({ awbId, awbType, tempAwbId, awbNumber, onClose, onAutoFill, onRequestAddParty }) {
  const [docs, setDocs] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(null);
  const [extractedDataPreview, setExtractedDataPreview] = useState(null);
  const [mdmStatus, setMdmStatus] = useState(null);
  const [deleteConfirmDocId, setDeleteConfirmDocId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [docType, setDocType] = useState('COMMERCIAL INVOICE');

  useEffect(() => {
    fetchDocs();
  }, [awbId, tempAwbId]);

  const fetchDocs = async () => {
    try {
      // with the AWB type: AWB / MAWB and HAWB records share id numbers (29-Oct-2026)
      const url = `/api/awb/docs/${tempAwbId}?awbId=${awbId || ''}&awbType=${awbType || ''}`;
      const res = await axios.get(url);
      setDocs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('docs', files[i]);
    }
    formData.append('documentType', docType);
    if (awbId) formData.append('awbId', awbId);
    if (awbType) formData.append('awbType', awbType);

    const big = [...files].find(f => f.size > 15 * 1024 * 1024);
    if (big) { setErrorMsg(`${big.name} is larger than 15 MB.`); setIsUploading(false); if (e.target) e.target.value = null; return; }
    try {
      await axios.post(`/api/awb/docs/${tempAwbId}`, formData);
      setErrorMsg('');
      fetchDocs();
    } catch (err) {
      setErrorMsg('Upload Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = null;
    }
  };


  const handleExtractData = async (docId) => {
    try {
      setIsExtracting(docId);
      const res = await axios.post(`/api/awb/docs/extract/${docId}`);
      if (res.data.success && onAutoFill) {
        setExtractedDataPreview(res.data.data);
        setMdmStatus(res.data.mdmStatus || null);
      } else if (!res.data.success) {
        // 29-Oct-2026: a failed read showed nothing at all
        setErrorMsg('Could not read this document: ' + (res.data.error || res.data.message || 'no data found'));
      }
    } catch (err) {
      setErrorMsg('Failed to extract data: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsExtracting(null);
    }
  };

  const handleDelete = (docId) => {
    setDeleteConfirmDocId(docId);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmDocId) return;
    try {
      await axios.delete(`/api/awb/docs/${deleteConfirmDocId}`);
      fetchDocs();
    } catch (err) {
      setErrorMsg('Failed to delete document: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeleteConfirmDocId(null);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
      <div style={{ width: '60vw', minWidth: 'min(640px, calc(100vw - 24px))', maxWidth: 'calc(100vw - 24px)', minHeight: '50vh', backgroundColor: 'var(--bg-app, var(--bg-app, #f8fafc))', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        <div style={{ backgroundColor: 'var(--primary-text, #0284c7)', color: '#fff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🗂️</span> Digital Pouch {/^\d{11}$/.test(String(awbNumber || '')) ? `(AWB: ${String(awbNumber).slice(0, 3)}-${String(awbNumber).slice(3)})` : /^HAWB /.test(String(awbNumber || '')) ? `(${awbNumber})` : '(Draft AWB)'}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' }}>✖</button>
        </div>
        
        <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMsg && (
            <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '6px', fontSize: '13px', fontWeight: '500', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>❌ {errorMsg}</span>
              <button onClick={() => setErrorMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontWeight: 'bold' }}>✖</button>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '16px', backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '8px' }}>Select Document Type</label>
              <select value={docType} onChange={e => setDocType(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color, #cbd5e1)', fontSize: '13px', outline: 'none' }}>
                <option value="COMMERCIAL INVOICE">COMMERCIAL INVOICE</option>
                <option value="PACKING LIST">PACKING LIST</option>
                <option value="CERTIFICATE OF ORIGIN">CERTIFICATE OF ORIGIN</option>
                <option value="LETTER OF CREDIT">LETTER OF CREDIT</option>
                <option value="SHIPPERS DECLARATION">SHIPPERS DECLARATION (DGD)</option>
                <option value="PHYTO CERTIFICATE">PHYTO CERTIFICATE</option>
                <option value="MSDS">MSDS (MATERIAL SAFETY)</option>
                <option value="OTHER">OTHER / MISC</option>
              </select>
            </div>
            
            <label style={{ flex: 2, border: '2px dashed #94a3b8', borderRadius: '4px', padding: '12px', textAlign: 'center', backgroundColor: 'var(--bg-app, var(--bg-app, #f8fafc))', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155' }}>{isUploading ? 'Uploading...' : 'Click to Browse & Upload Files'}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Uploading as: {docType} · PDF, pictures, Word, Excel, CSV, text, e-mail · up to 15 MB, 10 files</div>
              <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.gif,.bmp,.doc,.docx,.xls,.xlsx,.csv,.txt,.msg,.eml" style={{ display: 'none' }} onChange={handleFileUpload} disabled={isUploading} />
            </label>
          </div>
          
          <div style={{ flex: 1, backgroundColor: '#fff', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', padding: '10px 16px', backgroundColor: 'var(--bg-input, var(--bg-input, #f1f5f9))', borderBottom: '1px solid var(--border-color, #e2e8f0)', fontWeight: 'bold', fontSize: '12px' }}>
              <div>FILE NAME</div>
              <div>DOCUMENT TYPE</div>
              <div>DATE</div>
              <div style={{ textAlign: 'right' }}>ACTION</div>
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {docs.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>No E-Docs found in this Pouch.</div>
              ) : (
                docs.map(doc => (
                  <div key={doc.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', padding: '10px 16px', borderBottom: '1px solid var(--border-color, #cbd5e1)', fontSize: '12px', alignItems: 'center' }}>
                    <div style={{ color: 'var(--primary-color-end, #2563eb)', fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      <a href={`${doc.filePath}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>{doc.originalName}</a>
                    </div>
                    <div><span style={{backgroundColor: '#e0f2fe', color: 'var(--primary-text, #0369a1)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold'}}>{doc.documentType || 'OTHER'}</span></div>
                    <div>{new Date(doc.createdAt).toLocaleDateString('en-GB')}</div>
                                        <div style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button onClick={() => handleExtractData(doc.id)} disabled={isExtracting === doc.id} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: isExtracting === doc.id ? 'not-allowed' : 'pointer', fontSize: '11px', whiteSpace: 'nowrap', opacity: isExtracting === doc.id ? 0.7 : 1 }}>
                        {isExtracting === doc.id ? 'EXTRACTING...' : '⚡ Auto-Fill'}
                      </button>
                      <button onClick={() => handleDelete(doc.id)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
      </div>

      {extractedDataPreview && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000000, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '24px', width: '700px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '20px' }} aria-hidden="true">⚡</span>
              <h3 style={{ margin: 0, color: 'var(--text-main, var(--text-main, #1e293b))' }}>AI Extracted Data Preview</h3>
            </div>
            
            {mdmStatus && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                <div style={{ backgroundColor: 'var(--bg-input, var(--bg-input, #f1f5f9))', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#334155' }}>MDM Party Validation</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Shipper */}
                    {extractedDataPreview?.shipperName && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <div>
                           <span style={{ fontWeight: 'bold' }}>Shipper:</span> {extractedDataPreview.shipperName}
                        </div>
                        {mdmStatus.shipperExists ? (
                           mdmStatus.shipperAddressMatch ? 
                             <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓ Verified in Master</span> 
                           : <span style={{ color: '#d97706', fontWeight: 'bold' }} title={`DB: ${mdmStatus.dbShipperAddress}`}>⚠ Address Mismatch</span>
                        ) : (
                           <button onClick={() => { onRequestAddParty && onRequestAddParty('Shipper', { name: extractedDataPreview.shipperName, address: extractedDataPreview.shipperAddress, city: extractedDataPreview.shipperCity, state: extractedDataPreview.shipperState, country: extractedDataPreview.shipperCountry, zip: extractedDataPreview.shipperZip }); }} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>[+] ADD TO MASTER</button>
                        )}
                      </div>
                    )}
                    {/* Consignee */}
                    {extractedDataPreview?.consigneeName && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <div>
                           <span style={{ fontWeight: 'bold' }}>Consignee:</span> {extractedDataPreview.consigneeName}
                        </div>
                        {mdmStatus.consigneeExists ? (
                           mdmStatus.consigneeAddressMatch ? 
                             <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓ Verified in Master</span> 
                           : <span style={{ color: '#d97706', fontWeight: 'bold' }} title={`DB: ${mdmStatus.dbConsigneeAddress}`}>⚠ Address Mismatch</span>
                        ) : (
                           <button onClick={() => { onRequestAddParty && onRequestAddParty('Consignee', { name: extractedDataPreview.consigneeName, address: extractedDataPreview.consigneeAddress, city: extractedDataPreview.consigneeCity, state: extractedDataPreview.consigneeState, country: extractedDataPreview.consigneeCountry, zip: extractedDataPreview.consigneeZip }); }} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>[+] ADD TO MASTER</button>
                        )}
                      </div>
                    )}
                    {/* Buyer */}
                    {extractedDataPreview?.buyerName && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginTop: '4px' }}>
                        <div>
                           <span style={{ fontWeight: 'bold' }}>Buyer:</span> {extractedDataPreview.buyerName}
                        </div>
                        {mdmStatus.buyerExists ? (
                           mdmStatus.buyerAddressMatch ? 
                             <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓ Verified in Master</span> 
                           : <span style={{ color: '#d97706', fontWeight: 'bold' }} title={`DB: ${mdmStatus.dbBuyerAddress}`}>⚠ Address Mismatch</span>
                        ) : (
                           <button onClick={() => { onRequestAddParty && onRequestAddParty('Buyer', { name: extractedDataPreview.buyerName, address: extractedDataPreview.buyerAddress, city: extractedDataPreview.buyerCity, state: extractedDataPreview.buyerState, country: extractedDataPreview.buyerCountry, zip: extractedDataPreview.buyerZip }); }} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>[+] ADD TO MASTER</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div style={{ backgroundColor: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '16px', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--border-color, #e2e8f0)', maxHeight: '450px', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

              {Object.keys(extractedDataPreview).map(key => {
                if (key === 'dimensions' && Array.isArray(extractedDataPreview[key])) {
                  return (
                    <div key={key} style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '4px' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #64748b))', textTransform: 'uppercase', fontSize: '10px', display: 'block', marginBottom: '4px' }}>DIMENSIONS (L x W x H)</span>
                      {extractedDataPreview[key].length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '4px' }}>
                          <thead>
                            <tr style={{ backgroundColor: 'var(--bg-input, var(--bg-input, #f1f5f9))', color: 'var(--text-muted, var(--text-muted, #475569))', textAlign: 'left' }}>
                              <th style={{ padding: '4px 8px', border: '1px solid var(--border-color, #cbd5e1)' }}>Pieces</th>
                              <th style={{ padding: '4px 8px', border: '1px solid var(--border-color, #cbd5e1)' }}>Length</th>
                              <th style={{ padding: '4px 8px', border: '1px solid var(--border-color, #cbd5e1)' }}>Width</th>
                              <th style={{ padding: '4px 8px', border: '1px solid var(--border-color, #cbd5e1)' }}>Height</th>
                              <th style={{ padding: '4px 8px', border: '1px solid var(--border-color, #cbd5e1)' }}>Unit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {extractedDataPreview[key].map((d, i) => (
                              <tr key={i}>
                                <td style={{ padding: '4px 8px', border: '1px solid var(--border-color, #cbd5e1)' }}>{d.pieces}</td>
                                <td style={{ padding: '4px 8px', border: '1px solid var(--border-color, #cbd5e1)' }}>{d.length}</td>
                                <td style={{ padding: '4px 8px', border: '1px solid var(--border-color, #cbd5e1)' }}>{d.width}</td>
                                <td style={{ padding: '4px 8px', border: '1px solid var(--border-color, #cbd5e1)' }}>{d.height}</td>
                                <td style={{ padding: '4px 8px', border: '1px solid var(--border-color, #cbd5e1)' }}>{d.unit}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : <span style={{ color: '#94a3b8', fontSize: '12px' }}>No Dimensions Found</span>}
                    </div>
                  );
                }
                return (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '4px', gridColumn: (key.includes('Address') || key === 'commodityDescription' || key === 'marksAndNumbers') ? '1 / -1' : 'auto' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #64748b))', textTransform: 'uppercase', fontSize: '10px' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span style={{ color: extractedDataPreview[key] ? 'var(--text-main, var(--text-main, #0f172a))' : '#94a3b8', fontWeight: '500', fontSize: '13px', wordBreak: 'break-word' }}>{extractedDataPreview[key] || 'Not Found'}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setExtractedDataPreview(null)} style={{ padding: '8px 16px', background: 'var(--bg-input, var(--bg-input, #f1f5f9))', color: 'var(--text-muted, var(--text-muted, #475569))', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
              <button onClick={() => { onAutoFill(extractedDataPreview); setExtractedDataPreview(null); }} style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(16,185,129,0.3)' }}>Apply to Form</button>
            </div>
          </div>
        </div>
      )}


      {deleteConfirmDocId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000001, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '24px', width: '350px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, color: '#e11d48', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }} aria-hidden="true">⚠</span> Delete Document
            </h3>
            <p style={{ color: '#334155', fontSize: '13px', margin: '16px 0' }}>Are you sure you want to permanently delete this document? This action cannot be undone.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setDeleteConfirmDocId(null)} style={{ padding: '8px 16px', background: 'var(--bg-input, var(--bg-input, #f1f5f9))', color: 'var(--text-muted, var(--text-muted, #475569))', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
              <button onClick={confirmDelete} style={{ padding: '8px 16px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(225,29,72,0.3)' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
