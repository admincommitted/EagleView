import { Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, ComboInput, DataTable, DateInput, Field, Input, Modal, NumberInput, SelectBox } from '@/components/ui';

/**
 * field: { name, label, kind: 'text' | 'number' | 'date' | 'select' | 'combo', required, placeholder, className,
 *          options, getOptionValue, getOptionLabel, upper, onSearch }
 * onChange(name, value) receives the plain value of every kind of box.
 */
function EntryControl({ id, field, value, onChange }) {
  const { kind = 'text', name, required, placeholder, options } = field;
  const change = (nextValue) => onChange(name, nextValue);
  const common = { id, name, required, value };
  if (kind === 'date') return <DateInput {...common} placeholder={placeholder} onValueChange={change} />;
  if (kind === 'number') return <NumberInput {...common} placeholder={placeholder} onValueChange={change} />;
  if (kind === 'select') return <SelectBox {...common} placeholder="Select" clearable clearLabel="Select" options={options} onValueChange={change} />;
  if (kind === 'combo') {
    return (
      <ComboInput {...common} placeholder={placeholder} upper={field.upper} options={options}
        getValue={field.getOptionValue} getLabel={field.getOptionLabel} onValueChange={change} />
    );
  }
  return <Input {...common} placeholder={placeholder} onChange={(event) => change(event.target.value)} />;
}

function SearchButton({ onClick }) {
  return <Button variant="ghost" size="icon-sm" title="Search" aria-label="Search" onClick={onClick}><Search /></Button>;
}

function EntryField({ field, value, onChange }) {
  return (
    <Field label={field.label} required={field.required} layout="col" className={field.className || 'tw:flex-1'}>
      <EntryControl field={field} value={value} onChange={onChange} />
      {field.onSearch && <SearchButton onClick={field.onSearch} />}
    </Field>
  );
}

/** A popup with one or more rows of entry boxes, an Add / Update button and the grid of rows already added. */
function GridEntryModal({
  open, title, width, onClose, footer,
  fieldRows, values, onFieldChange, addLabel = 'Add', onAdd,
  columns, rows, rowKey = (_, index) => index, selectedKey, emptyText, gridClassName = 'tw:min-h-[150px]',
}) {
  return (
    <Modal open={open} title={title} width={width} onClose={onClose} onOk={onClose} footer={footer} closeOnOutside={false}>
      <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded-sm tw:border tw:border-border tw:bg-page tw:p-2">
        {fieldRows.map((fields, rowIndex) => (
          <div key={fields[0].name} className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-end">
            {fields.map((field) => <EntryField key={field.name} field={field} value={values[field.name] || ''} onChange={onFieldChange} />)}
            {rowIndex === fieldRows.length - 1 && <Button variant="default" onClick={onAdd}><Plus /> {addLabel}</Button>}
          </div>
        ))}
      </div>
      <DataTable columns={columns} rows={rows} rowKey={rowKey} selectedKey={selectedKey} emptyText={emptyText}
        containerClassName={cn('tw:rounded-sm tw:border tw:border-border', gridClassName)} />
    </Modal>
  );
}

export { GridEntryModal, EntryField, SearchButton };
