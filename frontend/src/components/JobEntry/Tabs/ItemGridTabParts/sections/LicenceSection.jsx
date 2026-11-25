import { Pencil, Plus } from 'lucide-react';
import { Button, DataTable, DateInput, Field, Input, Modal, NumberInput } from '@/components/ui';
import { editColumn, removeColumn } from '../../JobHeaderTabParts/sections/rowActionColumns';

// Licence debit of the item (BE licenseModel)
const LICENCE_FIELDS = [
  { key: 'licenceNo', label: 'Licence / Regn No', placeholder: '10 digits', required: true },
  { key: 'licenceDate', label: 'Regn Date', kind: 'date' },
  { key: 'licenceCode', label: 'Licence Code', placeholder: 'e.g. AA', upper: true },
  { key: 'regnPort', label: 'Regn Port', placeholder: 'INDEL4', upper: true },
  { key: 'itemSrNoLicence', label: 'Item Sr No in Licence', placeholder: '1' },
  { key: 'debitValue', label: 'Debit Value (INR)', kind: 'number' },
  { key: 'debitQty', label: 'Debit Quantity', kind: 'number' },
  { key: 'debitUqc', label: 'Debit UQC', placeholder: 'NOS', upper: true },
  // duty exemption claimed under this licence / scrip -> BE DEPB row (a RoDTEP-scrip BE files RODTEP / 1)
  { key: 'exemptionNotn', label: 'Exemption Notn (DEPB)', placeholder: 'e.g. RODTEP', upper: true },
  { key: 'exemptionSrNo', label: 'Exemption Sr No', placeholder: '1' },
];

function LicenceControl({ id, field, value, onChange, onEnter }) {
  const addOnEnter = (event) => {
    if (event.key === 'Enter') { event.preventDefault(); onEnter(); }
  };
  if (field.kind === 'date') return <DateInput id={id} value={value} onValueChange={onChange} />;
  if (field.kind === 'number') return <NumberInput id={id} value={value} onValueChange={onChange} onKeyDown={addOnEnter} />;
  return (
    <Input id={id} value={value} required={field.required} placeholder={field.placeholder} onKeyDown={addOnEnter}
      onChange={(event) => onChange(field.upper ? event.target.value.toUpperCase() : event.target.value)} />
  );
}

export default function LicenceSection({ ctx }) {
  const { showLicenceModal, setShowLicenceModal, tempLicenceData, licenceForm, setLicenceForm, licenceEditId, addLicenceRow, editLicenceRow, removeLicenceRow, saveLicenceModal } = ctx;
  const columns = [
    { ...editColumn((index, row) => editLicenceRow(row)), align: 'center' },
    { ...removeColumn((index, row) => removeLicenceRow(row.id)), align: 'center' },
    ...LICENCE_FIELDS.map((field) => ({ key: field.key, header: field.label })),
  ];

  return (
    <Modal open={showLicenceModal} title="Licence Details (debit)" width={900} closeOnOutside={false}
      onClose={() => setShowLicenceModal(false)} onOk={saveLicenceModal} okLabel="Ok">
      <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] tw:gap-2.5 tw:rounded-sm tw:border tw:border-border tw:p-2.5">
        {LICENCE_FIELDS.map((field) => (
          <Field key={field.key} label={field.label} required={field.required} layout="col">
            <LicenceControl field={field} value={licenceForm[field.key] || ''} onEnter={addLicenceRow}
              onChange={(value) => setLicenceForm({ ...licenceForm, [field.key]: value })} />
          </Field>
        ))}
        <div className="tw:flex tw:items-end">
          <Button variant="default" onClick={addLicenceRow}>{licenceEditId !== null ? <><Pencil /> Update</> : <><Plus /> Add</>}</Button>
        </div>
      </div>
      <DataTable columns={columns} rows={tempLicenceData} rowKey="id" selectedKey={licenceEditId} emptyText="No licence rows."
        containerClassName="tw:rounded-sm tw:border tw:border-border" />
    </Modal>
  );
}
