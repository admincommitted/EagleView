import { useState } from 'react';
import toast from 'react-hot-toast';

export const FORM_TARGET = 'FORM';

// open / closed state of the Items tab windows; the scheme and RITC searches fill the form or a row of the list
export default function useItemPopups({ handleFormChange, updateItem }) {
  const [isSchemeModalOpen, setIsSchemeModalOpen] = useState(false);
  const [activeItemForScheme, setActiveItemForScheme] = useState(null);
  const [schemeFilter, setSchemeFilter] = useState('');
  const [isRitcModalOpen, setIsRitcModalOpen] = useState(false);
  const [activeItemForRitc, setActiveItemForRitc] = useState(null);
  const [ritcFilter, setRitcFilter] = useState('');
  const [isSwStatementModalOpen, setIsSwStatementModalOpen] = useState(false);
  const [isSwInfoModalOpen, setIsSwInfoModalOpen] = useState(false);
  const [isReExportModalOpen, setIsReExportModalOpen] = useState(false);
  const [isESanchitModalOpen, setIsESanchitModalOpen] = useState(false);
  const [detailWindow, setDetailWindow] = useState('');
  const [ccrItem, setCcrItem] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [validationSuccess, setValidationSuccess] = useState(false);

  const openSchemeSearch = (target) => {
    setActiveItemForScheme(target);
    setIsSchemeModalOpen(true);
  };
  const openRitcSearch = (target, filter) => {
    setActiveItemForRitc(target);
    if (filter !== undefined) setRitcFilter(filter);
    setIsRitcModalOpen(true);
  };

  // compliance requirements of the RITC of an item (export policy, duty, drawback / RoDTEP rates)
  const showCcr = (item) => {
    const ritc = String(item.ritc || '').replace(/\D/g, '');
    if (ritc.length < 4) {
      toast.error('Enter the RITC first');
      return;
    }
    setCcrItem({ ritc, desc: item.desc });
  };

  const handleSchemeSelect = (schemeCode, schemeDesc) => {
    const scheme = `${schemeCode} - ${schemeDesc}`;
    if (activeItemForScheme === FORM_TARGET) handleFormChange('scheme', scheme);
    else if (activeItemForScheme !== null) updateItem(activeItemForScheme, 'scheme', scheme);
    setIsSchemeModalOpen(false);
  };

  const handleRitcSelect = (ritcCode, ritcDesc, unit) => {
    if (activeItemForRitc === FORM_TARGET) {
      handleFormChange('ritc', ritcCode);
      handleFormChange('desc', ritcDesc);
      handleFormChange('unit', unit);
      handleFormChange('rateUnit', unit);
    } else if (activeItemForRitc !== null) {
      updateItem(activeItemForRitc, 'ritc', ritcCode);
      updateItem(activeItemForRitc, 'desc', ritcDesc);
      updateItem(activeItemForRitc, 'uqc', unit);
    }
    setIsRitcModalOpen(false);
  };

  return {
    isSchemeModalOpen, setIsSchemeModalOpen, schemeFilter, setSchemeFilter, openSchemeSearch, handleSchemeSelect,
    isRitcModalOpen, setIsRitcModalOpen, ritcFilter, setRitcFilter, openRitcSearch, handleRitcSelect,
    isSwStatementModalOpen, setIsSwStatementModalOpen, isSwInfoModalOpen, setIsSwInfoModalOpen,
    isReExportModalOpen, setIsReExportModalOpen, isESanchitModalOpen, setIsESanchitModalOpen,
    detailWindow, setDetailWindow, ccrItem, setCcrItem, showCcr,
    validationErrors, setValidationErrors, validationSuccess, setValidationSuccess,
  };
}
