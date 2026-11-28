import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Download, RefreshCw, Save, Upload } from 'lucide-react';
import { Button, FileButton, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { useExportContext } from '../ExportContext';
import { SCHEME_CONFIG } from './Schemes/SchemeConfig';
import { num, licenceRowErrors, ar4Missing } from './Schemes/schemeUtils';
import { EXCEL_TABS, templateOf, dbkRowsFromSheet, licenceRowsFromSheet, ar4PatchesFromSheet } from './Schemes/schemeExcel';

// Scheme tab (Dbk / RoSCTL / RoDTEP / License / AR4 / MOOWR): Save saves the job (same as Save on the SB Header),
// Reset clears the details of the open sub-tab after a second click, Excel fills the Dbk / License / AR4 rows.
const RESET_NOTES = {
  rodtep: 'RoDTEP follows the items: set Claim per item.',
  rosctl: 'RoSCTL follows the items (scheme 60) and their DBK No; nothing to clear.',
  moowr: 'MOOWR details are kept; change them on the screen.',
};

function NoSchemes() {
  return (
    <div className="tw:flex tw:h-full tw:items-center tw:justify-center tw:bg-background tw:p-4">
      <div className="tw:max-w-xl tw:rounded tw:border tw:border-border tw:bg-page tw:px-8 tw:py-3 tw:text-center tw:text-[13px] tw:font-semibold tw:text-warning">
        No scheme details in this job.
        <div className="tw:mt-1 tw:text-entry tw:font-normal tw:text-muted-foreground">
          Dbk shows for scheme code 19 / 60, RoSCTL for 60, License for licence schemes (e.g. 03), RoDTEP / AR4 when set on the item, MOOWR when MOOWR = Yes on the SB Header.
        </div>
      </div>
    </div>
  );
}

const uploadMessage = ({ used, notFound }) => {
  if (!used) return null;
  const more = notFound.length > 5 ? '…' : '';
  return `${used} row(s) filled from Excel` + (notFound.length ? `; ${notFound.length} not found (Inv/Item ${notFound.slice(0, 5).join(', ')}${more})` : '');
};

export default function ExportSchemeTab() {
  const { items, setItems, exportData, dbkItems, setDbkItems, licenseItems, setLicenseItems } = useExportContext();
  const [activeSubTab, setActiveSubTab] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const validTabs = SCHEME_CONFIG.filter((config) => config.condition(items || [], exportData));
  const validKeys = validTabs.map((tab) => tab.key).join(',');

  // the open sub-tab follows the items
  useEffect(() => {
    if (!validTabs.length) { if (activeSubTab) setActiveSubTab(''); return; }
    if (!validTabs.some((tab) => tab.key === activeSubTab)) setActiveSubTab(validTabs[0].key);
  }, [validKeys, activeSubTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setConfirmReset(false); }, [activeSubTab]);

  const ar4Rows = (items || []).map((item, index) => ({ item, index })).filter(({ item }) => String(item.ar4 || '').toUpperCase() === 'Y');
  const canExcel = EXCEL_TABS.includes(activeSubTab);

  const downloadTemplate = () => {
    const template = templateOf(activeSubTab, { dbkItems, licenseItems, ar4Rows });
    if (!template) { toast('No Excel template for this tab - fill it on the screen.', { icon: 'ℹ️' }); return; }
    if (!template.rows.length) { toast.error('No rows in this tab to put in the template.'); return; }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(template.rows), 'Template');
    XLSX.writeFile(workbook, template.fileName);
  };

  const fillFromExcel = async ([file]) => {
    if (!file) return;
    if (!canExcel) { toast.error('Excel upload is for the Dbk, License and AR4 tabs.'); return; }
    let buffer;
    try {
      buffer = await file.arrayBuffer();
    } catch {
      toast.error('Could not read the file.');
      return;
    }
    try {
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
      if (!sheetRows.length) { toast.error('The sheet has no rows.'); return; }
      let result;
      if (activeSubTab === 'dbk') {
        result = dbkRowsFromSheet(sheetRows, dbkItems, items);
        setDbkItems(result.rows);
      } else if (activeSubTab === 'license') {
        result = licenceRowsFromSheet(sheetRows, licenseItems);
        setLicenseItems(result.rows);
      } else {
        result = ar4PatchesFromSheet(sheetRows, ar4Rows);
        setItems((previous) => previous.map((item) => (result.patches.has(item.id) ? { ...item, ...result.patches.get(item.id) } : item)));
      }
      const message = uploadMessage(result);
      if (message) toast.success(message, { duration: 5000 });
      else toast.error('No row matched: INV NO / ITEM NO must be the numbers shown in this tab.');
    } catch (error) {
      console.error(error);
      toast.error('Could not read the Excel file: ' + error.message);
    }
  };

  // what is still missing is shown before saving; saving is not blocked
  const pendingNotes = () => {
    const notes = [];
    if (validKeys.includes('dbk')) {
      const count = (dbkItems || []).filter((row) => !String(row.dbkNo || '').trim() || num(row.dbkQty) <= 0).length;
      if (count) notes.push(`Dbk: ${count} row(s) without DBK No / Qty`);
    }
    if (validKeys.includes('license')) {
      const count = (licenseItems || []).filter((row) => licenceRowErrors(row).length).length;
      if (count) notes.push(`License: ${count} row(s) incomplete`);
    }
    if (validKeys.includes('ar4')) {
      const count = ar4Rows.filter(({ item }) => ar4Missing(item).length).length;
      if (count) notes.push(`AR4: ${count} item(s) incomplete`);
    }
    return notes;
  };

  const save = () => {
    const notes = pendingNotes();
    if (notes.length) toast(notes.join(' · '), { icon: '⚠️', duration: 6000 });
    window.dispatchEvent(new Event('export-save'));
  };

  const reset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    setConfirmReset(false);
    if (RESET_NOTES[activeSubTab]) { toast(RESET_NOTES[activeSubTab], { icon: 'ℹ️' }); return; }
    if (activeSubTab === 'dbk') {
      setDbkItems((previous) => previous.map((row) => ({ ...row, dbkNo: '', dbkRtAdv: '', dbkRtSpe: '', dbkCap: '', dbkVal: '', valManual: false, drawbackAvailable: 'Y' })));
    } else if (activeSubTab === 'license') {
      setLicenseItems([]); // rebuilt as one empty row per licence item
    } else if (activeSubTab === 'ar4') {
      const ar4Ids = new Set(ar4Rows.map(({ item }) => item.id));
      setItems((previous) => previous.map((item) => (ar4Ids.has(item.id) ? { ...item, ar4No: '', ar4Date: '', commissionerate: '', division: '', ar4Range: '', ar4Remarks: '' } : item)));
    }
    toast.success('Details of this tab cleared (not saved yet).');
  };

  if (!validTabs.length) return <NoSchemes />;

  const ActiveComponent = validTabs.find((tab) => tab.key === activeSubTab)?.component;

  return (
    <div className="tw:flex tw:h-full tw:flex-col tw:overflow-hidden">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="tw:bg-page tw:px-2 tw:pt-2 tw:md:px-4">
        <TabsList className="tw:overflow-x-auto">
          {validTabs.map((tab) => <TabsTrigger key={tab.key} value={tab.key}>{tab.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-y-auto tw:border tw:border-t-0 tw:border-border tw:bg-background">
        {ActiveComponent && <ActiveComponent />}
      </div>

      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-center tw:gap-3 tw:rounded-b tw:border tw:border-t-0 tw:border-border tw:bg-page tw:px-4 tw:py-2">
        <Button size="lg" onClick={downloadTemplate} disabled={!canExcel} title={canExcel ? 'Excel with the rows of this tab' : 'No template for this tab'}>
          <Download /> Download Sample
        </Button>
        <FileButton size="lg" variant="warning" accept=".xlsx,.xls" onFiles={fillFromExcel} disabled={!canExcel} title={canExcel ? 'Fill this tab from Excel (INV NO + ITEM NO)' : 'No Excel upload for this tab'}>
          <Upload /> Upload Excel
        </FileButton>
        <Button size="lg" variant="success" onClick={save} title="Save the job (Ctrl+S)">
          <Save /> Save
        </Button>
        <Button size="lg" variant={confirmReset ? 'destructive' : 'default'} onClick={reset} onBlur={() => setConfirmReset(false)} title="Clear the details of this tab">
          <RefreshCw /> {confirmReset ? 'Click again to clear' : 'Reset'}
        </Button>
      </div>
    </div>
  );
}
