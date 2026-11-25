import { Button, DataTable } from '@/components/ui';
import { cn } from '@/lib/utils';
import DetailCard from './DetailCard';

const ACTION = {
  A: { label: 'Changed', className: 'tw:text-primary' },
  S: { label: 'Added', className: 'tw:text-success' },
  D: { label: 'Deleted', className: 'tw:text-destructive' },
};

const baseNote = (base) => {
  if (!base) return '';
  if (base.from === 'amendment') return `(after the last amendment, job ${base.jobNo || ''})`;
  if (base.from === 'filed') return '(as filed)';
  return `(job ${base.jobNo || ''})`;
};

const shown = (value) => String(value ?? '') || '—';

const COLUMNS = [
  { key: 'table', header: 'Part', width: '70px', className: 'tw:font-semibold' },
  { key: 'key', header: 'Row', width: '90px' },
  {
    key: 'act',
    header: '',
    width: '64px',
    cell: (change) => <span className={cn('tw:font-semibold', ACTION[change.act]?.className)}>{ACTION[change.act]?.label || change.act}</span>,
  },
  {
    key: 'fields',
    header: 'Field: was → now',
    className: 'tw:whitespace-normal tw:align-top',
    cell: (change) => (change.fields || []).map((field, index) => (
      <div key={index}>
        <span className="tw:text-muted-foreground">{field.field}:</span>{' '}
        <span className="tw:text-muted-foreground/70 tw:line-through">{shown(field.was)}</span> → <b>{shown(field.now)}</b>
      </div>
    )),
  },
];

export default function ChangesCard({ changeReport, onRefresh }) {
  const changes = changeReport?.changes || [];
  return (
    <DetailCard
      title="What changed against the filed BE"
      note={baseNote(changeReport?.base)}
      actions={<Button size="sm" onClick={onRefresh}>Refresh</Button>}
    >
      {changes.length === 0
        ? <span className="tw:text-muted-foreground">No change yet. Edit the amended job (Header / Invoices / Items), save it, then press Refresh.</span>
        : <DataTable columns={COLUMNS} rows={changes} rowKey={(change, index) => index} />}
    </DetailCard>
  );
}
