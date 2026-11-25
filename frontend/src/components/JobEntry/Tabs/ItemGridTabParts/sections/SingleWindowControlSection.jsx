import { CheckSquare, FileSpreadsheet } from 'lucide-react';
import { Button, FileButton } from '@/components/ui';
import { editColumn, removeColumn } from '../../JobHeaderTabParts/sections/rowActionColumns';
import { AddButton, EntryGridModal } from './ItemPopupFields';
import { textColumns } from './itemPopupConfig';

const toIcegateCode = (text) => text.toUpperCase().replace(/\s/g, '');
const withoutPlaceholder = (value) => (value === 'Select' ? '' : value || '');

// ICEGATE wants the control type CODE (max 17 characters), not its name.
const SW_CONTROL_TYPE_CODES = [
  { value: 'SEC65', label: 'Section 65 - manufacture / operation in warehouse' },
  { value: 'SEZ', label: 'SEZ' },
];

const SW_CONTROL_BOXES = [
  {
    key: 'typeCode', label: 'Type Code', required: true, kind: 'combo', options: SW_CONTROL_TYPE_CODES,
    placeholder: 'code e.g. SEC65', maxLength: 17, clean: toIcegateCode,
  },
  { key: 'location', label: 'Location', required: true },
  { key: 'startDate', label: 'Start Date' },
  { key: 'endDate', label: 'End Date' },
  { key: 'resultCode', label: 'Result Code' },
  { key: 'resultText', label: 'Result Text' },
  { key: 'slNo', label: 'Sr No', kind: 'number', decimals: 0, hint: 'Ex-bond BE: the control serial of the warehouse BE (empty = 1, 2, 3 ...)' },
];

const SW_CONTROL_COLUMNS = [
  ...textColumns({ typeCode: 'Type Code', location: 'Location', startDate: 'Start Date', endDate: 'End Date', resultCode: 'Result Code', resultText: 'Result Text' }),
  { key: 'slNo', header: 'Sr No', cell: (row) => row.slNo || row.controlSlNo || '' },
];

// the grid scrolls: an ex-bond item can carry hundreds of control rows
const SW_CONTROL_GRID_CLASS = 'tw:max-h-[45vh]';

const SW_CONTROL_EXCEL_HINT = "Sheet SW_Control of the Job Excel (or iCAFFE's ImportExcel): Inv Sr No, Item Sr No, Control Type, Control Location, "
  + 'Start Date, End Date, Result Code, Result Text, Control Sr No - this item\'s rows are added';

// Statement type codes are DEC / UTG / REM; older rows carry the names.
const STATEMENT_TYPE_BY_NAME = { DECLARATION: 'DEC', UNDERTAKING: 'UTG' };

const SW_STATEMENT_TYPES = [
  { value: 'Select', label: 'Select' },
  { value: 'DEC', label: 'DEC | Declaration' },
  { value: 'UTG', label: 'UTG | Undertaking' },
  { value: 'REM', label: 'REM | Remark (text needed)' },
];

const SW_STATEMENT_CODES = [
  { value: 'AQ000', label: 'Declaration in respect of all animals and livestock products' },
  { value: 'AQ001', label: 'Undertaking in case of import of live-stock products for trading/marketing' },
  { value: 'CUG00', label: 'General Declaration - I' },
  { value: 'CUG01', label: 'General Declaration - II' },
  ...['CUV01', 'CUV02', 'CUV03', 'PC002'].map((code) => ({ value: code, label: '' })),
];

const SW_STATEMENT_BOXES = [
  { key: 'typeCode', label: 'Type Code', required: true, kind: 'select', options: SW_STATEMENT_TYPES },
  {
    key: 'stmtCode', label: 'Statement Code', kind: 'combo', options: SW_STATEMENT_CODES,
    placeholder: 'e.g. PC002', maxLength: 7, clean: toIcegateCode,
  },
  { key: 'stmtText', label: 'Statement Text' },
  { key: 'stmtFor', label: 'Statement For', kind: 'select', options: ['Select', 'BE', 'Invoice', 'Item'] },
];

const SW_STATEMENT_COLUMNS = textColumns({ typeCode: 'Type Code', stmtCode: 'Statement Code', stmtText: 'Statement Text', stmtFor: 'Statement For' });

function ModalFooter({ applyLabel, applyTitle, onApply, onOk, onCancel }) {
  return (
    <>
      <Button variant="default" title={applyTitle} onClick={onApply}><CheckSquare /> {applyLabel}</Button>
      <Button variant="success" onClick={onOk}><CheckSquare /> Ok</Button>
      <Button onClick={onCancel}>Cancel</Button>
    </>
  );
}

function SwControlModal({ ctx }) {
  const {
    showSwControlModal, setShowSwControlModal, swCtrlForm, setSwCtrlForm, addSwCtrlRow, tempSwCtrlData, removeSwCtrlRow,
    importSwCtrlExcel, applySwControlToAll, saveSwControlModal,
  } = ctx;
  const close = () => setShowSwControlModal(false);
  const editRow = (index, row) => {
    setSwCtrlForm({
      typeCode: row.typeCode || '', location: row.location || '', startDate: row.startDate || '', endDate: row.endDate || '',
      resultCode: row.resultCode || '', resultText: row.resultText || '', slNo: row.slNo || row.controlSlNo || '',
    });
    removeSwCtrlRow(row.id);
  };
  return (
    <EntryGridModal
      open={showSwControlModal} title="Single Window Control Information" width={1000} onClose={close}
      footer={(
        <ModalFooter applyLabel="Apply to All Items" applyTitle="Put these control rows on every item of the job. Each item keeps its own CTH and Item Sr No."
          onApply={applySwControlToAll} onOk={saveSwControlModal} onCancel={close} />
      )}
      boxes={SW_CONTROL_BOXES} values={{ ...swCtrlForm, typeCode: withoutPlaceholder(swCtrlForm.typeCode) }}
      onChange={(key, value) => setSwCtrlForm({ ...swCtrlForm, [key]: value })}
      boxesClassName="tw:grid-cols-2 tw:md:grid-cols-[repeat(6,1fr)_0.6fr]"
      actions={(
        <>
          <FileButton variant="success" accept=".xlsx,.xls,.csv" title={SW_CONTROL_EXCEL_HINT} onFiles={(files) => importSwCtrlExcel(files[0])}>
            <FileSpreadsheet /> Import from Excel
          </FileButton>
          <AddButton variant="success" label="ADD" onClick={addSwCtrlRow} />
        </>
      )}
      columns={[removeColumn((index, row) => removeSwCtrlRow(row.id)), editColumn(editRow), ...SW_CONTROL_COLUMNS]}
      rows={tempSwCtrlData} emptyText="No Data Added" gridClassName={SW_CONTROL_GRID_CLASS}
    />
  );
}

function SwStatementModal({ ctx }) {
  const {
    showSwStatementModal, setShowSwStatementModal, swStmtForm, setSwStmtForm, addSwStmtRow, tempSwStmtData, removeSwStmtRow,
    applySwStatementToAll, saveSwStatementModal,
  } = ctx;
  const close = () => setShowSwStatementModal(false);
  const shownTypeCode = STATEMENT_TYPE_BY_NAME[String(swStmtForm.typeCode || '').toUpperCase()] || swStmtForm.typeCode;
  return (
    <EntryGridModal
      open={showSwStatementModal} title="Single Window Statement" width={900} onClose={close}
      footer={<ModalFooter applyLabel="Apply to All in Invoice" onApply={applySwStatementToAll} onOk={saveSwStatementModal} onCancel={close} />}
      boxes={SW_STATEMENT_BOXES} values={{ ...swStmtForm, typeCode: shownTypeCode, stmtCode: withoutPlaceholder(swStmtForm.stmtCode) }}
      onChange={(key, value) => setSwStmtForm({ ...swStmtForm, [key]: value })}
      boxesClassName="tw:sm:grid-cols-2 tw:md:grid-cols-[1fr_2fr_1fr_1fr]"
      actions={<AddButton variant="success" label="ADD" onClick={addSwStmtRow} />}
      columns={[removeColumn((index, row) => removeSwStmtRow(row.id)), ...SW_STATEMENT_COLUMNS]}
      rows={tempSwStmtData} emptyText="No Data Added"
    />
  );
}

export default function SingleWindowControlSection({ ctx }) {
  return (
    <>
      <SwControlModal ctx={ctx} />
      <SwStatementModal ctx={ctx} />
    </>
  );
}
