import { Save, Settings, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Field, Input, SelectBox } from '@/components/ui';
import CustomAutocomplete from '../../../CustomAutocomplete';
import { partyOptions, RECIPIENT_FIELDS, SCHEDULE_OPTIONS, SMALL_LABEL, WEEK_DAYS } from '../dsrOptions';
import AdvancedSettingsSection from './AdvancedSettingsSection';
import SelectedColumnsSection from './SelectedColumnsSection';

const ROW = 'tw:flex tw:flex-col tw:gap-4 tw:md:flex-row';
const CELL = 'tw:min-w-0 tw:flex-1';

function ScheduleFields({ template, onUpdate }) {
  const scheduleType = template.scheduleType || 'MANUAL';
  return (
    <div className={ROW}>
      <Field label="Auto-Dispatch Schedule" layout="col" className={CELL} labelClassName={SMALL_LABEL}>
        <SelectBox className="tw:w-full" options={SCHEDULE_OPTIONS} value={scheduleType} onValueChange={(value) => onUpdate('scheduleType', value)} />
      </Field>
      {scheduleType !== 'MANUAL' && (
        <>
          <Field label="Dispatch Time" layout="col" className={CELL} labelClassName={SMALL_LABEL}>
            <Input type="time" value={template.scheduleTime || '18:00'} onChange={(event) => onUpdate('scheduleTime', event.target.value)} />
          </Field>
          {scheduleType === 'WEEKLY' && (
            <Field label="Day of Week" layout="col" className={CELL} labelClassName={SMALL_LABEL}>
              <SelectBox className="tw:w-full" options={WEEK_DAYS} value={template.scheduleDay || 'Monday'} onValueChange={(value) => onUpdate('scheduleDay', value)} />
            </Field>
          )}
          {scheduleType === 'MONTHLY' && (
            <Field label="Date of Month" layout="col" className={CELL} labelClassName={SMALL_LABEL}>
              <Input type="number" min="1" max="31" placeholder="e.g. 1" value={template.scheduleDate || 1} onChange={(event) => onUpdate('scheduleDate', event.target.value)} />
            </Field>
          )}
        </>
      )}
    </div>
  );
}

function RecipientFields({ template, onUpdate }) {
  return (
    <div className={ROW}>
      {RECIPIENT_FIELDS.map((field) => (
        <Field key={field.key} label={field.label} layout="col" className={CELL} labelClassName={cn(SMALL_LABEL, field.labelClassName)}>
          <Input data-allow-text="" className={field.inputClassName} placeholder={field.placeholder} value={template[field.key] || ''}
            onChange={(event) => onUpdate(field.key, event.target.value)} />
        </Field>
      ))}
    </div>
  );
}

function EscalationFields({ template, onUpdate }) {
  const redLabel = cn(SMALL_LABEL, 'tw:text-red-700');
  return (
    <div className="tw:flex tw:flex-col tw:gap-4 tw:rounded-md tw:border tw:border-red-200 tw:bg-red-50 tw:p-3 tw:md:flex-row">
      <Field label="🚨 Internal Escalation Rules (Logic)" layout="col" className="tw:min-w-0 tw:flex-2" labelClassName={redLabel}>
        <Input data-allow-text="" className="tw:border-red-300 tw:font-mono tw:text-xs tw:text-red-900" placeholder="e.g. Job.status == 'QUERY' OR Job.tatDays > 3"
          value={template.escalationRule || ''} onChange={(event) => onUpdate('escalationRule', event.target.value)} />
      </Field>
      <Field label="Manager CC / BCC Emails" layout="col" className={CELL} labelClassName={redLabel}>
        <Input data-allow-text="" className="tw:border-red-300 tw:bg-white" placeholder="manager@company.com"
          value={template.escalationEmails || ''} onChange={(event) => onUpdate('escalationEmails', event.target.value)} />
      </Field>
    </div>
  );
}

export default function TemplateConfigurationSection({ template, onUpdate, onDelete, onSave, onOpenFieldSelector, columnHandlers, colorRuleHandlers }) {
  if (!template) {
    return (
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-4 tw:text-slate-500 tw:shadow-sm">
        Select a template from the left or create a new one.
      </div>
    );
  }

  return (
    <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-4 tw:overflow-auto tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-4 tw:shadow-sm">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:border-b tw:border-slate-200 tw:pb-4">
        <div className="tw:flex tw:items-center tw:gap-2">
          <Settings className="tw:size-5 tw:text-blue-500" />
          <h2 className="tw:m-0 tw:text-lg tw:text-slate-900">Template Configuration</h2>
        </div>
        <Button variant="destructive" size="lg" className="tw:ml-auto tw:text-xs" onClick={onDelete}><Trash2 /> Delete</Button>
        <Button variant="success" size="lg" className="tw:text-xs" onClick={onSave}><Save /> Save Template</Button>
      </div>

      <div className={ROW}>
        <Field label="Template Name" layout="col" className={CELL} labelClassName="tw:text-[11px] tw:font-semibold tw:text-slate-600">
          <Input data-allow-text="" value={template.name} onChange={(event) => onUpdate('name', event.target.value)} />
        </Field>
        <Field label="Target Client (Optional)" layout="col" className={CELL} labelClassName="tw:text-[11px] tw:font-semibold tw:text-slate-600">
          <CustomAutocomplete
            fetchUrl="/masters/parties"
            mapData={partyOptions}
            value={template.client}
            onChange={(event) => onUpdate('client', event.target.value)}
            onSelect={(option) => onUpdate('client', option.title)}
            placeholder="Search Party Master..."
          />
        </Field>
      </div>

      <ScheduleFields template={template} onUpdate={onUpdate} />
      <RecipientFields template={template} onUpdate={onUpdate} />
      <EscalationFields template={template} onUpdate={onUpdate} />
      <AdvancedSettingsSection template={template} onUpdate={onUpdate} {...colorRuleHandlers} />
      <SelectedColumnsSection columns={template.columns} onOpenFieldSelector={onOpenFieldSelector} {...columnHandlers} />
    </div>
  );
}
