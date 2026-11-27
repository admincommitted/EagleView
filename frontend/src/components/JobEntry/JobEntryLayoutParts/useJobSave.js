import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import askConfirm from '../../common/askConfirm';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { jobEntryApi } from '../jobEntryApi';
import { serverReply } from './serverReply';
import { boeTypeOf, shipmentModeOf } from './jobCodes';
import { itemsUnderInvoices, itemTotalOf, savedProblemsMessage, saveProblem } from './saveRules';

const MAX_PATCHED_ITEMS = 25;
const AUTO_SAVE_DELAY_MS = 800;
// fields the server changes on every save; they do not make a full save necessary
const SERVER_SET_FIELDS = ['id', 'jobNo', 'updatedAt', 'updatedBy', 'createdBy', 'amendUnlockedAt', 'amendUnlockedBy', 'itemTotal'];

const itemKeyOf = (item) => `${String(item.invSrNo || item.invoiceSrNo || '1').trim()}/${String(item.itemSrNo || item.itemNo || '').trim()}`;

// A click event passed by a button (onClick={saveJob}) is not a set of changes.
const isChangeSet = (value) => value && typeof value === 'object' && !value.nativeEvent && !value.target && !Array.isArray(value);

// What the last successful save wrote. When only some items changed since (same items, same order, same Item Sr Nos,
// header / invoices / documents as saved), an auto-save sends just those items.
function useSavedSnapshot() {
  const snapshot = useRef(null);

  const changedItemsOnly = ({ jobData, esanchitDocs, overrides, allItems, amendMode }) => {
    const saved = snapshot.current;
    if (!saved || !jobData.id || String(saved.id) !== String(jobData.id) || amendMode) return null;
    if (Object.keys(overrides).some((key) => key !== 'items')) return null;
    if ((esanchitDocs || []) !== saved.docs && JSON.stringify(esanchitDocs || []) !== JSON.stringify(saved.docs)) return null;
    for (const key of new Set([...Object.keys(jobData), ...Object.keys(saved.job)])) {
      if (!SERVER_SET_FIELDS.includes(key) && jobData[key] !== saved.job[key]) return null;
    }
    if (!Array.isArray(allItems) || allItems.length !== saved.items.length) return null;
    const changed = [];
    for (let index = 0; index < allItems.length; index++) {
      const item = allItems[index];
      const savedItem = saved.items[index];
      if (item === savedItem) continue;
      if (itemKeyOf(item) !== itemKeyOf(savedItem) || !String(item.itemSrNo || item.itemNo || '').trim()) return null;
      if (JSON.stringify(item) !== JSON.stringify(savedItem)) changed.push(item);
      if (changed.length > MAX_PATCHED_ITEMS) return null;
    }
    return changed.length ? changed : null;
  };

  return { snapshot, changedItemsOnly };
}

async function sendChangedItems(payload, changedItems) {
  try {
    const reply = await serverReply(jobEntryApi.saveChangedItems(payload.id, { _loadedAt: payload._loadedAt, itemTotal: payload.itemTotal, items: changedItems }));
    // refused for a reason (stale, bad value, over the balance) is shown like a full save's answer; "fallback" = do a full save
    return reply && (reply.success || !reply.fallback) ? reply : null;
  } catch {
    return null;
  }
}

export function useJobSave({ jobData, setJobData, items, esanchitDocs, transportMode, beType, filedLock, openWarehouseSelector, reloadJob }) {
  const activeBranch = useWorkspaceStore((state) => state.activeBranch);
  const activeYear = useWorkspaceStore((state) => state.activeYear);
  const { snapshot, changedItemsOnly } = useSavedSnapshot();
  const autoSaveTimer = useRef(null);
  const autoSaveChanges = useRef({});
  const toldToSaveFirst = useRef(false);

  useEffect(() => () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); }, []);

  const buildPayload = (overrides, allItems) => {
    const payload = { ...jobData, ...overrides };
    if (filedLock.amendMode) {
      payload._amendMode = true;
      payload._amendReason = filedLock.amendReason;
    }
    delete payload.filedJson;
    delete payload.hasFiledJson;
    // the version this screen loaded: the server refuses the save when someone saved the job since
    if (payload.id && payload.updatedAt) payload._loadedAt = payload.updatedAt;
    payload.shipmentMode = shipmentModeOf(transportMode);
    payload.boeType = boeTypeOf(beType);
    if (!payload.jobNo) payload.jobNo = 'DRAFT';
    if (activeBranch && !activeBranch.isAll) payload.branchId = activeBranch.id;
    if (activeYear) payload.financialYearId = activeYear.id;
    // a save started from a timer sees the documents of an older render, so the caller may pass the ones it just set
    payload.esanchitDocs = Array.isArray(overrides.esanchitDocs) ? overrides.esanchitDocs : (esanchitDocs || []);
    if (payload._importedItems) payload._importedItems = null;
    if (payload._importedFinalDocs) payload._importedFinalDocs = null;
    payload.itemTotal = itemTotalOf(allItems);
    return payload;
  };

  const confirmDuplicate = (message) => askConfirm({
    title: 'Same invoice / HAWB on another job',
    message,
    note: `${beType === 'X' ? 'An ex-bond repeats the invoice of its warehouse BE and of earlier ex-bonds - that is expected.\n' : ''}Save anyway: this new job is saved.\nDo not save: check the invoice / HAWB first.`,
    okLabel: 'Save anyway',
    cancelLabel: 'Do not save',
  });

  const rememberSaved = (reply, overrides, payload, allItems) => {
    snapshot.current = reply.patched && snapshot.current
      ? { ...snapshot.current, items: allItems }
      : {
        id: reply.data.id,
        job: { ...jobData, ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'items' && key !== 'esanchitDocs')) },
        docs: payload.esanchitDocs,
        items: allItems,
      };
    const saved = reply.data;
    setJobData((job) => ({
      ...job,
      id: saved.id,
      jobNo: saved.jobNo,
      updatedAt: saved.updatedAt || job.updatedAt,
      updatedBy: saved.updatedBy || job.updatedBy,
      createdBy: saved.createdBy || job.createdBy,
      amendUnlockedAt: saved.amendUnlockedAt || job.amendUnlockedAt,
      amendUnlockedBy: saved.amendUnlockedBy || job.amendUnlockedBy,
    }));
  };

  // Returns the saved job, or null / undefined when it was not saved. `isAuto` saves are quiet: `_notify` names the
  // change to announce once it is saved (errors are always shown).
  const saveJob = async (changeSet = {}, isAuto = false) => {
    let overrides = isChangeSet(changeSet) ? changeSet : {};
    const notify = overrides._notify;
    if (notify) {
      overrides = { ...overrides };
      delete overrides._notify;
    }
    try {
      if (filedLock.isFiledLocked) {
        toast.error(`This BE was ${jobData.icegateStatus} on ICEGATE and is locked. Click "Unlock for amendment" (top bar) to change it.`, { duration: 6000 });
        return null;
      }
      const screenItems = overrides.items || items;
      const allItems = screenItems || jobData.items || [];
      const payload = buildPayload(overrides, allItems);

      const placement = itemsUnderInvoices(payload.invoices, allItems, screenItems);
      if (placement.error) {
        toast.error(placement.error.message, { duration: placement.error.duration });
        return;
      }
      payload.invoices = placement.invoices;

      const problem = saveProblem(payload);
      if (problem) {
        toast.error(problem.message);
        if (problem.needsWarehouseLink) openWarehouseSelector();
        return;
      }

      const changedItems = isAuto ? changedItemsOnly({ jobData, esanchitDocs, overrides, allItems, amendMode: filedLock.amendMode }) : null;
      let reply = changedItems ? await sendChangedItems(payload, changedItems) : null;
      if (!reply) reply = await serverReply(jobEntryApi.saveJob(payload));

      // a new job repeating the invoice / HAWB of another job is saved only when the operator says so
      if (!reply.success && reply.duplicate) {
        if (isAuto || !(await confirmDuplicate(reply.error))) {
          if (!isAuto) toast(`Not saved - ${reply.error}`, { icon: '⚠️', duration: 8000 });
          return null;
        }
        reply = await serverReply(jobEntryApi.saveJob({ ...payload, _dupOk: true }));
      }

      if (reply.success) {
        rememberSaved(reply, overrides, payload, allItems);
        if (!isAuto) toast.success(`Job ${reply.data.jobNo} saved successfully!`);
        else if (notify) toast.success(`${notify} - job ${reply.data.jobNo} saved`, { duration: 4000 });
        return reply.data;
      }
      if (reply.stale) {
        toast.error(reply.error, { duration: 10000 });
        const reopen = await askConfirm({ title: 'Job changed elsewhere', message: reply.error, note: 'Re-open: the saved job is loaded and your unsaved changes on this screen are lost.', okLabel: 'Re-open the job', cancelLabel: 'Stay here', tone: 'danger' });
        if (reopen) reloadJob(payload.id);
      } else if (Array.isArray(reply.problems) && reply.problems.length) {
        toast.error(savedProblemsMessage(reply.problems), { duration: 12000, className: 'tw:whitespace-pre-line tw:max-w-[560px]' });
      } else {
        toast.error(`${reply.locked ? 'Locked: ' : 'Error saving: '}${reply.error}`, { duration: 7000 });
      }
    } catch (error) {
      console.error(error);
      toast.error('Error saving draft');
    }
    return null;
  };

  // Row changes in 3. Invoices / 4. Items: joined into one quiet save per burst of edits, and only once the job has
  // been saved from the Job Header.
  const autoSave = (changeSet = {}) => {
    if (!jobData.id) {
      if (!toldToSaveFirst.current) {
        toldToSaveFirst.current = true;
        toast('Rows are kept on the screen - press SAVE in 2. Job Header to create the job', { duration: 7000, icon: 'ℹ️' });
      }
      return;
    }
    autoSaveChanges.current = { ...autoSaveChanges.current, ...(isChangeSet(changeSet) ? changeSet : {}) };
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const changes = autoSaveChanges.current;
      autoSaveChanges.current = {};
      saveJob(changes, true);
    }, AUTO_SAVE_DELAY_MS);
  };

  return { saveJob, autoSave };
}
