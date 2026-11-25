import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useJobContext } from '../../../JobContext';
import { upsertRow } from './jobHeaderData';
import useJobRows from './useJobRows';

const FIRST_LEVEL = 'Level- 0';
const SELLER_FORM_BLANK = { autoField_40: '', autoField_41: '', autoField_42: '', autoField_43: '', autoField_44: '', autoField_45: '', autoField_60: '' };

const levelNumber = (level) => {
  const digits = String(level ?? '').match(/\d+/);
  return digits ? parseInt(digits[0], 10) : 0;
};

const nextFreeLevel = (rows) => {
  const usedLevels = new Set(rows.map((row) => levelNumber(row.precedingLevel)));
  let level = 0;
  while (usedLevels.has(level)) level += 1;
  return `Level- ${level}`;
};

// one seller per level, and the sale chain starts at Level- 0 (the seller who bought from abroad)
const levelProblem = (rows, editIndex, level) => {
  const otherRows = rows.filter((_, index) => index !== editIndex);
  const holder = otherRows.find((row) => levelNumber(row.precedingLevel) === level);
  if (holder) return `Level ${level} is already used by ${holder.importerName || 'another seller'} - give this seller the next level`;
  if (level > 0 && !otherRows.some((row) => levelNumber(row.precedingLevel) === level - 1)) return `Level ${level} needs level ${level - 1} first - the sale chain starts at Level- 0`;
  return '';
};

export default function useHighSeaSaleRows({ parties }) {
  const { jobData, setJobData } = useJobContext();
  const { rows: hssRows, editIndex: hssEditIdx, setEditIndex, saveRows, removeRow, cancelEdit } = useJobRows('_hssRows');
  const [isHighSeaSaleModalOpen, setIsHighSeaSaleModalOpen] = useState(false);

  const sellerName = jobData.autoField_40;
  const sellerParty = useMemo(() => parties.find((party) => party.name === sellerName || party.partyName === sellerName), [parties, sellerName]);
  const hssBranches = sellerParty?.branches || [];

  const handleHssBranchChange = (event) => {
    const branchSrNo = event.target.value;
    const branch = hssBranches.find((candidate) => String(candidate.branchSrNo) === String(branchSrNo));
    const address = branch ? { autoField_42: branch.address1 || '', autoField_43: branch.address2 || '', autoField_44: branch.city || '', autoField_45: branch.pinCode || '' } : {};
    setJobData((previous) => ({ ...previous, autoField_60: branchSrNo, ...address }));
  };

  const handleHssAdd = () => {
    if (!String(jobData.autoField_40 || '').trim() || !String(jobData.autoField_41 || '').trim()) { toast.error('Enter the seller Importer Name and IEC Code'); return; }
    const problem = levelProblem(hssRows, hssEditIdx, levelNumber(jobData.autoField_61));
    if (problem) { toast.error(problem); return; }
    const seller = {
      id: hssEditIdx === null ? Date.now() : hssRows[hssEditIdx].id,
      importerName: jobData.autoField_40 || '',
      iecNo: jobData.autoField_41 || '',
      branchSrNo: jobData.autoField_60 || '',
      address1: jobData.autoField_42 || '',
      address2: jobData.autoField_43 || '',
      city: jobData.autoField_44 || '',
      pin: jobData.autoField_45 || '',
      precedingLevel: jobData.autoField_61 || FIRST_LEVEL,
    };
    const updatedRows = upsertRow(hssRows, hssEditIdx, seller);
    saveRows(updatedRows, { ...SELLER_FORM_BLANK, autoField_61: nextFreeLevel(updatedRows) });
  };

  const handleHssEdit = (index) => {
    const seller = hssRows[index];
    setJobData((previous) => ({
      ...previous,
      autoField_40: seller.importerName || '',
      autoField_41: seller.iecNo || '',
      autoField_60: seller.branchSrNo || '',
      autoField_42: seller.address1 || '',
      autoField_43: seller.address2 || '',
      autoField_44: seller.city || '',
      autoField_45: seller.pin || '',
      autoField_61: seller.precedingLevel || FIRST_LEVEL,
    }));
    setEditIndex(index);
  };

  const handleHssRemove = (index) => removeRow(index, { title: 'Remove this High Sea Sale entry?', message: 'The row is taken off this job.' });

  return {
    hssRows, hssEditIdx, hssBranches, handleHssBranchChange, handleHssAdd, handleHssEdit, handleHssRemove, cancelHssEdit: cancelEdit,
    isHighSeaSaleModalOpen, setIsHighSeaSaleModalOpen,
  };
}
