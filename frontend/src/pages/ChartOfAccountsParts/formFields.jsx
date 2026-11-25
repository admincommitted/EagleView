import { cn } from '@/lib/utils';
import { Checkbox, Field, Input, Label, NumberInput, SelectBox, Textarea } from '@/components/ui';

// form boxes of the chart of accounts screens: label above, the box below; side by side in a FieldRow they share the width
const FIELD_GROW = 'tw:md:flex-1';
export function TextField({ label, required, value, onChange, placeholder, upper, type = 'text', multiline, className }) {
  return (
    <Field layout="col" label={label} required={required} className={cn(FIELD_GROW, className)}>
      {multiline
        ? <Textarea rows={3} data-allow-text="" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
        : <Input type={type} data-allow-text="" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={cn(upper && 'tw:uppercase')} />}
    </Field>
  );
}

export function NumberField({ label, value, onChange, decimals, leftIcon }) {
  return (
    <Field layout="col" label={label} className={FIELD_GROW}>
      <NumberInput value={value} onValueChange={onChange} decimals={decimals} leftIcon={leftIcon} />
    </Field>
  );
}

export function SelectField({ label, required, value, onChange, options, emptyLabel, disabled, className }) {
  return (
    <Field layout="col" label={label} required={required} className={cn(FIELD_GROW, className)}>
      <SelectBox
        options={options}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        placeholder={emptyLabel}
        clearable={Boolean(emptyLabel)}
        clearLabel={emptyLabel}
        className="tw:w-full"
      />
    </Field>
  );
}

export function CheckField({ label, checked, onChange }) {
  return (
    <Label className="tw:cursor-pointer tw:font-medium tw:text-foreground/80">
      <Checkbox checked={Boolean(checked)} onCheckedChange={(state) => onChange(state === true)} />
      {label}
    </Label>
  );
}

// boxes side by side from tablet width, stacked on a phone
export function FieldRow({ children, className }) {
  return <div className={cn('tw:flex tw:flex-col tw:gap-4 tw:md:flex-row', className)}>{children}</div>;
}

// tinted panel for a group of check boxes or optional settings
export function OptionPanel({ children, className }) {
  return <div className={cn('tw:flex tw:flex-wrap tw:gap-x-6 tw:gap-y-3 tw:rounded-lg tw:border tw:border-border tw:bg-page tw:p-4', className)}>{children}</div>;
}
