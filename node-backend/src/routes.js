import { Router } from 'express';
import notificationsRoutes from './modules/communication/notifications/notifications.routes.js';
import masterRoutes from './modules/master/master.routes.js';
import calculationsRoutes from './modules/freight/calculations/calculations.routes.js';
import awbRoutes from './modules/freight/awb/awb.routes.js';
import poRoutes from './modules/purchase/po/po.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import userManagementRoutes from './modules/user/management/management.routes.js';
import stockRoutes from './modules/freight/stock/stock.routes.js';
import searchRoutes from './modules/ai-search/search/search.routes.js';
import penaltyRuleRoutes from './modules/master/penalty-rule/penaltyRule.routes.js';
import locationRoutes from './modules/master/location/location.routes.js';
import icaffePartyRoutes from './modules/master/icaffe-party/icaffeParty.routes.js';
import gstInvoiceRoutes from './modules/account/gst-invoice/gstInvoice.routes.js';
import accountsHubRoutes from './modules/account/hub/hub.routes.js';
import portRoutes from './modules/master/port/port.routes.js';
import cbicWatchRoutes from './modules/settings/cbic-watch/cbicWatch.routes.js';
import settingsRoutes from './modules/settings/core/core.routes.js';
import whatsappRoutes from './modules/communication/whatsapp/whatsapp.routes.js';
import emailRoutes from './modules/communication/email/email.routes.js';
import tactRoutes from './modules/master/tact/tact.routes.js';
import signerQueueRoutes from './modules/icegate/signer-queue/signerQueue.routes.js';
import icegateFilingRoutes from './modules/icegate/filing/filing.routes.js';
import jobFilesRoutes from './modules/customs/job-files/jobFiles.routes.js';
import ulipRoutes from './modules/icegate/ulip/ulip.routes.js';
import dgftIecRoutes from './modules/icegate/dgft-iec/dgftIec.routes.js';
import igmEnquiryRoutes from './modules/icegate/igm-enquiry/igmEnquiry.routes.js';
import icegateProfileRoutes from './modules/master/icegate-profile/icegateProfile.routes.js';
import importFileRoutes from './modules/customs/import-file/importFile.routes.js';
import warehouseBeRoutes from './modules/customs/warehouse-be/warehouseBe.routes.js';
import exportJobRoutes from './modules/customs/export-job/exportJob.routes.js';
import exportDashboardRoutes from './modules/customs/export-dashboard/exportDashboard.routes.js';
import importDashboardRoutes from './modules/customs/import-dashboard/importDashboard.routes.js';
import assetsRoutes from './modules/purchase/assets/assets.routes.js';
import statusRoutes from './modules/master/status/status.routes.js';
import documentSeriesRoutes from './modules/account/document-series/documentSeries.routes.js';
import numberSeriesRoutes from './modules/account/number-series/numberSeries.routes.js';
import contractsRoutes from './modules/sales/contracts/contracts.routes.js';
import userPreferencesRoutes from './modules/user/preferences/preferences.routes.js';
import timelineRoutes from './modules/customs/timeline/timeline.routes.js';
import dsrTemplateRoutes from './modules/master/dsr-template/dsrTemplate.routes.js';
import tariffRoutes from './modules/master/tariff/tariff.routes.js';
import importJobRoutes from './modules/customs/import-job/importJob.routes.js';
import beAmendmentRoutes from './modules/customs/be-amendment/beAmendment.routes.js';
import accountListRoutes from './modules/account/account-list/accountList.routes.js';
import voucherRoutes from './modules/account/voucher/voucher.routes.js';
import invoiceRoutes from './modules/account/invoice/invoice.routes.js';
import accountingMasterRoutes from './modules/account/accounting-master/accountingMaster.routes.js';
import creditControlRoutes from './modules/account/credit-control/creditControl.routes.js';
import budgetRoutes from './modules/account/budget/budget.routes.js';
import salesCoreRoutes from './modules/sales/core/core.routes.js';
import salesHubRoutes from './modules/sales/sales-hub/salesHub.routes.js';
import salesDealsRoutes from './modules/sales/sales-deals/salesDeals.routes.js';
import fleetRoutes from './modules/freight/fleet/fleet.routes.js';
import freightOpsRoutes from './modules/freight/freight-ops/freightOps.routes.js';
import shipmentsRoutes from './modules/freight/shipments/shipments.routes.js';
import inventoryRoutes from './modules/purchase/inventory/inventory.routes.js';
import bulkZipRoutes from './modules/customs/bulk-zip/bulkZip.routes.js';
import aiExtractorRoutes from './modules/ai-search/ai-extractor/aiExtractor.routes.js';
import chatbotRoutes from './modules/ai-search/chatbot/chatbot.routes.js';

// Express answers with the first route that matches, so this order is part of the API: keep it as it is
// (a longer prefix such as /api/masters/ports comes after /api/masters on purpose).
const PROTECTED_ROUTES = [
  ['/notifications', notificationsRoutes],
  ['/masters', masterRoutes],
  ['/calculations', calculationsRoutes],
  ['/awb', awbRoutes],
  ['/po', poRoutes],
  ['/reports', reportsRoutes],
  ['/users', userManagementRoutes],
  ['/stock', stockRoutes],
  ['/search', searchRoutes],
  ['/penalty-rules', penaltyRuleRoutes],
  ['/locations', locationRoutes],
  ['/icaffe-parties', icaffePartyRoutes],
  ['/accounts-hub/gst-invoice', gstInvoiceRoutes],
  ['/accounts-hub', accountsHubRoutes],
  ['/masters/ports', portRoutes],
  ['/settings/cbic-watch', cbicWatchRoutes],
  ['/settings', settingsRoutes],
  ['/whatsapp', whatsappRoutes],
  ['/email', emailRoutes],
  ['/tact', tactRoutes],
  ['/icegate/signer', signerQueueRoutes],
  ['/icegate', icegateFilingRoutes],
  ['/job-files', jobFilesRoutes],
  ['/ulip', ulipRoutes],
  ['/dgft', dgftIecRoutes],
  ['/icegate-enquiry', igmEnquiryRoutes],
  ['/icegate-profiles', icegateProfileRoutes],
  ['/import-file', importFileRoutes],
  ['/warehouse-be', warehouseBeRoutes],
  ['/export-jobs', exportJobRoutes],
  ['/export-dashboard', exportDashboardRoutes],
  ['/dashboard', importDashboardRoutes],
  ['/assets', assetsRoutes],
  ['/status-master', statusRoutes],
  ['/document-series', documentSeriesRoutes],
  ['/number-series', numberSeriesRoutes],
  ['/contracts', contractsRoutes],
  ['/user-prefs', userPreferencesRoutes],
  ['/timeline', timelineRoutes],
  ['/dsr-templates', dsrTemplateRoutes],
  ['/tariff', tariffRoutes],
  ['/import-jobs', importJobRoutes],
  ['/be-amendments', beAmendmentRoutes],
  ['/accounts', accountListRoutes],
  ['/vouchers', voucherRoutes],
  ['/invoices', invoiceRoutes],
  ['/accounting-masters', accountingMasterRoutes],
  ['/credit-control', creditControlRoutes],
  ['/budgets', budgetRoutes],
  ['/sales', salesCoreRoutes],
  ['/sales-hub', salesHubRoutes],
  ['/sales-hub', salesDealsRoutes],
  ['/fleet', fleetRoutes],
  ['/freight', freightOpsRoutes],
  ['/shipments', shipmentsRoutes],
  ['/inventory', inventoryRoutes],
  ['/bulk-zip', bulkZipRoutes],
  ['/ai-extractor', aiExtractorRoutes],
  ['/chatbot', chatbotRoutes],
];

/** The /api routes that need a login, mounted in their fixed order (app.js puts the login check in front). */
export function createProtectedApiRouter() {
  const router = Router();
  for (const [path, moduleRouter] of PROTECTED_ROUTES) router.use(path, moduleRouter);
  return router;
}
