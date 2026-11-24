import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, XCircle, ShoppingCart } from 'lucide-react';

export default function PurchaseApproval() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    const fetchRequest = async () => {
      try {
        const res = await axios.get(`/api/purchase/${id}`);
        setRequest(res.data);
      } catch (err) {
        setError("Request not found or failed to load.");
      }
      setLoading(false);
    };
    fetchRequest();
  }, [id]);

  const handleAction = async (status) => {
    if (status === 'REJECTED' && !rejectionReason.trim()) {
      alert("Please provide a rejection reason.");
      return;
    }
    
    setSubmitting(true);
    try {
      const res = await axios.put(`/api/purchase/${id}/action`, {
        status,
        rejectionReason,
        approvedBy: 'Director' // In a real app, this comes from auth context
      });
      setRequest(res.data);
      setSuccessMsg(`Request successfully ${status.toLowerCase()}!`);
      setShowRejectInput(false);
    } catch (err) {
      alert("Action failed.");
    }
    setSubmitting(false);
  };

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>;
  if (error) return <div style={{ padding: '50px', textAlign: 'center', color: 'red' }}>{error}</div>;
  if (!request) return null;

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '600px', alignSelf: 'flex-start' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '2px solid #e2e8f0', paddingBottom: '15px', marginBottom: '20px' }}>
          <div style={{ background: '#2563eb', padding: '12px', borderRadius: '50%', color: 'white' }}>
            <ShoppingCart size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, color: '#0f172a' }}>Purchase Approval</h2>
            <p style={{ margin: 0, color: '#64748b' }}>Req #{request.id}</p>
          </div>
        </div>

        {successMsg && (
          <div style={{ padding: '15px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '6px', marginBottom: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={20} /> {successMsg}
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
          <tbody>
            <tr style={trStyle}>
              <td style={tdLabelStyle}>Item Name:</td>
              <td style={tdValueStyle}><strong>{request.itemName}</strong></td>
            </tr>
            <tr style={trStyle}>
              <td style={tdLabelStyle}>Amount:</td>
              <td style={tdValueStyle}><strong style={{ color: '#16a34a', fontSize: '16px' }}>₹{request.amount}</strong></td>
            </tr>
            <tr style={trStyle}>
              <td style={tdLabelStyle}>Intended User:</td>
              <td style={tdValueStyle}>{request.intendedUser}</td>
            </tr>
            <tr style={trStyle}>
              <td style={tdLabelStyle}>Designation:</td>
              <td style={tdValueStyle}>{request.designation || '-'}</td>
            </tr>
            <tr style={trStyle}>
              <td style={tdLabelStyle}>Department:</td>
              <td style={tdValueStyle}>{request.department || '-'}</td>
            </tr>
            <tr style={trStyle}>
              <td style={tdLabelStyle}>Last Purchased:</td>
              <td style={tdValueStyle}>{request.lastPurchaseDate ? new Date(request.lastPurchaseDate).toLocaleDateString('en-GB') : 'N/A'}</td>
            </tr>
            <tr style={trStyle}>
              <td style={tdLabelStyle}>Status:</td>
              <td style={tdValueStyle}>
                <span style={{ 
                  padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
                  background: request.status === 'APPROVED' ? '#dcfce7' : request.status === 'REJECTED' ? '#fee2e2' : '#fef3c7',
                  color: request.status === 'APPROVED' ? '#166534' : request.status === 'REJECTED' ? '#991b1b' : '#92400e'
                }}>
                  {request.status}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 5px 0', color: '#475569' }}>Item Details / Specifications</h4>
          <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '14px' }}>
            {request.itemDetails || 'No details provided.'}
          </div>
        </div>

        <div style={{ marginBottom: '30px' }}>
          <h4 style={{ margin: '0 0 5px 0', color: '#475569' }}>Justification</h4>
          <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '14px' }}>
            {request.justification || 'No justification provided.'}
          </div>
        </div>

        {request.productPhotoUrl && (
          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#475569' }}>Attached Photo / Document</h4>
            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
              <a href={request.productPhotoUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'underline', fontSize: '14px' }}>View Attachment</a>
              {request.productPhotoUrl.match(/\.(jpeg|jpg|gif|png)$/i) && (
                <div style={{ marginTop: '10px' }}>
                  <img src={request.productPhotoUrl} alt="Attached product" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                </div>
              )}
            </div>
          </div>
        )}

        {request.status === 'REJECTED' && request.rejectionReason && (
          <div style={{ marginBottom: '30px', background: '#fef2f2', padding: '15px', borderRadius: '6px', border: '1px dashed #f87171' }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#991b1b' }}>Rejection Reason</h4>
            <div style={{ fontSize: '14px', color: '#7f1d1d' }}>{request.rejectionReason}</div>
          </div>
        )}

        {request.status === 'PENDING' && (
          <div>
            {!showRejectInput ? (
              <div style={{ display: 'flex', gap: '15px' }}>
                <button 
                  onClick={() => handleAction('APPROVED')}
                  disabled={submitting}
                  style={{ flex: 1, padding: '12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={18} /> Approve Purchase
                </button>
                <button 
                  onClick={() => setShowRejectInput(true)}
                  disabled={submitting}
                  style={{ flex: 1, padding: '12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                  <XCircle size={18} /> Reject Purchase
                </button>
              </div>
            ) : (
              <div style={{ background: '#fef2f2', padding: '15px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#991b1b', fontSize: '14px' }}>Please provide a reason for rejection:</label>
                <textarea 
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={{ width: '100%', height: '80px', padding: '10px', borderRadius: '4px', border: '1px solid #fca5a5', boxSizing: 'border-box', marginBottom: '15px' }}
                  placeholder="Type reason here..."
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleAction('REJECTED')} disabled={submitting} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Confirm Rejection</button>
                  <button onClick={() => setShowRejectInput(false)} disabled={submitting} style={{ background: 'white', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {request.status === 'APPROVED' && (
          <div style={{ marginTop: '20px', padding: '15px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#166534' }}>Post-Approval Action</h4>
            <p style={{ margin: '0 0 15px 0', color: '#15803d', fontSize: '14px' }}>Has this item been physically purchased and received? Add it to the company asset register.</p>
            <button 
              onClick={async () => {
                if(window.confirm('Add to Asset/Stock list?')) {
                  try {
                    await axios.post('/api/assets', {
                      assetName: request.itemName,
                      description: request.itemDetails,
                      assignedTo: request.intendedUser,
                      assignedDepartment: request.department,
                      purchaseValue: request.amount,
                      sourcePurchaseId: request.id
                    });
                    alert('Successfully added to Assets!');
                    navigate('/asset-management');
                  } catch (e) {
                    alert('Failed to add to assets');
                  }
                }
              }}
              style={{ padding: '10px 20px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
              Add to Assets / Stock
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

const trStyle = { borderBottom: '1px solid #f1f5f9' };
const tdLabelStyle = { padding: '12px 0', width: '35%', color: '#64748b', fontSize: '14px' };
const tdValueStyle = { padding: '12px 0', color: '#0f172a', fontSize: '14px' };
