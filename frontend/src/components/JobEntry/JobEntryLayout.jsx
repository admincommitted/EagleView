import { useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import QueryTab from './Tabs/QueryTab';
import JobHeaderTab from './Tabs/JobHeaderTab';
import InvoiceGridTab from './Tabs/InvoiceGridTab';
import ItemGridTab from './Tabs/ItemGridTab';
import ReportTab from './Tabs/ReportTab';
import ImportDashboardTab from './Tabs/ImportDashboardTab';
import { JobProvider, JobContext } from './JobContext';
import JobMasterLists from './JobMasterLists';
import WhBeSelectorModal from './WhBeSelectorModal';
import BeAmendModal from './BeAmendModal';
import IcegateAckModal from './IcegateAckModal';
import { jobEntryApi } from './jobEntryApi';
import ImportFileModal from '../common/ImportFileModal';
import IcegateSubmitModal from '../common/IcegateSubmitModal';
import IcegateIdPickModal from '../common/IcegateIdPickModal';
import ValidationResultModal from '../common/ValidationResultModal';
import askConfirm from '../common/askConfirm';
import HelpViewer from '../HelpViewer';
import TimelineDrawer from '../TimelineDrawer';
import { usePermissions } from '../../utils/permissions';

import { serverReply } from './JobEntryLayoutParts/serverReply';
import { mapLoadedImportJob } from './JobEntryLayoutParts/loadedJob';
import { boeTypeOf, shipmentModeOf } from './JobEntryLayoutParts/jobCodes';
import { JOB_ENTRY_TABS, isTabAllowed } from './JobEntryLayoutParts/jobEntryTabs';
import { jobActionsMenuItems } from './JobEntryLayoutParts/jobActionsMenu';
import { jobListActionHandler } from './JobEntryLayoutParts/jobListActions';
import { useFiledLock } from './JobEntryLayoutParts/useFiledLock';
import { useWarehouseLink } from './JobEntryLayoutParts/useWarehouseLink';
import { useJobSave } from './JobEntryLayoutParts/useJobSave';
import { useUnsavedEditsCheck } from './JobEntryLayoutParts/useUnsavedEditsCheck';
import { useIcegateFiling } from './JobEntryLayoutParts/useIcegateFiling';
import { useBeFiles } from './JobEntryLayoutParts/useBeFiles';
import { useAiInvoiceExtract } from './JobEntryLayoutParts/useAiInvoiceExtract';
import { useJobImport } from './JobEntryLayoutParts/useJobImport';
import { useSendAfterOpen } from './JobEntryLayoutParts/useSendAfterOpen';
import { useOpenJobFromUrl } from './JobEntryLayoutParts/useOpenJobFromUrl';
import JobHeaderBar from './JobEntryLayoutParts/JobHeaderBar';
import JobEntryTabStrip from './JobEntryLayoutParts/JobEntryTabStrip';
import IcegateBanner from './JobEntryLayoutParts/IcegateBanner';
import JsonPreviewModal from './JobEntryLayoutParts/JsonPreviewModal';
import AiExtractOverlay from './JobEntryLayoutParts/AiExtractOverlay';

// The Mode / BE Type boxes of the Job Header live here (transportMode / beType); jobData follows them so the
// checklist, duty reports and validator of an unsaved job see the chosen mode and type.
function useModeAndTypeInJob(transportMode, beType, setJobData) {
  useEffect(() => {
    const shipmentMode = shipmentModeOf(transportMode);
    const boeType = boeTypeOf(beType);
    setJobData((job) => (job.shipmentMode === shipmentMode && job.boeType === boeType && job.autoField_52 === transportMode && job.autoField_51 === beType
      ? job
      : { ...job, shipmentMode, boeType, autoField_52: transportMode, autoField_51: beType }));
  }, [transportMode, beType, setJobData]);
}

function useAllowedTabs(activeTab, setActiveTab) {
  const permissions = usePermissions();
  const allowedTabs = JOB_ENTRY_TABS.map((tab) => tab.key).filter((key) => isTabAllowed(permissions, key));
  const isActiveTabAllowed = allowedTabs.includes(activeTab);
  const firstAllowedTab = allowedTabs[0];
  useEffect(() => {
    if (!isActiveTabAllowed && firstAllowedTab) setActiveTab(firstAllowedTab);
  }, [isActiveTabAllowed, firstAllowedTab, setActiveTab]);
  return allowedTabs;
}

function JobEntryScreen() {
  const { jobData, setJobData, items, setItems, resetJobContext, esanchitDocs, setEsanchitDocs } = useContext(JobContext);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [resetCount, setResetCount] = useState(0);
  const [transportMode, setTransportMode] = useState('A');
  const [beType, setBeType] = useState('H');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [timeline, setTimeline] = useState({ open: false, jobId: null });
  const [showBeAmend, setShowBeAmend] = useState(false);
  const [listAmendJob, setListAmendJob] = useState(null);
  const [showAck, setShowAck] = useState(false);

  const allowedTabs = useAllowedTabs(activeTab, setActiveTab);
  useModeAndTypeInJob(transportMode, beType, setJobData);

  const screenJob = { jobData, items, esanchitDocs, beType, transportMode };
  const openAmendment = () => setShowBeAmend(true);
  const refreshList = () => setListRefreshKey((key) => key + 1);
  const openTimeline = (jobId = null) => setTimeline({ open: true, jobId });

  const stopForUnsavedEdits = useUnsavedEditsCheck();
  const filedLock = useFiledLock(jobData);
  const warehouse = useWarehouseLink({ jobData, setJobData, items, setItems, esanchitDocs, setEsanchitDocs, beType, setTransportMode });
  const { saveJob, autoSave } = useJobSave({
    jobData, setJobData, items, esanchitDocs, transportMode, beType, filedLock,
    openWarehouseSelector: () => warehouse.setShowWhSelector(true),
    reloadJob: (jobId) => loadJob(jobId),
  });
  const icegate = useIcegateFiling({ screenJob, setJobData, saveJob, stopForUnsavedEdits, filedLock, openAmendment });
  const beFiles = useBeFiles({ screenJob, stopForUnsavedEdits, showValidation: icegate.setValidationResult, openAmendment, openListAmendment: setListAmendJob });
  const aiExtract = useAiInvoiceExtract({ jobData, setJobData, setItems });
  const sendOnceOpened = useSendAfterOpen(jobData, icegate.startIcegateSend);

  // the result banner / validation / preview of the previous job do not stay on screen
  const loadJob = async (jobId) => {
    icegate.clearIcegateState();
    icegate.setValidationResult(null);
    beFiles.setPreview(null);
    filedLock.endAmendMode();
    try {
      const reply = await serverReply(jobEntryApi.job(jobId));
      if (!reply.success || !reply.data) return;
      // replace, not merge: merging kept fields of the job that was open before
      const loaded = mapLoadedImportJob(reply.data);
      setJobData(loaded.jobData);
      setItems(loaded.items);
      setEsanchitDocs(loaded.esanchitDocs);
      setTransportMode(loaded.transportMode);
      setBeType(loaded.beType);
      setActiveTab('header');
    } catch (error) {
      console.error('Failed to load job', error);
    }
  };

  const openJob = async (jobId) => {
    await loadJob(jobId);
    setActiveTab('header');
  };

  const jobImport = useJobImport({
    setJobData, setItems, setTransportMode, setBeType,
    openSavedJob: (jobId) => {
      refreshList();
      loadJob(jobId);
      setActiveTab('header');
    },
  });

  useOpenJobFromUrl(async (jobId, withAmendment) => {
    await openJob(jobId);
    if (withAmendment) openAmendment();
  });

  // shared by "+ CREATE NEW JOB" and the "New Job" button of the job list
  const resetToNewJob = () => {
    resetJobContext();
    setTransportMode('A');
    setBeType('H');
    icegate.clearIcegateState();
    setResetCount((count) => count + 1);
    setActiveTab('header');
  };

  const confirmNewJob = async () => {
    const confirmed = await askConfirm({ title: 'Start a new job?', message: 'Unsaved changes on this job will be cleared.', okLabel: 'Start new job', cancelLabel: 'Stay on this job' });
    if (!confirmed) return;
    resetToNewJob();
    toast.success('New job ready');
  };

  const openJobThenSend = async (jobId) => {
    await loadJob(jobId);
    sendOnceOpened(jobId);
  };

  // a preview made from the job list sends THAT job: it opens first, since Send needs it on the screen
  const sendPreviewedJob = () => {
    const listJobData = beFiles.preview?.listJobData;
    beFiles.setPreview(null);
    if (listJobData?.id && String(listJobData.id) !== String(jobData.id || '')) {
      openJobThenSend(listJobData.id);
      return;
    }
    icegate.startIcegateSend();
  };

  const runJobListAction = jobListActionHandler({
    resetToNewJob, loadJob, setActiveTab, setJobData, refreshList, openTimeline, openAmendment, sendOnceOpened,
    openImport: jobImport.openImport,
    endAmendMode: filedLock.endAmendMode,
    openListAmendment: setListAmendJob,
    askIcegateId: beFiles.askIcegateId,
    chooseInvoicePdf: aiExtract.chooseInvoicePdf,
  });

  const actionItems = jobActionsMenuItems({
    isAmendedJob: !!jobData._amendmentId,
    loadingPreview: beFiles.loadingPreview,
    isAiLoading: aiExtract.isAiLoading,
    isSubmitting: icegate.icegateState.loading,
    actions: {
      importFile: () => jobImport.openImport(),
      previewJson: () => beFiles.askIcegateId('preview'),
      downloadJson: () => beFiles.askIcegateId('json'),
      downloadFlatBe: () => beFiles.askIcegateId('flat'),
      beAmendment: openAmendment,
      saveDraft: () => saveJob(),
      aiExtract: aiExtract.chooseInvoicePdf,
      sendToIcegate: () => icegate.startIcegateSend(),
    },
  });

  const { icegateState } = icegate;
  const icegateUniqueId = jobData.icegateUniqueId || icegateState.result?.uniqueId;

  const applyIcegateReply = (reply) => {
    const replyJob = reply.job || {};
    setJobData((job) => ({
      ...job,
      icegateStatus: replyJob.icegateStatus || job.icegateStatus,
      icegateUniqueId: replyJob.icegateUniqueId || job.icegateUniqueId,
      beNo: job.beNo || replyJob.beNo || job.beNo,
      beDate: job.beDate || replyJob.beDate || job.beDate,
    }));
    if (reply.state !== 'pending') icegate.setIcegateState((state) => ({ ...state, result: null }));
  };

  return (
    <div className="tw:flex tw:h-full tw:min-w-0 tw:flex-col">
      {aiExtract.isAiLoading && <AiExtractOverlay />}

      <JobHeaderBar
        beType={beType}
        linkedWhJob={warehouse.linkedWhJob}
        actionItems={actionItems}
        onNewJob={confirmNewJob}
        onSelectWarehouse={() => warehouse.setShowWhSelector(true)}
        onShowHelp={() => setIsHelpOpen(true)}
        stripProps={{
          jobData, transportMode, filedLock,
          icegateResult: icegateState.result,
          onOpenAmendment: openAmendment,
          onOpenJob: loadJob,
          onShowAck: () => setShowAck(true),
        }}
      />

      {icegateState.result && (
        <IcegateBanner tone="success" title="BE Filed Successfully to ICEGATE!" onClose={icegate.clearIcegateState}>
          <span>Unique ID: <strong>{icegateState.result.uniqueId}</strong></span>
          <span className="tw:opacity-60">|</span>
          <span>{icegateState.result.message}</span>
        </IcegateBanner>
      )}
      {icegateState.error && (
        <IcegateBanner tone="error" title="ICEGATE Submission Failed:" onClose={icegate.clearIcegateState}>
          <span>{icegateState.error}</span>
        </IcegateBanner>
      )}

      <div className="glass-panel entry-lg tw:flex tw:flex-1 tw:flex-col tw:overflow-y-auto tw:p-0">
        <JobEntryTabStrip activeTab={activeTab} onTabChange={setActiveTab} allowedTabs={allowedTabs} onShowTimeline={() => openTimeline()} />

        <div key={`tabs-${resetCount}`} className="entry-lg-body tw:min-w-0 tw:flex-1 tw:overflow-y-auto tw:p-2 tw:md:p-4">
          {activeTab === 'dashboard' && <ImportDashboardTab onGoToQuery={() => setActiveTab('query')} onOpenJob={(jobId) => { loadJob(jobId); setActiveTab('header'); }} />}
          {activeTab === 'query' && <QueryTab refreshKey={listRefreshKey} onAction={runJobListAction} />}
          {activeTab === 'header' && <JobHeaderTab transportMode={transportMode} setTransportMode={setTransportMode} beType={beType} setBeType={setBeType} onSave={saveJob} />}
          {activeTab === 'invoices' && <InvoiceGridTab onSave={autoSave} />}
          {activeTab === 'items' && <ItemGridTab transportMode={transportMode} onSave={autoSave} onValidate={icegate.validateJob} />}
          {activeTab === 'reports' && <ReportTab />}
        </div>
      </div>

      {jobImport.importWindow.open && (
        <ImportFileModal type="be" initialTab={jobImport.importWindow.tab} onImport={jobImport.applyImport} onClose={jobImport.closeImport} />
      )}

      {warehouse.showWhSelector && (
        <WhBeSelectorModal
          importerName={jobData.autoField_4 || jobData.nameOfImporter}
          iecCode={jobData.autoField_5 || jobData.iecCode}
          customsPort={jobData.portCode || jobData.autoField_2}
          excludeJobId={jobData.id}
          onSelect={warehouse.linkWarehouseBe}
          onManual={() => { setActiveTab('header'); toast('Enter the WH BE No, WH BE Date and Warehouse Code in Job Header (Ex-Bond box)', { duration: 6000 }); }}
          onClose={() => warehouse.setShowWhSelector(false)}
        />
      )}

      <ValidationResultModal result={icegate.validationResult} onClose={() => icegate.setValidationResult(null)} />

      <IcegateIdPickModal
        open={beFiles.idPickModal.open}
        chaCode={beFiles.idPickModal.jobData?.autoField_3}
        title={beFiles.idPickModal.title}
        actionLabel={beFiles.idPickModal.actionLabel}
        onClose={beFiles.idPickModal.onClose}
        onPick={beFiles.idPickModal.onPick}
      />

      <BeAmendModal open={showBeAmend} onClose={() => setShowBeAmend(false)} jobData={jobData} onOpenJob={openJob} />
      <BeAmendModal open={!!listAmendJob} onClose={() => setListAmendJob(null)} jobData={listAmendJob} onOpenJob={async (jobId) => { setListAmendJob(null); await openJob(jobId); }} />
      <IcegateAckModal open={showAck} onClose={() => setShowAck(false)} jobId={jobData.id} uniqueId={icegateUniqueId} onResult={applyIcegateReply} />

      {icegate.showSubmitModal && (
        <IcegateSubmitModal
          allowAmendment={false}
          chaCode={jobData.autoField_3}
          onSubmit={icegate.submitToIcegate}
          onSignOnly={icegate.downloadSignedFile}
          onClose={() => icegate.setShowSubmitModal(false)}
          loading={icegateState.loading}
        />
      )}

      {beFiles.preview && (
        <JsonPreviewModal preview={beFiles.preview} screenJobData={jobData} onClose={() => beFiles.setPreview(null)} onSend={sendPreviewedJob} />
      )}

      <HelpViewer isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} topic={activeTab} />
      <TimelineDrawer isOpen={timeline.open} onClose={() => setTimeline((current) => ({ ...current, open: false }))} jobId={timeline.jobId || jobData.id} module="IMPORT" />
    </div>
  );
}

export default function JobEntryLayout() {
  return (
    <JobProvider>
      <JobEntryScreen />
      <JobMasterLists />
    </JobProvider>
  );
}
