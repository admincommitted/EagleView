import { Trash2 } from 'lucide-react';
import { Button, Input, NumberInput, SelectBox } from '@/components/ui';
import GstChargeInput from './GstChargeInput';

const TOP = 'tw:align-top';

/** Column configs for the editable rate grids; `update(id, field, value)` changes one box of one row. */
export const textColumn = (key, header, update, { placeholder, upper } = {}) => ({
  key,
  header,
  className: TOP,
  cell: (row) => (
    <Input data-allow-text="" className="tw:min-w-20" placeholder={placeholder} value={row[key]}
      onChange={(event) => update(row.id, key, upper ? event.target.value.toUpperCase() : event.target.value)} />
  ),
});

export const amountColumn = (key, header, update, { placeholder = '0.00', inputClassName, disabled } = {}) => ({
  key,
  header,
  align: 'right',
  className: TOP,
  cell: (row) => (
    <NumberInput align="right" className={inputClassName} placeholder={placeholder} value={row[key]}
      disabled={disabled?.(row)} onValueChange={(value) => update(row.id, key, value)} />
  ),
});

export const selectColumn = (key, header, update, options, { selectClassName, fallback } = {}) => ({
  key,
  header,
  className: TOP,
  cell: (row) => (
    <SelectBox className={selectClassName ?? 'tw:w-full'} options={options} value={row[key] || fallback} onValueChange={(value) => update(row.id, key, value)} />
  ),
});

export const gstChargeColumn = (key, header, update, gstCharges, placeholder) => ({
  key,
  header,
  className: TOP,
  cell: (row) => <GstChargeInput gstCharges={gstCharges} value={row[key]} placeholder={placeholder} onChange={(value) => update(row.id, key, value)} />,
});

export const removeColumn = (remove) => ({
  key: 'remove',
  header: '',
  width: '40px',
  align: 'center',
  className: TOP,
  cell: (row) => (
    <Button variant="ghost" size="icon-sm" className="tw:text-destructive" title="Remove line" onClick={() => remove(row.id)}><Trash2 /></Button>
  ),
});

export const headerWithNote = (title, note) => (
  <>
    {title}
    <br />
    <span className="tw:text-[9px] tw:font-normal tw:opacity-80">{note}</span>
  </>
);
