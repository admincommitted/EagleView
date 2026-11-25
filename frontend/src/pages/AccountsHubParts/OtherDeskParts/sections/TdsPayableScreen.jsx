import { useNavigate } from 'react-router-dom';
import { Download, RefreshCw, Save, Trash2 } from 'lucide-react';
import { Button, DateInput, Field, Input, NumberInput, SelectBox } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ActionBar, Badge, Box, Btn, Grid, Money, fmtDate, inr } from '../../ui';
import { deskOf } from '../../CommandSearch';
import { saveCsvColumns } from '../../ReportsDeskParts/csvFile';
import { sumOf } from '../../VoucherDeskParts/amounts';
import { useTdsPayable } from '../hooks/useTdsPayable';
import { ymName } from '../otherConfig';
import { StatStrip } from './StatStrip';

const STATUS_OPTIONS = [{ value: 'DUE', label: 'Due' }, { value: 'OVERDUE', label: 'Overdue' }, { value: 'PAID', label: 'Paid' }];
const STATUS_TONES = { PAID: 'ok', OVERDUE: 'bad' };
const statusLabel = (row) => (row.status === 'OVERDUE' ? 'Overdue ' + row.daysLate + 'd' : row.status === 'PAID' ? 'Paid' : 'Due');
const TDS_CSV = [[(row) => ymName(row.month), 'Month'], ['section', 'Section'], ['entries', 'Entries'], ['net', 'Deducted'], ['paid', 'Deposited'], ['balance', 'Balance'], ['dueDate', 'Due Date'], ['status', 'Status']];

function ChallanForm({ tds }) {
  const { challan, setChallanField, selected } = tds;
  return (
    <Box title={'Deposit challan - balance ₹ ' + inr(Math.max(0, selected.balance))}>
      <div className="tw:grid tw:grid-cols-1 tw:gap-2.5 tw:sm:grid-cols-3">
        <Field label="Challan No (CIN)" required layout="col">
          <Input data-allow-text required={!challan.challanNo} value={challan.challanNo} onChange={(event) => setChallanField('challanNo')(event.target.value)} />
        </Field>
        <Field label="BSR Code" layout="col"><Input data-allow-text maxLength={7} value={challan.bsrCode} onChange={(event) => setChallanField('bsrCode')(event.target.value)} /></Field>
        <Field label="Paid On" required layout="col"><DateInput value={challan.paidOn} onValueChange={setChallanField('paidOn')} /></Field>
        <Field label="Tax Amount" required layout="col"><NumberInput align="right" value={challan.amount} onValueChange={setChallanField('amount')} /></Field>
        <Field label="Interest" layout="col" note={selected.status === 'OVERDUE' ? 'Worked out at 1.5% a month' : undefined}>
          <NumberInput align="right" value={challan.interest} onValueChange={setChallanField('interest')} />
        </Field>
        <Field label="Remarks" layout="col"><Input data-allow-text value={challan.remarks} onChange={(event) => setChallanField('remarks')(event.target.value)} /></Field>
      </div>
    </Box>
  );
}

function SelectedMonth({ tds }) {
  const navigate = useNavigate();
  const { selected, deductions } = tds;
  const openVoucher = (line) => navigate('/accounts-hub?item=' + deskOf(line.typeName === 'Purchase' ? 'Purchase' : line.typeName) + '&voucher=' + line.voucherId);
  return (
    <div className="tw:grid tw:grid-cols-1 tw:items-start tw:gap-2.5 tw:lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Grid title={'Deductions - ' + selected.section + ', ' + ymName(selected.month) + ' (' + deductions.length + ')'} maxHeight="calc(100vh - 560px)" rows={deductions}
        rowKey={(_, index) => index} onRow={openVoucher}
        cols={[
          { label: 'Date', render: (line) => fmtDate(line.date) },
          { label: 'Voucher', render: (line) => line.typeName + ' ' + line.voucherNumber },
          { label: 'Party', wrap: true, render: (line) => line.party || '' },
          { label: 'Job', render: (line) => line.jobNo || '' },
          { label: 'TDS', right: true, render: (line) => <Money v={line.amount} side={line.dc} /> },
        ]} />
      <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2.5">
        <ChallanForm tds={tds} />
        <ActionBar note={tds.message}><Btn kind="save" onClick={tds.addChallan}><Save size={13} /> Save challan</Btn></ActionBar>
        {selected.challans.length > 0 && (
          <Grid title="Challans deposited" maxHeight={180} rows={selected.challans} rowKey={(paid) => paid.id}
            cols={[
              { label: 'Challan', render: (paid) => <b>{paid.challanNo}</b> },
              { label: 'BSR', render: (paid) => paid.bsrCode || '' },
              { label: 'Paid on', render: (paid) => fmtDate(paid.paidOn) },
              { label: 'Tax', right: true, render: (paid) => inr(paid.amount) },
              { label: 'Interest', right: true, render: (paid) => (Number(paid.interest) ? inr(paid.interest) : '-') },
              { label: '', render: (paid) => <Button variant="ghost" size="icon-sm" title="Delete" className="tw:text-destructive" onClick={() => tds.deleteChallan(paid)}><Trash2 /></Button> },
            ]} />
        )}
      </div>
    </div>
  );
}

// TDS Payable Updation - TDS deducted per month and section against challans paid, due dates, late days
export function TdsPayableScreen() {
  const tds = useTdsPayable();
  const { data, rows, selected } = tds;
  if (!data) return <Box><span className="tw:text-muted-foreground">{tds.message || 'Loading'}</span></Box>;
  const { totals } = data;
  return (
    <div className="tw:flex tw:flex-col tw:gap-2.5">
      <StatStrip items={[
        ['Financial year', data.fy.name], ['TDS deducted', '₹ ' + inr(totals.deducted, 0)], ['Deposited', '₹ ' + inr(totals.paid, 0), 'success'],
        ['To deposit', '₹ ' + inr(totals.balance, 0), totals.balance ? 'danger' : null], ['Overdue months', totals.overdue, totals.overdue ? 'danger' : null],
      ]} />
      <ActionBar note={!selected ? tds.message : ''}>
        <div className="tw:w-[150px]">
          <SelectBox options={tds.years.map((year) => ({ value: year.id, label: 'FY ' + (year.name || year.code) }))} value={tds.fyId} onValueChange={tds.pickYear}
            placeholder="Current year" clearable clearLabel="Current year" />
        </div>
        <div className="tw:w-[140px]"><SelectBox options={STATUS_OPTIONS} value={tds.statusFilter} onValueChange={tds.setStatusFilter} placeholder="All" clearable clearLabel="All" /></div>
        <Btn kind="primary" onClick={tds.load}><RefreshCw size={13} /> Refresh</Btn>
        <Btn kind="plain" onClick={() => saveCsvColumns('TDS_Payable_' + data.fy.name, TDS_CSV, rows)} disabled={!rows.length}><Download size={13} /> Excel</Btn>
        <span className="tw:ml-auto tw:text-[11px] tw:text-muted-foreground tw:normal-case">Due by the 7th of next month (30 April for March). Interest 1.5% a month when late.</span>
      </ActionBar>
      <Grid title="TDS by month and section" maxHeight={selected ? 260 : 'calc(100vh - 360px)'} rows={rows} rowKey={(row) => row.month + row.section}
        activeKey={selected ? selected.month + selected.section : undefined} onRow={tds.pick}
        empty="No TDS deducted in this year. TDS is read from ledgers with TDS in the name under Duties & Taxes."
        foot={[
          'Total', '', '', '', <Money key="net" v={sumOf(rows, (row) => row.net)} strong />, <Money key="paid" v={sumOf(rows, (row) => row.paid)} strong />,
          <Money key="balance" v={sumOf(rows, (row) => Math.max(0, row.balance))} strong />,
        ]}
        cols={[
          { label: 'Month', render: (row) => <b>{ymName(row.month)}</b> },
          { label: 'Section', render: (row) => row.section },
          { label: 'Entries', right: true, render: (row) => row.entries },
          { label: 'Parties', right: true, render: (row) => row.parties },
          { label: 'Deducted', right: true, render: (row) => <Money v={row.net} /> },
          { label: 'Deposited', right: true, render: (row) => <Money v={row.paid} side={row.paid ? 'Cr' : null} /> },
          { label: 'Balance', right: true, render: (row) => <span className={cn('tw:font-extrabold', row.balance > 0.5 ? 'tw:text-destructive' : 'tw:text-muted-foreground')}>{inr(Math.max(0, row.balance))}</span> },
          { label: 'Due date', render: (row) => fmtDate(row.dueDate) },
          { label: 'Status', render: (row) => <Badge tone={STATUS_TONES[row.status] || 'warn'}>{statusLabel(row)}</Badge> },
          { label: 'Challans', right: true, render: (row) => row.challans.length || '-' },
        ]} />
      {selected && <SelectedMonth tds={tds} />}
    </div>
  );
}
