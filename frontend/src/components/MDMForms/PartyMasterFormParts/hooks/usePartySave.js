import { useState } from 'react';
import askConfirm from '@/components/common/askConfirm';
import { masterRecordsApi } from '../../masterKit/masterRecordsApi';
import { EMAIL_PATTERN } from '../partyMasterData';

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IEC_PATTERN = /^[A-Z0-9]{10}$/i;

// the party's own address / contact: the first branch in the grid, else the branch being typed, else the saved one
const mainContact = (party, addressFormData) => {
  const gridAddress = party.addresses?.[0];
  return {
    street: (gridAddress?.address1 || gridAddress?.address || addressFormData.address1 || party.street || '').toUpperCase(),
    city: (gridAddress?.city || addressFormData.city || party.city || '').toUpperCase(),
    state: (gridAddress?.state || addressFormData.state || party.stateProvince || '').toUpperCase(),
    country: (gridAddress?.country || addressFormData.country || party.countryCode || '').toUpperCase(),
    zip: (gridAddress?.zip || gridAddress?.pinCode || addressFormData.pinCode || party.zipPostcode || '').toUpperCase(),
    mobile: (gridAddress?.mobile || gridAddress?.phone || addressFormData.mobile || party.phoneNumber || '').toUpperCase(),
    email: gridAddress?.email || gridAddress?.email1 || addressFormData.email || party.email || '',
  };
};

export default function usePartySave({ formData, addressFormData, selectedParty, setSelectedParty, partiesList, setPartiesList, customAlert }) {
  const [savingParty, setSavingParty] = useState(false);

  const saveParty = async () => {
    if (savingParty) return;
    const party = selectedParty || {};
    const name = formData.name.trim().toUpperCase();
    const pan = formData.panNumber.trim().toUpperCase();
    const iec = formData.taxId.trim().toUpperCase();
    const contact = mainContact(party, addressFormData);

    if (!name) return customAlert('Party Name is mandatory!');
    if (!contact.street) return customAlert('Address is mandatory!');
    if (!contact.city) return customAlert('City is mandatory!');
    if (!contact.country || contact.country.length !== 2) return customAlert('Country Code must be exactly 2 characters (e.g., IN, US).');
    if (partiesList.some((other) => other.id !== selectedParty?.id && other.name && other.name.toUpperCase() === name)) {
      return customAlert('Duplicate Entry Blocked: A Party with this Name already exists in the Master Directory!');
    }
    if (pan && !PAN_PATTERN.test(pan)) return customAlert('PAN must be 10 characters like ABCDE1234F - error');
    if (contact.email && !EMAIL_PATTERN.test(contact.email.trim())) return customAlert('Email ID is not valid - error');
    if (formData.iecNoReqd && (!iec || iec.length !== 10 || !IEC_PATTERN.test(iec))) {
      return customAlert("IEC Number is mandatory and must be exactly 10 alphanumeric characters when 'IEC NO. REQD.' is checked!");
    }

    const payload = {
      partyType: 'MULTI',
      isShipper: formData.isShipper,
      isConsignee: formData.isConsignee,
      isNotifyParty: formData.isNotifyParty,
      isBuyer: formData.isBuyer,
      isSubAgent: formData.isSubAgent,
      isOverseasAgent: formData.isOverseasAgent,
      isShipline: !!formData.isShipline,
      isIataAgent: !!formData.isIataAgent,
      isBank: !!formData.isBank,
      name,
      code: party.code || '',
      street: contact.street.substring(0, 70),
      city: contact.city.substring(0, 17),
      stateProvince: contact.state,
      countryCode: contact.country.substring(0, 2),
      zipPostcode: contact.zip.substring(0, 9),
      phoneNumber: contact.mobile,
      email: contact.email,
      taxId: iec,
      panNumber: pan,
      kycApproved: formData.kycApproved,
      extendedName: formData.extendedName.trim(),
      mercManuf: formData.mercManuf,
      rbiNumber: formData.rbiNumber.trim(),
      marketingPerson1: formData.marketingPerson1.trim(),
      marketingPerson2: formData.marketingPerson2.trim(),
      marketingPerson3: formData.marketingPerson3.trim(),
      sezWarehouseCode: formData.sezWarehouseCode.trim(),
      iecNoReqd: formData.iecNoReqd,
      classType: formData.classType,
      paymentDeferred: formData.paymentDeferred,
      blackList: formData.blackList,
      insuranceRate: formData.insuranceRate.trim(),
      remarks: formData.remarks.trim(),
      aiImportRules: formData.aiImportRules || '',
      aiExportRules: formData.aiExportRules || '',
      branches: party.addresses || [],
      adCodes: party.adCodes || [],
      drawbackAccounts: party.drawbackAccounts || [],
    };

    setSavingParty(true);
    try {
      const data = selectedParty?.id
        ? await masterRecordsApi.update('parties', selectedParty.id, payload)
        : await masterRecordsApi.create('parties', payload);
      if (!data.success && !data.id) {
        customAlert(`API ERROR: ${data.error || 'Failed to save'}`);
        return;
      }
      customAlert(`SUCCESS: Party Data ${selectedParty?.id ? 'Updated' : 'Saved'}!`);
      if (selectedParty?.id) {
        setPartiesList((list) => list.map((item) => (item.id === selectedParty.id ? { ...item, ...payload, addresses: payload.branches } : item)));
      } else {
        const saved = data.data || data;
        const created = { ...saved, id: data.data?.id || data.id || Math.random(), addresses: party.addresses || [] };
        setPartiesList((list) => [created, ...list]);
        setSelectedParty(created);
      }
    } catch (error) {
      console.error(error);
      customAlert(error.response ? `API ERROR: ${error.response.data?.error || 'Failed to save'}` : 'NETWORK ERROR: Could not reach the server.');
    } finally {
      setSavingParty(false);
    }
  };

  const deleteParty = async () => {
    if (!selectedParty?.id) return customAlert('Please select a Party to delete.');
    const partyId = selectedParty.id;
    const confirmed = await askConfirm({
      title: 'Confirm deletion',
      message: 'Are you sure you want to delete this Party from the Master Database? This action cannot be undone.',
      okLabel: 'Yes, delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      const data = await masterRecordsApi.remove('parties', partyId);
      if (!data.success && !data.message) {
        customAlert(`FAILED TO DELETE: ${data.error || 'Unknown Error'}`);
        return;
      }
      customAlert('PARTY DELETED SUCCESSFULLY');
      setPartiesList((list) => list.filter((item) => item.id !== partyId));
      setSelectedParty(null);
    } catch (error) {
      customAlert(error.response ? `FAILED TO DELETE: ${error.response.data?.error || 'Unknown Error'}` : 'NETWORK ERROR DURING DELETE');
    }
  };

  return { savingParty, saveParty, deleteParty };
}
