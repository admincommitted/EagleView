import { useNavigate } from 'react-router-dom';
import { Download, FileText, Pencil, RotateCcw, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, SelectBox } from '@/components/ui';
import { ActionBar, Sheet, fmtDate, inr } from '../../ui';
import { balanceText, downloadCsvFile } from '../mastersData';
import useLedgerAccount from '../hooks/useLedgerAccount';
import LedgerAccountTab from './LedgerAccountTab';
import LedgerOtherTab from './LedgerOtherTab';
import LedgerChildList from './LedgerChildList';
import { ListPanel, Stat, TWO_PANE, listRowClass } from './masterParts';

const FLAG_OPTIONS = [{ value: 'msme', label: 'MSME' }, { value: 'blacklisted', label: 'Blacklisted' }, { value: 'nogstin', label: 'No GSTIN' }, { value: 'inactive', label: 'Inactive' }];
const CHILD_TABS = ['addresses', 'banks', 'openings'];
const EXCEL_COLUMNS = [['accountCode', 'A/c Code'], ['name', 'Account'], ['groupName', 'Group'], ['gstin', 'GSTIN'], ['pan', 'PAN'], ['state', 'State'], ['msmeNo', 'MSME'], ['creditDays', 'Credit Days'], [(row) => inr(row.balance) + ' ' + row.side, 'Balance']];
const sideTone = (balance, side) => (!balance ? 'tw:text-muted-foreground' : side === 'Dr' ? 'tw:text-destructive' : 'tw:text-success');

function AccountRow({ ledger, selected, onPick }) {
  return (
    <div onClick={onPick} className={cn(listRowClass(selected), Number(ledger.isActive) === 0 && 'tw:opacity-55')}>
      <div className="tw:flex tw:justify-between tw:gap-2">
        <span className="tw:truncate tw:text-[11.5px] tw:font-bold">{ledger.name}</span>
        <span className={cn('tw:text-[11px] tw:font-bold tw:whitespace-nowrap', sideTone(ledger.balance, ledger.side))}>{ledger.balance ? inr(ledger.balance, 0) + ' ' + ledger.side : '-'}</span>
      </div>
      <div className="tw:flex tw:items-center tw:gap-1 tw:overflow-hidden tw:text-[10px] tw:whitespace-nowrap tw:text-muted-foreground">
        {Number(ledger.isBlacklisted) ? <Badge variant="danger">Blacklisted</Badge> : null}{ledger.msmeNo ? <Badge variant="info">MSME</Badge> : null}
        <span className="tw:truncate">{[ledger.accountCode, ledger.groupName, ledger.gstin].filter(Boolean).join(' | ')}</span>
      </div>
    </div>
  );
}

function AccountList({ account }) {
  const { list, query, setQuery, groupFilter, setGroupFilter, flag, setFlag, groups, pathOf, selectedId } = account;
  const tools = (
    <div className="tw:grid tw:grid-cols-[1fr_110px] tw:gap-1.5">
      <SelectBox value={groupFilter} onValueChange={setGroupFilter} options={groups.map((group) => ({ value: group.id, label: pathOf(group) }))} placeholder="All groups" clearable clearLabel="All groups" />
      <SelectBox value={flag} onValueChange={setFlag} options={FLAG_OPTIONS} placeholder="All" clearable clearLabel="All" />
    </div>
  );
  return (
    <ListPanel title="Accounts" count={list.rows.length + (list.total > list.rows.length ? ' of ' + list.total : '')} search={query} onSearch={setQuery} placeholder="Name, code, GSTIN or PAN" tools={tools}>
      {list.rows.map((ledger) => <AccountRow key={ledger.id} ledger={ledger} selected={String(selectedId) === String(ledger.id)} onPick={() => account.showLedger(ledger.id)} />)}
      {!list.rows.length && <div className="tw:p-5 tw:text-center tw:text-[11.5px] tw:text-muted-foreground">{query || groupFilter || flag ? 'No account matches' : 'No accounts yet'}</div>}
    </ListPanel>
  );
}

function AccountSummary({ info, onStatement }) {
  return (
    <div className="tw:grid tw:grid-cols-2 tw:items-center tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-card tw:px-3.5 tw:py-2.5 tw:md:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
      <Stat label="Current balance"><span className={info.balance ? (info.side === 'Dr' ? 'tw:text-destructive' : 'tw:text-success') : 'tw:text-foreground'}>{balanceText(info.balance, info.side)}</span></Stat>
      <Stat label="Total debit">{inr(info.totalDr)}</Stat>
      <Stat label="Total credit">{inr(info.totalCr)}</Stat>
      <Stat label="Entries">{info.entries}</Stat>
      <Stat label="Last entry">{info.lastEntry ? fmtDate(info.lastEntry) : '-'}</Stat>
      <Button variant="default" size="lg" onClick={onStatement}><FileText /> Ledger statement</Button>
    </div>
  );
}

function LedgerActions({ account }) {
  const { msg, selectedId, info, list } = account;
  const changed = info && (info.modifiedByName || info.updatedAt !== info.createdAt);
  return (
    <ActionBar note={msg}>
      <Button variant="success" size="lg" onClick={account.save} disabled={!!selectedId}><Save /> Save</Button>
      <Button variant="success" size="lg" onClick={account.save} disabled={!selectedId}><Pencil /> Modify</Button>
      <Button variant="destructive" size="lg" onClick={account.remove} disabled={!selectedId}><Trash2 /> Delete</Button>
      <Button size="lg" onClick={account.clear}><RotateCcw /> Clear</Button>
      <Button variant="secondary" size="lg" onClick={() => downloadCsvFile('Ledger_Accounts', EXCEL_COLUMNS, list.rows)} disabled={!list.rows.length}><Download /> Excel</Button>
      {info && selectedId && (
        <span className="tw:ml-auto tw:text-[10.5px] tw:text-muted-foreground">
          Entered {info.createdByName ? 'by ' + info.createdByName + ' ' : ''}on {fmtDate(info.createdAt)}
          {changed ? ' | changed ' + (info.modifiedByName ? 'by ' + info.modifiedByName + ' ' : '') + 'on ' + fmtDate(info.updatedAt) : ''}
        </span>
      )}
    </ActionBar>
  );
}

// account list on the left, the full account form on the right (details, GST & TDS, address, bank, credit, MSME, child lists)
export function LedgerScreen() {
  const navigate = useNavigate();
  const account = useLedgerAccount();
  const { info, selectedId, tab, setTab } = account;
  const childCount = (key) => (info && info[key] ? info[key].length : 0);
  const tabs = [
    { id: 'account', label: 'Account' }, { id: 'other', label: 'Other details & MSME' },
    ...(selectedId ? [{ id: 'addresses', label: 'Addresses (' + childCount('addresses') + ')' }, { id: 'banks', label: 'Bank accounts (' + childCount('banks') + ')' }, { id: 'openings', label: 'Opening bills (' + childCount('openings') + ')' }] : []),
  ];
  return (
    <div className={TWO_PANE}>
      <AccountList account={account} />
      <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2.5">
        {info && selectedId && <AccountSummary info={info} onStatement={() => navigate('/accounts-hub?item=ledger&ledger=' + selectedId)} />}
        {info && selectedId && Number(info.isBlacklisted) ? (
          <div className="tw:rounded-md tw:border tw:border-destructive/30 tw:bg-destructive/10 tw:px-3 tw:py-2 tw:text-entry tw:font-bold tw:text-destructive">Blacklisted: {info.blacklistReason || 'no reason given'}</div>
        ) : null}
        <Sheet tabs={tabs} tab={tab} onTab={setTab}>
          {tab === 'account' && <><LedgerAccountTab account={account} /><LedgerActions account={account} /></>}
          {tab === 'other' && <><LedgerOtherTab account={account} /><LedgerActions account={account} /></>}
          {selectedId && info && CHILD_TABS.includes(tab) && <LedgerChildList kind={tab} ledger={info} onChanged={() => account.open(selectedId)} />}
        </Sheet>
      </div>
    </div>
  );
}
