// Module-wise user rights on the frontend (30-Oct-2026)
// Source of truth is the backend: /api/users/modules (catalog with routes) and /api/users/my-permissions.
// Rules (same as node-backend/middleware/permissions.js):
//   admin -> everything; user with no rights saved -> everything (legacy); otherwise canView per module.
import { useEffect, useState } from 'react';

const EVT = 'edi-permissions-changed';

const readJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || '') ?? d; } catch (e) { return d; } };
export const getUser = () => readJson('user', {}) || {};
export const isAdmin = () => String(getUser().role || '').toLowerCase() === 'admin';
export const getCatalog = () => readJson('moduleCatalog', null);

// array of {moduleName, canView, canCreate, canEdit, canDelete} (may be empty = nothing allowed) or null (no restrictions set)
export const getPermissions = () => { const p = getUser().permissions; return Array.isArray(p) ? p : null; };
export const isRestricted = () => !isAdmin() && !!getPermissions();

const rowOf = (key) => (getPermissions() || []).find(p => p.moduleName === key) || null;
const FIELDS = ['canView', 'canCreate', 'canEdit', 'canDelete'];
const EMPTY = { canView: false, canCreate: false, canEdit: false, canDelete: false };
// catalog lookups: forms belong to a module; a module's rights are the union of its forms
const parentOf = (key) => { const cat = getCatalog(); if (!cat || !cat.groups) return null; for (const g of cat.groups) for (const m of g.modules) if ((m.forms || []).some(f => f.key === key)) return m.key; return null; };
const formsOf = (key) => { const cat = getCatalog(); if (!cat || !cat.groups) return []; for (const g of cat.groups) for (const m of g.modules) if (m.key === key) return (m.forms || []).map(f => f.key); return []; };
// effective rights of a form (own row, else the module row) or a module (own row OR any form row)
export const effective = (key) => {
  const parent = parentOf(key);
  if (parent) return rowOf(key) || rowOf(parent) || EMPTY;
  const acc = { ...(rowOf(key) || EMPTY) };
  for (const f of formsOf(key)) { const r = rowOf(f); if (r) for (const x of FIELDS) acc[x] = acc[x] || !!r[x]; }
  return acc;
};
export const canView = (key) => !isRestricted() || !!effective(key).canView;
export const canCreate = (key) => !isRestricted() || !!(effective(key).canCreate || effective(key).canEdit);
export const canEdit = (key) => !isRestricted() || !!effective(key).canEdit;
export const canDelete = (key) => !isRestricted() || !!effective(key).canDelete;

// /mdm/<x> is the old spelling of /master/<x>
const norm = (p) => String(p || '').replace(/^\/mdm(\/|$)/, '/master$1').replace(/\/+$/, '') || '/';
// module / form key that owns a frontend path (longest prefix wins; "?tab=" / "#tab" entries match path+query);
// null when nothing in the catalog claims it
export const moduleForRoute = (path) => {
  const cat = getCatalog(); if (!cat || !cat.groups) return null;
  const full = String(path || ''); const p = norm(full.split('?')[0]); let best = null, len = -1;
  const test = (raw, key) => {
    let ok;
    if (raw.includes('?') || raw.includes('#')) ok = full === raw || full.startsWith(raw + '&');
    else { const pre = norm(raw); ok = pre === '/' ? p === '/' : (p === pre || p.startsWith(pre + '/')); }
    if (ok && raw.length > len) { best = key; len = raw.length; }
  };
  for (const g of cat.groups) for (const m of g.modules) {
    for (const r of m.routes || []) test(r, m.key);
    for (const f of m.forms || []) for (const r of f.routes || []) test(r, f.key);
  }
  return best;
};
// can the user open this path (pathname, optionally with ?query)? unknown paths are open
export const canOpen = (path) => { if (!isRestricted()) return true; const k = moduleForRoute(path); return !k || canView(k); };

// Pulls the catalog + the caller's rights from the server and stores them; fires an event so menus re-render
// 09-Nov-2026: two parts of the page asked at the same time on every page open; they now share one request
let permInflight = null;
export function refreshPermissions() {
  if (permInflight) return permInflight;
  permInflight = refreshPermissionsNow().finally(() => { permInflight = null; });
  return permInflight;
}
async function refreshPermissionsNow() {
  const token = localStorage.getItem('token'); if (!token) return;
  const h = { Authorization: 'Bearer ' + token };
  try {
    const [c, p] = await Promise.all([fetch('/api/users/modules', { headers: h }), fetch('/api/users/my-permissions', { headers: h })]);
    if (c.ok) { const cat = await c.json(); if (cat && cat.groups) { localStorage.setItem('moduleCatalog', JSON.stringify(cat)); localStorage.setItem('moduleCatalogError', ''); } }
    else localStorage.setItem('moduleCatalogError', 'HTTP ' + c.status);
    if (p.ok) { const me = await p.json(); const u = getUser(); u.permissions = me.permissions || null; if (me.role) u.role = me.role; localStorage.setItem('user', JSON.stringify(u)); }
    window.dispatchEvent(new Event(EVT));
  } catch (e) { /* offline: keep what we have */ }
}

// re-renders the caller when rights or the catalog change
export function usePermissions() {
  const [, setTick] = useState(0);
  useEffect(() => { const f = () => setTick(t => t + 1); window.addEventListener(EVT, f); window.addEventListener('storage', f); return () => { window.removeEventListener(EVT, f); window.removeEventListener('storage', f); }; }, []);
  return { isAdmin: isAdmin(), restricted: isRestricted(), canOpen, canView, canCreate, canEdit, canDelete, moduleForRoute, effective };
}
