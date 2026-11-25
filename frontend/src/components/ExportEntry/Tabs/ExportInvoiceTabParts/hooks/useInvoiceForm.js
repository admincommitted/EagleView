import { useState } from 'react';
import askConfirm from '@/components/common/askConfirm';
import useUnsavedEdits from './useUnsavedEdits';
import { ADD_FLAG_OF_CONTRACT, EMPTY_BUYER, EMPTY_INVOICE_FORM, invoiceNoOf } from '../invoiceRules';

const sameName = (a, b) => String(a).trim().toUpperCase() === String(b).trim().toUpperCase();

// the invoice in the form, with its Y/N choices; they belong to the invoice and are opened / emptied with it
export default function useInvoiceForm({ exportData, registerPendingEdits }) {
  const [formData, setFormData] = useState(EMPTY_INVOICE_FORM);
  const [selectedId, setSelectedId] = useState(null);
  const [thirdPartyDetails, setThirdPartyDetails] = useState('N');
  const [natureOfContract, setNatureOfContract] = useState('CIF');
  const [igstBasedOn, setIgstBasedOn] = useState('CIF');
  const [addFreightInsurance, setAddFreightInsurance] = useState('B');
  const [consigneeSame, setConsigneeSame] = useState('Y');
  const [buyerDetails, setBuyerDetails] = useState(EMPTY_BUYER);
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [showOtherDetailsModal, setShowOtherDetailsModal] = useState(false);

  const edits = useUnsavedEdits({
    current: { formData, natureOfContract, addFreightInsurance, igstBasedOn, consigneeSame, thirdPartyDetails, buyerDetails },
    area: 'invoices',
    registerPendingEdits,
    describe: (form) => (selectedId != null
      ? `Invoice ${form.formData.no || ''} has changes that were not put in with MODIFY - they are not part of the SB yet.`
      : `A new invoice${form.formData.no ? ` (${form.formData.no})` : ''} is typed in the Invoice form but was not added with SAVE - it is not part of the SB yet.`),
  });

  // Update Exchange Rate changes the open invoice and its form together: that is not an unsaved change. A form with
  // no other change is taken again once the screen has worked out FOB from the new rate.
  const keepInInvBase = (patch) => {
    const base = edits.baseRef.current;
    if (!base) return;
    if (!edits.isEdited()) {
      setTimeout(() => { if (edits.baseRef.current) edits.baseRef.current = { ...edits.currentRef.current }; }, 80);
      return;
    }
    edits.baseRef.current = { ...base, formData: { ...base.formData, ...patch } };
  };

  const setField = (name, value) => setFormData((previous) => ({ ...previous, [name]: value }));

  const handleNatureOfContractChange = (contract) => {
    setNatureOfContract(contract);
    if (ADD_FLAG_OF_CONTRACT[contract]) setAddFreightInsurance(ADD_FLAG_OF_CONTRACT[contract]);
  };

  const handleConsigneeSameChange = (answer) => {
    setConsigneeSame(answer);
    if (answer === 'N') setShowBuyerModal(true);
  };

  const selectInvoice = (invoice) => {
    edits.clearEdits();
    setSelectedId(invoice.id);
    setFormData({
      ...invoice, no: invoiceNoOf(invoice), date: invoice.date || invoice.invoiceDate || '', value: invoice.value || invoice.invoiceValue || '',
      exchRate: invoice.exchRate || invoice.exchangeRate || '', buyer: invoice.buyer || invoice.buyerName || '',
    });
    const contract = String(invoice.contractType || invoice.natureOfContract || 'CIF').toUpperCase();
    setNatureOfContract(contract);
    setAddFreightInsurance(invoice.addFreight || ADD_FLAG_OF_CONTRACT[contract] || 'B');
    setIgstBasedOn(invoice.igstBasedOn || 'CIF');
    setConsigneeSame(invoice.consigneeSame || (invoice.buyer && exportData.consigneeName && !sameName(invoice.buyer, exportData.consigneeName) ? 'N' : 'Y'));
    setThirdPartyDetails(invoice.thirdParty === 'Y' || invoice.tpName ? 'Y' : 'N');
    setBuyerDetails({
      name: invoice.buyer || invoice.buyerName || '', address1: invoice.buyerAddress1 || '', address2: invoice.buyerAddress2 || '',
      address3: invoice.buyerAddress3 || '', address4: invoice.buyerAddress4 || '', city: invoice.buyerCity || '',
    });
  };

  const resetForm = () => {
    edits.clearEdits();
    setSelectedId(null);
    setFormData(EMPTY_INVOICE_FORM);
    setNatureOfContract('CIF');
    setAddFreightInsurance('B');
    setIgstBasedOn('CIF');
    setConsigneeSame('Y');
    setThirdPartyDetails('N');
    setBuyerDetails(EMPTY_BUYER);
  };

  // an invoice clicked in the list: asks first when the form has changes; the same invoice keeps its changes
  const openInvoice = async (invoice) => {
    if (invoice.id === selectedId && edits.isEdited()) return;
    const other = `invoice ${invoiceNoOf(invoice)}`;
    const action = selectedId != null ? 'MODIFY' : 'SAVE';
    if (edits.isEdited() && !(await askConfirm({
      title: 'Changes not put in',
      message: selectedId != null ? `Invoice ${formData.no || ''} has changes that were not put in with MODIFY.` : 'The new invoice in the form was not added with SAVE.',
      note: `Drop the changes: ${other} opens, and what was typed here is lost.\nStay here: press ${action} first, then open ${other}.`,
      okLabel: 'Drop the changes',
      cancelLabel: 'Stay here',
    }))) return;
    selectInvoice(invoice);
  };

  return {
    formData, setFormData, setField, selectedId, selectInvoice, resetForm, openInvoice,
    markInvTouched: edits.markTouched, keepInInvBase,
    thirdPartyDetails, setThirdPartyDetails, natureOfContract, handleNatureOfContractChange, igstBasedOn, setIgstBasedOn,
    addFreightInsurance, setAddFreightInsurance, consigneeSame, setConsigneeSame, handleConsigneeSameChange,
    buyerDetails, setBuyerDetails, showBuyerModal, setShowBuyerModal, showOtherDetailsModal, setShowOtherDetailsModal,
  };
}
