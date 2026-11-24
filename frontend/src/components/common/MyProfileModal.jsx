import React, { useState, useEffect } from 'react';
import { X, User, Briefcase, Phone, MapPin, Building, Save, CheckCircle, Shield, Key } from 'lucide-react';

export default function MyProfileModal({ onClose }) {
  const [profile, setProfile] = useState({
    firstName: '', lastName: '', phone: '', companyName: '', jobTitle: '', address: '',
    reportingTo1: '', reportingTo2: '', limitMin: '', limitMax: '', password: ''
  });
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch('/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data) setProfile({...data, password: ''});
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        setShowToast(true);
        window.dispatchEvent(new CustomEvent('profile-updated'));
        setTimeout(() => {
            setShowToast(false);
            onClose();
        }, 1500);
      } else {
        alert("Failed to save profile");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving profile");
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
      zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease-out', padding: '20px', overflowY: 'auto'
    }}>
      <div className="glass-panel" style={{
        backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRadius: '20px', width: '100%', maxWidth: '750px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)', overflow: 'hidden',
        animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)', padding: 0,
        display: 'flex', flexDirection: 'column', maxHeight: '90vh'
      }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, var(--primary-color-start, #0ea5e9), var(--primary-color-end, #2563eb))', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '12px' }}>
              <User size={24} color="var(--bg-panel, var(--bg-panel, #ffffff))" strokeWidth={2.5} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--bg-panel, var(--bg-panel, #ffffff))', letterSpacing: '0.5px' }}>MY PROFILE</h2>
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', marginTop: '4px' }}>Manage your personal information</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '8px', borderRadius: '50%', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.2)'} onMouseOut={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}>
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-app, var(--bg-app, #f8fafc))', overflowY: 'auto' }}>
          
          <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary-text, #94a3b8)', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={14} /> Personal Details
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-main, #334155)', fontWeight: 700, textTransform: 'uppercase' }}>First Name</label>
                  <input type="text" className="input-field" value={profile.firstName || ''} onChange={e => setProfile({...profile, firstName: e.target.value})} placeholder="e.g. Rahul" style={{ padding: '6px 10px', borderRadius: '6px', border: '2px solid var(--border-color, #e2e8f0)', fontSize: '12px', background: 'var(--bg-app, var(--bg-app, #f8fafc))' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-main, #334155)', fontWeight: 700, textTransform: 'uppercase' }}>Last Name</label>
                  <input type="text" className="input-field" value={profile.lastName || ''} onChange={e => setProfile({...profile, lastName: e.target.value})} placeholder="e.g. Sharma" style={{ padding: '6px 10px', borderRadius: '6px', border: '2px solid var(--border-color, #e2e8f0)', fontSize: '12px', background: 'var(--bg-app, var(--bg-app, #f8fafc))' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-main, #334155)', fontWeight: 700, textTransform: 'uppercase' }}><Phone size={14} color="var(--text-muted, var(--text-muted, #64748b))"/> Phone</label>
                  <input type="text" className="input-field" value={profile.phone || ''} onChange={e => setProfile({...profile, phone: e.target.value})} placeholder="+91 98765 43210" style={{ padding: '6px 10px', borderRadius: '6px', border: '2px solid var(--border-color, #e2e8f0)', fontSize: '12px', background: 'var(--bg-app, var(--bg-app, #f8fafc))' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-main, #334155)', fontWeight: 700, textTransform: 'uppercase' }}><Briefcase size={14} color="var(--text-muted, var(--text-muted, #64748b))"/> Job Title</label>
                  <input type="text" className="input-field" value={profile.jobTitle || ''} onChange={e => setProfile({...profile, jobTitle: e.target.value})} placeholder="e.g. Documentation Exec" style={{ padding: '6px 10px', borderRadius: '6px', border: '2px solid var(--border-color, #e2e8f0)', fontSize: '12px', background: 'var(--bg-app, var(--bg-app, #f8fafc))' }} />
                </div>
              </div>
          </div>

          <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary-text, #94a3b8)', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={14} /> Organization Role (Read-Only)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-main, #334155)', fontWeight: 700, textTransform: 'uppercase' }}>Reporting Manager 1</label>
                  <input type="text" value={profile.reportingTo1 || ''} readOnly style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color, #e2e8f0)', fontSize: '12px', background: 'var(--bg-input, var(--bg-input, #f1f5f9))', color: 'var(--text-muted, var(--text-muted, #64748b))', cursor: 'not-allowed' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-main, #334155)', fontWeight: 700, textTransform: 'uppercase' }}>Reporting Manager 2</label>
                  <input type="text" value={profile.reportingTo2 || ''} readOnly style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color, #e2e8f0)', fontSize: '12px', background: 'var(--bg-input, var(--bg-input, #f1f5f9))', color: 'var(--text-muted, var(--text-muted, #64748b))', cursor: 'not-allowed' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-main, #334155)', fontWeight: 700, textTransform: 'uppercase' }}>Approval Limit (Min)</label>
                  <input type="text" value={profile.limitMin || ''} readOnly style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color, #e2e8f0)', fontSize: '12px', background: 'var(--bg-input, var(--bg-input, #f1f5f9))', color: 'var(--text-muted, var(--text-muted, #64748b))', cursor: 'not-allowed' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-main, #334155)', fontWeight: 700, textTransform: 'uppercase' }}>Approval Limit (Max)</label>
                  <input type="text" value={profile.limitMax || ''} readOnly style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color, #e2e8f0)', fontSize: '12px', background: 'var(--bg-input, var(--bg-input, #f1f5f9))', color: 'var(--text-muted, var(--text-muted, #64748b))', cursor: 'not-allowed' }} />
                </div>
              </div>
          </div>

          <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary-text, #94a3b8)', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Key size={14} /> Security
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-main, #334155)', fontWeight: 700, textTransform: 'uppercase' }}>Change Password</label>
                  <input type="password" value={profile.password || ''} onChange={e => setProfile({...profile, password: e.target.value})} placeholder="Enter new password (leave blank to keep current)" style={{ padding: '6px 10px', borderRadius: '6px', border: '2px solid var(--border-color, #e2e8f0)', fontSize: '12px', background: 'var(--bg-app, var(--bg-app, #f8fafc))' }} />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', marginTop: '2px' }}>If changed, Admin can reset it from User Management.</div>
              </div>
          </div>

        </div>
        
        {/* Footer */}
        <div style={{ display: 'flex', borderTop: '1px solid var(--border-color, #e2e8f0)', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '12px 20px', gap: '10px', justifyContent: 'flex-end', position: 'relative', flexShrink: 0 }}>
          
          <div style={{
            position: 'absolute', left: '24px', top: '50%', transform: 'translateY(-50%)',
            display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', background: '#ecfdf5',
            padding: '8px 16px', borderRadius: '20px', fontWeight: 700, fontSize: '13px',
            opacity: showToast ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: 'none'
          }}>
            <CheckCircle size={18} /> Profile Saved!
          </div>

          <button onClick={onClose} style={{ padding: '6px 16px', borderRadius: '6px', border: '2px solid var(--border-color, #e2e8f0)', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='var(--bg-input, var(--bg-input, #f1f5f9))'} onMouseOut={e=>e.currentTarget.style.background='var(--bg-panel, var(--bg-panel, #ffffff))'}>Cancel</button>
          
          <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, var(--primary-color-start, #0ea5e9), var(--primary-color-end, #2563eb))', color: 'var(--bg-panel, var(--bg-panel, #ffffff))', fontWeight: 700, fontSize: '12px', cursor: 'pointer', boxShadow: '0 4px 12px var(--primary-shadow, rgba(37, 99, 235, 0.3))', transition: 'transform 0.1s' }} onMouseDown={e=>e.currentTarget.style.transform='scale(0.97)'} onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>
            <Save size={18} strokeWidth={2.5} /> SAVE CHANGES
          </button>
        </div>
      </div>
    </div>
  );
}
