import { Briefcase } from 'lucide-react';
import { Badge, Checkbox, Field, Input } from '@/components/ui';
import { MasterPage } from './masterKit/MasterPage';
import { activeColumn, masterActionsColumn } from './masterKit/masterColumns';
import { useMasterRecords } from './masterKit/useMasterRecords';

const EMPTY_LINE = { id: '', code: '', name: '', isActive: true };
const LIST_PARAMS = { all: 1 };
const SEARCH_FIELDS = ['code', 'name'];

const validateLine = (line) => (!line.code || !line.name ? 'Please fill the required fields (*)' : '');

const describeLine = (line) => `shipping line ${line.lineCode || line.code || ''} ${line.lineName || line.name || ''}`;

const LIST = {
  title: 'Search Shipping Line',
  searchPlaceholder: 'Search Code or Desc...',
  primaryText: (line) => line.code,
  secondaryText: (line) => line.name,
};

export default function ShippingLineMasterForm() {
  const master = useMasterRecords({
    resource: 'shippinglines',
    emptyRecord: EMPTY_LINE,
    listParams: LIST_PARAMS,
    searchFields: SEARCH_FIELDS,
    validate: validateLine,
    describe: describeLine,
  });
  const { form, setField } = master;

  const columns = [
    { key: 'code', header: 'Line Code', cell: (line) => <Badge variant="info">{line.code}</Badge> },
    { key: 'name', header: 'Name', className: 'tw:font-semibold' },
    activeColumn,
    masterActionsColumn({ onEdit: master.editRecord, onSwitch: master.switchActive }),
  ];

  return (
    <MasterPage master={master} list={LIST} icon={Briefcase} formTitle="Add/Edit Shipping Line Master" columns={columns} emptyText="No shipping lines found.">
      <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-4 tw:md:grid-cols-[1fr_2fr_1fr]">
        <Field label="Line Code" required layout="col">
          <Input required placeholder="e.g. SPL/56" className="tw:uppercase" data-allow-text="" value={form.code}
            onChange={(event) => setField('code')(event.target.value.toUpperCase())} />
        </Field>
        <Field label="Shipping Line Name" required layout="col">
          <Input required placeholder="e.g. MAERSK LINE INDIA PVT LTD" data-allow-text="" value={form.name}
            onChange={(event) => setField('name')(event.target.value.toUpperCase())} />
        </Field>
        <Field label="Is Active" layout="row" className="tw:pb-1">
          <Checkbox checked={Boolean(form.isActive)} onCheckedChange={(checked) => setField('isActive')(checked === true)} />
        </Field>
      </div>
      <p className="tw:mt-4 tw:mb-0 tw:text-[11px] tw:text-muted-foreground">
        * SHIPPING LINE CODES (SPL/...) AS USED IN ICEGATE EXPORT SEA. LOADED FROM ICAFFE 04-NOV-2026.
      </p>
    </MasterPage>
  );
}
