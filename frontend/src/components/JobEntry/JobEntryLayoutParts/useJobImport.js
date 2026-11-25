import { useState } from 'react';
import { beTypeFromFile, transportModeFromFile } from './jobCodes';

const IMPORTED_TABLES = [['duties', '_duties'], ['exchangeRates', '_exchangeRates'], ['infoTypes', '_infoTypes'], ['statements', '_statements']];

// "Import from File" (ACTIONS) and the job list's "Read Flat File" / "Read XML" buttons (ImportFileModal).
export function useJobImport({ setJobData, setItems, setTransportMode, setBeType, openSavedJob }) {
  const [importWindow, setImportWindow] = useState({ open: false, tab: null });

  const openImport = (tab = null) => setImportWindow({ open: true, tab });
  const closeImport = () => setImportWindow({ open: false, tab: null });

  const applyImport = ({ directSavedJobId, jobData: imported, invoices, items, ...tables }) => {
    if (directSavedJobId) {
      setImportWindow((current) => ({ ...current, open: false }));
      openSavedJob(directSavedJobId);
      return;
    }
    if (imported.autoField_52) setTransportMode(transportModeFromFile(imported.autoField_52));
    if (imported.autoField_51) setBeType(beTypeFromFile(imported.autoField_51));
    const extraData = Object.fromEntries(IMPORTED_TABLES.filter(([name]) => tables[name]?.length > 0).map(([name, key]) => [key, tables[name]]));
    setJobData((job) => ({ ...job, ...imported, ...extraData, ...(invoices?.length > 0 ? { invoices } : {}) }));
    if (items?.length > 0) setItems(items);
  };

  return { importWindow, openImport, closeImport, applyImport };
}
