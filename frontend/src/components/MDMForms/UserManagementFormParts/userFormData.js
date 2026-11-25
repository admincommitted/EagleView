export const EMPTY_USER_FORM = {
  username: '', fullName: '', email: '', contactNumber: '',
  designation: '', department: '', branch: '', reportingTo1: '', reportingTo2: '',
  limitMin: '', limitMax: '', sessionTimeout: 30, allowStatusUpdates: true, role: 'user',
};

export const formFromUser = (user) => ({
  username: user.username || '', fullName: user.fullName || '', email: user.email || '', contactNumber: user.contactNumber || '',
  designation: user.designation || '', department: user.department || '', branch: user.branch || '',
  reportingTo1: user.reportingTo1 || '', reportingTo2: user.reportingTo2 || '', limitMin: user.limitMin || '', limitMax: user.limitMax || '',
  sessionTimeout: user.sessionTimeout || 30, allowStatusUpdates: user.allowStatusUpdates ?? true, role: user.role || 'user',
});

// The module list comes from the server (node-backend/utils/moduleCatalog.js), so the same list drives the menu, the
// page guard and the API check. This short list is shown only while the server list cannot be loaded.
export const FALLBACK_GROUPS = [
  { name: 'Dashboard', modules: [{ key: 'Live Overview', label: 'Live Overview (Dashboard)' }] },
  { name: 'Customs Clearance', modules: [{ key: 'Bill of Entry (Import)', label: 'Bill of Entry (Import)' }, { key: 'Shipping Bill (Export)', label: 'Shipping Bill (Export)' }, { key: 'E-Sanchit', label: 'e-Sanchit' }] },
  { name: 'Master Directory', modules: [{ key: 'Core Masters', label: 'Core Masters' }, { key: 'Customs & Compliance', label: 'Customs & Compliance' }, { key: 'Logistics & Operations', label: 'Logistics & Operations' }, { key: 'User Management', label: 'User Management' }] },
  { name: 'Settings', modules: [{ key: 'System Settings', label: 'System Settings' }] },
];
// module names saved by older versions
export const LEGACY = { 'Daily Transactions': 'Reports', 'Financial & PnL': 'Financial Reports' };

export const ACTIONS = ['canView', 'canCreate', 'canEdit', 'canDelete'];
export const ACTION_HEADERS = [
  { field: 'canView', label: 'VIEW' },
  { field: 'canCreate', label: 'CREATE' },
  { field: 'canEdit', label: 'EDIT' },
  { field: 'canDelete', label: 'DELETE' },
];
export const fullRow = (on) => ({ canView: on, canCreate: on, canEdit: on, canDelete: on });
export const anyRight = (row) => !!row && ACTIONS.some((action) => row[action]);
// rights are saved per form; a module without forms is saved as one row
export const hasForms = (module) => Boolean(module.forms?.length);
export const leafKeys = (module) => (hasForms(module) ? module.forms.map((form) => form.key) : [module.key]);

export const permissionsFromUser = (user, catalog) => {
  const permissions = {};
  (user.permissions || []).forEach((row) => {
    const key = catalog.legacy?.[row.moduleName] || LEGACY[row.moduleName] || row.moduleName;
    const current = permissions[key] || fullRow(false);
    permissions[key] = {
      canView: current.canView || !!row.canView,
      canCreate: current.canCreate || !!row.canCreate,
      canEdit: current.canEdit || !!row.canEdit,
      canDelete: current.canDelete || !!row.canDelete,
    };
  });
  // a row saved on a module that has forms applies to every form without its own row
  catalog.groups.forEach((group) => group.modules.forEach((module) => {
    if (!hasForms(module) || !permissions[module.key]) return;
    module.forms.forEach((form) => {
      if (!permissions[form.key]) permissions[form.key] = { ...permissions[module.key] };
    });
    delete permissions[module.key];
  }));
  return permissions;
};

export const roleLabel = (role) => (role === 'admin' ? 'Admin' : role === 'director' ? 'Director' : 'User');
export const statusOf = (user) => user.status || 'active';
