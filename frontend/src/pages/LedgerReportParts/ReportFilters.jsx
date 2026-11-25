import { DateInput, Field, SearchSelect } from '@/components/ui';

export function PeriodFilter({ label, from, to, onFromChange, onToChange, separator = '-' }) {
  return (
    <Field label={label} labelClassName="tw:font-semibold tw:text-muted-foreground">
      <div className="tw:flex tw:items-center tw:gap-2">
        <DateInput wrapperClassName="tw:w-32" value={from} onValueChange={onFromChange} />
        <span className="tw:text-entry tw:text-muted-foreground">{separator}</span>
        <DateInput wrapperClassName="tw:w-32" value={to} onValueChange={onToChange} />
      </div>
    </Field>
  );
}

export function LedgerPicker({ label, ledgers, value, onValueChange, placeholder }) {
  const options = ledgers.map((ledger) => ({ value: String(ledger.id), label: ledger.name }));
  return (
    <Field label={label} labelClassName="tw:font-semibold tw:text-muted-foreground">
      <SearchSelect
        className="tw:w-full tw:md:w-[300px]"
        options={options}
        value={value}
        onValueChange={onValueChange}
        placeholder={placeholder}
      />
    </Field>
  );
}
