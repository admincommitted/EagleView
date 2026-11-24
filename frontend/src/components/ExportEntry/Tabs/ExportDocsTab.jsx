import React, { useState } from 'react';
import { Plus, Trash2, Search, Link as LinkIcon, Upload, X, Edit, Copy, Save } from 'lucide-react';
import { useExportContext } from '../ExportContext';
import ModernDatePicker from '../../common/ModernDatePicker'; // 21-Nov-2026: DD-MM-YYYY date box (same YYYY-MM-DD value)
import { signPdf } from '../../../utils/dscSigner';

export default function ExportDocsTab() {
  const [defaultIcegateId, setDefaultIcegateId] = React.useState('');
  React.useEffect(() => {
    fetch('/api/icegate-profiles')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data && json.data.length > 0) {
           const def = json.data.find(p => p.isDefault) || json.data[0];
           setDefaultIcegateId(def.loginId);
        }
      }).catch(e => console.log(e));
  }, []);

  const { docs, setDocs } = useExportContext();
  
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [checkedIds, setCheckedIds] = useState([]);

  // Mocking GridFeatures functions to work with standard state
  const toggleCheck = (id) => setCheckedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const checkAll = (e) => setCheckedIds(e.target.checked ? docs.map(d => d.id) : []);
  const deleteSelected = () => { setDocs(docs.filter(d => !checkedIds.includes(d.id))); setCheckedIds([]); };
  const duplicateRow = (id) => {
    const docToClone = docs.find(d => d.id === id);
    if (docToClone) setDocs([...docs, { ...docToClone, id: Date.now(), srNo: docs.length + 1 }]);
  };

  const [showModal, setShowModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);

  // New States for Upload Modal logic
  const [uploadFile, setUploadFile] = useState(null);
  const [tokenPin, setTokenPin] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);

  const openAddModal = () => {
    setEditingDoc({
      id: Date.now(), srNo: docs.length + 1, irn: '', drn: '', docCode: '', fileName: '',
      issuerCode: '', issuerName: '', issuerAddr1: '', issuerAddr2: '', issuerCity: '', issuerPin: '',
      beneCode: '', beneName: '', beneAddr1: '', beneAddr2: '', beneCity: '', benePin: '',
      placeOfIssue: '', issueDate: '', expiryDate: '',
      isDiffId: false, isApplicable: false, fileType: 'PDF', docFor: 'ITEM'
    });
    setShowModal(true);
  };

  const openEditModal = (doc) => {
    setEditingDoc({ ...doc });
    setShowModal(true);
  };

  const saveModalDoc = () => {
    if (docs.find(d => d.id === editingDoc.id)) {
      setDocs(docs.map(d => d.id === editingDoc.id ? editingDoc : d));
    } else {
      setDocs([...docs, editingDoc]);
    }
    setShowModal(false);
  };

  const handleSignAndUpload = async () => {
    if (!editingDoc.docCode) {
      alert("Please enter a Document Code first (e.g. 0010000).");
      return;
    }
    if (!uploadFile) {
      alert("Please select a file first.");
      return;
    }

    try {
      setIsUploading(true);

      // STEP 1: Sign the PDF using Local Signer
      // 30-Oct-2026: goes through the backend, which holds the one DSC signer URL setting, so the token can sit on
      // another machine. The signer (local_signer/app.py) still has to be running with the token plugged in.
      // 16-Nov-2026: EagleView Signer on this PC first (it asks the PIN itself if none is typed), else the server signer
      let signedBlob;
      try {
        signedBlob = (await signPdf(uploadFile, tokenPin, 'e-Sanchit document ' + (editingDoc.docCode || ''))).blob;
      } catch (fetchErr) {
        throw new Error(fetchErr.cancelled ? 'Signing cancelled in EagleView Signer.' : 'PDF signing: ' + fetchErr.message);
      }
      const signedFile = new File([signedBlob], `signed_${uploadFile.name}`, { type: 'application/pdf' });

      // STEP 2: Upload signed PDF to e-Sanchit via Node Backend
      const esanchitFormData = new FormData();
      esanchitFormData.append('pdf', signedFile);
      esanchitFormData.append('documentCode', editingDoc.docCode);
      esanchitFormData.append('profileId', 1);

      const uploadRes = await fetch('/api/icegate/upload-esanchit', { method: 'POST', body: esanchitFormData });
      const uploadData = await uploadRes.json();
      
      if (uploadData.success) {
        setEditingDoc(prev => ({ ...prev, irn: uploadData.irn, fileName: signedFile.name, fileUrl: uploadData.fileUrl }));
        alert(`Success! Generated IRN: ${uploadData.irn}`);
        setShowPinPrompt(false);
      } else {
        throw new Error(uploadData.error || "Upload failed");
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setIsUploading(false);
    }
  };


  const selectedDoc = docs.find(doc => doc.id === selectedRowId) || docs[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', position: 'relative' }}>
      
      {/* Grid View (Top Half) */}
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel, #ffffff)' }}>
          <h3 style={{ fontSize: '13px', color: 'var(--primary-color)', margin: 0 }}>
            Supporting Documents (e-Sanchit) {checkedIds.length > 0 && <span style={{ color: '#047857', marginLeft: '10px' }}>({checkedIds.length} selected)</span>}
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {checkedIds.length > 0 && (
              <button className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '11px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #ef4444' }} onClick={deleteSelected}>
                <Trash2 size={12} /> Delete Selected
              </button>
            )}
            <button className="btn btn-primary" style={{ padding: '0.25rem 0.75rem' }} onClick={openAddModal}>
              <Plus size={14} /> Add Document
            </button>
          </div>
        </div>

        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--primary-bg-light, #e0f2fe)' }}>
                <th style={{ width: '30px', textAlign: 'center' }}><input type="checkbox" onChange={checkAll} checked={docs.length > 0 && checkedIds.length === docs.length} /></th>
                <th style={{ width: '60px', textAlign: 'center' }}>Action</th>
                <th style={{ width: '50px' }}>Sr No</th>
                <th style={{ width: '100px' }}>Doc Code</th>
                <th style={{ width: '180px' }}>IRN Number</th>
                <th style={{ width: '180px' }}>File Name</th>
                <th style={{ width: '120px' }}>Issuer Name</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc, index) => (
                <tr key={doc.id} style={{ borderBottom: '1px solid var(--border-color)', background: selectedRowId === doc.id ? '#fefce8' : 'transparent' }} onClick={() => setSelectedRowId(doc.id)}>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" checked={checkedIds.includes(doc.id)} onChange={() => toggleCheck(doc.id)} /></td>
                  <td style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <Edit size={14} color="#0369a1" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); openEditModal(doc); }} />
                    <Copy size={14} color="#047857" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); duplicateRow(doc.id); }} />
                  </td>
                  <td style={{ textAlign: 'center' }}>{doc.srNo}</td>
                  <td>{doc.docCode}</td>
                  <td style={{ fontWeight: 600, color: 'var(--primary-color-start, #0ea5e9)' }}>{doc.irn} {doc.fileUrl && <a href={doc.fileUrl} target="_blank" rel="noreferrer" style={{marginLeft: '8px', fontSize: '10px', background: '#16a34a', color: 'white', padding: '3px 6px', borderRadius: '4px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px'}}>👁 View PDF</a>}</td>
                  <td>{doc.fileName}</td>
                  <td>{doc.issuerName}</td>
                </tr>
              ))}
              {docs.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'gray' }}>No documents added. Click "Add Document" to start.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODERN FORM SECTION (Bottom Half) --- */}
      {editingDoc && (
        <div style={{ flex: 1.5, background: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column', border: '1px solid var(--primary-border)', overflow: 'hidden', marginTop: '0.5rem' }}>
          
          {/* Sleek Header */}
          <div style={{ background: 'transparent', padding: '12px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: 'var(--bg-panel, #e0f2fe)', color: 'var(--text-muted, #64748b)', padding: '6px', borderRadius: '8px' }}>
                <LinkIcon size={16} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#0f172a', fontWeight: 'bold' }}>Supporting Document Configuration</h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Configure e-Sanchit properties and parties</span>
              </div>
            </div>
            {showModal && (
              <button onClick={() => {setShowModal(false); setEditingDoc(null);}} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', borderRadius: '50%', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#e2e8f0'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                <X size={18} />
              </button>
            )}
          </div>

          {/* Form Body - Scrollable */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
            
            {/* 1. Core Identification */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
              <ModernInput label="SR. NO" value={editingDoc.srNo} onChange={v => setEditingDoc({...editingDoc, srNo: v})} icon={<Search size={14}/>} />
              <ModernInput label="IRN NUMBER" value={editingDoc.irn} onChange={v => setEditingDoc({...editingDoc, irn: v})} />
              <ModernInput label="DRN NUMBER" value={editingDoc.drn} onChange={v => setEditingDoc({...editingDoc, drn: v})} />
              <ModernInput label="DOC. CODE" value={editingDoc.docCode} onChange={v => setEditingDoc({...editingDoc, docCode: v})} highlight={true} />
              <ModernInput label="FILE NAME" value={editingDoc.fileName} onChange={v => setEditingDoc({...editingDoc, fileName: v})} />
            </div>

            {/* 2. Party Details Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              
              {/* Issuing Party */}
              <div style={{ background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '10px', padding: '16px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '-10px', left: '16px', background: '#d97706', color: 'white', fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px', letterSpacing: '0.5px' }}>DOC ISSUING PARTY</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '1rem', marginTop: '8px' }}>
                  <ModernInput label="CODE" value={editingDoc.issuerCode} onChange={v => setEditingDoc({...editingDoc, issuerCode: v})} />
                  <ModernInput label="NAME" value={editingDoc.issuerName} onChange={v => setEditingDoc({...editingDoc, issuerName: v})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <ModernInput label="ADDRESS 1" value={editingDoc.issuerAddr1} onChange={v => setEditingDoc({...editingDoc, issuerAddr1: v})} />
                  <ModernInput label="ADDRESS 2" value={editingDoc.issuerAddr2} onChange={v => setEditingDoc({...editingDoc, issuerAddr2: v})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <ModernInput label="CITY" value={editingDoc.issuerCity} onChange={v => setEditingDoc({...editingDoc, issuerCity: v})} />
                  <ModernInput label="PIN CODE" value={editingDoc.issuerPin} onChange={v => setEditingDoc({...editingDoc, issuerPin: v})} />
                </div>
              </div>

              {/* Beneficiary Party */}
              <div style={{ background: 'transparent', border: '1px solid var(--primary-border)', borderRadius: '10px', padding: '16px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '-10px', left: '16px', background: 'var(--primary-color-start, #3b82f6)', color: 'white', fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px', letterSpacing: '0.5px' }}>BENEFICIARY PARTY</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '1rem', marginTop: '8px' }}>
                  <ModernInput label="CODE" value={editingDoc.beneCode} onChange={v => setEditingDoc({...editingDoc, beneCode: v})} />
                  <ModernInput label="NAME" value={editingDoc.beneName} onChange={v => setEditingDoc({...editingDoc, beneName: v})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <ModernInput label="ADDRESS 1" value={editingDoc.beneAddr1} onChange={v => setEditingDoc({...editingDoc, beneAddr1: v})} />
                  <ModernInput label="ADDRESS 2" value={editingDoc.beneAddr2} onChange={v => setEditingDoc({...editingDoc, beneAddr2: v})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <ModernInput label="CITY" value={editingDoc.beneCity} onChange={v => setEditingDoc({...editingDoc, beneCity: v})} />
                  <ModernInput label="PIN CODE" value={editingDoc.benePin} onChange={v => setEditingDoc({...editingDoc, benePin: v})} />
                </div>
              </div>
              
            </div>

            {/* 3. Dates & Settings */}
            <div style={{ display: 'flex', gap: '1.5rem', background: '#f1f5f9', padding: '16px', borderRadius: '10px', alignItems: 'center' }}>
              <ModernInput label="PLACE OF ISSUE" value={editingDoc.placeOfIssue} onChange={v => setEditingDoc({...editingDoc, placeOfIssue: v})} width="200px" />
              <ModernInput label="ISSUE DATE" value={editingDoc.issueDate} onChange={v => setEditingDoc({...editingDoc, issueDate: v})} type="date" width="160px" />
              <ModernInput label="EXPIRY DATE" value={editingDoc.expiryDate} onChange={v => setEditingDoc({...editingDoc, expiryDate: v})} type="date" width="160px" />
              
              <div style={{ width: '1px', height: '40px', background: '#cbd5e1', margin: '0 10px' }}></div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '600', color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editingDoc.isDiffId} onChange={e => setEditingDoc({...editingDoc, isDiffId: e.target.checked})} style={{ width: '14px', height: '14px', accentColor: 'var(--primary-color-start, #0284c7)' }} /> 
                  IS ICEGATE ID DIFFERENT? {defaultIcegateId ? <span style={{color: 'var(--text-muted, #64748b)', fontSize: '10px'}}>(Default: {defaultIcegateId})</span> : ''}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '600', color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editingDoc.isApplicable} onChange={e => setEditingDoc({...editingDoc, isApplicable: e.target.checked})} style={{ width: '14px', height: '14px', accentColor: 'var(--primary-color-start, #0284c7)' }} /> 
                  IS APPLICABLE?
                </label>
              </div>

              <div style={{ flex: 1 }}></div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', letterSpacing: '0.5px' }}>FILE TYPE</span>
                  <select style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', background: '#fff', outline: 'none' }} value={editingDoc.fileType} onChange={e => setEditingDoc({...editingDoc, fileType: e.target.value})}>
                    <option>PDF</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', letterSpacing: '0.5px' }}>DOC. FOR</span>
                  <select style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', background: '#fff', outline: 'none' }} value={editingDoc.docFor} onChange={e => setEditingDoc({...editingDoc, docFor: e.target.value})}>
                    <option>ITEM</option>
                    <option>HEADER</option>
                  </select>
                </div>
              </div>
            </div>

          </div>

          {/* Form Footer / Upload Actions */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', background: 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            
            {/* Upload Section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {showPinPrompt ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #c4b5fd', boxShadow: '0 2px 4px rgba(139, 92, 246, 0.1)' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#6d28d9' }}>ENTER PIN:</span>
                  <input type="password" placeholder="••••••••" style={{ width: '80px', border: 'none', borderBottom: '2px solid #8b5cf6', outline: 'none', background: 'transparent', textAlign: 'center', letterSpacing: '2px' }} value={tokenPin} onChange={e => setTokenPin(e.target.value)} autoFocus />
                  <button onClick={handleSignAndUpload} disabled={isUploading} style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(139, 92, 246, 0.3)' }}>
                    {isUploading ? 'PROCESSING...' : 'CONFIRM & UPLOAD'}
                  </button>
                  <button onClick={() => setShowPinPrompt(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={16}/></button>
                </div>
              ) : (
                <>
                  <input type="file" id="esanchitFile" style={{ display: 'none' }} accept=".pdf" onChange={(e) => { setUploadFile(e.target.files[0]); setShowPinPrompt(true); }} />
                  <button onClick={() => document.getElementById('esanchitFile').click()} style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)', transition: 'transform 0.1s' }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
                    <Upload size={16} /> AUTO-SIGN & UPLOAD DOC
                  </button>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Upload PDF to auto-generate IRN</span>
                </>
              )}
            </div>

            {/* Save / Cancel */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => {setShowModal(false); setEditingDoc(null);}} style={{ padding: '8px 20px', background: '#fff', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.background = '#fff'}>
                CANCEL
              </button>
              <button onClick={saveModalDoc} style={{ padding: '8px 24px', background: '#10b981', border: '1px solid #059669', color: '#fff', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)' }}>
                <Save size={14} /> SAVE RECORD
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}

// Helper Component for Modern Inputs
function ModernInput({ label, value, onChange, type = "text", highlight = false, width = 'auto' }) {
  const Box = type === 'date' ? ModernDatePicker : 'input';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width }}>
      <label style={{ fontSize: '10px', fontWeight: 'bold', color: highlight ? 'var(--primary-color-start, #0284c7)' : '#64748b', letterSpacing: '0.5px' }}>{label}</label>
      <Box 
        type={type === 'date' ? undefined : type} 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        style={{ 
          padding: '8px 12px', 
          border: highlight ? '1px solid #7dd3fc' : '1px solid #cbd5e1', 
          borderRadius: '6px', 
          fontSize: '12px', 
          background: highlight ? '#f0f9ff' : '#fff',
          outline: 'none',
          transition: 'border 0.2s, box-shadow 0.2s',
          width: '100%',
          boxSizing: 'border-box'
        }} 
        onFocus={e => { e.target.style.borderColor = 'var(--primary-color-start, #0ea5e9)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-shadow)'; }}
        onBlur={e => { e.target.style.borderColor = highlight ? '#7dd3fc' : '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
      />
    </div>
  );
}
