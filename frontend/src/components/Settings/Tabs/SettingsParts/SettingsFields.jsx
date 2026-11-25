import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, ComboInput, Field, Input, SelectBox, Textarea } from '@/components/ui';
import { CheckboxField } from './CheckboxField';

const valueOf = (setting, values) => (typeof setting === 'function' ? setting(values) : setting);

function PasswordInput({ revealable, ...props }) {
  const [shown, setShown] = useState(false);
  if (!revealable) return <Input type="password" {...props} />;
  return (
    <div className="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-1">
      <Input type={shown ? 'text' : 'password'} {...props} />
      <Button variant="ghost" size="icon-sm" aria-label={shown ? 'Hide' : 'Show'} onClick={() => setShown(!shown)}>
        {shown ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
}

function FieldControl({ id, field, values, onChange }) {
  const { kind = 'text', name, required, maxLength, controlClassName } = field;
  const value = values[name] ?? '';
  const change = (next) => onChange(name, field.clean ? field.clean(next) : next);
  const common = {
    id, name, required, value,
    placeholder: valueOf(field.placeholder, values),
    'aria-invalid': valueOf(field.invalid, values) || undefined,
    className: controlClassName,
  };
  const typed = (event) => change(field.upper ? event.target.value.toUpperCase() : event.target.value);

  if (kind === 'select') {
    return <SelectBox {...common} className={cn('tw:w-full', controlClassName)} options={field.options} onValueChange={change} />;
  }
  if (kind === 'combo') return <ComboInput {...common} options={field.options} upper={field.upper} onValueChange={change} />;
  if (kind === 'textarea') return <Textarea {...common} data-allow-text="" rows={field.rows || 3} maxLength={maxLength} onChange={typed} />;
  if (kind === 'password') {
    return <PasswordInput {...common} revealable={field.revealable} leftIcon={field.leftIcon} data-allow-text="" onChange={typed} />;
  }
  return (
    <Input {...common} type={kind === 'email' || kind === 'number' ? kind : 'text'} leftIcon={field.leftIcon} data-allow-text=""
      maxLength={maxLength} onChange={typed} />
  );
}

/**
 * A grid of settings boxes driven by a config array.
 * field: { name, label, kind: 'text' | 'email' | 'number' | 'password' | 'select' | 'combo' | 'textarea' | 'checkbox',
 *          required, placeholder, note, invalid, options, rows, maxLength, upper, clean(text), revealable (password with
 *          a show button), leftIcon, className (the Field, e.g. a column span), labelClassName, controlClassName }
 * placeholder / note / invalid may be functions of the values. onChange(name, value) gets the plain value.
 */
export function SettingsFields({ fields, values, onChange, className }) {
  return (
    <div className={cn('tw:grid tw:grid-cols-1 tw:gap-3', className)}>
      {fields.map((field) => (field.kind === 'checkbox' ? (
        <CheckboxField key={field.name} className={field.className} label={field.label} note={valueOf(field.note, values)}
          checked={Boolean(values[field.name])} onCheckedChange={(checked) => onChange(field.name, checked)} />
      ) : (
        <Field key={field.name} layout="col" label={field.label} required={field.required} note={valueOf(field.note, values)}
          className={field.className} labelClassName={cn('tw:whitespace-normal', field.labelClassName)}>
          <FieldControl field={field} values={values} onChange={onChange} />
        </Field>
      )))}
    </div>
  );
}
