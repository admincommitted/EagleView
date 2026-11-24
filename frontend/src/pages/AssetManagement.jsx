import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, UserPlus, Image as ImageIcon, Trash2, X, Plus, FileText, History } from 'lucide-react';

export default function AssetManagement() {
  const [assets, setAssets] = useState([]);
  const [approvedPOs, setApprovedPOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('GRN'); // GRN or DIRECTORY
  
  // Modals state
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assignModal, setAssignModal] = useState(false);
  const [photoModal, setPhotoModal] = useState(false);
  const [discardModal, setDiscardModal] = useState(false);
  const [historyModal, setHistoryModal] = useState(false);
  const [billModal, setBillModal] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');

  // Form states
  const [assignName, setAssignName] = useState('');
  const [assignDept, setAssignDept] = useState('');
  const [warrantyDate, setWarrantyDate] = useState('');
  const [discardReason, setDiscardReason] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [billFile, setBillFile] = useState(null);
  const [discardPhotoFile, setDiscardPhotoFile] = useState(null);

  useEffect(() => {
    fetchAssets();
    fetchApprovedPOs();
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/assets');
      setAssets(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchApprovedPOs = async () => {
    try {
      const res = await axios.get('/api/po');
      // Only show Approved POs that have items
      setApprovedPOs(res.data.filter(po => po.status === 'Approved'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleInward = async (item, po) => {
    try {
      // Loop to create individual assets if quantity > 1 (optional, for now create 1 stock entry per qty)
      await axios.put(`/api/po/items/${item.id}/receive`);
        await axios.post('/api/assets', {
        assetName: item.itemName,
        description: `Received via PO: ${po.poNumber}`,
        purchaseValue: item.unitPrice,
        branch: po.branch || 'Head Office',
        category: po.category || 'General Admin',
        sourcePurchaseId: po.id
      });
      alert('Asset Added to Stock successfully!');
      fetchAssets();
        fetchApprovedPOs();
        setActiveTab('DIRECTORY');
    } catch(err) {
      alert('Error adding asset to stock');
    }
  };

  const handleAssign = async () => {
    if(!assignName) return alert("Name is required");
    try {
      await axios.put(`/api/assets/${selectedAsset.id}`, {
        status: 'ASSIGNED',
        assignedTo: assignName,
        assignedDepartment: assignDept
      });
      setAssignModal(false);
      fetchAssets();
    } catch (e) {
      alert("Failed to assign");
    }
  };

  const handleDiscard = async () => {
    if(!discardReason) return alert("Reason is required");
    try {
      const formData = new FormData();
      formData.append('reason', discardReason);
      if(discardPhotoFile) formData.append('photo', discardPhotoFile);

      await axios.post(`/api/assets/${selectedAsset.id}/discard`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDiscardModal(false);
      setDiscardPhotoFile(null);
      fetchAssets();
    } catch (e) {
      alert("Failed to discard");
    }
  };

  const handleBillUpload = async (e) => {
    e.preventDefault();
    if(!billFile) return;
    const formData = new FormData();
    formData.append('bill', billFile);
    try {
      await axios.post(`/api/assets/${selectedAsset.id}/bill`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setBillModal(false);
      setBillFile(null);
      fetchAssets();
    } catch (err) {
      alert("Bill upload failed");
    }
  };

  const handlePhotoUpload = async (e) => {
    e.preventDefault();
    if(!photoFile) return;
    
    const formData = new FormData();
    formData.append('photo', photoFile);

    try {
      await axios.post(`/api/assets/${selectedAsset.id}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPhotoModal(false);
      setPhotoFile(null);
      fetchAssets();
    } catch (err) {
      alert("Photo upload failed");
    }
  };

  const filteredAssets = assets.filter(a => {
      // First filter by tab status
      if (activeTab === 'DIRECTORY' && a.status === 'DISCARDED') return false;
      if (activeTab === 'DISCARDED' && a.status !== 'DISCARDED') return false;

      // Then by search term
      if(!assetSearch) return true;
      const s = assetSearch.toLowerCase();
      return (
        (a.assetName && a.assetName.toLowerCase().includes(s)) ||
        (a.assetTag && a.assetTag.toLowerCase().includes(s)) ||
        (a.assignedTo && a.assignedTo.toLowerCase().includes(s)) ||
        (a.description && a.description.toLowerCase().includes(s))
      );
    });

    return (
      <div style={{ padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div style={{ background: '#0f172a', padding: '10px', borderRadius: '8px', color: 'white' }}>
          <Package size={24} />
        </div>
        <div>
          <h2 style={{ margin: 0, color: '#1e293b' }}>Asset & Stock Management</h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Goods Receipt Note (GRN) and Asset Assignment</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => setActiveTab('GRN')} style={{ padding: '10px 20px', background: activeTab === 'GRN' ? '#2563eb' : 'white', color: activeTab === 'GRN' ? 'white' : '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Stock Inward (GRN)</button>
        <button onClick={() => setActiveTab('DIRECTORY')} style={{ padding: '10px 20px', background: activeTab === 'DIRECTORY' ? '#2563eb' : 'white', color: activeTab === 'DIRECTORY' ? 'white' : '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Asset Directory</button>
        <button onClick={() => setActiveTab('DISCARDED')} style={{ padding: '10px 20px', background: activeTab === 'DISCARDED' ? '#2563eb' : 'white', color: activeTab === 'DISCARDED' ? 'white' : '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Discarded Assets</button>
      </div>

      {activeTab === 'GRN' && (
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 15px 0' }}>Pending Stock Inwards (Approved POs)</h3>
            {approvedPOs.length === 0 ? <p style={{ color: '#64748b' }}>No approved POs pending inward.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>Sr. No.</th>
                    <th style={thStyle}>PO Number</th>
                    <th style={thStyle}>Vendor</th>
                    <th style={thStyle}>Item Name</th>
                    <th style={thStyle}>Qty</th>
                    <th style={thStyle}>Unit Price</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let globalIndex = 1;
                    return approvedPOs.flatMap(po => 
                      (po.items || []).filter(item => !item.isReceived).map(item => (
                        <tr key={item.id}>
                          <td style={tdStyle}>{globalIndex++}</td>
                          <td style={tdStyle}>
                              <a href={`/po-view/${po.id}`} target="_blank" rel="noreferrer" style={{ color: '#0369a1', fontWeight: 'bold', textDecoration: 'underline' }}>
                                {po.poNumber}
                              </a>
                            </td>
                          <td style={tdStyle}>{po.Vendor?.vendorName || 'N/A'}<br/><span style={{fontSize: '11px', color: '#64748b'}}>{po.branch}</span></td>
                          <td style={tdStyle}><strong>{item.itemName}</strong></td>
                          <td style={tdStyle}>{item.quantity}</td>
                          <td style={tdStyle}>&#8377;{Number(item.unitPrice).toFixed(2)}</td>
                          <td style={tdStyle}>
                            <button onClick={() => handleInward(item, po)} style={{ ...btnStyle('#10b981'), background: '#10b981', color: 'white' }}>
                              <Plus size={14}/> Receive
                            </button>
                          </td>
                        </tr>
                      ))
                    );
                  })()}
                </tbody>
              </table>
            )}
            {approvedPOs.length > 0 && <div style={{ marginTop: '15px', textAlign: 'right', fontWeight: 'bold', color: '#475569', fontSize: '14px' }}>Total Count: {approvedPOs.reduce((acc, po) => acc + (po.items ? po.items.filter(i => !i.isReceived).length : 0), 0)}</div>}
          </div>
        )}

      {(activeTab === 'DIRECTORY' || activeTab === 'DISCARDED') && (
        <>
          {loading ? (
            <div>Loading assets...</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <h3 style={{ margin: 0, color: '#0f172a' }}>{activeTab === 'DISCARDED' ? 'DISCARDED ASSETS' : 'ASSET DIRECTORY'}</h3>
                  {filteredAssets.length > 0 && <span style={{ background: '#e0f2fe', color: '#0284c7', padding: '4px 10px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold' }}>Total: {filteredAssets.length}</span>}
                </div>
                <input 
                type="text" 
                placeholder="Search Assets by Code, Name, Person..." 
                value={assetSearch} 
                onChange={e => setAssetSearch(e.target.value)} 
                style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '300px' }} 
              />
            </div>
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                {filteredAssets.length === 0 ? <p style={{ color: '#64748b' }}>No assets found matching the search criteria.</p> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={thStyle}>Sr. No.</th>
                        <th style={thStyle}>Asset Details</th>
                        <th style={thStyle}>Description & Value</th>
                        <th style={thStyle}>Status / Assignment</th>
                        <th style={thStyle}>Photo</th>
                        <th style={thStyle}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssets.map((asset, idx) => (
                        <tr key={asset.id}>
                          <td style={tdStyle}>{idx + 1}</td>
                          <td style={tdStyle}>
                            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb' }}>{asset.assetTag || 'NO TAG'}</div>
                            <strong style={{ fontSize: '14px', color: '#0f172a' }}>{asset.assetName}</strong>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
  {asset.description && asset.description.includes('Received via PO:') && asset.sourcePurchaseId ? (
    <span>
      {asset.description.split('PO:')[0]} PO: 
      <a href={`/po-view/${asset.sourcePurchaseId}`} target="_blank" rel="noreferrer" style={{ color: '#0369a1', fontWeight: 'bold', textDecoration: 'underline', marginLeft: '4px' }}>
        {asset.description.split('PO:')[1]}
      </a>
    </span>
  ) : (
    asset.description || 'No description'
  )}
</div>
                            <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}><strong>Value:</strong> &#8377;{asset.purchaseValue || '0'}</div>
   {asset.billUrl && <div style={{ marginTop: '4px' }}><a href={asset.billUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#2563eb' }}>View Bill/Warranty</a></div>}
                          </td>
                          <td style={tdStyle}>
                            <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', background: asset.status === 'IN_STOCK' ? '#3b82f6' : asset.status === 'ASSIGNED' ? '#10b981' : '#ef4444', color: 'white', marginBottom: '6px' }}>
                              {asset.status.replace('_', ' ')}
                            </span>
                            {asset.status === 'ASSIGNED' && (
                              <div style={{ fontSize: '11px', color: '#047857', marginTop: '4px' }}>
                                <strong>Assigned To:</strong><br/>{asset.assignedTo}<br/>({asset.assignedDepartment})
                              </div>
                            )}
                            {asset.status === 'DISCARDED' && (
                              <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px' }}>
                                <strong>Reason:</strong><br/>{asset.discardReason}
   {asset.discardPhotoUrl && <div style={{marginTop: '4px'}}><a href={asset.discardPhotoUrl} target="_blank" rel="noreferrer" style={{color: '#2563eb'}}>View Discard Record</a></div>}
                              </div>
                            )}
                          </td>
                          <td style={tdStyle}>
                            {asset.photoUrl ? (
                              <img src={asset.photoUrl} alt={asset.assetName} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                            ) : (
                              <div style={{ width: '50px', height: '50px', background: '#f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', color: '#94a3b8' }}>
                                <ImageIcon size={16} />
                                <span style={{ fontSize: '8px', marginTop: '2px' }}>N/A</span>
                              </div>
                            )}
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap' }}>
                              <button onClick={() => { setSelectedAsset(asset); setPhotoModal(true); }} style={{ ...btnStyle('#3b82f6'), padding: '4px 8px', fontSize: '11px' }}>
    <ImageIcon size={12} /> Add Photo
  </button>
  <button onClick={() => { setSelectedAsset(asset); setBillModal(true); }} style={{ ...btnStyle('#8b5cf6'), padding: '4px 8px', fontSize: '11px' }}>
    <FileText size={12} /> Upload Bill
  </button>
                              
                              {asset.status !== 'DISCARDED' && (
                                <button onClick={() => { setSelectedAsset(asset); setAssignName(asset.assignedTo || ''); setAssignDept(asset.assignedDepartment || ''); setWarrantyDate(asset.warrantyExpiryDate || ''); setAssignModal(true); }} style={{ ...btnStyle('#10b981'), padding: '4px 8px', fontSize: '11px' }}>
                                  <UserPlus size={12} /> Edit/Assign
                                </button>
                              )}

                              {asset.status !== 'DISCARDED' && (
                                <button onClick={() => { setSelectedAsset(asset); setDiscardReason(''); setDiscardModal(true); }} style={{ ...btnStyle('#ef4444'), padding: '4px 8px', fontSize: '11px' }}>
                                  <Trash2 size={12} /> Discard
                                </button>
                              )}
                              
                              <button onClick={() => { setSelectedAsset(asset); setHistoryModal(true); }} style={{ ...btnStyle('#f59e0b'), background: 'white', color: '#f59e0b', border: '1px solid #fcd34d', padding: '4px 8px', fontSize: '11px' }}>
                                <History size={12} /> History
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                
      
              </div>
            </>
          )}
        </>
      )}

      {/* Modals */}
      {photoModal && (
        <Modal title="Upload Asset Photo" onClose={() => setPhotoModal(false)}>
          <form onSubmit={handlePhotoUpload}>
            <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} style={{ marginBottom: '15px' }} required />
            <button type="submit" style={{ ...btnStyle('#3b82f6'), width: '100%', padding: '10px', justifyContent: 'center' }}>Upload</button>
          </form>
        </Modal>
      )}

      {assignModal && (
        <Modal title="Update Asset / Assign" onClose={() => setAssignModal(false)}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Assign To (Name) *</label>
            <input value={assignName} onChange={e => setAssignName(e.target.value)} style={inputStyle} placeholder="Employee Name" />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Department</label>
            <input value={assignDept} onChange={e => setAssignDept(e.target.value)} style={inputStyle} placeholder="IT, Sales, etc." />
          </div>
          <button onClick={handleAssign} style={{ ...btnStyle('#10b981'), background: '#10b981', color: 'white', width: '100%', padding: '10px', justifyContent: 'center' }}>Confirm Assignment</button>
        </Modal>
      )}

      {billModal && (
        <Modal title="Upload Bill / Warranty" onClose={() => setBillModal(false)}>
          <form onSubmit={handleBillUpload}>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setBillFile(e.target.files[0])} style={{ marginBottom: '15px' }} required />
            <button type="submit" style={{ ...btnStyle('#8b5cf6'), width: '100%', padding: '10px', justifyContent: 'center' }}>Upload Bill</button>
          </form>
        </Modal>
      )}
      
      {historyModal && selectedAsset && (
        <Modal title={`Assignment History - ${selectedAsset.assetName}`} onClose={() => setHistoryModal(false)}>
          {(!selectedAsset.assignments || selectedAsset.assignments.length === 0) ? (
            <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', padding: '20px' }}>No assignment history available for this asset.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Assigned To</th>
                  <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Department</th>
                  <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Assigned Date</th>
                  <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Unassigned Date</th>
                </tr>
              </thead>
              <tbody>
                {selectedAsset.assignments.map((hist, i) => (
                  <tr key={i}>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}><strong>{hist.assignedTo}</strong></td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>{hist.assignedDepartment}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>{new Date(hist.assignedAt).toLocaleDateString('en-GB')}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>{hist.unassignedAt ? new Date(hist.unassignedAt).toLocaleDateString('en-GB') : <span style={{ color: '#10b981' }}>Currently Active</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}

      {discardModal && (
        <Modal title="Discard / Scrap Asset" onClose={() => setDiscardModal(false)}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#b91c1c' }}>Reason for Discarding *</label>
            <textarea value={discardReason} onChange={e => setDiscardReason(e.target.value)} style={{ ...inputStyle, height: '80px', borderColor: '#fca5a5' }} placeholder="Damaged beyond repair, sold, etc." />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#475569' }}>Attach Photo for Record (Optional)</label>
            <input type="file" accept="image/*,application/pdf" onChange={e => setDiscardPhotoFile(e.target.files[0])} style={{ marginBottom: '5px' }} />
          </div>
          <button onClick={handleDiscard} style={{ ...btnStyle('#ef4444'), background: '#ef4444', color: 'white', width: '100%', padding: '10px', justifyContent: 'center' }}>Discard Asset</button>
        </Modal>
      )}

    </div>
  );
}

const thStyle = { padding: '10px', textAlign: 'left', borderBottom: '1px solid #cbd5e1', fontSize: '13px' };
const tdStyle = { padding: '10px', borderBottom: '1px solid #e2e8f0' };

const btnStyle = (color) => ({
  background: 'white', border: `1px solid ${color}`, color: color, padding: '6px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold'
});

const inputStyle = { width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' };

function Modal({ title, children, onClose }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', width: '350px', maxWidth: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>{title}</h3>
          <X size={18} style={{ cursor: 'pointer', color: '#64748b' }} onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}
