import { Database, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Checkbox, Input, Label, Modal } from '@/components/ui';
import { DB_FIELDS, CUSTOM_FIELD_ENTRY } from '../DB_FIELDS';

const PICKABLE_FIELDS = DB_FIELDS.filter((field) => field !== CUSTOM_FIELD_ENTRY);

function FieldCard({ field, selected, onToggle }) {
  return (
    <Label
      className={cn(
        'tw:flex tw:cursor-pointer tw:items-center tw:gap-3 tw:whitespace-normal tw:rounded-lg tw:border tw:px-3 tw:py-2.5 tw:transition-all',
        selected ? 'tw:border-blue-200 tw:bg-blue-50' : 'tw:border-slate-200 tw:bg-white'
      )}
    >
      <Checkbox className="tw:size-4" checked={selected} onCheckedChange={onToggle} />
      <span className="tw:flex tw:min-w-0 tw:flex-col">
        <span className={cn('tw:break-all tw:text-[13px]', selected ? 'tw:font-semibold tw:text-blue-700' : 'tw:font-medium tw:text-slate-700')}>{field.title}</span>
        <span className="tw:text-[10px] tw:font-semibold tw:uppercase tw:text-slate-500">{field.subtitle}</span>
      </span>
    </Label>
  );
}

export default function DatabaseFieldSelectorSection({ open, onClose, searchQuery, onSearchChange, selectedFieldIds, onToggleField }) {
  const query = searchQuery.toLowerCase();
  const shownFields = PICKABLE_FIELDS.filter((field) => field.title.toLowerCase().includes(query) || field.subtitle.toLowerCase().includes(query));
  const databaseFieldCount = selectedFieldIds.filter((fieldId) => !fieldId.startsWith('custom_')).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={900}
      title={<span className="tw:flex tw:items-center tw:gap-3"><Database className="tw:size-6 tw:text-blue-500" /> Database Field Selector</span>}
      description="Select the fields you want to import into your DSR."
      className="tw:normal-case"
      bodyClassName="tw:flex tw:h-[70vh] tw:flex-col tw:gap-4 tw:p-0"
      footer={(
        <div className="tw:flex tw:w-full tw:items-center tw:justify-between tw:gap-3">
          <span className="tw:text-[13px] tw:font-semibold tw:text-blue-500">{databaseFieldCount} Database Fields Selected</span>
          <Button variant="default" size="lg" className="tw:px-6" onClick={onClose}>Done</Button>
        </div>
      )}
    >
      <div className="tw:px-4 tw:pt-3 tw:md:px-6">
        <Input
          leftIcon={Search}
          data-allow-text=""
          className="tw:h-9 tw:text-sm"
          placeholder="Search 350+ fields (e.g. 'jobNo', 'port', 'invoice')..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <div className="tw:flex-1 tw:overflow-auto tw:bg-slate-50 tw:p-4 tw:md:p-6">
        <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] tw:gap-3">
          {shownFields.map((field) => (
            <FieldCard key={field.title} field={field} selected={selectedFieldIds.includes(field.title)} onToggle={() => onToggleField(field.title)} />
          ))}
        </div>
      </div>
    </Modal>
  );
}
