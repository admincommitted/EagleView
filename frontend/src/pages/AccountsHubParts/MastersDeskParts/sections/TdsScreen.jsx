import { useEffect, useState } from 'react';
import { Pencil, RotateCcw, Save, Trash2, Wand2 } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { askConfirm } from '@/components/common/askConfirm';
import { Button, Input } from '@/components/ui';
import { ActionBar, Box, Grid, inr, lookup } from '../../ui';
import { accountsApi } from '../../accountsApi';
import { FormField } from './masterParts';

const blankSection = () => ({ section: '', name: '', rate: '', rateWithoutPan: '20', exemptionLimit: '' });
const RATE_FIELDS = [['rate', 'Rate %', true], ['rateWithoutPan', 'Rate Without PAN %'], ['exemptionLimit', 'Threshold (yearly)']];

const columns = [
  { label: 'Section', render: (row) => <b>{row.section}</b> },
  { label: 'Nature of payment', render: (row) => row.name },
  { label: 'Rate %', right: true, render: (row) => Number(row.rate) },
  { label: 'Without PAN %', right: true, render: (row) => Number(row.rateWithoutPan) },
  { label: 'Threshold', right: true, render: (row) => (Number(row.exemptionLimit) ? inr(row.exemptionLimit, 0) : '-') },
  { label: 'Ledgers using it', right: true, render: (row) => row.ledgers || '-' },
];

// TDS sections and rates, and how many ledgers use each
export function TdsScreen() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(blankSection);
  const [msg, setMsg] = useState('');
  const setField = (key, value) => setForm((old) => ({ ...old, [key]: value }));

  const load = async () => {
    try { setRows(await accountsApi.mastersTdsSchedule()); } catch (error) { setMsg('Not loaded: ' + errorMessage(error)); }
  };
  useEffect(() => { load(); }, []);
  const changed = () => { lookup('tdsnatures', true); load(); };

  const clear = () => { setForm(blankSection()); setMsg(''); };
  const save = async () => {
    setMsg('');
    try {
      if (form.id) await accountsApi.mastersUpdateTdsSection(form.id, form); else await accountsApi.mastersCreateTdsSection(form);
      setMsg(form.id ? 'Updated' : 'Saved');
      changed();
      if (!form.id) clear();
    } catch (error) { setMsg('Not saved: ' + errorMessage(error)); }
  };
  const remove = async () => {
    if (!form.id) return;
    if (!(await askConfirm({ title: 'Delete TDS section', message: 'Delete ' + form.section + ' - ' + form.name + '?', okLabel: 'Delete', tone: 'danger' }))) return;
    try { await accountsApi.mastersDeleteTdsSection(form.id); setMsg('Deleted'); changed(); clear(); } catch (error) { setMsg('Not deleted: ' + errorMessage(error)); }
  };
  const addStandard = async () => {
    try {
      const result = await accountsApi.mastersAddStandardTdsSections();
      setMsg(result.added ? 'Saved ' + result.added + ' standard sections' : 'Standard sections are already there');
      changed();
    } catch (error) { setMsg('Not added: ' + errorMessage(error)); }
  };
  const edit = (row) => {
    setForm({ ...row, rate: String(Number(row.rate)), rateWithoutPan: String(Number(row.rateWithoutPan)), exemptionLimit: String(Number(row.exemptionLimit) || '') });
    setMsg('');
  };
  const shown = rows.filter((row) => !query || (row.section + ' ' + row.name).toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="tw:flex tw:flex-col tw:gap-2.5">
      <Box title={form.id ? 'TDS section - ' + form.section : 'New TDS section'} className="tw:bg-card">
        <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2 tw:lg:grid-cols-[120px_minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <FormField label="Section" required><Input data-allow-text required={!form.section} value={form.section} onChange={(event) => setField('section', event.target.value.toUpperCase())} placeholder="194C" /></FormField>
          <FormField label="Nature Of Payment" required><Input data-allow-text required={!form.name} value={form.name} onChange={(event) => setField('name', event.target.value)} placeholder="Payment to contractors - others" /></FormField>
          {RATE_FIELDS.map(([key, label, required]) => (
            <FormField key={key} label={label} required={required}>
              <Input className="tw:text-right" inputMode="decimal" value={form[key]} onChange={(event) => setField(key, event.target.value)} placeholder={key === 'exemptionLimit' ? '0' : undefined} />
            </FormField>
          ))}
        </div>
      </Box>
      <ActionBar note={msg}>
        <Button variant="success" size="lg" onClick={save} disabled={!!form.id}><Save /> Save</Button>
        <Button variant="success" size="lg" onClick={save} disabled={!form.id}><Pencil /> Modify</Button>
        <Button variant="destructive" size="lg" onClick={remove} disabled={!form.id}><Trash2 /> Delete</Button>
        <Button size="lg" onClick={clear}><RotateCcw /> Clear</Button>
        <Button variant="secondary" size="lg" onClick={addStandard}><Wand2 /> Add standard sections</Button>
      </ActionBar>
      <Grid title={'TDS schedule (' + shown.length + ')'} maxHeight="calc(100vh - 400px)" rows={shown} rowKey={(row) => row.id} activeKey={form.id} onRow={edit}
        right={<Input data-allow-text value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="tw:w-[180px]" />}
        empty="No TDS sections yet - click Add standard sections" cols={columns} />
    </div>
  );
}
