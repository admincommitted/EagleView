import toast from 'react-hot-toast';
import askConfirm from '../../../../common/askConfirm';
import { readJobWorkbook, mergeJobWorkbook, fillRatesFromTariff, recalcDuty } from '../../jobExcel';
import { computeItemDuty } from '../helpers';
import { getItemForm } from './itemForm';
import { asObjectOrNull } from './popupValues';

const UPPERCASE_FIELDS = ['brandName', 'model', 'endUse', 'genericDesc', 'manufacturer', 'countryOfOrigin', 'accessories', 'sourceCountry', 'transitCountry'];
const DUTY_LINES = ['bcd', 'cvd', 'adlCvd', 'sws', 'sapta', 'healthCess'];
const DUTY_LINE_PARTS = ['NotificationNo', 'SrNo', 'Rate', 'Flag', 'Amount', 'Unit'];
const POPUP_FLAG_FIELDS = ['schemeCodCategoryFlag', 'licenceFlag', 'reImportFlag', 'rspDutyFlag', 'ncdCustomDutyFlag', 'antiDumpingDutyFlag', 'otherDutyFlag', 'swInfotypeFlag', 'swConstituentFlag',
  'swProductionFlag', 'swControlFlag', 'swStatementFlag', 'supportingDocsFlag', 'customsCvdFlag', 'policyParaFlag', 'exciseFlag', 'printGenDescFlag', 'previousBeFlag'];
// bcdSpecAmount / bcdRateBasis / specQty: the specific (per-unit) side of the BCD line and how to apply it
const PLAIN_FIELDS = ['cth', 'ceth', 'productCode', 'rateTypeFlag', 'descOnlyInChecklist', 'igstDutyFlag', 'svbFlag', 'bcdSpecAmount', 'bcdRateBasis', 'specQty', ...POPUP_FLAG_FIELDS];
// the item's popup data under the keys the BE builder reads, from the keys the popups save under
const POPUP_DATA_SOURCES = {
  antiDumpingData: 'addData', otherDutyData: 'otherDutyData', svbItemData: 'svbData', schemeCategoryData: 'schemeCatData', policyParaData: 'policyParaData',
  previousBeData: 'prevBeData', cvdData: 'cvdData', docsData: 'docsData', swInfoData: 'swInfoData', swConstData: 'swConstData', swProdData: 'swProdData',
  swCtrlData: 'swCtrlData', swStmtData: 'swStmtData', reimportData: 'reimportData', rspData: 'rspData', ncdData: 'ncdData',
};
const DUTY_FORM_FIELDS = ['value', 'qty', 'price', 'invNo', 'bcdRate', 'bcdAmount', 'bcdUnit', 'bcdSpecAmount', 'bcdRateBasis', 'specQty', 'swsRate', 'healthCessRate', 'healthCessAmount'];

const toInt = (value) => parseInt(value, 10) || 0;
const byInvoiceAndItemSr = (first, second) => (parseInt(first.invSrNo, 10) || 1) - (parseInt(second.invSrNo, 10) || 1) || toInt(first.itemSrNo) - toInt(second.itemSrNo);
const sameSr = (first, second) => String(parseInt(first, 10) || '') === String(parseInt(second, 10) || '');
const popupDataOf = (item) => Object.fromEntries(Object.entries(POPUP_DATA_SOURCES).map(([key, source]) => [key, item[source] || null]));
const later = (callback) => setTimeout(callback, 50);

// The boxes of the item form (read by name), as the item keeps them. unit / uqc both come from the box named uqc.
const readItemFields = (formData) => {
  const text = (name) => formData.get(name) || '';
  const fields = {
    itemSrNo: text('itemSrNo'),
    itemNo: text('itemSrNo'),
    ritc: text('ritc') || text('hsCode'),
    hsCode: text('ritc') || text('hsCode'),
    desc: text('desc'),
    productDescription: text('desc'),
    qty: text('qty'),
    quantity: text('qty'),
    unit: text('uqc') || text('unit'),
    uqc: text('uqc') || text('unit'),
    price: text('price'),
    unitPrice: text('price'),
    value: text('value'),
    assessableValue: text('value'),
    foc: formData.get('foc') || 'N',
  };
  PLAIN_FIELDS.forEach((name) => { fields[name] = text(name); });
  UPPERCASE_FIELDS.forEach((name) => { fields[name] = text(name).toUpperCase(); });
  DUTY_LINES.forEach((line) => DUTY_LINE_PARTS.forEach((part) => { fields[line + part] = text(line + part); }));
  return fields;
};

// the duty estimate written on an item (as Re-Calculate does)
const withDutyEstimate = (item, duty) => {
  const igst = asObjectOrNull(item.igstData);
  return {
    ...item,
    assessableValueInr: duty.av.toFixed(2),
    bcdAmount: duty.bcd.toFixed(2),
    swsAmount: duty.sws.toFixed(2),
    healthCessAmount: duty.health ? duty.health.toFixed(2) : item.healthCessAmount,
    igstData: igst ? { ...igst, amount: duty.igst.toFixed(2) } : igst,
    totalDuty: duty.total.toFixed(2),
  };
};

// SAVE / MODIFY / DELETE of the item form, Read File, Re-Calculate, the duty calculator and Quick Quantity Entry
export default function useItemSave(grid) {
  const { checkedIds, deleteSelected, invoices, items, jobData, onSave, selectedItem, selectedRowId, setItems, setJobData, setSelectedRowId, setInvoices, esanchitDocs, setEsanchitDocs, takePendingIgst } = grid;

  const saveJob = (changes) => { if (onSave) later(() => onSave(changes)); };

  // Read File (Excel / CSV): one workbook for the whole job (Invoices + Items + Containers + SW sheets + Supporting
  // docs + SVB / Licence / Anti-dumping), our template or the other ERP's ImportExcel - see jobExcel.js
  const handleReadFile = async (event) => {
    const file = event.target.files[0];
    if (event.target) event.target.value = null;
    if (!file) return;
    try {
      const startSr = {};
      items.forEach((item) => { const invoiceSr = String(item.invSrNo || '1'); startSr[invoiceSr] = Math.max(startSr[invoiceSr] || 0, toInt(item.itemSrNo)); });
      // the job's items go along, so a file with only SW_Control / SW sheets / Licence / SVB adds to them
      const read = readJobWorkbook(await file.arrayBuffer(), invoices, startSr, items);
      if (!read.items.length && !read.invoices.length && !read.containers.length && !read.jobDocs.length && !read.itemsOnJob) {
        toast.error('Nothing found in the file (sheets "Items" / "Invoices" - RITC / Description / Invoice No columns' + (read.warnings.length ? '; ' + read.warnings.slice(0, 3).join('; ') : '') + ')');
        return;
      }
      const showNotes = (notes) => {
        if (notes.length) toast(notes.slice(0, 8).join('\n') + (notes.length > 8 ? `\n...and ${notes.length - 8} more` : ''), { duration: 9000 });
      };
      // only SW / licence / SVB / doc rows for the job's items: put them on and save - no rate fill / duty recalculation
      if (!read.items.length && read.itemsOnJob) {
        const merged = mergeJobWorkbook(read, { invoices, items, jobData, esanchitDocs });
        setItems(merged.items);
        if (read.jobDocs.length && setEsanchitDocs) setEsanchitDocs(merged.esanchitDocs);
        saveJob({ items: merged.items, ...merged.jobDataPatch, ...(read.jobDocs.length ? { esanchitDocs: merged.esanchitDocs } : {}) });
        toast.success(merged.summary);
        showNotes(merged.notes);
        return;
      }
      let replaceItems = false;
      if (read.items.length && items.length) {
        replaceItems = await askConfirm({ title: 'The job already has items', message: `This job already has ${items.length} item(s) and the file has ${read.items.length}.`, okLabel: 'Replace with the file\'s items', cancelLabel: 'Add the file\'s items after them' });
      }
      const merged = mergeJobWorkbook(read, { invoices, items, jobData, esanchitDocs, replaceItems });
      const patch = { ...merged.jobDataPatch };
      if (read.invoices.length) { patch.invoices = merged.invoices; setInvoices(merged.invoices); }
      if (read.jobDocs.length && setEsanchitDocs) setEsanchitDocs(merged.esanchitDocs);
      // blank BCD / IGST rates from the Tariff master, then the duty amounts + totals strip (as Re-Calculate does)
      const withRates = await fillRatesFromTariff(merged.items);
      const recalculated = recalcDuty(withRates.items, merged.invoices, { ...jobData, ...patch });
      setItems(recalculated.items);
      setJobData((previous) => ({ ...previous, ...patch, ...recalculated.totals }));
      saveJob({
        items: recalculated.items,
        ...(read.invoices.length ? { invoices: merged.invoices } : {}),
        ...(read.jobDocs.length ? { esanchitDocs: merged.esanchitDocs } : {}),
        ...merged.jobDataPatch,
        ...recalculated.totals,
      });
      const notes = [...merged.notes];
      if (withRates.notFound.length) notes.push('RITC not in Tariff master (type the BCD / IGST rate): ' + withRates.notFound.join(', '));
      if (recalculated.noRate) notes.push(`${recalculated.noRate} item(s): exchange rate missing for the invoice currency - use "Update Exchange Rate" then Re-Calculate`);
      toast.success(merged.summary
        + (withRates.filled ? ` - rates from Tariff master for ${withRates.filled} item(s)` : '')
        + (recalculated.noRate ? '' : `, duty estimate ₹${recalculated.duty.toFixed(2)}`)
        + (notes.length ? ` - ${notes.length} note(s), see below` : ''));
      showNotes(notes);
    } catch (error) {
      console.error(error);
      toast.error('Failed to read the file: ' + error.message);
    }
  };

  // Re-Calculate: value = qty x price where missing, duty estimate per item on the assessable value in INR, and the
  // totals bar (item total, invoice total, CIF in INR, total duty)
  const handleRecalculate = () => {
    let cif = 0;
    let duty = 0;
    let withoutRate = 0;
    const nextItems = items.map((item) => {
      const estimate = computeItemDuty(item, invoices, jobData);
      if (!estimate.rateFound) { withoutRate++; return item; }
      cif += estimate.av;
      duty += estimate.total;
      return withDutyEstimate({ ...item, value: item.value || (estimate.itemValue ? estimate.itemValue.toFixed(2) : item.value) }, estimate);
    });
    setItems(nextItems);
    const itemTotal = nextItems.reduce((sum, item) => sum + ((parseFloat(item.qty || item.quantity) * parseFloat(item.price || item.unitPrice)) || parseFloat(item.value) || 0), 0);
    setJobData((previous) => ({ ...previous, itemTotal: itemTotal.toFixed(2), cifTotalInr: cif.toFixed(2), invTotal: cif.toFixed(2), totalDuty: duty.toFixed(2) }));
    if (withoutRate) toast.error(`${withoutRate} item(s) skipped: exchange rate missing for their invoice currency`);
    else toast.success(`Recalculated: CIF ₹${cif.toFixed(2)}, duty ₹${duty.toFixed(2)} (estimate)`);
  };

  // Quick Quantity Entry (ex-bond): the quantities typed in the window are written on their items in one go - value =
  // quantity x unit price and the duty estimate, as MODIFY and Re-Calculate do for one item - then one save
  const applyQuickQty = (qtyById) => {
    let changed = 0;
    const nextItems = items.map((item) => {
      if (!Object.prototype.hasOwnProperty.call(qtyById || {}, item.id)) return item;
      const qty = String(qtyById[item.id]);
      if (qty === String(item.qty || item.quantity || '')) return item;
      const unitPrice = parseFloat(String(item.price ?? item.unitPrice ?? '').replace(/,/g, ''));
      let updated = { ...item, qty, quantity: qty };
      if (unitPrice > 0) { const value = (parseFloat(qty) * unitPrice).toFixed(2); updated.value = value; updated.assessableValue = value; }
      const estimate = computeItemDuty(updated, invoices, jobData);
      if (estimate.rateFound) updated = withDutyEstimate(updated, estimate);
      changed++;
      return updated;
    });
    if (!changed) { toast('No quantity was changed'); return 0; }
    setItems(nextItems);
    setSelectedRowId(null); // the item form shows the values it opened with
    saveJob({ items: nextItems, _notify: changed + ' quantity(ies) changed' });
    return changed;
  };

  // Customs Duty Calculator (one item): uses the rates typed on the screen right now and fills the amount boxes
  const handleDutyCalculate = () => {
    if (!selectedRowId || !selectedItem) { toast('Please select an item to calculate duty.'); return; }
    const form = getItemForm();
    const formData = form ? new FormData(form) : null;
    const liveItem = { ...selectedItem };
    DUTY_FORM_FIELDS.forEach((name) => { const value = formData?.get(name); if (value !== null && value !== undefined) liveItem[name] = value; });
    const estimate = computeItemDuty(liveItem, invoices, jobData);
    if (!estimate.rateFound) { toast.error(`Exchange rate for ${estimate.currency || 'the invoice currency'} is missing (Job Header / Invoice)`); return; }
    const setBox = (name, value) => { const element = form && form.elements[name]; if (element) element.value = value; };
    setBox('bcdAmount', estimate.bcd.toFixed(2));
    setBox('swsAmount', estimate.sws.toFixed(2));
    if (estimate.health) setBox('healthCessAmount', estimate.health.toFixed(2));
    const igst = asObjectOrNull(selectedItem.igstData);
    setItems(items.map((item) => (item.id === selectedRowId ? {
      ...item, bcdAmount: estimate.bcd.toFixed(2), swsAmount: estimate.sws.toFixed(2), assessableValueInr: estimate.av.toFixed(2),
      igstData: igst ? { ...igst, amount: estimate.igst.toFixed(2) } : igst, totalDuty: estimate.total.toFixed(2),
    } : item)));
    toast.success(`Ass. value ₹${estimate.av.toFixed(2)} | BCD ₹${estimate.bcd.toFixed(2)} + SWS ₹${estimate.sws.toFixed(2)}`
      + (estimate.health ? ` + Health ₹${estimate.health.toFixed(2)}` : '')
      + ` + IGST ₹${estimate.igst.toFixed(2)}`
      + (estimate.add || estimate.other ? ` + other ₹${(estimate.add + estimate.other).toFixed(2)}` : '')
      + ` = ₹${estimate.total.toFixed(2)} (estimate)`, { duration: 7000 });
  };

  const handleClear = (event) => {
    if (event) event.preventDefault();
    setSelectedRowId(null);
    // the form is uncontrolled: reset it too, otherwise typed values stay when no row was selected
    setTimeout(() => { const form = getItemForm(); if (form) form.reset(); }, 0);
  };

  const handleModify = (event) => {
    if (event) event.preventDefault();
    if (!selectedRowId || !items.some((item) => item.id === selectedRowId)) {
      toast.error('Please select the item in the grid first (click its row), then Modify.');
      return;
    }
    const formData = new FormData(getItemForm());
    const newQty = parseFloat(formData.get('qty') || 0);
    // ex-bond: no more than the warehouse balance can be cleared
    if (selectedItem._whBalanceQty !== undefined) {
      const balance = parseFloat(selectedItem._whBalanceQty);
      if (newQty > balance) {
        toast(` You cannot clear more than the Warehouse Balance!\nMax Allowed: ${balance}\nEntered: ${newQty}`);
        return;
      }
    }
    // the invoice Sr No comes from the chosen invoice
    const invoiceNo = formData.get('invNo') || '';
    const invoiceIndex = invoices.findIndex((invoice) => invoice.invNo === invoiceNo);
    // ICEGATE keys items by invoice sr + item sr: another item of the same invoice may not have this Item Sr No
    const targetInvoiceSr = invoiceIndex !== -1 ? String(invoiceIndex + 1) : String(selectedItem.invSrNo || '1');
    const targetItemSr = String(parseInt(formData.get('itemSrNo'), 10) || '');
    if (targetItemSr && items.some((item) => item.id !== selectedRowId && String(item.invSrNo || '1') === targetInvoiceSr && String(parseInt(item.itemSrNo, 10) || '') === targetItemSr)) {
      toast.error(`Item Sr No ${targetItemSr} is already used in invoice ${targetInvoiceSr} - choose another Sr No`);
      return;
    }
    const ritc = formData.get('ritc') || formData.get('hsCode');
    const newItems = items.map((item) => (item.id === selectedRowId ? {
      ...item,
      invNo: invoiceNo,
      invSrNo: invoiceIndex !== -1 ? String(invoiceIndex + 1) : String(item.invSrNo || '1'),
      ...readItemFields(formData),
      ...popupDataOf(selectedItem),
      // pending = the Tariff master's IGST for an item that had none
      igstData: (takePendingIgst && takePendingIgst(ritc, selectedRowId)) || selectedItem.igstData || null,
    } : item));
    setItems(newItems);
    saveJob({ items: newItems, _notify: 'Item ' + (formData.get('itemSrNo') || '') + ' modified' });
  };

  const handleSave = (event) => {
    if (event) event.preventDefault();
    const form = getItemForm();
    if (!form) return;
    const formData = new FormData(form);
    const itemSrNo = formData.get('itemSrNo');
    if (!itemSrNo) { toast.error('Item Sr No is mandatory to save!'); return; }
    const hsCode = formData.get('hsCode') || formData.get('ritc') || '';
    const description = formData.get('desc') || formData.get('productDescription') || '';
    const qty = parseFloat(formData.get('qty') || formData.get('quantity') || 0);
    if (!hsCode) { toast.error('HS Code (RITC) is mandatory!'); return; }
    if (!description) { toast.error('Item Description is mandatory!'); return; }
    if (!qty || qty <= 0) { toast.error('Quantity must be greater than 0!'); return; }

    const invoiceIndex = invoices.findIndex((invoice) => invoice.invNo === formData.get('invNo'));
    if (invoiceIndex === -1) { toast.error(invoices.length ? 'Select the invoice (Inv No) this item belongs to' : 'Add the invoice first (3. Invoices), then the items'); return; }
    const invSrNo = String(invoiceIndex + 1);
    // SAVE while a grid row is selected and its invoice / Item Sr No are unchanged is a change of that item: it is
    // saved as Modify (a second copy without its popups made the invoice value no longer match the items)
    if (selectedRowId && selectedItem && items.some((item) => item.id === selectedRowId)
        && String(selectedItem.invSrNo || '1') === invSrNo && sameSr(selectedItem.itemSrNo, itemSrNo)) {
      toast('Item ' + itemSrNo + ' is already in the grid - your changes are saved to it (Modify). For a new item press Clear first.', { icon: 'ℹ️', duration: 7000 });
      handleModify();
      return;
    }

    const newItem = {
      id: Date.now(),
      invNo: formData.get('invNo') || '',
      invSrNo,
      ...readItemFields(formData),
      ...popupDataOf({}),
      // the IGST rate / notification the Tariff master gave for this RITC
      igstData: (takePendingIgst && takePendingIgst(formData.get('ritc') || formData.get('hsCode'), null)) || null,
    };
    // "Add In Middle": an Item Sr No already used in this invoice puts the item there and moves the later items of that
    // invoice down by one; the list stays in invoice / item order
    const newSr = toInt(newItem.itemSrNo);
    const isInvoiceItem = (item) => String(item.invSrNo || '1') === String(invSrNo);
    const clash = items.some((item) => isInvoiceItem(item) && toInt(item.itemSrNo) === newSr);
    const shifted = clash
      ? items.map((item) => (isInvoiceItem(item) && toInt(item.itemSrNo) >= newSr ? { ...item, itemSrNo: String(toInt(item.itemSrNo) + 1), itemNo: String(toInt(item.itemSrNo) + 1) } : item))
      : items;
    const newItems = [...shifted, newItem].sort(byInvoiceAndItemSr);
    if (clash) toast(`Item placed at Sr No ${newSr}; the later items of invoice ${invSrNo} moved down by one`, { icon: 'ℹ️' });
    setItems(newItems);
    saveJob({ items: newItems, _notify: 'Item ' + (newItem.itemSrNo || '') + ' added' });
    setSelectedRowId(newItem.id);
  };

  // Arrange Item Serial No: re-numbers the items of EACH invoice 1, 2, 3 ... in their present order; ICEGATE keys an
  // item by invoice sr + item sr, so gaps / repeats are refused there
  const handleArrangeItemSerial = async (event) => {
    if (event) event.preventDefault();
    if (!items.length) { toast('No items to arrange'); return; }
    const countByInvoice = {};
    const renumbered = [...items].sort(byInvoiceAndItemSr).map((item) => {
      const invoiceSr = String(item.invSrNo || '1');
      countByInvoice[invoiceSr] = (countByInvoice[invoiceSr] || 0) + 1;
      return { ...item, itemSrNo: String(countByInvoice[invoiceSr]), itemNo: String(countByInvoice[invoiceSr]) };
    });
    if (renumbered.every((item, index) => String(item.itemSrNo) === String(items[index] && items[index].itemSrNo) && item.id === (items[index] || {}).id)) { toast('Item Sr Nos are already in order'); return; }
    if (!(await askConfirm({ title: 'Re-number the items?', message: 'The items of each invoice get Sr No 1, 2, 3 ... in their present order.', okLabel: 'Re-number', cancelLabel: 'Leave as they are' }))) return;
    setItems(renumbered);
    saveJob({ items: renumbered });
    toast.success('Item Sr No re-arranged');
  };

  const handleDelete = async (event) => {
    if (event) event.preventDefault();
    if (!selectedRowId || !items.some((item) => item.id === selectedRowId)) {
      toast.error('Please select the item in the grid first (click its row), then Delete.');
      return;
    }
    const confirmed = await askConfirm({
      title: 'Delete this item?',
      message: 'Item Sr No ' + (selectedItem?.itemSrNo || '') + (selectedItem?.desc ? ' - ' + String(selectedItem.desc).slice(0, 60) : ''),
      note: 'The item is removed from this job. This cannot be undone.',
      okLabel: 'Delete',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });
    if (!confirmed) return;
    const newItems = items.filter((item) => item.id !== selectedRowId);
    setItems(newItems);
    saveJob({ items: newItems, _notify: 'Item deleted' });
    setSelectedRowId(null);
  };

  const handleDeleteMultiple = async (event) => {
    if (event) event.preventDefault();
    if (checkedIds.length === 0) { toast.error('Please select items to delete using checkboxes!'); return; }
    const confirmed = await askConfirm({ title: 'Delete ' + checkedIds.length + ' item(s)?', message: 'The ticked items are removed from this job.', note: 'This cannot be undone.', okLabel: 'Delete', cancelLabel: 'Keep them', tone: 'danger' });
    if (confirmed) deleteSelected();
  };

  return { applyQuickQty, handleArrangeItemSerial, handleClear, handleDelete, handleDeleteMultiple, handleDutyCalculate, handleModify, handleReadFile, handleRecalculate, handleSave };
}
