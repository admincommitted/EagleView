import { useEffect, useMemo, useState } from 'react';
import { Plus, Settings, Table2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Button, Checkbox, DataTable, Field, Input, Label, NumberInput, Section, SelectBox } from '@/components/ui';
import { MasterPage } from './masterKit/MasterPage';
import { masterActionsColumn } from './masterKit/masterColumns';
import { mastersFormApi, masterRecordsApi } from './masterKit/masterRecordsApi';

const EMPTY_HEADER = { id: null, hsnCode: '', dutyType: 'CUSTOMS', description: '', isGstApplicable: true };
const EMPTY_COMPONENT = { dutyCategory: 'CVD', calculationFlag: 'Advalorem', rate: '', amount: '', uqc: '' };
const DUTY_CATEGORIES = ['CVD', 'HEALTH_CESS', 'NCD', 'INFRA_CESS', 'GREEN_CESS'];
const CALCULATION_FLAGS = ['Advalorem', 'Specific', 'Blank'];

const headerFormOf = (header) => ({
  id: header.id,
  hsnCode: header.hsnCode,
  dutyType: header.dutyType || 'CUSTOMS',
  description: header.description || '',
  isGstApplicable: header.isGstApplicable,
});
const withoutEmptyId = ({ id, ...header }) => (id ? { id, ...header } : header);

const LIST = {
  title: 'Search CETH',
  searchPlaceholder: 'Search CETH...',
  primaryText: (header) => header.hsnCode,
  secondaryText: (header) => `GST: ${header.isGstApplicable ? 'Yes' : 'No'} | Duties: ${header.components?.length || 0}`,
};

const COMPONENT_COLUMNS = [
  { key: 'dutyCategory', header: 'Duty Type', className: 'tw:font-semibold' },
  { key: 'calculationFlag', header: 'Flag' },
  { key: 'rate', header: 'Rate (%)', align: 'right', cell: (component) => component.rate || '-' },
  { key: 'amount', header: 'Amount (Rs)', align: 'right', cell: (component) => component.amount || '-' },
  { key: 'uqc', header: 'UQC', align: 'center', cell: (component) => component.uqc || '-' },
];

export default function CethMasterForm() {
  const [headers, setHeaders] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_HEADER);
  const [saving, setSaving] = useState(false);
  const [componentForm, setComponentForm] = useState(EMPTY_COMPONENT);

  const loadHeaders = async () => {
    try {
      const data = await mastersFormApi.tariffHeadersWithComponents();
      setHeaders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    }
  };
  useEffect(() => { loadHeaders(); }, []);

  const filtered = useMemo(() => headers.filter((header) => header.hsnCode?.includes(search)), [headers, search]);
  const headerSaved = Boolean(form.id);
  const components = headers.find((header) => header.id === form.id)?.components || [];
  const setComponentField = (name) => (value) => setComponentForm((current) => ({ ...current, [name]: value }));

  const saveHeader = async () => {
    if (!form.hsnCode) {
      toast.error('CETH/HSN Code is required');
      return;
    }
    setSaving(true);
    try {
      const body = withoutEmptyId(form);
      const saved = form.id ? await masterRecordsApi.update('tariffheaders', form.id, body) : await masterRecordsApi.create('tariffheaders', body);
      toast.success('Header saved!');
      await loadHeaders();
      setForm(saved);
    } catch (error) {
      toast.error(`Failed to save header: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const addComponent = async () => {
    if (!headerSaved) {
      toast.error('Please save the header first!');
      return;
    }
    if (!componentForm.dutyCategory || !componentForm.calculationFlag) {
      toast.error('Duty Type and Flag are required');
      return;
    }
    try {
      await mastersFormApi.addTariffComponent({ ...componentForm, tariffHeaderId: form.id });
      setComponentForm(EMPTY_COMPONENT);
      loadHeaders();
    } catch (error) {
      toast.error(`Failed to add component: ${errorMessage(error)}`);
    }
  };

  const removeComponent = async (componentId) => {
    try {
      await mastersFormApi.deleteTariffComponent(componentId);
      loadHeaders();
    } catch (error) {
      console.error(error);
    }
  };

  const master = {
    filtered,
    search,
    setSearch,
    form,
    saving,
    save: saveHeader,
    clearForm: () => setForm(EMPTY_HEADER),
    editRecord: (header) => setForm(headerFormOf(header)),
  };

  const columns = [
    { key: 'hsnCode', header: 'CETH Number', className: 'tw:font-semibold' },
    { key: 'isGstApplicable', header: 'GST', align: 'center', cell: (header) => (header.isGstApplicable ? 'Yes' : 'No') },
    { key: 'components', header: 'Duties', align: 'center', cell: (header) => header.components?.length || 0 },
    masterActionsColumn({ onEdit: master.editRecord }),
  ];

  const componentColumns = [
    ...COMPONENT_COLUMNS,
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      cell: (component) => <Button variant="link" size="sm" className="tw:text-destructive" onClick={() => removeComponent(component.id)}>Remove</Button>,
    },
  ];

  return (
    <MasterPage master={master} list={LIST} icon={Table2} formTitle="CETH Header Details" columns={columns}>
      <div className="tw:flex tw:flex-col tw:gap-4">
        <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-4 tw:md:grid-cols-[1fr_1fr_2fr]">
          <Field label="CETH Number" required layout="col">
            <Input required placeholder="e.g. 01012100" value={form.hsnCode} onChange={(event) => setForm({ ...form, hsnCode: event.target.value })} />
          </Field>
          <Label className="tw:cursor-pointer tw:gap-2 tw:pb-1 tw:font-semibold">
            <Checkbox checked={Boolean(form.isGstApplicable)} onCheckedChange={(checked) => setForm({ ...form, isGstApplicable: checked === true })} /> Is GST Applicable
          </Label>
        </div>

        <Section
          title={<span className="tw:flex tw:items-center tw:gap-1"><Settings className="tw:size-3.5" /> Dynamic Duty Components (Tariff Components)</span>}
          className={cn(!headerSaved && 'tw:pointer-events-none tw:opacity-50')}
        >
          <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-3 tw:rounded-md tw:border tw:border-border tw:bg-background tw:p-3 tw:sm:grid-cols-2 tw:lg:grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_auto]">
            <Field label="Duty Type" required layout="col">
              <SelectBox required options={DUTY_CATEGORIES} value={componentForm.dutyCategory} onValueChange={setComponentField('dutyCategory')} />
            </Field>
            <Field label="Flag" required layout="col">
              <SelectBox required options={CALCULATION_FLAGS} value={componentForm.calculationFlag} onValueChange={setComponentField('calculationFlag')} />
            </Field>
            <Field label="Rate (%)" layout="col">
              <NumberInput placeholder="0.00" value={componentForm.rate} onValueChange={setComponentField('rate')} />
            </Field>
            <Field label="Amount (Rs)" layout="col">
              <NumberInput placeholder="0.00" value={componentForm.amount} onValueChange={setComponentField('amount')} />
            </Field>
            <Field label="UQC" layout="col">
              <Input placeholder="e.g. KGS" data-allow-text="" value={componentForm.uqc} onChange={(event) => setComponentField('uqc')(event.target.value)} />
            </Field>
            <Button onClick={addComponent}><Plus /> Add Row</Button>
          </div>
          <DataTable columns={componentColumns} rows={components} emptyText="No duty components added yet." containerClassName="tw:rounded-md tw:border tw:border-border" />
        </Section>
      </div>
    </MasterPage>
  );
}
