import { Building2, Globe, Mail, Phone } from 'lucide-react';
import { Badge, DataTable } from '@/components/ui';
import { settingsApi } from '../settingsApi';
import { announceContextChange } from './SettingsParts/contextEvents';
import { RecordActions, RecordsPanel } from './SettingsParts/RecordsPanel';
import { SettingsFields } from './SettingsParts/SettingsFields';
import { useSettingsRecords } from './SettingsParts/useSettingsRecords';

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const STATE_NAME = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '27': 'Maharashtra', '29': 'Karnataka',
  '30': 'Goa', '32': 'Kerala', '33': 'Tamil Nadu', '36': 'Telangana', '37': 'Andhra Pradesh',
};

const BRANCH_API = {
  list: settingsApi.companyBranches,
  create: settingsApi.createCompanyBranch,
  update: settingsApi.updateCompanyBranch,
  remove: settingsApi.deleteCompanyBranch,
};
const EMPTY_BRANCH = { branchCode: '', branchName: '', address: '', status: 'Active', isDefault: false, gstin: '', phone: '', email: '', website: '' };
const REQUIRED_FIELDS = ['branchCode', 'branchName'];

const isBadGstin = (gstin) => Boolean(gstin) && !GSTIN_PATTERN.test(gstin);

const gstinNote = ({ gstin }) => {
  if (isBadGstin(gstin)) return <span className="tw:text-destructive">GSTIN must be 15 characters</span>;
  if (gstin) return `GST state ${STATE_NAME[gstin.slice(0, 2)] || gstin.slice(0, 2)}`;
  return 'Branch GST registration, printed on its invoices';
};

const BRANCH_FIELDS = [
  { name: 'branchCode', label: 'BRANCH CODE', required: true, upper: true, placeholder: 'e.g. MUM' },
  { name: 'branchName', label: 'BRANCH NAME', required: true, upper: true, placeholder: 'e.g. MUMBAI (HEAD OFFICE)', className: 'tw:md:col-span-2' },
  { name: 'address', label: 'ADDRESS', placeholder: 'Branch Address', className: 'tw:md:col-span-2' },
  { name: 'status', label: 'STATUS', kind: 'select', options: ['Active', 'Inactive'] },
];

const CONTACT_FIELDS = [
  {
    name: 'gstin', label: 'GST NO. (GSTIN)', maxLength: 15, placeholder: 'e.g. 07AAACC1234D1Z5', controlClassName: 'tw:font-mono tw:tracking-wide',
    clean: (text) => text.toUpperCase().replace(/\s/g, ''), invalid: ({ gstin }) => isBadGstin(gstin), note: gstinNote,
  },
  { name: 'phone', label: 'TELEPHONE', placeholder: 'e.g. +91 11 4567 8900', note: 'Several numbers: comma separated' },
  { name: 'email', label: 'E-MAIL', placeholder: 'e.g. delhi@company.com', note: 'Several addresses: comma separated' },
  { name: 'website', label: 'WEBSITE', placeholder: 'e.g. www.company.com', clean: (text) => text.trim(), controlClassName: 'tw:normal-case', note: 'Printed with the branch address' },
  { name: 'isDefault', label: 'Set as Default Branch (Shows in Top Navigation)', kind: 'checkbox', className: 'tw:sm:col-span-2 tw:lg:col-span-4' },
];

const CONTACT_LINES = [['phone', Phone], ['email', Mail], ['website', Globe]];

function ContactLines({ branch }) {
  const lines = CONTACT_LINES.filter(([name]) => branch[name]);
  if (!lines.length) return <span className="tw:text-muted-foreground/70">Not set</span>;
  return lines.map(([name, Icon]) => (
    <div key={name} className="tw:flex tw:items-center tw:gap-1.5"><Icon className="tw:size-3" />{branch[name]}</div>
  ));
}

export default function BranchMasterTab() {
  const branches = useSettingsRecords({
    api: BRANCH_API,
    emptyRecord: EMPTY_BRANCH,
    requiredFields: REQUIRED_FIELDS,
    savedMessage: 'Branch saved successfully!',
    deleteQuestion: 'Delete this branch?',
    onChanged: announceContextChange,
  });

  const columns = [
    { key: 'branchCode', header: 'CODE', className: 'tw:font-bold' },
    { key: 'branchName', header: 'BRANCH NAME', className: 'tw:font-semibold' },
    { key: 'address', header: 'ADDRESS', className: 'tw:whitespace-normal tw:text-muted-foreground' },
    {
      key: 'gstin', header: 'GST NO.', className: 'tw:font-mono',
      cell: (branch) => (
        <>
          {branch.gstin || <span className="tw:text-muted-foreground/70">Not set</span>}
          {branch.stateCode && <div className="tw:text-[11px] tw:text-muted-foreground">{branch.stateCode}</div>}
        </>
      ),
    },
    { key: 'contact', header: 'CONTACT', className: 'tw:text-muted-foreground', cell: (branch) => <ContactLines branch={branch} /> },
    {
      key: 'status', header: 'STATUS', align: 'center',
      cell: (branch) => <Badge variant={branch.status === 'Active' ? 'success' : 'danger'}>{branch.status}</Badge>,
    },
    {
      key: 'actions', header: 'ACTIONS', align: 'right',
      cell: (branch) => <RecordActions onEdit={() => branches.startEdit(branch)} onDelete={() => branches.remove(branch.id)} />,
    },
  ];

  return (
    <RecordsPanel records={branches} icon={Building2} title="Branch Master Configuration" description="Create and manage company branches."
      addLabel="ADD NEW BRANCH" formTitle={branches.editingId ? 'Edit Branch' : 'Create New Branch'} saveLabel="BRANCH"
      form={(
        <>
          <SettingsFields fields={BRANCH_FIELDS} values={branches.form} onChange={branches.setField} className="tw:md:grid-cols-3" />
          <SettingsFields fields={CONTACT_FIELDS} values={branches.form} onChange={branches.setField} className="tw:sm:grid-cols-2 tw:lg:grid-cols-4" />
        </>
      )}>
      <DataTable columns={columns} rows={branches.records} emptyText="No branches found." containerClassName="tw:rounded-lg tw:border tw:border-border" />
    </RecordsPanel>
  );
}
