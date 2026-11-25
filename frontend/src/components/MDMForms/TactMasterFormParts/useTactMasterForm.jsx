import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import askConfirm from '@/components/common/askConfirm';
import { downloadBlob } from '@/lib/download';
import { mastersFormApi } from '../masterKit/masterRecordsApi';
import { toCsv } from './helpers';
import { TACT_TABS } from './tactTabs';

const GCR_TAB = 'gcr';
const TABS_BY_ID = Object.fromEntries(TACT_TABS.map((tab) => [tab.id, tab]));
const EMPTY_TABLES = Object.fromEntries(TACT_TABS.map((tab) => [tab.id, []]));
const FIRST_LOADED_TABS = TACT_TABS.filter((tab) => tab.id !== GCR_TAB);
const allValuesText = (row) => Object.values(row).join(' ');

export default function useTactMasterForm() {
  const [activeTab, setActiveTab] = useState('country');
  const [tables, setTables] = useState(EMPTY_TABLES);
  const [search, setSearch] = useState('');
  const [selectedAircraft, setSelectedAircraft] = useState(null);

  const tab = TABS_BY_ID[activeTab];

  const loadTables = useCallback(async () => {
    try {
      const lists = await Promise.all(FIRST_LOADED_TABS.map((table) => mastersFormApi.tactRecords(table.source)));
      setTables((current) => ({ ...current, ...Object.fromEntries(FIRST_LOADED_TABS.map((table, index) => [table.id, lists[index]])) }));
      const gcrRates = await mastersFormApi.tactRecords(TABS_BY_ID[GCR_TAB].source);
      setTables((current) => ({ ...current, [GCR_TAB]: gcrRates }));
    } catch (error) {
      console.error('Error fetching TACT data:', error);
      toast.error('Failed to connect to TACT Database.');
    }
  }, []);

  useEffect(() => { loadTables(); }, [loadTables]);

  const visibleRows = useMemo(() => {
    const query = search.toLowerCase();
    const searchText = tab.searchText || allValuesText;
    return tables[activeTab].filter((row) => searchText(row).toLowerCase().includes(query));
  }, [tables, activeTab, tab, search]);

  const reloadFromSql = async () => {
    toast.loading('Syncing with SQL Database...', { id: 'sync' });
    await loadTables();
    toast.success('TACT Rules Synchronized Successfully!', { id: 'sync' });
  };

  const downloadCsv = () => {
    const rows = tables[activeTab];
    if (rows.length === 0) {
      toast.error('No data available to download for this tab.');
      return;
    }
    downloadBlob(new Blob([toCsv(rows)], { type: 'text/csv' }), tab.csvName);
  };

  const uploadCsv = async ([file]) => {
    if (!file) return;
    if (activeTab === GCR_TAB) {
      toast.error('GCR rates cannot be uploaded from CSV');
      return;
    }
    const replace = await askConfirm({
      title: 'Replace or add?',
      message: 'Replace all existing rows of this tab with the file, or add the file rows to them?',
      note: 'Uploading the same file twice with "Add" doubles every row.',
      okLabel: 'Replace all rows',
      cancelLabel: 'Add to existing rows',
    });
    const toastId = toast.loading('Uploading Data...');
    try {
      const result = await mastersFormApi.uploadTactCsv(activeTab, file, replace ? 'replace' : 'append');
      toast.success(result.message, { id: toastId });
      loadTables();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Upload failed', { id: toastId });
    }
  };

  return { activeTab, setActiveTab, tab, visibleRows, search, setSearch, selectedAircraft, setSelectedAircraft, reloadFromSql, downloadCsv, uploadCsv };
}
