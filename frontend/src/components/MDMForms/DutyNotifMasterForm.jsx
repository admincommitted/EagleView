import React, { useState, useEffect } from 'react';
import { Save, Search, RefreshCw, FileText, Settings, PlusCircle, Zap, Upload, Download, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import ModernDatePicker from '../common/ModernDatePicker';
import switchRow, { askDelete } from './switchRow';

export default function DutyNotifMasterForm() {
  const [data, setData] = useState([]);

  const [uiModal, setUiModal] = React.useState({ isOpen: false, title: '', message: '', type: 'success' });
  
  const customAlert = (msg) => {
      let title = 'INFORMATION';
      let type = 'success';
      if(msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('please')) {
          title = 'ERROR';
          type = 'error';
      } else if (msg.toLowerCase().includes('success')) {
          title = 'SUCCESS';
          type = 'success';
      }
      setUiModal({ isOpen: true, title, message: String(msg ?? ''), type });
      setTimeout(() => setUiModal({ isOpen: false, title: '', message: '', type: 'success' }), 3000);
  };

  const [search, setSearch] = useState('');
  
  const [selectedHeader, setSelectedHeader] = useState(null); // 'new' or object

  const initialHeaderForm = { id: '', notifNo: '', type: 'CUSTOM', effectiveDate: '', isActive: true };
  const [headerForm, setHeaderForm] = useState(initialHeaderForm);
  
  const [details, setDetails] = useState([]);
  // 04-Nov-2026: IGST notifications from iCAFFE carry up to 20,000 serial rows (009/2025) - the table shows the rows
  // matching this search (serial / HSN / description), at most DETAIL_LIMIT at a time, so the screen stays responsive
  const [detailQuery, setDetailQuery] = useState('');
  const DETAIL_LIMIT = 300;
  const dq = detailQuery.trim().toLowerCase();
  const matchedDetails = dq ? details.filter(d => String(d.serialNo || '').toLowerCase().startsWith(dq) || String(d.tariffHead || '').startsWith(dq) || String(d.itemDescription || '').toLowerCase().includes(dq)) : details;
  const shownDetails = matchedDetails.slice(0, DETAIL_LIMIT);
  
  const initialDetailRow = { serialNo: '', tariffHead: '', specificSeries: '', dutyRate: 0, itemDescription: '', conditionNo: '', effectiveDate: '' };
  const [newDetailRow, setNewDetailRow] = useState(initialDetailRow);

  useEffect(() => {
    fetchData();
  }, []);

  // 04-Nov-2026: one notification's serial rows, fetched when it is selected (the full list is 200,000+ rows)
  const detailsReq = React.useRef(0);
  const loadDetails = async (id) => {
    const n = ++detailsReq.current;
    setDetails([]);
    if (!id) return;
    try {
      const r = await fetch(`/api/masters/dutynotifs/${id}/details`);
      const d = await r.json();
      if (n === detailsReq.current) setDetails(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
  };

  const fetchData = async () => {
    try {
      const res = await fetch('/api/masters/dutynotifs/all?lite=1'); // headers only; rows load per notification
      const json = await res.json();
      if (!Array.isArray(json)) { customAlert('Error: could not load notifications - ' + (json.error || res.status)); return; }
      setData(json);
      if(selectedHeader && selectedHeader !== 'new') {
        const updated = json.find(t => t.id === selectedHeader.id);
        if(updated) {
            setSelectedHeader(updated);
            setHeaderForm(updated);
            loadDetails(updated.id);
        }
      } else if (!selectedHeader && json.length > 0) {
        setSelectedHeader(json[0]);
        setHeaderForm(json[0]);
        loadDetails(json[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  
  
  const handleDownloadTemplate = () => {
    const csvContent = "NotifNo,Type,HeaderDate,SerialNo,TariffHead,SpecificSeries,DutyRate,DetailDate,ItemDescription,ConditionNo\n" +
                       "050/2017,CUSTOM,2017-06-30,1,8401,,5.00,2017-06-30,Nuclear reactors,9\n" +
                       "011/2018,SWS,2018-02-02,2,2710,,3.00,2018-02-02,Petroleum oils,\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Duty_Notification_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV or Excel (28-Oct-2026): the file is read with SheetJS, so quoted fields and commas inside a description
  // ("Nuclear reactors, boilers") stay in one column (split(',') cut them). Columns are found by their header name.
  // Tariff heads that lost the leading zero in Excel (1011010) get it back (01011010).
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      let rows = [];
      try {
        const wb = XLSX.read(new Uint8Array(event.target.result), { type: 'array', raw: false });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
      } catch (err) { return customAlert('Error: file could not be read - ' + err.message); }
      const pick = (r, ...names) => { for (const k of Object.keys(r)) if (names.includes(k.replace(/[^a-z]/gi, '').toLowerCase())) return String(r[k]).trim(); return ''; };
      const padHead = (h) => { const d = String(h || '').replace(/\s/g, ''); return /^\d+$/.test(d) && [3, 5, 7].includes(d.length) ? '0' + d : d; };
      const data = rows.map(r => ({
        notifNo: pick(r, 'notifno', 'notificationno', 'notification'),
        type: (pick(r, 'type') || 'CUSTOM').toUpperCase(),
        headerDate: pick(r, 'headerdate', 'notificationdate', 'date'),
        serialNo: pick(r, 'serialno', 'slno', 'srno', 'serial'),
        tariffHead: padHead(pick(r, 'tariffhead', 'cth', 'hsn', 'tariffitem')),
        specificSeries: pick(r, 'specificseries'),
        dutyRate: pick(r, 'dutyrate', 'rate'),
        detailDate: pick(r, 'detaildate', 'effectivedate'),
        itemDescription: pick(r, 'itemdescription', 'description'),
        conditionNo: pick(r, 'conditionno', 'condition'),
      })).filter(d => d.notifNo);
      if (!data.length) return customAlert('Error: no rows with a NotifNo column found - use Download Template');
      try {
        const res = await fetch('/api/masters/dutynotifs/bulk-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const out = await res.json().catch(() => ({}));
        if(res.ok) {
          await fetchData();
          customAlert(`Bulk upload successful: ${out.headers || 0} notification(s), ${out.created || 0} serial no(s) added, ${out.updated || 0} updated`);
        } else customAlert('Error: upload failed - ' + (out.error || res.status));
      } catch(err) {
        customAlert('Error: upload failed - ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = null; // reset input
  };

  // the serial no row being edited belongs to the old notification: clear it when another one is picked. 28-Oct-2026
  const handleSelectNew = () => {
    setSelectedHeader('new');
    setHeaderForm(initialHeaderForm);
    setDetails([]);
    setNewDetailRow(initialDetailRow);
  };

  const handleSelectExisting = (item) => {
    setSelectedHeader(item);
    setHeaderForm(item);
    loadDetails(item.id);
    setNewDetailRow(initialDetailRow);
  };

  // 22-Nov-2026: a notification is switched off / on, not deleted (its serial numbers stay with it)
  const handleSwitchHeader = async () => {
    if (!headerForm.id) return;
    const done = await switchRow('dutynotifs', headerForm, 'notification ' + (headerForm.notifNo || '') + ' with its ' + details.length + ' serial no(s)');
    if (done) { setHeaderForm({ ...headerForm, isActive: !headerForm.isActive }); fetchData(); }
  };

  const handleSaveHeader = async () => {
    if(!headerForm.notifNo) return customAlert('Please enter the notification no');
    if(!/^\d{1,3}\/\d{4}/.test(String(headerForm.notifNo).trim())) return customAlert('Please enter the notification no like 050/2017');
    try {
      const url = headerForm.id ? `/api/masters/dutynotifs/${headerForm.id}` : '/api/masters/dutynotifs';
      const method = headerForm.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(headerForm)
      });
      if(res.ok) {
        const saved = await res.json();
        if(selectedHeader === 'new') {
            setSelectedHeader(saved);
            setHeaderForm(saved);
        }
        await fetchData();
        customAlert('Notification saved successfully');
      } else { const err = await res.json().catch(() => ({})); customAlert('Error: not saved - ' + (err.error || res.status)); }
    } catch(e) {
      customAlert('Error: not saved - ' + e.message);
    }
  };

  const handleAddDetail = async () => {
    if(!selectedHeader || selectedHeader === 'new' || !headerForm.id) return customAlert('Please save the notification first');
    if(!newDetailRow.serialNo) return customAlert('Please enter the serial no');
    
    try {
      const payload = { ...newDetailRow, headerId: headerForm.id };
      const url = newDetailRow.id ? `/api/masters/dutynotifdetails/${newDetailRow.id}` : '/api/masters/dutynotifdetails';
      const method = newDetailRow.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if(res.ok) {
        setNewDetailRow(initialDetailRow);
        fetchData(); 
      } else { const err = await res.json().catch(() => ({})); customAlert('Error: serial no not saved - ' + (err.error || res.status)); }
    } catch(e) {
      customAlert('Error: serial no not saved - ' + e.message);
    }
  };

  const handleEditDetailClick = (dtl) => {
    setNewDetailRow({
      id: dtl.id,
      serialNo: dtl.serialNo || '',
      tariffHead: dtl.tariffHead || '',
      specificSeries: dtl.specificSeries || '',
      dutyRate: dtl.dutyRate || 0,
      itemDescription: dtl.itemDescription || '',
      conditionNo: dtl.conditionNo || '',
      effectiveDate: dtl.effectiveDate || ''
    });
  };

  const handleDeleteDetail = async (id) => {
    if (!(await askDelete('Delete this serial no?'))) return;
    try {
      const res = await fetch(`/api/masters/dutynotifdetails/${id}`, { method: 'DELETE' });
      if(res.ok) { if (newDetailRow.id === id) setNewDetailRow(initialDetailRow); fetchData(); } else customAlert('Error: not deleted (HTTP ' + res.status + ')');
    } catch(e) {
      customAlert('Error: not deleted - ' + e.message);
    }
  };

  const filteredData = data.filter(t => 
    t.notifNo?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
      {/* messages (uiModal was set but never shown) - 28-Oct-2026 */}
      {uiModal.isOpen && (
        <div style={{ position: 'fixed', top: '80px', right: '24px', zIndex: 9999, maxWidth: '420px', padding: '12px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, boxShadow: '0 8px 20px rgba(0,0,0,0.15)', background: uiModal.type === 'error' ? '#fef2f2' : '#f0fdf4', border: '1px solid ' + (uiModal.type === 'error' ? '#fca5a5' : '#86efac'), color: uiModal.type === 'error' ? '#b91c1c' : '#15803d' }}>
          {uiModal.title}: {uiModal.message}
        </div>
      )}
      {/* Sidebar */}
      <div className="glass-panel" style={{ width: '280px', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRight: '1px solid var(--border-color, #e2e8f0)', boxShadow: '1px 0 4px rgba(0,0,0,0.02)' }}>
        <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Search size={16} color="var(--primary-text, #0284c7)" /> SEARCH NOTIFICATION ({filteredData.length})
          </h3>
          <input type="text" className="input-field" placeholder="Search Notification No..." style={{ width: '100%', marginBottom: '12px' }} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-app, var(--bg-app, #f8fafc))' }}>
              <tr>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>NOTIF NO</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>TYPE</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((t) => (
                <tr 
                  key={t.id} 
                  onClick={() => handleSelectExisting(t)}
                  style={{ 
                    cursor: 'pointer',
                    background: (selectedHeader && selectedHeader !== 'new' && selectedHeader.id === t.id) ? '#f0f9ff' : '#fff',
                    borderLeft: (selectedHeader && selectedHeader !== 'new' && selectedHeader.id === t.id) ? '3px solid #0284c7' : '3px solid transparent',
                    borderBottom: '1px solid var(--border-color, #cbd5e1)'
                  }}
                >
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))' }}>{t.notifNo}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--primary-text, #0284c7)', fontWeight: 600 }}>{t.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingBottom: '1rem' }}>
        
        {/* Header Form */}
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <div style={{ background: '#f0f9ff', padding: '0.75rem 1rem', borderBottom: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: 'var(--primary-text, #0369a1)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '13px', fontWeight: 700 }}>
              <FileText size={16} /> NOTIFICATION
            </h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={handleDownloadTemplate} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid var(--border-color, #cbd5e1)', color: 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '11px', fontWeight: 600, padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }} title="Download Template">
                <Download size={14} /> TEMPLATE
              </button>
              <label className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0fdf4', border: '1px solid #000000', color: '#166534', fontSize: '11px', fontWeight: 600, padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', margin: 0 }}>
                <Upload size={14} /> BULK UPLOAD
                <input type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFileUpload} />
              </label>
              <div style={{ width: '1px', height: '24px', background: 'var(--border-color, var(--border-color, #cbd5e1))', margin: '0 4px' }}></div>
              <button onClick={handleSelectNew} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px dashed #0284c7', color: 'var(--primary-text, #0369a1)', fontSize: '11px', fontWeight: 600, padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>
                <PlusCircle size={14} /> CREATE NEW
              </button>
              <button onClick={() => { setSelectedHeader(null); setHeaderForm(initialHeaderForm); setDetails([]); }} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-input, var(--bg-input, #f1f5f9))', color: 'var(--text-muted, var(--text-muted, #475569))', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                <RefreshCw size={14} /> CLEAR
              </button>
              {headerForm.id && <button onClick={handleSwitchHeader} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', color: '#b45309', border: '1px solid #f59e0b', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>{headerForm.isActive ? 'SWITCH OFF' : 'SWITCH ON'}</button>}
              <button onClick={handleSaveHeader} className="btn" style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 600, fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }}>
                <Save size={14}/> SAVE
              </button>
            </div>
          </div>
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 0.5fr', gap: '1.5rem', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '4px' }}>NOTIFICATION NO *</label>
                <input type="text" className="input-field" placeholder="E.G. 050/2017" style={{ borderColor: 'var(--primary-color-start, #0ea5e9)', textTransform: 'uppercase' }} value={headerForm.notifNo} onChange={e => setHeaderForm({...headerForm, notifNo: e.target.value.toUpperCase()})} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '4px' }}>TYPE *</label>
                <select className="input-field" value={headerForm.type} onChange={e => setHeaderForm({...headerForm, type: e.target.value})} style={{ borderColor: 'var(--primary-color-start, #0ea5e9)' }}>
                  <option value="CUSTOM">CUSTOM (BCD)</option>
                  <option value="IGST">IGST</option>
                  <option value="SWS">SWS (SURCHARGE)</option>
                  <option value="ADD">ANTI-DUMPING</option>
                  <option value="EXCISE">EXCISE</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '4px' }}>EFFECTIVE DATE *</label>
                <ModernDatePicker className="input-field" value={String(headerForm.effectiveDate || '').slice(0, 10)} onChange={e => setHeaderForm({...headerForm, effectiveDate: e.target.value})} />
              </div>
              <div style={{ paddingBottom: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', margin: 0, fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))' }}>
                  <input type="checkbox" style={{ width: '16px', height: '16px', accentColor: 'var(--primary-text, #0284c7)' }} checked={headerForm.isActive} onChange={e => setHeaderForm({...headerForm, isActive: e.target.checked})} /> ACTIVE
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Details Grid */}
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)', flex: 1, display: 'flex', flexDirection: 'column', opacity: (!selectedHeader || selectedHeader === 'new') ? 0.6 : 1, pointerEvents: (!selectedHeader || selectedHeader === 'new') ? 'none' : 'auto' }}>
          <div style={{ background: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: 'var(--text-muted, var(--text-muted, #475569))', margin: 0, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <Settings size={16} /> NOTIFICATION SERIAL NUMBERS
            </h3>
          </div>
          
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
            
            {/* Add New Detail Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', background: 'var(--bg-input, var(--bg-input, #f1f5f9))', padding: '1rem', borderRadius: '6px', border: '1px dashed var(--border-color, #cbd5e1)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '1rem', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #64748b))', marginBottom: '4px' }}>SERIAL NO *</label>
                  <input type="text" className="input-field" placeholder="E.G. 1, 2A" value={newDetailRow.serialNo} onChange={e => setNewDetailRow({...newDetailRow, serialNo: e.target.value.toUpperCase()})} style={{ borderColor: 'var(--primary-color-start, #0ea5e9)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #64748b))', marginBottom: '4px' }}>TARIFF HEAD</label>
                  <input type="text" className="input-field" placeholder="HSN CODE" value={newDetailRow.tariffHead} onChange={e => setNewDetailRow({...newDetailRow, tariffHead: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #64748b))', marginBottom: '4px' }}>SERIES</label>
                  <input type="text" className="input-field" placeholder="OPTIONAL" value={newDetailRow.specificSeries} onChange={e => setNewDetailRow({...newDetailRow, specificSeries: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #64748b))', marginBottom: '4px' }}>RATE (%)</label>
                  <input type="number" step="0.01" className="input-field" placeholder="0.00" value={newDetailRow.dutyRate} onChange={e => setNewDetailRow({...newDetailRow, dutyRate: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #64748b))', marginBottom: '4px' }}>EFFECTIVE DATE</label>
                  <ModernDatePicker className="input-field" value={String(newDetailRow.effectiveDate || '').slice(0, 10)} onChange={e => setNewDetailRow({...newDetailRow, effectiveDate: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #64748b))', marginBottom: '4px' }}>ITEM DESCRIPTION (GOODS)</label>
                  <input type="text" className="input-field" placeholder="Description of goods exempted..." value={newDetailRow.itemDescription} onChange={e => setNewDetailRow({...newDetailRow, itemDescription: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #64748b))', marginBottom: '4px' }}>CONDITION NO.</label>
                  <input type="text" className="input-field" placeholder="E.g., 9" value={newDetailRow.conditionNo} onChange={e => setNewDetailRow({...newDetailRow, conditionNo: e.target.value})} />
                </div>
                <div>
                  <button onClick={handleAddDetail} className="btn" style={{ padding: '6px 20px', height: '32px', background: newDetailRow.id ? '#f0fdf4' : '#fff', border: newDetailRow.id ? '1px solid #16a34a' : '1px solid var(--border-color, #cbd5e1)', color: newDetailRow.id ? '#16a34a' : 'var(--primary-text, #0369a1)', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>{newDetailRow.id ? '✓ UPDATE' : '+ ADD SERIAL'}</button>
                </div>
              </div>
            </div>

            {/* Child Data Grid */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 6px 0' }}>
              <input type="text" className="input-field" placeholder="SEARCH SERIAL / HSN / DESCRIPTION" value={detailQuery} onChange={e => setDetailQuery(e.target.value)} style={{ maxWidth: '320px' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>
                {matchedDetails.length > shownDetails.length ? `Showing ${shownDetails.length} of ${matchedDetails.length} serial rows - search to narrow` : `${matchedDetails.length} serial row(s)`}
              </span>
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '6px', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', whiteSpace: 'nowrap' }}>
                <thead style={{ background: 'var(--bg-app, var(--bg-app, #f8fafc))' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', borderBottom: '2px solid var(--border-color, #e2e8f0)', fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap' }}>SERIAL</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', borderBottom: '2px solid var(--border-color, #e2e8f0)', fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap' }}>HSN</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', borderBottom: '2px solid var(--border-color, #e2e8f0)', fontWeight: 700, fontSize: '11px' }}>DESCRIPTION</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #475569))', borderBottom: '2px solid var(--border-color, #e2e8f0)', fontWeight: 700, fontSize: '11px' }}>COND.</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #475569))', borderBottom: '2px solid var(--border-color, #e2e8f0)', fontWeight: 700, fontSize: '11px' }}>RATE %</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #475569))', borderBottom: '2px solid var(--border-color, #e2e8f0)', fontWeight: 700, fontSize: '11px' }}>DATE</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted, var(--text-muted, #475569))', borderBottom: '2px solid var(--border-color, #e2e8f0)', fontWeight: 700, fontSize: '11px' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {shownDetails.length > 0 ? (
                    shownDetails.map((dtl) => (
                      <tr key={dtl.id} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', background: '#fff' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--primary-text, #0284c7)' }}>{dtl.serialNo}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 600 }}>{dtl.tariffHead || '-'} {dtl.specificSeries ? `(${dtl.specificSeries})` : ''}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted, var(--text-muted, #475569))', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={dtl.itemDescription}>{dtl.itemDescription || '-'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>{dtl.conditionNo || '-'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--primary-text, #0369a1)', fontWeight: 700 }}>{dtl.dutyRate === null || dtl.dutyRate === undefined || dtl.dutyRate === '' ? '-' : dtl.dutyRate + '%'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{dtl.effectiveDate ? String(dtl.effectiveDate).slice(0, 10).split('-').reverse().join('-') : '-'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <span onClick={() => handleEditDetailClick(dtl)} style={{ color: 'var(--primary-text, #0284c7)', cursor: 'pointer', fontWeight: 700 }}>EDIT</span>
                            <span onClick={() => handleDeleteDetail(dtl.id)} style={{ color: '#ef4444', cursor: 'pointer', fontWeight: 700 }}>REMOVE</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8', fontWeight: 500, fontSize: '12px' }}>
                        {(!selectedHeader || selectedHeader === 'new') ? 'PLEASE SELECT OR CREATE A NOTIFICATION HEADER FIRST.' : (details.length ? 'NO SERIAL MATCHES THE SEARCH.' : 'NO SERIAL NUMBERS ADDED YET.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', textAlign: 'left' }}>
              <Zap size={14} color="var(--primary-color-start, #0ea5e9)"/> * IN JOB ENTRY, ENTERING NOTIFICATION NO WILL INSTANTLY FETCH THESE EXACT SERIAL NUMBERS.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
