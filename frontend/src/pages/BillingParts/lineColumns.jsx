import { Trash2 } from 'lucide-react';
import { Button, Input, NumberInput, SelectBox } from '@/components/ui';
import LedgerPicker from './LedgerPicker';
import { inr } from './billingData';

/**
 * DataTable column builders shared by the line grids. Every editable cell calls onChange(row.id, key, value);
 * `cellProps(row)` adds per-row props (readOnly, disabled, aria-invalid...) to the box.
 */
const noProps = () => ({});

export const textColumn = ({ key, header, placeholder, onChange, cellProps = noProps, className }) => ({
  key, header, className: className || 'tw:min-w-[130px]',
  cell: (row) => (
    <Input data-allow-text="" placeholder={placeholder} value={row[key] ?? ''} onChange={(event) => onChange(row.id, key, event.target.value)} {...cellProps(row)} />
  ),
});

export const ledgerColumn = ({ key, header, ledgers, placeholder, onChange, showGroup, className }) => ({
  key, header, className: className || 'tw:min-w-[220px]',
  cell: (row) => (
    <LedgerPicker ledgers={ledgers} value={row[key]} placeholder={placeholder} showGroup={showGroup} onChange={(value) => onChange(row.id, key, value)} />
  ),
});

export const amountColumn = ({ key, header, onChange, placeholder = '0.00', cellProps = noProps, negative, className }) => ({
  key, header, align: 'right', className: className || 'tw:min-w-[110px]',
  cell: (row) => (
    <NumberInput align="right" negative={negative} placeholder={placeholder} value={row[key]} onValueChange={(value) => onChange(row.id, key, value)} {...cellProps(row)} />
  ),
});

export const choiceColumn = ({ key, header, options, onChange, disabled, className }) => ({
  key, header, className: className || 'tw:min-w-[100px]',
  cell: (row) => <SelectBox className="tw:w-full" options={options} value={row[key]} disabled={disabled} onValueChange={(value) => onChange(row.id, key, value)} />,
});

export const moneyColumn = ({ key, header, amount }) => ({
  key, header, align: 'right', className: 'tw:text-entry tw:font-bold tw:text-foreground', cell: (row) => inr(amount(row)),
});

/** findLedger(id) -> ledger; ledgers do not carry an `hsn` today, so the column shows '-' until they do. */
export const hsnColumn = ({ ledgerKey, findLedger, header = 'HSN/SAC' }) => ({
  key: 'hsn', header, className: 'tw:font-bold tw:text-muted-foreground', cell: (row) => findLedger(row[ledgerKey])?.hsn || '-',
});

export const removeColumn = (onRemove, title = 'Remove this line') => ({
  key: 'remove', header: '', align: 'center', width: 40,
  cell: (row) => (
    <Button variant="ghost" size="icon-sm" className="tw:text-destructive" title={title} aria-label={title} onClick={() => onRemove(row.id)}><Trash2 /></Button>
  ),
});
