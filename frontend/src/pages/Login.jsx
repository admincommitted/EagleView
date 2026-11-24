import React, { useState, useEffect } from 'react';
import { User, Lock, ShieldCheck, Box, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [userId, setUserId] = useState(() => localStorage.getItem('rememberedUserId') || '');
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('rememberedUserId'));
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // 14-Nov-2026: a login from outside the office asks for a 6-digit code e-mailed to the user
  const [otp, setOtp] = useState(null); // { id, sentTo }
  const [otpCode, setOtpCode] = useState('');
  const navigate = useNavigate();

  const handleForgot = async () => {
    if (!userId) {
      setError('Please enter your User ID first, then click Forgot?');
      return;
    }
    setError('');
    setSuccess('');
    try {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        const data = await response.json();
        if (response.ok) {
            setSuccess(data.message);
        } else {
            setError(data.error || 'Failed to reset password');
        }
    } catch (err) {
        setError('Cannot connect to server');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
        const response = otp
            ? await fetch('/api/auth/login/otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otpId: otp.id, code: otpCode.trim() }) })
            : await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: userId, password })
        });
        const data = await response.json();
        if (response.ok && data.otpRequired) {
            setOtp({ id: data.otpId, sentTo: data.sentTo }); setOtpCode('');
            setSuccess(`${data.message} (sent to ${data.sentTo})`);
            return;
        }
        if (!response.ok && otp && data.restart) { setOtp(null); setOtpCode(''); }
        if (response.ok) {
            localStorage.setItem('token', data.data ? data.data.accessToken : data.token);
            localStorage.setItem('user', JSON.stringify(data.data ? data.data.user : data.user));
            // 30-Oct-2026: /uploads files are behind the login; links cannot send a header, so the token also goes in a cookie
            try { document.cookie = `edi_token=${encodeURIComponent(data.data ? data.data.accessToken : data.token)}; path=/uploads; SameSite=Lax; max-age=86400${window.location.protocol === 'https:' ? '; Secure' : ''}`; } catch (e) { /* cookies blocked */ }
            if (rememberMe) {
              localStorage.setItem('rememberedUserId', userId);
            } else {
              localStorage.removeItem('rememberedUserId');
            }
            // 16-Nov-2026: a Director (PO approver) lands on the POs waiting for his approval
            const loggedRole = String(((data.data ? data.data.user : data.user) || {}).role || '').toLowerCase();
            window.location.href = loggedRole === 'director' ? '/purchase-management' : '/dashboard';
        } else {
            setError(data.error || 'Login failed');
        }
    } catch (err) {
        setError('Cannot connect to server. Please check your network.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'Inter', system-ui, sans-serif", backgroundColor: 'var(--bg-app, var(--bg-app, #f8fafc))' }}>
      
      {/* Left Side: Premium Corporate Branding */}
      <div style={{ 
          flex: 1, 
          padding: '5rem 4rem', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, var(--primary-color-end, #1e3a8a) 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden'
      }}>
        
        <div style={{ position: 'relative', zIndex: 10, maxWidth: '600px' }}>
          
          <div style={{ minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center', perspective: '1000px' }}>
            <h2  style={{ 
              fontSize: '3.5rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.5rem', letterSpacing: '-1px', 
              color: 'var(--bg-panel, var(--bg-panel, #ffffff))', 
              opacity: 1 
            }}>
              <span style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>EagleView</span> <br/>
              <span style={{ background: 'linear-gradient(to right, #f8fafc, var(--primary-color-start, #38bdf8))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: 'none', display: 'inline-block' }}>
                Customs Clearance.
              </span>
            </h2>
            
            <p  style={{ 
              fontSize: '1.15rem', color: 'var(--border-color, var(--border-color, #e2e8f0))', lineHeight: 1.7, 
              marginBottom: '2rem', fontWeight: 400, minHeight: '80px', textShadow: '0 1px 5px rgba(0,0,0,0.5)',
              opacity: 1 
            }}>
              File Shipping Bills and Bills of Entry directly to ICEGATE. Experience lightning-fast assessments, automated duty calculations, and zero-delay cargo clearances.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '2.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--bg-app, var(--bg-app, #f8fafc))', fontWeight: 600 }}>
                  <ShieldCheck size={20} color="var(--primary-border, #38bdf8)" /> Secure Access
                </div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Enterprise-grade security</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--bg-app, var(--bg-app, #f8fafc))', fontWeight: 600 }}>
                  <Box size={20} color="var(--primary-border, #38bdf8)" /> Global Tracking
                </div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Real-time logistics control</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: High-Class Login Form */}
      <div style={{ flex: '0 0 500px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', position: 'relative', boxShadow: 'none' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(to right, var(--primary-color-start, #38bdf8), var(--primary-color-end, #2563eb))', zIndex: 30 }}></div>
        
        <div style={{ position: 'absolute', top: '2rem', right: '2rem', display: 'flex', zIndex: 20 }}>
            <img src="/logo.png" alt="Committed Cargo Care Limited" style={{ height: '35px', display: 'block', mixBlendMode: 'multiply' }} />
        </div>

        <div style={{ 
          width: '100%', 
          maxWidth: '420px',
          padding: '0 2rem',
          position: 'relative',
          zIndex: 10
        }}>
          
          <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-main, var(--text-main, #0f172a))', marginBottom: '0.75rem', letterSpacing: '-0.5px' }}>Welcome Back</h2>
          </div>
          
          {error && (
            <div style={{ 
                backgroundColor: '#fef2f2', 
                border: '1px solid #fecaca', 
                color: '#dc2626', 
                padding: '12px 16px', 
                borderRadius: '8px', 
                marginBottom: '2rem', 
                fontSize: '0.9rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#dc2626' }}></div>
                {error}
            </div>
          )}
            
            {success && (
              <div style={{ 
                  backgroundColor: '#ecfdf5', 
                  border: '1px solid #a7f3d0', 
                  color: '#059669', 
                  padding: '12px 16px', 
                  borderRadius: '8px', 
                  marginBottom: '2rem', 
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
              }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#059669' }}></div>
                  {success}
              </div>
            )}

          <form onSubmit={handleLogin}>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginLeft: '4px', textTransform: 'uppercase' }}>User ID</label>
              </div>
              <div style={{ position: 'relative' }}>
                <User size={18} color="#94a3b8" style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  required 
                  value={userId} 
                  onChange={(e) => setUserId(e.target.value.toUpperCase())}
                  placeholder="e.g. ADMIN" 
                  style={{ 
                      width: '100%', 
                      padding: '1rem 1rem 1rem 3rem', 
                      borderRadius: '12px', 
                      border: '1px solid var(--border-color, #e2e8f0)', 
                      fontSize: '1rem', 
                      color: 'var(--text-main, #0f172a)', 
                      outline: 'none', 
                      backgroundColor: 'var(--bg-panel, #ffffff)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s ease',
                      boxSizing: 'border-box',
                      letterSpacing: '0.05em',
                      fontWeight: 600
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--primary-border, #38bdf8)'; e.target.style.boxShadow = '0 0 0 4px var(--primary-shadow, rgba(56,189,248,0.1))'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-color, #e2e8f0)'; e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'; }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginLeft: '4px', textTransform: 'uppercase' }}>Password</label>
                <span onClick={handleForgot} style={{ fontSize: '0.8rem', color: 'var(--primary-color-end, #2563eb)', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={e=>e.target.style.color='var(--primary-color-end, #1d4ed8)'} onMouseOut={e=>e.target.style.color='var(--primary-color-end, #2563eb)'}>Forgot Password?</span>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type={showPassword ? 'text' : 'password'}
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********" 
                  style={{ 
                      width: '100%', 
                      padding: '1rem 3rem 1rem 3rem', 
                      borderRadius: '12px', 
                      border: '1px solid var(--border-color, #e2e8f0)', 
                      fontSize: '1rem', 
                      color: 'var(--text-main, var(--text-main, #0f172a))', 
                      outline: 'none', 
                      backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s ease',
                      boxSizing: 'border-box'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--primary-border, #38bdf8)'; e.target.style.boxShadow = '0 0 0 4px var(--primary-shadow, rgba(56,189,248,0.1))'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-color, #e2e8f0)'; e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'; }}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '1.2rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                >
                  {showPassword ? <EyeOff size={18} color="#94a3b8" /> : <Eye size={18} color="#94a3b8" />}
                </button>
              </div>
            </div>

            {otp && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label htmlFor="otpCode" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginLeft: '4px', textTransform: 'uppercase' }}>Login code (e-mailed to {otp.sentTo})</label>
                  <span onClick={() => { setOtp(null); setOtpCode(''); setSuccess(''); }} style={{ fontSize: '0.8rem', color: 'var(--primary-color-end, #2563eb)', fontWeight: 600, cursor: 'pointer' }}>Start again</span>
                </div>
                <input id="otpCode" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={otpCode} autoFocus
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code"
                  style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)', fontSize: '1.4rem', letterSpacing: '0.4em', textAlign: 'center', fontWeight: 700, boxSizing: 'border-box', backgroundColor: 'var(--bg-panel, #ffffff)', color: 'var(--text-main, #0f172a)' }} />
              </div>
            )}

            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center' }}>
              <input 
                type="checkbox" 
                id="remember" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ 
                  marginRight: '8px', 
                  width: '16px', 
                  height: '16px', 
                  borderRadius: '4px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  accentColor: 'var(--primary-color-start, #38bdf8)'
                }} 
              />
              <label htmlFor="remember" style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)', cursor: 'pointer', fontWeight: 500 }}>Remember my User ID</label>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                width: '100%', 
                padding: '1rem', 
                borderRadius: '12px', 
                background: 'linear-gradient(to right, var(--primary-color-start, #0284c7), var(--primary-color-end, #0369a1))',
                color: 'white', 
                border: 'none', 
                fontSize: '1rem', 
                fontWeight: 700, 
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.25)',
                transition: 'all 0.3s ease',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
              onMouseOver={(e) => { if(!loading) { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 6px 20px rgba(2, 132, 199, 0.4)'; } }}
              onMouseOut={(e) => { if(!loading) { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 14px rgba(2, 132, 199, 0.25)'; } }}
            >
              {loading ? (
                <>
                  <span style={{ fontSize: '0.9rem' }}>AUTHENTICATING...</span>
                </>
              ) : (
                <>
                  <span>{otp ? 'Verify code' : 'Sign In'}</span>
                  <span>&rarr;</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
