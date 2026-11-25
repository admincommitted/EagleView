import { lazy } from 'react';
import { GoToHrms } from '@/utils/hrmsUrl';

const Login = lazy(() => import('@/pages/Login'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const DirectorDashboard = lazy(() => import('@/pages/DirectorDashboard'));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const SalesCRM = lazy(() => import('@/pages/SalesCRM'));
const Sales = lazy(() => import('@/pages/Sales'));
const TrackAndTrace = lazy(() => import('@/pages/TrackAndTrace'));
const FleetManagement = lazy(() => import('@/pages/FleetManagement'));
const FieldTrackingDashboard = lazy(() => import('@/pages/FieldTrackingDashboard'));
const GSTReconciliation = lazy(() => import('@/pages/GSTReconciliation'));
const CompanySettings = lazy(() => import('@/pages/CompanySettings'));
const AdvancedReports = lazy(() => import('@/pages/AdvancedReports'));
const SubmitSbJob = lazy(() => import('@/pages/SubmitSbJob'));
const BeAmendments = lazy(() => import('@/pages/BeAmendments'));
const VendorMaster = lazy(() => import('@/pages/VendorMaster'));
const PurchaseOrderMaster = lazy(() => import('@/pages/PurchaseOrderMaster'));
const POApproval = lazy(() => import('@/pages/POApproval'));
const POView = lazy(() => import('@/pages/POView'));
const AssetManagement = lazy(() => import('@/pages/AssetManagement'));

const JobEntryLayout = lazy(() => import('@/components/JobEntry/JobEntryLayout'));
const ExportEntryLayout = lazy(() => import('@/components/ExportEntry/ExportEntryLayout'));
const SettingsLayout = lazy(() => import('@/components/Settings/SettingsLayout'));
const DSRTemplateMaster = lazy(() => import('@/components/Settings/DSRTemplateMaster'));
const MDM = lazy(() => import('@/pages/MDM'));
const ContractMaster = lazy(() => import('@/pages/ContractMaster'));

const ChartOfAccounts = lazy(() => import('@/pages/ChartOfAccounts'));
const AccountsHub = lazy(() => import('@/pages/AccountsHub'));
const VoucherEntry = lazy(() => import('@/pages/VoucherEntry'));
const VendorBillEntry = lazy(() => import('@/pages/VendorBillEntry'));
const CashFlow = lazy(() => import('@/pages/CashFlow'));
const Budgets = lazy(() => import('@/pages/Budgets'));
const CreditControlDashboard = lazy(() => import('@/pages/CreditControlDashboard'));
const ExpenseApprovals = lazy(() => import('@/pages/ExpenseApprovals'));
const Daybook = lazy(() => import('@/pages/Daybook'));
const LedgerStatement = lazy(() => import('@/pages/LedgerStatement'));
const TrialBalance = lazy(() => import('@/pages/TrialBalance'));
const ProfitAndLoss = lazy(() => import('@/pages/ProfitAndLoss'));
const BalanceSheet = lazy(() => import('@/pages/BalanceSheet'));
const BankReconciliation = lazy(() => import('@/pages/BankReconciliation'));
const GSTReports = lazy(() => import('@/pages/GSTReports'));
const JobBilling = lazy(() => import('@/pages/JobBilling'));
const BulkBilling = lazy(() => import('@/pages/BulkBilling'));
const PaymentReceiptEntry = lazy(() => import('@/pages/PaymentReceiptEntry'));
const JobExpenseRequest = lazy(() => import('@/pages/JobExpenseRequest'));
const OutstandingReports = lazy(() => import('@/pages/OutstandingReports'));
const CostCentres = lazy(() => import('@/pages/CostCentres'));

const ShipmentRegistration = lazy(() => import('@/pages/ShipmentRegistration'));
const AirExportDashboard = lazy(() => import('@/components/FreightForwarding/AirExportDashboard'));
const AirImportDashboard = lazy(() => import('@/pages/AirImportDashboard'));
const SeaExportDashboard = lazy(() => import('@/pages/SeaExportDashboard'));
const SeaImportDashboard = lazy(() => import('@/pages/SeaImportDashboard'));
const CreateAirWaybill = lazy(() => import('@/components/FreightForwarding/CreateAirWaybill'));
const CreateHouseWaybill = lazy(() => import('@/components/FreightForwarding/CreateHouseWaybill'));
const CreateMasterWaybill = lazy(() => import('@/components/FreightForwarding/CreateMasterWaybill'));
const EcsdForm = lazy(() => import('@/components/FreightForwarding/EcsdForm'));
const SearchAirWaybill = lazy(() => import('@/components/FreightForwarding/SearchAirWaybill'));
const TrackShipments = lazy(() => import('@/components/FreightForwarding/TrackShipments'));
const TonnageReport = lazy(() => import('@/components/FreightForwarding/TonnageReport'));
const CsrStatement = lazy(() => import('@/components/FreightForwarding/CsrStatement'));
const ExportData = lazy(() => import('@/components/FreightForwarding/ExportData'));
const ForwarderTransactionsReport = lazy(() => import('@/components/FreightForwarding/ForwarderTransactionsReport'));
const EFreightDashboard = lazy(() => import('@/pages/EFreightDashboard'));
const EFreightAWBForm = lazy(() => import('@/pages/EFreightAWBForm'));

export const guestRoutes = [
  { path: '/login', element: <Login /> },
];

export const openRoutes = [
  { path: '/reset-password', element: <ResetPassword /> },
];

export const privateRoutes = [
  { path: '/', element: <Dashboard /> },
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/director-mis', element: <DirectorDashboard /> },
  { path: '/admin-dashboard', element: <AdminDashboard /> },
  { path: '/sales-crm', element: <SalesCRM /> },
  { path: '/sales', element: <Sales /> },
  { path: '/track-trace', element: <TrackAndTrace /> },
  { path: '/fleet-management', element: <FleetManagement /> },
  { path: '/field-tracking', element: <FieldTrackingDashboard /> },
  { path: '/hr-module', element: <GoToHrms path="/" /> },
  { path: '/employee-portal', element: <GoToHrms path="/ess" /> },
  { path: '/payroll-settings', element: <GoToHrms path="/payroll-settings" /> },
  { path: '/gst-reco', element: <GSTReconciliation /> },
  { path: '/company-settings', element: <CompanySettings /> },
  { path: '/reports', element: <AdvancedReports /> },
  { path: '/submit-sb-job', element: <SubmitSbJob /> },
  { path: '/be-amendments', element: <BeAmendments /> },
  { path: '/vendor-master', element: <VendorMaster /> },
  { path: '/purchase-management', element: <PurchaseOrderMaster /> },
  { path: '/po-approval/:id', element: <POApproval /> },
  { path: '/po-view/:id', element: <POView /> },
  { path: '/asset-management', element: <AssetManagement /> },

  { path: '/job-entry/*', element: <JobEntryLayout /> },
  { path: '/export-entry/*', element: <ExportEntryLayout /> },
  { path: '/settings/*', element: <SettingsLayout /> },

  { path: '/accounts', element: <ChartOfAccounts /> },
  { path: '/accounts-hub', element: <AccountsHub /> },
  { path: '/voucher-entry', element: <VoucherEntry /> },
  { path: '/vendor-bill', element: <VendorBillEntry /> },
  { path: '/cash-flow', element: <CashFlow /> },
  { path: '/budgets', element: <Budgets /> },
  { path: '/credit-control', element: <CreditControlDashboard /> },
  { path: '/expense-approvals', element: <ExpenseApprovals /> },
  { path: '/daybook', element: <Daybook /> },
  { path: '/ledger-statement', element: <LedgerStatement /> },
  { path: '/trial-balance', element: <TrialBalance /> },
  { path: '/profit-and-loss', element: <ProfitAndLoss /> },
  { path: '/balance-sheet', element: <BalanceSheet /> },
  { path: '/bank-reconciliation', element: <BankReconciliation /> },
  { path: '/gst-returns', element: <GSTReports /> },
  { path: '/job-billing', element: <JobBilling /> },
  { path: '/bulk-billing', element: <BulkBilling /> },
  { path: '/payment-receipt', element: <PaymentReceiptEntry /> },
  { path: '/freight/job-expense', element: <JobExpenseRequest /> },
  { path: '/outstanding-reports', element: <OutstandingReports /> },
  { path: '/cost-centres', element: <CostCentres /> },

  { path: '/master/dsr-template', element: <DSRTemplateMaster /> },
  { path: '/master/contract-master', element: <ContractMaster /> },
  { path: '/master/*', element: <MDM /> },
  { path: '/mdm/*', element: <MDM /> },

  { path: '/freight/shipment/:div', element: <ShipmentRegistration /> },
  { path: '/freight/air-export', element: <AirExportDashboard /> },
  { path: '/freight/air-import', element: <AirImportDashboard /> },
  { path: '/freight/sea-export', element: <SeaExportDashboard /> },
  { path: '/freight/sea-import', element: <SeaImportDashboard /> },
  { path: '/freight/create-awb', element: <CreateAirWaybill /> },
  { path: '/freight/create-hawb', element: <CreateHouseWaybill /> },
  { path: '/freight/create-mawb', element: <CreateMasterWaybill /> },
  { path: '/freight/ecsd', element: <EcsdForm /> },
  { path: '/freight/search-awb', element: <SearchAirWaybill /> },
  { path: '/freight/track-shipments', element: <TrackShipments /> },
  { path: '/freight/tonnage-report', element: <TonnageReport /> },
  { path: '/freight/csr-statement', element: <CsrStatement /> },

  { path: '/reports/export-data', element: <ExportData /> },
  { path: '/reports/forwarder-transactions', element: <ForwarderTransactionsReport /> },
  { path: '/reports/*', element: <Dashboard /> },

  { path: '/e-freight', element: <EFreightDashboard /> },
  { path: '/e-freight/create-awb', element: <EFreightAWBForm /> },
];

export const redirects = [
  { from: '/settings/document-series', to: '/settings?tab=numseries' },
  { from: '/settings/sftp', to: '/settings' },
  { from: '*', to: '/' },
];
