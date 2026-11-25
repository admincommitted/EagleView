import { useNavigate } from 'react-router-dom';
import { Download, FileText, Lock, RefreshCw, Unlock } from 'lucide-react';
import { Input, SelectBox } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ActionBar, Badge, Btn, Grid, Money, fmtDate, inr } from '../../ui';
import { saveCsvColumns } from '../../ReportsDeskParts/csvFile';
import { useJobClosing } from '../hooks/useJobClosing';
import { StatStrip } from './StatStrip';
import { SearchInput, ToolbarDivider } from './ToolbarBits';
import { tickColumn } from './tickColumn';

const STATUS_OPTIONS = [{ value: 'OPEN', label: 'Open' }, { value: 'CLOSED', label: 'Closed' }];
const FLAG_OPTIONS = [{ value: 'loss', label: 'Loss-making' }, { value: 'unbilled', label: 'Not billed yet' }, { value: 'nocost', label: 'No cost booked' }];
const JOB_CSV = [
  ['jobNo', 'Job No'], ['first', 'First Entry'], ['last', 'Last Entry'], ['vouchers', 'Vouchers'], ['income', 'Income'], ['expense', 'Expense'],
  ['profit', 'Profit'], ['margin', 'Margin %'], ['status', 'Status'], ['closedOn', 'Closed On'], ['remarks', 'Remarks'],
];

function JobStatus({ job }) {
  if (job.status !== 'CLOSED') return <Badge tone="ok">Open</Badge>;
  return <span title={(job.remarks || '') + (job.closedBy ? ' - ' + job.closedBy : '')}><Badge tone="bad">Closed {fmtDate(job.closedOn)}</Badge></span>;
}

// Job Closing - income / expense / profit of every job; close (no new voucher for that job) or re-open
export function JobClosingScreen() {
  const navigate = useNavigate();
  const jobs = useJobClosing();
  const { shown, summary, busy } = jobs;
  return (
    <div className="tw:flex tw:flex-col tw:gap-2.5">
      <StatStrip items={[
        ['Jobs', summary.jobs], ['Open', summary.open, 'primary'], ['Closed', summary.closed],
        ['Profit on all jobs', '₹ ' + inr(summary.profit, 0), summary.profit < 0 ? 'danger' : 'success'],
        ['Loss-making', summary.losses, 'danger'], ['Open and not billed', summary.openUnbilled, 'warning'],
      ]} />
      <ActionBar note={jobs.message}>
        <SearchInput className="tw:sm:w-[170px]" value={jobs.query} onChange={jobs.setQuery} placeholder="Job no" />
        <div className="tw:w-[120px]"><SelectBox options={STATUS_OPTIONS} value={jobs.status} onValueChange={jobs.setStatus} placeholder="All jobs" clearable clearLabel="All jobs" /></div>
        <div className="tw:w-[160px]"><SelectBox options={FLAG_OPTIONS} value={jobs.flag} onValueChange={jobs.setFlag} placeholder="Any result" clearable clearLabel="Any result" /></div>
        <Btn kind="primary" onClick={jobs.load} disabled={busy}><RefreshCw size={13} /> {busy ? 'Loading' : 'Refresh'}</Btn>
        <ToolbarDivider />
        <div className="tw:w-full tw:sm:w-[200px]">
          <Input data-allow-text value={jobs.remarks} onChange={(event) => jobs.setRemarks(event.target.value)} placeholder="Closing remarks" />
        </div>
        <Btn kind="danger" onClick={() => jobs.act(jobs.selectedOpen, 'close')} disabled={!jobs.selectedOpen.length}><Lock size={13} /> Close selected ({jobs.selectedOpen.length})</Btn>
        <Btn kind="clear" onClick={() => jobs.act(jobs.selectedClosed, 'reopen')} disabled={!jobs.selectedClosed.length}><Unlock size={13} /> Re-open</Btn>
        <Btn kind="plain" onClick={() => saveCsvColumns('Jobs', JOB_CSV, shown)} disabled={!shown.length}><Download size={13} /> Excel</Btn>
      </ActionBar>
      <Grid title={'Jobs (' + shown.length + ')'} maxHeight="calc(100vh - 360px)" rows={shown} rowKey={(job) => job.jobNo}
        empty={busy ? 'Loading' : jobs.rows.length ? 'No job matches the filters' : 'No vouchers with a job no yet'}
        foot={['', 'Total', '', '', '', <Money key="in" v={jobs.shownTotal('income')} strong />, <Money key="ex" v={jobs.shownTotal('expense')} strong />, <Money key="pr" v={jobs.shownTotal('profit')} strong />]}
        cols={[
          tickColumn({ rows: shown, picked: jobs.picked, setPicked: jobs.setPicked, keyOf: (job) => job.jobNo }),
          { label: 'Job No', render: (job) => <b>{job.jobNo}</b> },
          { label: 'First / Last entry', render: (job) => fmtDate(job.first) + ' - ' + fmtDate(job.last) },
          { label: 'Vouchers', right: true, render: (job) => job.vouchers },
          { label: 'Billed / Cost', render: (job) => (
            <span className="tw:inline-flex tw:gap-1">
              <Badge tone={job.billed ? 'ok' : 'warn'}>{job.billed ? 'Billed' : 'Not billed'}</Badge>
              {!job.hasCost && <Badge tone="muted">No cost</Badge>}
            </span>
          ) },
          { label: 'Income', right: true, render: (job) => <Money v={job.income} /> },
          { label: 'Expense', right: true, render: (job) => <Money v={job.expense} /> },
          { label: 'Profit', right: true, render: (job) => <span className={cn('tw:font-extrabold', job.profit < 0 ? 'tw:text-destructive' : 'tw:text-success')}>{inr(job.profit)}</span> },
          { label: 'Margin', right: true, render: (job) => (job.margin == null ? '-' : job.margin + '%') },
          { label: 'Status', render: (job) => <JobStatus job={job} /> },
          { label: '', render: (job) => (
            <span className="tw:inline-flex tw:gap-1">
              {job.status === 'OPEN'
                ? <Btn small kind="ghost" onClick={() => jobs.act([job], 'close')}><Lock size={11} /> Close</Btn>
                : <Btn small kind="ghost" onClick={() => jobs.act([job], 'reopen')}><Unlock size={11} /> Re-open</Btn>}
              <Btn small kind="ghost" title="Expense sheet" onClick={() => navigate('/accounts-hub?item=expsheet&jobNo=' + encodeURIComponent(job.jobNo))}><FileText size={11} /></Btn>
            </span>
          ) },
        ]} />
    </div>
  );
}
