import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import askConfirm, { askText } from '../../common/askConfirm';
import { withItemLists } from '../../../utils/asList';
import { serverReply } from '../../JobEntry/JobEntryLayoutParts/serverReply';
import { exportEntryApi } from '../exportEntryApi';
import { makeDuplicateCopy } from './exportJobCopy';
import { toHeaderContainers } from './exportContainers';

// the tab a job opens on, per job list action
const OPEN_ON_TAB = { edit: 'header', duplicate: 'header', amend: 'header', print_checklist: 'reports', scheme: 'scheme', esanchit: 'items' };
// "Opens the job and starts": the action runs by itself once the job is on the screen
const RUN_AFTER_OPEN = { 'open-send': 'send', 'open-preview': 'preview', 'open-flat': 'flat' };

const sameJobNo = (typed, jobNo) => String(typed).trim().toUpperCase() === String(jobNo).trim().toUpperCase();

// Items of ALL invoices, each with its invoice serial; item lists that come back as text (older backend) are lists again.
const itemsOfJob = (job) => (job.invoices || []).flatMap((invoice, index) => (invoice.items || []).map((item) => withItemLists({ ...item, invSr: item.invSr || index + 1 })));

// The job list's buttons, icons and right-click menu (ExportQueryTab onAction(action, id, row)). `screen` holds the
// export screen's state and actions.
export function exportJobListActionHandler(screen) {
  const openJob = async (jobId, action, row) => {
    try {
      const reply = await serverReply(exportEntryApi.exportJobById(jobId));
      if (!reply.success || !reply.data) return;
      const job = reply.data;
      if (action === 'duplicate') {
        makeDuplicateCopy(job);
        toast('Copy made without the e-Sanchit documents of the old shipment - upload this shipment\'s documents', { icon: 'ℹ️', duration: 6000 });
      }
      // jobs saved before the header list was kept (or read from a file) only have the containers rows
      if (!(Array.isArray(job.Containers) && job.Containers.length) && (job.containers || []).length) {
        job.Containers = toHeaderContainers(job.containers);
        job.containerFlag = 'Y';
      }
      // Amend: the job opens marked for amendment; "Send to ICEGATE" sends it as an amendment
      if (action === 'amend') job._amend = { amendmentType: row?.amendmentType || 'General', amendReason: row?.amendReason || '' };
      else delete job._amend;
      screen.setExportData(job);
      if (action === 'amend') toast(`Job ${job.jobNo} opened for amendment - make the change, Save, then Send to ICEGATE`, { icon: '✏️', duration: 6000 });
      screen.setItems(itemsOfJob(job));
      screen.setContainers(job.containers || []);
      screen.setDocs(job.docs || []);
      screen.setDbkItems(job.dbkItems || []);
      screen.setLicenseItems(job.licenseItems || []);
      screen.setActiveTab(OPEN_ON_TAB[action]);
    } catch (error) {
      console.error('Error fetching job:', error);
    }
  };

  const openThenRun = async (action, jobId, row) => {
    await openJob(jobId, 'edit');
    if (action === 'open-ai') {
      setTimeout(screen.chooseInvoicePdf, 50);
      toast(`Job ${row?.jobNo || ''} opened - choose the invoice PDF (if no window opened: Actions > AI PDF Extract)`, { icon: '🤖', duration: 7000 });
      return;
    }
    screen.runAfterOpen(jobId, RUN_AFTER_OPEN[action]);
  };

  // a filed job is refused; an admin may still delete it from EagleView after typing the job no
  const confirmFiledDelete = async (reply, jobNo) => {
    if (!reply.canForce) {
      toast.error(reply.error, { duration: 8000 });
      return false;
    }
    const typed = await askText({
      title: 'Delete a filed job',
      message: `${reply.error}\n\nThe SB stays with Customs. To delete this job from EagleView anyway, type the job no ${jobNo}.`,
      label: 'Job No',
      okLabel: 'Delete from EagleView',
      check: (text) => (sameJobNo(text, jobNo) ? '' : 'Job no does not match'),
    });
    if (typed === null) return false;
    if (!sameJobNo(typed, jobNo)) {
      toast.error('Job no does not match - not deleted');
      return false;
    }
    return true;
  };

  const deleteJob = async (jobId, row) => {
    const jobNo = row?.jobNo || `ID ${jobId}`;
    const confirmed = await askConfirm({ title: 'Delete this job?', message: `Are you sure you want to delete Job "${jobNo}"? This action cannot be undone.`, okLabel: 'Delete job', cancelLabel: 'Keep the job', tone: 'danger' });
    if (!confirmed) return;
    try {
      let reply = await serverReply(exportEntryApi.deleteJob(jobId));
      if (!reply.success && reply.filed) {
        if (!(await confirmFiledDelete(reply, jobNo))) return;
        reply = await serverReply(exportEntryApi.deleteJob(jobId, true));
      }
      if (reply.success) {
        toast.success(`Job ${jobNo} deleted successfully!`);
        screen.refreshList();
        if (screen.openJobId === jobId) {
          screen.resetExportContext();
          screen.setActiveTab('query');
        }
      } else {
        toast.error(`Delete failed: ${reply.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Delete failed:', errorMessage(error));
      toast.error('Server error while deleting job');
    }
  };

  const fillFromExcel = async (excelJob) => {
    if (!(await screen.confirmClearScreen('Fill a NEW job from this Excel?'))) return;
    screen.resetExportContext();
    screen.setExportData((job) => ({ ...job, ...excelJob.exportData }));
    screen.setItems(excelJob.items || []);
    screen.setActiveTab('header');
    toast.success(`Job filled from Excel (${(excelJob.items || []).length} item(s)) - check and click Save Draft`);
  };

  // id is the job id; for 'import-file' the import window tab, for 'excel-job' the job read from the Excel
  return async (action, id, row) => {
    if (action === 'timeline') {
      screen.openTimeline(id);
      return;
    }
    if ((Object.hasOwn(RUN_AFTER_OPEN, action) || action === 'open-ai') && id) {
      await openThenRun(action, id, row);
      return;
    }
    if (action === 'import-file') {
      if (await screen.confirmClearScreen('Read the file as a NEW job?')) screen.openImport(id || 'file');
      return;
    }
    if (action === 'excel-job' && id) {
      await fillFromExcel(id);
      return;
    }
    if (action === 'new') {
      if (!(await screen.confirmClearScreen('Start a new job?'))) return;
      screen.resetExportContext();
      screen.setActiveTab('header');
      toast.success('New job ready');
      return;
    }
    if (action === 'delete' && id) {
      await deleteJob(id, row);
      return;
    }
    if (Object.hasOwn(OPEN_ON_TAB, action) && id) {
      await openJob(id, action, row);
      return;
    }
    screen.setActiveTab('header');
  };
}
