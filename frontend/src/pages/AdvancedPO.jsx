import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Send, FileText } from 'lucide-react';

// 16-Nov-2026: a PO keeps its branch by name - one entry per name, active branches only (JAIPUR showed twice)
const poBranches = (list) => { const seen = new Set(); return (list || []).filter(b => { const k = String(b.branchName || '').trim().toUpperCase(); if (!k || (b.status || 'Active') === 'Inactive' || seen.has(k)) return false; seen.add(k); return true; }); };

export default function AdvancedPO() {
  const [vendors, setVendors] = useState([]);
  const [newVendor, setNewVendor] = useState({ vendorName: '', gstNumber: '', contactEmail: '', phone: '', address: '' });
  const [showVendorModal, setShowVendorModal] = useState(false);
  
  const [formData, setFormData] = useState({
    vendorId: '',
    branch: 'Head Office',
    category: 'IT Assets',
    priority: 'Normal',
    justification: ''
  });

  const [items, setItems] = useState([{ itemName: '', quantity: 1, unitPrice: 0, gstRate: 0 }]);
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionRow, setActiveSuggestionRow] = useState(null);
  const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1);
  const [quoteFile, setQuoteFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    fetchVendors();
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/masters/company-branches', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const list = poBranches(res.data.data);
      setBranches(list);
      if(list.length > 0 && formData.branch === 'Head Office') {
          setFormData(prev => ({ ...prev, branch: list[0].branchName }));
      }
    } catch(err) { console.error('Failed to fetch branches', err); }
  };

  const fetchVendors = async () => {
    const res = await axios.get('/api/po/vendors');
    setVendors(res.data);
  };

  const addVendor = async () => {
    if(!newVendor.vendorName) return;
    await axios.post('/api/po/vendors', newVendor);
    setNewVendor({ vendorName: '', gstNumber: '', contactEmail: '', phone: '', address: '' });
    fetchVendors();
    setShowVendorModal(false);
  };

  const fetchSuggestions = async (query) => {
    if(!query || query.length < 2) return setSuggestions([]);
    try {
      const res = await axios.get(`/api/po/item-history/search?q=${encodeURIComponent(query)}`);
      setSuggestions(res.data);
    } catch(err) {
      console.error(err);
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);

    if(field === 'itemName') {
        setActiveSuggestionRow(index);
        fetchSuggestions(value);
    }
  };

  useEffect(() => {
    if (focusedSuggestionIndex >= 0) {
      const el = document.getElementById(`suggestion-${focusedSuggestionIndex}`);
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedSuggestionIndex]);

  const handleKeyDown = (e, index) => {
    if (activeSuggestionRow !== index || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedSuggestionIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedSuggestionIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      if (focusedSuggestionIndex >= 0 && focusedSuggestionIndex < suggestions.length) {
        e.preventDefault();
        applySuggestion(index, suggestions[focusedSuggestionIndex]);
      }
    }
  };

  const applySuggestion = (index, suggestion) => {
      const newItems = [...items];
      newItems[index].itemName = suggestion.itemName;
      newItems[index].unitPrice = suggestion.unitPrice;
      newItems[index].gstRate = suggestion.gstRate;
      setItems(newItems);
      setSuggestions([]);
      setActiveSuggestionRow(null);
  };

  const addItemRow = () => setItems([...items, { itemName: '', quantity: 1, unitPrice: 0, gstRate: 0 }]);
  const removeItemRow = (index) => setItems(items.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = new FormData();
      data.append('vendorId', formData.vendorId);
      data.append('branch', formData.branch);
      data.append('category', formData.category);
      data.append('priority', formData.priority);
      data.append('justification', formData.justification);
      data.append('items', JSON.stringify(items));
      if (quoteFile) data.append('quote', quoteFile);

      await axios.post('/api/po', data);
      alert('PO Created successfully and sent to Director!');
      setFormData({...formData, justification: ''});
      setItems([{ itemName: '', quantity: 1, unitPrice: 0 }]);
      setQuoteFile(null);
    } catch(err) {
      alert('Error creating PO');
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>


      <div style={{ gap: '20px' }}>
        
        {/* PO CREATION FORM */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={labelStyle}>Select Vendor *</label>
                  <button type="button" onClick={() => setShowVendorModal(true)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}>+ Add New</button>
                </div>
                <select required value={formData.vendorId} onChange={e=>setFormData({...formData, vendorId: e.target.value})} style={inputStyle}>
                  <option value="">-- Select --</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.vendorName}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Branch</label>
                <select value={formData.branch} onChange={e=>setFormData({...formData, branch: e.target.value})} style={inputStyle}>
                  {branches.length > 0 ? branches.map(b => (
                    <option key={b.id} value={b.branchName}>{b.branchName}</option>
                  )) : (
                    <option>Head Office</option>
                  )}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})} style={inputStyle}>
                  <option>IT Assets</option>
                  <option>Office Supplies</option>
                  <option>Warehouse Material</option>
                  <option>Vehicle Spares</option>
                  <option>General Admin</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Priority</label>
                <select value={formData.priority} onChange={e=>setFormData({...formData, priority: e.target.value})} style={inputStyle}>
                  <option>Normal</option>
                  <option>Urgent</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Items List *</label>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={thStyle}>Sr. No.</th>
                        <th style={thStyle}>Item Name</th>
                      <th style={thStyle}>Quantity</th>
                      <th style={thStyle}>Unit Price (&#8377;)</th>
                      <th style={thStyle}>GST Rate (%)</th>
                      <th style={thStyle}>GST Amt</th>
                      <th style={thStyle}>Total</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const baseTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                      const gstAmt = baseTotal * ((Number(item.gstRate) || 0) / 100);
                      const rowTotal = baseTotal + gstAmt;
                      return (
                        <tr key={index}>
                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>{index + 1}</td>
                            <td style={{...tdStyle, position: 'relative'}}>
                                <input required value={item.itemName} onChange={e=>{setFocusedSuggestionIndex(-1); handleItemChange(index, 'itemName', e.target.value);}} onFocus={() => { setActiveSuggestionRow(index); fetchSuggestions(item.itemName); }} onBlur={() => setTimeout(() => { setActiveSuggestionRow(null); setFocusedSuggestionIndex(-1); }, 200)} onKeyDown={(e) => handleKeyDown(e, index)} style={inputStyle} placeholder="Item..." />
                                {activeSuggestionRow === index && suggestions.length > 0 && (
                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', zIndex: 10, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                                        {suggestions.map((sug, i) => (
                                            <div id={`suggestion-${i}`} key={i} onClick={() => applySuggestion(index, sug)} style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: '12px', backgroundColor: focusedSuggestionIndex === i ? '#e0f2fe' : 'white' }} onMouseEnter={() => setFocusedSuggestionIndex(i)}>
                                                <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{sug.itemName}</div>
                                                <div style={{ color: '#64748b', marginTop: '2px' }}>Last: &#8377;{sug.unitPrice} | GST: {sug.gstRate}% | {new Date(sug.lastPurchased).toLocaleDateString('en-GB')} ({sug.poNumber})</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </td>
                          <td style={tdStyle}><input required type="number" min="1" value={item.quantity} onChange={e=>handleItemChange(index, 'quantity', e.target.value)} style={inputStyle} /></td>
                          <td style={tdStyle}><input required type="number" min="0" value={item.unitPrice} onChange={e=>handleItemChange(index, 'unitPrice', e.target.value)} style={inputStyle} /></td>
                          <td style={tdStyle}><input required type="number" min="0" max="100" value={item.gstRate} onChange={e=>handleItemChange(index, 'gstRate', e.target.value)} style={inputStyle} placeholder="%" /></td>
                          <td style={tdStyle}>
                              <div style={{ padding: '10px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', fontWeight: '600', color: '#334155', minWidth: '80px', display: 'flex', alignItems: 'center' }}>
                                &#8377;{gstAmt.toFixed(2)}
                              </div>
                            </td>
                            <td style={tdStyle}>
                              <div style={{ padding: '10px 12px', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', color: '#0369a1', minWidth: '80px', display: 'flex', alignItems: 'center' }}>
                                &#8377;{rowTotal.toFixed(2)}
                              </div>
                            </td>
                          <td style={tdStyle}>
                            <Trash2 size={18} color="red" style={{cursor: 'pointer'}} onClick={() => removeItemRow(index)} />
                          </td>
                        </tr>
                      );
                    })}
                                      {/* Summary Row */}
                    <tr style={{ background: '#f8fafc', fontWeight: 'bold', textTransform: 'uppercase' }}>
  <td colSpan="5" style={{...tdStyle, textAlign: 'right', fontSize: '18px', fontWeight: '900', color: '#0f172a'}}>GRAND TOTAL:</td>
    <td style={{...tdStyle, fontSize: '18px', fontWeight: '900', color: '#0f172a'}}>&#8377;{Number(items.reduce((acc, curr) => {
    const base = (Number(curr.quantity) || 0) * (Number(curr.unitPrice) || 0);
    return acc + (base * ((Number(curr.gstRate) || 0) / 100));
  }, 0)).toFixed(2)}</td>
  <td style={{...tdStyle, fontSize: '18px', fontWeight: '900', color: '#0f172a'}}>&#8377;{Number(items.reduce((acc, curr) => {
      const base = (Number(curr.quantity) || 0) * (Number(curr.unitPrice) || 0);
    const gstAmt = base * ((Number(curr.gstRate) || 0) / 100);
    return acc + (base + gstAmt);
  }, 0)).toFixed(2)}</td>
  <td style={tdStyle}></td>
</tr>
                  </tbody>
                </table>
              <button type="button" onClick={addItemRow} style={{...btnStyle, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', marginTop: '15px', boxShadow: 'none'}}><Plus size={16}/> Add Another Item</button>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={labelStyle}>Quotation File (PDF/Image)</label>
              <input type="file" onChange={e => setQuoteFile(e.target.files[0])} style={{...inputStyle, padding: '4px'}} />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={labelStyle}>REMARKS</label>
              <textarea required value={formData.justification} onChange={e=>setFormData({...formData, justification: e.target.value})} style={{...inputStyle, height: '60px'}} />
              
              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#0f172a' }}>TERMS & CONDITIONS</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#475569', lineHeight: '1.5' }}>
                  <li><strong>GST & INVOICING:</strong> VALID GSTIN AND PROPER HSN/SAC CODES ARE MANDATORY ON THE FINAL INVOICE.</li>
                  <li><strong>DELIVERY:</strong> MATERIALS MUST BE DELIVERED TO THE COMMITTED CARGO CARE LIMITED, MAHIPALPUR OFFICE DURING STANDARD WORKING HOURS.</li>
                  <li><strong>PAYMENT TERMS:</strong> PAYMENT WILL BE PROCESSED UPON SUCCESSFUL MATERIAL VERIFICATION AND INVOICE SUBMISSION, SUBJECT TO AGREED CREDIT TERMS.</li>
                  <li><strong>REJECTIONS:</strong> DEFECTIVE OR NON-COMPLIANT ITEMS WILL BE REJECTED; RETURN FREIGHT WILL BE BORNE BY THE VENDOR.</li>
                </ul>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '10px', fontStyle: 'italic', fontWeight: '500' }}>
                  * NOTE: ALL DISPUTES ARE SUBJECT TO DELHI JURISDICTION ONLY.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="submit" disabled={loading} style={{...btnStyle, background: '#10b981', color: '#ffffff', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)', fontSize: '14px', padding: '10px 18px'}}><Send size={18}/> {loading ? 'Processing...' : 'GENERATE PO & SEND TO APPROVAL'}</button>
            </div>
          </form>
        </div>
      </div>
      
      {showVendorModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', width: '350px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ margin: 0 }}>Quick Vendor Add</h4>
              <button onClick={() => setShowVendorModal(false)} style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer' }}>&times;</button>
            </div>
            <input placeholder="Vendor Name" value={newVendor.vendorName} onChange={e=>setNewVendor({...newVendor, vendorName: e.target.value})} style={inputStyle} />
            <input placeholder="GST No" value={newVendor.gstNumber} onChange={e=>setNewVendor({...newVendor, gstNumber: e.target.value})} style={{...inputStyle, marginTop: '10px'}} />
            <input placeholder="Email" value={newVendor.contactEmail} onChange={e=>setNewVendor({...newVendor, contactEmail: e.target.value})} style={{...inputStyle, marginTop: '10px'}} />
            <input placeholder="Mobile Number" value={newVendor.phone} onChange={e=>setNewVendor({...newVendor, phone: e.target.value})} style={{...inputStyle, marginTop: '10px'}} />
            <textarea placeholder="Address" value={newVendor.address} onChange={e=>setNewVendor({...newVendor, address: e.target.value})} style={{...inputStyle, marginTop: '10px', height: '60px', resize: 'vertical'}} />
            <button type="button" onClick={addVendor} style={{...btnStyle, marginTop: '15px', width: '100%'}}>Save Vendor</button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', fontSize: '14px', fontFamily: 'inherit', background: '#f8fafc', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s' };
  // Need to handle focus state in CSS, but inline we do our best
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' };
const btnStyle = { background: '#2563eb', color: '#334155', padding: '12px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)', transition: 'background-color 0.2s' };
const thStyle = { padding: '12px 10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '13px', color: 'white', fontWeight: 'bold', textTransform: 'uppercase' };
const tdStyle = { padding: '10px', borderBottom: '1px solid #e2e8f0', fontSize: '14px' };










