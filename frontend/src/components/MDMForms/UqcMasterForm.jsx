import { Scale } from 'lucide-react';
import { Badge, Checkbox, Field, Input } from '@/components/ui';
import { MasterPage } from './masterKit/MasterPage';
import { activeColumn, masterActionsColumn } from './masterKit/masterColumns';
import { useMasterRecords } from './masterKit/useMasterRecords';

const EMPTY_UQC = { id: '', uqcCode: '', description: '', isActive: true };
const SEARCH_FIELDS = ['uqcCode', 'description'];
const UQC_CODE = /^[A-Z]{2,4}$/;

const validateUqc = (uqc) => {
  if (!uqc.uqcCode || !uqc.description) return 'Please fill the required fields (*)';
  if (!UQC_CODE.test(String(uqc.uqcCode).trim().toUpperCase())) return 'UQC code: 2-4 letters as in the CBIC UQC list (e.g. KGS, NOS)';
  return '';
};

const LIST = {
  title: 'Search UQC',
  searchPlaceholder: 'Search Code or Desc...',
  primaryText: (uqc) => uqc.uqcCode,
  secondaryText: (uqc) => uqc.description,
};

export default function UqcMasterForm() {
  const master = useMasterRecords({
    resource: 'uqcs',
    emptyRecord: EMPTY_UQC,
    searchFields: SEARCH_FIELDS,
    validate: validateUqc,
    describe: (uqc) => `UQC ${uqc.uqcCode || uqc.code || ''}`,
  });
  const { form, setField } = master;

  const columns = [
    { key: 'uqcCode', header: 'UQC Code', cell: (uqc) => <Badge variant="info">{uqc.uqcCode}</Badge> },
    { key: 'description', header: 'Description', className: 'tw:font-semibold' },
    activeColumn,
    masterActionsColumn({ onEdit: master.editRecord, onSwitch: master.switchActive }),
  ];

  return (
    <MasterPage master={master} list={LIST} icon={Scale} formTitle="Add/Edit UQC (Unit of Measurement)" columns={columns} emptyText="No UQC records found.">
      <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-4 tw:md:grid-cols-[1fr_2fr_1fr]">
        <Field label="UQC Code" required layout="col">
          <Input required placeholder="e.g. KGS" className="tw:uppercase" data-allow-text="" value={form.uqcCode}
            onChange={(event) => setField('uqcCode')(event.target.value.toUpperCase())} />
        </Field>
        <Field label="Description" required layout="col">
          <Input required placeholder="e.g. KILOGRAMS" data-allow-text="" value={form.description}
            onChange={(event) => setField('description')(event.target.value.toUpperCase())} />
        </Field>
        <Field label="Is Active" layout="row" className="tw:pb-1">
          <Checkbox checked={Boolean(form.isActive)} onCheckedChange={(checked) => setField('isActive')(checked === true)} />
        </Field>
      </div>
    </MasterPage>
  );
}
