import toast from 'react-hot-toast';
import askConfirm, { askText } from '@/components/common/askConfirm';
import { asList } from '@/utils/asList';
import { validateIcegateRules } from '@/utils/IcegateValidators';
import { buildItemRow, clearedItemForm, invoiceSerialOf, missingItemFields, newItemForm, renumberItems } from '../itemForm';
import { readItemsSheet } from '../itemSheet';

const OPEN_ITEM_FIRST = 'Open an item first (pencil icon in the list)';

// the buttons of the Items tab: Save, Modify, Delete, Clear, Arrange, Duplicate, Validate, Add Item, Import Excel
export default function useItemActions(ctx) {
  const {
    items, setItems, exportData, formData, setFormData, selectedRowId, setSelectedRowId, nextItemSr, putItems, clearFormEdits, leaveFormOk,
    setValidationErrors, setValidationSuccess,
  } = ctx;
  const editing = selectedRowId != null && items.some((item) => item.id === selectedRowId);

  const itemOk = () => {
    const missing = missingItemFields(formData, exportData);
    if (missing.length) toast.error(`Fill: ${missing.join(', ')}`);
    return missing.length === 0;
  };

  const clearForm = (invSr) => {
    const serial = parseInt(invSr, 10) || 1;
    clearFormEdits();
    setSelectedRowId(null);
    setFormData(clearedItemForm(serial, nextItemSr(serial), formData));
  };

  // the open item takes the form's values; a changed invoice serial moves it to the end of that invoice
  const modifyItem = () => {
    if (!selectedRowId) {
      toast.error(OPEN_ITEM_FIRST);
      return false;
    }
    if (!itemOk()) return false;
    const old = items.find((item) => item.id === selectedRowId);
    const invSr = parseInt(formData.invSr, 10) || 1;
    const moved = old && invoiceSerialOf(old) !== invSr;
    let list = items.map((item) => (item.id === selectedRowId
      ? buildItemRow({ ...item, ...formData, id: item.id, invSr, itemSr: moved ? nextItemSr(invSr, items, item.id) : formData.itemSr })
      : item));
    if (moved) list = renumberItems(list);
    putItems(list);
    toast.success(`Item updated${moved ? ` and moved to invoice ${invSr}` : ''}`);
    clearForm(invSr);
    return true;
  };

  // Save on an open item works as Modify (it added a full copy of the item before); "Add before item" puts the new
  // item before that item no of the same invoice
  const saveItem = () => {
    if (editing) {
      if (modifyItem()) toast('Save on an open item works as Modify - for a new item press Add Item first', { icon: 'ℹ️', duration: 5000 });
      return;
    }
    if (!itemOk()) return;
    const invSr = parseInt(formData.invSr, 10) || 1;
    const row = buildItemRow({ ...formData, id: Date.now(), invSr, itemSr: nextItemSr(invSr) });
    const before = parseInt(formData.addInMiddle, 10);
    let list = [...items, row];
    if (before > 0) {
      const position = items.findIndex((item) => invoiceSerialOf(item) === invSr && (parseInt(item.itemSr, 10) || 0) === before);
      if (position >= 0) list = renumberItems([...items.slice(0, position), row, ...items.slice(position)]);
    }
    putItems(list);
    toast.success(`Item added to invoice ${invSr}${before > 0 ? ` before item ${before}` : ''}`);
    clearForm(invSr);
  };

  const deleteItem = async () => {
    if (!selectedRowId) {
      toast.error(OPEN_ITEM_FIRST);
      return;
    }
    const item = items.find((row) => row.id === selectedRowId);
    const goAhead = await askConfirm({
      title: 'Delete item', message: `Delete item ${item ? item.itemSr : ''} (${item ? String(item.desc || '').slice(0, 40) : ''})?`,
      okLabel: 'Delete', cancelLabel: 'Keep', tone: 'danger',
    });
    if (!goAhead) return;
    putItems(renumberItems(items.filter((row) => row.id !== selectedRowId)));
    clearForm(formData.invSr);
    toast.success('Item deleted');
  };

  // the items of the chosen invoice, or all
  const deleteMultipleItems = async () => {
    if (!items.length) {
      toast.error('No items');
      return;
    }
    const invSr = parseInt(formData.invSr, 10) || 1;
    const ofInvoice = items.filter((item) => invoiceSerialOf(item) === invSr).length;
    const invoiceCount = (exportData?.invoices || []).length;
    const choice = invoiceCount > 1
      ? await askText({
        title: 'Delete multiple items', message: 'Which items are deleted?', label: 'Delete', okLabel: 'Delete',
        choices: [{ value: 'I', label: `Items of invoice ${invSr} (${ofInvoice})` }, { value: 'ALL', label: `ALL ${items.length} items of the job` }],
      })
      : ((await askConfirm({ title: 'Delete all items', message: `Delete all ${items.length} item(s)?`, okLabel: 'Delete all', cancelLabel: 'Keep them', tone: 'danger' })) ? 'ALL' : null);
    if (!choice) return;
    if (String(choice).toUpperCase() === 'ALL') {
      putItems([]);
      toast.success('All items deleted');
    } else if (String(choice).toUpperCase() === 'I') {
      putItems(renumberItems(items.filter((item) => invoiceSerialOf(item) !== invSr)));
      toast.success(`${ofInvoice} item(s) of invoice ${invSr} deleted`);
    }
    clearForm(invSr);
  };

  const arrangeSerials = () => {
    putItems(renumberItems(items));
    toast.success('Item serial numbers arranged (1, 2, 3 ... in each invoice)');
  };

  const duplicateItem = () => {
    const original = selectedRowId ? items.find((item) => item.id === selectedRowId) : null;
    if (!original) {
      toast.error('Open the item to copy first (pencil icon in the list)');
      return;
    }
    const invSr = invoiceSerialOf(original);
    const copy = {
      ...original, id: Date.now(), itemSr: nextItemSr(invSr),
      eSanchitList: asList(original.eSanchitList).map((doc) => ({ ...doc, id: `doc-${Date.now()}${Math.random()}` })),
    };
    putItems([...items, copy]);
    toast.success(`Item copied as item ${copy.itemSr} of invoice ${invSr}`);
  };

  const validateJob = () => {
    const errors = validateIcegateRules(exportData, items, exportData?.invoices || []);
    if (errors.length > 0) setValidationErrors(errors);
    else setValidationSuccess(true);
  };

  // a blank form for a new item (Modify must not overwrite the item opened before)
  const addNewItem = async () => {
    if (!(await leaveFormOk('a blank form opens for a new item'))) return;
    clearFormEdits();
    setSelectedRowId(null);
    setFormData(newItemForm(formData.invSr || 1, nextItemSr(formData.invSr || 1)));
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const importItemsFile = async ([file]) => {
    if (!file) return;
    const invoiceCount = (exportData?.invoices || []).length;
    try {
      const { items: rows, skipped } = await readItemsSheet(file, items, invoiceCount);
      if (skipped.length) {
        toast.error(`${skipped.length} row(s) left out - the job has ${invoiceCount || 'no'} invoice(s): ${skipped.slice(0, 4).join(', ')}${skipped.length > 4 ? '…' : ''}`, { duration: 8000 });
      }
      if (!rows.length) {
        if (!skipped.length) toast.error('No items found. Columns needed: RITC, Description, Qty, Unit, Rate (optional InvSr, Scheme)');
        return;
      }
      setItems((previous) => [...previous, ...rows]);
      toast.success(`${rows.length} item(s) added from the file`);
    } catch (error) {
      toast.error(`Could not read the file: ${error.message}`);
    }
  };

  return {
    editing, saveItem, modifyItem, deleteItem, deleteMultipleItems, clearForm, arrangeSerials, duplicateItem, validateJob, addNewItem, importItemsFile,
  };
}
