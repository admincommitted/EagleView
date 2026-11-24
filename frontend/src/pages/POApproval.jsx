import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { CheckCircle, XCircle, ShoppingCart } from 'lucide-react';

export default function POApproval() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPo] = useState(null);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    fetchPO();
  }, [id]);

  const fetchPO = async () => {
    const res = await axios.get(`/api/po/${id}`);
    setPo(res.data);
  };

  const handleAction = async (status) => {
    // 16-Nov-2026: the server's reason is shown (only admin / director, already approved, ...) instead of failing silently
    try {
      await axios.put(`/api/po/${id}/action`, { status, remarks });
      alert(`PO ${status}`);
    } catch (e) {
      alert('Not saved: ' + ((e.response && e.response.data && e.response.data.error) || e.message));
    }
    fetchPO();
  };

  if(!po) return <div>Loading...</div>;

  const handleDownloadPDF = () => {
    const element = document.getElementById('printable-po');
    const opt = {
      margin:       0.5,
      filename:     `${po.poNumber}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>PO Approval: {po.poNumber}</h2>
      
      <div style={{ background: '#f8fafc', padding: '15px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <p><strong>Vendor:</strong> {po.Vendor ? po.Vendor.vendorName : 'N/A'}</p>
        <p><strong>Branch:</strong> {po.branch}</p>
        <p><strong>Priority:</strong> {po.priority}</p>
        <p><strong>Status:</strong> {po.status} </p>
        <p><strong>Submitted On:</strong> {po.submittedAt ? new Date(po.submittedAt).toLocaleString() : new Date(po.createdAt).toLocaleString()}</p>
        <p><strong>Remarks:</strong> {po.justification}</p>
        {po.directorRemarks && <p><strong>Director Remarks:</strong> <span style={{color: po.status === 'Approved' ? '#16a34a' : '#ef4444', fontWeight: 'bold'}}>{po.directorRemarks}</span> <span style={{fontSize: '12px', color: '#64748b', marginLeft: '6px'}}>(ON {po.actionAt ? new Date(po.actionAt).toLocaleString() : new Date(po.updatedAt).toLocaleString()})</span></p>}
        {po.quoteFilePath && <p><a href={po.quoteFilePath} target="_blank">View Quotation</a></p>}
      </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <thead>
          <tr style={{ background: '#e2e8f0' }}>
            <th style={thStyle}>Item Name</th>
            <th style={thStyle}>Qty</th>
            <th style={thStyle}>Unit Price</th>
            <th style={thStyle}>GST %</th>
            <th style={thStyle}>GST Amt</th>
            <th style={thStyle}>Total</th>
          </tr>
        </thead>
        <tbody>
          {po.items && po.items.map(item => {
            const base = item.quantity * item.unitPrice;
            const gstAmt = base * (item.gstRate / 100);
            return (
              <tr key={item.id}>
                <td style={tdStyle}>{item.itemName}</td>
                <td style={tdStyle}>{item.quantity}</td>
                <td style={tdStyle}>₹{item.unitPrice}</td>
                <td style={tdStyle}>{item.gstRate}%</td>
                <td style={tdStyle}>₹{gstAmt.toFixed(2)}</td>
                <td style={tdStyle}>₹{(base + gstAmt).toFixed(2)}</td>
              </tr>
            );
          })}
          <tr>
            <td colSpan="5" style={{...tdStyle, textAlign: 'right', fontSize: '18px', fontWeight: '900', color: '#0f172a'}}>GRAND TOTAL:</td>
              <td style={{...tdStyle, fontSize: '20px', fontWeight: '900', color: '#0f172a'}}>&#8377;{Number(po.totalAmount).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {(po.status === 'Pending Approval' || po.status === 'Hold') && (
        <div style={{ padding: '15px', background: 'white', border: '1px solid #cbd5e1' }}>
          <textarea placeholder="Director Remarks..." value={remarks} onChange={e=>setRemarks(e.target.value)} style={{ width: '100%', height: '60px', marginBottom: '10px' }} />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={()=>handleAction('Approved')} style={{ background: '#16a34a', color: 'white', padding: '10px', border: 'none', cursor: 'pointer' }}>Approve PO</button>
            <button onClick={()=>handleAction('Rejected')} style={{ background: '#dc2626', color: 'white', padding: '10px', border: 'none', cursor: 'pointer' }}>Reject PO</button>
            {po.status !== 'Hold' && <button onClick={()=>handleAction('Hold')} style={{ background: '#d97706', color: 'white', padding: '10px', border: 'none', cursor: 'pointer' }}>Put on Hold</button>}
          </div>
        </div>
      )}

      {po.status === 'Approved' && (
        <div style={{ marginTop: '20px', padding: '15px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <h4>Material Received? Add to Assets</h4>
          <button onClick={() => navigate('/asset-management')} style={{ padding: '8px 15px', background: '#16a34a', color: 'white', border: 'none', cursor: 'pointer' }}>Go to Asset Management</button>
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: '8px', border: '1px solid #cbd5e1', textAlign: 'left' };
const tdStyle = { padding: '8px', border: '1px solid #cbd5e1' };

