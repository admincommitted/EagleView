import { X } from 'lucide-react';
import { Checkbox, DataTable, Field, Section } from '@/components/ui';
import { cn } from '@/lib/utils';

const GRID_COLUMNS = {
  4: 'tw:sm:grid-cols-2 tw:lg:grid-cols-4',
  6: 'tw:sm:grid-cols-2 tw:lg:grid-cols-6',
  7: 'tw:sm:grid-cols-2 tw:lg:grid-cols-7',
  8: 'tw:sm:grid-cols-2 tw:lg:grid-cols-8',
  9: 'tw:sm:grid-cols-2 tw:lg:grid-cols-9',
};

const GRID_SPAN = {
  1: '',
  2: 'tw:sm:col-span-2',
  3: 'tw:sm:col-span-2 tw:lg:col-span-3',
  4: 'tw:sm:col-span-2 tw:lg:col-span-4',
  6: 'tw:sm:col-span-2 tw:lg:col-span-6',
};

export function GridCell({ span = 1, className, children }) {
  return <div className={cn('tw:min-w-0', GRID_SPAN[span], className)}>{children}</div>;
}

export function Panel({ title, actions, className, bodyClassName, children }) {
  return (
    <Section title={title} actions={actions} className={className} bodyClassName={cn('tw:pt-1 tw:pb-0.5', bodyClassName)}>
      {children}
    </Section>
  );
}

export function FormGrid({ columns, className, children }) {
  return <div className={cn('tw:grid tw:grid-cols-1 tw:items-end tw:gap-x-2 tw:gap-y-1.5', GRID_COLUMNS[columns], className)}>{children}</div>;
}

export function GridField({ label, required, span, className, children }) {
  return (
    <Field layout="col" label={label} required={required} className={cn(GRID_SPAN[span || 1], className)} labelClassName="tw:truncate tw:text-[11px] tw:font-bold tw:text-muted-foreground">
      {children}
    </Field>
  );
}

export function CheckField({ label, checked, onCheckedChange, disabled, className }) {
  return (
    <label className={cn('tw:m-0 tw:flex tw:h-[22px] tw:cursor-pointer tw:items-center tw:gap-1.5 tw:text-[11px] tw:font-semibold tw:whitespace-nowrap', disabled && 'tw:opacity-55', className)}>
      <Checkbox checked={Boolean(checked)} disabled={disabled} onCheckedChange={(value) => onCheckedChange(value === true)} />
      {label}
    </label>
  );
}

export function RemovableChip({ onRemove, children }) {
  return (
    <span className="tw:inline-flex tw:items-center tw:gap-1 tw:rounded-md tw:border tw:border-primary/25 tw:bg-background tw:px-1.5 tw:py-0.5 tw:text-[11px]">
      {children}
      <X role="button" aria-label="Remove" className="tw:size-2.5 tw:cursor-pointer tw:text-destructive" onClick={onRemove} />
    </span>
  );
}

const MESSAGE_TONE = { error: 'tw:text-destructive', success: 'tw:text-success', info: 'tw:text-foreground' };

export function StatusMessage({ message, className }) {
  if (!message) return null;
  return <span className={cn('tw:text-[11px] tw:font-bold', MESSAGE_TONE[message.tone || 'info'], className)}>{message.text}</span>;
}

export function GridPanel({ title, actions, heightClassName = 'tw:max-h-[320px]', ...tableProps }) {
  return (
    <Panel title={title} actions={actions}>
      <DataTable containerClassName={heightClassName} {...tableProps} />
    </Panel>
  );
}
