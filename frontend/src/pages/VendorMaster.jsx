// Vendor Master (suppliers for purchase orders).
// 22-Nov-2026: Sr No, search, Edit and Delete added; the screen is in the plain look of the other screens
// (small title, label at the left of its box, flat buttons, grid). A vendor used in a purchase order cannot be
// deleted (the server refuses). API: /api/po/vendors (GET, POST), /api/po/vendors/:id (PUT, DELETE).
import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Users, Save, Pencil, Trash2, RefreshCw, Search } from 'lucide-react';
import { askConfirm } from '../components/common/askConfirm';

const BLANK = { vendorName: '', gstNumber: '', contactEmail: '', phone: '', address: '' };
const errText = (err, fallback) => (err && err.response && err.response.data && err.response.data.error) || fallback;

export default function VendorMaster() {
  const [vendors, setVendors] = useState([]);
  const [formData, setFormData] = useState(BLANK);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [find, setFind] = useState('');
  const nameBox = useRef(null);

  const fetchVendors = async () => {
    try {
      const res = await axios.get('/api/po/vendors');
      setVendors(Array.isArray(res.data) ? res.data : []);
    } catch (err) { toast.error(errText(err, 'The vendor list could not be read')); }
  };
  useEffect(() => { fetchVendors(); }, []);

  const set = (k) => (e) => setFormData({ ...formData, [k]: e.target.value });
  const clear = () => { setFormData(BLANK); setEditId(null); if (nameBox.current) nameBox.current.focus(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.vendorName.trim()) { toast.error('Vendor name is required'); return; }
    setLoading(true);
    try {
      if (editId) await axios.put('/api/po/vendors/' + editId, formData);
      else await axios.post('/api/po/vendors', formData);
      toast.success(editId ? 'Vendor updated' : 'Vendor added');
      clear();
      fetchVendors();
    } catch (err) { toast.error(errText(err, editId ? 'The vendor could not be updated' : 'The vendor could not be added')); }
    setLoading(false);
  };

  const startEdit = (v) => {
    setEditId(v.id);
    setFormData({ vendorName: v.vendorName || '', gstNumber: v.gstNumber || '', contactEmail: v.contactEmail || '', phone: v.phone || '', address: v.address || '' });
    if (nameBox.current) nameBox.current.focus();
  };

  const remove = async (v) => {
    const go = await askConfirm({ title: 'Delete vendor', message: 'Delete ' + v.vendorName + ' from the vendor master?', note: 'This cannot be undone. A vendor used in a purchase order is not deleted.', okLabel: 'Delete', cancelLabel: 'Cancel', tone: 'danger' });
    if (!go) return;
    try {
      await axios.delete('/api/po/vendors/' + v.id);
      toast.success('Vendor deleted');
      if (editId === v.id) clear();
      fetchVendors();
    } catch (err) { toast.error(errText(err, 'The vendor could not be deleted'), { duration: 6000 }); }
  };

  const shown = useMemo(() => {
    const q = find.trim().toUpperCase();
    const list = [...vendors].sort((a, b) => String(a.vendorName || '').localeCompare(String(b.vendorName || '')));
    if (!q) return list;
    return list.filter(v => [v.vendorName, v.gstNumber, v.contactEmail, v.phone, v.address].some(x => String(x || '').toUpperCase().includes(q)));
  }, [vendors, find]);

  const row = { display: 'flex', alignItems: 'center', gap: 8 };
  const lab = { flex: '0 0 96px', margin: 0, whiteSpace: 'nowrap' };
  const head = { margin: '0 0 6px 0', paddingBottom: 2, fontSize: 13, fontWeight: 600, color: 'var(--lg-head, #0f4c6e)', borderBottom: '1px solid var(--lg-line, #bae6fd)', display: 'flex', alignItems: 'center', gap: 8 };
  const iconBtn = { background: 'none', border: 'none', padding: 2, cursor: 'pointer', display: 'inline-flex' };

  return (
    <div style={{ padding: '6px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Users size={15} /> Vendor Master</h2>
        <span style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>Suppliers and vendors for purchase orders</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <div>
          <h3 style={head}>{editId ? 'Edit vendor' : 'Add new vendor'}</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={row}><label style={lab}>Vendor Name <span style={{ color: '#dc2626' }}>*</span></label><input ref={nameBox} className="input-field" style={{ flex: 1, minWidth: 0 }} maxLength={120} value={formData.vendorName} onChange={set('vendorName')} /></div>
            <div style={row}><label style={lab}>GST Number</label><input className="input-field" style={{ flex: 1, minWidth: 0 }} maxLength={15} placeholder="15 characters" value={formData.gstNumber} onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} /></div>
            <div style={row}><label style={lab}>Email Address</label><input className="input-field" type="email" style={{ flex: 1, minWidth: 0 }} maxLength={120} value={formData.contactEmail} onChange={set('contactEmail')} /></div>
            <div style={row}><label style={lab}>Phone Number</label><input className="input-field" style={{ flex: 1, minWidth: 0 }} maxLength={30} value={formData.phone} onChange={set('phone')} /></div>
            <div style={{ ...row, alignItems: 'flex-start' }}><label style={{ ...lab, marginTop: 3 }}>Address</label><textarea className="input-field" style={{ flex: 1, minWidth: 0, height: 56, resize: 'vertical' }} maxLength={400} value={formData.address} onChange={set('address')} /></div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" className="btn btn-secondary" onClick={clear}><RefreshCw size={12} /> {editId ? 'Cancel edit' : 'Clear'}</button>
              <button type="submit" className="btn btn-primary" disabled={loading}><Save size={12} /> {loading ? 'Saving...' : editId ? 'Update vendor' : 'Save vendor'}</button>
            </div>
          </form>
        </div>

        <div style={{ minWidth: 0 }}>
          <h3 style={head}>
            <span>Vendor directory ({shown.length}{shown.length !== vendors.length ? ' of ' + vendors.length : ''})</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 400 }}>
              <Search size={12} /><input className="input-field" style={{ width: 220 }} placeholder="Search name, GST, phone..." value={find} onChange={(e) => setFind(e.target.value)} />
            </span>
          </h3>
          <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 230px)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 46 }}>Sr No</th>
                  <th style={{ width: 40 }}>Edit</th>
                  <th style={{ width: 50 }}>Delete</th>
                  <th>Vendor Name</th>
                  <th>GST</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Address</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((v, i) => (
                  <tr key={v.id} style={editId === v.id ? { backgroundColor: 'var(--lg-page, #e0f2fe)' } : undefined} onDoubleClick={() => startEdit(v)} title="Double-click to edit">
                    <td style={{ textAlign: 'right' }}>{i + 1}</td>
                    <td style={{ textAlign: 'center' }}><button type="button" style={iconBtn} title={'Edit ' + v.vendorName} onClick={() => startEdit(v)}><Pencil size={13} color="var(--theme-base, #0284c7)" /></button></td>
                    <td style={{ textAlign: 'center' }}><button type="button" style={iconBtn} title={'Delete ' + v.vendorName} onClick={() => remove(v)}><Trash2 size={13} color="#dc2626" /></button></td>
                    <td><strong>{v.vendorName}</strong></td>
                    <td>{v.gstNumber || '-'}</td>
                    <td style={{ textTransform: 'none' }}>{v.contactEmail ? String(v.contactEmail).toLowerCase() : '-'}</td>
                    <td>{v.phone || '-'}</td>
                    <td>{v.address || '-'}</td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan="8" style={{ textAlign: 'center', padding: 14, color: 'var(--text-muted, #64748b)' }}>{vendors.length ? 'No vendor matches the search.' : 'No vendor yet - add one at the left.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
