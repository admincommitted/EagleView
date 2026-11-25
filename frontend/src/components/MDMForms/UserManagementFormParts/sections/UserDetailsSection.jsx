import { Briefcase, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Field, Input, NumberInput, Section, SelectBox } from '@/components/ui';

const LABEL_WIDTH = '150px';
const FIELD_GRID = 'tw:grid tw:grid-cols-1 tw:gap-x-4 tw:gap-y-1 tw:md:grid-cols-2 tw:xl:grid-cols-3';

const ACCOUNT_FIELDS = [
  { field: 'username', label: 'User ID', required: true, placeholder: 'e.g. jdoe123' },
  { field: 'fullName', label: 'Full Name', required: true, placeholder: 'e.g. John Doe' },
  { field: 'contactNumber', label: 'Contact Number', placeholder: '+91 98765 43210' },
  { field: 'email', label: 'Email Address', type: 'email', placeholder: 'john@example.com', wide: true },
];
const ORGANIZATION_FIELDS = [
  { field: 'designation', label: 'Designation', placeholder: 'e.g. Manager' },
  { field: 'department', label: 'Department', placeholder: 'e.g. IT & Admin' },
];
const MANAGER_FIELDS = [
  { field: 'reportingTo1', label: 'Reporting Manager 1', placeholder: 'Manager Name' },
  { field: 'reportingTo2', label: 'Reporting Manager 2', placeholder: 'Optional Manager Name' },
];

const SectionTitle = ({ icon: Icon, children }) => <span className="tw:flex tw:items-center tw:gap-1.5"><Icon className="tw:size-3.5" /> {children}</span>;

export default function UserDetailsSection({ ctx }) {
  const { formData, setField, branches } = ctx;
  // a branch made Inactive in the Branch Master is not offered (it stays if this user already has it)
  const branchOptions = branches
    .filter((branch) => String(branch.status || '').toLowerCase() !== 'inactive' || branch.branchCode === formData.branch)
    .map((branch) => ({ value: branch.branchCode, label: `${branch.branchName} (${branch.branchCode})` }));

  const textField = ({ field, label, required, placeholder, type, wide }) => (
    <Field key={field} label={label} required={required} labelWidth={LABEL_WIDTH} className={cn(wide && 'tw:md:col-span-2')}>
      <Input data-allow-text="" type={type} required={required} placeholder={placeholder} value={formData[field]} onChange={(event) => setField(field, event.target.value)} />
    </Field>
  );

  return (
    <>
      <Section title={<SectionTitle icon={User}>Account Credentials</SectionTitle>}>
        <div className={FIELD_GRID}>{ACCOUNT_FIELDS.map(textField)}</div>
      </Section>

      <Section title={<SectionTitle icon={Briefcase}>Organization Details</SectionTitle>}>
        <div className={FIELD_GRID}>
          {ORGANIZATION_FIELDS.map(textField)}
          <Field label="Branch" labelWidth={LABEL_WIDTH} className="tw:md:col-span-2">
            <SelectBox options={branchOptions} value={formData.branch} onValueChange={(value) => setField('branch', value)} placeholder="Select Branch" clearable clearLabel="Select Branch" />
          </Field>
          {MANAGER_FIELDS.map(textField)}
          <Field label="Approval Limit" labelWidth={LABEL_WIDTH} className="tw:md:col-span-2">
            <NumberInput placeholder="Min" value={formData.limitMin} onValueChange={(value) => setField('limitMin', value)} />
            <span className="tw:font-bold tw:text-muted-foreground">-</span>
            <NumberInput placeholder="Max" value={formData.limitMax} onValueChange={(value) => setField('limitMax', value)} />
          </Field>
        </div>
      </Section>
    </>
  );
}
