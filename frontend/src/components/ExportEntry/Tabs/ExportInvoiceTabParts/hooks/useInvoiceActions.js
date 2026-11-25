import { useState } from 'react';
import toast from 'react-hot-toast';
import askConfirm, { askText } from '@/components/common/askConfirm';
import { unitsOf } from '@/utils/cbicExchange';
import { buildInvoice, checkInvoice, invoiceNoOf, nextInvoiceId } from '../invoiceRules';

const COPY_NO_ROOT_LENGTH = 13;

// the button row of the Invoice tab: Save, Modify, Delete, Duplicate, Arrange, Update Exchange Rate, Other Details
export default function useInvoiceActions(ctx) {
  const {
    exportData, invoices, setInvoices, repriceItems, askDelete, formData, setFormData, selectedId, selectInvoice, resetForm, keepInInvBase,
    natureOfContract, addFreightInsurance, igstBasedOn, consigneeSame, thirdPartyDetails, buyerDetails, setShowOtherDetailsModal,
  } = ctx;
  const [otherDetailsBefore, setOtherDetailsBefore] = useState(null);

  const formState = { formData, natureOfContract, addFreightInsurance, igstBasedOn, consigneeSame, thirdPartyDetails, buyerDetails, exportData };

  // errors stop the save; warnings ask first
  const passesChecks = async () => {
    const { errors, warnings } = checkInvoice({ ...formState, invoices, selectedId });
    if (errors.length) {
      toast.error(errors.join('\n'), { duration: 6000 });
      return false;
    }
    if (warnings.length) return askConfirm({ title: 'Save the invoice?', message: warnings.join('\n'), okLabel: 'Save anyway', cancelLabel: 'Go back', tone: 'warn' });
    return true;
  };

  const modifyInvoice = async () => {
    if (!selectedId) {
      toast.error('Click an invoice in the list first');
      return false;
    }
    if (!(await passesChecks())) return false;
    const next = invoices.map((invoice) => (invoice.id === selectedId ? buildInvoice(invoice, formState) : invoice));
    setInvoices(next);
    repriceItems(next);
    resetForm();
    toast.success('Invoice modified - save the job to keep it');
    return true;
  };

  // Save while an invoice is open works as Modify (it added a copy of the open invoice before)
  const saveInvoice = async () => {
    if (selectedId) {
      if (await modifyInvoice()) toast('Save on an open invoice works as Modify - for a new invoice press Clear first', { icon: 'ℹ️', duration: 5000 });
      return;
    }
    if (!(await passesChecks())) return;
    const invoice = buildInvoice({ id: nextInvoiceId(invoices) }, formState);
    delete invoice.exportJobId;
    setInvoices([...invoices, invoice]);
    resetForm();
    toast.success(`Invoice ${invoice.no} added (serial ${invoices.length + 1}) - click Modify / Ctrl+S on the SB Header to save the job`);
  };

  const deleteInvoice = async () => {
    if (!selectedId) {
      toast.error('Click an invoice in the list first');
      return;
    }
    const index = invoices.findIndex((invoice) => invoice.id === selectedId);
    if (!(await askDelete([selectedId], `invoice ${formData.no || index + 1}`))) return;
    resetForm();
    toast.success('Invoice deleted');
  };

  const deleteListedInvoice = async (invoice, index) => {
    if (!(await askDelete([invoice.id], `invoice ${invoiceNoOf(invoice) || index + 1}`))) return;
    if (selectedId === invoice.id) resetForm();
    toast.success('Invoice deleted');
  };

  const deleteAllInvoices = async () => {
    if (!invoices.length) {
      toast.error('No invoice to delete');
      return;
    }
    if (!(await askDelete(invoices.map((invoice) => invoice.id), `all ${invoices.length} invoice(s)`))) return;
    resetForm();
    toast.success('All invoices deleted');
  };

  // the copy gets its own invoice no (the same no twice is refused) and is opened for editing
  const duplicateInvoice = () => {
    if (!selectedId) {
      toast.error('Click an invoice in the list first');
      return;
    }
    const original = invoices.find((invoice) => invoice.id === selectedId);
    const root = String(invoiceNoOf(original) || 'INV').slice(0, COPY_NO_ROOT_LENGTH);
    let no = `${root}-C`;
    for (let copyNumber = 2; invoices.some((invoice) => String(invoice.no || invoice.invoiceNo) === no); copyNumber++) no = `${root}-C${copyNumber}`;
    const copy = { ...original, id: nextInvoiceId(invoices), no, invoiceNo: no };
    delete copy.exportJobId;
    delete copy.items;
    setInvoices([...invoices, copy]);
    selectInvoice(copy);
    toast.success(`Invoice copied as ${no} - change the invoice no and click Modify`);
  };

  // serial = position in the list; ids are renumbered 1..n (a deleted invoice left gaps)
  const arrangeSerials = () => {
    if (!invoices.length) {
      toast.error('No invoices');
      return;
    }
    setInvoices(invoices.map((invoice, index) => ({ ...invoice, id: index + 1 })));
    resetForm();
    toast.success(`Invoice serial numbers arranged 1 - ${invoices.length}`);
  };

  // the rate is for the invoice currency (rupees per 100 units for the CBIC Schedule II currencies); FOB is worked out again
  const updateExchangeRate = async () => {
    const currency = String(formData.currency || invoices[0]?.currency || '').toUpperCase();
    const units = unitsOf(currency);
    const answer = await askText({
      title: 'Exchange rate for all invoices',
      message: `Rupees per ${units > 1 ? `${units} ` : ''}${currency || 'unit'}${units > 1 ? ' - CBIC Schedule II' : ''}`,
      label: 'Exchange rate', value: formData.exchRate || '', okLabel: 'Apply',
      check: (typed) => (parseFloat(typed) > 0 ? '' : 'Type a rate above 0'),
    });
    if (answer === null) return;
    const rate = parseFloat(answer);
    if (isNaN(rate) || rate <= 0) {
      toast.error('Invalid exchange rate');
      return;
    }
    const sameCurrency = invoices.filter((invoice) => !currency || String(invoice.currency || '').toUpperCase() === currency);
    if (currency && sameCurrency.length < invoices.length && !(await askConfirm({
      title: 'Apply the rate',
      message: `Apply ${rate.toFixed(4)} only to the ${sameCurrency.length} ${currency} invoice(s)? Other currencies are not changed.`,
      okLabel: 'Apply', cancelLabel: 'Do not apply',
    }))) return;
    const rateText = rate.toFixed(4);
    const next = invoices.map((invoice) => {
      if (currency && String(invoice.currency || '').toUpperCase() !== currency) return invoice;
      const oldRate = parseFloat(invoice.exchRate || invoice.exchangeRate) || 0;
      const fob = parseFloat(invoice.invFobInr);
      return {
        ...invoice, exchRate: rateText, exchangeRate: rateText, unitInRs: unitsOf(invoice.currency || currency),
        invFobInr: oldRate > 0 && !isNaN(fob) ? (fob / oldRate * rate).toFixed(2) : invoice.invFobInr,
      };
    });
    setInvoices(next);
    repriceItems(next);
    setFormData({ ...formData, exchRate: rateText, unitInRs: units });
    if (selectedId) keepInInvBase({ exchRate: rateText, unitInRs: units });
    toast.success(`Exchange rate ${rateText} applied to ${sameCurrency.length} invoice(s)`);
  };

  // Cancel puts back the values from before the window was opened
  const openOtherDetails = () => {
    setOtherDetailsBefore({ ...formData });
    setShowOtherDetailsModal(true);
  };
  const closeOtherDetails = (keep) => {
    if (!keep && otherDetailsBefore) setFormData(otherDetailsBefore);
    setOtherDetailsBefore(null);
    setShowOtherDetailsModal(false);
  };

  return {
    saveInvoice, modifyInvoice, deleteInvoice, deleteListedInvoice, deleteAllInvoices, duplicateInvoice, arrangeSerials, updateExchangeRate,
    openOtherDetails, closeOtherDetails,
  };
}
