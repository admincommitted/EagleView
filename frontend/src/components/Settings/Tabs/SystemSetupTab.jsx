import React, { useState, useEffect } from 'react';
import { Settings, Database, CheckCircle, AlertCircle, Building2, Save, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

// Company profile (table CompanyProfile, /api/settings/company). 28-Oct-2026: this tab was only a placeholder.
const PROFILE_FIELDS = [
  { k: 'companyName', l: 'Company name *', w: 2 }, { k: 'legalName', l: 'Legal name (as in GST / IEC)', w: 2 },
  { k: 'address1', l: 'Address line 1', w: 2 }, { k: 'address2', l: 'Address line 2', w: 2 },
  { k: 'city', l: 'City' }, { k: 'state', l: 'State' }, { k: 'pincode', l: 'PIN code', max: 6 }, { k: 'country', l: 'Country' },
  { k: 'gstin', l: 'GSTIN', max: 15 }, { k: 'pan', l: 'PAN', max: 10 }, { k: 'iec', l: 'IEC', max: 10 }, { k: 'cin', l: 'CIN', max: 21 },
  { k: 'phone', l: 'Phone' }, { k: 'email', l: 'Email' }, { k: 'website', l: 'Website', w: 2 },
  { k: 'defaultCurrency', l: 'Default currency', max: 3 },
  { k: 'timezone', l: 'Time zone', opts: ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'UTC'] },
  { k: 'dateFormat', l: 'Date format', opts: ['DD/MM/YYYY', 'DD-MM-YYYY', 'DD-MMM-YYYY', 'YYYY-MM-DD'] },
];
const UPPER = new Set(['gstin', 'pan', 'iec', 'cin', 'defaultCurrency', 'state', 'country']);

function CompanyProfileCard() {
  const [form, setForm] = useState({});
  const [base, setBase] = useState({});
  const [saving, setSaving] = useState(false);
  const load = () => fetch('/api/settings/company').then(r => r.json()).then(d => { if (d.success) { setForm(d.data || {}); setBase(d.data || {}); } }).catch(e => toast.error('Could not load company profile: ' + e.message));
  useEffect(() => { load(); }, []);
  const dirty = PROFILE_FIELDS.some(f => String(form[f.k] || '') !== String(base[f.k] || ''));
  const set = (k, v) => setForm(p => ({ ...p, [k]: UPPER.has(k) ? v.toUpperCase() : v }));
  const save = async () => {
    if (!String(form.companyName || '').trim()) return toast.error('Company name is required');
    setSaving(true);
    try {
      const body = {}; PROFILE_FIELDS.forEach(f => { body[f.k] = form[f.k] == null ? '' : form[f.k]; });
      const r = await fetch('/api/settings/company', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || 'Save failed');
      setForm(d.data); setBase(d.data); toast.success('Company profile saved');
    } catch (e) { toast.error('Not saved: ' + e.message); } finally { setSaving(false); }
  };
  const inp = { width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', fontSize: '13px', background: 'var(--bg-input, #fff)', color: 'var(--text-main, #0f172a)', boxSizing: 'border-box' };
  return (
    <div>
      <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', color: 'var(--text-main, #1e293b)', display: 'flex', alignItems: 'center', gap: '8px' }}><Building2 size={20} color="#0284c7" /> Company Profile</h3>
      <p style={{ margin: '0 0 16px 0', color: 'var(--text-muted, #64748b)', fontSize: '0.85rem' }}>Your company details, used on reports and documents.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
        {PROFILE_FIELDS.map(f => (
          <label key={f.k} style={{ gridColumn: f.w === 2 ? 'span 2' : undefined, display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>
            {f.l}
            {f.opts
              ? <select value={form[f.k] || f.opts[0]} onChange={e => set(f.k, e.target.value)} style={inp}>{f.opts.map(o => <option key={o} value={o}>{o}</option>)}</select>
              : <input value={form[f.k] || ''} maxLength={f.max || 255} onChange={e => set(f.k, e.target.value)} style={inp} />}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>{dirty ? 'Changes not saved' : 'Saved'}</span>
        <button type="button" onClick={() => setForm(base)} disabled={!dirty || saving} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', background: 'transparent', color: 'var(--text-main, #334155)', fontWeight: 700, cursor: 'pointer' }}><RotateCcw size={15} /> RESET</button>
        <button type="button" onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '6px', border: 'none', background: '#0284c7', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}><Save size={15} /> {saving ? 'SAVING...' : 'SAVE PROFILE'}</button>
      </div>
    </div>
  );
}

export default function SystemSetupTab() {
  const [userRole, setUserRole] = useState(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [toast, setToast] = useState({ type: null, message: null });

  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    if (token === 'dummy-token') {
      setUserRole('admin');
    } else {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload && payload.role) setUserRole(payload.role);
      } catch (e) {}
    }
  }, []);

  const handleBackup = async () => {
    if (!window.confirm("Start complete system backup? This might take a few seconds.")) return;
    setIsBackingUp(true);
    setToast({ type: null, message: null });
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch('/api/auth/system-backup', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', message: "Backup completed successfully! Saved to: " + data.backupDir });
      } else {
        setToast({ type: 'error', message: "Backup failed: " + data.error });
      }
    } catch (err) {
      setToast({ type: 'error', message: "Backup error: " + err.message });
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div style={{ background: 'var(--bg-panel, #ffffff)', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid var(--border-color, #e2e8f0)', minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
      
      <CompanyProfileCard />

      {/* Admin Backup Section */}
      {userRole === 'admin' && (
        <div style={{ borderTop: '1px solid var(--border-color, #e2e8f0)', paddingTop: '24px', marginTop: '24px' }}>
          <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-main, #1e293b)' }}>Admin Tools</h4>
          
          {toast.message && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px',
              padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              backgroundColor: toast.type === 'success' ? '#ecfdf5' : '#fee2e2',
              color: toast.type === 'success' ? '#059669' : '#dc2626',
              border: toast.type === 'success' ? '1px solid #10b981' : '1px solid #ef4444'
            }}>
              {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              {toast.message}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                <Database size={18} color="#0284c7" />
                Complete System Backup
              </div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                Copies the source code (Frontend + Backend, without node_modules) and a clean copy of the SQL database to the backups folder. Restricted to Admins.
              </div>
            </div>
            <button 
              onClick={handleBackup} 
              disabled={isBackingUp} 
              style={{ 
                padding: '10px 20px', borderRadius: '8px', border: 'none', 
                backgroundColor: '#0284c7', color: '#fff', fontWeight: 700, fontSize: '13px', 
                cursor: isBackingUp ? 'not-allowed' : 'pointer', marginLeft: '16px', whiteSpace: 'nowrap',
                opacity: isBackingUp ? 0.7 : 1
              }}
            >
              {isBackingUp ? 'BACKING UP...' : 'TRIGGER FULL BACKUP'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
