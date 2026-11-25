import { Field, Input } from '@/components/ui';

const CASES = {
  upper: (text) => text.toUpperCase(),
  lower: (text) => text.toLowerCase(),
};

// field: { key, label, required, textCase: 'upper' | 'lower', className }
export default function CasedTextField({ field, value, onValueChange }) {
  const toCase = CASES[field.textCase] || ((text) => text);
  return (
    <Field label={field.label} required={field.required} labelWidth="110px" className={field.className}>
      <Input required={field.required} data-allow-text="" className={field.textCase === 'upper' ? 'tw:uppercase' : undefined}
        value={value || ''} onChange={(event) => onValueChange(toCase(event.target.value))} />
    </Field>
  );
}
