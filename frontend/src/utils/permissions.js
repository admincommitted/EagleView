// Module-wise user rights on the frontend.
// Source of truth is the backend: /users/modules (catalog with routes) and /users/my-permissions.
// Rules (same as node-backend/middleware/permissions.js):
//   admin -> everything; user with no rights saved -> everything (legacy); otherwise canView per module.
import { useAuthStore } from '@/store/authStore';
import { usePermissionsStore } from '@/store/permissionsStore';

export const getUser = () => useAuthStore.getState().user || {};
export const isAdmin = () => String(getUser().role || '').toLowerCase() === 'admin';
export const getCatalog = () => usePermissionsStore.getState().catalog;

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

/** Pulls the catalog and the caller's rights from the server into the stores. */
export const refreshPermissions = () => usePermissionsStore.getState().refresh();

// re-renders the caller when the user's rights or the catalog change
export function usePermissions() {
  useAuthStore((state) => state.user);
  usePermissionsStore((state) => state.catalog);
  return { isAdmin: isAdmin(), restricted: isRestricted(), canOpen, canView, canCreate, canEdit, canDelete, moduleForRoute, effective };
}
