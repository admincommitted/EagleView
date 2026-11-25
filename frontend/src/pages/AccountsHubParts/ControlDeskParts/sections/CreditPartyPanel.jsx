import { useState } from 'react';
import { BookOpen, Check, Plus, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, DateInput, Field, Input, SelectBox, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { Box, Grid, Money, fmtDate, inr } from '../../ui';
import { ExcelButtons, sampleExcel } from '../../extras';
import { CheckField } from '../../GstInvoiceDeskParts/sections/formParts';
import useCreditParty, { PARTY_LEDGER_COLUMNS } from '../hooks/useCreditParty';
import Tiles from './Tiles';

const CHANNELS = ['CALL', 'EMAIL', 'VISIT', 'WHATSAPP'];
const POLICY_FLAGS = [['autoSendLedger', 'Send the ledger statement automatically'], ['overdueReminders', 'Send overdue reminders'], ['autoHoldDelivery', 'Hold delivery when over limit / 60+ days']];
const BAD_MESSAGE = /^Not|Could/;

const ColField = ({ label, required, className, children }) => <Field label={label} required={required} layout="col" className={className}>{children}</Field>;
const followUpTime = (entry) => new Date(entry.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

function BillsTab({ party }) {
  const buckets = party.buckets || {};
  const columns = [
    { label: 'Bill', render: (bill) => bill.refNo }, { label: 'Party bill / ref', render: (bill) => bill.billNo }, { label: 'Job', render: (bill) => bill.jobNo },
    { label: 'Date', render: (bill) => fmtDate(bill.date) }, { label: 'Due', render: (bill) => fmtDate(bill.dueDate) },
    { label: 'Amount', right: true, render: (bill) => <Money v={bill.amount} muted /> }, { label: 'Pending', right: true, render: (bill) => <Money v={bill.pending} strong /> },
    { label: 'Overdue', right: true, render: (bill) => <span className={cn('tw:font-bold', bill.overdueDays > 0 ? 'tw:text-destructive' : 'tw:text-success')}>{bill.overdueDays > 0 ? bill.overdueDays + ' days' : 'not due'}</span> },
  ];
  return (
    <>
      <div className="tw:mb-1.5 tw:text-[11.5px] tw:text-foreground">
        Not due {inr(buckets.notDue || 0)} - 1-15 days {inr(buckets.b15 || 0)} - 16-30 {inr(buckets.b30 || 0)} - 31-60 {inr(buckets.b60 || 0)} - 60+ {inr(buckets.b90 || 0)}
      </div>
      <Grid title="Open bills" maxHeight={240} rows={party.bills || []} rowKey={(bill) => bill.id} empty="Nothing outstanding" cols={columns} />
    </>
  );
}

function PromiseCell({ entry, markPromise }) {
  if (!entry.promiseDate) return '';
  if (entry.promiseMet === true) return <Badge variant="success">Kept</Badge>;
  if (entry.promiseMet === false) return <Badge variant="danger">Broken</Badge>;
  return (
    <span className="tw:inline-flex tw:gap-1">
      <Button variant="success" onClick={() => markPromise(entry, true)}><Check /> Kept</Button>
      <Button variant="ghost" onClick={() => markPromise(entry, false)}><X /> Broken</Button>
    </span>
  );
}

function FollowUpsTab({ credit, asOn }) {
  const { party, followUp, setFollowUp, addFollowUp, markPromise } = credit;
  const setField = (key, value) => setFollowUp((old) => ({ ...old, [key]: value }));
  const columns = [
    { label: 'When', render: followUpTime }, { label: 'By', render: (entry) => entry.createdByName || '' },
    { label: 'Channel', render: (entry) => <Badge variant="info">{entry.channel}</Badge> }, { label: 'Note', wrap: true, render: (entry) => entry.note },
    { label: 'Promise', render: (entry) => (entry.promiseDate ? fmtDate(entry.promiseDate) + (entry.promiseAmount ? ' - ' + inr(entry.promiseAmount, 0) : '') : '') },
    { label: 'Kept?', render: (entry) => <PromiseCell entry={entry} markPromise={markPromise} /> },
  ];
  return (
    <>
      <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-2 tw:md:grid-cols-[120px_minmax(0,3fr)_140px_120px_120px_auto]">
        <ColField label="Channel"><SelectBox value={followUp.channel} onValueChange={(value) => setField('channel', value)} options={CHANNELS} /></ColField>
        <ColField label="What was said" required><Input data-allow-text value={followUp.note} onChange={(event) => setField('note', event.target.value)} placeholder="Spoke to accounts, payment next week ..." /></ColField>
        <ColField label="Promise to pay on"><DateInput value={followUp.promiseDate} minDate={asOn} onValueChange={(value) => setField('promiseDate', value)} /></ColField>
        <ColField label="Amount promised"><Input className="tw:text-right" inputMode="decimal" value={followUp.promiseAmount} onChange={(event) => setField('promiseAmount', event.target.value)} /></ColField>
        <ColField label="Ref"><Input data-allow-text value={followUp.refNo} onChange={(event) => setField('refNo', event.target.value)} /></ColField>
        <Button variant="default" size="lg" onClick={addFollowUp}><Plus /> Add</Button>
      </div>
      <Grid title="Follow-up log" maxHeight={240} rows={party.followUps || []} rowKey={(entry) => entry.id} empty="No follow-up yet" cols={columns} />
    </>
  );
}

function LimitTab({ credit }) {
  const { limit, setLimit, policy, setPolicy, saveLimit, savePolicy } = credit;
  const setPolicyField = (key, value) => setPolicy((old) => ({ ...old, [key]: value }));
  return (
    <div className="tw:grid tw:grid-cols-1 tw:gap-2.5 tw:md:grid-cols-2">
      <Box title="Credit limit">
        <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-2 tw:sm:grid-cols-[1fr_1fr_auto]">
          <ColField label="Credit limit (Rs)"><Input className="tw:text-right" inputMode="decimal" value={limit.creditLimit} onChange={(event) => setLimit((old) => ({ ...old, creditLimit: event.target.value }))} /></ColField>
          <ColField label="Credit days"><Input className="tw:text-right" inputMode="numeric" value={limit.creditDays} onChange={(event) => setLimit((old) => ({ ...old, creditDays: event.target.value }))} /></ColField>
          <Button variant="success" size="lg" onClick={saveLimit}><Save /> Save</Button>
        </div>
        <div className="tw:mt-1.5 tw:text-[10.5px] tw:text-muted-foreground">Saved on the ledger; due dates of bills are worked out from the credit days.</div>
      </Box>
      <Box title="Reminders">
        <div className="tw:mb-1.5 tw:flex tw:flex-col tw:gap-1">
          {POLICY_FLAGS.map(([key, label]) => <CheckField key={key} label={label} checked={!!policy[key]} onCheckedChange={(value) => setPolicyField(key, value)} />)}
        </div>
        <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:sm:grid-cols-2">
          <ColField label="Statement on days (e.g. 1,15)"><Input value={policy.autoSendDays || ''} onChange={(event) => setPolicyField('autoSendDays', event.target.value)} /></ColField>
          <ColField label="Remind after days overdue"><Input className="tw:text-right" inputMode="numeric" value={policy.reminderAfterDays ?? ''} onChange={(event) => setPolicyField('reminderAfterDays', event.target.value)} /></ColField>
        </div>
        <ColField label="Notes"><Input data-allow-text value={policy.notes || ''} onChange={(event) => setPolicyField('notes', event.target.value)} /></ColField>
        <div className="tw:mt-2 tw:flex tw:justify-end"><Button variant="success" size="lg" onClick={savePolicy}><Save /> Save policy</Button></div>
      </Box>
    </div>
  );
}

function MatchResult({ match }) {
  const tiles = [
    { key: 'a', label: 'Our books', value: inr(match.totals.ourBooks) }, { key: 'b', label: 'Their ledger', value: inr(match.totals.theirLedger) },
    { key: 'c', label: 'Matched', value: match.counts.matched, tone: 'tw:text-success' }, { key: 'd', label: 'Amount differs', value: match.counts.variances, tone: 'tw:text-warning' },
    { key: 'e', label: 'Only in our books', value: match.counts.oursOnly, tone: 'tw:text-destructive' }, { key: 'f', label: 'Only in theirs', value: match.counts.theirsOnly, tone: 'tw:text-destructive' },
  ];
  return (
    <>
      <Tiles items={tiles} />
      {match.variances.length > 0 && (
        <Grid title="Amount differs" maxHeight={180} rows={match.variances} cols={[{ label: 'Bill', render: (row) => row.ref }, { label: 'Ours', right: true, render: (row) => inr(row.ours) },
          { label: 'Theirs', right: true, render: (row) => inr(row.theirs) }, { label: 'Difference', right: true, render: (row) => <b>{inr(row.diff)}</b> }, { label: 'Likely reason', wrap: true, render: (row) => row.hint }]} />
      )}
      {match.oursOnly.length > 0 && (
        <Grid title="Only in our books" maxHeight={180} rows={match.oursOnly} cols={[{ label: 'Bill', render: (row) => row.ref }, { label: 'Date', render: (row) => fmtDate(row.date) }, { label: 'Pending', right: true, render: (row) => inr(row.ours) }]} />
      )}
      {match.theirsOnly.length > 0 && (
        <Grid title="Only in their ledger" maxHeight={180} rows={match.theirsOnly} cols={[{ label: 'Line', render: (row) => row.line }, { label: 'Ref', render: (row) => row.ref }, { label: 'Date', render: (row) => row.date }, { label: 'Amount', right: true, render: (row) => inr(row.amount) }]} />
      )}
      <div className="tw:text-[10.5px] tw:text-muted-foreground">{match.note}</div>
    </>
  );
}

function MatchTab({ credit }) {
  return (
    <>
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <span className="tw:text-[11.5px] tw:text-foreground">Read the customer's own ledger (Excel) and pair it with our open bills - by reference first, then by amount.</span>
        <span className="tw:ml-auto tw:inline-flex tw:gap-2">
          <ExcelButtons label="Read their ledger" onFile={credit.readTheirLedger} onSample={() => sampleExcel('party_ledger_sample', PARTY_LEDGER_COLUMNS, [['INV/1', '10/05/2026', '', '', 11800]])} />
        </span>
      </div>
      {credit.match && <MatchResult match={credit.match} />}
    </>
  );
}

export default function CreditPartyPanel({ ledgerId, asOn, onChanged, onClose, onLedger }) {
  const credit = useCreditParty({ ledgerId, asOn, onChanged });
  const { party, msg } = credit;
  const [tab, setTab] = useState('bills');
  if (!party) return <Box><div className={cn('tw:text-entry', msg ? 'tw:text-destructive' : 'tw:text-muted-foreground')}>{msg || 'Opening'}</div></Box>;

  const tabs = [['bills', 'Bills'], ['fu', 'Follow-ups (' + (party.followUps || []).length + ')'], ['limit', 'Limit & policy'], ['match', 'Match their ledger']];
  const title = (
    <span>{party.party.name} <span className="tw:font-semibold tw:text-muted-foreground">- {inr(party.total)} outstanding, {(party.bills || []).length} bills{party.party.gstin ? ', ' + party.party.gstin : ''}</span></span>
  );
  const right = (
    <>
      <Button variant="ghost" onClick={onLedger}><BookOpen /> Ledger</Button>
      <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}><X /></Button>
    </>
  );
  return (
    <Box title={title} right={right}>
      <Tabs value={tab} onValueChange={setTab} className="tw:mb-2.5">
        <TabsList>{tabs.map(([id, label]) => <TabsTrigger key={id} value={id}>{label}</TabsTrigger>)}</TabsList>
      </Tabs>
      {msg && <div className={cn('tw:mb-2 tw:text-[11.5px] tw:font-bold', BAD_MESSAGE.test(msg) ? 'tw:text-destructive' : 'tw:text-success')}>{msg}</div>}
      {tab === 'bills' && <BillsTab party={party} />}
      {tab === 'fu' && <FollowUpsTab credit={credit} asOn={asOn} />}
      {tab === 'limit' && <LimitTab credit={credit} />}
      {tab === 'match' && <MatchTab credit={credit} />}
    </Box>
  );
}
