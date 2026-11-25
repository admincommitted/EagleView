import { Building } from 'lucide-react';
import { DataTable } from '@/components/ui';
import { settingsApi } from '../settingsApi';
import { CheckboxField } from './SettingsParts/CheckboxField';
import { RecordActions, RecordsPanel } from './SettingsParts/RecordsPanel';
import { SettingsFields } from './SettingsParts/SettingsFields';
import { useSettingsRecords } from './SettingsParts/useSettingsRecords';

const CHA_API = {
  list: settingsApi.chaMaster,
  create: settingsApi.createChaMaster,
  update: settingsApi.updateChaMaster,
  remove: settingsApi.deleteChaMaster,
};
const EMPTY_CHA = { chaCode: '', chaLicense: '', chaName: '', chaAddress: '', chaCity: '', chaPin: '', chaGstin: '', chaPhone: '', chaEmail: '', isDefault: false };
const REQUIRED_FIELDS = ['chaCode', 'chaName'];

const CHA_FIELDS = [
  { name: 'chaCode', label: 'CHA CODE', required: true, upper: true },
  { name: 'chaLicense', label: 'LICENSE NO.' },
  { name: 'chaName', label: 'CHA NAME', required: true, upper: true, className: 'tw:md:col-span-2' },
  { name: 'chaAddress', label: 'REGISTERED ADDRESS', className: 'tw:md:col-span-2' },
  { name: 'chaCity', label: 'CITY' },
  { name: 'chaPin', label: 'PIN CODE' },
];

const CONTACT_FIELDS = [
  { name: 'chaGstin', label: 'GSTIN', upper: true, placeholder: '15-digit GSTIN', controlClassName: 'tw:font-mono' },
  { name: 'chaPhone', label: 'PHONE' },
  { name: 'chaEmail', label: 'EMAIL', kind: 'email' },
];

export default function CHAMasterTab() {
  const chas = useSettingsRecords({
    api: CHA_API,
    emptyRecord: EMPTY_CHA,
    requiredFields: REQUIRED_FIELDS,
    savedMessage: 'CHA Profile saved successfully!',
    deleteQuestion: 'Delete this CHA?',
  });

  const columns = [
    {
      key: 'chaCode', header: 'CODE', className: 'tw:font-bold',
      cell: (cha) => (
        <>
          {cha.chaCode}
          {cha.isDefault && <div className="tw:mt-0.5 tw:text-[10px] tw:text-primary">DEFAULT</div>}
        </>
      ),
    },
    {
      key: 'chaName', header: 'NAME & LICENSE',
      cell: (cha) => (
        <>
          <div className="tw:font-semibold">{cha.chaName}</div>
          <div className="tw:mt-0.5 tw:text-[11px] tw:text-muted-foreground">LIC: {cha.chaLicense}</div>
        </>
      ),
    },
    { key: 'chaAddress', header: 'ADDRESS', className: 'tw:whitespace-normal tw:text-muted-foreground' },
    {
      key: 'actions', header: 'ACTIONS', align: 'right',
      cell: (cha) => <RecordActions onEdit={() => chas.startEdit(cha)} onDelete={() => chas.remove(cha.id)} />,
    },
  ];

  return (
    <RecordsPanel records={chas} icon={Building} title="CHA Master Database" description="Manage Custom House Agents profiles and licenses."
      addLabel="ADD NEW CHA" formTitle={chas.editingId ? 'Edit CHA' : 'Create New CHA Profile'} saveLabel="CHA"
      formNote={<CheckboxField label="Set as Default CHA" checked={Boolean(chas.form.isDefault)} onCheckedChange={(checked) => chas.setField('isDefault', checked)} />}
      form={(
        <>
          <SettingsFields fields={CHA_FIELDS} values={chas.form} onChange={chas.setField} className="tw:md:grid-cols-4" />
          <SettingsFields fields={CONTACT_FIELDS} values={chas.form} onChange={chas.setField} className="tw:md:grid-cols-3" />
        </>
      )}>
      <DataTable columns={columns} rows={chas.records} emptyText="No CHA profiles found." rowClassName={(cha) => cha.isDefault && 'tw:bg-primary/5'}
        containerClassName="tw:rounded-lg tw:border tw:border-border" />
    </RecordsPanel>
  );
}
