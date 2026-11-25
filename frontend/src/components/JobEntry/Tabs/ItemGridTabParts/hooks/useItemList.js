import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useGridFeatures } from '@/hooks/useGridFeatures';
import { jobEntryApi } from '@/components/JobEntry/jobEntryApi';
import { useJobContext } from '../../../JobContext';
import { initialItems } from '../helpers';
import { setItemField } from './itemForm';

const DEFAULT_DUTY_NAMES = ['BCD', 'CVD', 'Adl. CVD', 'SWS', 'SAPTA', 'Health Cess'];

const sameItemSrNo = (first, second) => String(parseInt(first.itemSrNo, 10) || '') === String(parseInt(second.itemSrNo, 10) || '');

export const nextItemSr = (list, invSrNo) => String(Math.max(0, ...list.filter((item) => String(item.invSrNo || '1') === String(invSrNo || '1')).map((item) => parseInt(item.itemSrNo, 10) || 0)) + 1);

export const deepCopy = (value) => JSON.parse(JSON.stringify(value));

// The job's items as a grid: selection, ticks, the sync with the job context and the item the form shows
export default function useItemList() {
  const { jobData, setJobData, items: globalItems, setItems: setGlobalItems, masters, esanchitDocs, setEsanchitDocs, registerPendingEdits } = useJobContext();
  const fileInputRef = useRef(null);
  const [defaultIcegateId, setDefaultIcegateId] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [showRitcModal, setShowRitcModal] = useState(false);
  const [ritcSearch, setRitcSearch] = useState('');
  const [showCthModal, setShowCthModal] = useState(false);
  const [cthSearch, setCthSearch] = useState('');
  const [showCethModal, setShowCethModal] = useState(false);
  const [cethSearch, setCethSearch] = useState('');
  const [showSchemeSearchModal, setShowSchemeSearchModal] = useState(false);
  const [schemeSearch, setSchemeSearch] = useState('');
  const [swInfoType, setSwInfoType] = useState('Select');
  const [addInMiddle, setAddInMiddle] = useState('N');

  useEffect(() => {
    const loadDefaultIcegateProfile = async () => {
      try {
        const response = await jobEntryApi.icegateProfiles();
        if (response.success && response.data && response.data.length > 0) {
          const profile = response.data.find((entry) => entry.isDefault) || response.data[0];
          setDefaultIcegateId(profile.loginId);
        }
      } catch (error) {
        console.log(error);
      }
    };
    loadDefaultIcegateProfile();
  }, []);

  const copyItemRowRef = useRef(null);
  const {
    data: items, setData: setItems, selectedRowId, setSelectedRowId, checkedIds, toggleCheck, checkAll, deleteSelected, duplicateRow, rowExists,
  } = useGridFeatures({
    initialData: globalItems && globalItems.length > 0 ? globalItems : initialItems,
    onDuplicate: (id) => copyItemRowRef.current && copyItemRowRef.current(id), // Ctrl+D = Copy Item (next Item Sr No), never a same-Sr clone
  });

  const syncRef = useRef(items);

  // Down from the job (job load, save result, Excel / AI import). A save re-creates the rows with new database ids, so
  // the selection is carried over by invoice sr + item sr; when that item is gone, nothing is selected.
  useEffect(() => {
    if (globalItems === syncRef.current) return;
    const previousItem = items.find((item) => item.id === selectedRowId);
    setItems(globalItems);
    syncRef.current = globalItems;
    if (previousItem) {
      const sameItem = (globalItems || []).find((item) => String(item.invSrNo || '1') === String(previousItem.invSrNo || '1') && sameItemSrNo(item, previousItem));
      setSelectedRowId(sameItem ? sameItem.id : null);
    }
  }, [globalItems, setItems]);

  // Up to the job (edits on this tab)
  useEffect(() => {
    if (items !== syncRef.current) {
      setGlobalItems(items);
      syncRef.current = items;
    }
  }, [items, setGlobalItems]);

  // no silent fallback to row 1: an unknown selection shows an empty (new) item form
  const selectedItem = items.find((item) => item.id === selectedRowId) || {};

  const displayDuties = useMemo(() => {
    const allDuties = jobData?._sbedutyModel || jobData?._sbedutymodel || jobData?._duties || [];
    const duties = allDuties.filter((duty) => String(duty.invoiceSerialNumber || duty.invoiceSrNo) === String(selectedItem.invSrNo)
      && String(duty.itemSerialNumber || duty.itemSrNo) === String(selectedItem.itemSrNo));
    if (duties.length === 0) {
      return DEFAULT_DUTY_NAMES.map((dutyName) => ({
        _dutyName: dutyName,
        notificationNo: '', notificationSrNo: '', dutyType: '', addlDutyFlag: (dutyName === 'SWS' ? 'A' : ''), rate: (dutyName === 'SWS' ? '10' : ''), amount: '', unit: '',
      }));
    }
    return duties.map((duty) => ({
      _dutyName: duty.dutyType === 'C' ? 'CUS' : (duty.dutyType === 'G' ? 'GST' : duty.dutyType),
      notificationNo: duty.notificationNo || '',
      notificationSrNo: duty.notificationSrNo || '',
      dutyType: duty.dutyType || '',
      addlDutyFlag: duty.addlDutyFlag || '',
      rate: '',
      amount: '',
      unit: '',
    }));
  }, [selectedItem.invSrNo, selectedItem.itemSrNo, jobData]);

  // the job's invoices (a separate copy kept on this tab was often empty -> wrong invoice Sr No)
  const jobInvoices = (jobData?.invoices && jobData.invoices.length) ? jobData.invoices : invoices;

  // Copy: a full copy (popups included) with the next free Item Sr No of the same invoice, placed after the original
  const copyItemRow = (id) => {
    const source = items.find((item) => item.id === id);
    if (!source) return;
    const copy = { ...deepCopy(source), id: Date.now(), itemSrNo: nextItemSr(items, source.invSrNo) };
    copy.itemNo = copy.itemSrNo;
    const sourceIndex = items.findIndex((item) => item.id === id);
    const nextItems = [...items];
    nextItems.splice(sourceIndex + 1, 0, copy);
    setItems(nextItems);
    setSelectedRowId(copy.id);
    toast.success('Copied as Item Sr No ' + copy.itemSrNo);
  };
  copyItemRowRef.current = copyItemRow;

  const handleCopyItem = () => {
    if (!selectedRowId || !selectedItem || !selectedItem.id) { toast('Please select an item to copy.'); return; }
    copyItemRow(selectedItem.id);
  };

  return {
    registerPendingEdits, jobData, setJobData, masters, esanchitDocs, setEsanchitDocs, globalItems, setGlobalItems,
    fileInputRef, defaultIcegateId, setDefaultIcegateId, invoices: jobInvoices, setInvoices,
    showRitcModal, setShowRitcModal, ritcSearch, setRitcSearch, showCthModal, setShowCthModal, cthSearch, setCthSearch,
    showCethModal, setShowCethModal, cethSearch, setCethSearch, showSchemeSearchModal, setShowSchemeSearchModal, schemeSearch, setSchemeSearch,
    swInfoType, setSwInfoType, addInMiddle, setAddInMiddle,
    items, setItems, selectedRowId, setSelectedRowId, checkedIds, toggleCheck, checkAll, deleteSelected, duplicateRow, rowExists, syncRef,
    selectedItem, displayDuties, nextItemSr, copyItemRow, handleCopyItem, setFormValue: setItemField,
  };
}
