import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Checkbox, ComboInput, Field, Input, Label, SelectBox } from '@/components/ui';

const ROUND_OFF_OPTIONS = [{ value: '1', label: 'Round Off' }, { value: '0', label: 'No round off' }];
export function RoundOffSelect({ head, setField }) {
  return <SelectBox options={ROUND_OFF_OPTIONS} value={String(head.roundOff)} onValueChange={(value) => setField('roundOff', Number(value))} />;
}

// spans on the 8 / 12 column grids of the invoice screen (one column on a phone, two on a tablet)
const SPAN = {
  2: 'tw:sm:col-span-2 tw:lg:col-span-2',
  3: 'tw:sm:col-span-2 tw:lg:col-span-3',
  5: 'tw:sm:col-span-2 tw:lg:col-span-5',
  6: 'tw:sm:col-span-2 tw:lg:col-span-6',
};
export const GRID_8 = 'tw:grid tw:grid-cols-1 tw:gap-x-2 tw:gap-y-1.5 tw:sm:grid-cols-2 tw:lg:grid-cols-8';
export const GRID_12 = 'tw:grid tw:grid-cols-1 tw:items-end tw:gap-x-2 tw:gap-y-1.5 tw:sm:grid-cols-2 tw:lg:grid-cols-12';
export const GRID_6 = 'tw:grid tw:grid-cols-1 tw:items-end tw:gap-2 tw:sm:grid-cols-2 tw:lg:grid-cols-6';

export function GridField({ label, required, span, className, children }) {
  return (
    <Field label={label} required={required} layout="col" className={cn(SPAN[span], className)}
      labelClassName="tw:overflow-hidden tw:text-[10.5px] tw:font-bold tw:text-ellipsis tw:text-muted-foreground">
      {children}
    </Field>
  );
}

export function ReadOnlyBox({ value, title, placeholder, className }) {
  return <Input readOnly value={value} title={title} placeholder={placeholder} className={className} />;
}

export function CheckField({ label, checked, onCheckedChange, disabled, className }) {
  return (
    <Label className={cn('tw:h-[22px] tw:cursor-pointer tw:gap-1.5 tw:text-[11px] tw:font-semibold', disabled && 'tw:cursor-default tw:opacity-55', className)}>
      <Checkbox checked={!!checked} disabled={disabled} onCheckedChange={(value) => onCheckedChange(value === true)} /> {label}
    </Label>
  );
}

// a small set of buttons where one is chosen (in place of radio buttons); options: [[value, label]]
export function ChoiceButtons({ options, value, onChange, className }) {
  return (
    <span className={cn('tw:inline-flex tw:gap-1', className)}>
      {options.map(([optionValue, label]) => (
        <Button key={optionValue} size="sm" variant={value === optionValue ? 'default' : 'ghost'} className="tw:h-4 tw:px-1 tw:text-[10.5px]" onClick={() => onChange(optionValue)}>{label}</Button>
      ))}
    </span>
  );
}

const TONE = { bad: 'tw:text-destructive', ok: 'tw:text-success' };
// msg: { t: text, bad, ok }
export function StatusText({ msg, className }) {
  if (!msg) return null;
  return <span className={cn('tw:text-entry tw:font-bold', TONE[msg.bad ? 'bad' : msg.ok ? 'ok' : ''] || 'tw:text-foreground', className)}>{msg.t}</span>;
}

const SEARCH_DELAY_MS = 250;

// type-ahead whose list comes from the server: searches once minChars are typed, Enter / click picks
export function RemoteCombo({ value, onText, onPick, search, getValue, renderOption, minChars = 2, placeholder, required, disabled, className }) {
  const [options, setOptions] = useState([]);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const ask = (text) => {
    clearTimeout(timer.current);
    if (String(text).trim().length < minChars) { setOptions([]); return; }
    timer.current = setTimeout(async () => {
      try { setOptions((await search(text)) || []); } catch { setOptions([]); }
    }, SEARCH_DELAY_MS);
  };
  return (
    <ComboInput value={value} options={options} filter={() => true} getValue={getValue} renderOption={renderOption} limit={500}
      onValueChange={(text) => { onText(text); ask(text); }} onSelect={onPick}
      placeholder={placeholder} required={required && !value} disabled={disabled} className={className} listClassName="tw:min-w-[280px]" />
  );
}
