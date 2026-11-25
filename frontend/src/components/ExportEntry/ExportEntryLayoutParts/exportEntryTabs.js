export const EXPORT_TAB_KEYS = ['dashboard', 'query', 'header', 'invoices', 'items', 'scheme', 'reports'];

export const exportEntryTabs = ({ invoiceCount, itemCount }) => [
  { key: 'dashboard', label: '0. Dashboard' },
  { key: 'query', label: 'Query / Search' },
  { key: 'header', label: '1. SB Header' },
  { key: 'invoices', label: `2. Invoices (${invoiceCount})` },
  { key: 'items', label: `3. Items (${itemCount})` },
  { key: 'scheme', label: 'Scheme / DBK' },
  { key: 'reports', label: '4. Report / Checklist' },
];

// Tabs without a View right are hidden (Master > User Management > Shipping Bill (Export) forms).
export const isTabAllowed = (permissions, tabKey) => permissions.canOpen(`/export-entry#${tabKey}`);

// the Items / Invoices forms are dropped when their tab is left
export const TABS_WITH_FORMS = ['items', 'invoices'];
