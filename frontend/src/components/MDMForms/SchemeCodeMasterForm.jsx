import { useMemo } from 'react';
import { Activity, ShieldCheck, Tag, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, Button, Checkbox, Field, Input, Label, Section } from '@/components/ui';
import { askDelete } from './switchRow';
import { MasterPage } from './masterKit/MasterPage';
import { activeColumn, masterActionsColumn } from './masterKit/masterColumns';
import { masterRecordsApi } from './masterKit/masterRecordsApi';
import { useMasterRecords } from './masterKit/useMasterRecords';

const RESOURCE = 'schemecodes';
// id is only the screen's handle on the row: the scheme code itself is the key in the table
const EMPTY_SCHEME = { id: '', code: '', desc: '', requiresLicense: false, requiresDbk: false, requiresRodtep: false, isActive: true };
const SEARCH_FIELDS = ['code', 'desc'];

const RULE_FLAGS = [
  { key: 'requiresDbk', label: 'Calculates Drawback' },
  { key: 'requiresRodtep', label: 'Calculates RoDTEP' },
  { key: 'requiresLicense', label: 'Requires DGFT License' },
  { key: 'isActive', label: 'Is Active?' },
];

const validateScheme = (scheme) => (!scheme.code || !scheme.desc ? 'Code and Description are required!' : '');

const LIST = {
  title: 'Search Scheme',
  icon: Tag,
  searchPlaceholder: 'Search Code or Desc...',
  primaryText: (scheme) => scheme.code,
  secondaryText: (scheme) => scheme.desc,
};

const yesNo = (flag) => <Badge variant={flag ? 'success' : 'neutral'}>{flag ? 'Yes' : 'No'}</Badge>;

export default function SchemeCodeMasterForm() {
  const records = useMasterRecords({ resource: RESOURCE, emptyRecord: EMPTY_SCHEME, searchFields: SEARCH_FIELDS });
  const { form, setField, clearForm, reload } = records;
  const isEdit = Boolean(form.id);

  const filtered = useMemo(() => records.filtered.map((scheme) => ({ ...scheme, id: scheme.code })), [records.filtered]);

  const save = async () => {
    const problem = validateScheme(form);
    if (problem) {
      toast.error(problem);
      return;
    }
    const { id, ...scheme } = form;
    try {
      if (isEdit) await masterRecordsApi.update(RESOURCE, encodeURIComponent(id), scheme);
      else await masterRecordsApi.create(RESOURCE, scheme);
      clearForm();
      reload();
    } catch (error) {
      console.error(error);
      toast.error('Error saving record');
    }
  };

  const deleteScheme = async (code) => {
    if (!(await askDelete('Delete this scheme code?'))) return;
    try {
      await masterRecordsApi.remove(RESOURCE, encodeURIComponent(code));
      reload();
      if (form.code === code) clearForm();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const master = { ...records, filtered, save };

  const columns = [
    { key: 'code', header: 'Scheme Code', cell: (scheme) => <Badge variant="info">{scheme.code}</Badge> },
    { key: 'desc', header: 'Description', className: 'tw:font-semibold' },
    { key: 'requiresDbk', header: 'Drawback', align: 'center', cell: (scheme) => yesNo(scheme.requiresDbk) },
    { key: 'requiresRodtep', header: 'RoDTEP', align: 'center', cell: (scheme) => yesNo(scheme.requiresRodtep) },
    { key: 'requiresLicense', header: 'DGFT License', align: 'center', cell: (scheme) => yesNo(scheme.requiresLicense) },
    activeColumn,
    masterActionsColumn({ onEdit: records.editRecord }),
  ];

  const deleteAction = isEdit && (
    <Button variant="destructive" size="lg" onClick={() => deleteScheme(form.code)}><Trash2 /> Delete</Button>
  );

  return (
    <MasterPage master={master} list={LIST} icon={Activity} formTitle="Export Scheme Codes Master" columns={columns} actions={deleteAction}>
      <div className="tw:flex tw:flex-col tw:gap-4">
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-[120px_1fr]">
          <Field label="Scheme Code" required layout="col">
            <Input required placeholder="e.g. 19" className="tw:font-bold tw:text-primary" data-allow-text="" value={form.code} disabled={isEdit}
              onChange={(event) => setField('code')(event.target.value)} />
          </Field>
          <Field label="Description" required layout="col">
            <Input required placeholder="Scheme Name..." className="tw:uppercase tw:font-semibold" data-allow-text="" value={form.desc}
              onChange={(event) => setField('desc')(event.target.value.toUpperCase())} />
          </Field>
        </div>

        <Section title={<span className="tw:flex tw:items-center tw:gap-1"><ShieldCheck className="tw:size-3.5" /> System Rules Engine</span>}>
          <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
            {RULE_FLAGS.map((flag) => (
              <Label key={flag.key} className="tw:cursor-pointer tw:gap-2 tw:rounded-md tw:border tw:border-border tw:bg-background tw:px-3 tw:py-2 tw:font-semibold">
                <Checkbox checked={Boolean(form[flag.key])} onCheckedChange={(checked) => setField(flag.key)(checked === true)} />
                {flag.label}
              </Label>
            ))}
          </div>
        </Section>
      </div>
    </MasterPage>
  );
}
