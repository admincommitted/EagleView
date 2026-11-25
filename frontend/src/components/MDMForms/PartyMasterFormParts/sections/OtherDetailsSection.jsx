import { PlusCircle } from 'lucide-react';
import { Button, DataTable } from '@/components/ui';
import { PanelCard, RecordTextField } from './formBits';

// listed row by row: left column, right column
const AD_CODE_FIELDS = [
  { field: 'adCode', label: 'AD Code', placeholder: 'AD CODE', required: true },
  { field: 'forexCode', label: 'Forex Code', placeholder: 'FOREX CODE' },
  { field: 'bankName', label: 'Bank Name', placeholder: 'BANK NAME' },
  { field: 'bankAddress', label: 'Bank Address', placeholder: 'ADDRESS' },
  { field: 'serialNo', label: 'Serial No', placeholder: 'SERIAL NO' },
  { field: 'loadingPort', label: 'Loading Port', placeholder: 'LOADING PORT', optional: true },
  { field: 'branchAddress', label: 'Branch Address [If any]', placeholder: 'BRANCH ADDRESS', optional: true },
];
const AD_CODE_COLUMNS = [
  { key: 'serialNo', header: 'Sr. No' },
  { key: 'adCode', header: 'AD Code' },
  { key: 'bankName', header: 'Bank Name' },
  { key: 'bankAddress', header: 'Bank Address' },
  { key: 'forexCode', header: 'Forex Code' },
  { key: 'loadingPort', header: 'Loading Port' },
  { key: 'branchAddress', header: 'AD Code Address' },
];

const DRAWBACK_FIELDS = [
  { field: 'adCode', label: 'AD Code', placeholder: 'AD CODE', required: true },
  { field: 'accountNo', label: 'Account No', placeholder: 'ACCOUNT NO' },
  { field: 'bankName', label: 'Bank Name', placeholder: 'BANK NAME' },
  { field: 'bankAddress', label: 'Bank Address', placeholder: 'ADDRESS' },
  { field: 'ifscCode', label: 'IFSC Code', placeholder: 'IFSC CODE' },
];
const DRAWBACK_COLUMNS = [
  { key: 'adCode', header: 'AD Code' },
  { key: 'accountNo', header: 'Account No' },
  { key: 'ifscCode', header: 'IFSC Code' },
  { key: 'bankName', header: 'Bank Name' },
  { key: 'bankAddress', header: 'Bank Address' },
];

function AccountPanel({ title, fields, record, onChange, onAdd, columns, rows, onRemove }) {
  const gridColumns = [
    { key: 'edit', header: 'Edit', cell: () => <span className="tw:text-primary">Edit</span> },
    { key: 'delete', header: 'Delete', cell: (_, index) => <Button variant="link" size="sm" className="tw:text-destructive" onClick={() => onRemove(index)}>Delete</Button> },
    ...columns,
  ];
  return (
    <PanelCard title={title} bodyClassName="tw:gap-2 tw:px-4">
      <div className="tw:grid tw:grid-cols-1 tw:gap-x-2 tw:gap-y-2 tw:md:grid-cols-2">
        {fields.map(({ field, label, placeholder, required, optional }) => (
          <RecordTextField key={field} field={field} label={label} placeholder={placeholder} required={required} record={record} onChange={onChange}
            labelWidth="120px" inputClassName={optional ? 'tw:bg-success/5 tw:uppercase' : 'tw:uppercase'} />
        ))}
        <div className="tw:flex tw:md:pl-[128px]">
          <Button variant="default" size="sm" onClick={onAdd}><PlusCircle /> Add</Button>
        </div>
      </div>
      <DataTable columns={gridColumns} rows={rows} rowKey={(_, index) => index} emptyText="" containerClassName="tw:rounded-sm tw:border tw:border-border" />
    </PanelCard>
  );
}

export default function OtherDetailsSection({ ctx }) {
  const { selectedParty, adCodeFormData, setAdCodeField, addAdCode, removeAdCode, drawbackFormData, setDrawbackField, addDrawback, removeDrawback } = ctx;
  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <AccountPanel title="AD Code Details" fields={AD_CODE_FIELDS} record={adCodeFormData} onChange={setAdCodeField} onAdd={addAdCode}
        columns={AD_CODE_COLUMNS} rows={selectedParty?.adCodes || []} onRemove={removeAdCode} />
      <AccountPanel title="Drawback A/C Details" fields={DRAWBACK_FIELDS} record={drawbackFormData} onChange={setDrawbackField} onAdd={addDrawback}
        columns={DRAWBACK_COLUMNS} rows={selectedParty?.drawbackAccounts || []} onRemove={removeDrawback} />
    </div>
  );
}
