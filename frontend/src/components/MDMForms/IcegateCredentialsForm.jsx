import { KeyRound, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { Button, Field, Input } from '@/components/ui';
import { MasterPage } from './masterKit/MasterPage';
import { masterActionsColumn } from './masterKit/masterColumns';
import { masterRecordsApi } from './masterKit/masterRecordsApi';
import { useMasterRecords } from './masterKit/useMasterRecords';
import { askDelete } from './switchRow';

const RESOURCE = 'systemconfigurations';
const EMPTY_CONFIG = { id: '', icegateId: '', icegatePassword: '', icegateApiKey: '', senderEmail: '', senderPop: '', senderSmtp: '', receiverEmail: '' };
const SEARCH_FIELDS = ['icegateId'];

const ICEGATE_FIELDS = [
  { name: 'icegateId', label: 'ICEGATE ID', required: true },
  { name: 'icegatePassword', label: 'ICEGATE Password', type: 'password' },
  { name: 'icegateApiKey', label: 'API Key' },
];
const EMAIL_FIELDS = [
  { name: 'senderEmail', label: 'Sender Email (must be @eagleview360.com)', required: true },
  { name: 'receiverEmail', label: 'Receiver Email' },
  { name: 'senderPop', label: 'POP Server' },
  { name: 'senderSmtp', label: 'SMTP Server' },
];

const validateConfig = (config) => (!config.icegateId || !config.senderEmail ? 'ICEGATE ID and Sender Email are required.' : '');
const withoutEmptyId = ({ id, ...config }) => (id ? { id, ...config } : config);

const LIST = {
  title: 'Search Config',
  searchPlaceholder: 'Search ICEGATE ID...',
  primaryText: (config) => config.icegateId,
  secondaryText: (config) => config.senderEmail,
};

function ConfigFields({ title, fields, form, setField, className }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      <h4 className="tw:m-0 tw:text-entry tw:font-bold tw:text-head">{title}</h4>
      <div className={className}>
        {fields.map((field) => (
          <Field key={field.name} label={field.label} required={field.required} layout="col">
            <Input type={field.type} required={field.required} data-allow-text="" value={form[field.name] || ''}
              onChange={(event) => setField(field.name)(event.target.value)} />
          </Field>
        ))}
      </div>
    </div>
  );
}

export default function IcegateCredentialsForm() {
  const records = useMasterRecords({
    resource: RESOURCE,
    emptyRecord: EMPTY_CONFIG,
    searchFields: SEARCH_FIELDS,
    validate: validateConfig,
    prepareSave: withoutEmptyId,
  });
  const { form, setField } = records;

  const save = async () => {
    if (await records.save()) toast.success('Configuration saved!');
  };

  const deleteConfig = async () => {
    if (!form.id) return;
    if (!(await askDelete('Delete this configuration?'))) return;
    try {
      await masterRecordsApi.remove(RESOURCE, form.id);
      toast.success('Deleted');
      records.clearForm();
      records.reload();
    } catch (error) {
      toast.error(`Not deleted: ${errorMessage(error)}`);
    }
  };

  const columns = [
    { key: 'icegateId', header: 'ICEGATE ID', className: 'tw:font-semibold' },
    { key: 'senderEmail', header: 'Sender Email' },
    { key: 'receiverEmail', header: 'Receiver Email' },
    masterActionsColumn({ onEdit: records.editRecord }),
  ];

  return (
    <MasterPage master={{ ...records, save }} list={LIST} icon={KeyRound} formTitle="ICEGATE Credentials" columns={columns}
      actions={<Button variant="destructive" size="lg" disabled={!form.id} onClick={deleteConfig}><Trash2 /> Delete</Button>}>
      <div className="tw:flex tw:flex-col tw:gap-5">
        <ConfigFields title="ICEGATE & RESOS Details" fields={ICEGATE_FIELDS} form={form} setField={setField}
          className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-3" />
        <ConfigFields title="Sender Email Details" fields={EMAIL_FIELDS} form={form} setField={setField}
          className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2" />
      </div>
    </MasterPage>
  );
}
