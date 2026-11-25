import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowRightLeft, Save, UserPlus } from 'lucide-react';
import { Badge, Button, Checkbox, DataTable, DateInput, Input, Modal, SelectBox } from '@/components/ui';
import { salesHubApi } from './salesApi';
import { dmy, pairOptions } from './salesFormat';
import { CheckGrid, FormField, Muted, Notice } from './salesWidgets';
import { FORM_GRID } from './salesStyles';

const EMPTY = {
  name: '', code: '', role: 'EXECUTIVE', designation: '', reportingToId: '', userId: '', mobile: '', whatsapp: '', phone: '', email: '', branchCodes: '',
  services: '', aliases: '', joinDate: '', leaveDate: '', isActive: 1, remarks: '',
};
const LIST_ONLY_FIELDS = ['customers', 'prospects', 'reportingToName', 'loginName', 'loginEmail'];
const isWorking = (person) => person.isActive !== 0;
const isActiveFlag = (value) => (value === 0 || value === false ? 0 : 1);
const personOptions = (persons) => persons.filter(isWorking).map((person) => ({ value: person.id, label: person.name }));

function toForm(person) {
  if (!person) return { ...EMPTY };
  return { ...EMPTY, ...Object.fromEntries(Object.entries(person).map(([key, value]) => [key, value == null ? '' : value])) };
}

export function MoveCustomersBox({ from, persons, onMoved }) {
  const [toId, setToId] = useState('');
  const [reason, setReason] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [busy, setBusy] = useState(false);

  const move = async () => {
    setBusy(true);
    try {
      const result = await salesHubApi.moveCustomers(from.id, { toId, reason, fromDate });
      toast.success(`${result.moved} customer(s) moved to ${result.to}`);
      onMoved();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${FORM_GRID.normal} tw:mt-2 tw:items-end`}>
      <FormField label="Move his customers to" required>
        <SelectBox clearable clearLabel="-" placeholder="-" value={toId} onValueChange={setToId} options={personOptions(persons)} />
      </FormField>
      <FormField label="Reason"><Input data-allow-text="" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={`${from.name} left`} /></FormField>
      <FormField label="From date"><DateInput value={fromDate} onValueChange={setFromDate} /></FormField>
      <Button variant="default" disabled={!toId || busy} onClick={move}><ArrowRightLeft /> {busy ? 'Moving…' : 'Move customers'}</Button>
    </div>
  );
}

export function PersonForm({ person, meta, persons, users, onClose, onSaved }) {
  const [form, setForm] = useState(() => toForm(person));
  const [busy, setBusy] = useState(false);
  const [moveNeeded, setMoveNeeded] = useState(null);
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const others = persons.filter((other) => !person || other.id !== person.id);

  const save = async () => {
    setBusy(true);
    try {
      const body = { ...form, isActive: isActiveFlag(form.isActive) };
      LIST_ONLY_FIELDS.forEach((field) => delete body[field]);
      if (person) await salesHubApi.updatePerson(person.id, body);
      else await salesHubApi.createPerson(body);
      toast.success(person ? 'Sales person saved' : 'Sales person added');
      onSaved();
      onClose();
    } catch (error) {
      if (error.needsMove) setMoveNeeded({ count: error.customers });
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const pickUser = (userId) => {
    const user = users.find((candidate) => String(candidate.id) === String(userId));
    setForm((current) => ({
      ...current,
      userId,
      name: current.name || (user && (user.fullName || user.username)) || '',
      email: current.email || user?.email || '',
      mobile: current.mobile || user?.contactNumber || '',
      designation: current.designation || user?.designation || '',
    }));
  };

  const text = (field, props = {}) => <Input value={form[field]} onChange={(event) => set(field, event.target.value)} {...props} />;
  const userOptions = users.map((user) => ({ value: user.id, label: `${user.fullName || user.username} (${user.username})${user.branch ? ` - ${user.branch}` : ''}` }));
  const footer = (
    <>
      <Button onClick={onClose}>Close</Button>
      <Button variant="default" onClick={save} disabled={busy}><Save /> {busy ? 'Saving…' : 'Save'}</Button>
    </>
  );

  return (
    <Modal open onClose={onClose} title={person ? `Sales person - ${person.name}` : 'New sales person'} width={820} footer={footer}>
      <div className={FORM_GRID.normal}>
        <FormField label="Name" required span={2}>{text('name')}</FormField>
        <FormField label="Code" note="Left blank: SP001, SP002…"><Input value={form.code} onChange={(event) => set('code', event.target.value.toUpperCase())} /></FormField>
        <FormField label="Role" required><SelectBox value={form.role} onValueChange={(value) => set('role', value)} options={pairOptions(meta.roles)} /></FormField>
        <FormField label="Designation">{text('designation')}</FormField>
        <FormField label="Reports to">
          <SelectBox clearable clearLabel="-" placeholder="-" value={form.reportingToId} onValueChange={(value) => set('reportingToId', value)} options={personOptions(others)} />
        </FormField>
        <FormField label="EagleView login" note="He then sees his own customers" span={2}>
          <SelectBox clearable clearLabel="- No login -" placeholder="- No login -" value={form.userId} onValueChange={pickUser} options={userOptions} />
        </FormField>
        <FormField label="Mobile">{text('mobile')}</FormField>
        <FormField label="WhatsApp">{text('whatsapp', { placeholder: 'if not the mobile' })}</FormField>
        <FormField label="Phone / ext">{text('phone')}</FormField>
        <FormField label="E-mail" note="Quotations go out with this as reply-to">{text('email')}</FormField>
        <FormField label="Joined"><DateInput value={form.joinDate} onValueChange={(value) => set('joinDate', value)} /></FormField>
        <FormField label="Left on" note="A past date makes him inactive"><DateInput value={form.leaveDate} onValueChange={(value) => set('leaveDate', value)} /></FormField>
        <FormField label="Status">
          <SelectBox
            value={String(isActiveFlag(form.isActive))}
            onValueChange={(value) => set('isActive', Number(value))}
            options={[{ value: '1', label: 'Working' }, { value: '0', label: 'Left / inactive' }]}
          />
        </FormField>
        <FormField
          label="Names written in iCAFFE (aliases)"
          span={3}
          note="Comma between names, as typed on dockets / party masters / debtor groups - e.g. DEEPAK, DEEPAK KR, Mr. Deepak Kumar"
        >
          {text('aliases')}
        </FormField>
      </div>
      <CheckGrid
        label="Branches he sells for"
        options={(meta.branches || []).map((branch) => [branch.code, `${branch.code} - ${branch.name}`])}
        value={form.branchCodes}
        onChange={(codes) => set('branchCodes', codes.join(','))}
      />
      <CheckGrid label="Services he sells" options={meta.services || []} value={form.services} onChange={(codes) => set('services', codes.join(','))} />
      <FormField label="Remarks">{text('remarks')}</FormField>
      {moveNeeded && person && (
        <Notice tone="warning">
          {person.name} is still the KAM of {moveNeeded.count} customer(s). Move them first, then save again.
          <MoveCustomersBox from={person} persons={others} onMoved={() => { setMoveNeeded(null); onSaved(); }} />
        </Notice>
      )}
    </Modal>
  );
}

function TieToPerson({ name, persons, onTie }) {
  const [personId, setPersonId] = useState('');
  return (
    <span className="tw:flex tw:gap-1">
      <SelectBox className="tw:w-[170px]" placeholder="same person as…" value={personId} onValueChange={setPersonId} options={personOptions(persons)} />
      <Button disabled={!personId} onClick={() => onTie(name, personId)}>Tie</Button>
    </span>
  );
}

export function UnmatchedNames({ meta, persons, onDone }) {
  const [rows, setRows] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setRows((await salesHubApi.unmatchedNames()).data);
    } catch (error) {
      toast.error(error.message);
      setRows([]);
    }
  };

  useEffect(() => { load(); }, []);

  const togglePick = (name) => {
    const next = new Set(picked);
    if (next.has(name)) next.delete(name); else next.add(name);
    setPicked(next);
  };

  const addPicked = async () => {
    setBusy(true);
    try {
      const result = await salesHubApi.addPersonsFromNames([...picked]);
      toast.success(`${result.added.length} added${result.skipped.length ? `, ${result.skipped.length} already there` : ''}`);
      setPicked(new Set());
      await load();
      onDone();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const tieAsAlias = async (name, personId) => {
    const person = persons.find((candidate) => String(candidate.id) === String(personId));
    if (!person) return;
    try {
      await salesHubApi.updatePerson(person.id, { aliases: [person.aliases, name].filter(Boolean).join(',') });
      toast.success(`"${name}" is now a name of ${person.name}`);
      await load();
      onDone();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (!rows) return <Muted className="tw:text-entry">Reading the names…</Muted>;
  const unmatched = rows.filter((row) => !row.matchedTo);
  const columns = [
    {
      key: 'pick',
      header: '',
      cell: (row) => !row.matchedTo && meta.canManage && <Checkbox aria-label={`Pick ${row.name}`} checked={picked.has(row.name)} onCheckedChange={() => togglePick(row.name)} />,
    },
    {
      key: 'name',
      header: 'Name in iCAFFE',
      className: 'tw:whitespace-normal',
      cell: (row) => <><b>{row.name}</b>{row.groups.length > 0 && <Muted className="tw:text-[10.5px]">{row.groups.join(', ')}</Muted>}</>,
    },
    { key: 'dockets', header: 'Dockets', align: 'right', cell: (row) => row.dockets || '' },
    { key: 'parties', header: 'Parties', align: 'right', cell: (row) => row.parties || '' },
    { key: 'ledgers', header: 'Ledgers', align: 'right', cell: (row) => row.ledgers || '' },
    { key: 'last', header: 'Last docket', cell: (row) => dmy(String(row.last || '').slice(0, 10)) },
    {
      key: 'person',
      header: 'Sales person',
      cell: (row) => {
        if (row.matchedTo) return <Badge variant="success">{row.matchedTo}</Badge>;
        if (!meta.canManage) return <span className="tw:text-warning">not matched</span>;
        return <TieToPerson name={row.name} persons={persons} onTie={tieAsAlias} />;
      },
    },
  ];

  return (
    <div className="tw:flex tw:flex-col tw:gap-2">
      <Muted className="tw:text-entry">
        Names typed in iCAFFE as the marketing person of dockets and parties, and debtor groups named after a sales person. A name not matched to a sales person
        here is lost in the reports - add it as a new sales person, or tie it to an existing one as another way his name is written.
      </Muted>
      {meta.canManage && unmatched.length > 0 && (
        <div>
          <Button variant="default" disabled={!picked.size || busy} onClick={addPicked}><UserPlus /> Add {picked.size || ''} selected as sales persons</Button>
        </div>
      )}
      <DataTable columns={columns} rows={rows} rowKey="name" rowClassName={(row) => (row.matchedTo ? undefined : 'tw:bg-warning/10 tw:even:bg-warning/10')} />
    </div>
  );
}
