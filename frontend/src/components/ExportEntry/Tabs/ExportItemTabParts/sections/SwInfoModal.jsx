import { useState } from 'react';
import { asList } from '@/utils/asList';
import { Button, ComboInput, DataTable, Input, Label, Modal, NumberInput } from '@/components/ui';
import { SB_INFO_TYPES, infoCodesOf, infoQualsOf } from '../swCodes';

const toOptions = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const TYPE_OPTIONS = toOptions(SB_INFO_TYPES);
const MAX_NEW_ROWS = 20;

// the SW info rows of the item; code suggestions from the ICES Exports message format 3.7 (other codes can be typed)
export default function SwInfoModal({ ctx }) {
  const { formData, handleFormChange, isSwInfoModalOpen, setIsSwInfoModalOpen } = ctx;
  const [newRowCount, setNewRowCount] = useState(1);
  const rows = asList(formData.swInfos);
  const close = () => setIsSwInfoModalOpen(false);

  const setCell = (index, key, value) => {
    const next = [...rows];
    next[index] = { ...next[index], [key]: value };
    handleFormChange('swInfos', next);
  };
  const addRows = () => handleFormChange('swInfos', [...rows, ...Array.from({ length: newRowCount }, () => ({ id: Date.now() + Math.random() }))]);
  const removeLastRow = () => handleFormChange('swInfos', rows.slice(0, -1));

  const comboCell = (key, optionsOf) => (row, index) => (
    <ComboInput className="tw:min-w-24" listClassName="tw:min-w-72" required options={optionsOf(row)} value={row[key] || ''} onValueChange={(value) => setCell(index, key, value)} />
  );
  const textCell = (key) => (row, index) => (
    <Input data-allow-text="" className="tw:min-w-20" value={row[key] || ''} onChange={(event) => setCell(index, key, event.target.value)} />
  );
  const columns = [
    { key: 'swInfoField1', header: 'INFO TYPE', cell: comboCell('swInfoField1', () => TYPE_OPTIONS) },
    { key: 'swInfoField2', header: 'INFO QUALIFIER', cell: comboCell('swInfoField2', (row) => toOptions(infoQualsOf(row.swInfoField1))) },
    { key: 'swInfoField3', header: 'INFO CODE', cell: comboCell('swInfoField3', (row) => toOptions(infoCodesOf(row.swInfoField1, row.swInfoField2))) },
    { key: 'swInfoField4', header: 'INFO TEXT', cell: textCell('swInfoField4') },
    { key: 'swInfoField5', header: 'INFO MSR', cell: textCell('swInfoField5') },
    { key: 'swInfoField6', header: 'INFO UQC', cell: textCell('swInfoField6') },
  ];

  return (
    <Modal
      open={isSwInfoModalOpen} title="SW Info" width={900} onClose={close}
      footer={(
        <>
          <Button variant="success" onClick={close}>Save</Button>
          <Button variant="default" onClick={() => handleFormChange('swInfos', [])}>Reset</Button>
          <Button onClick={close}>Cancel</Button>
        </>
      )}
    >
      <DataTable columns={columns} rows={rows} rowKey={(row, index) => index} emptyText="No SW info row" containerClassName="tw:max-h-[50vh] tw:rounded-sm tw:border tw:border-border" />
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <Label>No. Of Rows</Label>
        <NumberInput decimals={0} maxLength={2} className="tw:w-[50px]" value={String(newRowCount)}
          onValueChange={(count) => setNewRowCount(Math.min(MAX_NEW_ROWS, parseInt(count, 10) || 1))} />
        <Button variant="default" onClick={addRows}>+ Add Row</Button>
        <Button variant="destructive" onClick={removeLastRow}>x Remove Last Row</Button>
      </div>
    </Modal>
  );
}
