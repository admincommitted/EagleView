import { cn } from '@/lib/utils';
import { Card, Checkbox, Field, Input } from '@/components/ui';

export function PanelCard({ title, icon: Icon, className, bodyClassName, children }) {
  return (
    <Card className={cn('tw:shrink-0 tw:gap-0 tw:overflow-hidden', className)}>
      <h3 className="tw:m-0 tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-primary/20 tw:bg-primary/5 tw:px-4 tw:py-2 tw:text-[11px] tw:font-semibold tw:text-head">
        {Icon && <Icon className="tw:size-3.5" />} {title}
      </h3>
      <div className={cn('tw:flex tw:flex-col tw:gap-1 tw:p-2', bodyClassName)}>{children}</div>
    </Card>
  );
}

// a tick box with its text; labelFirst puts the text before the box
export function CheckField({ label, checked, onCheckedChange, labelFirst, title, className }) {
  return (
    <label title={title} className={cn('tw:m-0 tw:flex tw:cursor-pointer tw:items-center tw:gap-1 tw:text-[11px] tw:whitespace-nowrap', className)}>
      {labelFirst && label}
      <Checkbox checked={Boolean(checked)} onCheckedChange={(value) => onCheckedChange(value === true)} />
      {!labelFirst && label}
    </label>
  );
}

// "Label: text box" bound to one key of a record
export function RecordTextField({ label, field, record, onChange, labelWidth, required, inputClassName, ...input }) {
  return (
    <Field label={label} labelWidth={labelWidth} required={required}>
      <Input data-allow-text="" required={required} className={inputClassName} value={record[field] || ''}
        onChange={(event) => onChange(field, event.target.value)} {...input} />
    </Field>
  );
}
