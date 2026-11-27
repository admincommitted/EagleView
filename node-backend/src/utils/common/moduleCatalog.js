// Module / form catalog for user permissions
// One list for the whole app: User Management shows it, the frontend menu/route guard uses it,
// and the permissions middleware maps API calls to it.
//   module  : { key, label, routes, api, forms? }      moduleName stored in UserPermissions = key
//   form    : { key, label, routes }  - a screen inside the module; rights are saved per form, and the module's
//             rights are the union of its forms (a module without forms is saved as one row)
//   routes  : frontend paths (prefix match, longest wins; an entry with "?tab=" matches path+query)
//   api     : backend prefixes (prefix match, longest wins); readFree = GET open to every logged-in user
//             because other screens need the lookups (masters, tariff, settings...)
// a screen (form) inside a module
const F = (key, label, routes) => ({ key, label, routes });

const GROUPS = [
  {
    name: 'Dashboard',
    modules: [
      { key: 'Live Overview', label: 'Live Overview (Dashboard)', routes: ['/dashboard', '/'], api: [] },
      { key: 'Admin Dashboard', label: 'Admin Dashboard', routes: ['/admin-dashboard'], api: [] },
      { key: 'Director MIS', label: 'Director MIS', routes: ['/director-mis'], api: [] },
    ],
  },
  {
    name: 'Customs Clearance',
    modules: [
      // the job screens are one page with tabs: a tab is a form here, its "route" is /job-entry#<tab> (the layout hides tabs by it)
      {
        key: 'Bill of Entry (Import)',
        label: 'Import Job Entry (BE)',
        routes: ['/job-entry', '/be-amendments'],
        api: ['/api/import-jobs', '/api/warehouse-be', '/api/import-file', '/api/bulk-zip', '/api/be-amendments'],
        forms: [
          F('Import Dashboard', '0. Dashboard tab', ['/job-entry#dashboard']),
          F('Import Job Query', '1. Job Query tab (job list, open / copy / amend / documents)', ['/job-entry#query']),
          F('Import Job Entry', '2-4. Job Header, Invoices, Items tabs (data entry)', [
            '/job-entry#header',
            '/job-entry#invoices',
            '/job-entry#items',
          ]),
          F('Import Reports & Submission', '5. Reports & Submission tab (checklist, BE JSON, ICEGATE filing)', [
            '/job-entry#reports',
          ]),
          F('BE Amendments', 'BE Amendments register (amendment no, file, sign, send to ICEGATE)', ['/be-amendments']),
        ],
      },
      {
        key: 'Shipping Bill (Export)',
        label: 'Export Job Entry (SB)',
        routes: ['/export-entry'],
        api: ['/api/export-jobs'],
        forms: [
          F('Export Dashboard', '0. Dashboard tab', ['/export-entry#dashboard']),
          F('Export Job Query', 'Query / Search tab', ['/export-entry#query']),
          F('Export Job Entry', '1-3. SB Header, Invoices, Items + Scheme / DBK tabs (data entry)', [
            '/export-entry#header',
            '/export-entry#invoices',
            '/export-entry#items',
            '/export-entry#scheme',
          ]),
          F('Export Reports & Checklist', '4. Report / Checklist tab', ['/export-entry#reports']),
          F('Submit SB Job', 'Submit SB Job', ['/submit-sb-job']),
        ],
      },
      {
        key: 'E-Sanchit',
        label: 'e-Sanchit (upload / sign documents)',
        routes: [],
        api: [
          '/api/icegate/upload-esanchit',
          '/api/icegate/esanchit-archive',
          '/api/icegate/sign',
          '/api/icegate/signer',
        ],
      }, // /signer: EagleView Signer tool
      {
        key: 'ICEGATE Filing',
        label: 'ICEGATE filing & acknowledgements',
        routes: [],
        api: ['/api/icegate', '/api/ulip'],
      },
      { key: 'Job Payment Request', label: 'Request Job Payment', routes: ['/freight/job-expense'], api: [] },
    ],
  },
  {
    name: 'Freight Forwarding',
    modules: [
      { key: 'Air Export', label: 'Air Export dashboard', routes: ['/freight/air-export'], api: [] },
      { key: 'Air Import', label: 'Air Import dashboard', routes: ['/freight/air-import'], api: [] },
      { key: 'Ocean Export', label: 'Sea Export dashboard', routes: ['/freight/sea-export'], api: [] },
      { key: 'Ocean Import', label: 'Sea Import dashboard', routes: ['/freight/sea-import'], api: [] },
      {
        key: 'Air Waybill',
        label: 'Air Waybills',
        routes: [],
        api: ['/api/awb'],
        forms: [
          F('e-AWB', 'e-AWB (Air Waybill)', ['/freight/create-awb']),
          F('MAWB', 'MAWB (Master AWB)', ['/freight/create-mawb']),
          F('HAWB', 'HAWB (House AWB)', ['/freight/create-hawb']),
          F('Search AWB', 'Search AWB', ['/freight/search-awb']),
          F('e-Freight', 'e-Freight (Cargo-XML AWB)', ['/e-freight']),
        ],
      },
      {
        key: 'AWB Stock',
        label: 'AirWayBill / HAWB Stock',
        routes: ['/master/airway-bill-stock'],
        api: ['/api/stock'],
      },
      {
        key: 'Track Shipments',
        label: 'Tracking',
        routes: [],
        api: [],
        forms: [
          F('Freight Track Shipments', 'Track Shipments', ['/freight/track-shipments']),
          F('Track & Trace', 'Track & Trace', ['/track-trace']),
        ],
      },
      { key: 'e-CSD', label: 'e-CSD', routes: ['/freight/ecsd'], api: [] },
      {
        key: 'Freight Reports',
        label: 'Freight reports',
        routes: [],
        api: [],
        forms: [
          F('Tonnage Report', 'Tonnage Report', ['/freight/tonnage-report']),
          F('CSR Statement', 'CSR Statement', ['/freight/csr-statement']),
        ],
      },
    ],
  },
  {
    name: 'Accounts',
    modules: [
      {
        key: 'Accounting Masters',
        label: 'Accounting setup',
        routes: [],
        api: [
          { prefix: '/api/accounting-masters', readFree: true },
          { prefix: '/api/accounts', readFree: true },
        ],
        forms: [
          F('Chart of Accounts', 'Accounting Masters (COA)', ['/accounts']),
          F('Cost Centres', 'Cost Centres', ['/cost-centres']),
          F('Budgets', 'Budgets & Variance', ['/budgets']),
        ],
      },
      {
        key: 'Vouchers & Payments',
        label: 'Account transactions',
        routes: [],
        api: ['/api/vouchers'],
        forms: [
          F('Vendor Bill', 'Vendor Bill (Purchase)', ['/vendor-bill']),
          F('Bank Receipt / Payment', 'Bank Receipt / Payment', ['/payment-receipt']),
          F('Voucher Entry', 'Voucher Entry (JV / Contra)', ['/voucher-entry']),
        ],
      },
      {
        key: 'Job Billing',
        label: 'Invoicing',
        routes: [],
        api: ['/api/invoices'],
        forms: [
          F('Job Billing Entry', 'Job Billing (Invoicing)', ['/job-billing']),
          F('Bulk Billing', 'Bulk / Consolidated Billing', ['/bulk-billing']),
        ],
      },
      { key: 'Expense Approvals', label: 'Expense Approvals', routes: ['/expense-approvals'], api: [] },
      {
        key: 'Financial Reports',
        label: 'Financial reports',
        routes: [],
        api: [],
        forms: [
          F('Trial Balance', 'Trial Balance', ['/trial-balance']),
          F('Profit & Loss', 'Profit & Loss A/c', ['/profit-and-loss']),
          F('Balance Sheet', 'Balance Sheet', ['/balance-sheet']),
          F('Daybook', 'Daybook', ['/daybook']),
          F('Ledger Statement', 'Ledger Statement', ['/ledger-statement']),
          F('Bank Reconciliation', 'Bank Reconciliation', ['/bank-reconciliation']),
          F('Outstanding Reports', 'Outstanding Reports', ['/outstanding-reports']),
          F('Credit Control', 'Credit Control & CRM', ['/credit-control']),
          F('Cash Flow', 'Cash Flow Statement', ['/cash-flow']),
        ],
      },
      {
        key: 'GST & Taxation',
        label: 'Taxation',
        routes: [],
        api: [],
        forms: [
          F('GSTR-2B Reco', 'GSTR-2B Auto-Reco', ['/gst-reco']),
          F('GST & TDS Reports', 'GST & TDS Reports', ['/gst-reports']),
          F('GST Returns', 'GST Returns (1, 2, 3B)', ['/gst-returns']),
        ],
      },
    ],
  },
  {
    name: 'Purchase, Assets & Others',
    modules: [
      { key: 'Vendor Master', label: 'Vendor Master', routes: ['/vendor-master'], api: [] },
      {
        key: 'Purchase Management',
        label: 'Purchase',
        routes: [],
        api: ['/api/po'],
        forms: [
          F('Purchase Orders', 'Purchase Order Master', ['/purchase-management']),
          F('PO Approval', 'PO Approval / View', ['/po-approval', '/po-view']),
        ],
      },
      {
        key: 'Asset & Stock',
        label: 'Asset & Stock (GRN)',
        routes: ['/asset-management'],
        api: ['/api/assets', '/api/inventory'],
      },
      { key: 'Fleet / TMS', label: 'Fleet / TMS Management', routes: ['/fleet-management'], api: [] },
      { key: 'Field Tracking', label: 'Live Field Boy Tracking', routes: ['/field-tracking'], api: [] },
      {
        key: 'Sales CRM',
        label: 'Sales CRM',
        routes: ['/sales', '/sales-crm'],
        api: [
          { prefix: '/api/sales', readFree: true },
          { prefix: '/api/sales-hub', readFree: true },
        ],
      },
      {
        key: 'HR Module',
        label: 'HR',
        routes: [],
        api: ['/api/hr'],
        forms: [
          F('HR Main', 'HR Module (HRMS)', ['/hr-module']),
          F('Employee Portal', 'Employee Portal (ESS)', ['/employee-portal', '/ess']),
          F('Payroll Settings', 'Payroll Settings', ['/payroll-settings']),
        ],
      },
    ],
  },
  {
    name: 'Master Directory',
    modules: [
      {
        key: 'Core Masters',
        label: 'Core masters',
        routes: [],
        api: [
          { prefix: '/api/masters', readFree: true },
          { prefix: '/api/locations', readFree: true },
          { prefix: '/api/contracts', readFree: true },
          { prefix: '/api/status-master', readFree: true },
        ],
        forms: [
          F('Party Master', 'Unified Party Master', ['/master/party']),
          F('Contract Master', 'Contract & Quotation Master', ['/master/contract-master']),
          F('Country Master', 'Country Master', ['/master/country']),
          F('Port & CHA Master', 'Unified Port & CHA Master', ['/master/port']),
          F('Currency Master', 'Currency & Exchange Rates', ['/master/currency']),
          F('Transporter Master', 'Transporter Master', ['/master/transporter']),
          F('Vessel / Flight Master', 'Vessel / Flight Master', ['/master/vessel']),
          F('Airline Master', 'Airline Master', ['/master/airline']),
          F('IATA Agent Master', 'IATA Agent Master', ['/master/iata-agent']),
          F('Warehouse Master', 'Warehouse Master', ['/master/warehouse']),
          F('UQC Master', 'UQC (Unit of Measurement)', ['/master/uqc']),
          F('Status Master', 'Status Master', ['/master/status-master']),
        ],
      },
      {
        key: 'Customs & Compliance',
        label: 'Customs & compliance masters',
        routes: [],
        api: [
          { prefix: '/api/tariff', readFree: true },
          { prefix: '/api/penalty-rules', readFree: true },
          { prefix: '/api/tact', readFree: true },
          { prefix: '/api/icegate-profiles', readFree: true },
        ],
        forms: [
          F('HSN / Tariff Master', 'Unified HSN / Tariff Master', ['/master/hsn-ritc']),
          F('Bond Master', 'BE Bond Code Master (Import)', ['/master/bond']),
          F('Licence Master', 'Importer License Master (Import)', ['/master/license']),
          F('RSP Master', 'RSP & Abatement Master (Import)', ['/master/rsp']),
          F('Customs Duty Lists', 'Customs Duty Lists (ADD / CVD / Cess / Tariff Value)', ['/master/duty-lists']),
          F('Exemption Notifications', 'Exemption Notifications (Import)', ['/master/duty']),
          F('Drawback Schedule', 'Drawback Schedule (Export)', ['/master/drawback']),
          F('RoDTEP Schedule', 'RoDTEP Schedule (Export)', ['/master/rodtep']),
          F('RoSCTL Schedule', 'RoSCTL Schedule (Export)', ['/master/rosctl']),
          F('Export Policy', 'Export Tariff & Policy', ['/master/export-policy']),
          F('Scheme Codes', 'Export Scheme Codes', ['/master/schemecodes']),
          F('TACT & Compliance', 'IATA TACT & Compliance', ['/master/tact-compliance']),
          F('Penalty Rules', 'Penalty & Demurrage Rules', ['/master/penalty-rules']),
          F('ICEGATE Credentials', 'ICEGATE Credentials', ['/master/icegate']),
          F('e-Sanchit Codes', 'e-Sanchit Document Codes', ['/master/esanchit']),
        ],
      },
      {
        key: 'Logistics & Operations',
        label: 'Logistics & operations masters',
        routes: [],
        api: [{ prefix: '/api/dsr-templates', readFree: true }],
        forms: [
          F('AWB Charges Master', 'Airway Bill Charges Master', ['/master/awbcharges']),
          F('SPH Codes Master', 'SPH Codes Master', ['/master/sph-master']),
          F('DSR Template', 'DSR Template Settings', ['/master/dsr-template']),
          F('Item Templates', 'JSON Item Templates', ['/master/item-template']),
        ],
      },
      {
        key: 'User Management',
        label: 'User Management (users & permissions)',
        routes: ['/master/users'],
        api: ['/api/users'],
      },
    ],
  },
  {
    name: 'Reports',
    modules: [
      {
        key: 'Reports',
        label: 'Reports',
        routes: [],
        api: ['/api/reports'],
        forms: [
          F('Advanced Reports', 'Reports (Advanced Reports)', ['/reports']),
          F('Export Data', 'Export Data', ['/reports/export-data']),
          F('Forwarder Transactions', 'Forwarder Transactions Report', ['/reports/forwarder-transactions']),
        ],
      },
    ],
  },
  {
    name: 'Settings',
    modules: [
      {
        key: 'System Settings',
        label: 'Settings',
        routes: ['/settings'],
        api: [
          { prefix: '/api/settings', readFree: true },
          { prefix: '/api/document-series', readFree: true },
          { prefix: '/api/number-series', readFree: true },
          { prefix: '/api/whatsapp', readFree: true },
          { prefix: '/api/email', readFree: true },
        ],
        forms: [
          F('System Setup', 'System Setup', ['/settings?tab=system']),
          F('Branch Master', 'Branch Master', ['/settings?tab=branch']),
          F('CHA Master', 'CHA Master', ['/settings?tab=cha']),
          F('Financial Year', 'Financial Year', ['/settings?tab=fy']),
          F('Sequence Config', 'Sequence Config', ['/settings?tab=sequence']),
          F('Number Series (iCAFFE)', 'Number Series (iCAFFE)', [
            '/settings?tab=numseries',
            '/settings?tab=docseries',
            '/settings/document-series',
          ]),
          F('Network / SFTP', 'Network / SFTP', ['/settings?tab=network', '/settings/sftp']),
          F('ICEGATE Profiles', 'ICEGATE Profiles', ['/settings?tab=icegate']),
          F('ULIP Integration', 'ULIP Integration', ['/settings?tab=ulip']),
          F('AI Configuration', 'AI Configuration', ['/settings?tab=ai']),
          F('WhatsApp Settings', 'WhatsApp', ['/settings?tab=whatsapp']),
          F('Email Settings', 'Email', ['/settings?tab=email']),
          F('Company Settings', 'Company Settings', ['/company-settings']),
        ],
      },
    ],
  },
];

// Retired module names -> the module that covers them now (saved rows are mapped on read)
const LEGACY = { 'Daily Transactions': 'Reports', 'Financial & PnL': 'Financial Reports' };

const MODULES = GROUPS.flatMap((group) =>
  group.modules.map((module) => ({ ...module, forms: module.forms || [], group: group.name })),
);
const FORMS = MODULES.flatMap((module) => module.forms.map((form) => ({ ...form, module: module.key })));
const PARENT = Object.fromEntries(FORMS.map((form) => [form.key, form.module])); // form key -> module key
const CHILDREN = Object.fromEntries(MODULES.map((module) => [module.key, module.forms.map((form) => form.key)]));
const KEYS = new Set([...MODULES.map((module) => module.key), ...FORMS.map((form) => form.key)]);

// /mdm/<x> is the old spelling of /master/<x>
const normalizePath = (path) =>
  String(path || '')
    .replace(/^\/mdm(\/|$)/, '/master$1')
    .replace(/\/+$/, '') || '/';

function entryMatches(rawPrefix, fullPath, path) {
  if (rawPrefix.includes('?') || rawPrefix.includes('#'))
    return fullPath === rawPrefix || fullPath.startsWith(rawPrefix + '&');
  const prefix = normalizePath(rawPrefix);
  if (prefix === '/') return path === '/';
  return path === prefix || path.startsWith(prefix + '/');
}

// Longest matching prefix wins; '/' only matches exactly; an entry with '?' is matched against path+query
function matchPrefix(list, path, pick) {
  const fullPath = String(path || '');
  const pathOnly = normalizePath(fullPath.split('?')[0]);
  let best = null;
  let bestLength = -1;
  for (const entry of list) {
    const rawPrefix = pick(entry);
    if (entryMatches(rawPrefix, fullPath, pathOnly) && rawPrefix.length > bestLength) {
      best = entry;
      bestLength = rawPrefix.length;
    }
  }
  return best;
}

const API_INDEX = MODULES.flatMap((module) =>
  module.api.map((api) =>
    typeof api === 'string' ? { prefix: api, readFree: false, key: module.key } : { ...api, key: module.key },
  ),
);

const moduleForApi = (path) => matchPrefix(API_INDEX, path, (entry) => entry.prefix);

const EMPTY = { canView: false, canCreate: false, canEdit: false, canDelete: false };
const FIELDS = ['canView', 'canCreate', 'canEdit', 'canDelete'];
const eitherHasRight = (a, b) =>
  Object.fromEntries(FIELDS.map((field) => [field, !!(a && a[field]) || !!(b && b[field])]));
const isTrue = (value) => value === true || value === 1 || value === 'true';

// Normalises a saved permission list: legacy names mapped, unknown keys dropped, booleans forced, one row per key
function normalizePermissions(rows) {
  const byKey = {};
  for (const row of rows || []) {
    const key = LEGACY[row.moduleName] || row.moduleName;
    if (!KEYS.has(key)) continue;
    const rights = byKey[key] || { ...EMPTY };
    for (const field of FIELDS) rights[field] = rights[field] || isTrue(row[field]);
    byKey[key] = rights;
  }
  return Object.entries(byKey).map(([moduleName, rights]) => ({ moduleName, ...rights }));
}

// Effective rights of a module or form from a normalised map {key: {canView..}}:
//   form   -> its own row, else the parent module's row (older saves / "whole module" rows)
//   module -> its own row OR any of its forms' rows (API checks are per module)
function effective(permMap, key) {
  const map = permMap || {};
  if (PARENT[key]) return map[key] || map[PARENT[key]] || { ...EMPTY };
  let rights = map[key] || { ...EMPTY };
  for (const child of CHILDREN[key] || []) rights = eitherHasRight(rights, map[child]);
  return rights;
}

export { GROUPS, KEYS, LEGACY, FIELDS, moduleForApi, normalizePermissions, effective };
