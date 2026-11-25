import { cn } from '@/lib/utils';
import { DateInput, Field, Input, NumberInput, SelectBox, Textarea } from '@/components/ui';

/**
 * field: { name, label, kind: 'text' | 'email' | 'number' | 'date' | 'select' | 'textarea', required, placeholder,
 *          options, clearLabel (select with an empty choice), rows, maxLength, readOnly, upper, clean(text),
 *          note, className (the Field), labelClassName, controlClassName }
 * onChange(name, value) gets the plain value of every kind of box.
 */
function FieldControl({ id, field, value, onChange, inputRef }) {
  const { kind = 'text', name, placeholder, required, readOnly, maxLength, controlClassName: className } = field;
  const change = (next) => onChange(name, field.clean ? field.clean(next) : next);
  const common = { id, name, required, placeholder, readOnly, className, value: value ?? '' };

  if (kind === 'number') return <NumberInput {...common} maxLength={maxLength} onValueChange={change} />;
  if (kind === 'date') return <DateInput id={id} name={name} required={required} className={className} value={value} onValueChange={change} />;
  if (kind === 'select') {
    return (
      <SelectBox id={id} name={name} required={required} className={cn('tw:w-full', className)} value={value} options={field.options}
        clearable={field.clearLabel != null} clearLabel={field.clearLabel} placeholder={field.clearLabel || placeholder || 'Select...'}
        onValueChange={change} />
    );
  }
  if (kind === 'textarea') {
    return <Textarea {...common} ref={inputRef} data-allow-text="" rows={field.rows || 3} maxLength={maxLength} onChange={(event) => change(event.target.value)} />;
  }
  return (
    <Input {...common} ref={inputRef} type={kind === 'email' ? 'email' : 'text'} data-allow-text="" maxLength={maxLength}
      onChange={(event) => change(field.upper ? event.target.value.toUpperCase() : event.target.value)} />
  );
}

export function FormField({ field, value, onChange, layout = 'col', labelWidth, inputRef }) {
  return (
    <Field label={field.label} required={field.required} note={field.note} layout={layout} labelWidth={labelWidth}
      className={field.className} labelClassName={field.labelClassName}>
      <FieldControl inputRef={inputRef} field={field} value={value} onChange={onChange} />
    </Field>
  );
}

/** A grid of form fields driven by a config array; `className` sets the grid columns. */
export default function FormFields({ fields, values, onChange, className, layout, labelWidth, inputRefs = {} }) {
  return (
    <div className={cn('tw:grid tw:grid-cols-1 tw:gap-2', className)}>
      {fields.map((field) => (
        <FormField key={field.name} field={field} value={values[field.name]} onChange={onChange}
          layout={layout} labelWidth={labelWidth} inputRef={inputRefs[field.name]} />
      ))}
    </div>
  );
}
