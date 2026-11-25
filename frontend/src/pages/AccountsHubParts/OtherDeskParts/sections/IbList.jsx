import { useNavigate } from 'react-router-dom';
import { Check, Download, RefreshCw, Undo2, X } from 'lucide-react';
import { Button, DateInput, Field, Input, NumberInput, SelectBox } from '@/components/ui';
import { ActionBar, Badge, Box, Btn, Grid, LedgerPicker, fmtDate, inr } from '../../ui';
import { saveCsvColumns } from '../../ReportsDeskParts/csvFile';
import { sumOf } from '../../VoucherDeskParts/amounts';
import { DR_CR } from '../../VoucherDeskParts/voucherConfig';
import { useIbList } from '../hooks/useIbList';
import { BRANCH_ACCOUNT, IB_TYPE_OPTIONS, ibTone } from '../otherConfig';
import { StatStrip } from './StatStrip';

const STATUSES = ['Waiting', 'Accepted', 'Returned'];
const IB_CSV = [
  ['ibNo', 'IB No'], ['typeName', 'Type'], [(row) => fmtDate(row.date), 'Date'], ['fromBranch', 'From'], ['toBranch', 'To'], ['amount', 'Amount'], ['refNo', 'Ref'],
  ['status', 'Status'], ['raiseNo', 'Sent voucher'], ['acceptNo', 'Received voucher'], ['returnReason', 'Return reason'],
];

const CloseButton = ({ onClick }) => <Button variant="ghost" size="icon-sm" title="Close" onClick={onClick}><X /></Button>;

function TransferDetails({ row }) {
  return (
    <div className="tw:text-[11px]">
      <div>{row.type === 'journal' ? row.toLines.map((line) => line.ledgerName + ' ' + line.dc + ' ' + inr(line.amount)).join('; ') : (row.fromLedger || '') + (row.toLedger ? ' > ' + row.toLedger : '')}</div>
      {row.refNo && <div className="tw:text-muted-foreground">Ref {row.refNo}</div>}
      {row.returnReason && <div className="tw:text-destructive">Returned: {row.returnReason}</div>}
    </div>
  );
}

function VoucherLinks({ row }) {
  const navigate = useNavigate();
  const link = (number, voucherId) => (number
    ? <Button variant="link" className="tw:h-auto tw:font-extrabold tw:text-head" onClick={() => voucherId && navigate('/accounts-hub?item=' + (row.type === 'journal' ? 'journal' : 'contra') + '&voucher=' + voucherId)}>{number}</Button>
    : '');
  return (
    <span className="tw:text-[11px]">
      {link(row.raiseNo, row.raiseVoucherId)}{row.acceptNo ? ' / ' : ''}{link(row.acceptNo, row.acceptVoucherId)}
      {row.reverseNo ? ' / rev ' : ''}{link(row.reverseNo, row.reverseVoucherId)}
    </span>
  );
}

function AcceptBox({ list }) {
  const { selected, action, setActionField, look } = list;
  const cashTransfer = selected.type === 'cash';
  const receivedIn = cashTransfer ? look.cash : look.banks;
  return (
    <Box title={'Accept ' + selected.ibNo + ' - ' + selected.typeName + ' of ' + inr(selected.amount) + ' from ' + selected.fromBranch} right={<CloseButton onClick={() => list.setAction(null)} />}>
      <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(160px,1fr))] tw:items-end tw:gap-2.5">
        <Field label="Accept Date" required layout="col"><DateInput minDate={selected.date} value={action.date} onValueChange={setActionField('date')} /></Field>
        {selected.type !== 'journal' && (
          <Field label={cashTransfer ? 'Received In Cash' : 'Received In Bank'} required layout="col" className="tw:sm:col-span-2">
            <LedgerPicker id="ibacc" list={receivedIn.length ? receivedIn : look.all} value={action.toLedgerId} onChange={setActionField('toLedgerId')} placeholder={cashTransfer ? 'Cash in hand' : 'Bank account'} mandatory />
          </Field>
        )}
        <div className="tw:flex tw:justify-end"><Btn kind="save" onClick={() => list.accept(selected)}><Check size={13} /> Accept and post</Btn></div>
      </div>
      {selected.type === 'journal' && (
        <div className="tw:mt-2.5">
          <div className="tw:mb-1.5 tw:text-[11px] tw:text-foreground/80 tw:normal-case">
            {selected.toBranch} will book these entries against BRANCH A/C - {selected.fromBranch}. Amounts can be changed; they must still add up to {inr(selected.amount)}.
          </div>
          {action.lines.map((line, index) => (
            <div key={index} className="tw:mb-1.5 tw:grid tw:grid-cols-[minmax(0,2fr)_80px_140px] tw:gap-2">
              <LedgerPicker id={'ibl' + index} list={look.all.filter((ledger) => !BRANCH_ACCOUNT.test(ledger.name))} value={line.ledgerId} onChange={(ledgerId) => list.setActionLine(index, 'ledgerId', ledgerId)} />
              <SelectBox options={DR_CR} value={line.dc} onValueChange={(dc) => list.setActionLine(index, 'dc', dc)} />
              <NumberInput align="right" value={line.amount} onValueChange={(amount) => list.setActionLine(index, 'amount', amount)} />
            </div>
          ))}
        </div>
      )}
    </Box>
  );
}

function ReturnBox({ list }) {
  const { selected, action } = list;
  return (
    <Box title={'Return ' + selected.ibNo + ' to ' + selected.fromBranch} right={<CloseButton onClick={() => list.setAction(null)} />}>
      <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-end">
        <Field label="Reason" required layout="col" className="tw:flex-1">
          <Input data-allow-text autoFocus required={!action.reason} value={action.reason} onChange={(event) => list.setActionField('reason')(event.target.value)}
            placeholder="Wrong branch, amount not received ..." onKeyDown={(event) => event.key === 'Enter' && list.giveBack(selected)} />
        </Field>
        <Btn kind="danger" onClick={() => list.giveBack(selected)}><Undo2 size={13} /> Return and reverse</Btn>
      </div>
      <div className="tw:mt-1.5 tw:text-[11px] tw:text-muted-foreground tw:normal-case">{selected.fromBranch}&apos;s voucher {selected.raiseNo} is reversed by a new voucher dated today; nothing is deleted.</div>
    </Box>
  );
}

// Transfers: raised by / coming to this branch; accept or return the waiting ones
export function IbList({ myBranch }) {
  const list = useIbList(myBranch);
  const { shown, filters, setFilter, selected, action } = list;
  const countOf = (status) => shown.filter((row) => row.status === status).length;
  return (
    <>
      <StatStrip items={[
        ['Transfers', shown.length], ['Waiting for ' + (myBranch || 'you'), list.waitingIn.length, 'warning'], ['Accepted', countOf('Accepted'), 'success'],
        ['Returned', countOf('Returned'), 'danger'], ['Value', '₹ ' + inr(sumOf(shown, (row) => Number(row.amount || 0)), 0)],
      ]} />
      <ActionBar note={list.message}>
        <div className="tw:w-[140px]"><DateInput value={filters.from} onValueChange={setFilter('from')} /></div>
        <span className="tw:text-[11px] tw:text-muted-foreground">to</span>
        <div className="tw:w-[140px]"><DateInput value={filters.to} onValueChange={setFilter('to')} /></div>
        <div className="tw:w-[140px]"><SelectBox options={IB_TYPE_OPTIONS} value={filters.type} onValueChange={setFilter('type')} placeholder="All types" clearable clearLabel="All types" /></div>
        <div className="tw:w-[130px]"><SelectBox options={STATUSES} value={filters.status} onValueChange={setFilter('status')} placeholder="All status" clearable clearLabel="All status" /></div>
        {myBranch && (
          <div className="tw:w-[170px]">
            <SelectBox options={[{ value: 'in', label: 'Coming to ' + myBranch }, { value: 'out', label: 'Sent by ' + myBranch }]} value={filters.mine} onValueChange={list.setMine}
              placeholder="All branches" clearable clearLabel="All branches" />
          </div>
        )}
        <Btn kind="primary" onClick={list.load}><RefreshCw size={13} /> Refresh</Btn>
        <Btn kind="plain" onClick={() => saveCsvColumns('inter_branch', IB_CSV, shown)}><Download size={13} /> Excel</Btn>
      </ActionBar>
      <Grid title={'Inter branch transfers (' + shown.length + ')'} maxHeight="calc(100vh - 400px)" rows={shown} rowKey={(row) => row.id} activeKey={action?.id}
        empty={filters.mine === 'in' ? 'Nothing sent to ' + myBranch + ' in this period' : 'No inter branch transfers in this period'}
        cols={[
          { label: 'IB No', render: (row) => <b>{row.ibNo}</b> },
          { label: 'Type', render: (row) => <Badge tone="brand">{row.typeName}</Badge> },
          { label: 'Date', render: (row) => fmtDate(row.date) },
          { label: 'From > To', render: (row) => <b>{row.fromBranch} &gt; {row.toBranch}</b> },
          { label: 'Details', w: '28%', wrap: true, render: (row) => <TransferDetails row={row} /> },
          { label: 'Amount', right: true, render: (row) => <b>{inr(row.amount)}</b> },
          { label: 'Vouchers', render: (row) => <VoucherLinks row={row} /> },
          { label: 'By', render: (row) => <span className="tw:text-[11px]">{row.raisedBy || ''}{row.decidedBy ? ' / ' + row.decidedBy : ''}</span> },
          { label: 'Status', render: (row) => <Badge tone={ibTone(row.status)}>{row.status}</Badge> },
          { label: '', render: (row) => (row.status === 'Waiting' ? (
            <span className="tw:inline-flex tw:gap-1">
              <Btn small kind="save" onClick={() => list.startAccept(row)}><Check size={11} /> Accept</Btn>
              <Btn small kind="ghost" onClick={() => list.startReturn(row)}><Undo2 size={11} /> Return</Btn>
            </span>
          ) : null) },
        ]} />
      {selected && action.kind === 'accept' && <AcceptBox list={list} />}
      {selected && action.kind === 'return' && <ReturnBox list={list} />}
    </>
  );
}
