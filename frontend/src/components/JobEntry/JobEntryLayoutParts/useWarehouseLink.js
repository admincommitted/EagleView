import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import askConfirm from '../../common/askConfirm';
import { jobEntryApi } from '../jobEntryApi';
import { serverReply } from './serverReply';
import { transportModeOf } from './jobCodes';
import { applyWarehouseBalances, exBondCopyOf, sec65RowsToFill, withWarehouseHeader } from './warehouseLink';

function announceBalanceRefresh({ refreshed, overBalance }, warehouseJobNo) {
  if (overBalance.length) {
    const shown = overBalance.slice(0, 8).join(', ') + (overBalance.length > 8 ? ' ...' : '');
    toast.error(`Warehouse balance: ${overBalance.length} item(s) of this ex-bond are now above what is left in the warehouse (Item Sr No ${shown}) - another ex-bond of WH BE ${warehouseJobNo || ''} was filed. Reduce their quantity.`, { duration: 12000 });
  } else if (refreshed) {
    toast(`Warehouse balance refreshed on ${refreshed} item(s)`, { icon: 'ℹ️', duration: 5000 });
  }
}

// The "WH Bal / Left" figures of a saved ex-bond are read again when it opens and after each save, so an ex-bond of
// the same WH BE filed meanwhile shows at once.
function useWarehouseBalanceRefresh({ jobData, items, setItems, beType }) {
  const lastChecked = useRef('');
  const openJobId = useRef(null);
  openJobId.current = jobData.id;
  const itemCount = (items || []).length;

  useEffect(() => {
    const warehouseJobId = jobData.inBondJobId;
    const jobId = jobData.id;
    if ((beType || '').toUpperCase() !== 'X' || !warehouseJobId || !jobId || !itemCount) return;
    const checkKey = `${jobId}|${warehouseJobId}|${jobData.updatedAt || ''}`;
    if (lastChecked.current === checkKey) return;
    lastChecked.current = checkKey;

    const refresh = async () => {
      try {
        const reply = await serverReply(jobEntryApi.warehouseBalances(warehouseJobId, jobId));
        if (String(openJobId.current) !== String(jobId) || !reply?.success || !reply.data) return;
        let outcome = { refreshed: 0, overBalance: [] };
        setItems((current) => {
          if (!Array.isArray(current)) return current;
          outcome = applyWarehouseBalances(current, reply.data);
          return outcome.items;
        });
        setTimeout(() => announceBalanceRefresh(outcome, reply.data.jobNo), 50);
      } catch {
        lastChecked.current = '';
      }
    };
    refresh();
  }, [jobData.id, jobData.inBondJobId, jobData.updatedAt, beType, itemCount, setItems]);
}

async function readWarehouseBe(warehouseJobId, excludeJobId) {
  try {
    const reply = await serverReply(jobEntryApi.warehouseBe(warehouseJobId, excludeJobId));
    return (reply?.success && reply.data) || {};
  } catch (error) {
    console.error('Failed to fetch WH job details', error);
    return {};
  }
}

// Ex-Bond: the warehouse BE it clears (WH BE No / Date / code, importer, balance quantities, e-Sanchit documents).
export function useWarehouseLink({ jobData, setJobData, items, setItems, esanchitDocs, setEsanchitDocs, beType, setTransportMode }) {
  const [showWhSelector, setShowWhSelector] = useState(false);
  const linkedWhJob = jobData.inBondJobId
    ? { id: jobData.inBondJobId, jobNo: jobData.inBondJobNo || jobData.inBondJobId, warehouseCode: jobData.warehouseCode || '' }
    : null;

  useWarehouseBalanceRefresh({ jobData, items, setItems, beType });

  // opens when the BE Type becomes X, for a new Ex-Bond only: not when it is linked or the WH BE No is already given
  useEffect(() => {
    if ((beType || '') === 'X' && !jobData.inBondJobId && !String(jobData.warehouseBENo || '').trim()) setShowWhSelector(true);
  }, [beType]); // oxlint-disable-line react-hooks/exhaustive-deps

  const linkWarehouseBe = async (warehouseJob) => {
    const jobHasItems = (items || []).length > 0 || (jobData.invoices || []).some((invoice) => (invoice.items || []).length);
    const warehouseBe = await readWarehouseBe(warehouseJob.id, jobData.id);
    const exBond = exBondCopyOf(warehouseBe, warehouseJob.warehouseCode || warehouseBe.warehouseCode);

    // the balance counts only ex-bonds that reached customs; other ex-bond drafts of this WH BE do not reduce it
    if (warehouseBe.exBondDraftCount > 0) {
      const draftQty = exBond.items.reduce((sum, item) => sum + (parseFloat(item._whDraftQty) || 0), 0);
      toast(`${warehouseBe.exBondDraftCount} other ex-bond job(s) of WH BE ${warehouseJob.jobNo || ''} are still drafts (not filed)${draftQty ? ` - ${draftQty} qty is in them and is NOT deducted from the balance shown` : ''}`, { icon: '⚠️', duration: 9000 });
    }
    const copyItems = exBond.invoices.length > 0 && (!jobHasItems || await askConfirm({
      title: 'Replace the invoices / items?',
      message: `The invoices / items of this Ex-Bond are replaced with the balance quantity of WH job ${warehouseJob.jobNo || ''}.`,
      note: 'Quantities and SEC65 rows typed on this job are lost.',
      okLabel: 'Replace',
      cancelLabel: 'Keep what is here',
    }));

    setJobData((job) => withWarehouseHeader(job, warehouseBe, warehouseJob, copyItems ? exBond.invoices : null));
    const shipmentMode = warehouseJob.shipmentMode || warehouseBe.shipmentMode;
    if (shipmentMode) setTransportMode(transportModeOf(shipmentMode));
    if (copyItems) setItems(exBond.items);
    // the ex-bond is filed with the same e-Sanchit IRNs as its warehouse BE
    const warehouseDocs = Array.isArray(warehouseBe.esanchitDocs) ? warehouseBe.esanchitDocs : [];
    if (warehouseDocs.length && !(esanchitDocs || []).length && setEsanchitDocs) setEsanchitDocs(warehouseDocs.map((doc, index) => ({ ...doc, id: Date.now() + index })));

    const sec65Count = copyItems ? sec65RowsToFill(exBond.items) : 0;
    if (sec65Count) toast(`SEC65 control row added on ${sec65Count} item(s). Open SW Control on one item, fill Start Date, End Date and Result Code, then "Apply to All Items".`, { icon: 'ℹ️', duration: 12000 });
    toast.success(`Linked WH job ${warehouseJob.jobNo || ''}${warehouseJob.beNo ? ` (WH BE ${warehouseJob.beNo})` : ''}${copyItems ? ` - ${exBond.items.length} item(s) with balance qty` : ''}`);
    if (exBond.fullyCleared) toast(`${exBond.fullyCleared} item(s) of the WH BE are fully cleared by earlier ex-bonds and were not copied`, { duration: 6000 });
    if (!(warehouseJob.beNo || warehouseBe.beNo)) toast('The WH job has no BE No yet - enter the WH BE No / Date in the Job Header', { icon: '⚠️', duration: 6000 });
  };

  return { linkedWhJob, showWhSelector, setShowWhSelector, linkWarehouseBe };
}
