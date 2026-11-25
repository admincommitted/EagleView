import { useRef } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import askConfirm from '../../common/askConfirm';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { apportionInvoiceCharges } from '../../../utils/calculations';
import { serverReply } from '../../JobEntry/JobEntryLayoutParts/serverReply';
import { exportEntryApi } from '../exportEntryApi';
import { invoicesWithItems } from './sbRequest';
import { savedContainersWithNo, toSavedContainers } from './exportContainers';

const SHOWN_PROBLEMS = 6;

function missingFieldMessage(payload) {
  if (!payload.shipmentMode) return 'Shipment Mode is mandatory.';
  if (!payload.shipperId && !String(payload.shipperName || '').trim()) return 'Not saved: select or enter the Exporter (SB Header).';
  if (!payload.consigneeId && !String(payload.consigneeName || '').trim()) return 'Not saved: select or enter the Consignee (SB Header).';
  return '';
}

function problemsMessage(problems) {
  const shown = problems.slice(0, SHOWN_PROBLEMS).map((problem) => `- ${problem}`).join('\n');
  const more = problems.length > SHOWN_PROBLEMS ? `\n...and ${problems.length - SHOWN_PROBLEMS} more` : '';
  return `Not saved - fix these:\n${shown}${more}`;
}

const confirmDuplicate = (message) => askConfirm({
  title: 'Same invoice / HAWB on another job',
  message,
  note: 'Save anyway: this new job is saved.\nDo not save: check the invoice / HAWB first.',
  okLabel: 'Save anyway',
  cancelLabel: 'Do not save',
});

// Save Draft of the job on the screen. screen = { exportData, setExportData, items, containers, docs, dbkItems, licenseItems }
export function useExportSave({ screen, stopForUnsavedEdits, onSaved }) {
  const activeBranch = useWorkspaceStore((state) => state.activeBranch);
  const activeYear = useWorkspaceStore((state) => state.activeYear);
  // one save at a time: a double click on Save made two jobs (the first save had not returned the job id yet)
  const saving = useRef(false);
  const { exportData, setExportData, items, containers, docs, dbkItems, licenseItems } = screen;

  const buildPayload = () => {
    const payload = { ...exportData };
    if (activeBranch && !activeBranch.isAll) payload.branchId = activeBranch.id;
    if (activeYear) payload.financialYearId = activeYear.id;
    if (payload.invoices?.length) payload.invoices = invoicesWithItems(payload.invoices, items);
    else if (items?.length) payload.invoices = [{ invoiceNo: `${payload.jobNo || 'DRAFT'}-INV`, items }];
    // the SB Header list is the one on the screen; when it is empty the containers loaded with the job / read from a
    // file are kept
    const headerContainers = Array.isArray(payload.Containers) ? toSavedContainers(payload.Containers) : [];
    payload.containers = headerContainers.length ? headerContainers : savedContainersWithNo(containers);
    payload.docs = docs;
    payload.dbkItems = dbkItems;
    payload.licenseItems = licenseItems;
    if (payload.invoices) payload.invoices = apportionInvoiceCharges(payload.invoices);
    return payload;
  };

  const saveDraft = async () => {
    if (await stopForUnsavedEdits('save the job')) return;
    if (saving.current) {
      toast('Saving... please wait', { icon: '⏳' });
      return;
    }
    saving.current = true;
    const isUpdate = !!exportData.id;
    const toastId = toast.loading(isUpdate ? 'Saving changes...' : 'Saving new job...');
    try {
      const payload = buildPayload();
      const missing = missingFieldMessage(payload);
      if (missing) {
        toast.error(missing, { id: toastId });
        return;
      }
      if (!payload.jobNo) payload.jobNo = 'DRAFT';

      let reply = await serverReply(exportEntryApi.saveJob(payload));
      // a new job repeating the invoice / HAWB of another job (e.g. a duplicated job) is saved only on the operator's word
      if (!reply.success && reply.duplicate) {
        if (!(await confirmDuplicate(reply.error))) {
          toast(`Not saved - ${reply.error}`, { id: toastId, icon: '⚠️', duration: 8000 });
          return;
        }
        reply = await serverReply(exportEntryApi.saveJob({ ...payload, _dupOk: true }));
      }

      if (reply.success) {
        toast.success(`Job ${reply.data.jobNo}${isUpdate ? ' updated' : ' saved'} successfully!`, { id: toastId });
        setExportData(reply.data);
        onSaved();
      } else if (Array.isArray(reply.problems) && reply.problems.length) {
        toast.error(problemsMessage(reply.problems), { id: toastId, duration: 10000 });
      } else {
        toast.error(`Error saving draft: ${reply.error || 'unknown error'}`, { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error(`Error saving draft: ${errorMessage(error)}`, { id: toastId });
    } finally {
      saving.current = false;
    }
  };

  return { saveDraft };
}
