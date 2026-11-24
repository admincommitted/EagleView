import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { askDelete } from './switchRow';

export default function KYCVaultModal({ party, onClose }) {
  const [docs, setDocs] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [docType, setDocType] = useState('PAN CARD');

  useEffect(() => {
    fetchDocs();
  }, [party.id]);

  const fetchDocs = async () => {
    try {
      const res = await axios.get(`/api/masters/party/${party.id}/kyc`);
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

    try {
      await axios.post(`/api/masters/party/${party.id}/kyc`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchDocs();
    } catch (err) {
      alert('Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!(await askDelete('Delete this document?'))) return;
    try {
      await axios.delete(`/api/masters/party/kyc/${docId}`);
      fetchDocs();
    } catch (err) {
      alert('Failed to delete');
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal-box"
        style={{ width: '60vw', minHeight: '50vh', backgroundColor: 'var(--bg-app, #f8fafc)', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
      >
        {/* Header */}
        <div style={{ backgroundColor: 'var(--text-main, #0f172a)', color: '#fff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔐</span> KYC Document Vault ({party.name})
          </div>
          <button
            onClick={onClose}
            title="Close"
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: '16px', cursor: 'pointer', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s ease' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Upload Row */}
          <div style={{ display: 'flex', gap: '16px', backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            {/* Doc Type Select */}
            <div style={{ flex: 1 }}>
              <label className="required-label" style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, #475569)', marginBottom: '8px' }}>
                Select Document Type
              </label>
              <select
                value={docType}
                onChange={e => setDocType(e.target.value)}
                className="input-field"
                style={{ width: '100%' }}
              >
                <option value="PAN CARD">PAN CARD</option>
                <option value="GST CERTIFICATE">GST CERTIFICATE</option>
                <option value="AADHAR CARD">AADHAR CARD</option>
                <option value="IEC CERTIFICATE">IEC CERTIFICATE</option>
                <option value="AD CODE LETTER">AD CODE LETTER</option>
                <option value="INCORPORATION CERTIFICATE">INCORPORATION CERTIFICATE</option>
                <option value="CANCELLED CHEQUE">CANCELLED CHEQUE</option>
                <option value="BOARD RESOLUTION">BOARD RESOLUTION</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>

            {/* Upload Zone */}
            <label className={`upload-zone${isUploading ? ' uploading' : ''}`}>
              <div className="upload-zone-title">
                {isUploading
                  ? <><span className="upload-spinner"></span>Uploading...</>
                  : '📂 Click to Browse & Upload Files'
                }
              </div>
              <div className="upload-zone-subtitle">Uploading as: {docType}</div>
              <input type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} disabled={isUploading} />
            </label>
          </div>

          {/* Documents Table */}
          <div style={{ flex: 1, backgroundColor: '#fff', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', overflow: 'hidden' }}>
            {/* Table Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', padding: '10px 16px', backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border-color, #e2e8f0)', fontWeight: 'bold', fontSize: '12px', color: '#334155' }}>
              <div>FILE NAME</div>
              <div>DOCUMENT TYPE</div>
              <div>STATUS</div>
              <div>DATE</div>
              <div style={{ textAlign: 'right' }}>ACTION</div>
            </div>

            {/* Table Rows */}
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {docs.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>
                  No KYC documents found for this party.
                </div>
              ) : (
                docs.map(doc => (
                  <div
                    key={doc.id}
                    style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', padding: '10px 16px', borderBottom: '1px solid #f1f5f9', fontSize: '12px', alignItems: 'center', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ color: '#2563eb', fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      <a href={`${doc.filePath}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                        📄 {doc.originalName}
                      </a>
                    </div>
                    <div>
                      <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                        {doc.documentType || 'OTHER'}
                      </span>
                    </div>
                    <div>
                      {doc.docStatus === 'APPROVED' && <span className="status-badge approved">✅ APPROVED</span>}
                      {doc.docStatus === 'REJECTED' && <span className="status-badge rejected">❌ REJECTED</span>}
                      {(!doc.docStatus || doc.docStatus === 'PENDING') && <span className="status-badge pending">⏳ PENDING</span>}
                    </div>
                    <div style={{ color: '#64748b' }}>{new Date(doc.createdAt).toLocaleDateString('en-GB')}</div>
                    <div style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        style={{ background: 'linear-gradient(to right, #ef4444, #dc2626)', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '600', transition: 'opacity 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                      >🗑 Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
