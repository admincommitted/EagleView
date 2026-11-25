import { useState } from 'react';
import toast from 'react-hot-toast';
import askConfirm from '@/components/common/askConfirm';
import { useJobContext } from '../../JobContext';
import { defaultChaLabel, withGatewayPort, withHeaderField } from './hooks/jobHeaderData';
import useHeaderMasters from './hooks/useHeaderMasters';
import useImporterParty from './hooks/useImporterParty';
import useSubAgent from './hooks/useSubAgent';
import useYesNoFlags from './hooks/useYesNoFlags';
import useContainerEntry from './hooks/useContainerEntry';
import useBondRows from './hooks/useBondRows';
import useCertificateRows from './hooks/useCertificateRows';
import useHighSeaSaleRows from './hooks/useHighSeaSaleRows';
import useIgmRows from './hooks/useIgmRows';

// Clear empties the Job Header form only: invoices, items, e-Sanchit docs and the job identity are kept
const KEEP_ON_CLEAR = new Set([
  'id', 'jobNo', 'jobDate', 'status', 'beNo', 'beDate', 'invoices', 'items', 'esanchitDocs', 'finalDocs', 'branchId', 'financialYearId', 'shipmentMode', 'boeType',
  'inBondJobId', 'createdAt', 'updatedAt', 'icegateStatus', 'icegateUniqueId', 'isAmended', 'cumulativeFreight', 'cumulativeFreightFlag', 'cumulativeInsurance', 'cumulativeMiscCharge',
]);
const HEADER_GRID_KEYS = new Set(['_igmRows', '_bondRows', '_hssRows', '_certRows']);

const keptOnClear = (key) => KEEP_ON_CLEAR.has(key) || /^icegate/i.test(key) || (key.startsWith('_') && !HEADER_GRID_KEYS.has(key));

const clearedHeader = (job, chaLabel) => {
  const cleared = {};
  for (const [key, value] of Object.entries(job)) {
    if (keptOnClear(key)) cleared[key] = value;
    else if (Array.isArray(value)) cleared[key] = [];
    else if (value && typeof value === 'object') cleared[key] = value;
    else cleared[key] = '';
  }
  if (chaLabel) {
    cleared.chaCode = chaLabel;
    cleared.autoField_3 = chaLabel;
  }
  return cleared;
};

const IGM_NOT_ADDED_PROMPT = {
  title: 'IGM details not added',
  message: 'IGM / MAWB / HAWB details in the form are not added to the IGM grid.',
  okLabel: 'Add them and save',
  cancelLabel: 'Save without them',
};

const CLEAR_FORM_PROMPT = {
  title: 'Clear the Job Header form?',
  message: 'Every box of the Job Header is emptied.',
  note: 'Invoices and items are not touched.',
  okLabel: 'Clear',
  cancelLabel: 'Keep',
  tone: 'danger',
};

export default function useJobHeaderTab({ onSave }) {
  const { jobData, setJobData, masters } = useJobContext();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setJobData((previous) => withHeaderField(previous, name, value, masters?.states));
  };

  const { parties, ports, chaList, bondMaster, warehouseList } = useHeaderMasters();
  const importerEntry = useImporterParty({ parties, handleChange });
  const subAgentEntry = useSubAgent({ parties, handleChange });
  const yesNoFlags = useYesNoFlags();
  const { resetContainerForm, ...containerEntry } = useContainerEntry();
  const { cancelBondEdit, ...bondEntry } = useBondRows();
  const { cancelCertEdit, ...certificateEntry } = useCertificateRows();
  const { cancelHssEdit, ...highSeaSaleEntry } = useHighSeaSaleRows({ parties });
  const { cancelIgmEdit, hasPendingIgmForm, ...igmEntry } = useIgmRows();
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [isWarehouseSearchOpen, setIsWarehouseSearchOpen] = useState(false);

  const handlePortSelect = (event) => {
    const { value } = event.target;
    setJobData((previous) => withGatewayPort(previous, ports, value));
  };

  // Save: a new job gets a new Job No, a loaded job is updated. Modify: only for a job that is already saved.
  const handleHeaderSave = async (mode) => {
    if (mode === 'modify' && !jobData.id) { toast.error('This job is not saved yet - use Save. To change a saved job, open it from 1. Job Query.'); return; }
    let overrides = {};
    if (hasPendingIgmForm() && await askConfirm(IGM_NOT_ADDED_PROMPT)) {
      const igmRows = igmEntry.handleAddIgmRow();
      if (igmRows) overrides = { _igmRows: igmRows };
    }
    await onSave(overrides);
  };

  const handleClearForm = async () => {
    if (!(await askConfirm(CLEAR_FORM_PROMPT))) return;
    const chaLabel = defaultChaLabel(chaList);
    setJobData((previous) => clearedHeader(previous, chaLabel));
    cancelIgmEdit();
    cancelBondEdit();
    cancelHssEdit();
    cancelCertEdit();
    resetContainerForm();
  };

  return {
    jobData, setJobData, masters, parties, ports, chaList, bondMaster, warehouseList,
    handleChange, handlePortSelect, handleHeaderSave, handleClearForm,
    isWarehouseModalOpen, setIsWarehouseModalOpen, isWarehouseSearchOpen, setIsWarehouseSearchOpen,
    ...importerEntry, ...subAgentEntry, ...yesNoFlags, ...containerEntry, ...bondEntry, ...certificateEntry, ...highSeaSaleEntry, ...igmEntry,
  };
}
