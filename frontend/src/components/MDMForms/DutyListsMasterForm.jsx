// Customs duty lists: anti-dumping duty, countervailing duty (CVD), export cess and tariff values - one screen, four lists.
//  - 50 rows a page, searched on the server (the anti-dumping list alone has 16,000+ rows)
//  - anti-dumping rows are loaded from iCAFFE, so that list is view only
//  - the other three: add, change, switch off / on. A row is never deleted from here.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Save, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import {
  Button, Checkbox, DataTable, DateInput, Field, Input, Label, NumberInput, SelectBox, Tabs, TabsList, TabsTrigger,
} from '@/components/ui';
import askConfirm from '../common/askConfirm';
import { mastersFormApi } from './masterKit/masterRecordsApi';
import { toDashDate } from './CustomsMasterParts/scheduleConfig';

const PAGE_SIZE = 50;
const EMPTY_PAGE = { rows: [], total: 0, limit: PAGE_SIZE };
const CALCULATED_ON = ['%AGE OF LANDED VALUE', '%AGE OF CIF', 'SPECIFIC ON QTY'];

const isBlank = (value) => value === null || value === undefined || value === '';
const amount = (value, decimals = 2) => (isBlank(value) ? '-' : Number(value).toLocaleString('en-IN', { maximumFractionDigits: decimals }));
const rate4 = (value) => amount(value, 4);
const dashDate = (value) => toDashDate(value) || '-';
const countText = (number) => Number(number).toLocaleString('en-IN');

// fields: the boxes of the edit panel (span = columns out of 12); columns: the grid
const LISTS = [
  {
    key: 'add',
    name: 'Anti-dumping Duty',
    readOnly: true,
    hint: 'Search notification no, CTH (from the first digits), country code',
    note: 'This list is loaded from iCAFFE and is used on the import item screen (anti-dumping duty look-up by CTH). It is view only here - a fresh load replaces all rows.',
    columns: [
      { key: 'notifNo', header: 'Notification' }, { key: 'notifDate', header: 'Date', format: dashDate }, { key: 'serialNo', header: 'Sr No' },
      { key: 'cthSlNo', header: 'CTH Sl' }, { key: 'cth', header: 'CTH' }, { key: 'originCountry', header: 'Origin' },
      { key: 'exportCountry', header: 'Export' }, { key: 'rate', header: 'Rate %', format: amount, align: 'right' },
      { key: 'amount', header: 'Amount', format: amount, align: 'right' }, { key: 'currency', header: 'Cur' }, { key: 'uqc', header: 'Unit' },
      { key: 'endDate', header: 'Valid till', format: dashDate },
    ],
  },
  {
    key: 'cvd',
    name: 'Countervailing Duty (CVD)',
    hint: 'Search notification no, CTH, country code, goods, producer',
    note: 'Countervailing duty rows by notification, CTH, country and producer. A reference list for now - the item screen does not fill from it yet.',
    fields: [
      { name: 'notifNo', label: 'Notification No', span: 2, required: true, maxLength: 20, placeholder: '001/2024' },
      { name: 'serialNo', label: 'Sr No', span: 1, maxLength: 10 },
      { name: 'itemSlNo', label: 'Item Sl', span: 1, maxLength: 10 },
      { name: 'suppSlNo', label: 'Supp Sl', span: 1, maxLength: 10 },
      { name: 'cth', label: 'CTH', span: 2, required: true, maxLength: 8, digits: true, placeholder: '8 digits' },
      { name: 'originCountry', label: 'Origin Country', span: 1, maxLength: 2, placeholder: 'CN' },
      { name: 'exportCountry', label: 'Export Country', span: 1, maxLength: 2, placeholder: 'CN' },
      { name: 'rate', label: 'Rate', span: 1, number: true },
      { name: 'calcMethod', label: 'Calculated On', span: 2, options: CALCULATED_ON },
      { name: 'description', label: 'Goods', span: 4, maxLength: 500 },
      { name: 'exporter', label: 'Exporter', span: 4, maxLength: 300 },
      { name: 'producer', label: 'Producer', span: 4, maxLength: 300 },
    ],
    columns: [
      { key: 'notifNo', header: 'Notification' }, { key: 'serialNo', header: 'Sr No' }, { key: 'itemSlNo', header: 'Item Sl' },
      { key: 'suppSlNo', header: 'Supp Sl' }, { key: 'cth', header: 'CTH' }, { key: 'originCountry', header: 'Origin' },
      { key: 'exportCountry', header: 'Export' }, { key: 'rate', header: 'Rate', format: rate4, align: 'right' },
      { key: 'calcMethod', header: 'Calculated on' }, { key: 'description', header: 'Goods', wide: true },
      { key: 'producer', header: 'Producer', wide: true }, { key: 'exporter', header: 'Exporter', wide: true },
    ],
  },
  {
    key: 'cess',
    name: 'Export Cess',
    hint: 'Search RITC (from the first digits) or goods',
    note: 'Export cess by RITC: a % rate, or an amount in Rs per unit. A reference list for now - the shipping bill screen does not fill from it yet.',
    fields: [
      { name: 'ritc', label: 'RITC', span: 2, maxLength: 8, digits: true, placeholder: '8 digits' },
      { name: 'serialNo', label: 'Serial No', span: 1, maxLength: 10 },
      { name: 'ratePercent', label: 'Rate %', span: 2, number: true },
      { name: 'rateRs', label: 'Rate Rs', span: 2, number: true },
      { name: 'unit', label: 'Per Unit', span: 1, maxLength: 10, placeholder: 'KGS' },
      { name: 'tariffValue', label: 'Tariff Value', span: 2, number: true },
      { name: 'tariffUnit', label: 'Tariff Unit', span: 2, maxLength: 10 },
      { name: 'description', label: 'Goods', span: 12, maxLength: 300 },
    ],
    columns: [
      { key: 'ritc', header: 'RITC' }, { key: 'serialNo', header: 'Serial No' },
      { key: 'ratePercent', header: 'Rate %', format: rate4, align: 'right' }, { key: 'rateRs', header: 'Rate Rs', format: amount, align: 'right' },
      { key: 'unit', header: 'Per unit' }, { key: 'tariffValue', header: 'Tariff value', format: amount, align: 'right' },
      { key: 'tariffUnit', header: 'Tariff unit' }, { key: 'description', header: 'Goods', wide: true },
    ],
  },
  {
    key: 'tariffvalue',
    name: 'Tariff Values',
    hint: 'Search notification no, CTH or goods',
    note: 'Tariff values fixed by CBIC (36/2001-Cus (N.T.) and its changes) for edible oils, brass scrap, gold, silver and areca nuts. A reference list for now - the item screen does not fill from it yet.',
    fields: [
      { name: 'notifNo', label: 'Notification No', span: 2, required: true, maxLength: 20, placeholder: '36/2001' },
      { name: 'serialNo', label: 'Sr No', span: 1, maxLength: 10 },
      { name: 'cth', label: 'CTH', span: 2, required: true, maxLength: 8, digits: true, placeholder: '8 digits' },
      { name: 'tariffValue', label: 'Tariff Value', span: 2, required: true, number: true },
      { name: 'currency', label: 'Currency', span: 1, maxLength: 3, placeholder: 'USD' },
      { name: 'uqc', label: 'Unit', span: 1, maxLength: 6, placeholder: 'MTS' },
      { name: 'effectiveDate', label: 'Effective Date', span: 3, date: true },
      { name: 'description', label: 'Goods', span: 12, required: true, maxLength: 300 },
    ],
    columns: [
      { key: 'notifNo', header: 'Notification' }, { key: 'serialNo', header: 'Sr No' }, { key: 'cth', header: 'CTH' },
      { key: 'description', header: 'Goods', wide: true }, { key: 'tariffValue', header: 'Tariff value', format: amount, align: 'right' },
      { key: 'currency', header: 'Cur' }, { key: 'uqc', header: 'Unit' }, { key: 'effectiveDate', header: 'Effective', format: dashDate },
    ],
  },
];

const SPAN_CLASS = {
  1: 'tw:md:col-span-1',
  2: 'tw:md:col-span-2',
  3: 'tw:md:col-span-3',
  4: 'tw:sm:col-span-2 tw:md:col-span-4',
  12: 'tw:sm:col-span-2 tw:md:col-span-12',
};

function EditBox({ id, field, value, onChange, onEnter }) {
  if (field.date) return <DateInput id={id} value={value || ''} onValueChange={onChange} />;
  if (field.options) {
    return (
      <SelectBox id={id} options={[...new Set([...field.options, value].filter(Boolean))]} value={value || ''} onValueChange={onChange}
        placeholder="Select" clearable clearLabel="Select" />
    );
  }
  const enterSaves = (event) => { if (event.key === 'Enter') onEnter(); };
  if (field.number) return <NumberInput id={id} value={value || ''} onValueChange={onChange} onKeyDown={enterSaves} />;
  return (
    <Input id={id} data-allow-text="" placeholder={field.placeholder || ''} value={value || ''} onChange={(event) => onChange(event.target.value)}
      onKeyDown={enterSaves} />
  );
}

export default function DutyListsMasterForm() {
  const [kind, setKind] = useState('add');
  const [counts, setCounts] = useState({});
  const [query, setQuery] = useState('');
  const [showOff, setShowOff] = useState(false);
  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState(EMPTY_PAGE);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [edit, setEdit] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const requestSeq = useRef(0);
  const list = LISTS.find((each) => each.key === kind);

  const loadCounts = useCallback(async () => {
    try {
      setCounts(await mastersFormApi.dutyListCounts());
    } catch {
      // the tabs just show no count
    }
  }, []);

  const load = useCallback(async (listKind, text, pageNo, withSwitchedOff) => {
    const request = ++requestSeq.current;
    setLoading(true);
    setLoadError('');
    try {
      const result = await mastersFormApi.dutyListRows(listKind, { q: text, page: pageNo, limit: PAGE_SIZE, inactive: withSwitchedOff ? 1 : undefined });
      if (request !== requestSeq.current) return; // an older answer - a newer search is already out
      setPageData({ rows: Array.isArray(result.rows) ? result.rows : [], total: result.total || 0, limit: result.limit || PAGE_SIZE });
    } catch (error) {
      if (request !== requestSeq.current) return;
      setLoadError(`The list could not be read: ${errorMessage(error)}`);
      setPageData(EMPTY_PAGE);
    }
    setLoading(false);
  }, []);

  const reload = () => { load(kind, query.trim(), page, showOff); loadCounts(); };

  useEffect(() => { loadCounts(); }, [loadCounts]);
  // typing waits 300 ms before it asks the server
  useEffect(() => {
    const timer = setTimeout(() => load(kind, query.trim(), page, showOff), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [kind, query, page, showOff, load]);

  const pickTab = (listKind) => {
    if (listKind === kind) return;
    setKind(listKind);
    setQuery('');
    setPage(1);
    setEdit(null);
    setSaveError('');
    setShowOff(false);
  };

  const openRow = (row) => {
    const values = row ? { id: row.id } : {};
    list.fields.forEach(({ name }) => { values[name] = row && !isBlank(row[name]) ? String(row[name]) : ''; });
    setEdit(values);
    setSaveError('');
  };

  const changeField = (field) => (value) => {
    let text = value;
    if (field.digits) text = text.replace(/\D/g, '');
    if (field.maxLength) text = text.slice(0, field.maxLength);
    setEdit((current) => ({ ...current, [field.name]: text }));
    setSaveError('');
  };

  const closeEdit = () => { setEdit(null); setSaveError(''); };

  const save = async () => {
    const missing = list.fields.find((field) => field.required && !String(edit[field.name] || '').trim());
    if (missing) {
      setSaveError(`${missing.label} is required.`);
      return;
    }
    if (kind === 'cess' && edit.ratePercent === '' && edit.rateRs === '') {
      setSaveError('Fill Rate % or Rate Rs.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await mastersFormApi.saveDutyListRow(kind, edit);
      setEdit(null);
      reload();
    } catch (error) {
      setSaveError(`Not saved: ${errorMessage(error)}`);
    }
    setSaving(false);
  };

  const toggleRow = async (row) => {
    const switchingOn = !row.isActive;
    if (!switchingOn) {
      const confirmed = await askConfirm({
        title: 'Switch off this row?',
        message: `${list.name}: ${row.notifNo || row.ritc || ''} ${row.cth || ''}`.trim(),
        note: 'The row stays in the list and can be switched on again. Tick "Show switched-off rows" to see it.',
        okLabel: 'Switch off',
        cancelLabel: 'Keep it on',
      });
      if (!confirmed) return;
    }
    try {
      await mastersFormApi.setDutyListRowActive(kind, row.id, switchingOn);
      reload();
    } catch (error) {
      setLoadError(`Not changed: ${errorMessage(error)}`);
    }
  };

  const columns = list.columns.map((column) => ({
    key: column.key,
    header: column.header,
    align: column.align,
    className: cn('tw:align-top', column.wide && 'tw:min-w-[180px] tw:max-w-[360px] tw:whitespace-normal'),
    cell: (row) => (column.format ? column.format(row[column.key]) : (isBlank(row[column.key]) ? '-' : row[column.key])),
  }));
  if (!list.readOnly) {
    columns.push({
      key: 'actions',
      header: 'Action',
      align: 'right',
      cell: (row) => (
        <span className="tw:inline-flex tw:gap-1">
          <Button variant="link" size="sm" onClick={() => openRow(row)}>EDIT</Button>
          <Button variant="link" size="sm" className="tw:text-warning" onClick={() => toggleRow(row)}>{row.isActive ? 'SWITCH OFF' : 'SWITCH ON'}</Button>
        </span>
      ),
    });
  }

  const searched = query.trim();
  const emptyText = loading || loadError ? '' : searched ? `No row matches "${searched}".`
    : list.readOnly ? 'No rows loaded yet.'
      : 'No rows yet. Use "Add row", or run load_logisys_duty_lists.bat to bring in the rows downloaded from Logisys.';
  const pages = Math.max(1, Math.ceil(pageData.total / pageData.limit));
  const firstShown = pageData.total ? (page - 1) * pageData.limit + 1 : 0;
  const lastShown = Math.min(page * pageData.limit, pageData.total);

  return (
    <div className="tw:flex tw:h-full tw:min-w-0 tw:flex-col tw:gap-2.5">
      <Tabs value={kind} onValueChange={pickTab}>
        <TabsList className="tw:flex-wrap">
          {LISTS.map((each) => (
            <TabsTrigger key={each.key} value={each.key}>
              {each.name}
              {counts[each.key] && <span className="tw:rounded-full tw:bg-foreground/10 tw:px-1.5 tw:text-[11px] tw:font-bold">{countText(counts[each.key].active)}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <p className="tw:m-0 tw:text-entry tw:leading-normal tw:normal-case tw:text-muted-foreground">{list.note}</p>

      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5">
        <div className="tw:w-full tw:sm:max-w-[520px] tw:sm:flex-[1_1_320px]">
          <Input leftIcon={Search} data-allow-text="" aria-label={`Search ${list.name}`} placeholder={list.hint} className="tw:normal-case" value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
        </div>
        {!list.readOnly && (
          <Label className="tw:cursor-pointer tw:normal-case">
            <Checkbox checked={showOff} onCheckedChange={(checked) => { setShowOff(checked === true); setPage(1); }} /> Show switched-off rows
          </Label>
        )}
        <span className="tw:flex-1" />
        {!list.readOnly && <Button variant="default" onClick={() => openRow(null)}><Plus /> Add row</Button>}
      </div>

      {edit && (
        <div className="tw:rounded-md tw:border tw:border-primary tw:bg-card tw:px-3 tw:py-2.5">
          <h4 className="tw:mt-0 tw:mb-2 tw:text-[13px] tw:font-bold tw:text-primary">{edit.id ? 'Change row' : 'Add row'} - {list.name}</h4>
          <div className="tw:grid tw:grid-cols-1 tw:gap-x-2.5 tw:gap-y-2 tw:sm:grid-cols-2 tw:md:grid-cols-12">
            {list.fields.map((field) => (
              <Field key={field.name} label={field.label} required={field.required} layout="col" className={SPAN_CLASS[field.span]}>
                <EditBox field={field} value={edit[field.name]} onChange={changeField(field)} onEnter={save} />
              </Field>
            ))}
          </div>
          <div className="tw:mt-2.5 tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <Button variant="default" disabled={saving} onClick={save}><Save /> {edit.id ? 'Save changes' : 'Add row'}</Button>
            <Button onClick={closeEdit}><X /> Cancel</Button>
            {saveError && <span role="alert" className="tw:text-entry tw:font-semibold tw:normal-case tw:text-destructive">{saveError}</span>}
          </div>
        </div>
      )}

      {loadError && <div role="alert" className="tw:text-entry tw:font-semibold tw:normal-case tw:text-destructive">{loadError}</div>}
      <DataTable columns={columns} rows={pageData.rows} emptyText={emptyText} rowClassName={(row) => (row.isActive ? '' : 'tw:text-muted-foreground')}
        containerClassName="tw:min-h-[160px] tw:flex-1 tw:rounded-md tw:border tw:border-border tw:bg-card" />

      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2.5 tw:pr-14 tw:pl-[18px] tw:text-entry tw:normal-case tw:text-muted-foreground">
        <span>
          {loading ? 'Reading...' : pageData.total ? `${countText(firstShown)} - ${countText(lastShown)} of ${countText(pageData.total)} rows` : '0 rows'}
        </span>
        <span className="tw:flex tw:items-center tw:gap-1.5">
          <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page} of {countText(pages)}</span>
          <Button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </span>
      </div>
    </div>
  );
}
