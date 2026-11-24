// Screen section: TACT & IATA Compliance Masters
// Split out of TactMasterForm.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Download, FileText, Plane, Save } from 'lucide-react';
import React from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { askConfirm } from '../../switchRow';

export default function TactAndIataSection({ ctx }) {
  const { activeSubTab, downloadCSV, fetchData, searchTerm, setActiveSubTab, setSearchTerm, tabs } = ctx;
  return (
    <>
    <style>{`
        .tact-table tr { transition: all 0.2s ease-in-out; }
        .tact-table tbody tr:hover { background-color: #e0f2fe !important;  box-shadow: 0 4px 15px rgba(2, 132, 199, 0.25); z-index: 10; position: relative; cursor: pointer; }
        .tact-table tbody tr:nth-child(even) { background-color: #f8fafc; }
        .tact-table td { color: #1e293b; font-weight: 600; font-size: 14px; }
        .tact-table th { color: #ffffff !important; }
      `}</style>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>TACT & IATA Compliance Masters</h2>
          <p style={{ color: '#475569', fontWeight: '500', margin: '4px 0 0 0', fontSize: '12px' }}>Manage Country Rules, Carrier Embargoes, DGR, and Surcharges </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          
          <button 
            onClick={downloadCSV}
            style={{ backgroundColor: '#f59e0b', color: 'white', padding: '6px 14px', fontSize: '14px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)' , boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)' }}
          >
            <Download size={16} />
            Download Data
          </button>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#10b981', color: '#ffffff', padding: '6px 14px', fontSize: '14px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' , boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)' }}>
            <FileText size={16} color='#ffffff' /> <span style={{color: '#ffffff'}}>BULK UPLOAD CSV</span>
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={async (e) => {
                if(!e.target.files[0]) return;
                const file = e.target.files[0];
                if (activeSubTab === 'gcr') { toast.error('GCR rates cannot be uploaded from CSV'); e.target.value = null; return; }
                // 28-Oct-2026: replace or add - uploading the same file twice doubled every row
                const replace = await askConfirm({ title: 'Replace or add?', message: 'Replace all existing rows of this tab with the file, or add the file rows to them?', note: 'Uploading the same file twice with "Add" doubles every row.', okLabel: 'Replace all rows', cancelLabel: 'Add to existing rows' });
                const formData = new FormData();
                formData.append('file', file);
                const toastId = toast.loading('Uploading Data...');
                try {
                  const res = await axios.post(`/api/tact/upload/${activeSubTab}?mode=${replace ? 'replace' : 'append'}`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
                  toast.success(res.data.message, { id: toastId });
                  fetchData();
                } catch(err) {
                  toast.error(err.response?.data?.error || 'Upload failed', { id: toastId });
                }
                e.target.value = null;
            }} />
          </label>
          <button 
            onClick={() => {
              toast.loading('Syncing with SQL Database...', { id: 'sync' });
              fetchData().then(() => toast.success('TACT Rules Synchronized Successfully!', { id: 'sync' }));
            }}
            style={{ backgroundColor: '#2563eb', color: 'white', padding: '6px 14px', fontSize: '14px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)' }}
          >
            <Save size={16} />
            Reload from SQL
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
          
  const getCompanyLogo = (make) => {
    if (!make || make === 'N/A') return <span style={{ color: '#94a3b8' }}>N/A</span>;
    
    let brandColor = '#475569';
    let brandName = make.toUpperCase();

    if (make === 'Airbus') { brandColor = '#00205B'; }
    if (make === 'Boeing') { brandColor = '#0039A6'; }
    if (make === 'Embraer') { brandColor = '#00508F'; }
    if (make === 'ATR') { brandColor = '#0062A5'; }
    if (make === 'Bombardier') { brandColor = '#333333'; }
    if (make === 'McDonnell Douglas') { brandColor = '#D3212D'; }
    if (make === 'Antonov') { brandColor = '#0055A4'; }
    if (make === 'Ilyushin') { brandColor = '#1d4ed8'; }
    if (make === 'Lockheed Martin') { brandColor = '#475569'; }
    if (make === 'Cessna') { brandColor = '#0369a1'; }
    if (make === 'Saab') { brandColor = '#004B87'; }
    if (make === 'Fokker') { brandColor = '#F58220'; }
    if (make === 'Tupolev') { brandColor = '#b91c1c'; }
    if (make === 'British Aerospace') { brandColor = '#1d4ed8'; }
    if (make === 'Beechcraft') { brandColor = '#0f172a'; }
    if (make === 'Fairchild') { brandColor = '#334155'; }
    if (make === 'Short Brothers') { brandColor = '#0f766e'; }
    if (make === 'Convair') { brandColor = '#57534e'; }

    
  
return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ 
          width: '20px', height: '20px', borderRadius: '4px', 
          backgroundColor: brandColor, display: 'flex', 
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
        }}>
          <Plane size={12} color="#ffffff" style={{ transform: 'rotate(45deg)' }} />
        </div>
        <span style={{ 
          fontWeight: 'bold', 
          color: brandColor, 
          fontSize: '14px'
        }}>
          {brandName}
        </span>
      </div>
    );
  };
return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  backgroundColor: isActive ? '#eff6ff' : 'transparent',
                  color: isActive ? '#2563eb' : '#64748b',
                  fontWeight: isActive ? 'bold' : '600',
                  boxShadow: isActive ? '0 4px 14px rgba(6, 182, 212, 0.35)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
        
        <div>
          <input 
            type="text" 
            placeholder="Search records..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '8px 16px', borderRadius: '20px', border: '1px solid #cbd5e1', outline: 'none', width: '250px' }}
          />
        </div>
      </div>
    </>
  );
}
