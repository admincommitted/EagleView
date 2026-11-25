import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, Edit, FileText, RefreshCw, Search, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, DataTable, FileButton, Input, Label } from '@/components/ui';
import { cn } from '@/lib/utils';
import askConfirm from '../../../../common/askConfirm';
import { computeItemDuty } from '../helpers';
import { getItemForm } from '../hooks/itemForm';
import { asList } from '../hooks/popupValues';
import QuickQtyWindow from './QuickQtyWindow';

// boxes the screen fills by itself (defaults / computed) - they are not the operator's typing
const SCREEN_FILLED_FIELDS = new Set(['swsRate', 'swsFlag', 'foc', 'rateTypeFlag', 'ceth', 'accessoryStatus', 'itemNo', 'invSrNo', 'enterFilter', 'searchBy']);
// MODIFY stores these boxes in capitals, so a box typed in small letters is not a change
const UPPERCASE_FIELDS = new Set(['brandName', 'model', 'endUse', 'genericDesc', 'manufacturer', 'countryOfOrigin', 'accessories', 'sourceCountry', 'transitCountry']);

const toNumber = (value) => parseFloat(String(value ?? '').replace(/,/g, '')) || 0;
const numberOrNull = (value) => { const number = parseFloat(String(value ?? '').replace(/,/g, '')); return Number.isFinite(number) ? number : null; };
const sameText = (first, second) => String(first ?? '').trim() === String(second ?? '').trim();
const itemValueOf = (item) => (toNumber(item.qty || item.quantity) * toNumber(item.price || item.unitPrice)) || toNumber(item.value);
const itemLabel = (item) => (item && item.itemSrNo ? 'item ' + (item.invSrNo || 1) + '/' + item.itemSrNo : 'the other item');
const capitalised = (text) => text.charAt(0).toUpperCase() + text.slice(1);

const warehouseLeft = (item) => {
  const balance = numberOrNull(item._whBalanceQty);
  return balance === null ? null : Math.round((balance - (numberOrNull(item.qty || item.quantity) || 0)) * 1e6) / 1e6;
};
const leftClass = (left) => cn('tw:font-bold', left !== null && (left < 0 ? 'tw:text-destructive' : left === 0 ? 'tw:text-success' : 'tw:text-warning'));
const lineValue = (item) => {
  const value = parseFloat(item.qty || item.quantity) * parseFloat(item.price || item.unitPrice);
  return value ? value.toFixed(2) : (item.value || '');
};

const itemColumns = ({ isExBond, invoices, copyItemRow }) => [
  { key: 'edit', header: 'Edit', align: 'center', width: 30, cell: () => <Edit className="tw:inline tw:size-3.5 tw:text-primary" /> },
  {
    key: 'copy', header: 'Copy', align: 'center', width: 30,
    cell: (item) => (
      <Button variant="ghost" size="icon-sm" title="Copy this item" onClick={(event) => { event.stopPropagation(); copyItemRow(item.id); }}>
        <Copy className="tw:text-primary" />
      </Button>
    ),
  },
  { key: 'invSrNo', header: 'Inv Sr No', align: 'center', width: 60 },
  { key: 'invNo', header: 'Inv No', width: 80, cell: (item) => item.invNo || invoices[parseInt(item.invSrNo) - 1]?.invNo || '' },
  { key: 'itemSrNo', header: 'Item Sr No', align: 'center', width: 60 },
  { key: 'desc', header: 'Item Desc' },
  { key: 'ritc', header: 'RITC' },
  { key: 'qty', header: 'Qty', align: 'right' },
  ...(isExBond ? [
    { key: 'whBalance', header: 'WH Bal', align: 'right', className: 'tw:text-muted-foreground', title: 'Quantity of this item still in the warehouse when the WH BE was linked (WH BE quantity less what earlier ex-bonds cleared)', cell: (item) => numberOrNull(item._whBalanceQty) ?? '' },
    { key: 'whLeft', header: 'Left', align: 'right', title: 'WH balance less the quantity of this ex-bond', cell: (item) => { const left = warehouseLeft(item); return <span className={leftClass(left)}>{left ?? ''}</span>; } },
  ] : []),
  { key: 'unit', header: 'Unit', cell: (item) => item.unit || item.uqc },
  { key: 'price', header: 'Price', align: 'right', cell: (item) => item.price || item.unitPrice },
  { key: 'value', header: 'Value', align: 'right', cell: lineValue },
  { key: 'foc', header: 'FOC', align: 'center' },
  { key: 'scheme', header: 'Scheme', cell: (item) => asList(item.schemeCatData).map((row) => row.schemeCode).filter(Boolean).join(', ') },
  { key: 'licence', header: 'Lic', cell: (item) => asList(item.licenceData).map((row) => row.licenceNo).filter(Boolean).join(', ') },
];

const MISMATCH_TITLE = { bad: 'Invoice and item totals differ - ICEGATE error 260. Fix the items or the invoice value.', ok: 'Invoice total minus item total, per invoice' };
const REST_OF_WH_TITLE = 'Value of the warehouse BE invoice that is not in this ex-bond (still in the warehouse, or cleared by other ex-bonds). Not an error: an ex-bond file does not carry the invoice value.';

export default function EditSection({ ctx }) {
  const {
    copyItemRow, handleAiPdf, checkAll, checkedIds, handleCopyFromOtherJob, handleCopyItem, handleDownloadSample, handleDownloadTemplate, handleFetchItem,
    handleReadFile, handleRecalculate, invoices, items, jobData, selectedRowId, setSelectedRowId, toggleCheck, registerPendingEdits, askItemHistory, applyQuickQty,
  } = ctx;
  const [quickQtyOpen, setQuickQtyOpen] = useState(false);
  const isExBond = String((jobData && (jobData.autoField_51 || jobData.beType)) || '').toUpperCase() === 'X';

  const summary = useMemo(() => {
    const invoiceList = invoices || [];
    const currencies = [...new Set(invoiceList.map((invoice) => String(invoice.currency || invoice.invoiceCurrency || '').toUpperCase()).filter(Boolean))];
    const terms = [...new Set(invoiceList.map((invoice) => String(invoice.terms || invoice.termsOfInvoice || '').toUpperCase()).filter(Boolean))];
    const invoiceValue = (invoice) => toNumber(invoice.value || invoice.invValue || invoice.invoiceValue);
    const invoiceTotal = invoiceList.reduce((sum, invoice) => sum + invoiceValue(invoice), 0);
    const itemTotal = items.reduce((sum, item) => sum + itemValueOf(item), 0);
    // mismatch per invoice (so two invoices in different currencies are not mixed)
    const mismatch = Math.round(invoiceList.reduce((sum, invoice, index) => {
      const invoiceItems = items.filter((item) => String(item.invSrNo || '1') === String(index + 1));
      return sum + invoiceValue(invoice) - invoiceItems.reduce((itemSum, item) => itemSum + itemValueOf(item), 0);
    }, 0) * 100) / 100;
    // CIF (assessable value) and duty in INR, live from the items' rates; blank when an exchange rate is missing
    let cif = 0;
    let duty = 0;
    let rateMissing = false;
    items.forEach((item) => {
      const estimate = computeItemDuty(item, invoiceList, jobData || {});
      if (!estimate.rateFound) rateMissing = true;
      cif += estimate.av;
      duty += estimate.total;
    });
    return {
      terms: terms.length > 1 ? 'Mixed' : (terms[0] || ''),
      currency: currencies.length > 1 ? 'Mixed' : (currencies[0] || ''),
      invTotal: invoiceTotal.toFixed(2),
      itemTotal: itemTotal.toFixed(2),
      mismatch: mismatch.toFixed(2),
      mismatchBad: Math.abs(mismatch) >= 0.01,
      cif: rateMissing ? 'Ex. rate?' : cif.toFixed(2),
      duty: rateMissing ? 'Ex. rate?' : duty.toFixed(2),
    };
  }, [invoices, items, jobData]);

  // The item form re-mounts per row (key={selectedRowId}), so typing not yet put in with Save / Modify would be lost
  // without a word: a row switch asks first, and Validate / File BE ask through registerPendingEdits.
  // A box is changed only when it differs from the saved item AND from what the screen first showed in it: some boxes
  // show a value the item does not carry (a popup flag shows Y because the popup has data, SWS shows 10 / A).
  const formDirty = () => {
    const form = getItemForm();
    if (!form || !selectedRowId) return false;
    const openItem = (items || []).find((item) => item.id === selectedRowId) || {};
    return [...form.querySelectorAll('input[name], select[name], textarea[name]')].some((element) => {
      if (element.type === 'checkbox' || element.type === 'radio' || element.disabled || element.readOnly) return false;
      const name = element.name;
      if (!name || SCREEN_FILLED_FIELDS.has(name)) return false;
      const same = UPPERCASE_FIELDS.has(name)
        ? (first, second) => sameText(String(first ?? '').toUpperCase(), String(second ?? '').toUpperCase())
        : sameText;
      const shownAtOpen = element.tagName === 'SELECT' ? undefined : element.defaultValue;
      return !same(element.value, openItem[name] ?? '') && !(shownAtOpen !== undefined && same(element.value, shownAtOpen));
    });
  };

  useEffect(() => {
    if (typeof registerPendingEdits !== 'function') return undefined;
    return registerPendingEdits('items', () => {
      if (!formDirty()) return '';
      const openItem = (items || []).find((item) => item.id === selectedRowId) || {};
      const which = openItem.itemSrNo ? 'Item ' + (openItem.invSrNo || 1) + '/' + openItem.itemSrNo : 'The open item';
      return which + ' has changes that were not put in with MODIFY - they are not part of the BE yet.';
    });
  }); // no dependency list: the check must close over the current items / selected row

  const pickRow = async (item) => {
    if (item.id === selectedRowId) return;
    if (formDirty()) {
      const openName = itemLabel((items || []).find((entry) => entry.id === selectedRowId));
      const nextName = itemLabel(item);
      const dropChanges = await askConfirm({
        title: 'Changes not put in',
        message: capitalised(openName) + ' has changes that were not put in with MODIFY.',
        note: 'Drop the changes: ' + nextName + ' opens, and what was typed here is lost.\nStay here: press MODIFY first, then open ' + nextName + '.',
        okLabel: 'Drop the changes',
        cancelLabel: 'Stay here',
      });
      if (!dropChanges) return;
    }
    setSelectedRowId(item.id);
  };

  const openQuickQty = () => {
    if (selectedRowId && formDirty()) { toast.error('The open item has changes not put in with MODIFY - press MODIFY (or Clear) first'); return; }
    setQuickQtyOpen(true);
  };

  const selectedPosition = items.length > 0 ? (items.findIndex((item) => item.id === selectedRowId) + 1 || 1) : 0;
  const totals = [
    { label: 'Terms', value: summary.terms, widthClass: 'tw:md:w-[60px]' },
    { label: 'Currency', value: summary.currency, widthClass: 'tw:md:w-[60px]' },
    // an ex-bond (X) clears part of its warehouse BE, so its items are worth less than the WH invoice and the invoice
    // value is not sent in an X file - a "Mismatch / ICEGATE error 260" would be a false alarm there
    ...(isExBond ? [
      { label: 'WH BE Invoice', value: summary.invTotal, widthClass: 'tw:md:w-[100px]', right: true },
      { label: 'This Ex-Bond', value: summary.itemTotal, widthClass: 'tw:md:w-[100px]', right: true },
      { label: 'Rest of WH Invoice', value: summary.mismatch, widthClass: 'tw:md:w-[100px]', right: true, title: REST_OF_WH_TITLE },
    ] : [
      { label: 'Invoice Total', value: summary.invTotal, widthClass: 'tw:md:w-[90px]', right: true },
      { label: 'Item Total', value: summary.itemTotal, widthClass: 'tw:md:w-[90px]', right: true },
      { label: 'Mismatch', value: summary.mismatch, widthClass: 'tw:md:w-[80px]', right: true, tone: summary.mismatchBad ? 'bad' : 'ok', title: summary.mismatchBad ? MISMATCH_TITLE.bad : MISMATCH_TITLE.ok },
    ]),
    { label: 'CIF Total (INR)', value: summary.cif, widthClass: 'tw:md:w-[100px]', right: true },
    { label: 'Total Duty (INR)', value: summary.duty, widthClass: 'tw:md:w-[100px]', right: true },
  ];

  return (
    <>
      {quickQtyOpen && <QuickQtyWindow items={items} onClose={() => setQuickQtyOpen(false)} onApply={(qtyById) => { if (applyQuickQty) applyQuickQty(qtyById); setQuickQtyOpen(false); }} />}

      <div className="glass-panel tw:mb-1 tw:h-[160px] tw:flex-none tw:overflow-hidden">
        <DataTable
          columns={itemColumns({ isExBond, invoices, copyItemRow })}
          rows={items}
          selectedKey={selectedRowId}
          onRowClick={pickRow}
          selection={{ keys: checkedIds, onToggle: toggleCheck, onToggleAll: checkAll }}
          emptyText="No Items found"
          containerClassName="tw:h-full"
        />
      </div>

      <div className="tw:mb-1 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-sm tw:border tw:border-border tw:bg-background tw:px-2 tw:py-1.5">
        <div className="tw:flex tw:items-center tw:gap-1">
          <Input readOnly title="Position of the open item in the list" className="tw:w-16 tw:text-center" value={selectedPosition} />
          <span>of</span>
          <Input readOnly title="Items in this job" className="tw:w-16 tw:text-center" value={items.length} />
        </div>
        <Button onClick={handleFetchItem}><Search /> Fetch Item</Button>
        <Button onClick={() => askItemHistory && askItemHistory(true)} title="What earlier jobs of this importer used for this description / model"><Search /> Last Used</Button>
        <Button onClick={handleCopyItem}><Copy /> Copy Item</Button>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:md:mx-auto">
          <FileButton accept=".pdf" onFiles={(files) => handleAiPdf(files[0])}><Upload /> Upload PDF (AI)</FileButton>
          <FileButton accept=".csv, .xls, .xlsx" onChange={handleReadFile}><FileText /> Read File</FileButton>
          <Button onClick={handleDownloadTemplate}><Download /> Template</Button>
          <Button onClick={handleDownloadSample}><Download /> Download Sample</Button>
        </div>
        <Button onClick={handleCopyFromOtherJob}><Copy /> Copy From Other Job</Button>
      </div>

      <div className={cn('tw:mb-2 tw:flex tw:flex-wrap tw:items-center tw:rounded-sm tw:border tw:border-border tw:bg-page tw:px-2 tw:py-1.5 tw:font-bold tw:text-head', isExBond ? 'tw:gap-2' : 'tw:gap-2 tw:md:gap-4')}>
        {totals.map(({ label, value, widthClass, right, tone, title }) => {
          const bad = tone === 'bad';
          return (
            <div key={label} className="tw:flex tw:items-center tw:gap-1 tw:whitespace-nowrap">
              <Label className={cn('tw:font-bold', bad && 'tw:font-extrabold tw:text-destructive', tone === 'ok' && 'tw:text-success')}>{label}</Label>
              <Input
                readOnly
                value={value}
                title={title || ''}
                className={cn('tw:w-24', widthClass, right && 'tw:text-right', tone === 'ok' && 'tw:text-success', bad && 'tw:border-2 tw:border-destructive tw:bg-destructive/10 tw:font-extrabold tw:text-destructive')}
              />
              {bad && <span className="tw:text-[11px] tw:text-destructive">⚠ ICEGATE error 260</span>}
            </div>
          );
        })}
        <div className="tw:flex tw:items-center tw:gap-2 tw:md:ml-auto">
          {isExBond && items.length > 0 && <Button onClick={openQuickQty} title="Type or paste the quantity of every item in one window">Quick Qty Entry</Button>}
          <Button variant="default" data-recalc onClick={handleRecalculate}><RefreshCw /> Re-Calculate</Button>
        </div>
      </div>
    </>
  );
}
