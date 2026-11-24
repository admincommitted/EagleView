import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { startDomFlags } from './domFlags';
import axios from 'axios';

// ── Global Axios Interceptor — attach JWT token to every request ──────────────
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  const c = window.__acctx; // 06-Nov-2026: top-bar branch / financial year (GlobalContext)
  if (c && String(config.url || '').startsWith('/api')) { config.headers = config.headers || {}; if (c.branch) config.headers['X-Branch'] = c.branch; if (c.fyId) config.headers['X-FY'] = String(c.fyId); }
  return config;
}, (error) => Promise.reject(error));

axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      syncTokenCookie();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// 30-Oct-2026: /uploads files need the login too; links cannot send a header, so the token also lives in a cookie
// that the server checks (set here on every load, cleared on logout / 401)
export const syncTokenCookie = () => {
  try {
    const t = localStorage.getItem('token');
    document.cookie = t ? `edi_token=${encodeURIComponent(t)}; path=/uploads; SameSite=Lax; max-age=86400${window.location.protocol === 'https:' ? '; Secure' : ''}` : 'edi_token=; path=/uploads; max-age=0'; // Secure on https (14-Nov-2026)
  } catch (e) { /* cookies blocked */ }
};
syncTokenCookie();
window.addEventListener('storage', (e) => { if (e.key === 'token') syncTokenCookie(); });

// ── Also patch global fetch to send token and handle 401 ──────────────────────
const _origFetch = window.fetch;
window.fetch = async function(url, opts = {}) {
  const token = localStorage.getItem('token');
  if (token && typeof url === 'string' && url.startsWith('/api')) {
    opts.headers = { ...(opts.headers || {}), 'Authorization': `Bearer ${token}` };
  }
  const c = window.__acctx; // 06-Nov-2026: top-bar branch / financial year (GlobalContext)
  if (c && typeof url === 'string' && url.startsWith('/api')) { const hb = {}; if (c.branch) hb['X-Branch'] = c.branch; if (c.fyId) hb['X-FY'] = String(c.fyId); opts.headers = { ...(opts.headers || {}), ...hb }; }
  const response = await _origFetch(url, opts);
  if (response.status === 401 && typeof url === 'string' && !url.includes('/api/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      syncTokenCookie();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
  }
  return response;
};
// ─────────────────────────────────────────────────────────────────────────────

startDomFlags(); // marker classes used by index.css in place of :has() (22-Nov-2026)
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
