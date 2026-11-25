import { useId } from 'react';
import { Plus, Settings, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Checkbox, Field, Input, Label, SelectBox } from '@/components/ui';
import { CHART_FLAGS, COLOR_RULE_STATUSES, FORMAT_FLAGS, GROUP_BY_OPTIONS, ROW_COLORS, SMALL_LABEL } from '../dsrOptions';

const HINT = 'tw:text-[10px] tw:text-slate-500';
const CODE = 'tw:rounded tw:bg-slate-100 tw:px-1 tw:py-0.5 tw:text-slate-900';

function FlagCheckbox({ label, checked, onCheckedChange, className }) {
  const id = useId();
  return (
    <div className="tw:flex tw:items-center tw:gap-1.5">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
      <Label htmlFor={id} className={cn('tw:cursor-pointer tw:whitespace-normal tw:text-xs tw:text-slate-700', className)}>{label}</Label>
    </div>
  );
}

function FlagList({ flags, template, onUpdate, className }) {
  return (
    <div className={cn('tw:flex tw:flex-wrap tw:gap-x-4 tw:gap-y-2', className)}>
      {flags.map((flag) => (
        <FlagCheckbox
          key={flag.key}
          label={flag.label}
          className={flag.className}
          checked={flag.onByDefault ? template[flag.key] !== false : Boolean(template[flag.key])}
          onCheckedChange={(checked) => onUpdate(flag.key, checked)}
        />
      ))}
    </div>
  );
}

function ColorRuleRow({ rule, index, onUpdateColorRule, onRemoveColorRule }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded tw:border tw:border-slate-200 tw:bg-white tw:p-1.5 tw:md:flex-row tw:md:items-center tw:md:gap-3">
      <span className="tw:text-xs tw:font-semibold tw:text-slate-500">If Status is:</span>
      <SelectBox className="tw:w-full tw:md:flex-1" options={COLOR_RULE_STATUSES} value={rule.status} onValueChange={(value) => onUpdateColorRule(index, 'status', value)} />
      <span className="tw:text-xs tw:font-semibold tw:text-slate-500">Excel Row Color:</span>
      <div className="tw:w-full tw:md:flex-1" style={{ '--row-color': rule.color }}>
        <SelectBox className="tw:w-full tw:bg-(--row-color)" options={ROW_COLORS} value={rule.color} onValueChange={(value) => onUpdateColorRule(index, 'color', value)} />
      </div>
      <Button variant="destructive" size="icon" className="tw:self-end tw:md:self-auto" title="Remove rule" onClick={() => onRemoveColorRule(index)}><Trash2 /></Button>
    </div>
  );
}

export default function AdvancedSettingsSection({ template, onUpdate, onAddColorRule, onUpdateColorRule, onRemoveColorRule }) {
  const colorRules = template.colorRules || [];
  return (
    <div className="tw:mt-2 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-4 tw:md:p-5">
      <h3 className="tw:mt-0 tw:mb-4 tw:flex tw:items-center tw:gap-2 tw:text-sm tw:text-slate-800">
        <Settings className="tw:size-4 tw:text-violet-500" /> Advanced Enterprise Settings
      </h3>

      <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:md:grid-cols-2">
        <div className="tw:flex tw:flex-col tw:gap-2">
          <span className={SMALL_LABEL}>File Attachments & Format</span>
          <FlagList flags={FORMAT_FLAGS} template={template} onUpdate={onUpdate} className="tw:mt-1" />
          <div className="tw:mt-2.5 tw:flex tw:flex-col tw:gap-2 tw:border-t tw:border-dashed tw:border-slate-300 tw:pt-2.5 tw:md:flex-row tw:md:items-center tw:md:gap-4">
            <FlagCheckbox
              label="📎 Auto-Attach BOE / OOC Docs (Zip Bundle)"
              className="tw:font-semibold tw:text-indigo-700"
              checked={Boolean(template.attachDocs)}
              onCheckedChange={(checked) => onUpdate('attachDocs', checked)}
            />
            <span className={HINT}>(System will scan completed jobs and attach their respective PDF documents)</span>
          </div>
        </div>

        <Field label="Data Grouping (Smart Pivot)" layout="col" labelClassName={SMALL_LABEL}>
          <SelectBox className="tw:w-full" options={GROUP_BY_OPTIONS} value={template.groupBy || ''} clearable clearLabel="None (Flat Standard Table)"
            placeholder="None (Flat Standard Table)" onValueChange={(value) => onUpdate('groupBy', value)} />
        </Field>

        <div className="tw:mb-2 tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-dashed tw:border-slate-300 tw:pb-3 tw:md:col-span-2">
          <span className={SMALL_LABEL}>Visual Analytics & Embedded Charts</span>
          <FlagList flags={CHART_FLAGS} template={template} onUpdate={onUpdate} className="tw:mt-1 tw:gap-x-6" />
          <span className={HINT}>Selected charts will be dynamically generated and embedded at the top of the PDF Report and Email Body.</span>
        </div>

        <Field label="Smart Exclusion Rule (SQL/Logic)" layout="col" className="tw:md:col-span-2" labelClassName={SMALL_LABEL}
          note={(
            <span className="tw:mt-1 tw:block tw:text-[10px] tw:leading-snug tw:text-slate-500">
              Use this to prevent sending already delivered or cleared jobs in daily reports.<br />
              <strong>💡 Hint / Examples:</strong> <br />
              <code className={CODE}>Job.status != 'CLEARED'</code> (Hides cleared jobs) <br />
              <code className={CODE}>Job.customsPort == 'INNSA1' AND Job.shipmentMode == 'SEA'</code> (Filters by Port & Mode)
            </span>
          )}
        >
          <Input data-allow-text="" className="tw:font-mono tw:text-xs tw:text-slate-900"
            placeholder="e.g. Job.status != 'CLEARED' AND Job.isAmended == false (Leave empty to send all client jobs)"
            value={template.exclusionRule || ''} onChange={(event) => onUpdate('exclusionRule', event.target.value)} />
        </Field>

        <div className="tw:mt-1 tw:flex tw:flex-col tw:gap-2 tw:border-t tw:border-slate-200 tw:pt-4 tw:md:col-span-2">
          <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
            <span className={SMALL_LABEL}>🎨 Excel Row Color Coding (By Status)</span>
            <Button variant="secondary" size="sm" className="tw:text-[10px]" onClick={onAddColorRule}><Plus className="tw:size-3" /> Add Color Rule</Button>
          </div>
          <div className="tw:flex tw:flex-col tw:gap-2">
            {colorRules.map((rule, index) => (
              <ColorRuleRow key={index} rule={rule} index={index} onUpdateColorRule={onUpdateColorRule} onRemoveColorRule={onRemoveColorRule} />
            ))}
            {colorRules.length === 0 && <span className={HINT}>No color rules defined. All Excel rows will have a white background.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
