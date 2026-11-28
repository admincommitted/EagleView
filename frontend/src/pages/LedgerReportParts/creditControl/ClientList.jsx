import { useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui';
import { dayFirst, formatRupees } from '../format';

// money still inside the customer's credit days is shown apart from overdue money, so a healthy account does not look late
const AGEING_SEGMENTS = [
  { key: 'notDue', legend: 'within terms', title: 'Within terms', className: 'tw:bg-primary' },
  { key: 'b15', legend: '1-15d', title: '1-15 days overdue', className: 'tw:bg-success' },
  { key: 'b30', legend: '16-30d', title: '16-30 days overdue', className: 'tw:bg-warning/60' },
  { key: 'b60', legend: '31-60d', title: '31-60 days overdue', className: 'tw:bg-warning' },
  { key: 'b90', legend: '60d+', title: '60+ days overdue', className: 'tw:bg-destructive' },
];

function AgeingBar({ buckets, total }) {
  if (!buckets || !total) return null;
  return (
    <div className="tw:mt-2 tw:flex tw:h-1.5 tw:overflow-hidden tw:rounded-full tw:bg-muted">
      {AGEING_SEGMENTS.filter((segment) => buckets[segment.key] > 0).map((segment) => (
        <div
          key={segment.key}
          title={`${segment.title}: ${formatRupees(buckets[segment.key])}`}
          className={cn('tw:w-(--segment-w)', segment.className)}
          style={{ '--segment-w': `${(buckets[segment.key] / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

function AgeingLegend() {
  return (
    <div className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2.5">
      {AGEING_SEGMENTS.map((segment) => (
        <span key={segment.key} className="tw:flex tw:items-center tw:gap-1 tw:text-[11px] tw:text-muted-foreground">
          <span className={cn('tw:size-2 tw:rounded-full', segment.className)} /> {segment.legend}
        </span>
      ))}
    </div>
  );
}

const limitText = (client) => {
  if (!client.creditLimit) return 'No credit limit set';
  const used = client.utilisationPct != null ? ` (${client.utilisationPct}% used)` : '';
  return `Limit: ${formatRupees(client.creditLimit)}${used}`;
};

function ClientRow({ client, selected, onSelect }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => event.key === 'Enter' && onSelect()}
      className={cn(
        'tw:cursor-pointer tw:border-b tw:border-border tw:p-4 tw:outline-none tw:transition-colors tw:hover:bg-accent/60 tw:focus-visible:bg-accent',
        selected ? 'tw:bg-accent' : 'tw:bg-card'
      )}
    >
      <div className="tw:mb-1 tw:flex tw:justify-between tw:gap-2 tw:text-sm">
        <div className="tw:font-semibold tw:text-foreground">{client.name}</div>
        <div className={cn('tw:font-bold tw:tabular-nums', client.risk === 'High' ? 'tw:text-destructive' : 'tw:text-foreground')}>{formatRupees(client.totalOut)}</div>
      </div>
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <div className="tw:text-[11px] tw:text-muted-foreground">
          {limitText(client)}
          {client.billCount ? ` · ${client.billCount} bill(s)` : ''}
        </div>
        {client.overLimit && <span title="Exceeds credit limit" className="tw:flex"><AlertTriangle className="tw:size-3 tw:text-destructive" /></span>}
      </div>
      <AgeingBar buckets={client.buckets} total={client.totalOut} />
    </div>
  );
}

const matchesSearch = (client, search) =>
  [client.name, client.gstin, client.email, client.contactPerson].some((value) => String(value || '').toLowerCase().includes(search.toLowerCase()));

export default function ClientList({ clients, loading, error, asOn, note, selectedId, onSelect }) {
  const [search, setSearch] = useState('');
  const shownClients = search ? clients.filter((client) => matchesSearch(client, search)) : clients;

  return (
    <div className="tw:min-w-0 tw:overflow-hidden tw:rounded-lg tw:border tw:border-border tw:bg-card tw:lg:flex-1">
      <div className="tw:border-b tw:border-border tw:bg-page tw:p-4">
        <Input data-allow-text="" leftIcon={Search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Client..." className="tw:h-8" />
        <AgeingLegend />
      </div>
      <div className="tw:max-h-[600px] tw:overflow-y-auto">
        {loading && <div className="tw:p-6 tw:text-center tw:text-[13px] tw:text-muted-foreground">Reading the ledger...</div>}
        {!loading && error && <div className="tw:p-6 tw:text-[13px] tw:text-destructive">{error}</div>}
        {!loading && !error && !clients.length && (
          <div className="tw:p-6 tw:text-center tw:text-[13px] tw:text-muted-foreground">
            Nothing outstanding from any customer as on {dayFirst(asOn)}.{note ? ` ${note}` : ''}
          </div>
        )}
        {shownClients.map((client) => (
          <ClientRow key={client.id} client={client} selected={selectedId === client.ledgerId} onSelect={() => onSelect(client.ledgerId)} />
        ))}
      </div>
    </div>
  );
}
