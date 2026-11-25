import { useEffect, useMemo, useState } from 'react';
import { Hash, Info, Plus, RotateCcw, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Checkbox, DataTable, Field, Input, SelectBox } from '@/components/ui';
import { errorMessage } from '@/services/axiosInstance';
import { settingsApi } from '../settingsApi';
import { SettingsHeading } from './SettingsParts/SettingsCard';

// Every document number (vouchers, GST invoices, dockets) comes from here, in iCAFFE's format, per branch + division
// + financial year; a new financial year starts at 1, as iCAFFE does.
const DIVISION_NAMES = { AE: 'Export Air', AI: 'Import Air', SE: 'Export Sea', SI: 'Import Sea', '': 'All' };
const ALL_DIVISIONS = '__all__';

const formatTags = (text) => text.toUpperCase().replace(/\{(n|yy|fy|div)\}/gi, (tag) => tag.toUpperCase());

function NewSeriesForm({ series, setSeries, lists, onAdd, onCancel }) {
  const set = (name) => (value) => setSeries({ ...series, [name]: value });
  const selects = [
    { name: 'docType', label: 'Document', className: 'tw:lg:col-span-2', options: lists.docs.map((doc) => ({ value: doc.id, label: doc.label })) },
    { name: 'branchCode', label: 'Branch', options: lists.branches.map((branch) => branch.branchCode) },
    {
      name: 'division', label: 'Division',
      options: [{ value: ALL_DIVISIONS, label: 'All (shared)' }, ...lists.divisions.filter(Boolean)],
    },
  ];
  const boxes = [
    { name: 'fyCode', label: 'Year' },
    { name: 'format', label: 'Format', placeholder: 'BA/NDL/AE/{N}', clean: formatTags, className: 'tw:lg:col-span-2' },
    { name: 'pad', label: 'Digits' },
    { name: 'nextNo', label: 'Next No' },
  ];
  return (
    <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-2 tw:rounded-lg tw:border tw:border-primary/30 tw:bg-primary/5 tw:p-2.5 tw:sm:grid-cols-2 tw:lg:grid-cols-10">
      {selects.map((select) => (
        <Field key={select.name} layout="col" label={select.label} className={select.className} labelClassName="tw:font-bold tw:text-[11px]">
          <SelectBox className="tw:w-full" options={select.options}
            value={select.name === 'division' && series.division === '' ? ALL_DIVISIONS : series[select.name]}
            onValueChange={(value) => set(select.name)(select.name === 'division' && value === ALL_DIVISIONS ? '' : value)} />
        </Field>
      ))}
      {boxes.map((box) => (
        <Field key={box.name} layout="col" label={box.label} className={box.className} labelClassName="tw:font-bold tw:text-[11px]">
          <Input data-allow-text="" value={series[box.name]} placeholder={box.placeholder}
            onChange={(event) => set(box.name)(box.clean ? box.clean(event.target.value) : event.target.value)} />
        </Field>
      ))}
      <div className="tw:flex tw:gap-1.5">
        <Button variant="success" onClick={onAdd}><Save /> Add</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default function NumberSeriesTab() {
  const [lists, setLists] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [edits, setEdits] = useState({});
  const [branch, setBranch] = useState('');
  const [division, setDivision] = useState('');
  const [newSeries, setNewSeries] = useState(null);

  const load = async () => {
    try {
      const result = await settingsApi.numberSeries();
      setLists(result);
      setEdits({});
      if (result.branches[0]) setBranch((current) => current || result.branches[0].branchCode);
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  };

  useEffect(() => { load(); }, []);

  const rows = useMemo(
    () => (lists ? lists.rows.filter((row) => (!branch || row.branchCode === branch) && (!division || row.division === division)) : []),
    [lists, branch, division],
  );

  const valueOf = (row, name) => (edits[row.id] && edits[row.id][name] !== undefined ? edits[row.id][name] : row[name]);
  const setValue = (row, name, value) => setEdits((current) => ({ ...current, [row.id]: { ...(current[row.id] || {}), [name]: value } }));

  const run = async (call, doneMessage) => {
    setError('');
    setMessage('');
    try {
      await call();
      setMessage(doneMessage);
      load();
    } catch (saveError) {
      setError(errorMessage(saveError));
    }
  };

  const saveRow = (row) => run(() => settingsApi.updateNumberSeries(row.id, { ...row, ...edits[row.id] }), `Saved ${row.label} ${row.branchCode} ${row.division}`);
  const addSeries = () => run(async () => { await settingsApi.createNumberSeries(newSeries); setNewSeries(null); }, 'Series added');

  if (!lists) return <div className={cn('tw:p-5', error ? 'tw:text-destructive' : 'tw:text-muted-foreground')}>{error || 'Loading...'}</div>;

  const startNewSeries = () => setNewSeries({
    docType: lists.docs[0].id, branchCode: branch || (lists.branches[0] || {}).branchCode || '', division: division || 'AE', fyCode: lists.fy, format: '', pad: 0, nextNo: 1,
  });

  const editBox = (name, width) => (row) => (
    <Input data-allow-text="" className={width} value={valueOf(row, name) ?? ''} onChange={(event) => setValue(row, name, event.target.value)} />
  );

  const columns = [
    { key: 'label', header: 'Document', className: 'tw:font-bold' },
    { key: 'branchCode', header: 'Branch' },
    { key: 'division', header: 'Division', cell: (row) => (row.division ? `${row.division} - ${DIVISION_NAMES[row.division]}` : 'All (one counter)') },
    { key: 'fyCode', header: 'Year' },
    { key: 'format', header: 'Format', cell: editBox('format', 'tw:w-[170px]') },
    { key: 'pad', header: 'Digits', cell: editBox('pad', 'tw:w-[50px]') },
    { key: 'nextNo', header: 'Next No', cell: editBox('nextNo', 'tw:w-[90px]') },
    { key: 'next', header: 'Next number', className: 'tw:font-mono tw:font-bold tw:text-primary', cell: (row) => row.next || row.sample },
    {
      key: 'lastNo', header: 'Last given', className: 'tw:text-[11px]',
      cell: (row) => <>{row.lastNo || ''}{row.lastDate && <div className="tw:text-muted-foreground">{row.lastDate}</div>}</>,
    },
    { key: 'source', header: 'Source', className: 'tw:text-[11px] tw:text-muted-foreground', cell: (row) => row.source || '' },
    {
      key: 'isActive', header: 'Active',
      cell: (row) => <Checkbox checked={Boolean(Number(valueOf(row, 'isActive')))} onCheckedChange={(checked) => setValue(row, 'isActive', checked === true ? 1 : 0)} />,
    },
    {
      key: 'save', header: '',
      cell: (row) => <Button variant="success" size="sm" disabled={!edits[row.id]} onClick={() => saveRow(row)}><Save /> Save</Button>,
    },
  ];

  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      <SettingsHeading icon={Hash} title="Number Series (iCAFFE)"
        description={`Voucher, invoice and docket numbers as iCAFFE gives them - per branch, division and year (${lists.fy}). The number is given on Save; a new financial year starts at 1.`} />

      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <SelectBox className="tw:w-full tw:sm:w-[200px]" value={branch} onValueChange={setBranch} clearable clearLabel="All branches" placeholder="All branches"
          options={lists.branches.map((item) => ({ value: item.branchCode, label: `${item.branchCode} - ${item.branchName}${item.icaffeCode ? ` (iCAFFE ${item.icaffeCode})` : ''}` }))} />
        <SelectBox className="tw:w-full tw:sm:w-[170px]" value={division} onValueChange={setDivision} clearable clearLabel="All divisions" placeholder="All divisions"
          options={lists.divisions.filter(Boolean).map((item) => ({ value: item, label: `${item} - ${DIVISION_NAMES[item]}` }))} />
        <Button variant="default" onClick={startNewSeries}><Plus /> Add series</Button>
        <Button variant="secondary" onClick={load}><RotateCcw /> Reload</Button>
        {message && <span className="tw:text-entry tw:font-bold tw:text-success">{message}</span>}
        {error && <span className="tw:text-entry tw:font-bold tw:text-destructive">{error}</span>}
      </div>

      <div className="tw:flex tw:items-center tw:gap-1.5 tw:text-[11px] tw:text-muted-foreground">
        <Info className="tw:size-3.5 tw:shrink-0" /> Format tags: {'{N}'} the number, {'{YY}'} year the FY starts (26), {'{FY}'} 2627, {'{DIV}'} AE / AI / SE / SI. Digits = zero padding of {'{N}'} (iCAFFE invoices use 7).
      </div>

      {newSeries && <NewSeriesForm series={newSeries} setSeries={setNewSeries} lists={lists} onAdd={addSeries} onCancel={() => setNewSeries(null)} />}

      <DataTable columns={columns} rows={rows} className="tw:min-w-[980px]" containerClassName="tw:rounded-lg tw:border tw:border-border"
        rowClassName={(row) => cn(row.fyCode !== lists.fy && 'tw:bg-page', !row.isActive && 'tw:opacity-55')}
        emptyText="No series for this branch / division. Without a series the old EagleView numbering is used; add the iCAFFE series here." />
    </div>
  );
}
