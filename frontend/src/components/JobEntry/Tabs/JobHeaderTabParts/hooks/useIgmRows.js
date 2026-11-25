import toast from 'react-hot-toast';
import { useJobContext } from '../../../JobContext';
import { upsertRow } from './jobHeaderData';
import useJobRows from './useJobRows';

// every key an IGM box reads, the alias keys included
const IGM_FORM_BLANK = {
  igmNumber: '', igmNo: '', igmDate: '', autoField_14: '', mawbNo: '', mawbblNo: '', mawbDate: '', autoField_15: '', hawbNo: '', hawbhblNo: '', hawbDate: '', autoField_16: '',
  inwardDate: '', autoField_17: '', totalPkg: '', pkg: '', grossWt: '', grossWtUnit: '', marksAndNumbers1: '', marks1: '', lineNo: '',
};

const igmRowFromForm = (form) => ({
  igmNumber: String(form.igmNumber || form.igmNo || '').trim(),
  igmDate: form.igmDate || form.autoField_14 || '',
  mawbNo: String(form.mawbNo || form.mawbblNo || '').trim().toUpperCase(),
  mawbDate: form.mawbDate || form.autoField_15 || '',
  hawbNo: String(form.hawbNo || form.hawbhblNo || '').trim().toUpperCase(),
  hawbDate: form.hawbDate || form.autoField_16 || '',
  inwardDate: form.inwardDate || form.autoField_17 || '',
  totalPkg: form.totalPkg || '',
  pkgCode: String(form.pkg || '').toUpperCase(),
  grossWt: form.grossWt || '',
  wtUnit: String(form.grossWtUnit || '').toUpperCase(),
  marks1: form.marksAndNumbers1 || form.marks1 || '',
  lineNo: form.lineNo || '',
});

const igmFormFromRow = (row) => ({
  ...IGM_FORM_BLANK,
  igmNumber: row.igmNumber || row.igmNo || '',
  igmDate: row.igmDate || '', autoField_14: row.igmDate || '',
  mawbNo: row.mawbNo || '', mawbDate: row.mawbDate || '', autoField_15: row.mawbDate || '',
  hawbNo: row.hawbNo || '', hawbDate: row.hawbDate || '', autoField_16: row.hawbDate || '',
  inwardDate: row.inwardDate || '', autoField_17: row.inwardDate || '',
  totalPkg: row.totalPkg || '', pkg: row.pkgCode || '',
  grossWt: row.grossWt || '', grossWtUnit: row.wtUnit || '',
  marksAndNumbers1: row.marks1 || '', marks1: row.marks1 || '', lineNo: row.lineNo || '',
});

const comparable = (value) => String(value ?? '').trim().toUpperCase();
const igmRowKey = (row) => [row.igmNumber || row.igmNo, row.mawbNo, row.hawbNo].map((part) => String(part || '').trim().toUpperCase()).join('|');
const hasIgmReference = (row) => Boolean(row.igmNumber || row.mawbNo || row.hawbNo);
const differsFromForm = (row, formRow) => Object.keys(formRow).some((key) => comparable(row[key]) !== comparable(formRow[key]));

export default function useIgmRows() {
  const { jobData, setJobData } = useJobContext();
  const { rows: igmRows, editIndex: igmEditIdx, setEditIndex, saveRows, removeRow, cancelEdit } = useJobRows('_igmRows');

  const hasPendingIgmForm = () => {
    const formRow = igmRowFromForm(jobData);
    if (!hasIgmReference(formRow)) return false;
    const sameRow = igmRows.find((row) => igmRowKey(row) === igmRowKey(formRow));
    return !sameRow || differsFromForm(sameRow, formRow);
  };

  const handleAddIgmRow = () => {
    const formRow = igmRowFromForm(jobData);
    if (!hasIgmReference(formRow)) { toast.error('Enter IGM No or MAWB/HAWB No before Add'); return undefined; }
    const sameIndex = igmRows.findIndex((row, index) => index !== igmEditIdx && igmRowKey(row) === igmRowKey(formRow));
    if (sameIndex !== -1 && igmEditIdx !== null) { toast.error('This IGM / MAWB / HAWB is already in the grid'); return undefined; }
    // a row with the same IGM / MAWB / HAWB is updated in place: never a second row for the same IGM
    const targetIndex = igmEditIdx ?? (sameIndex === -1 ? null : sameIndex);
    if (targetIndex !== null && igmEditIdx === null) toast(`IGM row ${targetIndex + 1} updated with the form values`, { icon: 'ℹ️' });
    // an update keeps the row's other keys (e.g. marks2 / marks3 read from a file)
    const row = targetIndex === null ? { id: Date.now(), ...formRow } : { ...igmRows[targetIndex], ...formRow, igmNo: formRow.igmNumber };
    const updatedRows = upsertRow(igmRows, targetIndex, row);
    saveRows(updatedRows);
    return updatedRows;
  };

  const handleClearIgmRow = () => {
    setJobData((previous) => ({ ...previous, ...IGM_FORM_BLANK }));
    cancelEdit();
  };

  const handleEditIgmRow = (index) => {
    const row = igmRows[index];
    setJobData((previous) => ({ ...previous, ...igmFormFromRow(row) }));
    setEditIndex(index);
  };

  const handleRemoveIgmRow = (index) => removeRow(index, { title: 'Remove this IGM row?', message: 'The IGM / MAWB / HAWB row is taken off this job.' });

  return { igmRows, igmEditIdx, handleAddIgmRow, handleClearIgmRow, handleEditIgmRow, handleRemoveIgmRow, hasPendingIgmForm, cancelIgmEdit: cancelEdit };
}
