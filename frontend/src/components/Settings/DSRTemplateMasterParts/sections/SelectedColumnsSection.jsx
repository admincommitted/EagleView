import { ArrowDown, ArrowUp, Database, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Field, Input } from '@/components/ui';

const COLUMN_LABEL = 'tw:text-[10px] tw:font-bold tw:uppercase tw:text-slate-400 tw:whitespace-normal';
const isManualField = (column) => column.field.startsWith('custom_');

function ColumnRow({ column, index, isLast, onMoveColumn, onUpdateColumn, onRemoveColumn }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-3 tw:rounded-md tw:border tw:border-slate-200 tw:bg-white tw:px-3 tw:py-2 tw:md:flex-row tw:md:items-center">
      <div className="tw:flex tw:gap-0.5 tw:md:flex-col">
        <Button variant="ghost" size="icon" title="Move up" disabled={index === 0} onClick={() => onMoveColumn(index, -1)}><ArrowUp className="tw:size-4" /></Button>
        <Button variant="ghost" size="icon" title="Move down" disabled={isLast} onClick={() => onMoveColumn(index, 1)}><ArrowDown className="tw:size-4" /></Button>
      </div>

      <Field label="Display Header Name (Editable)" layout="col" className="tw:min-w-0 tw:md:flex-2" labelClassName={COLUMN_LABEL}>
        <Input data-allow-text="" className="tw:font-semibold tw:text-slate-900" value={column.header} onChange={(event) => onUpdateColumn(column.id, 'header', event.target.value)} />
      </Field>

      <Field label="Database Field Mapping" layout="col" className="tw:min-w-0 tw:md:flex-1" labelClassName={COLUMN_LABEL}>
        <div
          title={column.field}
          className={cn(
            'tw:w-full tw:truncate tw:rounded tw:border tw:border-slate-200 tw:px-3 tw:py-1.5 tw:text-xs tw:text-slate-700',
            isManualField(column) ? 'tw:bg-amber-100' : 'tw:bg-slate-100'
          )}
        >
          {isManualField(column) ? '✏️ USER DEFINED MANUAL FIELD' : `🔗 ${column.field}`}
        </div>
      </Field>

      <Field label="Formula / Default Value" layout="col" className="tw:min-w-0 tw:md:flex-1" labelClassName={COLUMN_LABEL}>
        <Input data-allow-text="" className="tw:font-mono tw:text-xs tw:text-slate-900" placeholder="e.g. =C2*0.18 or leave blank"
          value={column.formula || ''} onChange={(event) => onUpdateColumn(column.id, 'formula', event.target.value)} />
      </Field>

      <div className="tw:flex tw:items-center tw:md:border-l tw:md:border-slate-200 tw:md:pl-2">
        <Button variant="destructive" size="icon" className="tw:size-8" title="Remove Column" onClick={() => onRemoveColumn(column.id)}><Trash2 className="tw:size-[18px]" /></Button>
      </div>
    </div>
  );
}

export default function SelectedColumnsSection({ columns, onOpenFieldSelector, onAddColumn, onMoveColumn, onUpdateColumn, onRemoveColumn }) {
  return (
    <div>
      <div className="tw:mt-6 tw:mb-4 tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-center tw:md:justify-between">
        <h3 className="tw:m-0 tw:text-[15px] tw:text-slate-800">Selected DSR Columns ({columns.length})</h3>
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <Button variant="default" size="lg" className="tw:text-xs" onClick={onOpenFieldSelector}><Database /> Select DB Fields</Button>
          <Button variant="secondary" size="lg" className="tw:text-xs" onClick={onAddColumn}><Plus /> Add Manual Field</Button>
        </div>
      </div>

      <div className="tw:flex tw:flex-col tw:gap-2">
        {columns.length === 0 ? (
          <div className="tw:rounded-lg tw:border tw:border-dashed tw:border-slate-300 tw:bg-slate-50 tw:p-6 tw:text-center tw:text-slate-500 tw:md:p-12">
            No columns selected. Click "Select DB Fields" to pick from the database, or "Add Manual Field" to create your own editable column.
          </div>
        ) : (
          columns.map((column, index) => (
            <ColumnRow
              key={column.id}
              column={column}
              index={index}
              isLast={index === columns.length - 1}
              onMoveColumn={onMoveColumn}
              onUpdateColumn={onUpdateColumn}
              onRemoveColumn={onRemoveColumn}
            />
          ))
        )}
      </div>
    </div>
  );
}
