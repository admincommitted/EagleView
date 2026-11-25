import { useEffect } from 'react';
import toast from 'react-hot-toast';
import askConfirm from '@/components/common/askConfirm';
import { isDbkItem } from '../Schemes/schemeUtils';
import { useExportContext } from '../../ExportContext';
import useExportMasters from './hooks/useExportMasters';
import useCitySearch from './hooks/useCitySearch';
import useExporterParty from './hooks/useExporterParty';
import useSbWindows from './hooks/useSbWindows';

// Clear empties the SB Header only: the job itself (id, job no, branch, filing details) and the SB-level rows that
// are not header fields (SW statements / info, exchange rows, e-Sanchit of a job read from a file) stay
const KEEP_ON_CLEAR = ['id', 'jobNo', 'jobDate', 'branchId', 'financialYearId', 'status', 'invoices', 'sbNo', 'sbNumber', 'sbDate', 'icegateStatus', 'icegateUniqueId', 'isAmended', 'leoDate', 'enteredBy', '_statements', '_infoTypes', '_exchangeRates', 'eSanchitList', 'docketNo', 'createdAt'];

const todayIso = () => new Date().toISOString().split('T')[0];

// the defaults the screen shows are stored as values too (the SB JSON got an empty exporter class while the box said Private)
const shownDefaults = (mode) => ({ shipperClass: 'P', mercManuf: 'M', shipperGstinType: 'GSTIN', ...(mode === 'AIR' ? { natureOfCargo: 'P' } : {}) });

function clearedHeader(previous) {
  const kept = Object.fromEntries(KEEP_ON_CLEAR.filter((key) => previous[key] !== undefined).map((key) => [key, previous[key]]));
  const mode = previous.shipmentMode || 'AIR';
  return { ...kept, shipmentMode: mode, jobDate: previous.jobDate || todayIso(), ...shownDefaults(mode) };
}

export default function useExportHeaderTab() {
  const { exportData, setExportData, items, dbkItems } = useExportContext();
  const shipmentMode = exportData.shipmentMode || 'AIR';
  const handleChange = (event) => {
    const { name, value } = event.target;
    setExportData((prev) => ({ ...prev, [name]: value }));
  };
  const setField = (name) => (value) => setExportData((prev) => ({ ...prev, [name]: value }));

  const masters = useExportMasters(shipmentMode);
  const cityEntry = useCitySearch();
  const exporterEntry = useExporterParty(masters.parties);
  const { resetWindows, ...windows } = useSbWindows();

  useEffect(() => {
    setExportData((prev) => {
      const missing = {};
      if (!prev.shipperGstinType) missing.shipperGstinType = 'GSTIN';
      if (!prev.natureOfCargo && (prev.shipmentMode || 'AIR') === 'AIR') missing.natureOfCargo = 'P';
      return Object.keys(missing).length ? { ...prev, ...missing } : prev;
    });
  }, [exportData.id, exportData.jobNo, setExportData]);

  // a state of origin set from the GSTIN comes as the code only: its name is taken from the state master
  const { states } = masters;
  useEffect(() => {
    if (!exportData.stateOriginCode || exportData.stateOriginName || !states.length) return;
    const state = states.find((row) => String(row.taxCode) === String(exportData.stateOriginCode));
    if (state) setExportData((prev) => ({ ...prev, stateOriginName: state.stateName }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a name the user empties is not filled again
  }, [exportData.stateOriginCode, states, setExportData]);

  const hasDrawback = (items || []).some(isDbkItem) || (dbkItems || []).some((row) => row.dbkNo);

  // Save = a new job (or Ctrl+S); Modify = the changes of a job already saved
  const saveNewJob = () => {
    if (exportData.id) { toast(`Job ${exportData.jobNo || ''} is already saved - use Modify to save your changes`, { icon: 'ℹ️' }); return; }
    window.dispatchEvent(new Event('export-save'));
  };
  const saveChanges = () => {
    if (!exportData.id) { toast('This is a new job - click Save first', { icon: 'ℹ️' }); return; }
    window.dispatchEvent(new Event('export-save'));
  };

  const clearHeader = async () => {
    const goAhead = await askConfirm({
      title: 'Clear the SB Header?',
      message: exportData.id ? `Clear the SB Header fields of job ${exportData.jobNo || ''}? The job stays; nothing is saved until you click Modify.` : 'Clear all SB Header fields?',
      okLabel: 'Clear',
      cancelLabel: 'Keep',
      tone: 'danger',
    });
    if (!goAhead) return;
    setExportData(clearedHeader);
    resetWindows();
    toast.success(exportData.id ? 'SB Header cleared - click Modify to save' : 'SB Header cleared');
  };

  return {
    exportData, setExportData, shipmentMode, handleChange, setField, hasDrawback,
    saveNewJob, saveChanges, clearHeader,
    ...masters, ...cityEntry, ...exporterEntry, ...windows,
  };
}
