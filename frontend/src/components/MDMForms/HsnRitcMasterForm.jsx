import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FileText, PlusCircle, Save, Search, Settings, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, Button, Card, CardContent, CardFooter, CardHeader, CardTitle, DataTable, Input } from '@/components/ui';
import { askDelete } from './switchRow';
import { masterRecordsApi, mastersFormApi } from './masterKit/masterRecordsApi';
import { CheckField, NumberField, SelectField, TextField } from './masterKit/masterFields';

const EMPTY_HEADER = { id: '', hsnCode: '', dutyType: 'STANDARD', description: '', isGstApplicable: true };
const EMPTY_COMPONENT = { dutyCategory: 'BCD', calculationFlag: 'ADVALOREM', rate: '', amount: '', uqc: '' };
const DUTY_TYPES = ['STANDARD', 'PREFERENTIAL', 'EXEMPT'];
const CALCULATION_FLAGS = ['ADVALOREM', 'SPECIFIC', 'BLANK'];
const DUTY_CATEGORIES = [
  { value: 'BCD', label: 'BCD (Basic Customs Duty)' },
  { value: 'IGST', label: 'IGST (Integrated GST)' },
  { value: 'SWS', label: 'SWS (Social Welfare Surcharge)' },
  { value: 'AIDC', label: 'AIDC (Agri Infra & Dev Cess)' },
  { value: 'COMP_CESS', label: 'COMP_CESS (GST Compensation Cess)' },
  { value: 'ADD', label: 'ADD (Anti-Dumping Duty)' },
  { value: 'SAFEGUARD', label: 'SAFEGUARD (Safeguard Duty)' },
  { value: 'NCCD', label: 'NCCD (National Calamity Contingent Duty)' },
  { value: 'HEALTH_CESS', label: 'HEALTH_CESS (Health Cess)' },
  { value: 'INFRA_CESS', label: 'INFRA_CESS (Infrastructure Cess)' },
  { value: 'RIC', label: 'RIC (Road & Infra Cess)' },
  { value: 'CVD', label: 'CVD (Countervailing Duty)' },
  { value: 'SAD', label: 'SAD (Special Additional Duty)' },
  { value: 'EXCISE', label: 'EXCISE (Central Excise Duty)' },
  { value: 'PROTECTIVE', label: 'PROTECTIVE (Protective Duty)' },
];
const SHOWN_TARIFFS = 100;
const HSN_CODE = /^\d{8}$/;

const formOf = (form, setForm) => ({ form, setField: (name) => (value) => setForm((current) => ({ ...current, [name]: value })) });

const TARIFF_COLUMNS = [
  { key: 'hsnCode', header: 'HSN Code', className: 'tw:font-bold' },
  { key: 'dutyType', header: 'Duty Type', className: 'tw:text-muted-foreground' },
];

export default function HsnRitcMasterForm() {
  const [tariffs, setTariffs] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // 'new' or a tariff line
  const [headerForm, setHeaderForm] = useState(EMPTY_HEADER);
  const [components, setComponents] = useState([]);
  const [componentRow, setComponentRow] = useState(EMPTY_COMPONENT);

  const headerReady = Boolean(selected) && selected !== 'new';

  const showTariff = (tariff) => {
    setSelected(tariff);
    setHeaderForm(tariff);
    setComponents(tariff.components || []);
  };

  // searched on the server (HSN or description): a full tariff has ~12,000 lines. The open line is refreshed from the answer.
  const loadTariffs = async (selection) => {
    try {
      const rows = await mastersFormApi.searchTariffHeaders(search.trim());
      setTariffs(rows);
      if (selection && selection !== 'new') {
        const updated = rows.find((tariff) => tariff.id === selection.id);
        if (updated) showTariff(updated);
      }
    } catch (error) {
      toast.error(`Could not load tariff: ${errorMessage(error)}`);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadTariffs(selected), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- typing in the search box asks the server again, nothing else
  }, [search]);

  const createNew = () => {
    setSelected('new');
    setHeaderForm(EMPTY_HEADER);
    setComponents([]);
  };

  const saveHeader = async () => {
    const hsnCode = String(headerForm.hsnCode || '').replace(/\s/g, '');
    if (!HSN_CODE.test(hsnCode)) {
      toast.error('HSN / CTH must be 8 digits');
      return;
    }
    const { components: _components, ...tariffHeader } = { ...headerForm, hsnCode };
    try {
      const saved = headerForm.id
        ? await masterRecordsApi.update('tariffheaders', headerForm.id, tariffHeader)
        : await masterRecordsApi.create('tariffheaders', tariffHeader);
      if (selected === 'new') {
        setSelected(saved);
        setHeaderForm(saved);
      }
      await loadTariffs(selected);
    } catch (error) {
      toast.error(`Not saved: ${errorMessage(error)}`);
    }
  };

  const deleteHeader = async () => {
    if (!headerForm.id) return;
    if (!(await askDelete(`Delete HSN ${headerForm.hsnCode} and all its duty lines?`))) return;
    try {
      await masterRecordsApi.remove('tariffheaders', headerForm.id);
      setSelected(null);
      setHeaderForm(EMPTY_HEADER);
      setComponents([]);
      loadTariffs(null);
    } catch (error) {
      toast.error(`Not deleted: ${errorMessage(error)}`);
    }
  };

  const addComponent = async () => {
    if (!headerReady || !headerForm.id) return;
    if (!componentRow.dutyCategory || !componentRow.calculationFlag) return;
    try {
      await mastersFormApi.addTariffComponent({
        ...componentRow,
        tariffHeaderId: headerForm.id,
        rate: componentRow.rate === '' ? 0 : componentRow.rate,
        amount: componentRow.amount === '' ? 0 : componentRow.amount,
      });
      setComponentRow(EMPTY_COMPONENT);
      loadTariffs(selected);
    } catch (error) {
      toast.error(`Duty line not added: ${errorMessage(error)}`);
    }
  };

  const deleteComponent = async (component) => {
    if (!(await askDelete('Delete this duty line?'))) return;
    try {
      await mastersFormApi.deleteTariffComponent(component.id);
      loadTariffs(selected);
    } catch (error) {
      toast.error(`Not deleted: ${errorMessage(error)}`);
    }
  };

  const header = formOf(headerForm, setHeaderForm);
  const componentForm = formOf(componentRow, setComponentRow);

  const componentColumns = [
    { key: 'dutyCategory', header: 'Duty Category', className: 'tw:font-bold' },
    { key: 'calculationFlag', header: 'Flag', className: 'tw:text-muted-foreground' },
    { key: 'rate', header: 'Rate (%)', align: 'right', className: 'tw:font-semibold tw:text-primary', cell: (component) => (component.rate > 0 ? `${component.rate}%` : '-') },
    { key: 'amount', header: 'Amount (Rs)', align: 'right', className: 'tw:font-semibold tw:text-primary', cell: (component) => (component.amount > 0 ? `₹${component.amount}` : '-') },
    { key: 'uqc', header: 'UQC', align: 'center', className: 'tw:text-muted-foreground', cell: (component) => component.uqc || '-' },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      cell: (component) => <Button variant="link" size="sm" className="tw:text-destructive" onClick={() => deleteComponent(component)}>Remove</Button>,
    },
  ];

  return (
    <div className="tw:flex tw:flex-col tw:gap-4 tw:lg:h-full tw:lg:min-h-0 tw:lg:flex-row">
      <Card className="tw:flex tw:max-h-[40vh] tw:flex-col tw:gap-0 tw:overflow-hidden tw:p-0 tw:lg:max-h-none tw:lg:w-[280px] tw:lg:shrink-0">
        <div className="tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-border tw:p-3">
          <h3 className="tw:m-0 tw:flex tw:items-center tw:gap-2 tw:text-entry tw:font-bold tw:text-head tw:uppercase">
            <Search className="tw:size-3.5" /> Search Tariff / HSN <Badge variant="info" className="tw:ml-auto">{tariffs.length}</Badge>
          </h3>
          <Input data-allow-text="" placeholder="Search HSN code or description..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <Button size="block" className="tw:justify-center tw:border-dashed" onClick={createNew}><PlusCircle /> CREATE NEW TARIFF</Button>
        </div>
        <DataTable columns={TARIFF_COLUMNS} rows={tariffs.slice(0, SHOWN_TARIFFS)} selectedKey={headerReady ? selected.id : undefined}
          onRowClick={showTariff} emptyText="No records found." containerClassName="tw:min-h-0 tw:flex-1" />
      </Card>

      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-4 tw:pb-4 tw:lg:overflow-y-auto">
        <Card>
          <CardHeader className="tw:border-b tw:border-border tw:bg-primary/5 tw:py-2">
            <CardTitle icon={<FileText />}>TARIFF MASTER</CardTitle>
          </CardHeader>
          <CardContent className="tw:pt-3">
            <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-[1.2fr_1fr_2fr_1fr]">
              <TextField master={header} name="hsnCode" label="HSN Code" required placeholder="e.g. 01012100" />
              <SelectField master={header} name="dutyType" label="Duty Type" options={DUTY_TYPES} />
              <TextField master={header} name="description" label="Description" placeholder="Commodity Description" />
              <CheckField master={header} name="isGstApplicable" label="Is GST Applicable" />
            </div>
          </CardContent>
          <CardFooter className="tw:flex-wrap tw:justify-between tw:bg-page">
            <span className="tw:text-[11px] tw:text-muted-foreground">* UNIFIES CTH (BCD) AND CETH (CVD) INTO A SINGLE ENTITY.</span>
            <span className="tw:flex tw:flex-wrap tw:gap-2">
              {headerForm.id && <Button className="tw:text-destructive" onClick={deleteHeader}><Trash2 /> DELETE</Button>}
              <Button variant="success" onClick={saveHeader}><Save /> SAVE TARIFF HEADER</Button>
            </span>
          </CardFooter>
        </Card>

        <Card className={cn('tw:flex-1', !headerReady && 'tw:pointer-events-none tw:opacity-60')}>
          <CardHeader className="tw:border-b tw:border-border tw:bg-page tw:py-2">
            <CardTitle icon={<Settings />} className="tw:text-muted-foreground">DUTY RATES OF THIS TARIFF</CardTitle>
          </CardHeader>
          <CardContent className="tw:gap-4 tw:pt-3">
            <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-3 tw:rounded-md tw:border tw:border-dashed tw:border-border tw:bg-secondary tw:p-3 tw:sm:grid-cols-2 tw:lg:grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_auto]">
              <SelectField master={componentForm} name="dutyCategory" label="Duty Category" required options={DUTY_CATEGORIES} />
              <SelectField master={componentForm} name="calculationFlag" label="Calculation Flag" required options={CALCULATION_FLAGS} />
              <NumberField master={componentForm} name="rate" label="Rate (%)" placeholder="0.00" />
              <NumberField master={componentForm} name="amount" label="Amount (Rs)" placeholder="0.00" />
              <TextField master={componentForm} name="uqc" label="UQC" upper placeholder="E.G. KGS" />
              <Button onClick={addComponent}>+ ADD ROW</Button>
            </div>
            <DataTable columns={componentColumns} rows={components} containerClassName="tw:flex-1 tw:rounded-md tw:border tw:border-border"
              emptyText={headerReady ? 'NO DUTY COMPONENTS ADDED YET.' : 'PLEASE SELECT OR CREATE A TARIFF HEADER FIRST.'} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
