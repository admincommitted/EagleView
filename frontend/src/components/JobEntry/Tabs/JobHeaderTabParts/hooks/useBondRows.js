import { useState } from 'react';
import toast from 'react-hot-toast';
import { useJobContext } from '../../../JobContext';
import { upsertRow } from './jobHeaderData';
import useJobRows from './useJobRows';

const BOND_FORM_BLANK = { autoField_24: '', autoField_25: '', autoField_26: '', autoField_27: '' };

export default function useBondRows() {
  const { jobData, setJobData } = useJobContext();
  const { rows: bondRows, editIndex: bondEditIdx, setEditIndex, saveRows, removeRow, cancelEdit } = useJobRows('_bondRows');
  const [isBondModalOpen, setIsBondModalOpen] = useState(false);
  const [isBondCodeSearchOpen, setIsBondCodeSearchOpen] = useState(false);
  const [isBondPortSearchOpen, setIsBondPortSearchOpen] = useState(false);

  const handleBondAdd = () => {
    const bondNo = String(jobData.autoField_24 || '').trim();
    if (!bondNo) { toast.error('Enter the Bond No'); return; }
    if (bondEditIdx === null && bondRows.some((row) => String(row.bondNo) === bondNo)) { toast.error(`Bond ${jobData.autoField_24} is already added`); return; }
    const bond = {
      id: bondEditIdx === null ? Date.now() : bondRows[bondEditIdx].id,
      bondNo,
      bondAmt: jobData.autoField_25 || '',
      bondCode: String(jobData.autoField_26 || '').toUpperCase(),
      bondPort: String(jobData.autoField_27 || '').toUpperCase(),
    };
    saveRows(upsertRow(bondRows, bondEditIdx, bond), BOND_FORM_BLANK);
  };

  const handleBondEdit = (index) => {
    const bond = bondRows[index];
    setJobData((previous) => ({ ...previous, autoField_24: bond.bondNo, autoField_25: bond.bondAmt, autoField_26: bond.bondCode, autoField_27: bond.bondPort }));
    setEditIndex(index);
  };

  const handleBondRemove = (index) => removeRow(index, { title: 'Remove this bond?', message: 'The bond row is taken off this job.' });

  return {
    bondRows, bondEditIdx, handleBondAdd, handleBondEdit, handleBondRemove, cancelBondEdit: cancelEdit,
    isBondModalOpen, setIsBondModalOpen, isBondCodeSearchOpen, setIsBondCodeSearchOpen, isBondPortSearchOpen, setIsBondPortSearchOpen,
  };
}
