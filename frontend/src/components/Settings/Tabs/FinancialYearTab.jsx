import { useState } from 'react';
import { AlertCircle, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge, Button, DataTable, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { settingsApi } from '../settingsApi';
import { CheckboxField } from './SettingsParts/CheckboxField';
import { announceContextChange } from './SettingsParts/contextEvents';
import { RecordActions, RecordsPanel } from './SettingsParts/RecordsPanel';
import { SettingsFields } from './SettingsParts/SettingsFields';
import { useSettingsRecords } from './SettingsParts/useSettingsRecords';

const YEAR_API = {
  list: settingsApi.financialYears,
  create: settingsApi.createFinancialYear,
  update: settingsApi.updateFinancialYear,
  remove: settingsApi.deleteFinancialYear,
};
const EMPTY_YEAR = { code: '', name: '', startDate: '', endDate: '', yearType: 'FINANCIAL', isActive: true, isDefault: false, isClosed: false };
const REQUIRED_FIELDS = ['code', 'name', 'startDate', 'endDate'];

const YEAR_FIELDS = [
  { name: 'code', label: 'FY CODE', required: true, upper: true, placeholder: 'e.g. 26-27' },
  {
    name: 'yearType', label: 'YEAR TYPE', required: true, kind: 'select',
    options: [{ value: 'FINANCIAL', label: 'Financial Year (Apr-Mar)' }, { value: 'CALENDAR', label: 'Calendar Year (Jan-Dec)' }],
  },
  { name: 'name', label: 'YEAR NAME', required: true, placeholder: 'e.g. FY 2026-2027' },
  { name: 'status', label: 'STATUS', kind: 'select', options: [{ value: 'Active', label: 'Active (Unlocked)' }, { value: 'Inactive', label: 'Inactive (Locked)' }] },
];

// Picking a year type fills in the current year's period, code and name.
const yearOfType = (yearType) => {
  const year = new Date().getFullYear();
  if (yearType === 'FINANCIAL') {
    return {
      yearType, startDate: `${year}-04-01`, endDate: `${year + 1}-03-31`,
      code: `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`, name: `FY ${year}-${year + 1}`,
    };
  }
  return { yearType, startDate: `${year}-01-01`, endDate: `${year}-12-31`, code: `${year}`, name: `CY ${year}` };
};

const PERIOD_COLUMNS = [
  { key: 'periodNo', header: 'PERIOD', className: 'tw:font-bold', cell: (period) => `Period ${period.periodNo}` },
  { key: 'periodName', header: 'MONTH' },
  { key: 'startDate', header: 'START DATE', align: 'center' },
  { key: 'endDate', header: 'END DATE', align: 'center' },
  {
    key: 'isClosed', header: 'STATUS', align: 'center',
    cell: (period) => <Badge variant={period.isClosed ? 'danger' : 'success'}>{period.isClosed ? 'CLOSED (LOCKED)' : 'OPEN'}</Badge>,
  },
];

function YearRow({ year, expanded, onToggle, onEdit, onDelete }) {
  return (
    <>
      <TableRow className={year.isDefault ? 'tw:bg-primary/5' : undefined}>
        <TableCell className="tw:w-10 tw:text-center">
          <Button variant="ghost" size="icon-sm" aria-label="Periods" onClick={onToggle}>{expanded ? <ChevronDown /> : <ChevronRight />}</Button>
        </TableCell>
        <TableCell className="tw:font-bold">
          {year.code}
          {year.isDefault && <Badge className="tw:ml-2">DEFAULT</Badge>}
        </TableCell>
        <TableCell className="tw:font-semibold">{year.name}</TableCell>
        <TableCell className="tw:text-center tw:text-muted-foreground">{year.startDate} to {year.endDate}</TableCell>
        <TableCell className="tw:text-center">
          <Badge variant={year.isActive ? 'success' : 'danger'}>{year.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>
        </TableCell>
        <TableCell><RecordActions onEdit={onEdit} onDelete={year.isActive ? undefined : onDelete} /></TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="tw:bg-page tw:hover:bg-page">
          <TableCell colSpan={6} className="tw:p-4 tw:md:p-5">
            <DataTable columns={PERIOD_COLUMNS} rows={year.periods || []} emptyText="No periods generated." stickyHeader={false}
              containerClassName="tw:rounded-lg tw:border tw:border-border" />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function FinancialYearTab() {
  const years = useSettingsRecords({
    api: YEAR_API,
    emptyRecord: EMPTY_YEAR,
    requiredFields: REQUIRED_FIELDS,
    savedMessage: 'Financial Year saved successfully!',
    deleteQuestion: 'Delete this financial year?',
    onChanged: announceContextChange,
  });
  const [expandedId, setExpandedId] = useState(null);
  const { form } = years;

  const changeField = (name, value) => {
    if (name === 'yearType') years.setForm((current) => ({ ...current, ...yearOfType(value) }));
    else if (name === 'status') years.setField('isActive', value === 'Active');
    else years.setField(name, value);
  };

  return (
    <RecordsPanel records={years} icon={Calendar} title="Financial Year Setup" description="Manage accounting periods and active financial year."
      addLabel="CREATE NEW FY" formTitle={years.editingId ? 'Edit Financial Year' : 'Create Financial Year'} saveLabel="FY"
      formNote={(
        <div className="tw:flex tw:items-center tw:gap-1 tw:text-[11px] tw:font-bold tw:text-warning">
          <AlertCircle className="tw:size-3.5 tw:shrink-0" /> Setting a new Default Year will override the current default.
        </div>
      )}
      form={(
        <>
          <SettingsFields fields={YEAR_FIELDS} values={{ ...form, status: form.isActive ? 'Active' : 'Inactive' }} onChange={changeField}
            className="tw:md:grid-cols-3" />
          <div className="tw:rounded-md tw:bg-secondary tw:p-2.5 tw:text-entry tw:font-medium tw:text-muted-foreground">
            <span className="tw:font-bold tw:text-primary">Auto-Generated Period:</span>{' '}
            {form.startDate ? `${form.startDate} to ${form.endDate}` : 'Select Year Type to auto-fill periods'}
          </div>
          <CheckboxField label="Set as Default Year (Shows in Top Navigation)" checked={Boolean(form.isDefault)}
            onCheckedChange={(checked) => years.setField('isDefault', checked)} />
        </>
      )}>
      <Table containerClassName="tw:rounded-lg tw:border tw:border-border">
        <TableHeader>
          <TableRow className="tw:hover:bg-transparent">
            <TableHead className="tw:w-10" />
            <TableHead>CODE</TableHead>
            <TableHead>FY NAME</TableHead>
            <TableHead className="tw:text-center">PERIOD</TableHead>
            <TableHead className="tw:text-center">STATUS</TableHead>
            <TableHead className="tw:text-right">ACTIONS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {years.records.map((year) => (
            <YearRow key={year.id} year={year} expanded={expandedId === year.id} onToggle={() => setExpandedId(expandedId === year.id ? null : year.id)}
              onEdit={() => years.startEdit(year)} onDelete={() => years.remove(year.id)} />
          ))}
          {years.records.length === 0 && (
            <TableRow className="tw:hover:bg-transparent">
              <TableCell colSpan={6} className="tw:py-4 tw:text-center tw:text-muted-foreground">No financial years found.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </RecordsPanel>
  );
}
