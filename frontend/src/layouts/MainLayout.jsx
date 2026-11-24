import React, { useEffect, useRef, useLayoutEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Topbar from '../components/Topbar';
import Navbar from '../components/Navbar';
import NewsTicker from '../components/NewsTicker';
import SharedDataLists from '../components/SharedDataLists';
import ChatBotWidget from '../components/ChatBotWidget';
import { useGlobalHotkeys } from '../hooks/useGlobalHotkeys';
import GlobalSearch from '../components/GlobalSearch';
import { usePermissions, refreshPermissions } from '../utils/permissions';

export default function MainLayout() {

  const navigate = useNavigate();
  const location = useLocation();
  const headerRef = useRef(null);

  // Measure global header height → CSS variable for HRModule to use
  useLayoutEffect(() => {
    const update = () => {
      if (headerRef.current) {
        document.documentElement.style.setProperty(
          '--header-h', headerRef.current.offsetHeight + 'px'
        );
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token && location.pathname !== '/login') {
      navigate('/login');
    }
  }, [navigate, location]);

  // 30-Oct-2026: module rights - refreshed from the server on load, page blocked when the user has no View right
  const P = usePermissions();
  useEffect(() => { refreshPermissions(); }, []);
  const blockedModule = P.restricted ? (() => { const k = P.moduleForRoute(location.pathname + (location.search || '')); return k && !P.canView(k) ? k : null; })() : null;

  useGlobalHotkeys({
    onSave: () => { console.log('Global Save Triggered (Ctrl+S)'); },
    onNew:  () => { console.log('Global New Triggered (Ctrl+N)'); }
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const elements = document.querySelectorAll('body > button, body > div');
      elements.forEach(el => {
        if (el.id === 'root') return;
        const text = el.textContent || el.innerText || '';
        if (text.includes('DARK MODE') || text.includes('Dark Mode')) el.remove();
        if (text.includes('ERP COPILOT') || text.includes('ERP Copilot')) el.remove();
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const isHR = location.pathname === '/hr-module';

  return (
    <div className="app-container">
      <header ref={headerRef} className="global-header">
        <Topbar />
        <Navbar />
        <NewsTicker />
      </header>

      <main className={`main-content animate-fade-in${isHR ? ' hr-module-page' : ''}`}
            style={isHR ? {} : { paddingBottom: '30px' }}>
        <SharedDataLists />
        {/* 08-Nov-2026: one Back button on every screen (also Alt + Left arrow / the mouse back button) - goes to the screen
            opened before this one; from the first screen of the session it goes to the Dashboard */}
        {location.pathname !== '/dashboard' && (
          <button type="button" title="Back to the previous screen (Alt + Left arrow)"
            onClick={() => { if (window.history.state && window.history.state.idx > 0) navigate(-1); else navigate('/dashboard'); }}
            style={{ position: 'fixed', left: 14, bottom: 14, zIndex: 900, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 999,
              border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontWeight: 700, fontSize: 12, cursor: 'pointer', boxShadow: '0 4px 12px rgba(15,23,42,.18)' }}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>&#8592;</span> Back
          </button>
        )}
        {blockedModule ? (
          <div style={{ margin: '40px auto', maxWidth: '520px', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '8px', padding: '20px 24px', textAlign: 'center' }}>
            <div style={{ fontWeight: 800, color: '#9a3412', fontSize: '15px', marginBottom: '6px' }}>No access to "{blockedModule}"</div>
            <div style={{ color: '#7c2d12', fontSize: '12px' }}>Your user does not have the View right for this module. Ask the admin to grant it in Master &gt; User Management.</div>
            {P.canView('Live Overview') && <button onClick={() => navigate('/dashboard')} style={{ marginTop: '12px', padding: '6px 14px', border: '1px solid #fdba74', background: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', color: '#9a3412' }}>Go to Dashboard</button>}
          </div>
        ) : <Outlet />}
      </main>
      
      

      {/* Application Footer */}
      <footer style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '24px',
        background: 'linear-gradient(90deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)',
        color: 'var(--bg-panel, var(--bg-panel, #ffffff))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 1rem',
        fontSize: '11px',
        zIndex: 1000
      }}>
        <span>&copy; 2026 All Rights Reserved | Design and Developed by eagle view 360.</span>
      </footer>
      <ChatBotWidget />
      <GlobalSearch />
    </div>
  );
}

