import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import ExportQueryTab from './Tabs/ExportQueryTab';
import ExportHeaderTab from './Tabs/ExportHeaderTab';
import ExportInvoiceTab from './Tabs/ExportInvoiceTab';
import ExportItemTab from './Tabs/ExportItemTab';
import ExportSchemeTab from './Tabs/ExportSchemeTab';
import ExportReportTab from './Tabs/ExportReportTab';
import ExportDashboardTab from './Tabs/ExportDashboardTab';
import { ExportProvider, useExportContext } from './ExportContext';
import useExportCalc from './useExportCalc';
import ImportFileModal from '../common/ImportFileModal';
import IcegateSubmitModal from '../common/IcegateSubmitModal';
import IcegateIdPickModal from '../common/IcegateIdPickModal';
import ValidationResultModal from '../common/ValidationResultModal';
import askConfirm from '../common/askConfirm';
import IcegateAckModal from '../JobEntry/IcegateAckModal';
import IcegateBanner from '../JobEntry/JobEntryLayoutParts/IcegateBanner';
import TimelineDrawer from '../TimelineDrawer';
import { usePermissions } from '../../utils/permissions';

import { EXPORT_TAB_KEYS, TABS_WITH_FORMS, exportEntryTabs, isTabAllowed } from './ExportEntryLayoutParts/exportEntryTabs';
import { exportActionsMenuItems } from './ExportEntryLayoutParts/exportActionsMenu';
import { exportJobListActionHandler } from './ExportEntryLayoutParts/exportJobListActions';
import { toHeaderContainers } from './ExportEntryLayoutParts/exportContainers';
import { confirmClearScreen } from './ExportEntryLayoutParts/clearScreen';
import { useUnsavedEditsCheck } from './ExportEntryLayoutParts/useUnsavedEditsCheck';
import { useExportSave } from './ExportEntryLayoutParts/useExportSave';
import { useSbFiling } from './ExportEntryLayoutParts/useSbFiling';
import { useSbFiles } from './ExportEntryLayoutParts/useSbFiles';
import { useAiPdfExtract } from './ExportEntryLayoutParts/useAiPdfExtract';
import { useRunAfterOpen } from './ExportEntryLayoutParts/useRunAfterOpen';
import { usePredictedJobNo } from './ExportEntryLayoutParts/usePredictedJobNo';
import { useEnterMovesFocus, useSaveShortcuts } from './ExportEntryLayoutParts/useScreenShortcuts';
import ExportHeaderBar from './ExportEntryLayoutParts/ExportHeaderBar';
import ExportEntryTabStrip from './ExportEntryLayoutParts/ExportEntryTabStrip';
import SbJsonPreviewModal from './ExportEntryLayoutParts/SbJsonPreviewModal';

function useAllowedTabs(activeTab, setActiveTab) {
  const permissions = usePermissions();
  const allowedTabs = EXPORT_TAB_KEYS.filter((key) => isTabAllowed(permissions, key));
  const isActiveTabAllowed = isTabAllowed(permissions, activeTab);
  const firstAllowedTab = allowedTabs[0];
  useEffect(() => {
    if (!isActiveTabAllowed && firstAllowedTab) setActiveTab(firstAllowedTab);
  }, [isActiveTabAllowed, firstAllowedTab, setActiveTab]);
  return allowedTabs;
}

function HelpPanel() {
  return (
    <div className="tw:p-5">
      <h2>Help & Logic</h2>
      <p>Documentation coming soon.</p>
    </div>
  );
}

function ExportEntryScreen() {
  const screen = useExportContext();
  const { exportData, setExportData, items, setItems, setContainers, setDocs, setDbkItems, setLicenseItems, resetExportContext, pendingEditsMessage } = screen;
  const [activeTab, setActiveTab] = useState('dashboard');
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [timeline, setTimeline] = useState({ open: false, jobId: null });
  const [importWindow, setImportWindow] = useState({ open: false, tab: null });
  const [showReply, setShowReply] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  const allowedTabs = useAllowedTabs(activeTab, setActiveTab);
  useExportCalc();
  const predictedJobNo = usePredictedJobNo(exportData.jobNo, exportData.shipmentMode);

  const refreshList = () => setListRefreshKey((key) => key + 1);
  const openTimeline = (jobId = null) => setTimeline({ open: true, jobId });
  const openImport = (tab = null) => setImportWindow({ open: true, tab });

  const stopForUnsavedEdits = useUnsavedEditsCheck();
  const { saveDraft } = useExportSave({ screen, stopForUnsavedEdits, onSaved: refreshList });
  const filing = useSbFiling({ screen, stopForUnsavedEdits, showValidation: setValidationResult });
  const sbFiles = useSbFiles({ screen, showValidation: setValidationResult });
  const aiExtract = useAiPdfExtract({ exportData, items, setExportData, setItems });
  const runAfterOpen = useRunAfterOpen(exportData, { startIcegateSend: filing.startIcegateSend, askIcegateId: sbFiles.askIcegateId });
  useSaveShortcuts(saveDraft);

  const askToClearScreen = (question) => confirmClearScreen(question, exportData, items);

  // the Items / Invoices forms go when their tab is left: changes not put in with SAVE / MODIFY are asked about first
  const changeTab = async (tab) => {
    if (tab !== activeTab && TABS_WITH_FORMS.includes(activeTab)) {
      const message = pendingEditsMessage(activeTab);
      const leave = !message || await askConfirm({
        title: 'Changes not put in',
        message,
        note: 'Leave the tab: the changes in the form are dropped.\nStay here: press SAVE / MODIFY first, then change the tab.',
        okLabel: 'Leave the tab',
        cancelLabel: 'Stay here',
      });
      if (!leave) return;
    }
    setActiveTab(tab);
  };

  const confirmNewJob = async () => {
    const confirmed = await askConfirm({ title: 'Start a new job?', message: 'Unsaved changes on this job will be cleared.', okLabel: 'Start new job', cancelLabel: 'Stay on this job' });
    if (!confirmed) return;
    resetExportContext();
    setActiveTab('header');
    toast.success('New job ready');
  };

  const askIcegateIdAfterCheck = async (what, buildWhat) => {
    if (await stopForUnsavedEdits(buildWhat)) return;
    sbFiles.askIcegateId(what);
  };

  const runJobListAction = exportJobListActionHandler({
    ...screen,
    openJobId: exportData.id,
    setActiveTab, refreshList, openTimeline, openImport, runAfterOpen,
    confirmClearScreen: askToClearScreen,
    chooseInvoicePdf: aiExtract.chooseInvoicePdf,
  });

  const actionItems = exportActionsMenuItems({
    loadingPreview: sbFiles.loadingPreview,
    flatBusy: sbFiles.flatBusy,
    validating: filing.validating,
    isAiLoading: aiExtract.isAiLoading,
    isSubmitting: filing.icegateState.loading,
    actions: {
      importFile: async () => { if (await askToClearScreen('Read the file as a NEW job?')) openImport(); },
      previewJson: () => askIcegateIdAfterCheck('preview', 'build the JSON'),
      flatFile: () => askIcegateIdAfterCheck('flat', 'build the flat file'),
      validate: filing.validateJob,
      saveDraft,
      aiExtract: aiExtract.chooseInvoicePdf,
      sendToIcegate: filing.startIcegateSend,
    },
  });

  // a file is always read as a new job; its containers are shown in SB Header > Container Details (the list that is
  // saved / filed), and Nature of Cargo comes from the file
  const applyImport = ({ exportData: imported, invoices, items: importedItems, containers, docs, dbkItems, licenseItems }) => {
    resetExportContext();
    const headerContainers = toHeaderContainers(containers);
    const useFileContainers = headerContainers.length && !(imported?.Containers || []).length;
    setExportData((job) => ({
      ...job,
      natureOfCargo: '',
      ...imported,
      ...(invoices?.length > 0 ? { invoices } : {}),
      ...(useFileContainers ? { Containers: headerContainers, containerFlag: 'Y' } : {}),
    }));
    if (importedItems) setItems(importedItems);
    if (containers) setContainers(containers);
    if (docs) setDocs(docs);
    if (dbkItems) setDbkItems(dbkItems);
    if (licenseItems) setLicenseItems(licenseItems);
    setActiveTab('header');
  };

  const { icegateState } = filing;
  const chaCode = exportData.chaId || exportData.autoField_3;

  const applyIcegateReply = (reply) => {
    const replyJob = reply.job || {};
    setExportData((job) => ({
      ...job,
      icegateStatus: replyJob.icegateStatus || job.icegateStatus,
      icegateUniqueId: replyJob.icegateUniqueId || job.icegateUniqueId,
      sbNo: job.sbNo || replyJob.sbNo || job.sbNo,
      sbDate: job.sbDate || replyJob.sbDate || job.sbDate,
      status: replyJob.status || job.status,
    }));
    if (reply.state !== 'pending') filing.setIcegateState((state) => ({ ...state, result: null }));
  };

  const tabs = exportEntryTabs({ invoiceCount: exportData.invoices?.length || 0, itemCount: items?.length || 0 })
    .filter((tab) => allowedTabs.includes(tab.key));

  return (
    <div className="tw:flex tw:h-full tw:min-w-0 tw:flex-col">
      <ExportHeaderBar
        actionItems={actionItems}
        onNewJob={confirmNewJob}
        onShowHelp={() => changeTab('help')}
        stripProps={{ exportData, predictedJobNo, icegateResult: icegateState.result, onShowReply: () => setShowReply(true) }}
      />

      {icegateState.result && (
        <IcegateBanner tone="success" title="SB Filed Successfully to ICEGATE!" onClose={filing.clearIcegateState}>
          <span>Unique ID: <strong>{icegateState.result.uniqueId}</strong></span>
          <span className="tw:opacity-60">|</span>
          <span>{icegateState.result.message}</span>
        </IcegateBanner>
      )}
      {icegateState.error && (
        <IcegateBanner tone="error" title="ICEGATE Filing Error:" onClose={filing.clearIcegateState}>
          <span>{icegateState.error}</span>
        </IcegateBanner>
      )}

      <div className="glass-panel entry-lg tw:flex tw:flex-1 tw:flex-col tw:overflow-hidden tw:rounded-t-none tw:p-0">
        <ExportEntryTabStrip tabs={tabs} activeTab={activeTab} onTabChange={changeTab} onShowTimeline={() => openTimeline()} />

        <div className="entry-lg-body tw:min-w-0 tw:flex-1 tw:overflow-y-auto tw:p-2 tw:md:p-4">
          {activeTab === 'dashboard' && <ExportDashboardTab onGoToQuery={() => setActiveTab('query')} onOpenJob={(jobId) => runJobListAction('edit', jobId)} />}
          {activeTab === 'query' && <ExportQueryTab onAction={runJobListAction} refreshKey={listRefreshKey} />}
          {activeTab === 'header' && <ExportHeaderTab />}
          {activeTab === 'invoices' && <ExportInvoiceTab />}
          {activeTab === 'items' && <ExportItemTab />}
          {activeTab === 'scheme' && <ExportSchemeTab />}
          {activeTab === 'reports' && <ExportReportTab />}
          {activeTab === 'help' && <HelpPanel />}
        </div>
      </div>

      {sbFiles.preview?.json && (
        <SbJsonPreviewModal
          preview={sbFiles.preview}
          onClose={() => sbFiles.setPreview(null)}
          onShowValidation={setValidationResult}
          onSend={() => { sbFiles.setPreview(null); filing.startIcegateSend(); }}
        />
      )}

      {importWindow.open && (
        <ImportFileModal type="sb" initialTab={importWindow.tab} onImport={applyImport} onClose={() => setImportWindow({ open: false, tab: null })} />
      )}

      <ValidationResultModal result={validationResult} onClose={() => setValidationResult(null)} />

      {filing.showSubmitModal && (
        <IcegateSubmitModal
          chaCode={chaCode}
          onSubmit={filing.submitToIcegate}
          onSignOnly={filing.downloadSignedFile}
          onClose={() => filing.setShowSubmitModal(false)}
          loading={icegateState.loading}
        />
      )}

      <IcegateIdPickModal
        open={sbFiles.idPickModal.open}
        chaCode={chaCode}
        title={sbFiles.idPickModal.title}
        actionLabel={sbFiles.idPickModal.actionLabel}
        onClose={sbFiles.idPickModal.onClose}
        onPick={sbFiles.idPickModal.onPick}
      />

      <IcegateAckModal
        kind="SB"
        open={showReply}
        onClose={() => setShowReply(false)}
        jobId={exportData.id}
        uniqueId={exportData.icegateUniqueId || icegateState.result?.uniqueId}
        onResult={applyIcegateReply}
      />

      <TimelineDrawer isOpen={timeline.open} onClose={() => setTimeline((current) => ({ ...current, open: false }))} jobId={timeline.jobId || exportData.id} module="EXPORT" />
    </div>
  );
}

export default function ExportEntryLayout() {
  useEnterMovesFocus();
  return (
    <ExportProvider>
      <ExportEntryScreen />
    </ExportProvider>
  );
}
