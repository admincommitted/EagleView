
import React, { useState, useEffect } from 'react';
import { Save, Search, Edit2, Trash2, RefreshCw, Download } from "lucide-react";
import ModernDatePicker from '../common/ModernDatePicker';
import { askDelete, askYes } from './switchRow';
// 18-Nov-2026: dates as the calendar day in India - the database returns 18-Nov midnight IST as
// "2026-11-17T18:30:00.000Z", and cutting that at 'T' showed (and re-saved) 17-Nov; new Date().toISOString() was
// yesterday before 5:30 am
const ymdLocal = (v) => { if (!v) return ''; const s = String(v).trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const d = v instanceof Date ? v : new Date(s); if (isNaN(d)) return s.slice(0, 10); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export default function CurrencyMasterForm() {
  const [currencies, setCurrencies] = useState([]);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    id: '',
    currencyCode: '',
    currencyName: '',
    importRate: '',
    exportRate: '',
    standard: true,
    effectiveDate: ymdLocal(new Date()),
    notificationNo: ''
  });

  useEffect(() => {
    fetchCurrencies();
  }, []);

  
  const [isSyncing, setIsSyncing] = useState(false);
  // 29-Oct-2026: CBIC customs rates from ICEGATE (notified 1st / 3rd Thursday). The server checks ICEGATE every 6 hours
  // and applies a new notification on its own; this button does it now. cbic = { last, auto, current, upToDate, error }
  const [cbic, setCbic] = useState(null);
  const [cbicBusy, setCbicBusy] = useState(false);
  const fetchCbicStatus = async () => {
    try { const r = await fetch('/api/masters/currencies/cbic-status'); const d = await r.json().catch(() => ({})); if (r.ok) setCbic(d); }
    catch (e) { /* status line just stays empty */ }
  };
  useEffect(() => { fetchCbicStatus(); }, []);
  const handleSyncCbic = async () => {
    // 18-Nov-2026: the notification IN FORCE today goes into the master; a published one that comes into force later is
    // kept in the rate history and applied on its own at its date
    const inForce = cbic && cbic.current ? `Notification ${cbic.current.number} (in force from ${cbic.current.effective || cbic.current.published})` : 'the notification in force today';
    if (!(await askYes(`Fetch the CBIC customs exchange rates from ICEGATE?\n\n${inForce} will be put into the Currency master (import and export rates, effective date). A notification that comes into force later is kept and applied on its date. (Admin only)`))) return;
    setCbicBusy(true);
    try {
      const res = await fetch('/api/masters/currencies/sync-cbic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        alert(data.skipped ? `Currency master already has CBIC notification ${data.notification} (in force from ${data.effective}).` + (data.next ? `\nNext: ${data.next.number} from ${data.next.effective} (applied on its own).` : '')
          : `CBIC notification ${data.notification} (effective ${data.effective}) applied: ${data.updated} updated, ${data.created} new, ${data.unchanged} already current.` + (data.next ? `\nNext: ${data.next.number} from ${data.next.effective} (applied on its own).` : ''));
        fetchCurrencies(); fetchCbicStatus();
      } else alert('Rates not updated: ' + (data.error || ('HTTP ' + res.status)));
    } catch (err) { alert('Rates not updated: ' + err.message); }
    finally { setCbicBusy(false); }
  };
  const toggleCbicAuto = async () => {
    const enabled = !(cbic && cbic.auto);
    try {
      const res = await fetch('/api/masters/currencies/cbic-auto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) alert('Not changed: ' + (data.error || ('HTTP ' + res.status)));
      fetchCbicStatus();
    } catch (err) { alert('Not changed: ' + err.message); }
  };
  const cbicLine = () => {
    if (!cbic) return '';
    const nxt = cbic.next ? ` Next: CBIC ${cbic.next.number} from ${cbic.next.effective} (applied on its own).` : '';
    if (cbic.last) return `Master has CBIC ${cbic.last.number} (effective ${cbic.last.effective || '-'})` + (cbic.current && !cbic.upToDate ? ` - in force today: ${cbic.current.number}, not yet applied` : cbic.upToDate ? ' - in force today' : '') + nxt;
    if (cbic.current) return `Master has no CBIC rates yet - ICEGATE has ${cbic.current.number}`;
    return cbic.error ? 'ICEGATE not reachable: ' + cbic.error : '';
  };

  // 28-Oct-2026: asks first (market rates are not the CBIC-notified customs rates) and shows the result / error
  const handleSyncLive = async () => {
    if (!(await askYes('Fetch live MARKET rates for all currencies?\n\nThese are not the CBIC-notified customs exchange rates. Use them only if no notification rate is available. (Admin only)'))) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/masters/currencies/sync-live', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        alert(`${data.updatedCount} currency rate(s) updated from market rates.`);
        fetchCurrencies();
      } else alert('Rates not updated: ' + (data.error || ('HTTP ' + res.status)));
    } catch (err) {
      alert('Rates not updated: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Code,Currency Name,Import Rate,Export Rate,Standard,Effective Date,Notification No'];
    const rows = filteredData.map(c => 
      `${c.currencyCode},"${c.currencyName}",${c.importRate},${c.exportRate},${c.standard ? 'YES' : 'NO'},${c.effectiveDate ? ymdLocal(c.effectiveDate) : ''},"${c.notificationNo || ''}"`
    );
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "customs_exchange_rates.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchCurrencies = async () => {
    try {
      const res = await fetch('/api/masters/currencies');
      const data = await res.json();
      setCurrencies(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const getCurrencySymbol = (code) => {
    try {
      const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).formatToParts(1);
      const symbolPart = parts.find(p => p.type === 'currency');
      return symbolPart ? symbolPart.value : '';
    } catch(e) {
      return '';
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert('ERROR: Image size must be less than 500KB'); // customAlert does not exist in this file
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, customLogo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const EMPTY_CUR = { id: '', currencyCode: '', currencyName: '', importRate: '', exportRate: '', standard: true, effectiveDate: ymdLocal(new Date()), notificationNo: '' };
  const handleSave = async () => {
    if(!formData.currencyCode || !formData.currencyName) return alert('Currency code and name are required');
    if(!/^[A-Z]{3}$/.test(String(formData.currencyCode).trim())) return alert('Currency code must be 3 letters (ISO 4217), e.g. USD');
    for (const k of ['importRate', 'exportRate']) if (formData[k] !== '' && formData[k] != null && !(Number(formData[k]) > 0)) return alert('Rates must be more than 0');
    try {
      const url = formData.id ? `/api/masters/currencies/${formData.id}` : '/api/masters/currencies';
      const method = formData.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if(res.ok) {
        setFormData(EMPTY_CUR);
        fetchCurrencies();
      } else { const err = await res.json().catch(() => ({})); alert('Not saved: ' + (err.error || ('HTTP ' + res.status))); }
    } catch (err) {
      alert('Not saved: ' + err.message);
    }
  };

  const handleEdit = (item) => {
    setFormData({
      ...item,
      effectiveDate: item.effectiveDate ? ymdLocal(item.effectiveDate) : '',
      notificationNo: item.notificationNo || ''
    });
  };
  
  const handleDelete = async (id) => {
    if (!(await askDelete('Delete this currency?'))) return;
    try {
      const res = await fetch(`/api/masters/currencies/${id}`, { method: 'DELETE' });
      if (!res.ok) { const err = await res.json().catch(() => ({})); return alert('Not deleted: ' + (err.error || ('HTTP ' + res.status))); }
      if (String(formData.id) === String(id)) setFormData(EMPTY_CUR);
      fetchCurrencies();
    } catch (err) {
      alert('Not deleted: ' + err.message);
    }
  };

  const filteredData = currencies.filter(c => 
    c.currencyCode?.toLowerCase().includes(search.toLowerCase()) || 
    c.currencyName?.toLowerCase().includes(search.toLowerCase())
  );


  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const tagName = document.activeElement.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
           if (document.activeElement.placeholder !== 'SEARCH...') return;
        }

        e.preventDefault();
        const currentIndex = filteredData.findIndex(c => c.id === formData.id);
        if (currentIndex === -1) return;

        let nextIndex = currentIndex;
        if (e.key === 'ArrowDown' && currentIndex < filteredData.length - 1) {
          nextIndex = currentIndex + 1;
        } else if (e.key === 'ArrowUp' && currentIndex > 0) {
          nextIndex = currentIndex - 1;
        }

        if (nextIndex !== currentIndex && filteredData[nextIndex]) {
          handleEdit(filteredData[nextIndex]);
          const element = document.getElementById(`currency-item-${filteredData[nextIndex].id}`);
          if (element) {
             element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredData, formData]);


  return (
    <>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
      {/* Left Sidebar for Search & Select */}
      <div className="glass-panel" style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRight: '1px solid var(--border-color, #e2e8f0)', boxShadow: '1px 0 4px rgba(0,0,0,0.02)', zIndex: 10 }}>
        <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <Search size={16} color="#3b82f6" /> SEARCH
              <span style={{ fontSize: '10px', backgroundColor: 'var(--primary-bg-light, #e0f2fe)', color: 'var(--text-muted, var(--text-muted, #475569))', padding: '2px 6px', borderRadius: '12px', marginLeft: 'auto' }}>
                {currencies.length} TOTAL
              </span>
            </h3>
        </div>
        <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="SEARCH..." value={search} onChange={e => setSearch(e.target.value)} 
            style={{ marginBottom: '8px' }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {filteredData.map(c => (
                <li 
                  id={`currency-item-${c.id}`} 
                  key={c.id} 
                  onClick={() => handleEdit(c)} 
                  style={{ 
                    padding: '12px 16px', 
                    borderBottom: '1px solid var(--border-color, #cbd5e1)', borderLeft: formData.id === c.id ? '4px solid #3b82f6' : '4px solid transparent', margin: '0 8px', borderRadius: formData.id === c.id ? '6px' : '0', 
                    cursor: 'pointer', 
                    background: formData.id === c.id ? '#eff6ff' : 'transparent', 
                    color: formData.id === c.id ? 'var(--primary-color-end, #1d4ed8)' : 'var(--text-main, var(--text-main, #0f172a))',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: formData.id === c.id ? '0 2px 6px rgba(59,130,246,0.15)' : 'none', transform: formData.id === c.id ? 'scale(1.01)' : 'scale(1)'
                  }}
                  onMouseEnter={(e) => { if(formData.id !== c.id) e.currentTarget.style.background = 'var(--bg-input, var(--bg-input, #f1f5f9))' }}
                  onMouseLeave={(e) => { if(formData.id !== c.id) e.currentTarget.style.background = 'transparent' }}
                >
                  <img 
                    src={c.customLogo || `https://flagcdn.com/w40/${c.currencyCode ? c.currencyCode.substring(0, 2).toLowerCase() : 'us'}.png`} 
                    alt="flag" 
                    style={{ width: '36px', height: '26px', borderRadius: '4px', objectFit: 'cover', background: 'var(--bg-app, var(--bg-app, #f8fafc))', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} 
                    onError={(e) => { e.target.src = 'https://flagcdn.com/w40/us.png'; }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: formData.id === c.id ? 700 : 600, color: formData.id === c.id ? 'var(--primary-color-end, #1d4ed8)' : 'var(--text-main, var(--text-main, #0f172a))', fontSize: '13px', transition: 'color 0.2s' }}>
                      {c.currencyName}
                    </div>
                    <div style={{ color: 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '11px', marginTop: '2px', fontWeight: 600, transition: 'color 0.2s' }}>
                      {c.currencyCode} {getCurrencySymbol(c.currencyCode) ? `(${getCurrencySymbol(c.currencyCode)})` : ''}
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      </div>
      
      {/* Right Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

<div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}><span style={{ width: '8px', height: '18px', background: 'linear-gradient(to bottom, #3b82f6, #0ea5e9)', borderRadius: '4px' }}></span> UPDATE EXCHANGE RATE</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 0.8fr 1.25fr 1.4fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Currency Code</label>
            <input type="text" className="input-field" placeholder="e.g. USD" maxLength={3} style={{ textTransform: "uppercase" }} value={formData.currencyCode || ""} onChange={e => setFormData({...formData, currencyCode: e.target.value.toUpperCase()})} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Currency Name</label>
            <input type="text" className="input-field" placeholder="e.g. US Dollar" value={formData.currencyName || ""} onChange={e => setFormData({...formData, currencyName: e.target.value.toUpperCase()})} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Import Rate (₹)</label>
            <input type="number" className="input-field" placeholder="0.00" value={formData.importRate || ""} onChange={e => setFormData({...formData, importRate: e.target.value})} step="0.0001" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Export Rate (₹)</label>
            <input type="number" className="input-field" placeholder="0.00" step="0.0001" value={formData.exportRate || ""} onChange={e => setFormData({...formData, exportRate: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Standard</label>
            <select className="input-field" value={formData.standard ? "YES" : "NO"} onChange={e => setFormData({...formData, standard: e.target.value === "YES"})}>
              <option value="YES">Yes</option>
              <option value="NO">No</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Effective Date</label>
            <ModernDatePicker className="input-field" value={formData.effectiveDate} onChange={e => setFormData({...formData, effectiveDate: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Notification No</label>
            <input type="text" className="input-field" placeholder="e.g. 75/2026-CUS(NT)" value={formData.notificationNo || ""} onChange={e => setFormData({...formData, notificationNo: e.target.value.toUpperCase()})} />
          </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Custom Flag</label>
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ fontSize: '10px', padding: '4px', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px', width: '100%' }} />
            </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => setFormData(EMPTY_CUR)}>Clear</button>
          <button className="btn btn-primary" onClick={handleSave}><Save size={16}/> {formData.id ? 'Update' : 'Save'}</button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, color: 'var(--text-main, var(--text-main, #0f172a))', whiteSpace: 'nowrap', fontSize: '14px', fontWeight: 700 }}>
              CUSTOMS EXCHANGE RATES
              <span style={{ fontSize: '10px', background: '#e0f2fe', color: 'var(--primary-text, #0284c7)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, letterSpacing: '0.5px' }}>
                {currencies.length} TOTAL
              </span>
            </h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap' }}>
              <button onClick={handleSyncCbic} disabled={cbicBusy} title={cbicLine() || 'Customs exchange rates notified by CBIC, from ICEGATE'} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd', padding: '0 12px', height: '32px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <RefreshCw size={12} className={cbicBusy ? "spin" : ""} /> {cbicBusy ? "FETCHING..." : "SYNC CBIC RATES (ICEGATE)"}
              </button>
              <button onClick={handleSyncLive} disabled={isSyncing} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-app, var(--bg-app, #f8fafc))', color: 'var(--text-main, var(--text-main, #0f172a))', border: '1px solid var(--border-color, #cbd5e1)', padding: '0 12px', height: '32px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <RefreshCw size={12} className={isSyncing ? "spin" : ""} /> {isSyncing ? "SYNCING..." : "SYNC LIVE RATES"}
              </button>
              <button onClick={exportToCSV} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #000000', padding: '0 12px', height: '32px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Download size={12} /> EXPORT CSV
              </button>
              <input type="text" className="input-field" placeholder="Search currency..." style={{ width: '180px', height: '32px', fontSize: '12px', padding: '0 10px' }} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          {cbic && (cbicLine() || cbic.error) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: cbic.upToDate ? '#15803d' : '#b45309', margin: '-6px 0 10px' }}>
              <span>{cbicLine()}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--text-muted, #64748b)', marginLeft: 'auto', whiteSpace: 'nowrap' }} title="The server checks ICEGATE every 6 hours and applies a new notification on its own">
                <input type="checkbox" checked={!!cbic.auto} onChange={toggleCbicAuto} /> Auto-update from ICEGATE
              </label>
            </div>
          )}
  
          <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ background: 'linear-gradient(90deg, var(--bg-app, #f8fafc), var(--bg-input, #f1f5f9))', borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600 }}>Code</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600 }}>Currency Name</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>Import Rate</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>Export Rate</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600 }}>Effective Date</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
                  <td style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img src={item.customLogo || `https://flagcdn.com/w40/${item.currencyCode ? item.currencyCode.substring(0, 2).toLowerCase() : 'us'}.png`} alt="flag" style={{ width: '20px', height: '15px', borderRadius: '2px', objectFit: 'cover', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }} onError={(e) => { e.target.src = 'https://flagcdn.com/w40/us.png'; }} />
                      <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #000000', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
                        {item.currencyCode} {getCurrencySymbol(item.currencyCode) ? `- ${getCurrencySymbol(item.currencyCode)}` : ''}
                      </span>
                    </td>
                  <td style={{ padding: '0.75rem 1rem' }}>{item.currencyName}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--accent-color)', fontWeight: 600 }}>₹ {item.importRate}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--primary-text, #0369a1)', fontWeight: 600 }}>₹ {item.exportRate}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{item.effectiveDate ? ymdLocal(item.effectiveDate).split("-").reverse().join("-") : ""}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <span onClick={() => handleEdit(item)} style={{ color: "var(--primary-color-end, #2563eb)", cursor: "pointer", fontWeight: 600, marginRight: "10px" }}>Edit</span>
                      <span onClick={() => handleDelete(item.id)} style={{ color: "#ef4444", cursor: "pointer", fontWeight: 600 }}>Delete</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
      </div>
    </div>
    </>
  );
}
