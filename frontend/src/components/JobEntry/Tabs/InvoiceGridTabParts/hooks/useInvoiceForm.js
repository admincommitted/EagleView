import { useEffect, useRef, useState } from 'react';
import askConfirm from '@/components/common/askConfirm';

const KNOWN_TERMS = ['FOB', 'CF', 'CI', 'CIF'];
const FREIGHT_INCLUDED_TERMS = ['CIF', 'CF'];
const INSURANCE_INCLUDED_TERMS = ['CIF', 'CI'];

const hasCharge = (form, field) => String(form[field] ?? '').trim() !== '' && parseFloat(String(form[field]).replace(/,/g, '')) !== 0;
const isYes = (value) => (value || '').toUpperCase() === 'Y';

// the invoice open in the form (loaded when another row is picked or the number of invoices changes), plus its popups
export default function useInvoiceForm({ invoices, selectedRowId }) {
  const [invoiceFormData, setInvoiceFormData] = useState({});
  const [activeTerm, setActiveTerm] = useState('');
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isMiscIncludedModalOpen, setIsMiscIncludedModalOpen] = useState(false);
  const [isMiscNotIncludedModalOpen, setIsMiscNotIncludedModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isSvbModalOpen, setIsSvbModalOpen] = useState(false);
  const [isOtherInfoModalOpen, setIsOtherInfoModalOpen] = useState(false);
  const [isConditionsModalOpen, setIsConditionsModalOpen] = useState(false);
  const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
  const [isBrokerModalOpen, setIsBrokerModalOpen] = useState(false);

  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedRowId) || null;
  const selectionKey = `${selectedRowId}|${invoices.length}`;
  const loadedSelectionKey = useRef(null);
  useEffect(() => {
    if (loadedSelectionKey.current === selectionKey) return;
    loadedSelectionKey.current = selectionKey;
    setInvoiceFormData(selectedInvoice || {});
  }, [selectionKey, selectedInvoice]);

  const handleInvoiceFieldChange = (event) => {
    const { name, value } = event?.target || {};
    if (name) setInvoiceFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleTermsChange = async (event) => {
    const term = event.target.value.toUpperCase();
    if (KNOWN_TERMS.includes(term)) setActiveTerm(term);
    const includesFreight = FREIGHT_INCLUDED_TERMS.includes(term) && (hasCharge(invoiceFormData, 'freightValue') || hasCharge(invoiceFormData, 'freightRate'));
    const includesInsurance = INSURANCE_INCLUDED_TERMS.includes(term) && (hasCharge(invoiceFormData, 'insuranceValue') || hasCharge(invoiceFormData, 'insuranceRate'));
    if (!includesFreight && !includesInsurance) return;

    const included = [includesFreight && 'freight', includesInsurance && 'insurance'].filter(Boolean).join(' and ');
    const clearCharges = await askConfirm({
      title: 'Clear freight / insurance?',
      message: `Terms ${term} already include ${included}.`,
      note: 'ICES refuses these terms with a freight / insurance amount.',
      okLabel: 'Clear the boxes',
      cancelLabel: 'Keep them',
    });
    if (!clearCharges) return;
    setInvoiceFormData((previous) => ({
      ...previous,
      ...(includesFreight && { freightValue: '', freightRate: '' }),
      ...(includesInsurance && { insuranceValue: '', insuranceRate: '' }),
    }));
  };

  const openWhen = (answer, setOpen) => (event) => {
    if (event.target.value.toUpperCase() === answer) setOpen(true);
  };

  return {
    invoiceFormData, setInvoiceFormData, handleInvoiceFieldChange, handleTermsChange, activeTerm, setActiveTerm,
    showThirdPartyDetails: isYes(invoiceFormData.thirdPartyFlag),
    showAeoDetails: isYes(invoiceFormData.aeoFlag),
    showAdditionalDetails: isYes(invoiceFormData.additionalDetailsFlag),
    handleMiscIncludedChange: openWhen('Y', setIsMiscIncludedModalOpen),
    handleMiscNotIncludedChange: openWhen('Y', setIsMiscNotIncludedModalOpen),
    handleSvbChange: openWhen('Y', setIsSvbModalOpen),
    handleOtherInfoChange: openWhen('Y', setIsOtherInfoModalOpen),
    handleConditionsChange: openWhen('Y', setIsConditionsModalOpen),
    // 'N' = the supplier is not the seller: the seller's details are asked
    handleSupplierSellerChange: openWhen('N', setIsSellerModalOpen),
    handleBrokerChange: openWhen('Y', setIsBrokerModalOpen),
    isTermsModalOpen, setIsTermsModalOpen, isMiscIncludedModalOpen, setIsMiscIncludedModalOpen,
    isMiscNotIncludedModalOpen, setIsMiscNotIncludedModalOpen, isAddressModalOpen, setIsAddressModalOpen,
    isSvbModalOpen, setIsSvbModalOpen, isOtherInfoModalOpen, setIsOtherInfoModalOpen,
    isConditionsModalOpen, setIsConditionsModalOpen, isSellerModalOpen, setIsSellerModalOpen,
    isBrokerModalOpen, setIsBrokerModalOpen,
  };
}
