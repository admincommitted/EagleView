// ResetPassword.jsx (28-Oct-2026)
// Opened from the e-mailed link /reset-password?token=... ; sets a new password with POST /api/auth/reset-password.
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(token ? '' : 'This reset link is broken. Please ask for a new one from the login page.');
  const [done, setDone] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (pwd.length < 8) return setError('New password must be at least 8 characters.');
    if (pwd !== pwd2) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: pwd })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setDone(data.message || 'Password changed.'); setTimeout(() => navigate('/login'), 2500); }
      else setError(data.error || 'Could not reset the password.');
    } catch (err) {
      setError('Cannot connect to server');
    } finally { setBusy(false); }
  };

  const box = { width: '100%', padding: '12px 14px 12px 40px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 15, boxSizing: 'border-box', outline: 'none' };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', padding: 16 }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 14, padding: 32, boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <ShieldCheck size={22} color="#2563eb" />
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Set a new password</h2>
        </div>
        <p style={{ margin: '0 0 22px', color: '#64748b', fontSize: 13 }}>Committed Cargo Care - EagleView</p>

        {error && <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{error}</div>}
        {done && <div style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{done} Taking you to login...</div>}

        {!done && token && (
          <>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>New password</label>
            <div style={{ position: 'relative', margin: '6px 0 14px' }}>
              <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: 13, top: 14 }} />
              <input type={show ? 'text' : 'password'} value={pwd} onChange={e => setPwd(e.target.value)} style={box} autoFocus autoComplete="new-password" placeholder="At least 8 characters" />
              <span onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 12, top: 12, cursor: 'pointer', color: '#94a3b8' }}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</span>
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Confirm new password</label>
            <div style={{ position: 'relative', margin: '6px 0 20px' }}>
              <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: 13, top: 14 }} />
              <input type={show ? 'text' : 'password'} value={pwd2} onChange={e => setPwd2(e.target.value)} style={box} autoComplete="new-password" />
            </div>
            <button type="submit" disabled={busy} style={{ width: '100%', padding: 12, border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 15, cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? 'Saving...' : 'Save new password'}
            </button>
          </>
        )}
        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13 }}>
          <span onClick={() => navigate('/login')} style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>Back to login</span>
        </p>
      </form>
    </div>
  );
}
