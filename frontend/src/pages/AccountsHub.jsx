// The Accounts page (/accounts-hub): title, breadcrumb, search and + New, then the screen picked in the navbar Accounts
// menu (?item=) - or the accounts dashboard when no screen is open.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Plus, Save, Trash2, Pencil, Download, ArrowRightLeft, Lock, Unlock, RotateCcw, ChevronRight, Building2, CalendarDays } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { cn } from '@/lib/utils';
import { downloadBlob } from '@/lib/download';
import { askConfirm } from '@/components/common/askConfirm';
import {
  Button, Checkbox, DateInput, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  Input, Label, NumberInput, SelectBox,
} from '@/components/ui';
import { useHoverOpen } from '@/components/AppHeader/useHoverOpen';
import { canOpen } from '../utils/permissions';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { ALL_ITEMS, hrefOf, QUICK } from './AccountsHubParts/menu';
import { fmtDate, lookup, Box, Btn, ActionBar, Field, Grid, Badge, LedgerPicker, SuggestBox } from './AccountsHubParts/ui';
import { accountsApi } from './AccountsHubParts/accountsApi';
import VoucherDesk from './AccountsHubParts/VoucherDesk';
import CommandSearch from './AccountsHubParts/CommandSearch';
import AccountsDashboard from './AccountsHubParts/Dashboard';
import { GroupsScreen, LedgerScreen, TdsScreen, MapCsrScreen } from './AccountsHubParts/MastersDesk';
import { ReportView, LedgerReport } from './AccountsHubParts/ReportsDesk';
import { ChequeBooksScreen, JobClosingScreen, TdsPayableScreen, ApprovalsScreen, InterBranchScreen } from './AccountsHubParts/OtherDesk';
import { OutstandingScreen, CreditControlScreen, BankRecoScreen } from './AccountsHubParts/ControlDesk';
import GstInvoiceDesk, { ProvisionalSheetScreen } from './AccountsHubParts/GstInvoiceDesk';

// the top bar sets the branch and year a moment after the page opens; after this long the screen opens anyway
const SCOPE_WAIT_MS = 2500;

const isAllowed = (item) => canOpen(hrefOf(item).split('?')[0]);

const SIMPLE_VIEWS = {
  months: MonthClosing, merge: MergeAccount, groups: GroupsScreen, ledgers: LedgerScreen, tds: TdsScreen, mapcsr: MapCsrScreen,
  ledgerrep: LedgerReport, cheques: ChequeBooksScreen, jobs: JobClosingScreen, tdspay: TdsPayableScreen,
  outstanding: OutstandingScreen, credit: CreditControlScreen, brs: BankRecoScreen, provsheet: ProvisionalSheetScreen,
};

function ScreenFor({ item }) {
  if (item.desk) return <VoucherDesk key={item.id} desk={item.desk} section={item.section} />;
  if (item.master) return <MasterCrud key={item.id} kind={item.master} />;
  if (item.report) return <ReportView key={item.id} item={item} />;
  if (item.view === 'approvals') return <ApprovalsScreen key={item.id} startTab={item.id === 'approval' ? 'rules' : 'pending'} Rules={<MasterCrud kind="approvals" />} />;
  if (item.view === 'ib') return <InterBranchScreen key={item.id} startTab={item.id === 'ibraise' ? 'raise' : 'list'} />;
  if (item.view === 'gstinv') return <GstInvoiceDesk key={item.kind} kind={item.kind} />;
  const View = SIMPLE_VIEWS[item.view];
  return View ? <View /> : null;
}

const scopeKeyOf = ({ activeBranch, activeYear }) => {
  const branchKey = activeBranch ? (activeBranch.isAll ? 'ALL' : activeBranch.branchCode) || '' : '';
  return `${branchKey}|${activeYear?.id || ''}`;
};

// which branch and year the figures are from (changed in the top bar)
function ScopeBadges({ branch, year }) {
  const badgeClass = 'tw:inline-flex tw:items-center tw:gap-1.25 tw:rounded-full tw:border tw:px-2.5 tw:py-0.75 tw:text-[11.5px] tw:font-extrabold tw:tracking-[0.02em] tw:shadow-xs';
  return (
    <>
      {branch && (
        <span
          title="Branch in scope (change it in the top bar)"
          className={cn(badgeClass, 'tw:ml-2.5', branch.isAll ? 'tw:border-amber-500 tw:bg-amber-100 tw:text-amber-800' : 'tw:border-transparent tw:bg-primary tw:text-primary-foreground')}
        >
          <Building2 className="tw:size-3" />{branch.isAll ? 'All branches' : branch.branchCode + ' - ' + branch.branchName}
        </span>
      )}
      {year && (
        <span title="Financial year in scope (change it in the top bar)" className={cn(badgeClass, 'tw:border-violet-300 tw:bg-violet-100 tw:text-violet-800 tw:shadow-none')}>
          <CalendarDays className="tw:size-3" />FY {year.code || year.name}
        </span>
      )}
    </>
  );
}

export default function AccountsHub() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [searchOpen, setSearchOpen] = useState(false);
  const [scopeWaitOver, setScopeWaitOver] = useState(false);
  const active = ALL_ITEMS.find((item) => item.id === params.get('item')) || null;
  const activeBranch = useWorkspaceStore((state) => state.activeBranch);
  const activeYear = useWorkspaceStore((state) => state.activeYear);
  const scopeReady = scopeWaitOver || Boolean(activeBranch && activeYear);

  useEffect(() => {
    const timer = setTimeout(() => setScopeWaitOver(true), SCOPE_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  const open = (item) => { if (item.route) navigate(item.route); else setParams({ item: item.id }); };
  const goHome = () => setParams({});
  const quickItems = QUICK.map((quick) => ALL_ITEMS.find((item) => item.id === quick.id)).filter((item) => item && isAllowed(item));
  const linkClass = 'tw:cursor-pointer tw:underline';

  return (
    <div className="tw:min-h-full tw:bg-page tw:px-2 tw:pt-1 tw:pb-2">
      <div className="tw:mb-1.5 tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-4">
        <div className="tw:min-w-0">
          <h1 onClick={goHome} className="tw:m-0 tw:cursor-pointer tw:text-[1.35rem] tw:leading-tight tw:font-extrabold tw:tracking-[-0.5px] tw:text-foreground">
            {active ? active.label : 'Accounts'}
          </h1>
          <p className="tw:mt-0.75 tw:mb-0 tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:text-[11.5px] tw:text-muted-foreground">
            {active ? (
              <>
                <span onClick={goHome} className={linkClass} title="Back to Accounts home">Accounts</span>
                <ChevronRight className="tw:size-3" />
                <span onClick={goHome} className={linkClass} title={'Back to ' + active.section.title}>{active.section.title}</span>
              </>
            ) : 'Books, vouchers, bills and reports in one place.'}
            <ScopeBadges branch={activeBranch} year={activeYear} />
          </p>
        </div>
        <div className="tw:flex tw:w-full tw:items-center tw:gap-2.5 tw:md:w-auto">
          <Button
            onClick={() => setSearchOpen(true)}
            className="tw:h-8 tw:min-w-0 tw:flex-1 tw:justify-start tw:gap-2 tw:rounded-lg tw:border-input tw:text-[13px] tw:font-normal tw:text-muted-foreground tw:md:w-[320px] tw:md:flex-none"
          >
            <Search className="tw:size-4" />
            <span className="tw:truncate">Search ledger, voucher or bill</span>
          </Button>
          <NewMenu items={quickItems} onPick={open} />
        </div>
      </div>

      <div className="tw:mb-3 tw:border-t tw:border-input" />

      {!scopeReady && active && <div className="tw:p-7.5 tw:text-center tw:text-[13px] tw:text-muted-foreground">Loading branch and year...</div>}
      {(scopeReady || !active) && (
        <div key={scopeKeyOf({ activeBranch, activeYear })}>
          {active ? <ScreenFor item={active} /> : <AccountsDashboard />}
        </div>
      )}
      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

// "+ New" with the common entry screens, like the + New Job button on the main dashboard
function NewMenu({ items, onPick }) {
  const { open, setOpen, hoverProps } = useHoverOpen();
  if (!items.length) return null;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          size="lg"
          className="tw:px-4.5 tw:font-semibold tw:shadow-md"
          {...hoverProps}
          onPointerDown={(event) => { if (event.pointerType === 'mouse' && open) event.preventDefault(); }}
        >
          <Plus /> New
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="tw:min-w-[200px] tw:p-2" {...hoverProps}>
        {items.map((item) => <DropdownMenuItem key={item.id} onSelect={() => onPick(item)} className="tw:px-3 tw:py-2">{item.label}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ------------------------------------------------------------------ master field input
const LOOKUP_TYPES = ['ledger', 'tdsnature', 'costcentre'];

function FieldInput({ field, value, onChange, look }) {
  if (field.type === 'bool') {
    return (
      <Label className="tw:h-7 tw:cursor-pointer">
        <Checkbox checked={Boolean(Number(value))} onCheckedChange={(checked) => onChange(checked === true ? 1 : 0)} /> Yes
      </Label>
    );
  }
  if (field.type === 'select') return <SelectBox options={field.options} value={value || ''} onValueChange={onChange} placeholder="Select" clearable clearLabel="Select" />;
  if (field.type === 'date') return <DateInput value={value ? String(value).slice(0, 10) : ''} onValueChange={onChange} />;
  if (field.type === 'number') return <NumberInput negative align="right" value={value ?? ''} onValueChange={onChange} />;
  if (LOOKUP_TYPES.includes(field.type)) {
    const list = look[field.type] || [];
    const labelOf = (entry) => entry.name + (field.type === 'tdsnature' && entry.section ? ' (' + entry.section + ')' : '');
    const items = list.map((entry) => ({ id: entry.id, name: labelOf(entry), groupName: entry.groupName || '' }));
    return <LedgerPicker id={'fi-' + field.key} list={items} value={value || ''} onChange={(id) => onChange(id || '')} placeholder={list.length ? 'Type to search' : 'No entries yet'} />;
  }
  if (field.type === 'sac') {
    return (
      <SuggestBox
        text={value || ''}
        onText={onChange}
        onPick={(sac) => onChange(sac.code)}
        items={look.sac || []}
        getKey={(sac) => sac.code}
        getLabel={(sac) => sac.code + ' ' + (sac.description || '')}
        getSub={(sac) => sac.description || ''}
        placeholder="996511 ..."
      />
    );
  }
  return <Input data-allow-text="" value={value || ''} onChange={(event) => onChange(event.target.value)} />;
}

const displayValue = (field, value, look) => {
  if (value === null || value === undefined || value === '') return '';
  if (field.type === 'bool') return Number(value) ? 'Yes' : 'No';
  if (field.type === 'date') return fmtDate(value);
  if (LOOKUP_TYPES.includes(field.type)) {
    const entry = (look[field.type] || []).find((option) => String(option.id) === String(value));
    return entry ? entry.name : '#' + value;
  }
  if (field.type === 'number') return Number(value).toLocaleString('en-IN');
  return String(value);
};

const csvCell = (value) => { const text = String(value ?? ''); return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text; };
const isActiveEntry = (row) => row.isActive === undefined || row.isActive === null || Boolean(Number(row.isActive));
const STATUS_OPTIONS = [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }];

function MasterList({ meta, rows, shown, look, selectedId, query, onQuery, status, onStatus, onPick }) {
  const titleField = meta.fields[0];
  const subFields = meta.fields.slice(1, 3);
  return (
    <div className="tw:flex tw:max-h-[calc(100vh-190px)] tw:flex-col tw:rounded-lg tw:border tw:border-border tw:bg-card tw:lg:sticky tw:lg:top-2">
      <div className="tw:flex tw:items-center tw:border-b tw:border-border/60 tw:px-2.5 tw:py-2">
        <span className="tw:text-[11px] tw:font-extrabold tw:tracking-wider tw:text-head tw:uppercase">{meta.title}</span>
        <span className="tw:ml-auto tw:text-[10.5px] tw:text-muted-foreground">{shown.length} of {rows.length}</span>
      </div>
      <div className="tw:grid tw:grid-cols-[1fr_96px] tw:gap-1.5 tw:border-b tw:border-border/60 tw:p-2">
        <Input data-allow-text="" leftIcon={Search} value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search" />
        <SelectBox options={STATUS_OPTIONS} value={status} onValueChange={onStatus} placeholder="All" clearable clearLabel="All" />
      </div>
      <div className="tw:flex-1 tw:overflow-y-auto">
        {shown.map((row) => {
          const selected = String(selectedId) === String(row.id);
          return (
            <Button
              key={row.id}
              variant="ghost"
              size="block"
              onClick={() => onPick(row)}
              className={cn(
                'tw:flex-col tw:items-stretch tw:gap-0 tw:rounded-none tw:border-0 tw:border-b tw:border-l-3 tw:border-b-border/60 tw:border-l-transparent tw:px-2.5 tw:py-1.75 tw:text-foreground',
                selected && 'tw:border-l-primary tw:bg-accent',
                !isActiveEntry(row) && 'tw:opacity-55'
              )}
            >
              <span className="tw:flex tw:justify-between tw:gap-1.5">
                <span className="tw:truncate tw:text-[11.5px] tw:font-bold">{displayValue(titleField, row[titleField.key], look) || '(blank)'}</span>
                {!isActiveEntry(row) && <Badge tone="muted">Inactive</Badge>}
              </span>
              <span className="tw:truncate tw:text-[10px] tw:text-muted-foreground">{subFields.map((field) => displayValue(field, row[field.key], look)).filter(Boolean).join(' | ')}</span>
            </Button>
          );
        })}
        {!shown.length && <div className="tw:p-5 tw:text-center tw:text-[11.5px] tw:text-muted-foreground">{rows.length ? 'No entry matches' : 'No entries yet'}</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ generic master: form, Save / Modify / Delete / Clear, list
function MasterCrud({ kind }) {
  const [meta, setMeta] = useState(null);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({});
  const [look, setLook] = useState({});
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const blankForm = (fields = meta.fields) => ({ ...Object.fromEntries(fields.map((field) => [field.key, field.type === 'bool' ? 0 : ''])), isActive: 1 });

  const loadRows = async () => {
    try {
      setRows(await accountsApi.hubMasterRows(kind));
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };
  useEffect(() => {
    const start = async () => {
      try {
        const masterMeta = await accountsApi.hubMasterMeta(kind);
        setMeta(masterMeta);
        setForm(blankForm(masterMeta.fields));
        loadRows();
        const types = new Set(masterMeta.fields.map((field) => field.type));
        const [ledger, tdsnature, costcentre, sac] = await Promise.all([
          types.has('ledger') ? lookup('ledgers') : [],
          types.has('tdsnature') ? lookup('tdsnatures') : [],
          types.has('costcentre') ? lookup('costcentres') : [],
          types.has('sac') ? lookup('sac') : [],
        ]);
        setLook({ ledger, tdsnature, costcentre, sac });
      } catch (error) {
        setMessage(errorMessage(error));
      }
    };
    start();
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!meta) return <Box className="tw:bg-card"><span className="tw:text-muted-foreground">{message || 'Loading'}</span></Box>;

  const pick = (row) => { setForm({ ...row }); setMessage(''); };
  const save = async () => {
    setMessage('');
    const missing = meta.fields.find((field) => field.required && (form[field.key] === '' || form[field.key] == null));
    if (missing) { setMessage('Enter ' + missing.label); return; }
    try {
      await accountsApi.hubSaveMaster(kind, form);
      setMessage(form.id ? 'Updated' : 'Saved');
      if (!form.id) setForm(blankForm());
      loadRows();
    } catch (error) {
      setMessage('Not saved: ' + errorMessage(error));
    }
  };
  const remove = async () => {
    if (!form.id || !(await askConfirm({ title: 'Delete entry', message: 'Delete this entry?', okLabel: 'Delete', tone: 'danger' }))) return;
    try {
      await accountsApi.hubDeleteMaster(kind, form.id);
      setMessage('Deleted');
      setForm(blankForm());
      loadRows();
    } catch (error) {
      setMessage('Not deleted: ' + errorMessage(error));
    }
  };
  const copyAsNew = () => {
    const copy = { ...form };
    delete copy.id;
    setForm(copy);
    setMessage('Copied - change it and Save as a new entry');
  };

  const titleField = meta.fields[0];
  const typed = query.toLowerCase();
  const shown = rows.filter((row) => (!status || (status === 'active') === isActiveEntry(row))
    && (!typed || meta.fields.some((field) => String(displayValue(field, row[field.key], look)).toLowerCase().includes(typed))));
  const exportCsv = () => {
    const lines = [meta.fields.map((field) => csvCell(field.label)).join(',')]
      .concat(shown.map((row) => meta.fields.map((field) => csvCell(displayValue(field, row[field.key], look))).join(',')));
    downloadBlob(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' }), meta.title.replace(/[^\w]+/g, '_') + '.csv');
  };

  return (
    <div className="tw:grid tw:grid-cols-1 tw:items-start tw:gap-3 tw:lg:grid-cols-[minmax(260px,330px)_minmax(0,1fr)]">
      <MasterList
        meta={meta} rows={rows} shown={shown} look={look} selectedId={form.id}
        query={query} onQuery={setQuery} status={status} onStatus={setStatus} onPick={pick}
      />
      <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2.5">
        <Box
          className="tw:bg-card"
          title={form.id ? meta.title + ' - ' + (displayValue(titleField, form[titleField.key], look) || '') : meta.title + ' - new entry'}
          right={(
            <Label className="tw:cursor-pointer tw:text-foreground/80">
              <Checkbox checked={form.isActive === undefined || Boolean(Number(form.isActive))} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked === true ? 1 : 0 }))} /> Active
            </Label>
          )}
        >
          <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] tw:gap-3">
            {meta.fields.map((field) => (
              <Field key={field.key} label={field.label} required={field.required}>
                <FieldInput field={field} value={form[field.key]} look={look} onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))} />
              </Field>
            ))}
          </div>
        </Box>
        <ActionBar note={message}>
          <Btn kind="save" onClick={save} disabled={Boolean(form.id)}><Save /> Save</Btn>
          <Btn kind="save" onClick={save} disabled={!form.id}><Pencil /> Modify</Btn>
          <Btn kind="danger" onClick={remove} disabled={!form.id}><Trash2 /> Delete</Btn>
          <Btn kind="clear" onClick={() => { setForm(blankForm()); setMessage(''); }}><RotateCcw /> Clear</Btn>
          <Btn kind="plain" onClick={copyAsNew} disabled={!form.id}><Plus /> Copy as new</Btn>
          <Btn kind="plain" onClick={exportCsv} disabled={!shown.length}><Download /> Excel</Btn>
        </ActionBar>
        <Grid
          title={'All entries (' + shown.length + ')'}
          maxHeight="calc(100vh - 420px)"
          rows={shown}
          rowKey={(row) => row.id}
          activeKey={form.id}
          onRow={pick}
          empty="No entries yet - fill the form above and Save"
          cols={meta.fields.slice(0, 7).map((field) => ({ label: field.label, right: field.type === 'number', render: (row) => displayValue(field, row[field.key], look) }))}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ month closing
function MonthClosing() {
  const [closing, setClosing] = useState(null);
  const [message, setMessage] = useState('');
  const load = async () => {
    try {
      setClosing(await accountsApi.hubMonths());
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };
  useEffect(() => { load(); }, []);

  const change = async (month, action) => {
    const closingMonth = action === 'close';
    const confirmed = await askConfirm({
      title: closingMonth ? 'Close month' : 'Re-open month',
      message: (closingMonth ? 'Close ' : 'Re-open ') + month.periodName + '?',
      note: closingMonth ? 'No voucher can be saved with a date in this month.' : undefined,
      okLabel: closingMonth ? 'Close month' : 'Re-open',
      tone: closingMonth ? 'danger' : 'warn',
    });
    if (!confirmed) return;
    try {
      await accountsApi.hubSetMonthState(month.month, action);
      setMessage((closingMonth ? 'Closed ' : 'Re-opened ') + month.periodName);
      load();
    } catch (error) {
      setMessage('Not changed: ' + errorMessage(error));
    }
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-2.5">
      <Grid
        title={'Month Closing' + (closing?.fy ? ' - FY ' + (closing.fy.name || closing.fy.code) : '')}
        maxHeight="none"
        rows={closing ? closing.months : []}
        rowKey={(month) => month.month}
        cols={[
          { label: 'Month', render: (month) => <b>{month.periodName}</b> },
          { label: 'Vouchers', right: true, render: (month) => month.vouchers },
          { label: 'Status', render: (month) => (month.isClosed ? <Badge tone="bad">Closed</Badge> : <Badge tone="ok">Open</Badge>) },
          { label: 'Closed On', render: (month) => (month.isClosed ? fmtDate(month.closedOn) : '') },
          { label: 'Closed By', render: (month) => (month.isClosed ? month.closedBy || '' : '') },
          {
            label: 'Action',
            right: true,
            render: (month) => (month.isClosed
              ? <Btn small kind="clear" onClick={() => change(month, 'open')}><Unlock className="tw:size-3" /> Re-open</Btn>
              : <Btn small kind="danger" onClick={() => change(month, 'close')}><Lock className="tw:size-3" /> Close month</Btn>),
          },
        ]}
      />
      {message && <ActionBar note={message} />}
    </div>
  );
}

// ------------------------------------------------------------------ merge account
function MergeAccount() {
  const [ledgers, setLedgers] = useState([]);
  const [fromId, setFromId] = useState('');
  const [intoId, setIntoId] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const loadLedgers = async () => setLedgers(await lookup('ledgers'));
    loadLedgers();
  }, []);
  const fromLedger = ledgers.find((ledger) => ledger.id === fromId);
  const intoLedger = ledgers.find((ledger) => ledger.id === intoId);

  const merge = async () => {
    if (!fromLedger || !intoLedger || fromLedger.id === intoLedger.id) { setMessage('Choose two different ledgers'); return; }
    const confirmed = await askConfirm({
      title: 'Merge account',
      message: `All entries of "${fromLedger.name}" will move to "${intoLedger.name}" and "${fromLedger.name}" will be deleted. Continue?`,
      okLabel: 'Merge',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      const result = await accountsApi.hubMergeLedgers(fromLedger.id, intoLedger.id);
      setMessage(`Merged "${result.merged}" into "${result.into}"`);
      setLedgers(await lookup('ledgers', true));
    } catch (error) {
      setMessage('Not merged: ' + errorMessage(error));
    }
  };

  return (
    <div className="tw:flex tw:max-w-[900px] tw:flex-col tw:gap-2.5">
      <Box title="Merge Account" className="tw:bg-card">
        <div className="tw:mb-2.5 tw:text-entry tw:text-muted-foreground">
          Moves every voucher line of the first ledger to the second, adds its opening balance, then deletes the first ledger. Use it for duplicate accounts.
        </div>
        <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-2.5 tw:md:grid-cols-[1fr_auto_1fr]">
          <Field label="Merge (will be deleted)" hint={fromLedger ? fromLedger.groupName : ' '}>
            <LedgerPicker id="mergeA" list={ledgers} value={fromId} onChange={(id) => setFromId(id || '')} />
          </Field>
          <ArrowRightLeft className="tw:mb-6 tw:hidden tw:size-4.5 tw:text-head tw:md:block" />
          <Field label="Into (stays)" hint={intoLedger ? intoLedger.groupName : ' '}>
            <LedgerPicker id="mergeB" list={ledgers} value={intoId} onChange={(id) => setIntoId(id || '')} />
          </Field>
        </div>
      </Box>
      <ActionBar note={message}><Btn kind="danger" onClick={merge} disabled={!fromId || !intoId}><ArrowRightLeft /> Merge</Btn></ActionBar>
    </div>
  );
}
