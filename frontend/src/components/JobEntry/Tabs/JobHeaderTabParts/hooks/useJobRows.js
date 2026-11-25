import { useEffect, useMemo, useState } from 'react';
import askConfirm from '@/components/common/askConfirm';
import { useJobContext } from '../../../JobContext';
import { rowsFrom } from './jobHeaderData';

// one grid saved with the job under `rowsKey`, plus the index of the row being edited in the form above it
export default function useJobRows(rowsKey) {
  const { setJobData, jobData } = useJobContext();
  const savedRows = jobData[rowsKey];
  const rows = useMemo(() => rowsFrom(savedRows), [savedRows]);
  const [editIndex, setEditIndex] = useState(null);

  useEffect(() => { setEditIndex(null); }, [savedRows]);

  const saveRows = (updatedRows, formFields) => {
    setJobData((previous) => ({ ...previous, ...formFields, [rowsKey]: updatedRows }));
    setEditIndex(null);
  };

  const removeRow = async (index, { title, message }) => {
    if (!(await askConfirm({ title, message, okLabel: 'Remove', cancelLabel: 'Keep', tone: 'danger' }))) return;
    saveRows(rows.filter((_, rowIndex) => rowIndex !== index));
  };

  const cancelEdit = () => setEditIndex(null);

  return { rows, editIndex, setEditIndex, saveRows, removeRow, cancelEdit };
}
