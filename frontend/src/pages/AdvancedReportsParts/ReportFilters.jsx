import { Button, Field, Input, NumberInput } from '@/components/ui';

export default function ReportFilters({ text, onTextChange, minAmount, onMinAmountChange, onClear, onReload }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-3 tw:border-b tw:border-border tw:bg-page tw:px-5 tw:py-3.5 tw:md:flex-row tw:md:flex-wrap tw:md:items-end">
      <Field layout="col" label="Client / job / head contains">
        <Input data-allow-text="" className="tw:md:w-56" value={text} placeholder="e.g. Maersk" onChange={(event) => onTextChange(event.target.value)} />
      </Field>
      <Field layout="col" label="Minimum amount (₹)">
        <NumberInput className="tw:md:w-36" value={minAmount} placeholder="0" negative onValueChange={onMinAmountChange} />
      </Field>
      <div className="tw:flex tw:gap-2">
        <Button onClick={onClear}>Clear</Button>
        <Button variant="default" onClick={onReload}>Reload</Button>
      </div>
    </div>
  );
}
