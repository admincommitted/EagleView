import { removeColumn } from '../../JobHeaderTabParts/sections/rowActionColumns';
import { AddButton, EntryGridModal } from './ItemPopupFields';
import { textColumns, uqcCombo } from './itemPopupConfig';

const SW_CONST_BOXES = [
  { key: 'srNo', label: 'Const. Sr No', required: true },
  { key: 'name', label: 'Element Name', required: true },
  { key: 'code', label: 'Element Code', required: true },
  { key: 'percent', label: 'Const. %' },
  { key: 'yield', label: 'Const. Yield %' },
  { key: 'active', label: 'Active Ingredient', kind: 'select', options: ['Y', 'N'] },
];

const SW_CONST_COLUMNS = textColumns({
  srNo: 'Const. Sr No', name: 'Element Name', code: 'Element Code', percent: 'Const. %', yield: 'Const. Yield %', active: 'Active Ingredient',
});

const SW_PRODUCTION_COLUMNS = textColumns({
  batch: 'Batch Identifier', qty: 'Batch Quantity', uqc: 'UQC', mnfDate: 'Date of Mnf', expDate: 'Date of Expiry', bestBefore: 'Best Before',
});

function SwConstModal({ ctx }) {
  const { showSwConstModal, setShowSwConstModal, swConstForm, setSwConstForm, addSwConstRow, tempSwConstData, removeSwConstRow, saveSwConstModal } = ctx;
  return (
    <EntryGridModal
      open={showSwConstModal} title="SW Const" width={900}
      onClose={() => setShowSwConstModal(false)} onOk={saveSwConstModal}
      boxes={SW_CONST_BOXES} values={swConstForm} onChange={(key, value) => setSwConstForm({ ...swConstForm, [key]: value })}
      boxesClassName="tw:grid-cols-2 tw:md:grid-cols-6"
      actions={<AddButton variant="success" label="ADD" onClick={addSwConstRow} />}
      columns={[removeColumn((index, row) => removeSwConstRow(row.id)), ...SW_CONST_COLUMNS]}
      rows={tempSwConstData} emptyText="No Data Added"
    />
  );
}

function SwProductionModal({ ctx }) {
  const {
    showSwProductionModal, setShowSwProductionModal, swProdForm, setSwProdForm, addSwProdRow, tempSwProdData, removeSwProdRow,
    saveSwProductionModal, masters,
  } = ctx;
  const boxes = [
    { key: 'batch', label: 'Batch Identifier', required: true },
    { key: 'qty', label: 'Batch Quantity', required: true, kind: 'number' },
    { key: 'uqc', label: 'UQC', required: true, ...uqcCombo(masters) },
    { key: 'mnfDate', label: 'Date of Mnf', required: true },
    { key: 'expDate', label: 'Date of Expiry', required: true },
    { key: 'bestBefore', label: 'Best Before', required: true },
  ];
  return (
    <EntryGridModal
      open={showSwProductionModal} title="Single Window Production Details" width={1000}
      onClose={() => setShowSwProductionModal(false)} onOk={saveSwProductionModal}
      boxes={boxes} values={swProdForm} onChange={(key, value) => setSwProdForm({ ...swProdForm, [key]: value })}
      boxesClassName="tw:grid-cols-2 tw:md:grid-cols-6"
      actions={<AddButton variant="success" label="ADD" onClick={addSwProdRow} />}
      columns={[removeColumn((index, row) => removeSwProdRow(row.id)), ...SW_PRODUCTION_COLUMNS]}
      rows={tempSwProdData} emptyText="No Data Added"
    />
  );
}

export default function SwConstSection({ ctx }) {
  return (
    <>
      <SwConstModal ctx={ctx} />
      <SwProductionModal ctx={ctx} />
    </>
  );
}
