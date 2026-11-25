import { useState } from 'react';
import askConfirm from '@/components/common/askConfirm';
import { GSTIN_PATTERN } from '../dgftMatch';
import { EMAIL_PATTERN, withOneDefault } from '../partyMasterData';

const UPPER_CASE_KEYS = ['address1', 'address2', 'city', 'regNo', 'tanNo', 'branchName'];
const TAX_CODE = /^\d{1,2}$/;

const sameText = (first, second) => first.trim().toLowerCase() === second.trim().toLowerCase();

// the problem that stops the branch from going into the grid, or ''
const addressProblem = (address) => {
  if (!address.address1) return 'Address Line 1 is mandatory - error';
  if (!address.city) return 'City is mandatory - error';
  if (address.country === 'IN' && address.pinCode && !/^\d{6}$/.test(String(address.pinCode).trim())) return 'PIN code must be 6 digits for India - error';
  if (address.ctxType === 'GSTIN' && address.regNo) {
    if (!GSTIN_PATTERN.test(address.regNo)) return 'GSTIN must be 15 characters like 27ABCDE1234F1Z5 - error';
    if (address.ctxCode && address.regNo.slice(0, 2) !== String(address.ctxCode).padStart(2, '0')) return 'GSTIN first 2 digits do not match the CTX state code - error';
  }
  if (address.email && !EMAIL_PATTERN.test(String(address.email).trim())) return 'Email ID 1 is not valid - error';
  return '';
};

export default function useBranchAddresses({ formData, globalLocations, selectedParty, setSelectedParty, customAlert }) {
  const [addressFormData, setAddressFormData] = useState({});
  const addresses = selectedParty?.addresses || [];

  const setAddressField = (name, value) => setAddressFormData((current) => ({ ...current, [name]: value }));
  const statesOf = (country) => globalLocations.find((location) => location.code === country)?.states || [];

  // the CTX state CODE is not stored in PartyBranches, so it is worked out: from the GSTIN (first 2 digits), else from
  // the CTX state in the location master (the entry with a numeric tax code wins)
  const taxCodeOf = (country, stateName) => {
    const hits = statesOf(country || 'IN').filter((state) => String(state.stateName || '').toUpperCase() === String(stateName || '').toUpperCase());
    const hit = hits.find((state) => TAX_CODE.test(String(state.taxCode || ''))) || hits[0];
    if (!hit) return '';
    return TAX_CODE.test(String(hit.taxCode || '')) ? String(hit.taxCode).padStart(2, '0') : (hit.stateCode || '');
  };

  const withCtxCode = (address) => {
    if (address.ctxCode) return address;
    const gstin = String(address.regNo || address.gstin || '').trim().toUpperCase();
    if (address.ctxType === 'GSTIN' && GSTIN_PATTERN.test(gstin)) return { ...address, ctxCode: gstin.slice(0, 2) };
    const code = address.ctxState ? taxCodeOf(address.country, address.ctxState) : '';
    return code ? { ...address, ctxCode: code } : address;
  };

  const editAddress = (address) => setAddressFormData(withCtxCode(address));
  const setAddressCountry = (country) => setAddressFormData((current) => ({ ...current, country, state: '', ctxState: '' }));
  const setAddressCtxState = (stateName) => setAddressFormData((current) => ({
    ...current, ctxState: stateName, ctxCode: stateName ? taxCodeOf(current.country, stateName) : '',
  }));
  const isIndia = (addressFormData.country || 'IN') === 'IN';
  const setAddressPin = (text) => setAddressField('pinCode', isIndia ? text.replace(/\D/g, '') : text);

  const saveAddress = () => {
    const address = { ...addressFormData };
    UPPER_CASE_KEYS.forEach((key) => {
      if (typeof address[key] === 'string') address[key] = address[key].trim().toUpperCase();
    });
    const problem = addressProblem(address);
    if (problem) return customAlert(problem);
    address.email1 = address.email || '';
    address.zip = address.pinCode || '';
    address.gstin = address.regNo || '';
    address.isDefault = !!address.default;

    // one GSTIN can have many places of business (DGFT lists them), so only the same Address1 is a duplicate
    const isDuplicate = addresses.some((other) => other.branchSrNo !== address.branchSrNo && other.address1 && sameText(other.address1, address.address1));
    if (isDuplicate) return customAlert('Duplicate Entry Blocked: this Address1 already exists in the grid!');

    if (!address.branchSrNo) address.branchSrNo = String(addresses.length + 1);
    const existingIndex = addresses.findIndex((other) => other.branchSrNo === address.branchSrNo);
    let nextAddresses = [...addresses];
    if (existingIndex >= 0) nextAddresses[existingIndex] = address;
    else nextAddresses.push(address);
    if (address.default) nextAddresses = nextAddresses.map((other) => (other === address ? other : { ...other, default: false, isDefault: false }));

    setSelectedParty((current) => ({ ...(current || {}), ...formData, addresses: withOneDefault(nextAddresses) }));
    setAddressFormData({});
  };

  const deleteAddress = async (index) => {
    const confirmed = await askConfirm({
      title: 'Confirm deletion',
      message: 'Are you sure you want to delete this Address? This action cannot be undone.',
      okLabel: 'Yes, delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) return;
    setSelectedParty((current) => ({ ...current, ...formData, addresses: (current.addresses || []).filter((_, position) => position !== index) }));
  };

  const makeDefaultAddress = (index) => setSelectedParty((current) => ({
    ...(current || {}),
    ...formData,
    addresses: (current?.addresses || []).map((address, position) => ({ ...address, default: position === index, isDefault: position === index })),
  }));

  return {
    addressFormData, setAddressField, setAddressCountry, setAddressCtxState, setAddressPin, isIndia, statesOf,
    isEditingAddress: addresses.some((address) => address.branchSrNo === addressFormData.branchSrNo),
    editAddress, saveAddress, deleteAddress, makeDefaultAddress,
  };
}
