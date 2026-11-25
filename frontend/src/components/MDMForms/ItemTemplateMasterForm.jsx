import { Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge, Field, Input, SelectBox, Textarea } from '@/components/ui';
import { MasterPage } from './masterKit/MasterPage';
import { dimRowWhenInactive, masterActionsColumn } from './masterKit/masterColumns';
import { useMasterRecords } from './masterKit/useMasterRecords';

const EMPTY_TEMPLATE = { id: '', templateName: '', jobType: 'BE', jsonPayload: '', createdBy: '' };
const LIST_PARAMS = { all: 1 };
const SEARCH_FIELDS = ['templateName'];
const JOB_TYPES = [
  { value: 'BE', label: 'Bill of Entry (Import)' },
  { value: 'SB', label: 'Shipping Bill (Export)' },
];

// rows from before the switch-off column have no isActive: they count as on
const isTemplateOn = (template) => !(template.isActive === false || template.isActive === 0);
const withActiveFlag = (template) => ({ ...template, isActive: isTemplateOn(template) });

const validateTemplate = (template) => {
  if (!template.templateName) return 'Template Name is required!';
  if (!String(template.jsonPayload || '').trim()) return '';
  try {
    JSON.parse(template.jsonPayload);
    return '';
  } catch (error) {
    return `JSON Payload is not valid JSON: ${error.message}`;
  }
};
const withoutEmptyId = ({ id, ...template }) => (id ? { id, ...template } : template);

const LIST = {
  title: 'Search',
  searchPlaceholder: 'SEARCH...',
  primaryText: (template) => template.templateName,
  secondaryText: (template) => template.jobType,
};

export default function ItemTemplateMasterForm() {
  const records = useMasterRecords({
    resource: 'itemtemplates',
    emptyRecord: EMPTY_TEMPLATE,
    listParams: LIST_PARAMS,
    searchFields: SEARCH_FIELDS,
    validate: validateTemplate,
    describe: (template) => `template ${template.templateName || ''}`,
    prepareSave: withoutEmptyId,
  });
  const { form, setField } = records;

  const save = async () => {
    if (await records.save()) toast.success('Saved successfully!');
  };
  const master = { ...records, save };

  const actionsColumn = masterActionsColumn({ onEdit: records.editRecord, onSwitch: (template) => records.switchActive(withActiveFlag(template)) });
  const columns = [
    {
      key: 'templateName',
      header: 'Template Name',
      className: 'tw:font-semibold',
      cell: (template) => (
        <>
          {template.templateName}
          {!isTemplateOn(template) && <Badge variant="danger" className="tw:ml-2">Inactive</Badge>}
        </>
      ),
    },
    { key: 'jobType', header: 'Job Type', align: 'center', cell: (template) => <Badge variant="neutral">{template.jobType}</Badge> },
    { ...actionsColumn, cell: (template) => actionsColumn.cell(withActiveFlag(template)) },
  ];

  return (
    <MasterPage master={master} list={LIST} icon={Copy} formTitle={`${form.id ? 'Edit' : 'Add'} Item Template`} columns={columns} rowClassName={dimRowWhenInactive}>
      <p className="tw:m-0 tw:mb-4 tw:text-entry tw:text-muted-foreground">
        Templates allow operators to auto-fill the item grid with a single click, saving time on repetitive entries.
      </p>
      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-[2fr_1fr_1fr]">
        <Field label="Template Name" layout="col">
          <Input placeholder="e.g. Standard Garments Export" data-allow-text="" value={form.templateName}
            onChange={(event) => setField('templateName')(event.target.value)} />
        </Field>
        <Field label="Job Type" layout="col">
          <SelectBox options={JOB_TYPES} value={form.jobType} onValueChange={setField('jobType')} />
        </Field>
        <Field label="JSON Payload" layout="col">
          <Textarea placeholder='{"items": [...]}' rows={5} data-allow-text="" className="tw:resize-y tw:font-mono tw:text-entry"
            value={form.jsonPayload || ''} onChange={(event) => setField('jsonPayload')(event.target.value)} />
        </Field>
      </div>
    </MasterPage>
  );
}
