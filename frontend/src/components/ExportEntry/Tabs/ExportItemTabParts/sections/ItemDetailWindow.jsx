import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { asList } from '@/utils/asList';
import { Button, DataTable, DateInput, Field, Input, Modal, NumberInput, SelectBox, Textarea } from '@/components/ui';
import { DETAIL_WINDOWS, detailCount, fieldError, isBlank } from '../itemDetailWindows';

const YES_NO_OPTIONS = [{ value: 'N', label: 'N - No' }, { value: 'Y', label: 'Y - Yes' }];
const MAX_ERRORS_SHOWN = 4;
const SPAN_CLASSES = { 2: 'tw:sm:col-span-2', 4: 'tw:sm:col-span-2 tw:lg:col-span-4' };

const cleaned = (field, value) => {
  if (field.upper) return String(value).toUpperCase();
  if (field.digits) return String(value).replace(/\D/g, '');
  return value;
};

function DetailControl({ field, value, onChange }) {
  const invalid = !!fieldError(field, value) && (field.required || !isBlank(value));
  if (field.yesNo) return <SelectBox options={YES_NO_OPTIONS} value={value || 'N'} onValueChange={onChange} />;
  if (field.options) {
    return <SelectBox clearable clearLabel="Select" placeholder="Select" options={field.options.map(([code, label]) => ({ value: code, label }))} value={value || ''} onValueChange={onChange} />;
  }
  if (field.date) return <DateInput value={value || ''} onValueChange={onChange} />;
  if (field.area) {
    return <Textarea aria-invalid={invalid} className="tw:h-16" maxLength={field.max} value={value || ''} onChange={(event) => onChange(cleaned(field, event.target.value))} />;
  }
  if (field.number || field.digits) {
    return (
      <NumberInput aria-invalid={invalid} align={field.number ? 'right' : 'left'} decimals={field.digits ? 0 : undefined} maxLength={field.max}
        placeholder={field.placeholder} title={field.title} value={value ?? ''} onValueChange={onChange} />
    );
  }
  return (
    <Input aria-invalid={invalid} data-allow-text="" maxLength={field.max} placeholder={field.placeholder} title={field.title}
      value={value ?? ''} onChange={(event) => onChange(cleaned(field, event.target.value))} />
  );
}

const newRowId = () => String(Date.now() + Math.random());

/** The details window of a Y/N switch of the item (see DETAIL_WINDOWS). Cancel keeps nothing; a switch turned Y with no details goes back to N. */
export default function ItemDetailWindow({ which, onClose, formData, setFormData }) {
  const detail = DETAIL_WINDOWS[which];
  const [values, setValues] = useState(() => Object.fromEntries(detail.fields.map((field) => [field.key, formData[field.key] ?? (field.yesNo ? 'N' : '')])));
  const [rows, setRows] = useState(() => asList(formData[detail.rowsKey]).map((row, index) => ({ ...row, _id: row._id || `${Date.now()}-${index}` })));

  const cancel = () => {
    if (!detailCount(which, formData)) setFormData((previous) => ({ ...previous, [detail.flag]: 'N' }));
    onClose();
  };
  const confirm = () => {
    if (detail.kind === 'grid') {
      const filledRows = rows.filter((row) => detail.fields.some((field) => !isBlank(row[field.key])));
      const errors = filledRows.flatMap((row, index) => detail.fields.map((field) => fieldError(field, row[field.key])).filter(Boolean).map((error) => `Row ${index + 1}: ${error}`));
      if (errors.length) {
        toast.error(errors.slice(0, MAX_ERRORS_SHOWN).join('\n'), { duration: 5000 });
        return;
      }
      setFormData((previous) => ({ ...previous, [detail.rowsKey]: filledRows.map(({ _id, ...row }) => row), [detail.flag]: filledRows.length ? 'Y' : 'N' }));
    } else {
      const errors = detail.fields.map((field) => fieldError(field, values[field.key])).filter(Boolean);
      const anythingFilled = detail.fields.some((field) => !field.yesNo && !isBlank(values[field.key]));
      if (anythingFilled && errors.length) {
        toast.error(errors.slice(0, MAX_ERRORS_SHOWN).join('\n'), { duration: 5000 });
        return;
      }
      setFormData((previous) => ({ ...previous, ...values, [detail.flag]: anythingFilled ? 'Y' : 'N' }));
    }
    onClose();
  };

  const setRowValue = (rowId, key, value) => setRows((previous) => previous.map((row) => (row._id === rowId ? { ...row, [key]: value } : row)));
  const addRow = () => setRows((previous) => [...previous, { _id: newRowId(), ...Object.fromEntries(detail.fields.filter((field) => field.yesNo).map((field) => [field.key, 'N'])) }]);
  const columns = [
    { key: 'serial', header: '#', width: 34, cell: (row, index) => index + 1 },
    ...detail.fields.map((field) => ({
      key: field.key, header: field.label, width: field.width,
      cell: (row) => <DetailControl field={field} value={row[field.key]} onChange={(value) => setRowValue(row._id, field.key, value)} />,
    })),
    {
      key: 'remove', header: '', width: 40,
      cell: (row) => (
        <Button variant="ghost" size="icon-sm" className="tw:text-destructive" title="Remove row" aria-label="Remove row"
          onClick={() => setRows((previous) => previous.filter((other) => other._id !== row._id))}>
          <Trash2 />
        </Button>
      ),
    },
  ];

  return (
    <Modal
      open
      title={detail.title}
      description={`Item ${formData.invSr || 1}/${formData.itemSr || 1} · ${formData.desc || 'no description'} · ${detail.hint}`}
      width={detail.kind === 'grid' ? 980 : 820}
      closeOnOutside={false}
      onClose={cancel}
      footer={(
        <>
          <span className="tw:mr-auto tw:text-[11px] tw:text-muted-foreground">* needed by ICEGATE. OK with nothing filled sets the switch back to N.</span>
          <Button onClick={cancel}>Cancel</Button>
          <Button variant="success" onClick={confirm}>OK</Button>
        </>
      )}
    >
      {detail.kind === 'form' ? (
        <div className="tw:grid tw:grid-cols-1 tw:gap-x-3 tw:gap-y-2.5 tw:rounded-md tw:border tw:border-border tw:p-3 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
          {detail.fields.map((field) => (
            <Field key={field.key} label={<span title={field.label}>{field.label}</span>} layout="col" className={cn(SPAN_CLASSES[field.span])}>
              <DetailControl field={field} value={values[field.key]} onChange={(value) => setValues((previous) => ({ ...previous, [field.key]: value }))} />
            </Field>
          ))}
        </div>
      ) : (
        <>
          <DataTable columns={columns} rows={rows} rowKey="_id" emptyText="No row yet - click Add row." containerClassName="tw:rounded-md tw:border tw:border-border" />
          <div>
            <Button variant="default" disabled={rows.length >= detail.maxRows} onClick={addRow}><Plus /> Add row</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
