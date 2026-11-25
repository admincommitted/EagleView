import { Briefcase } from 'lucide-react';
import { Badge, Checkbox, Field, Input } from '@/components/ui';
import { MasterPage } from './masterKit/MasterPage';
import { activeColumn, masterActionsColumn } from './masterKit/masterColumns';
import { useMasterRecords } from './masterKit/useMasterRecords';

const EMPTY_BOND = { id: '', bondCode: '', description: '', isActive: true };
const SEARCH_FIELDS = ['bondCode', 'description'];

const validateBond = (bond) => (!bond.bondCode || !bond.description ? 'Please fill the required fields (*)' : '');

const LIST = {
  title: 'Search Bond',
  searchPlaceholder: 'Search Code or Desc...',
  primaryText: (bond) => bond.bondCode,
  secondaryText: (bond) => bond.description,
};

export default function BondMasterForm() {
  const master = useMasterRecords({
    resource: 'bonds',
    emptyRecord: EMPTY_BOND,
    searchFields: SEARCH_FIELDS,
    validate: validateBond,
    describe: (bond) => `bond code ${bond.bondCode || ''}`,
  });
  const { form, setField } = master;

  const columns = [
    { key: 'bondCode', header: 'Bond Code', cell: (bond) => <Badge variant="info">{bond.bondCode}</Badge> },
    { key: 'description', header: 'Description', className: 'tw:font-semibold' },
    activeColumn,
    masterActionsColumn({ onEdit: master.editRecord, onSwitch: master.switchActive }),
  ];

  return (
    <MasterPage master={master} list={LIST} icon={Briefcase} formTitle="Bond Master" columns={columns} emptyText="No Bond records found.">
      <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-4 tw:md:grid-cols-[1fr_2fr_1fr]">
        <Field label="Bond Code" required layout="col">
          <Input required placeholder="e.g. EC" className="tw:uppercase" data-allow-text="" value={form.bondCode}
            onChange={(event) => setField('bondCode')(event.target.value.toUpperCase())} />
        </Field>
        <Field label="Description" required layout="col">
          <Input required placeholder="e.g. EPCG BOND" data-allow-text="" value={form.description}
            onChange={(event) => setField('description')(event.target.value.toUpperCase())} />
        </Field>
        <Field label="Is Active" layout="row" className="tw:pb-1">
          <Checkbox checked={Boolean(form.isActive)} onCheckedChange={(checked) => setField('isActive')(checked === true)} />
        </Field>
      </div>
      <p className="tw:mt-4 tw:mb-0 tw:text-[11px] tw:text-muted-foreground">
        * USED FOR HIGH-SPEED CACHED PAYLOAD GENERATION. LOADED VIA IN-MEMORY CACHING DURING JOB ENTRY.
      </p>
    </MasterPage>
  );
}
