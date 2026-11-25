import { useEffect, useState } from 'react';
import { EMPTY_PARTY_FORM, formFromParty } from './partyMasterData';
import usePartySearch from './hooks/usePartySearch';
import useBranchAddresses from './hooks/useBranchAddresses';
import useBankAccounts from './hooks/useBankAccounts';
import useDgftFill from './hooks/useDgftFill';
import usePartySave from './hooks/usePartySave';

const CLOSED_MESSAGE = { isOpen: false, title: '', message: '', type: 'success' };

const messageKind = (text) => {
  const lower = text.toLowerCase();
  if (lower.includes('duplicate') || lower.includes('mandatory') || lower.includes('error')) return { title: 'VALIDATION ERROR', type: 'error' };
  if (lower.includes('success')) return { title: 'SUCCESS', type: 'success' };
  return { title: 'INFORMATION', type: 'success' };
};

export default function usePartyMasterForm() {
  const [uiModal, setUiModal] = useState(CLOSED_MESSAGE);
  const customAlert = (text) => {
    const message = String(text ?? '');
    setUiModal({ isOpen: true, message, ...messageKind(message) });
  };
  const closeMessage = () => setUiModal((current) => ({ ...current, isOpen: false }));

  const [selectedParty, setSelectedParty] = useState(null);
  const [formData, setFormData] = useState(EMPTY_PARTY_FORM);
  const [activeTab, setActiveTab] = useState('details');
  const [showKycVault, setShowKycVault] = useState(false);

  // every change of the selected party (pick, grid change, save) reloads the form from it; the grid changes merge the
  // form in first, so typed values stay
  useEffect(() => {
    setFormData(selectedParty ? formFromParty(selectedParty) : EMPTY_PARTY_FORM);
  }, [selectedParty]);

  const setFormField = (name, value) => setFormData((current) => ({ ...current, [name]: value }));

  const setKycApproved = (approved) => {
    setFormField('kycApproved', approved);
    if (approved) customAlert('KYC marked as APPROVED! Make sure documents are uploaded in the Vault.');
  };

  const openKycVault = () => {
    if (!selectedParty?.id) return customAlert('Please select or save a Party first before uploading KYC documents.');
    setShowKycVault(true);
  };

  const search = usePartySearch({ setSelectedParty });
  const partyContext = { formData, setFormData, selectedParty, setSelectedParty, customAlert };
  const addressBook = useBranchAddresses({ ...partyContext, globalLocations: search.globalLocations });
  const bankAccounts = useBankAccounts(partyContext);
  const dgft = useDgftFill(partyContext);
  const saving = usePartySave({ ...partyContext, addressFormData: addressBook.addressFormData, partiesList: search.partiesList, setPartiesList: search.setPartiesList });

  return {
    ...search, ...addressBook, ...bankAccounts, ...dgft, ...saving,
    uiModal, closeMessage, customAlert,
    selectedParty, setSelectedParty, formData, setFormField,
    activeTab, setActiveTab, setKycApproved,
    showKycVault, setShowKycVault, openKycVault,
  };
}
