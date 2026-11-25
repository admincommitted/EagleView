import toast from 'react-hot-toast';
import askConfirm, { askText } from '@/components/common/askConfirm';
import { useJobContext } from '../../../JobContext';
import { cleanInvoice, indexOfInvoiceNumber, invoiceNumberOf, invoiceSerialOf, remapItems, upperTrim } from './invoiceData';

const ICEGATE_INVOICE_NO_LENGTH = 16;
const VALID_TERMS = ['CIF', 'FOB', 'CF', 'CI'];

const checkInvoiceForm = (form) => {
  const invoiceNumber = invoiceNumberOf(form);
  if (!invoiceNumber) { toast.error('Invoice No is mandatory!'); return false; }
  if (invoiceNumber.length > ICEGATE_INVOICE_NO_LENGTH) toast(`Invoice No is ${invoiceNumber.length} characters - ICEGATE allows 16`, { icon: '⚠️' });
  if (!(parseFloat(String(form.value || form.invValue || '').replace(/,/g, '')) > 0)) { toast.error('Invoice Value must be more than 0'); return false; }
  if (!upperTrim(form.currency || form.invoiceCurrency)) { toast.error('Currency is mandatory'); return false; }
  const terms = upperTrim(form.terms || form.termsOfInvoice);
  if (terms && !VALID_TERMS.includes(terms)) { toast.error('Terms must be CIF, FOB, CF or CI'); return false; }
  return true;
};

const preventDefault = (event) => event?.preventDefault();

export default function useInvoiceEditing({
  invoices, selectedRowId, setSelectedRowId, checkedIds, toggleCheck, invoiceFormData, setInvoiceFormData, commitInvoices, addMissingRates,
}) {
  const { items } = useJobContext();

  const handleClear = (event) => {
    preventDefault(event);
    setSelectedRowId(null);
    setInvoiceFormData({});
  };

  // Save adds a NEW invoice; an Invoice No already on the job is offered as an update of that invoice
  const handleSave = async (event) => {
    preventDefault(event);
    const form = invoiceFormData;
    if (!checkInvoiceForm(form)) return;
    const invoiceNumber = invoiceNumberOf(form);
    const sameIndex = indexOfInvoiceNumber(invoices, invoiceNumber);
    if (sameIndex !== -1) {
      const update = await askConfirm({ title: 'Invoice already on this job', message: `Invoice ${invoiceNumber} is already on this job (Sr No ${sameIndex + 1}).`, okLabel: 'Update that invoice', cancelLabel: 'Do nothing' });
      if (!update) return;
      const newInvoices = invoices.map((invoice, index) => (index === sameIndex ? { ...invoice, ...cleanInvoice(form), id: invoice.id, invNo: invoiceNumber } : invoice));
      commitInvoices(newInvoices, null, { _exchangeRates: addMissingRates(newInvoices) });
      setSelectedRowId(invoices[sameIndex].id);
      toast.success(`Invoice ${invoiceNumber} updated`);
      return;
    }
    const newInvoice = { ...cleanInvoice(form), id: Date.now(), invNo: invoiceNumber };
    const newInvoices = [...invoices, newInvoice];
    commitInvoices(newInvoices, null, { _exchangeRates: addMissingRates(newInvoices) });
    setSelectedRowId(newInvoice.id);
    toast.success(`Invoice ${invoiceNumber} added as Sr No ${newInvoices.length}`);
  };

  // Modify changes the selected invoice (its Invoice No must stay unique; a renamed invoice renames its items), then the form is cleared
  const handleModify = (event) => {
    preventDefault(event);
    if (!selectedRowId || !invoices.some((invoice) => invoice.id === selectedRowId)) { toast.error('Please select the invoice in the grid first (click its row), then Modify.'); return; }
    const form = invoiceFormData;
    if (!checkInvoiceForm(form)) return;
    const invoiceNumber = invoiceNumberOf(form);
    if (indexOfInvoiceNumber(invoices, invoiceNumber, selectedRowId) !== -1) { toast.error(`Invoice No ${invoiceNumber} is already used by another invoice of this job`); return; }
    const selectedIndex = invoices.findIndex((invoice) => invoice.id === selectedRowId);
    const oldNumber = invoiceNumberOf(invoices[selectedIndex]);
    const newInvoices = invoices.map((invoice) => (invoice.id === selectedRowId ? { ...invoice, ...cleanInvoice(form), id: invoice.id, invNo: invoiceNumber } : invoice));
    const renamed = upperTrim(oldNumber) !== upperTrim(invoiceNumber) && (items || []).length;
    const newItems = renamed ? items.map((item) => (invoiceSerialOf(item) === String(selectedIndex + 1) ? { ...item, invNo: invoiceNumber } : item)) : null;
    commitInvoices(newInvoices, newItems, { _exchangeRates: addMissingRates(newInvoices) });
    handleClear();
    toast.success(`Invoice ${invoiceNumber} saved`);
  };

  const removeInvoices = async (ids) => {
    const removedSerials = invoices.map((invoice, index) => (ids.includes(invoice.id) ? index + 1 : null)).filter(Boolean);
    const itemCount = (items || []).filter((item) => removedSerials.includes(parseInt(item.invSrNo || '1', 10))).length;
    const numbers = invoices.filter((invoice) => ids.includes(invoice.id)).map(invoiceNumberOf).join(', ');
    const confirmed = await askConfirm({
      title: 'Delete invoice?',
      message: `Invoice ${numbers}`,
      note: itemCount ? `Its ${itemCount} item(s) are deleted too, and the items of the invoices after it get their new Inv Sr No.` : '',
      okLabel: 'Delete',
      cancelLabel: 'Keep',
      tone: 'danger',
    });
    if (!confirmed) return false;
    const newInvoices = invoices.filter((invoice) => !ids.includes(invoice.id));
    commitInvoices(newInvoices, remapItems(items, invoices, newInvoices));
    return true;
  };

  const handleDelete = async (event) => {
    preventDefault(event);
    if (!selectedRowId) { toast.error('Please select an invoice to delete!'); return; }
    if (await removeInvoices([selectedRowId])) { setSelectedRowId(null); setInvoiceFormData({}); }
  };

  const handleDeleteMultiple = async (event) => {
    preventDefault(event);
    if (checkedIds.length === 0) { toast.error('Please select invoices to delete using checkboxes!'); return; }
    if (await removeInvoices([...checkedIds])) {
      checkedIds.forEach((id) => toggleCheck(id));
      setSelectedRowId(null);
      setInvoiceFormData({});
    }
  };

  // Duplicate asks for a new, unique Invoice No, adds the copy at the end and can copy its items
  const handleDuplicateInvoice = async (event) => {
    preventDefault(event);
    const source = invoices.find((invoice) => invoice.id === selectedRowId);
    if (!source) { toast.error('Please select an invoice to duplicate!'); return; }
    const takenMessage = (number) => (indexOfInvoiceNumber(invoices, number) !== -1 ? `Invoice No ${number} is already on this job` : '');
    const invoiceNumber = await askText({
      title: 'Duplicate invoice',
      message: `A copy of invoice ${invoiceNumberOf(source)} is added at the end of the list.`,
      label: 'New Invoice No',
      okLabel: 'Make the copy',
      check: takenMessage,
    });
    if (!invoiceNumber) return;
    if (takenMessage(invoiceNumber)) { toast.error(takenMessage(invoiceNumber)); return; }
    const copy = { ...cleanInvoice(JSON.parse(JSON.stringify(source))), id: Date.now(), invNo: invoiceNumber };
    const newInvoices = [...invoices, copy];
    const sourceSerial = String(invoices.indexOf(source) + 1);
    const sourceItems = (items || []).filter((item) => invoiceSerialOf(item) === sourceSerial);
    const copyItems = sourceItems.length > 0 && await askConfirm({
      title: 'Copy the items too?',
      message: `Invoice ${invoiceNumberOf(source)} has ${sourceItems.length} item(s).`,
      note: `Copy the items: invoice ${invoiceNumber} gets the same ${sourceItems.length} item(s).\nInvoice only: invoice ${invoiceNumber} is added with no items.`,
      okLabel: 'Copy the items',
      cancelLabel: 'Invoice only',
    });
    const newItems = copyItems
      ? [...items, ...sourceItems.map((item, position) => ({ ...JSON.parse(JSON.stringify(item)), id: Date.now() + position + 1, invSrNo: String(newInvoices.length), invNo: invoiceNumber, importInvoiceId: undefined }))]
      : null;
    commitInvoices(newInvoices, newItems);
    setSelectedRowId(copy.id);
    toast.success(`Invoice ${invoiceNumber} added as Sr No ${newInvoices.length}`);
  };

  return { handleClear, handleSave, handleModify, handleDelete, handleDeleteMultiple, handleDuplicateInvoice };
}
