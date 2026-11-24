import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShoppingCart, Send, CheckCircle, Clock, XCircle, FileText } from 'lucide-react';

export default function PurchaseManagement() {
  const [formData, setFormData] = useState({
    branch: 'Head Office',
    category: 'IT Assets',
    priority: 'NORMAL',
    itemName: '',
    itemDetails: '',
    amount: '',
    expectedDate: '',
    intendedUser: '',
    designation: '',
    department: '',
    justification: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await axios.get('/api/purchase');
      setRecentRequests(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => data.append(key, formData[key]));
      if (photoFile) data.append('photo', photoFile);

      await axios.post('/api/purchase', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage({ type: 'success', text: 'Purchase request sent to Director for approval!' });
      setFormData({
        branch: 'Head Office', category: 'IT Assets', priority: 'NORMAL',
        itemName: '', itemDetails: '', amount: '', expectedDate: '',
        intendedUser: '', designation: '', department: '', justification: ''
      });
      setPhotoFile(null);
      fetchRequests();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to submit request' });
    }
    setLoading(false);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED': return <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}><CheckCircle size={12} style={{display:'inline', marginRight:'4px'}}/>APPROVED</span>;
      case 'REJECTED': return <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}><XCircle size={12} style={{display:'inline', marginRight:'4px'}}/>REJECTED</span>;
      default: return <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}><Clock size={12} style={{display:'inline', marginRight:'4px'}}/>PENDING</span>;
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div style={{ background: '#2563eb', padding: '10px', borderRadius: '8px', color: 'white' }}>
          <ShoppingCart size={24} />
        </div>
        <div>
          <h2 style={{ margin: 0, color: '#1e293b' }}>Purchase Management</h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Admin Module - Submit purchase requests for approval</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left Form */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
            <FileText size={18} /> New Purchase Request
          </h3>
          
          {message && (
            <div style={{ padding: '10px', marginBottom: '15px', borderRadius: '4px', backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2', color: message.type === 'success' ? '#166534' : '#991b1b' }}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
              <div>
                <label style={labelStyle}>Branch</label>
                <select name="branch" value={formData.branch} onChange={handleChange} style={inputStyle}>
                  <option value="Head Office">Head Office</option>
                  <option value="Delhi Branch">Delhi Branch</option>
                  <option value="Mumbai Branch">Mumbai Branch</option>
                  <option value="Chennai Branch">Chennai Branch</option>
                  <option value="Kolkata Branch">Kolkata Branch</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select name="category" value={formData.category} onChange={handleChange} style={inputStyle}>
                  <option value="IT Assets">IT Assets (Laptops, Printers)</option>
                  <option value="Office Supplies">Office Supplies</option>
                  <option value="Warehouse Material">Warehouse Material</option>
                  <option value="Vehicle Spares">Vehicle Spares</option>
                  <option value="General Admin">General Admin</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Priority</label>
                <select name="priority" value={formData.priority} onChange={handleChange} style={inputStyle}>
                  <option value="NORMAL">Normal</option>
                  <option value="URGENT">Urgent (Require immediately)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px' }}>
              <div>
                <label style={labelStyle}>Item Name *</label>
                <input type="text" name="itemName" value={formData.itemName} onChange={handleChange} required style={inputStyle} placeholder="e.g. Dell Latitude Laptop" />
              </div>
              <div>
                <label style={labelStyle}>Estimated Amount (₹) *</label>
                <input type="number" name="amount" value={formData.amount} onChange={handleChange} required style={inputStyle} placeholder="55000" />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Item Details / Specifications</label>
              <textarea name="itemDetails" value={formData.itemDetails} onChange={handleChange} style={{...inputStyle, height: '60px'}} placeholder="i7 Processor, 16GB RAM, 512GB SSD..." />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
              <div>
                <label style={labelStyle}>Intended User *</label>
                <input type="text" name="intendedUser" value={formData.intendedUser} onChange={handleChange} required style={inputStyle} placeholder="Employee Name" />
              </div>
              <div>
                <label style={labelStyle}>Designation</label>
                <input type="text" name="designation" value={formData.designation} onChange={handleChange} style={inputStyle} placeholder="e.g. Sales Executive" />
              </div>
              <div>
                <label style={labelStyle}>Department</label>
                <input type="text" name="department" value={formData.department} onChange={handleChange} style={inputStyle} placeholder="e.g. Sales" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={labelStyle}>Expected Date of Delivery</label>
                <input type="date" name="expectedDate" value={formData.expectedDate} onChange={handleChange} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Reason / Justification for Purchase *</label>
              <textarea name="justification" value={formData.justification} onChange={handleChange} required style={{...inputStyle, height: '60px'}} placeholder="Why is this purchase required? (e.g. New joining, old laptop damaged)" />
            </div>

            <div>
              <label style={labelStyle}>Attach Product Photo / Quotation (Optional)</label>
              <input type="file" accept="image/*,.pdf" onChange={(e) => setPhotoFile(e.target.files[0])} style={{...inputStyle, padding: '4px'}} />
            </div>

            <button type="submit" disabled={loading} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '12px', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              <Send size={18} /> {loading ? 'Sending to Director...' : 'Submit for Approval'}
            </button>
          </form>
        </div>

        {/* Right Recent Requests */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#334155' }}>Recent Requests</h3>
          <div style={{ overflowY: 'auto', maxHeight: '550px', paddingRight: '5px' }}>
            {recentRequests.map(req => (
              <div key={req.id} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '15px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <strong style={{ fontSize: '15px', color: '#0f172a' }}>{req.itemName}</strong>
                    <div style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>₹{req.amount} | For: {req.intendedUser}</div>
                  </div>
                  {getStatusBadge(req.status)}
                </div>
                {req.status === 'REJECTED' && req.rejectionReason && (
                  <div style={{ background: '#fef2f2', border: '1px dashed #f87171', padding: '8px', borderRadius: '4px', fontSize: '12px', color: '#991b1b', marginTop: '10px' }}>
                    <strong>Reason:</strong> {req.rejectionReason}
                  </div>
                )}
                {req.status === 'APPROVED' && (
                  <div style={{ color: '#16a34a', fontSize: '12px', marginTop: '10px' }}>
                    Approved by {req.approvedBy} on {new Date(req.approvedAt).toLocaleDateString('en-GB')}
                  </div>
                )}
              </div>
            ))}
            {recentRequests.length === 0 && (
              <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '40px' }}>No recent purchase requests found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' };
const inputStyle = { width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' };
