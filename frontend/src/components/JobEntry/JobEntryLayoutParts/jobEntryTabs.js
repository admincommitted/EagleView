export const JOB_ENTRY_TABS = [
  { key: 'dashboard', label: '0. Dashboard' },
  { key: 'query', label: '1. Job Query' },
  { key: 'header', label: '2. Job Header' },
  { key: 'invoices', label: '3. Invoices' },
  { key: 'items', label: '4. Items' },
  { key: 'reports', label: '5. Reports & Submission' },
];

// Tabs without a View right are hidden (Master > User Management > Bill of Entry (Import) forms).
export const isTabAllowed = (permissions, tabKey) => permissions.canOpen(`/job-entry#${tabKey}`);
