import { Info, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, ComboInput, DataTable, DateInput, Field, Input, Modal, NumberInput, SelectBox } from '@/components/ui';

/**
 * box: { key, label, kind: 'text' | 'number' | 'date' | 'select' | 'combo', required, hint, placeholder, maxLength,
 *        decimals, options, getOptionValue, getOptionLabel, clean(value), onSearch, className, fieldClassName }
 * onChange(key, value) receives the plain (cleaned) value of every kind of box.
 */
function EntryBox({ id, box, value, onChange }) {
  const { kind = 'text', required, placeholder, maxLength, options, className } = box;
  const change = (nextValue) => onChange(box.key, box.clean ? box.clean(nextValue) : nextValue);
  const text = value ?? '';
  if (kind === 'number') {
    return <NumberInput id={id} value={text} required={required} decimals={box.decimals} maxLength={maxLength} placeholder={placeholder} className={className} onValueChange={change} />;
  }
  if (kind === 'date') return <DateInput id={id} value={text} required={required} className={className} onValueChange={change} />;
  if (kind === 'select') {
    return <SelectBox id={id} value={text} required={required} options={options} placeholder={placeholder ?? 'Select'} className={className} onValueChange={change} />;
  }
  if (kind === 'combo') {
    return (
      <ComboInput id={id} value={text} required={required} options={options} getValue={box.getOptionValue} getLabel={box.getOptionLabel}
        maxLength={maxLength} placeholder={placeholder} className={className} onValueChange={change} />
    );
  }
  return <Input id={id} value={text} required={required} maxLength={maxLength} placeholder={placeholder} className={className} onChange={(event) => change(event.target.value)} />;
}

function EntryFields({ boxes, values, onChange, layout = 'col', labelWidth, className }) {
  return (
    <div className={cn('tw:grid tw:grid-cols-1 tw:items-end tw:gap-2', className)}>
      {boxes.map((box) => (
        <Field key={box.key} label={box.label} required={box.required} hint={box.hint} layout={layout} labelWidth={labelWidth} className={box.fieldClassName}>
          <EntryBox box={box} value={values[box.key]} onChange={onChange} />
          {box.onSearch && (
            <Button variant="ghost" size="icon-sm" title="Search" aria-label="Search" onClick={box.onSearch}><Info /></Button>
          )}
        </Field>
      ))}
    </div>
  );
}

function AddButton({ onClick, label = 'Add', variant = 'default' }) {
  return <Button variant={variant} onClick={onClick}><Plus /> {label}</Button>;
}

/** A popup with entry boxes, an action row (Add ...) and the grid of rows already added. */
function EntryGridModal({
  open, title, width, onClose, onOk, footer,
  boxes, values, onChange, layout, labelWidth, boxesClassName, actions,
  columns, rows, emptyText, gridClassName,
}) {
  return (
    <Modal open={open} title={title} width={width} onClose={onClose} onOk={onOk} okLabel="Ok" footer={footer} closeOnOutside={false}>
      <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded-sm tw:border tw:border-border tw:bg-page tw:p-2">
        <EntryFields boxes={boxes} values={values} onChange={onChange} layout={layout} labelWidth={labelWidth} className={boxesClassName} />
        <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-2">{actions}</div>
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(_, index) => index} emptyText={emptyText}
        containerClassName={cn('tw:rounded-sm tw:border tw:border-border', gridClassName)} />
    </Modal>
  );
}

export { EntryFields, EntryGridModal, AddButton };
