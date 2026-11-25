import { CheckSquare } from 'lucide-react';
import { Button, DataTable, Field, Input, Modal } from '@/components/ui';
import { removeColumn } from '../../JobHeaderTabParts/sections/rowActionColumns';
import { AddButton, EntryGridModal } from './ItemPopupFields';
import { textColumns, uqcCombo } from './itemPopupConfig';

const SCHEME_SEARCH_ROWS = [
  { code: '00', desc: 'FREE SHIPPING BILL INVOLING REMITTAN...' },
  { code: '01', desc: 'ADVANCE LICENCE WITH ACTUAL USER C...' },
  { code: '02', desc: 'ADVANCE LICENCE FOR INTERMEDIATE S...' },
  { code: '03', desc: 'ADVANCE LICENCE' },
  { code: '04', desc: 'ADVANCE RELEASE ORDER' },
  { code: '05', desc: 'ADVANCE LICENCE FOR DEEMED EXPORTS' },
  { code: '06', desc: 'DEPB POST EXPORT' },
  { code: '07', desc: 'DEPB-PRE EXPORTS' },
  { code: '08', desc: 'REPLENISHMENT LICENCE' },
  { code: '09', desc: 'DIAMOND IMPREST LICENCE' },
  { code: '10', desc: 'BULK LICENCE' },
  { code: '11', desc: 'Concessional DUTY EPCG SCHEME' },
  { code: '12', desc: 'ZERO DUTY EPCG SCHEME' },
];

const SCHEME_SEARCH_COLUMNS = [
  { key: 'tick', header: '', width: 30, align: 'center', cell: () => <CheckSquare className="tw:size-3.5 tw:text-success" /> },
  { key: 'code', header: 'SCHEME_CODE', width: 100 },
  { key: 'desc', header: 'SCHEME_DESC' },
];

const SELECT = { value: 'Select', label: 'Select' };

const SW_INFO_TYPES = [
  SELECT,
  { value: 'IDT', label: 'IDT | Item Identification' },
  { value: 'CHR', label: 'CHR | Item Characteristics' },
  { value: 'CTG', label: 'CTG | Item Category' },
  { value: 'PNM', label: 'PNM | Product Name' },
  { value: 'PEC', label: 'PEC | PGA Exception category' },
  { value: 'ORC', label: 'ORC | Origin Criteria' },
  { value: 'DTY', label: 'DTY | DUTY' },
  { value: 'OTH', label: 'OTH | OTHERS' },
  { value: 'SEZ', label: 'SEZ | SEZ' },
  { value: 'SIU', label: 'SIU | SIMS (AI/Excel)' },
];

const isSimsType = (type) => type === 'PNM' || type === 'SIU';

function swInfoQualifiers(type) {
  if (type === 'CHR') {
    return [SELECT, { value: 'CCDC', label: 'CCDC | CCDC' }, { value: 'SGD', label: 'SGD | SGD' }, { value: 'SQC', label: 'SQC | Standard UQC' }];
  }
  if (isSimsType(type)) return [SELECT, { value: 'SIU', label: 'SIU | SIMS Unique reference number' }];
  return [SELECT];
}

function swInfoCodes(type) {
  if (!isSimsType(type)) return [SELECT];
  return [SELECT, ...['SIUNAF', 'SIUNAPL', 'SIUNRR'].map((code) => ({ value: code, label: `${code} ||${code}` }))];
}

const SW_INFO_COLUMNS = textColumns({
  agency: 'Agency', type: 'Info Type', qualifier: 'Info Qualifier', code: 'Info Code', text: 'Info Text', qty: 'Info Qty.', uqc: 'Info UQC',
});

function SchemeCategoryModal({ ctx }) {
  const {
    showSchemeCategoryModal, setShowSchemeCategoryModal, schemeCatForm, setSchemeCatForm, addSchemeCatRow,
    tempSchemeCatData, removeSchemeCatRow, saveSchemeCategoryModal, setShowSchemeSearchModal, masters,
  } = ctx;
  const boxes = [
    { key: 'ritc', label: 'RITC' },
    {
      key: 'schemeCode', label: 'Scheme Code', required: true, kind: 'combo', options: masters.schemeCodes || [],
      getOptionValue: (scheme) => scheme.code, getOptionLabel: (scheme) => scheme.desc, onSearch: () => setShowSchemeSearchModal(true),
    },
    { key: 'licenseNo', label: 'License No' },
    { key: 'date', label: 'Date', kind: 'date' },
  ];
  const columns = [
    ...textColumns({ ritc: 'RITC', schemeCode: 'Scheme Code', licenseNo: 'License No', date: 'Date' }),
    removeColumn((index, row) => removeSchemeCatRow(row.id)),
  ];
  return (
    <EntryGridModal
      open={showSchemeCategoryModal} title="Scheme Code Category" width={600}
      onClose={() => setShowSchemeCategoryModal(false)} onOk={saveSchemeCategoryModal}
      boxes={boxes} values={schemeCatForm} onChange={(key, value) => setSchemeCatForm({ ...schemeCatForm, [key]: value })}
      layout="row" labelWidth="130px" boxesClassName="tw:gap-x-4 tw:md:grid-cols-2"
      actions={<AddButton onClick={addSchemeCatRow} />}
      columns={columns} rows={tempSchemeCatData} emptyText="No records" gridClassName="tw:h-[150px]"
    />
  );
}

function SchemeSearchModal({ ctx }) {
  const { showSchemeSearchModal, setShowSchemeSearchModal, schemeSearch, setSchemeSearch } = ctx;
  const close = () => setShowSchemeSearchModal(false);
  return (
    <Modal open={showSchemeSearchModal} title="Search" width={500} onClose={close} closeOnOutside={false}
      footer={<Button variant="destructive" onClick={close}>Cancel</Button>}>
      <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded-sm tw:border tw:border-border tw:p-2">
        <div className="tw:flex tw:gap-5">
          <span>Search By</span>
          <span className="tw:text-muted-foreground">code or description</span>
        </div>
        <Field label="Filter" labelWidth="60px">
          <Input value={schemeSearch} placeholder="ENTER FILTER" className="tw:uppercase" onChange={(event) => setSchemeSearch(event.target.value)} />
        </Field>
      </div>
      <DataTable columns={SCHEME_SEARCH_COLUMNS} rows={SCHEME_SEARCH_ROWS} rowKey="code"
        containerClassName="tw:max-h-[250px] tw:rounded-sm tw:border tw:border-border" />
    </Modal>
  );
}

function SwInfoModal({ ctx }) {
  const {
    showSwInfoModal, setShowSwInfoModal, swInfoForm, setSwInfoForm, addSwInfoRow, tempSwInfoData, removeSwInfoRow,
    applySwInfoToAll, saveSwInfoModal, masters,
  } = ctx;
  const boxes = [
    { key: 'type', label: 'Info Type', required: true, kind: 'select', options: SW_INFO_TYPES },
    { key: 'qualifier', label: 'Info Qualifier', required: true, kind: 'select', options: swInfoQualifiers(swInfoForm.type) },
    { key: 'code', label: 'Qualifier Code', kind: 'select', options: swInfoCodes(swInfoForm.type) },
    { key: 'text', label: 'Info Text' },
    { key: 'qty', label: 'Info Qty.', kind: 'number' },
    { key: 'uqc', label: 'Info UQC', ...uqcCombo(masters) },
    { key: 'agency', label: 'Agency', required: true, kind: 'select', options: ['ALL'], fieldClassName: 'tw:col-span-2' },
  ];
  const columns = [
    removeColumn((index, row) => removeSwInfoRow(row.id)),
    ...SW_INFO_COLUMNS.map((column) => (column.key === 'agency' ? { ...column, cell: (row) => row.agency || 'ALL' } : column)),
  ];
  const close = () => setShowSwInfoModal(false);
  return (
    <EntryGridModal
      open={showSwInfoModal} title="SW Info Type" width={900} onClose={close}
      footer={(
        <>
          <Button variant="default" onClick={applySwInfoToAll}><CheckSquare /> Apply to All in Invoice</Button>
          <Button variant="success" onClick={saveSwInfoModal}><CheckSquare /> Ok</Button>
          <Button onClick={close}>Cancel</Button>
        </>
      )}
      boxes={boxes} values={swInfoForm} onChange={(key, value) => setSwInfoForm({ ...swInfoForm, [key]: value })}
      boxesClassName="tw:grid-cols-2 tw:md:grid-cols-6"
      actions={<AddButton onClick={addSwInfoRow} />}
      columns={columns} rows={tempSwInfoData} emptyText="No Info Data Added"
    />
  );
}

export default function SchemeCodeCategorySection({ ctx }) {
  return (
    <>
      <SchemeCategoryModal ctx={ctx} />
      <SchemeSearchModal ctx={ctx} />
      <SwInfoModal ctx={ctx} />
    </>
  );
}
