import { useState } from 'react';
import { EMPTY_AD_CODE, EMPTY_DRAWBACK } from '../partyMasterData';

// AD codes and drawback accounts are kept on the selected party until the party is saved
export default function useBankAccounts({ formData, selectedParty, setSelectedParty }) {
  const [adCodeFormData, setAdCodeFormData] = useState(EMPTY_AD_CODE);
  const [drawbackFormData, setDrawbackFormData] = useState(EMPTY_DRAWBACK);

  const setAdCodeField = (name, value) => setAdCodeFormData((current) => ({ ...current, [name]: value }));
  const setDrawbackField = (name, value) => setDrawbackFormData((current) => ({ ...current, [name]: value }));

  const changeList = (listKey, change) => setSelectedParty({ ...selectedParty, ...formData, [listKey]: change(selectedParty[listKey] || []) });

  const addAdCode = () => {
    if (!selectedParty) return;
    changeList('adCodes', (list) => [...list, { ...adCodeFormData }]);
    setAdCodeFormData(EMPTY_AD_CODE);
  };
  const addDrawback = () => {
    if (!selectedParty) return;
    changeList('drawbackAccounts', (list) => [...list, { ...drawbackFormData }]);
    setDrawbackFormData(EMPTY_DRAWBACK);
  };
  const removeAdCode = (index) => changeList('adCodes', (list) => list.filter((_, position) => position !== index));
  const removeDrawback = (index) => changeList('drawbackAccounts', (list) => list.filter((_, position) => position !== index));

  return { adCodeFormData, setAdCodeField, addAdCode, removeAdCode, drawbackFormData, setDrawbackField, addDrawback, removeDrawback };
}
