import {
  Banknote, Briefcase, ClipboardList, Database, FileSearch, FileText, Grid, Home, LayoutDashboard, Navigation, Package,
  Plane, Settings, ShoppingCart, TrendingUp, Truck, Users,
} from 'lucide-react';

// entry: { label, icon, to } is a plain link; { label, icon, columns } is a dropdown.
// columns: [[group, ...], ...] - each inner list stacks in one column; group: { heading, links: [link, ...] }
// link: { label, to, icon, tone: 'primary' | 'success' | 'danger', title }
export const NAV_MENU = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Sales', icon: TrendingUp, to: '/sales' },
  {
    label: 'Other Modules',
    icon: Grid,
    columns: [[
      {
        heading: 'Admin',
        links: [
          { label: 'Admin Dashboard', to: '/admin-dashboard', icon: LayoutDashboard, tone: 'primary' },
          { label: 'Vendor Master', to: '/vendor-master', icon: Users },
          { label: 'Purchase Management', to: '/purchase-management', icon: ShoppingCart },
          { label: 'Asset & Stock (GRN)', to: '/asset-management', icon: Package },
        ],
      },
      {
        heading: 'Transport',
        links: [
          { label: 'Fleet / TMS Management', to: '/fleet-management', icon: Truck },
          { label: 'Live Field Boy Tracking', to: '/field-tracking', icon: Navigation },
        ],
      },
    ]],
  },
  {
    label: 'Customs',
    icon: FileText,
    columns: [[
      {
        heading: 'Job Entry',
        links: [
          { label: 'Import', to: '/job-entry' },
          { label: 'Export', to: '/export-entry' },
          { label: 'Submit SB Job', to: '/submit-sb-job' },
          { label: 'BE Amendments', to: '/be-amendments' },
        ],
      },
      {
        heading: 'Operations',
        links: [{ label: 'Request Job Payment', to: '/freight/job-expense', icon: Banknote, tone: 'danger' }],
      },
    ]],
  },
  {
    label: 'Freight',
    icon: Truck,
    columns: [[
      {
        heading: 'Shipment Registration',
        links: [
          { label: 'Import Air', to: '/freight/shipment/ai' },
          { label: 'Import Sea', to: '/freight/shipment/si' },
          { label: 'Export Air', to: '/freight/shipment/ae' },
          { label: 'Export Sea', to: '/freight/shipment/se' },
        ],
      },
      {
        heading: 'Create AWB',
        links: [
          { label: 'e-AWB (Air Waybill)', to: '/freight/create-awb', icon: Plane },
          { label: 'MAWB (Master AWB)', to: '/freight/create-mawb', icon: ClipboardList },
          { label: 'HAWB (House AWB)', to: '/freight/create-hawb', icon: Home },
        ],
      },
    ]],
  },
  { label: 'Accounts', icon: Briefcase, accounts: true },
  {
    label: 'Masters',
    icon: Database,
    columns: [
      [
        {
          heading: 'Core Masters',
          links: [
            { label: 'Unified Party Master', to: '/master/party' },
            { label: 'Contract & Quotation Master', to: '/master/contract-master', tone: 'success' },
            { label: 'User Management', to: '/master/users' },
            { label: 'Country Master', to: '/master/country' },
            { label: 'Unified Port & CHA Master', to: '/master/port' },
            { label: 'Currency & Exchange Rates', to: '/master/currency' },
          ],
        },
        {
          heading: 'Logistics & Operations',
          links: [
            { label: 'Transporter Master', to: '/master/transporter' },
            { label: 'Vessel / Flight Master', to: '/master/vessel' },
            { label: 'Shipping Line Master (Sea)', to: '/master/shipping-line' },
            { label: 'Airline Master', to: '/master/airline' },
            { label: 'AirWayBill Stock', to: '/master/airway-bill-stock' },
            { label: 'Airway Bill Charges Master', to: '/master/awbcharges' },
            { label: 'SPH Codes Master', to: '/master/sph-master' },
            { label: 'Status Master', to: '/master/status-master' },
            { label: 'Penalty & Demurrage Rules', to: '/master/penalty-rules' },
            { label: 'IATA Agent Master', to: '/master/iata-agent' },
            { label: 'Warehouse Master', to: '/master/warehouse' },
          ],
        },
      ],
      [
        {
          heading: 'Customs & Compliance',
          links: [
            { label: 'UQC (Unit of Measurement)', to: '/master/uqc' },
            { label: 'Unified HSN / Tariff Master', to: '/master/hsn-ritc' },
            { label: 'BE Bond Code Master (Import)', to: '/master/bond' },
            { label: 'Importer License Master (Import)', to: '/master/license' },
            { label: 'RSP & Abatement Master (Import)', to: '/master/rsp' },
            { label: 'Customs Duty Lists (ADD / CVD / Cess / Tariff Value)', to: '/master/duty-lists' },
            { label: 'Exemption Notifications (Import)', to: '/master/duty' },
            { label: 'Drawback Schedule (Export)', to: '/master/drawback' },
            { label: 'RoDTEP Schedule (Export)', to: '/master/rodtep' },
            { label: 'RoSCTL Schedule (Export)', to: '/master/rosctl' },
            { label: 'Export Tariff & Policy', to: '/master/export-policy' },
            { label: 'Export Scheme Codes', to: '/master/schemecodes' },
            { label: 'IATA TACT & Compliance', to: '/master/tact-compliance', tone: 'success' },
          ],
        },
        {
          heading: 'System Configurations',
          links: [
            { label: 'DSR Template Settings', to: '/master/dsr-template', tone: 'success' },
            { label: 'JSON Item Templates', to: '/master/item-template' },
            { label: 'ICEGATE Credentials', to: '/master/icegate' },
            { label: 'e-Sanchit Document Codes', to: '/master/esanchit' },
          ],
        },
      ],
    ],
  },
  { label: 'Reports', icon: FileSearch, to: '/reports' },
  { label: 'Settings', icon: Settings, to: '/settings' },
];
