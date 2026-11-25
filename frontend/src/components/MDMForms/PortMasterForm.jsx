import { Anchor } from 'lucide-react';
import { Badge, Checkbox, Field, Input, Label, Section, SelectBox } from '@/components/ui';
import { MasterPage } from './masterKit/MasterPage';
import { activeColumn, masterActionsColumn } from './masterKit/masterColumns';
import { useMasterRecords } from './masterKit/useMasterRecords';

const EMPTY_PORT = { id: '', portCode: '', portName: '', country: 'IN', category: 'AIR', isSez: false, chaCode: '', chaName: '', division: 'BOTH (IMP/EXP)', isActive: true };
const LIST_PARAMS = { all: 1 };
const SEARCH_FIELDS = ['portCode', 'portName', 'chaCode'];
// ICEGATE port code: 2-letter country + location, e.g. INDEL4, INNSA1
const PORT_CODE = /^[A-Z]{2}[A-Z0-9]{3,4}$/;

const COUNTRY_OPTIONS = [
  { value: 'IN', label: 'India (IN)' },
  { value: 'AE', label: 'United Arab Emirates (AE)' },
  { value: 'US', label: 'United States (US)' },
  { value: 'GB', label: 'United Kingdom (GB)' },
];
const CATEGORY_OPTIONS = [
  { value: 'AIR', label: 'Air' },
  { value: 'SEA', label: 'Sea' },
  { value: 'ICD', label: 'ICD / CFS' },
  { value: 'LAND', label: 'Land' },
  { value: 'BORDER', label: 'Border' },
  { value: 'RAILWAYS', label: 'Railways' },
  { value: 'SEZ', label: 'SEZ' },
];
const DIVISION_OPTIONS = [
  { value: 'BOTH (IMP/EXP)', label: 'Both (Imp/Exp)' },
  { value: 'IMPORT', label: 'Import Only' },
  { value: 'EXPORT', label: 'Export Only' },
];

const validatePort = (port) => {
  if (!port.portCode || !port.portName) return 'Port code and port name are required';
  if (!PORT_CODE.test(String(port.portCode).trim())) return 'Port code: 2-letter country + location, e.g. INDEL4, INNSA1';
  return '';
};

// old rows keep the country as "INDIA (IN)": take the code
const countryCodeOf = (country) => /\(([A-Z]{2})\)/.exec(String(country || ''))?.[1] || country || 'IN';

const LIST = {
  title: 'Search',
  searchPlaceholder: 'SEARCH...',
  primaryText: (port) => port.portName,
  secondaryText: (port) => `${port.portCode || ''} • ${port.category || ''}`,
};

function CheckField({ label, checked, onChange }) {
  return (
    <Label className="tw:cursor-pointer tw:gap-2 tw:font-semibold tw:md:pt-4">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} /> {label}
    </Label>
  );
}

export default function PortMasterForm() {
  const records = useMasterRecords({
    resource: 'ports',
    emptyRecord: EMPTY_PORT,
    listParams: LIST_PARAMS,
    searchFields: SEARCH_FIELDS,
    validate: validatePort,
    describe: (port) => `port ${port.portCode || ''} ${port.portName || ''}`,
  });
  const { form, setForm, setField } = records;

  const editPort = (port) => setForm({ ...EMPTY_PORT, ...port, country: countryCodeOf(port.country), category: String(port.category || 'AIR').toUpperCase() });
  const master = { ...records, editRecord: editPort };

  const columns = [
    { key: 'portCode', header: 'Port Code', cell: (port) => <Badge variant="success">{port.portCode}</Badge> },
    { key: 'portName', header: 'Port Name' },
    { key: 'category', header: 'Category', align: 'center', cell: (port) => <Badge variant="info">{port.category}</Badge> },
    { key: 'isSez', header: 'SEZ', align: 'center', cell: (port) => (port.isSez ? <span className="tw:font-semibold tw:text-success">Yes</span> : <span className="tw:text-muted-foreground">No</span>) },
    {
      key: 'cha',
      header: 'CHA Details',
      cell: (port) => (
        <>
          <div className="tw:font-semibold">{port.chaCode || '-'}</div>
          <div className="tw:text-[10px] tw:text-muted-foreground">{port.chaName || ''}</div>
        </>
      ),
    },
    activeColumn,
    masterActionsColumn({ onEdit: editPort, onSwitch: records.switchActive }),
  ];

  return (
    <MasterPage master={master} list={LIST} icon={Anchor} formTitle="Unified Port & CHA Registration Master" columns={columns}>
      <div className="tw:flex tw:flex-col tw:gap-4">
        <Section title="Core Port Details">
          <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-[1fr_2fr_1fr_1fr_1fr]">
            <Field label="Port Code" required layout="col">
              <Input required placeholder="e.g. INDEL4" maxLength={6} className="tw:font-semibold tw:uppercase" data-allow-text="" value={form.portCode}
                onChange={(event) => setField('portCode')(event.target.value.toUpperCase())} />
            </Field>
            <Field label="Port Name" required layout="col">
              <Input required placeholder="Full port name (e.g. ACC, New Delhi)" data-allow-text="" value={form.portName || ''}
                onChange={(event) => setField('portName')(event.target.value.toUpperCase())} />
            </Field>
            <Field label="Country" required layout="col">
              <SelectBox required options={COUNTRY_OPTIONS} value={form.country || 'IN'} onValueChange={setField('country')} />
            </Field>
            <Field label="Port Category" required layout="col">
              <SelectBox required options={CATEGORY_OPTIONS} value={form.category || 'AIR'} onValueChange={setField('category')} />
            </Field>
            <CheckField label="Is SEZ Port" checked={Boolean(form.isSez)} onChange={setField('isSez')} />
          </div>
        </Section>

        <Section title="CHA Registration & Operations">
          <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-[1fr_2fr_1fr_1fr]">
            <Field label="CHA Code" layout="col">
              <Input placeholder="e.g. 11/XXXX" data-allow-text="" value={form.chaCode || ''}
                onChange={(event) => setField('chaCode')(event.target.value.toUpperCase())} />
            </Field>
            <Field label="CHA Name (Company)" layout="col">
              <Input placeholder="Official broker name" data-allow-text="" value={form.chaName || ''}
                onChange={(event) => setField('chaName')(event.target.value.toUpperCase())} />
            </Field>
            <Field label="Division" layout="col">
              <SelectBox options={DIVISION_OPTIONS} value={form.division} onValueChange={setField('division')} />
            </Field>
            <CheckField label="Is Active" checked={form.isActive !== false} onChange={setField('isActive')} />
          </div>
        </Section>

        <p className="tw:m-0 tw:text-[11px] tw:text-muted-foreground">* The CHA code and name saved here go into the filing files for this port.</p>
      </div>
    </MasterPage>
  );
}
