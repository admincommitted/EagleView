import { Edit2, PlusCircle, Trash2 } from 'lucide-react';
import { Badge, Button, Checkbox, DataTable, Field, Section } from '@/components/ui';
import CasedTextField from './CasedTextField';

const BRANCH_FIELDS = [
  { key: 'contactPerson', label: 'Contact Person', textCase: 'upper' },
  { key: 'branchName', label: 'Branch Name', required: true, textCase: 'upper' },
  { key: 'address1', label: 'Address 1', required: true, textCase: 'upper' },
  { key: 'address2', label: 'Address 2', textCase: 'upper', className: 'tw:md:col-span-2' },
  { key: 'city', label: 'City', textCase: 'upper' },
  { key: 'state', label: 'State', textCase: 'upper' },
  { key: 'country', label: 'Country', textCase: 'upper' },
  { key: 'pinCode', label: 'Pin Code', textCase: 'upper' },
  { key: 'gstState', label: 'GST State', textCase: 'upper' },
  { key: 'gstNo', label: 'GST No', textCase: 'upper' },
  { key: 'phone', label: 'Phone' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'fax', label: 'Fax' },
  { key: 'email1', label: 'Email 1', textCase: 'lower' },
  { key: 'email2', label: 'Email 2', textCase: 'lower' },
  { key: 'website', label: 'Website', textCase: 'lower' },
];

export default function BranchSection({ branch, setBranchField, editIndex, branches, onSave, onEdit, onDelete }) {
  const columns = [
    {
      key: 'actions',
      header: 'Action',
      width: 80,
      cell: (row, index) => (
        <span className="tw:inline-flex tw:gap-1">
          <Button variant="ghost" size="icon-sm" title="Edit branch" onClick={() => onEdit(row, index)}><Edit2 /></Button>
          <Button variant="ghost" size="icon-sm" className="tw:text-destructive" title="Remove branch" onClick={() => onDelete(index)}><Trash2 /></Button>
        </span>
      ),
    },
    {
      key: 'branchName',
      header: 'Branch Name',
      className: 'tw:font-bold',
      cell: (row) => <>{row.branchName} {row.defaultAddress && <Badge variant="info">DEFAULT</Badge>}</>,
    },
    { key: 'contactPerson', header: 'Contact Person' },
    { key: 'address', header: 'Address', cell: (row) => `${row.address1}, ${row.city}` },
    { key: 'contact', header: 'Phone / Email', cell: (row) => `${row.phone || row.mobile} / ${row.email1}` },
  ];

  return (
    <Section title="Add / Edit Branch Address"
      actions={<Button variant="default" size="sm" onClick={onSave}><PlusCircle /> {editIndex >= 0 ? 'UPDATE BRANCH' : 'ADD BRANCH'}</Button>}>
      <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:md:grid-cols-2 tw:xl:grid-cols-3">
        <Field label="Default Address">
          <Checkbox checked={Boolean(branch.defaultAddress)} onCheckedChange={(checked) => setBranchField('defaultAddress')(checked === true)} />
        </Field>
        {BRANCH_FIELDS.map((field) => (
          <CasedTextField key={field.key} field={field} value={branch[field.key]} onValueChange={setBranchField(field.key)} />
        ))}
        <Field label="GST Exempted">
          <Checkbox checked={Boolean(branch.gstExempted)} onCheckedChange={(checked) => setBranchField('gstExempted')(checked === true)} />
        </Field>
      </div>
      <DataTable columns={columns} rows={branches} rowKey={(row, index) => index} emptyText="No branches added yet. Add a branch above."
        containerClassName="tw:rounded-md tw:border tw:border-border tw:bg-card" />
    </Section>
  );
}
