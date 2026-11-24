import React, { useEffect } from 'react';
import { GlobalProvider } from './GlobalContext';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import MDM from './pages/MDM';
import ChartOfAccounts from './pages/ChartOfAccounts';
import AccountsHub from './pages/AccountsHub';
import VoucherEntry from './pages/VoucherEntry';
import VendorBillEntry from './pages/VendorBillEntry';
import DirectorDashboard from './pages/DirectorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import SalesCRM from './pages/SalesCRM';
import Sales from './pages/Sales';
import TrackAndTrace from './pages/TrackAndTrace';
import FleetManagement from './pages/FleetManagement';
import GSTReconciliation from './pages/GSTReconciliation';
import CompanySettings from './pages/CompanySettings';
import AdvancedReports from './pages/AdvancedReports';
import Daybook from './pages/Daybook';

import POApproval from './pages/POApproval';
import POView from './pages/POView';
import PurchaseOrderMaster from './pages/PurchaseOrderMaster';
import VendorMaster from './pages/VendorMaster';
import AssetManagement from './pages/AssetManagement';
import LedgerStatement from './pages/LedgerStatement';
import TrialBalance from './pages/TrialBalance';
import PaymentReceiptEntry from './pages/PaymentReceiptEntry';
import ProfitAndLoss from './pages/ProfitAndLoss';
import ContractMaster from './pages/ContractMaster';
import JobExpenseRequest from './pages/JobExpenseRequest';
import BalanceSheet from './pages/BalanceSheet';
import CreditControlDashboard from './pages/CreditControlDashboard';
import BankReconciliation from './pages/BankReconciliation';
import GSTReports from './pages/GSTReports';
import JobBilling from './pages/JobBilling';
import BulkBilling from './pages/BulkBilling';
import OutstandingReports from './pages/OutstandingReports';
import CostCentres from './pages/CostCentres';
import CashFlow from './pages/CashFlow';
import Budgets from './pages/Budgets';
import ExpenseApprovals from './pages/ExpenseApprovals';
import FieldTrackingDashboard from './pages/FieldTrackingDashboard';
import { GoToHrms } from './utils/hrmsUrl';
import SubmitSbJob from './pages/SubmitSbJob';
import BeAmendments from './pages/BeAmendments'; // 10-Nov-2026 BE amendment register

import ExportEntryLayout from './components/ExportEntry/ExportEntryLayout';
import JobEntryLayout from './components/JobEntry/JobEntryLayout';
import SettingsLayout from './components/Settings/SettingsLayout';
import DSRTemplateMaster from './components/Settings/DSRTemplateMaster';

// Freight Forwarding
import AirExportDashboard from './components/FreightForwarding/AirExportDashboard';
import AirImportDashboard from './pages/AirImportDashboard';
import SeaExportDashboard from './pages/SeaExportDashboard';
import SeaImportDashboard from './pages/SeaImportDashboard';
import ShipmentRegistration from './pages/ShipmentRegistration';
import CreateAirWaybill from './components/FreightForwarding/CreateAirWaybill';
import CreateHouseWaybill from './components/FreightForwarding/CreateHouseWaybill';
import CreateMasterWaybill from './components/FreightForwarding/CreateMasterWaybill';
import SearchAirWaybill from './components/FreightForwarding/SearchAirWaybill';
import TrackShipments from './components/FreightForwarding/TrackShipments';
import TonnageReport from './components/FreightForwarding/TonnageReport';
import CsrStatement from './components/FreightForwarding/CsrStatement';
import ExportData from './components/FreightForwarding/ExportData';
import ForwarderTransactionsReport from './components/FreightForwarding/ForwarderTransactionsReport';
import EcsdForm from './components/FreightForwarding/EcsdForm';
import EFreightDashboard from './pages/EFreightDashboard';
import EFreightAWBForm from './pages/EFreightAWBForm';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null, errorInfo: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error("Error:", error, errorInfo); this.setState({ errorInfo }); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', background: '#fee' }}>
          <h2>Something went wrong in the app.</h2>
          <pre>{this.state.error && this.state.error.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const bgThemes = {
          slate: { app: '#f1f5f9', panel: '#ffffff', input: '#ffffff', textMain: '#0f172a', textMuted: '#475569', border: '#cbd5e1' },
          white: { app: '#ffffff', panel: '#ffffff', input: '#ffffff', textMain: '#0f172a', textMuted: '#475569', border: '#e5e7eb' },
          warm:  { app: '#fdfbf7', panel: '#ffffff', input: '#ffffff', textMain: '#0f172a', textMuted: '#475569', border: '#e6e4dc' },
          sky:   { app: '#f0f9ff', panel: '#ffffff', input: '#ffffff', textMain: '#0f172a', textMuted: '#475569', border: '#bae6fd' },
          mint:  { app: '#f0fdf4', panel: '#ffffff', input: '#ffffff', textMain: '#0f172a', textMuted: '#475569', border: '#bbf7d0' },
          lavender: { app: '#f5f3ff', panel: '#ffffff', input: '#ffffff', textMain: '#0f172a', textMuted: '#475569', border: '#ddd6fe' },
          peach: { app: '#fff7ed', panel: '#ffffff', input: '#ffffff', textMain: '#0f172a', textMuted: '#475569', border: '#fed7aa' },
          rose:  { app: '#fff1f2', panel: '#ffffff', input: '#ffffff', textMain: '#0f172a', textMuted: '#475569', border: '#fecdd3' },
          // 22-Nov-2026: five more light backgrounds (a dark one was tried and left out: many screens have fixed dark text)
          coolgrey: { app: '#eef0f3', panel: '#ffffff', input: '#ffffff', textMain: '#0f172a', textMuted: '#475569', border: '#d1d5db' },
          ivory:    { app: '#fbf8ef', panel: '#ffffff', input: '#ffffff', textMain: '#0f172a', textMuted: '#475569', border: '#e7dfc8' },
          ice:      { app: '#e6f1fb', panel: '#ffffff', input: '#ffffff', textMain: '#0f172a', textMuted: '#475569', border: '#b3d4f0' },
          seagreen: { app: '#e8f7f4', panel: '#ffffff', input: '#ffffff', textMain: '#0f172a', textMuted: '#475569', border: '#a7dccf' },
          lemon:    { app: '#fefce8', panel: '#ffffff', input: '#ffffff', textMain: '#0f172a', textMuted: '#475569', border: '#f0e6a6' },
          midnight: { app: '#0f172a', panel: '#1e293b', input: '#020617', textMain: '#f8fafc', textMuted: '#94a3b8', border: '#334155' },
          dark: { app: '#121212', panel: '#1e1e1e', input: '#000000', textMain: '#ffffff', textMuted: '#aaaaaa', border: '#333333' }
        };
      
const palettes = {
          deepteal: { start: '#08676d', end: '#05474c', shadow: 'rgba(8, 103, 109, 0.3)', text: '#05474c', border: '#179ea8', bgLight: '#eff9fa' },
          ocean: { start: '#008ac1', end: '#006f9e', shadow: 'rgba(0, 138, 193, 0.3)', text: '#006f9e', border: '#4dc0ed', bgLight: '#e6f6fc' },
          blue: { start: '#0ea5e9', end: '#2563eb', shadow: 'rgba(37, 99, 235, 0.3)', text: '#0284c7', border: '#93c5fd', bgLight: '#eff6ff' },
          emerald: { start: '#10b981', end: '#059669', shadow: 'rgba(16, 185, 129, 0.3)', text: '#059669', border: '#6ee7b7', bgLight: '#ecfdf5' },
          forest: { start: '#15803d', end: '#14532d', shadow: 'rgba(21, 128, 61, 0.3)', text: '#14532d', border: '#86efac', bgLight: '#f0fdf4' },
          violet: { start: '#8b5cf6', end: '#6d28d9', shadow: 'rgba(109, 40, 217, 0.3)', text: '#6d28d9', border: '#c4b5fd', bgLight: '#f5f3ff' },
          plum: { start: '#701a75', end: '#4a044e', shadow: 'rgba(112, 26, 117, 0.3)', text: '#4a044e', border: '#f0abfc', bgLight: '#fdf4ff' },
          rose: { start: '#f43f5e', end: '#e11d48', shadow: 'rgba(225, 29, 72, 0.3)', text: '#e11d48', border: '#fda4af', bgLight: '#fff1f2' },
          crimson: { start: '#be123c', end: '#881337', shadow: 'rgba(190, 18, 60, 0.3)', text: '#881337', border: '#fda4af', bgLight: '#fff1f2' },
          amber: { start: '#f59e0b', end: '#d97706', shadow: 'rgba(217, 119, 6, 0.3)', text: '#b45309', border: '#fcd34d', bgLight: '#fffbeb' },
          pumpkin: { start: '#c2410c', end: '#7c2d12', shadow: 'rgba(194, 65, 12, 0.3)', text: '#7c2d12', border: '#fdba74', bgLight: '#fff7ed' },
          cyan: { start: '#06b6d4', end: '#0891b2', shadow: 'rgba(6, 182, 212, 0.3)', text: '#0891b2', border: '#67e8f9', bgLight: '#ecfeff' },
          pink: { start: '#ec4899', end: '#db2777', shadow: 'rgba(236, 72, 153, 0.3)', text: '#db2777', border: '#f9a8d4', bgLight: '#fdf2f8' },
          teal: { start: '#14b8a6', end: '#0f766e', shadow: 'rgba(20, 184, 166, 0.3)', text: '#0f766e', border: '#5eead4', bgLight: '#f0fdfa' },
          indigo: { start: '#6366f1', end: '#4338ca', shadow: 'rgba(99, 102, 241, 0.3)', text: '#4338ca', border: '#a5b4fc', bgLight: '#eef2ff' },
          midnight: { start: '#1e3a8a', end: '#172554', shadow: 'rgba(30, 58, 138, 0.3)', text: '#172554', border: '#bfdbfe', bgLight: '#eff6ff' },
          gray: { start: '#64748b', end: '#475569', shadow: 'rgba(100, 116, 139, 0.3)', text: '#475569', border: '#cbd5e1', bgLight: '#f8fafc' },
          ruby: { start: '#e11d48', end: '#9f1239', shadow: 'rgba(225, 29, 72, 0.3)', text: '#9f1239', border: '#fecdd3', bgLight: '#fff1f2' },
          lime: { start: '#84cc16', end: '#4d7c0f', shadow: 'rgba(132, 204, 22, 0.3)', text: '#4d7c0f', border: '#d9f99d', bgLight: '#f7fee7' },
          sage: { start: '#5f7161', end: '#3c4a3d', shadow: 'rgba(95, 113, 97, 0.3)', text: '#3c4a3d', border: '#d3dcd4', bgLight: '#f3f4f3' },
          coral: { start: '#ff7f50', end: '#cd5b45', shadow: 'rgba(255, 127, 80, 0.3)', text: '#cd5b45', border: '#fdba74', bgLight: '#ffedd5' },
          magenta: { start: '#d946ef', end: '#a21caf', shadow: 'rgba(217, 70, 239, 0.3)', text: '#a21caf', border: '#f5d0fe', bgLight: '#fdf4ff' },
          slate: { start: '#475569', end: '#1e293b', shadow: 'rgba(71, 85, 105, 0.3)', text: '#1e293b', border: '#cbd5e1', bgLight: '#f8fafc' },
          navy: { start: '#0f172a', end: '#020617', shadow: 'rgba(15, 23, 42, 0.3)', text: '#020617', border: '#94a3b8', bgLight: '#f1f5f9' },
          sky: { start: '#38bdf8', end: '#0369a1', shadow: 'rgba(56, 189, 248, 0.3)', text: '#0369a1', border: '#bae6fd', bgLight: '#e0f2fe' },
          gold: { start: '#eab308', end: '#ca8a04', shadow: 'rgba(234, 179, 8, 0.3)', text: '#ca8a04', border: '#fef08a', bgLight: '#fefce8' },
          fuchsia: { start: '#c026d3', end: '#a21caf', shadow: 'rgba(192, 38, 211, 0.3)', text: '#a21caf', border: '#f5d0fe', bgLight: '#fdf4ff' },
          tangerine: { start: '#f97316', end: '#c2410c', shadow: 'rgba(249, 115, 22, 0.3)', text: '#c2410c', border: '#fed7aa', bgLight: '#fff7ed' },
          cerulean: { start: '#0284c7', end: '#0369a1', shadow: 'rgba(2, 132, 199, 0.3)', text: '#0369a1', border: '#bae6fd', bgLight: '#e0f2fe' },
          olive: { start: '#65a30d', end: '#4d7c0f', shadow: 'rgba(101, 163, 13, 0.3)', text: '#4d7c0f', border: '#d9f99d', bgLight: '#f7fee7' },
          berry: { start: '#9f1239', end: '#881337', shadow: 'rgba(159, 18, 57, 0.3)', text: '#881337', border: '#fecdd3', bgLight: '#fff1f2' },
          chocolate: { start: '#78350f', end: '#451a03', shadow: 'rgba(120, 53, 15, 0.3)', text: '#451a03', border: '#fcd34d', bgLight: '#fffbeb' },
          lavender: { start: '#a855f7', end: '#7e22ce', shadow: 'rgba(168, 85, 247, 0.3)', text: '#7e22ce', border: '#e9d5ff', bgLight: '#faf5ff' },
          // 22-Nov-2026: seven more theme colours
          steel:    { start: '#4a6fa5', end: '#34527d', shadow: 'rgba(74, 111, 165, 0.3)', text: '#34527d', border: '#b6c8e2', bgLight: '#f1f5fb' },
          royal:    { start: '#2548c9', end: '#1a3394', shadow: 'rgba(37, 72, 201, 0.3)', text: '#1a3394', border: '#a9b9f0', bgLight: '#eef2fe' },
          petrol:   { start: '#0b6477', end: '#084756', shadow: 'rgba(11, 100, 119, 0.3)', text: '#084756', border: '#8ccbd8', bgLight: '#ecf7f9' },
          bottle:   { start: '#1b6b4a', end: '#114731', shadow: 'rgba(27, 107, 74, 0.3)', text: '#114731', border: '#9fd4bd', bgLight: '#eef8f3' },
          maroon:   { start: '#8a1c2c', end: '#5f101c', shadow: 'rgba(138, 28, 44, 0.3)', text: '#5f101c', border: '#e6a9b2', bgLight: '#fcf1f2' },
          bronze:   { start: '#9a6a2f', end: '#6f4a1c', shadow: 'rgba(154, 106, 47, 0.3)', text: '#6f4a1c', border: '#e3caa3', bgLight: '#fbf6ee' },
          charcoal: { start: '#3a3f4b', end: '#22252d', shadow: 'rgba(58, 63, 75, 0.3)', text: '#22252d', border: '#bfc4cf', bgLight: '#f3f4f6' }
        };
      
function App() {
  useEffect(() => {
    const applyTheme = (settings) => {
      // Save locally so login page gets it instantly
      localStorage.setItem('localThemeSettings', JSON.stringify(settings));

      const root = document.documentElement;
      
      // BACKGROUND LOGIC
      document.documentElement.style.filter = 'none';
      const el = document.getElementById('dark-mode-fixes');
      if(el) el.remove();

      const bg = settings.appBackground || (settings.theme === 'dark' ? 'midnight' : 'slate');
      
                    const selectedBg = bgThemes[bg] || bgThemes.slate;
      const color = settings.primaryColor || 'blue';
      
                      const palette = palettes[color] || palettes.blue;
      const actualBgApp = selectedBg.app;

      root.style.setProperty('--bg-app', actualBgApp);
      root.style.setProperty('--bg-panel', selectedBg.panel);
      root.style.setProperty('--bg-input', selectedBg.input);
      const isDark = bg === 'midnight' || bg === 'dark';
      root.style.setProperty('--input-text', isDark ? '#ffffff' : '#000000');
      root.style.setProperty('--text-main', selectedBg.textMain);
      root.style.setProperty('--text-muted', selectedBg.textMuted);
      root.style.setProperty('--border-color', selectedBg.border);
      document.documentElement.style.background = actualBgApp;
      
      root.style.setProperty('--primary-color-start', palette.start);
      root.style.setProperty('--primary-color-end', palette.end);
      root.style.setProperty('--primary-shadow', palette.shadow);
      root.style.setProperty('--primary-text', palette.text);
      root.style.setProperty('--primary-border', palette.border);
      root.style.setProperty('--primary-bg-light', palette.bgLight);
    };

    const fetchTheme = async () => {
      // Apply locally cached theme immediately (vital for Login page)
      const local = localStorage.getItem('localThemeSettings');
      if(local) {
        try { applyTheme(JSON.parse(local)); } catch(e){}
      } else {
        applyTheme({ theme: 'light', appBackground: 'sky', primaryColor: 'blue' });
      }

      try {
        const token = localStorage.getItem('token');
        if(!token) return; // don't fetch if logged out

        const res = await fetch('/api/auth/settings', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if(res.ok) {
          const data = await res.json();
          if(data) applyTheme(data);
        }
      } catch(e) {}
    };

    fetchTheme();

    const handleSettingsUpdate = (e) => {
      if(e.detail) applyTheme(e.detail);
    };
    window.addEventListener('settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('settings-updated', handleSettingsUpdate);
  }, []);

  return (
    <ErrorBoundary>
      <GlobalProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/director-mis" element={<DirectorDashboard />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
            <Route path="/sales-crm" element={<SalesCRM />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/track-trace" element={<TrackAndTrace />} />
            <Route path="/fleet-management" element={<FleetManagement />} />
            <Route path="/field-tracking" element={<FieldTrackingDashboard />} />
            {/* HRMS is now a separate app (hrms-frontend / hrms-backend). Old links forward there. */}
            <Route path="/hr-module" element={<GoToHrms path="/" />} />
            <Route path="/employee-portal" element={<GoToHrms path="/ess" />} />
            <Route path="/gst-reco" element={<GSTReconciliation />} />
            <Route path="/company-settings" element={<CompanySettings />} />
            <Route path="/payroll-settings" element={<GoToHrms path="/payroll-settings" />} />
            <Route path="/reports" element={<AdvancedReports />} />
            <Route path="/submit-sb-job" element={<SubmitSbJob />} />
            <Route path="/be-amendments" element={<BeAmendments />} />
            <Route path="/vendor-master" element={<VendorMaster />} />
            <Route path="/purchase-management" element={<PurchaseOrderMaster />} />
            <Route path="/po-approval/:id" element={<POApproval />} />
        <Route path="/po-view/:id" element={<POView />} />
            <Route path="/asset-management" element={<AssetManagement />} />
            
            <Route path="/job-entry/*" element={<JobEntryLayout />} />
            <Route path="/export-entry/*" element={<ExportEntryLayout />} />
            <Route path="/settings/*" element={<SettingsLayout />} />
            <Route path="/accounts" element={<ChartOfAccounts />} />
            <Route path="/accounts-hub" element={<AccountsHub />} />
            <Route path="/voucher-entry" element={<VoucherEntry />} />
            <Route path="/vendor-bill" element={<VendorBillEntry />} />
            <Route path="/cash-flow" element={<CashFlow />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/credit-control" element={<CreditControlDashboard />} />
            <Route path="/expense-approvals" element={<ExpenseApprovals />} />
            <Route path="/daybook" element={<Daybook />} />
            <Route path="/ledger-statement" element={<LedgerStatement />} />
            <Route path="/trial-balance" element={<TrialBalance />} />
            <Route path="/profit-and-loss" element={<ProfitAndLoss />} />
            <Route path="/balance-sheet" element={<BalanceSheet />} />
            <Route path="/bank-reconciliation" element={<BankReconciliation />} />
            <Route path="/gst-returns" element={<GSTReports />} />
            <Route path="/job-billing" element={<JobBilling />} />
            <Route path="/bulk-billing" element={<BulkBilling />} />
            <Route path="/payment-receipt" element={<PaymentReceiptEntry />} />
            <Route path="/freight/job-expense" element={<JobExpenseRequest />} />
            <Route path="/outstanding-reports" element={<OutstandingReports />} />
            <Route path="/cost-centres" element={<CostCentres />} />
            <Route path="/cash-flow" element={<CashFlow />} />
            <Route path="/budgets" element={<Budgets />} />
            
            <Route path="/master/dsr-template" element={<DSRTemplateMaster />} />
            <Route path="/master/contract-master" element={<ContractMaster />} />
            <Route path="/settings/document-series" element={<Navigate to="/settings?tab=numseries" replace />} />
            <Route path="/master/*" element={<MDM />} />
            <Route path="/mdm/*" element={<MDM />} />
            
            <Route path="/settings/sftp" element={<Navigate to="/settings" replace />} />

            <Route path="/freight/shipment/:div" element={<ShipmentRegistration />} />
            <Route path="/freight/air-export" element={<AirExportDashboard />} />
            <Route path="/freight/air-import" element={<AirImportDashboard />} />
            <Route path="/freight/sea-export" element={<SeaExportDashboard />} />
            <Route path="/freight/sea-import" element={<SeaImportDashboard />} />
            <Route path="/freight/create-awb" element={<CreateAirWaybill />} />
            <Route path="/freight/create-hawb" element={<CreateHouseWaybill />} />
            <Route path="/freight/create-mawb" element={<CreateMasterWaybill />} />
            <Route path="/freight/ecsd" element={<EcsdForm />} />
            <Route path="/freight/search-awb" element={<SearchAirWaybill />} />
            <Route path="/freight/track-shipments" element={<TrackShipments />} />
            <Route path="/freight/tonnage-report" element={<TonnageReport />} />
            <Route path="/freight/csr-statement" element={<CsrStatement />} />
            
            <Route path="/reports/export-data" element={<ExportData />} />
            <Route path="/reports/forwarder-transactions" element={<ForwarderTransactionsReport />} />
            <Route path="/reports/*" element={<Dashboard />} />
            
            <Route path="/e-freight" element={<EFreightDashboard />} />
              <Route path="/e-freight/create-awb" element={<EFreightAWBForm />} />
              <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Router>
      <Toaster position="top-right" toastOptions={{
        duration: 4000,
        style: { 
          background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', 
          color: '#fff',
          fontWeight: '500',
          boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4)',
          borderRadius: '10px',
          padding: '12px 20px'
        },
        success: {
          style: {
            background: 'linear-gradient(135deg, #064e3b, #10b981)',
            boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
          }
        },
        error: {
          style: {
            background: 'linear-gradient(135deg, #7f1d1d, #ef4444)',
            boxShadow: '0 10px 25px rgba(239, 68, 68, 0.4)',
          }
        }
      }} />
      </GlobalProvider>
    </ErrorBoundary>
  );
}

export default App;

