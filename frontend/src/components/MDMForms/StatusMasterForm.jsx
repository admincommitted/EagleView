import { HelpCircle, ListChecks, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Field, Input, NumberInput, SelectBox } from '@/components/ui';
import { MasterPage } from './masterKit/MasterPage';
import { masterActionsColumn } from './masterKit/masterColumns';
import { useStatusMaster } from './StatusMasterFormParts/useStatusMaster';
import { BUBBLE_STYLES, MACRO_BUCKETS, MODULES } from './StatusMasterFormParts/statusOptions';
import StatusPreview, { StatusChip } from './StatusMasterFormParts/sections/StatusPreview';
import LinkedStatusPicker from './StatusMasterFormParts/sections/LinkedStatusPicker';

const LIST = {
  title: 'Status List',
  searchPlaceholder: 'Search...',
  primaryText: (status) => status.code,
  secondaryText: (status) => (
    <span className="tw:flex tw:items-center tw:justify-between tw:gap-2">
      <span>{status.module}</span>
      <StatusChip status={status}>{status.macroBucket}</StatusChip>
    </span>
  ),
};

const SMART_RULES = [
  ['Order Sequence', 'Define the display order in the timeline dropdown (e.g. 10, 20).'],
  ['Disables Statuses', <>Comma-separated codes to HIDE once this status is reached (e.g. <code>DUTY PENDING</code>).</>],
  ['Enables Statuses', <>Comma-separated exceptions to SHOW once this status is reached (e.g. <code>INTEREST PENDING</code>).</>],
];

const LINKED_LISTS = [
  { key: 'disables', title: 'DISABLES (Hide these)', tone: 'danger' },
  { key: 'enables', title: 'ENABLES (Show Exceptions)', tone: 'success' },
];

function ColourField({ label, value, onValueChange }) {
  return (
    <Field label={label} layout="col">
      <Input type="color" className="tw:h-9 tw:cursor-pointer tw:p-0" value={value} onChange={(event) => onValueChange(event.target.value)} />
    </Field>
  );
}

export default function StatusMasterForm() {
  const status = useStatusMaster();
  const { form, editingCode, loading, setField } = status;

  // the list and grid pick a status by its code
  const page = {
    filtered: status.filtered.map((row) => ({ ...row, id: row.code })),
    form: { ...form, id: form.code },
    search: status.search,
    setSearch: status.setSearch,
    editRecord: status.pick,
    clearForm: status.clearForm,
    save: status.save,
    saving: loading,
  };

  const otherStatuses = status.statuses
    .filter((row) => row.module === form.module && row.code !== form.code)
    .sort((first, second) => (first.sequence || 0) - (second.sequence || 0));

  const columns = [
    { key: 'code', header: 'Code', className: 'tw:font-semibold' },
    { key: 'module', header: 'Module' },
    { key: 'macroBucket', header: 'Macro Bucket', cell: (row) => <StatusChip status={row}>{row.macroBucket}</StatusChip> },
    { key: 'sequence', header: 'Seq', align: 'right' },
    { key: 'description', header: 'Description' },
    masterActionsColumn({ onEdit: status.pick }),
  ];

  const actions = (
    <>
      {editingCode && <Button variant="destructive" size="lg" disabled={loading} onClick={status.remove}><Trash2 /> Delete</Button>}
      <Button size="lg" disabled={loading} onClick={status.reload}><RefreshCw className={cn(loading && 'tw:animate-spin')} /> Refresh List</Button>
    </>
  );

  return (
    <MasterPage master={page} list={LIST} icon={ListChecks} formTitle={editingCode ? 'Edit Status' : 'Create New Status'}
      columns={columns} actions={actions} emptyText="No statuses found.">
      <div className="tw:flex tw:flex-col tw:gap-6">
        <div className="tw:rounded-sm tw:border-l-4 tw:border-primary tw:bg-primary/10 tw:px-4 tw:py-3">
          <h4 className="tw:mt-0 tw:mb-2 tw:flex tw:items-center tw:gap-2 tw:text-[13px] tw:text-head"><HelpCircle className="tw:size-4" /> Smart Logic Rules</h4>
          <div className="tw:grid tw:gap-1.5 tw:text-entry tw:text-foreground">
            {SMART_RULES.map(([name, rule]) => <div key={name}><strong>{name}:</strong> {rule}</div>)}
          </div>
        </div>

        {status.error && <div className="tw:rounded-sm tw:bg-destructive/10 tw:p-3 tw:text-[13px] tw:text-destructive">{status.error}</div>}

        <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:md:grid-cols-3">
          <Field label="Code" required layout="col">
            <Input required data-allow-text="" placeholder="e.g. EXAM_SCHEDULED" value={form.code} readOnly={Boolean(editingCode)}
              title={editingCode ? 'Code cannot be changed - jobs use it. Use Clear for another status.' : ''}
              onChange={(event) => setField('code')(event.target.value)} />
          </Field>
          <Field label="Module" layout="col">
            <SelectBox options={MODULES} value={form.module} onValueChange={setField('module')} />
          </Field>
          <Field label="Macro Bucket" layout="col">
            <SelectBox options={form.module === 'EXPORT' ? MACRO_BUCKETS.EXPORT : MACRO_BUCKETS.IMPORT} value={form.macroBucket} onValueChange={setField('macroBucket')} />
          </Field>
          <Field label="Description" layout="col" className="tw:md:col-span-2">
            <Input data-allow-text="" placeholder="Brief description..." value={form.description} onChange={(event) => setField('description')(event.target.value)} />
          </Field>
          <Field label="Order Sequence" layout="col">
            <NumberInput negative placeholder="e.g. 10" value={form.sequence || ''} onValueChange={setField('sequence')} />
          </Field>
          <Field label="Bubble Design" layout="col">
            <SelectBox options={BUBBLE_STYLES} value={form.bubbleStyle || 'LEFT_BORDER'} onValueChange={setField('bubbleStyle')} />
          </Field>
        </div>

        <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-4 tw:md:grid-cols-[1fr_2fr]">
          <div className="tw:flex tw:flex-col tw:justify-center tw:gap-4">
            <ColourField label="Background Color" value={form.colorCode || '#ffffff'} onValueChange={setField('colorCode')} />
            <ColourField label="Text Color" value={form.textColor || '#000000'} onValueChange={setField('textColor')} />
          </div>
          <StatusPreview status={form} />
        </div>

        <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:md:grid-cols-2">
          {LINKED_LISTS.map((list) => (
            <LinkedStatusPicker key={list.key} title={list.title} tone={list.tone} statuses={otherStatuses} value={form[list.key]}
              onToggle={(code, checked) => status.toggleLinkedCode(list.key, code, checked)} />
          ))}
        </div>
      </div>
    </MasterPage>
  );
}
