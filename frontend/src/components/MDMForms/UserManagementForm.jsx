import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Edit2, Lock, XCircle, RefreshCw, Printer, Search, User, ShieldCheck, Mail, Phone, Briefcase, Building, ChevronDown, Key, CheckCircle, Settings, Layers, Shield } from "lucide-react";

export default function UserManagementForm() {

  useEffect(() => {
    fetch('/api/masters/company-branches')
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.data) {
          setBranches(data.data);
            if (formData.branch === '' && data.data.length > 0) {
            setFormData(prev => ({...prev, branch: data.data[0].branchCode}));
          }
        }
      })
      .catch(err => console.error('Failed to load branches', err));
  }, []);

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '', fullName: '', email: '', contactNumber: '',
    designation: '', department: '', branch: '', reportingTo1: '', reportingTo2: '',
    limitMin: '', limitMax: '', sessionTimeout: 30, allowStatusUpdates: true, role: 'user'
  });
  
  const [password, setPassword] = useState('');
  const selectedUserRef = React.useRef(null);
  const [userSearch, setUserSearch] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [branches, setBranches] = useState([]);
  
  // Custom Popup States
  const [toast, setToast] = useState(null); // { message: '', type: 'success' | 'error' }
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  // 30-Oct-2026: the module list comes from the server (node-backend/utils/moduleCatalog.js) so every module of the
  // app is here and the same list drives the menu, the page guard and the API check. Old saved names are mapped.
  const FALLBACK_GROUPS = [
    { name: 'Dashboard', modules: [{ key: 'Live Overview', label: 'Live Overview (Dashboard)' }] },
    { name: 'Customs Clearance', modules: [{ key: 'Bill of Entry (Import)', label: 'Bill of Entry (Import)' }, { key: 'Shipping Bill (Export)', label: 'Shipping Bill (Export)' }, { key: 'E-Sanchit', label: 'e-Sanchit' }] },
    { name: 'Master Directory', modules: [{ key: 'Core Masters', label: 'Core Masters' }, { key: 'Customs & Compliance', label: 'Customs & Compliance' }, { key: 'Logistics & Operations', label: 'Logistics & Operations' }, { key: 'User Management', label: 'User Management' }] },
    { name: 'Settings', modules: [{ key: 'System Settings', label: 'System Settings' }] }
  ];
  const LEGACY = { 'Daily Transactions': 'Reports', 'Financial & PnL': 'Financial Reports' };
  const [catalog, setCatalog] = useState({ groups: FALLBACK_GROUPS, legacy: LEGACY, loaded: false, error: '' });
  const loadCatalog = () => axios.get('/api/users/modules')
    .then(r => { if (r.data && r.data.groups) setCatalog({ groups: r.data.groups, legacy: r.data.legacy || {}, loaded: true, error: '' }); else throw new Error('bad response'); })
    .catch(e => setCatalog(c => ({ ...c, loaded: false, error: (e && e.response && (e.response.status === 404 ? 'backend not restarted (route /api/users/modules missing)' : 'HTTP ' + e.response.status)) || e.message || 'network error' })));
  useEffect(() => { loadCatalog(); }, []);
  useEffect(() => { if (catalog.loaded) return undefined; const t = setInterval(loadCatalog, 15000); return () => clearInterval(t); }, [catalog.loaded]);
  const ACTIONS = ['canView', 'canCreate', 'canEdit', 'canDelete'];
  const fullRow = (on) => ({ canView: on, canCreate: on, canEdit: on, canDelete: on });
  // rights are saved per form; a module without forms is saved as one row
  const leafKeys = (mod) => (mod.forms && mod.forms.length ? mod.forms.map(f => f.key) : [mod.key]);
  const allModuleKeys = catalog.groups.flatMap(g => g.modules.flatMap(leafKeys));
  const [openModules, setOpenModules] = useState({});
  const toggleOpen = (key) => setOpenModules(prev => ({ ...prev, [key]: !prev[key] }));

  const [permissions, setPermissions] = useState({});
  const anyRight = (p) => !!p && ACTIONS.some(a => p[a]);
  const permCount = catalog.groups.flatMap(g => g.modules).filter(m => leafKeys(m).some(k => anyRight(permissions[k]))).length;
  const moduleTotal = catalog.groups.reduce((s, g) => s + g.modules.length, 0);
  const savedRows = selectedUser && Array.isArray(selectedUser.permissions) ? selectedUser.permissions.length : 0;

  useEffect(() => {
    fetchUsers();
    
    const handleKeyDown = (e) => {
      if (e.key === 'F7') {
        e.preventDefault();
        document.getElementById('save-btn')?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/users');
      const list = Array.isArray(res.data) ? res.data : [];
      setUsers(list);
      // stay on the user being worked on (it jumped to the first user after every save). 28-Oct-2026
      const keep = selectedUserRef.current && list.find(u => u.id === selectedUserRef.current.id);
      if (keep) handleUserSelect(keep);
      else if (list.length > 0) handleUserSelect(list[0]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    selectedUserRef.current = user;
    // a password typed for one user must never be saved on the next one. 28-Oct-2026
    setPassword(''); setConfirmPassword('');
    setFormData({
      username: user.username || '', fullName: user.fullName || '', email: user.email || '', contactNumber: user.contactNumber || '',
      designation: user.designation || '', department: user.department || '', branch: user.branch || '',
      reportingTo1: user.reportingTo1 || '', reportingTo2: user.reportingTo2 || '', limitMin: user.limitMin || '', limitMax: user.limitMax || '',
      sessionTimeout: user.sessionTimeout || 30, allowStatusUpdates: user.allowStatusUpdates ?? true, role: user.role || 'user'
    });
    
    const perms = {};
    if (user.permissions) {
      user.permissions.forEach(p => {
        const key = (catalog.legacy && catalog.legacy[p.moduleName]) || LEGACY[p.moduleName] || p.moduleName;
        const cur = perms[key] || fullRow(false);
        perms[key] = { canView: cur.canView || !!p.canView, canCreate: cur.canCreate || !!p.canCreate, canEdit: cur.canEdit || !!p.canEdit, canDelete: cur.canDelete || !!p.canDelete };
      });
    }
    // a row saved on a module that has forms applies to every form without its own row
    catalog.groups.forEach(g => g.modules.forEach(m => {
      if (m.forms && m.forms.length && perms[m.key]) { m.forms.forEach(f => { if (!perms[f.key]) perms[f.key] = { ...perms[m.key] }; }); delete perms[m.key]; }
    }));
    setPermissions(perms);
  };

  const handleSave = async () => {
    // ── Frontend Validation ──────────────────────────────────────
    if (!formData.username || !formData.username.trim()) {
      showToast('User ID is required.', 'error');
      return;
    }
    if (!formData.fullName || !formData.fullName.trim()) {
      showToast('Full Name is required.', 'error');
      return;
    }

    try {
      const permArray = Object.keys(permissions).map(mod => ({
        moduleName: mod, ...permissions[mod]
      }));
      
      // Normalize User ID to uppercase before saving
      const payload = { ...formData, username: formData.username.trim().toUpperCase(), permissions: permArray };
      if (password || confirmPassword) {
        if (password !== confirmPassword) return showToast('Passwords do not match!', 'error');
        if (password.length < 8) return showToast('Password must be at least 8 characters.', 'error');
        payload.password = password;
      }

      if (selectedUser) {
        await axios.put(`/api/users/${selectedUser.id}`, payload);
        showToast('User details updated successfully!');
      } else {
        if (!payload.password) {
          showToast('Password is required when creating a new user.', 'error');
          return;
        }
        const created = await axios.post('/api/users', payload);
        if (created && created.data && created.data.id) selectedUserRef.current = created.data;
        showToast('New user created successfully!');
      }
      setPassword(''); setConfirmPassword('');
      fetchUsers();
    } catch (err) {
      console.error(err);
      // Show exact error from backend (e.g. duplicate User ID message)
      const backendMsg = err?.response?.data?.error;
      showToast(backendMsg || 'Failed to save user details. Please try again.', 'error');
    }
  };
  
  const handlePasswordReset = async () => {
    if (!selectedUser) return showToast('Please select a user first', 'error');
    if (!password) return showToast('Please enter a new password', 'error');
    if (password !== confirmPassword) return showToast('Passwords do not match!', 'error');
    if (password.length < 8) return showToast('Password must be at least 8 characters.', 'error');
    try {
      await axios.put(`/api/users/${selectedUser.id}`, { password });
      showToast(`Password updated successfully for ${selectedUser.username}`);
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      showToast('Error updating password', 'error');
      console.error(err);
    }
  };

  const handleDisableUser = async () => {
    if (!selectedUser) return showToast('Please select a user to disable.', 'error');
    setConfirmDialog({
      isOpen: true,
      message: `Are you sure you want to disable ${selectedUser.username}?`,
      onConfirm: async () => {
        try {
          await axios.put(`/api/users/${selectedUser.id}`, { status: 'inactive' });
          showToast('User disabled successfully!');
          fetchUsers();
        } catch (err) {
          console.error(err);
          showToast('Failed to disable user', 'error');
        }
      }
    });
  };

  const handleLockUser = async () => {
    if (!selectedUser) return showToast('Please select a user to lock.', 'error');
    setConfirmDialog({
      isOpen: true,
      message: `Are you sure you want to lock ${selectedUser.username}?`,
      onConfirm: async () => {
        try {
          await axios.put(`/api/users/${selectedUser.id}`, { status: 'locked' });
          showToast('User locked successfully!');
          fetchUsers();
        } catch (err) {
          console.error(err);
          showToast('Failed to lock user', 'error');
        }
      }
    });
  };

  // a disabled / locked user can be switched on again (there was no way back). 28-Oct-2026
  const handleEnableUser = async () => {
    if (!selectedUser) return showToast('Please select a user.', 'error');
    try {
      await axios.put(`/api/users/${selectedUser.id}`, { status: 'active' });
      showToast('User enabled successfully!');
      fetchUsers();
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to enable user', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClear = () => {
    setSelectedUser(null);
    selectedUserRef.current = null;
    setFormData({
      username: '', fullName: '', email: '', contactNumber: '',
      designation: '', department: '', branch: '', reportingTo1: '', reportingTo2: '',
      limitMin: '', limitMax: '', sessionTimeout: 30, allowStatusUpdates: true, role: 'user'
    });
    setPermissions({});
    setPassword('');
    setConfirmPassword('');
  };
  
  const handleSelectAll = (isChecked) => {
    const newPerms = {};
    allModuleKeys.forEach(k => { newPerms[k] = fullRow(isChecked); });
    setPermissions(newPerms);
  };

  const handleColumnSelectAll = (field, isChecked) => {
    const newPerms = { ...permissions };
    allModuleKeys.forEach(k => { newPerms[k] = { ...(newPerms[k] || fullRow(false)), [field]: isChecked }; });
    setPermissions(newPerms);
  };

  // one form / one module without forms: all four rights on / off
  const handleLeafAll = (key, isChecked) => setPermissions(prev => ({ ...prev, [key]: fullRow(isChecked) }));
  // one module: every form in it on / off (module-wise selection)
  const handleModuleAll = (mod, isChecked) => setPermissions(prev => { const n = { ...prev }; leafKeys(mod).forEach(k => { n[k] = fullRow(isChecked); }); return n; });
  // one module, one column: e.g. View on every form of Core Masters
  const handleModuleField = (mod, field, isChecked) => setPermissions(prev => { const n = { ...prev }; leafKeys(mod).forEach(k => { n[k] = { ...(n[k] || fullRow(false)), [field]: isChecked }; }); return n; });
  // one group (e.g. whole Accounts): every module in it on / off
  const handleGroupAll = (group, isChecked) => setPermissions(prev => { const n = { ...prev }; group.modules.forEach(m => leafKeys(m).forEach(k => { n[k] = fullRow(isChecked); })); return n; });
  const leafAllOn = (key) => ACTIONS.every(a => permissions[key]?.[a]);
  const moduleAllOn = (mod) => leafKeys(mod).every(k => leafAllOn(k));
  const moduleAnyOn = (mod) => leafKeys(mod).some(k => anyRight(permissions[k]));
  const moduleFieldOn = (mod, field) => leafKeys(mod).every(k => permissions[k]?.[field]);
  const moduleFieldAny = (mod, field) => leafKeys(mod).some(k => permissions[k]?.[field]);
  const groupAllOn = (group) => group.modules.length > 0 && group.modules.every(m => moduleAllOn(m));
  const groupAnyOn = (group) => group.modules.some(m => moduleAnyOn(m));
  const columnAllOn = (field) => allModuleKeys.length > 0 && allModuleKeys.every(k => permissions[k]?.[field]);
  const allOn = allModuleKeys.length > 0 && allModuleKeys.every(k => leafAllOn(k));
  const cb = ({ small, 'data-partial': partial, ...rest }) => <input type="checkbox" {...rest} ref={el => { if (el) el.indeterminate = !!partial && !rest.checked; }} style={{ accentColor: 'var(--primary-color-start, #0284c7)', width: small ? '12px' : '13px', height: small ? '12px' : '13px', cursor: 'pointer' }} />;

  const handleAdminToggle = (isChecked) => {
    setFormData({...formData, role: isChecked ? 'admin' : 'user'});
    if (isChecked) {
      handleSelectAll(true);
    }
  };
  // 16-Nov-2026: Director = PO approver. He logs in, sees Purchase and approves / rejects / holds POs. Purchase (view)
  // is ticked for him, so his rights are limited to the ticked modules (with no rights saved a user opens everything).
  const handleDirectorToggle = (isChecked) => {
    setFormData({...formData, role: isChecked ? 'director' : 'user'});
    if (isChecked) setPermissions(prev => ({ ...prev, 'Purchase Management': { ...(prev['Purchase Management'] || fullRow(false)), canView: true } }));
  };

  const handlePermChange = (modName, field, val) => {
    setPermissions(prev => ({
      ...prev,
      [modName]: { ...(prev[modName] || {}), [field]: val }
    }));
  };

  const inputStyle = {
    width: '100%', 
    padding: '6px 8px', 
    border: '1px solid #cbd5e1', 
    borderRadius: '4px', 
    fontSize: '11px', 
    outline: 'none', 
    backgroundColor: '#ffffff',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
    color: '#0f172a',
    transition: 'all 0.2s ease'
  };

  const labelStyle = {
    display: 'block', 
    fontSize: '10px', 
    fontWeight: 700, 
    color: '#475569', 
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.02em'
  };

  const cardStyle = {
    backgroundColor: 'var(--lg-panel, #f8fbfd)', // 22-Nov-2026: the light form tint of the other screens
    border: '1px solid var(--lg-line, #bae6fd)',
    borderRadius: '4px',
    padding: '0.75rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  };

  return (
    <div className="user-mgmt-container" style={{ display: 'flex', gap: '0.75rem', height: '100%', fontFamily: "'Inter', system-ui, sans-serif", backgroundColor: 'transparent', padding: '0.5rem', position: 'relative' }}>
      <style>{`
        .user-mgmt-container input[type="text"]:focus,
        .user-mgmt-container input[type="email"]:focus,
        .user-mgmt-container input[type="password"]:focus,
        .user-mgmt-container input[type="number"]:focus,
        .user-mgmt-container select:focus {
          border-color: var(--primary-color-end, #075985) !important;
          box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.15) !important;
          background-color: #fffbeb !important;
          outline: none !important;
        }
        /* 22-Nov-2026: the same plain look as the other screens - small title, headings in the theme colour with a
           thin line (no box round a section), label at the left of its box, small flat buttons (Save filled) */
        .um-head { padding: 5px 12px !important; background: var(--bg-panel, #ffffff) !important; border-bottom: 1px solid var(--lg-line, #e2e8f0) !important; }
        .um-head h2 { font-size: 14px !important; font-weight: 600 !important; letter-spacing: 0 !important; margin: 0 !important; display: inline-block; }
        .um-head > div:first-child { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .um-head p { font-size: 11px !important; }
        .um-head > div:not(:first-child) { padding: 2px 9px !important; border-radius: 2px !important; }
        .um-head > div:not(:first-child) > span { font-size: 11px !important; font-weight: 600 !important; }
        .um-body { padding: 6px 12px !important; }
        .um-body > div { max-width: none !important; gap: 8px !important; }
        .um-body section h3 { font-size: 13px !important; font-weight: 600 !important; color: var(--lg-head, #0f4c6e) !important; text-transform: none !important; letter-spacing: 0 !important; padding-bottom: 2px; border-bottom: 1px solid var(--lg-line, #bae6fd); }
        .um-body section > div > h3 { border-bottom: none; padding-bottom: 0; }
        .um-body section > h3 + div { background: transparent !important; border: none !important; box-shadow: none !important; padding: 4px 0 0 0 !important; }
        .um-body section > h3 + div div[style*="grid-template-columns"] { grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)) !important; gap: 4px 16px !important; }
        .um-body section > h3 + div div:has(> label:first-child):not(:has(> h4)) { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .um-body section > h3 + div div:has(> label:first-child) > label:first-child { flex: 0 0 auto; min-width: 150px; margin: 0 !important; white-space: nowrap; }
        .um-body section > h3 + div div:has(> label:first-child) > :not(label:first-child) { flex: 1 1 0; min-width: 0; }
        /* the e-mail box is two columns wide (it was cut); it goes after Contact Number so the row has no gap */
        .um-body section > h3 + div div:has(> label:first-child):has(input[type="email"]) { grid-column: span 2; order: 1; }
        .um-body div:has(> div > h4) { background: transparent !important; border: none !important; padding: 0 !important; }
        .um-body h4 { font-size: 12px !important; font-weight: 600 !important; color: var(--lg-head, #0f4c6e) !important; }
        .um-foot { padding: 5px 60px 5px 12px !important; gap: 6px !important; background: var(--bg-panel, #ffffff) !important; border-top: 1px solid var(--lg-line, #e2e8f0) !important; }
        .um-foot button, .um-body section button { height: 24px !important; padding: 0 10px !important; border-radius: 2px !important; font-size: 11px !important; font-weight: 600 !important; box-shadow: none !important; }
        .um-foot button:not(:last-child):not([style*="rgb(255, 241, 242)"]):not([style*="rgb(240, 253, 244)"]) { background: #ffffff !important; color: var(--lg-head, #0f4c6e) !important; border: 1px solid var(--lg-box-line, #cbd5e1) !important; }
        .um-foot button[style*="rgb(255, 241, 242)"] { background: #ffffff !important; color: #b91c1c !important; border: 1px solid #e3a3a3 !important; }
        .um-foot button:last-child { background: var(--theme-base, #0284c7) !important; color: #ffffff !important; border: 1px solid var(--theme-base, #0284c7) !important; }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes popIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          backgroundColor: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
          padding: '12px 20px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', gap: '10px',
          animation: 'slideInRight 0.3s ease-out forwards'
        }}>
          {toast.type === 'error' ? <XCircle color="#ef4444" size={20} /> : <CheckCircle color="#22c55e" size={20} />}
          <span style={{ color: toast.type === 'error' ? '#991b1b' : '#166534', fontWeight: 600, fontSize: '0.85rem' }}>
            {toast.message}
          </span>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '24px', width: '340px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', animation: 'popIn 0.2s ease-out' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck color="var(--primary-color-start, #0284c7)" size={18} /> Confirm Action
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '0.85rem', color: '#475569', lineHeight: '1.4' }}>{confirmDialog.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: null })} style={{ padding: '8px 16px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', color: '#475569' }}>Cancel</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog({ isOpen: false, message: '', onConfirm: null }); }} style={{ padding: '8px 16px', border: 'none', backgroundColor: 'var(--primary-color-start, #0284c7)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', color: '#ffffff', boxShadow: 'var(--primary-shadow, 0 1px 2px rgba(0,0,0,0.15))' }}>Yes, Proceed</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Left Sidebar */}
      <div style={{ width: '280px', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ backgroundColor: '#eff6ff', padding: '4px', borderRadius: '4px' }}><User size={16} color="#3b82f6" /></div>
            User Directory
          </h2>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" placeholder="Search by name or ID..." value={userSearch} onChange={e => setUserSearch(e.target.value)} style={{ width: '100%', padding: '6px 8px 6px 30px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem', outline: 'none', backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', transition: 'all 0.2s' }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {users.filter(u => !userSearch || `${u.username || ''} ${u.fullName || ''} ${u.email || ''}`.toUpperCase().includes(userSearch.toUpperCase())).map((u, i) => {
            const isSelected = selectedUser?.id === u.id;
            return (
            <div key={i} onClick={() => handleUserSelect(u)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', border: isSelected ? '1px solid var(--primary-color-start, #0284c7)' : '1px solid transparent', backgroundColor: isSelected ? 'var(--primary-bg-light, #e0f2fe)' : 'transparent', transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden' }}>
              {isSelected && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', backgroundColor: 'var(--primary-color-start, #0284c7)' }} />}
              <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: isSelected ? 'linear-gradient(135deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)' : '#f1f5f9', color: isSelected ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
                {(u.fullName || u.username || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isSelected ? 'var(--primary-text, #0369a1)' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.fullName || u.username}</div>
                <div style={{ fontSize: '0.7rem', color: isSelected ? '#c2410c' : '#64748b', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Shield size={10} /> {u.role === 'admin' ? 'Admin' : u.role === 'director' ? 'Director' : 'User'} &bull; {u.username}{(u.status || 'active') !== 'active' && <span style={{ color: u.status === 'locked' ? '#b45309' : '#b91c1c', fontWeight: 700 }}> &bull; {String(u.status).toUpperCase()}</span>}
                </div>
              </div>
              <div title={u.status || 'active'} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: (u.status || 'active') === 'active' ? '#22c55e' : u.status === 'locked' ? '#f59e0b' : '#ef4444', border: '1px solid white', flexShrink: 0 }}></div>
            </div>
          )})}
        </div>
      </div>

      {/* Right Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        
        <div className="um-head" style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px 10px', whiteSpace: 'nowrap' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 2px 0', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>User Profile Settings</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>Manage account details and permissions.</p>
              {selectedUser && <span style={{ color: '#059669', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: '4px', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle size={12} /> Created: {new Date(selectedUser.createdAt).toLocaleDateString('en-GB')}
              </span>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: formData.role === 'admin' ? 'var(--primary-bg-light, #e0f2fe)' : '#f8fafc', padding: '6px 12px', borderRadius: '4px', border: formData.role === 'admin' ? '1px solid var(--primary-color-start, #0284c7)' : '1px solid #e2e8f0', transition: 'all 0.3s' }}>
            <ShieldCheck size={16} color={formData.role === 'admin' ? "var(--primary-color-end, #075985)" : "#94a3b8"} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: formData.role === 'admin' ? 'var(--primary-text, #0369a1)' : '#64748b' }}>Admin Privileges</span>
            <label style={{ position: 'relative', display: 'inline-block', width: '32px', height: '18px', marginLeft: '6px' }}>
              <input type="checkbox" checked={formData.role === 'admin'} onChange={e => handleAdminToggle(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: formData.role === 'admin' ? 'var(--primary-color-start, #0284c7)' : '#cbd5e1', transition: '.4s', borderRadius: '34px' }}>
                <span style={{ position: 'absolute', content: '""', height: '12px', width: '12px', left: formData.role === 'admin' ? '17px' : '3px', bottom: '3px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%' }}></span>
              </span>
            </label>
          </div>
          <div title="Approves, rejects or holds purchase orders after logging in" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: formData.role === 'director' ? 'var(--primary-bg-light, #e0f2fe)' : '#f8fafc', padding: '6px 12px', borderRadius: '4px', border: formData.role === 'director' ? '1px solid var(--primary-color-start, #0284c7)' : '1px solid #e2e8f0', transition: 'all 0.3s' }}>
            <CheckCircle size={16} color={formData.role === 'director' ? "var(--primary-color-end, #075985)" : "#94a3b8"} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: formData.role === 'director' ? 'var(--primary-text, #0369a1)' : '#64748b' }}>Director (PO approval)</span>
            <label style={{ position: 'relative', display: 'inline-block', width: '32px', height: '18px', marginLeft: '6px' }}>
              <input type="checkbox" checked={formData.role === 'director'} onChange={e => handleDirectorToggle(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: formData.role === 'director' ? 'var(--primary-color-start, #0284c7)' : '#cbd5e1', transition: '.4s', borderRadius: '34px' }}>
                <span style={{ position: 'absolute', content: '""', height: '12px', width: '12px', left: formData.role === 'director' ? '17px' : '3px', bottom: '3px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%' }}></span>
              </span>
            </label>
          </div>
        </div>

        <div className="um-body" style={{ padding: '0.75rem 1.25rem', flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Account Credentials Section */}
            <section>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={14} /> Account Credentials
              </h3>
              <div style={cardStyle}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>User ID <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" value={formData.username} onChange={e=>setFormData({...formData, username: e.target.value})} style={inputStyle} placeholder="e.g. jdoe123" />
                  </div>
                  <div>
                    <label style={labelStyle}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" value={formData.fullName} onChange={e=>setFormData({...formData, fullName: e.target.value})} style={inputStyle} placeholder="e.g. John Doe" />
                  </div>
                  <div>
                    <label style={labelStyle}>Email Address</label>
                    <div style={{ position: 'relative' }}>
                      <input type="email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} style={inputStyle} placeholder="john@example.com" />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Contact Number</label>
                    <div style={{ position: 'relative' }}>
                      <input type="text" value={formData.contactNumber} onChange={e=>setFormData({...formData, contactNumber: e.target.value})} style={inputStyle} placeholder="+91 98765 43210" />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Organization Details Section */}
            <section>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Briefcase size={14} /> Organization Details
              </h3>
              <div style={cardStyle}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div><label style={labelStyle}>Designation</label><input type="text" value={formData.designation} onChange={e=>setFormData({...formData, designation: e.target.value})} style={inputStyle} placeholder="e.g. Manager" /></div>
                  <div><label style={labelStyle}>Department</label><input type="text" value={formData.department} onChange={e=>setFormData({...formData, department: e.target.value})} style={inputStyle} placeholder="e.g. IT & Admin" /></div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelStyle}>Branch</label>
                    <div style={{ position: 'relative' }}>
                      <select value={formData.branch} onChange={e=>setFormData({...formData, branch: e.target.value})} style={{...inputStyle, appearance: 'none', cursor: 'pointer'}}>
                          <option value="">Select Branch</option>
                          {/* 22-Nov-2026: a branch made Inactive in the Branch Master is not offered (it stays if this user already has it) */}
                          {branches.filter(b => String(b.status || '').toLowerCase() !== 'inactive' || b.branchCode === formData.branch).map(b => (
                            <option key={b.id} value={b.branchCode}>{b.branchName} ({b.branchCode})</option>
                          ))}
                      </select>
                      <ChevronDown size={14} color="#94a3b8" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                  </div>
                  <div><label style={labelStyle}>Reporting Manager 1</label><input type="text" value={formData.reportingTo1} onChange={e=>setFormData({...formData, reportingTo1: e.target.value})} style={inputStyle} placeholder="Manager Name" /></div>
                  <div><label style={labelStyle}>Reporting Manager 2</label><input type="text" value={formData.reportingTo2} onChange={e=>setFormData({...formData, reportingTo2: e.target.value})} style={inputStyle} placeholder="Optional Manager Name" /></div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelStyle}>Approval Limit</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input type="number" placeholder="Min" value={formData.limitMin} onChange={e=>setFormData({...formData, limitMin: e.target.value})} style={inputStyle} />
                        <span style={{ color: '#94a3b8', fontWeight: 700 }}>-</span>
                        <input type="number" placeholder="Max" value={formData.limitMax} onChange={e=>setFormData({...formData, limitMax: e.target.value})} style={inputStyle} />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Security Settings Section */}
            <section>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Settings size={14} /> Security Settings
              </h3>
              <div style={cardStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                      <div style={{ backgroundColor: '#ffffff', padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                            <Key size={14} color="var(--primary-color-start, #0284c7)" />
                            <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#1e293b', fontWeight: 700 }}>Reset Password</h4>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="New Password" style={inputStyle} />
                              <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Confirm Password" style={inputStyle} />
                              <button onClick={handlePasswordReset} style={{ marginTop: '2px', padding: '6px 12px', backgroundColor: 'var(--primary-color-start, #0284c7)', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>Update Password Only</button>
                          </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <label style={labelStyle}>Session Timeout (Minutes)</label>
                            <input type="number" value={formData.sessionTimeout} onChange={e=>setFormData({...formData, sessionTimeout: e.target.value})} style={{...inputStyle, width: '100%'}} />
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 8px', backgroundColor: '#ffffff', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                            <input type="checkbox" checked={formData.allowStatusUpdates} onChange={e=>setFormData({...formData, allowStatusUpdates: e.target.checked})} style={{ accentColor: 'var(--primary-color-start, #0284c7)', width: '14px', height: '14px' }} />
                            <span style={{ fontSize: '0.75rem', color: '#334155', fontWeight: 600 }}>Allow Status Updates Notifications</span>
                          </label>
                      </div>
                  </div>
              </div>
            </section>

            {/* Module-wise Permissions */}
            <section style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={14} /> Module-wise Permissions
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {formData.role === 'admin'
                    ? <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#9a3412', backgroundColor: '#fff7ed', border: '1px solid #fdba74', padding: '3px 8px', borderRadius: '4px' }}>Admin: every module is allowed, this grid is not checked</span>
                    : (selectedUser && savedRows === 0 && permCount === 0)
                      ? <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#9a3412', backgroundColor: '#fff7ed', border: '1px solid #fdba74', padding: '3px 8px', borderRadius: '4px' }}>No restrictions set: this user can open everything until you tick rights here</span>
                      : <span style={{ fontSize: '0.7rem', fontWeight: 600, color: permCount ? '#1e40af' : '#991b1b', backgroundColor: permCount ? '#eff6ff' : '#fef2f2', border: `1px solid ${permCount ? '#bfdbfe' : '#fecaca'}`, padding: '3px 8px', borderRadius: '4px' }}>{permCount} of {moduleTotal} modules allowed{permCount ? '' : ' - the user will not be able to open any module'}</span>}
                  <button type="button" onClick={() => { const anyOpen = Object.values(openModules).some(Boolean); const n = {}; catalog.groups.forEach(g => g.modules.forEach(m => { if (m.forms && m.forms.length) n[m.key] = !anyOpen; })); setOpenModules(n); }} style={{ fontSize: '0.7rem', fontWeight: 600, color: '#334155', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}>{Object.values(openModules).some(Boolean) ? 'Collapse forms' : 'Expand all forms'}</button>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                    <input type="checkbox" checked={allOn} onChange={(e) => handleSelectAll(e.target.checked)} style={{ accentColor: 'var(--primary-color-start, #0284c7)', width: '12px', height: '12px' }} />
                    Grant All
                  </label>
                </div>
              </div>
              
              {!catalog.loaded && (
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', padding: '8px 12px', marginBottom: '6px', fontSize: '0.75rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 700 }}>Module list not loaded from the server{catalog.error ? ` (${catalog.error})` : ''}.</span>
                  <span>Showing a basic list only - restart the backend, then retry before saving rights.</span>
                  <button type="button" onClick={loadCatalog} style={{ marginLeft: 'auto', padding: '3px 10px', border: '1px solid #fca5a5', background: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.7rem', color: '#991b1b' }}>Retry</button>
                </div>
              )}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', overflowY: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#dbeafe', borderBottom: '1px solid #bfdbfe' }}>
                      <th style={{ padding: '6px 12px', color: '#1e3a8a', fontWeight: 700 }}>MODULE NAME</th>
                      <th style={{ padding: '6px 4px', color: '#1e3a8a', fontWeight: 700, textAlign: 'center', borderLeft: '1px solid #bfdbfe', width: '56px' }} title="All four rights of the module">
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}><span style={{ fontSize: '10px' }}>ALL</span><span style={{ height: '12px' }}></span></div>
                      </th>
                      {['VIEW', 'CREATE', 'EDIT', 'DELETE'].map((action) => {
                        const field = `can${action.charAt(0) + action.slice(1).toLowerCase()}`;
                        return (
                        <th key={action} style={{ padding: '6px 4px', color: '#1e3a8a', fontWeight: 700, textAlign: 'center', borderLeft: '1px solid #bfdbfe', width: '70px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <span style={{fontSize: '10px'}}>{action}</span>
                            <input type="checkbox" title={`${action} on every module`} checked={columnAllOn(field)} onChange={(e) => handleColumnSelectAll(field, e.target.checked)} style={{ accentColor: 'var(--primary-color-start, #0284c7)', width: '12px', height: '12px', cursor: 'pointer' }} />
                          </div>
                        </th>
                      ); })}
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.groups.map((group) => (
                      <React.Fragment key={group.name}>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f1f5f9' }}>
                          <td style={{ padding: '5px 12px', color: '#0f172a', fontWeight: 700, fontSize: '0.8rem' }}>
                            {group.name} <span style={{ fontWeight: 500, color: '#64748b', fontSize: '0.7rem' }}>({group.modules.length})</span>
                          </td>
                          <td style={{ textAlign: 'center', padding: '4px', borderLeft: '1px solid #e2e8f0' }}>
                            <input type="checkbox" title={`Whole ${group.name} group: all rights`} checked={groupAllOn(group)} ref={el => { if (el) el.indeterminate = !groupAllOn(group) && groupAnyOn(group); }} onChange={e => handleGroupAll(group, e.target.checked)} style={{ accentColor: 'var(--primary-color-start, #0284c7)', width: '13px', height: '13px', cursor: 'pointer' }} />
                          </td>
                          <td colSpan={4} style={{ borderLeft: '1px solid #e2e8f0' }}></td>
                        </tr>
                        {group.modules.map((mod, idx) => {
                          const hasForms = !!(mod.forms && mod.forms.length);
                          const open = hasForms && !!openModules[mod.key];
                          const onForms = hasForms ? mod.forms.filter(f => anyRight(permissions[f.key])).length : 0;
                          return (
                          <React.Fragment key={mod.key}>
                          <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fcfcfc' }}>
                            <td style={{ padding: '4px 12px', paddingLeft: '24px', color: '#334155', fontWeight: 500, fontSize: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {hasForms
                                  ? <button type="button" onClick={() => toggleOpen(mod.key)} title={open ? 'Hide forms' : 'Show forms'} style={{ width: '16px', height: '16px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#fff', cursor: 'pointer', fontSize: '10px', lineHeight: '14px', padding: 0, color: '#334155' }}>{open ? '−' : '+'}</button>
                                  : <span style={{ width: '16px', display: 'inline-block' }}></span>}
                                <div>
                                  <div style={{ fontWeight: 600 }}>{mod.key}{hasForms && <span style={{ fontWeight: 500, color: onForms ? '#1d4ed8' : '#64748b', fontSize: '0.65rem', marginLeft: '6px' }}>{onForms}/{mod.forms.length} forms</span>}</div>
                                  {mod.label && mod.label !== mod.key && <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '1px' }}>{mod.label}</div>}
                                </div>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center', padding: '4px', borderLeft: '1px solid #e2e8f0' }}>
                              {cb({ title: hasForms ? 'All rights on every form of this module' : 'All rights of this module', checked: moduleAllOn(mod), 'data-partial': moduleAnyOn(mod), onChange: e => handleModuleAll(mod, e.target.checked) })}
                            </td>
                            {ACTIONS.map(action => (
                              <td key={action} style={{ textAlign: 'center', padding: '4px', borderLeft: '1px solid #e2e8f0' }}>
                                {hasForms
                                  ? cb({ small: true, title: `${action.slice(3)} on every form of ${mod.key}`, checked: moduleFieldOn(mod, action), 'data-partial': moduleFieldAny(mod, action), onChange: e => handleModuleField(mod, action, e.target.checked) })
                                  : cb({ small: true, checked: permissions[mod.key]?.[action] || false, onChange: e => handlePermChange(mod.key, action, e.target.checked) })}
                              </td>
                            ))}
                          </tr>
                          {open && mod.forms.map(f => (
                            <tr key={f.key} style={{ borderBottom: '1px dashed #e2e8f0', backgroundColor: '#f8fafc' }}>
                              <td style={{ padding: '3px 12px', paddingLeft: '52px', color: '#475569', fontSize: '0.72rem' }}>
                                <span style={{ color: '#94a3b8', marginRight: '6px' }}>└</span>{f.label || f.key}
                              </td>
                              <td style={{ textAlign: 'center', padding: '3px', borderLeft: '1px solid #e2e8f0' }}>
                                {cb({ small: true, title: 'All rights of this form', checked: leafAllOn(f.key), onChange: e => handleLeafAll(f.key, e.target.checked) })}
                              </td>
                              {ACTIONS.map(action => (
                                <td key={action} style={{ textAlign: 'center', padding: '3px', borderLeft: '1px solid #e2e8f0' }}>
                                  {cb({ small: true, checked: permissions[f.key]?.[action] || false, onChange: e => handlePermChange(f.key, action, e.target.checked) })}
                                </td>
                              ))}
                            </tr>
                          ))}
                          </React.Fragment>
                          ); })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

          </div>
        </div>

        <div className="um-foot" style={{ padding: '10px 64px 10px 1.25rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={handlePrint} style={{ padding: '6px 12px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Printer size={14}/> Print
          </button>
          <button onClick={handleClear} style={{ padding: '6px 12px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14}/> Clear / New
          </button>
          
          <div style={{ flex: 1 }}></div>
          
          {selectedUser && selectedUser.status && selectedUser.status !== 'active' && (
            <button onClick={handleEnableUser} style={{ padding: '6px 12px', backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={14}/> Enable ({selectedUser.status})
            </button>
          )}
          <button onClick={handleDisableUser} style={{ padding: '6px 12px', backgroundColor: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <XCircle size={14}/> Disable User
          </button>
          <button onClick={handleLockUser} style={{ padding: '6px 12px', backgroundColor: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={14}/> Lock
          </button>
          <button id="save-btn" onClick={handleSave} style={{ padding: '6px 20px', background: 'linear-gradient(135deg, var(--primary-color-start, #0284c7) 0%, var(--primary-color-end, #075985) 100%)', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: 'var(--primary-shadow, 0 1px 2px rgba(0,0,0,0.15))' }}>
            <Save size={14}/> F7 SAVE
          </button>
        </div>

      </div>

    </div>
  );
}










