import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import askConfirm from '../../common/askConfirm';
import { jobEntryApi } from '../jobEntryApi';
import { serverReply } from './serverReply';
import { mapLoadedImportJob } from './loadedJob';
import { duplicateJobCopy } from './duplicateJob';

const LIST_FILE_KINDS = { 'list-preview': 'preview', 'list-json': 'json', 'list-flat': 'flat', 'list-amend': 'amend' };

// The job list's buttons, icons and right-click menu (QueryTab onAction). `screen` holds the job screen's actions.
export function jobListActionHandler(screen) {
  const openOnTab = async (row, tab) => {
    await screen.loadJob(row.id);
    if (tab === 'esanchit') {
      screen.setActiveTab('items');
      toast('e-Sanchit documents are in 4. Items > Supporting Docs (Doc. for: BE / invoice / item)', { duration: 6000, icon: '📎' });
    } else {
      screen.setActiveTab(tab);
    }
  };

  const openCopy = async (row) => {
    await screen.loadJob(row.id);
    screen.setJobData((job) => {
      const { copy, clearedRateLines } = duplicateJobCopy(job);
      if (clearedRateLines) setTimeout(() => toast(`Freight / insurance: the rate is kept and the amount worked out from it cleared on ${clearedRateLines} invoice line(s) - check 3. Invoices`, { id: 'dup-rate', icon: 'ℹ️', duration: 7000 }), 300);
      return copy;
    });
    screen.endAmendMode();
    toast.success(`Copy of job ${row.jobNo || ''} opened - click Save to create it`);
    screen.setActiveTab('header');
  };

  // BE file / .be / Preview / Amendment of a saved job without opening it, built from the job read here
  const fileFromList = async (row, kind) => {
    try {
      const reply = await serverReply(jobEntryApi.job(row.id));
      if (!reply?.success || !reply.data) {
        toast.error(`Could not read job ${row.jobNo || ''}${reply?.error ? `: ${reply.error}` : ''}`);
        return;
      }
      const listJob = mapLoadedImportJob(reply.data);
      if (kind === 'amend') {
        screen.openListAmendment(listJob.jobData);
        return;
      }
      if (listJob.jobData._amendmentId) {
        toast(`Job ${listJob.jobData.jobNo || ''} is an amended job - its file for ICEGATE is the amendment file. Make / download it here.`, { icon: '📝', duration: 6000 });
        screen.openListAmendment(listJob.jobData);
        return;
      }
      screen.askIcegateId(kind, listJob);
    } catch (error) {
      toast.error(`Could not read job ${row.jobNo || ''}: ${errorMessage(error)}`);
    }
  };

  const deleteJob = async (row) => {
    const confirmed = await askConfirm({ title: 'Delete this job?', message: `Job No ${row.jobNo} is deleted with its invoices and items.`, okLabel: 'Delete job', cancelLabel: 'Keep the job', tone: 'danger' });
    if (!confirmed) return;
    try {
      const reply = await serverReply(jobEntryApi.deleteJob(row.id));
      if (reply.success) {
        toast.success('Job deleted successfully!');
        screen.refreshList();
      } else {
        toast.error(`Error deleting job: ${reply.error}`);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const rowActions = {
    edit: (row) => {
      screen.loadJob(row.id);
      screen.setActiveTab('header');
    },
    duplicate: openCopy,
    timeline: (row) => screen.openTimeline(row.id),
    amend: async (row) => {
      await screen.loadJob(row.id);
      screen.setActiveTab('header');
      screen.openAmendment();
    },
    // these need the job on the screen: it opens and the action starts by itself
    'open-send': async (row) => {
      await screen.loadJob(row.id);
      screen.sendOnceOpened(row.id);
    },
    'open-ai': async (row) => {
      await screen.loadJob(row.id);
      setTimeout(screen.chooseInvoicePdf, 50);
      toast(`Job ${row.jobNo || ''} opened - choose the supplier invoice PDF (if no window opened: Actions > AI PDF Extract)`, { icon: '🤖', duration: 7000 });
    },
    delete: deleteJob,
  };

  return async (action, row) => {
    if (action === 'new') {
      screen.resetToNewJob();
      return;
    }
    if (action === 'import-file') {
      screen.openImport(row || 'file');
      return;
    }
    if (!row) return;
    if (typeof action === 'string' && action.startsWith('open:')) {
      await openOnTab(row, action.slice('open:'.length));
      return;
    }
    if (Object.hasOwn(LIST_FILE_KINDS, action)) {
      await fileFromList(row, LIST_FILE_KINDS[action]);
      return;
    }
    if (Object.hasOwn(rowActions, action)) await rowActions[action](row);
  };
}
