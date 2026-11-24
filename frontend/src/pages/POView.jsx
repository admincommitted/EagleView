import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';

// 09-Nov-2026: the head showed made-up details (COMMITTED CARGO CARE PVT LTD, GSTIN 07AAACC1234F1Z5,
// a placeholder e-mail). It now comes from Settings > Company Profile and the PO's branch in Branch Master; where
// those are still empty, the details printed on the company's tax invoice are used.
const HEAD = {
  name: 'COMMITTED CARGO CARE LIMITED', address1: 'A-406, Road No. 4, Street No. 8, Mahipalpur Extn.', address2: 'New Delhi - 110037, India',
  phone: '011-46151111', email: 'admin@committedcargo.com', gstin: '07AAACC6689E1ZJ', pan: 'AAACC6689E', cin: 'U63090DL1998PLC096746'
};
const val = (v) => (v != null && String(v).trim() !== '' ? String(v).trim() : '');
const dmy = (v) => { const d = new Date(v); if (isNaN(d)) return ''; return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); };

export default function POView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPo] = useState(null);
  const [company, setCompany] = useState({});
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    fetchPO();
  }, [id]);
  useEffect(() => {
    axios.get('/api/settings/company').then(r => setCompany((r.data && r.data.data) || {})).catch(() => {});
    axios.get('/api/masters/company-branches').then(r => { const d = r.data; setBranches(Array.isArray(d) ? d : (d && (d.data || d.rows)) || []); }).catch(() => {});
  }, []);

  const fetchPO = async () => {
    const res = await axios.get(`/api/po/${id}`);
    setPo(res.data);
  };

  if(!po) return <div>Loading...</div>;

  const br = branches.find(b => [b.branchName, b.branchCode, b.icaffeCode].some(x => x && po.branch && String(x).toUpperCase() === String(po.branch).toUpperCase())) || branches.find(b => b.isDefault) || {};
  const coAddr = [val(company.address1), val(company.address2)].filter(Boolean).join(', ');
  const coCity = [val(company.city), val(company.pincode)].filter(Boolean).join(' - ');
  const head = {
    name: val(company.legalName) || val(company.companyName) || HEAD.name,
    line1: coAddr || HEAD.address1,
    line2: coAddr ? [coCity, val(company.state), val(company.country)].filter(Boolean).join(', ') : HEAD.address2,
    gstin: val(company.gstin) || val(br.gstin) || HEAD.gstin,
    pan: val(company.pan) || HEAD.pan,
    cin: val(company.cin) || HEAD.cin,
    phone: val(company.phone) || val(br.phone) || HEAD.phone,
    email: val(company.email) || val(br.email) || HEAD.email,
  };
  const shipAddr = val(br.address) || [head.line1, head.line2].join(', ');

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>PO Details: {po.poNumber}</h2>
        <button onClick={handleDownloadPDF} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)' }}>
          <Download size={18} />
          Download PDF
        </button>
      </div>
      
      <div id="printable-po" style={{ padding: '40px', background: 'white', color: '#000', fontFamily: 'Arial, sans-serif' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '20px' }}>
          <div style={{ width: '65%' }}>
            <h1 style={{ margin: '0 0 5px 0', color: '#0f172a', fontSize: '22px', whiteSpace: 'nowrap' }}>{head.name}</h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>{head.line1}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>{head.line2}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>GSTIN: {head.gstin} &nbsp;|&nbsp; PAN: {head.pan}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>CIN: {head.cin}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#475569', textTransform: 'none' }}>Phone: {head.phone} &nbsp;|&nbsp; Email: {head.email}</p>
          </div>
          <div style={{ textAlign: 'right', width: '35%' }}>
            <h2 style={{ margin: '0 0 10px 0', color: '#2563eb', fontSize: '28px', textTransform: 'uppercase' }}>Purchase Order</h2>
            <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}><strong>PO Number:</strong> {po.poNumber}</p>
            <p style={{ margin: 0, fontSize: '14px' }}><strong>Date:</strong> {dmy(po.createdAt)}</p>
          </div>
        </div>

        {/* Addresses */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
          <div style={{ width: '48%', background: '#f8fafc', padding: '15px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
            <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: '5px', color: '#0f172a' }}>VENDOR DETAILS (TO):</h4>
            <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '14px' }}>{po.Vendor ? po.Vendor.vendorName : 'N/A'}</p>
            {po.Vendor && po.Vendor.address && <p style={{ margin: '0 0 5px 0', fontSize: '12px' }}>{po.Vendor.address}</p>}
            {po.Vendor && po.Vendor.phone && <p style={{ margin: '0 0 5px 0', fontSize: '12px' }}><strong>Phone:</strong> {po.Vendor.phone}</p>}
            {po.Vendor && po.Vendor.contactEmail && <p style={{ margin: '0', fontSize: '12px' }}><strong>Email:</strong> {po.Vendor.contactEmail}</p>}
            {po.Vendor && po.Vendor.gstNumber && <p style={{ margin: '5px 0 0 0', fontSize: '12px' }}><strong>GSTIN:</strong> {po.Vendor.gstNumber}</p>}
          </div>
          <div style={{ width: '48%', background: '#f8fafc', padding: '15px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
            <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: '5px', color: '#0f172a' }}>SHIP TO / BRANCH:</h4>
            <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '14px' }}>{po.branch}</p>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px' }}>{head.name}</p>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px' }}>{shipAddr}</p>
            <p style={{ margin: '0', fontSize: '12px' }}>Please deliver all materials to the above branch address between 10 AM and 6 PM.</p>
          </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', color: '#0f172a' }}>
              <th style={{...thStyle, borderColor: '#cbd5e1', color: '#0f172a'}}>Item Description</th>
              <th style={{...thStyle, borderColor: '#cbd5e1', color: '#0f172a', textAlign: 'center'}}>Qty</th>
              <th style={{...thStyle, borderColor: '#cbd5e1', color: '#0f172a', textAlign: 'right'}}>Unit Price</th>
              <th style={{...thStyle, borderColor: '#cbd5e1', color: '#0f172a', textAlign: 'center'}}>GST %</th>
              <th style={{...thStyle, borderColor: '#cbd5e1', color: '#0f172a', textAlign: 'right'}}>GST Amt</th>
              <th style={{...thStyle, borderColor: '#cbd5e1', color: '#0f172a', textAlign: 'right'}}>Total</th>
            </tr>
          </thead>
          <tbody>
            {po.items && po.items.map(item => {
              const base = item.quantity * item.unitPrice;
              const gstAmt = base * (item.gstRate / 100);
              return (
                <tr key={item.id}>
                  <td style={{...tdStyle, borderColor: '#cbd5e1'}}>
                    <strong>{item.itemName}</strong>
                    {item.isReceived && <span style={{ marginLeft: '10px', fontSize: '10px', background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '12px', fontWeight: 'bold' }}>RECEIVED</span>}
                  </td>
                  <td style={{...tdStyle, borderColor: '#cbd5e1', textAlign: 'center'}}>{item.quantity}</td>
                  <td style={{...tdStyle, borderColor: '#cbd5e1', textAlign: 'right'}}>&#8377;{Number(item.unitPrice).toFixed(2)}</td>
                  <td style={{...tdStyle, borderColor: '#cbd5e1', textAlign: 'center'}}>{item.gstRate}%</td>
                  <td style={{...tdStyle, borderColor: '#cbd5e1', textAlign: 'right'}}>&#8377;{gstAmt.toFixed(2)}</td>
                  <td style={{...tdStyle, borderColor: '#cbd5e1', textAlign: 'right', fontWeight: 'bold'}}>&#8377;{(base + gstAmt).toFixed(2)}</td>
                </tr>
              );
            })}
            <tr style={{ background: '#f8fafc' }}>
              <td colSpan="5" style={{...tdStyle, borderColor: '#cbd5e1', textAlign: 'right', fontSize: '16px', fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase', padding: '15px'}}>Grand Total:</td>
              <td style={{...tdStyle, borderColor: '#cbd5e1', textAlign: 'right', fontSize: '18px', fontWeight: '900', color: '#0f172a'}}>&#8377;{Number(po.totalAmount).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        
        {/* Terms and Conditions */}
        <div style={{ marginTop: '30px', padding: '15px', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
          <h5 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#0f172a', textTransform: 'uppercase' }}>Terms & Conditions:</h5>
          <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '10px', color: '#475569', lineHeight: '1.5' }}>
            <li>Materials must be delivered within the stipulated time frame as mentioned in the PO.</li>
            <li>All items must meet standard quality checks; defective items will be returned at the vendor's expense.</li>
            <li>Invoices must strictly reference this Purchase Order number.</li>
            <li>Payment will be processed within 30 days from the date of successful delivery and invoice submission.</li>
            <li>Subject to New Delhi jurisdiction only.</li>
          </ol>
        </div>

        {/* Footer info & Internal Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '40px' }}>
          <div style={{ width: '60%' }}>
            <h5 style={{ margin: '0 0 5px 0' }}>Internal Approval Details:</h5>
            <div style={{ fontSize: '11px', color: '#475569', background: '#f1f5f9', padding: '10px', borderRadius: '4px', border: '1px dashed #cbd5e1' }}>
              <p style={{ margin: '0 0 4px 0' }}><strong>Status:</strong> {po.status}</p>
              <p style={{ margin: '0 0 4px 0' }}><strong>Priority:</strong> {po.priority}</p>
              <p style={{ margin: '0 0 4px 0' }}><strong>Remarks:</strong> {po.justification}</p>
              {po.directorRemarks && <p style={{ margin: 0 }}><strong>Approval Remarks:</strong> <span style={{color: po.status === 'Approved' ? '#16a34a' : '#ef4444', fontWeight: 'bold'}}>{po.directorRemarks}</span> (ON {po.actionAt ? new Date(po.actionAt).toLocaleString() : new Date(po.updatedAt).toLocaleString()})</p>}
            </div>
          </div>
          
          <div style={{ textAlign: 'center', width: '30%' }}>
            {po.status === 'Approved' && (
              <div style={{ color: '#16a34a', border: '2px solid #16a34a', padding: '10px', display: 'inline-block', borderRadius: '50%', transform: 'rotate(-15deg)', fontWeight: '900', letterSpacing: '2px', fontSize: '20px', marginBottom: '10px', opacity: 0.8 }}>
                APPROVED
              </div>
            )}
            <div style={{ borderTop: '1px solid #000', paddingTop: '5px', marginTop: po.status === 'Approved' ? '0' : '60px' }}>
              <strong>Authorized Signatory</strong>
            </div>
          </div>
        </div>
      </div>

      {po.status === 'Approved' && (
        <div style={{ marginTop: '20px', padding: '15px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <h4>Material Received? Add to Assets</h4>
          <button onClick={() => navigate('/asset-management')} style={{ padding: '8px 15px', background: '#16a34a', color: 'white', border: 'none', cursor: 'pointer' }}>Go to Asset Management</button>
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: '8px', border: '1px solid #cbd5e1', textAlign: 'left', fontSize: '14px' };
const tdStyle = { padding: '8px', border: '1px solid #cbd5e1', fontSize: '14px' };
