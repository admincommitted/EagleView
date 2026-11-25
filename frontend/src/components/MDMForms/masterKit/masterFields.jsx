import { Button, Checkbox, DateInput, Field, Input, NumberInput, SelectBox } from '@/components/ui';
import { isActiveRecord } from './masterColumns';

// Form boxes bound to one key of a useMasterRecords form: master.form[name] / master.setField(name)

export function TextField({ master, name, label, required, upper = false, className, inputClassName, ...inputProps }) {
  return (
    <Field label={label} required={required} layout="col" className={className}>
      <Input required={required} data-allow-text="" className={upper ? `tw:uppercase ${inputClassName || ''}` : inputClassName}
        value={master.form[name] ?? ''}
        onChange={(event) => master.setField(name)(upper ? event.target.value.toUpperCase() : event.target.value)} {...inputProps} />
    </Field>
  );
}

export function NumberField({ master, name, label, required, className, ...inputProps }) {
  return (
    <Field label={label} required={required} layout="col" className={className}>
      <NumberInput required={required} value={master.form[name]} onValueChange={master.setField(name)} {...inputProps} />
    </Field>
  );
}

export function SelectField({ master, name, label, required, options, className }) {
  return (
    <Field label={label} required={required} layout="col" className={className}>
      <SelectBox options={options} required={required} value={master.form[name]} onValueChange={master.setField(name)} />
    </Field>
  );
}

export function DateField({ master, name, label, required, className }) {
  return (
    <Field label={label} required={required} layout="col" className={className}>
      <DateInput required={required} value={String(master.form[name] || '').slice(0, 10)} onValueChange={master.setField(name)} />
    </Field>
  );
}

export function CheckField({ master, name = 'isActive', label = 'Is Active', className = 'tw:pb-1' }) {
  return (
    <Field label={label} layout="row" className={className}>
      <Checkbox checked={Boolean(master.form[name])} onCheckedChange={(checked) => master.setField(name)(checked === true)} />
    </Field>
  );
}

// Switch off / on of the row open in the form (shown once it is saved)
export function SwitchFormButton({ master }) {
  if (!master.form.id) return null;
  return (
    <Button size="lg" className="tw:text-destructive" onClick={() => master.switchActive(master.form)}>
      {isActiveRecord(master.form) ? 'Switch off' : 'Switch on'}
    </Button>
  );
}
