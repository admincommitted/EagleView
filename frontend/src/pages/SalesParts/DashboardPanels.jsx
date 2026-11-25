import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button, DataTable } from '@/components/ui';
import { cn } from '@/lib/utils';
import { inr, MONTH_NAMES } from './salesFormat';
import { Muted } from './salesWidgets';
import { Delta, Money } from './SalesMoney';
import { moneyColumn } from './dashboardColumns';

const AXIS_TEXT = '#475569';

/** A customer list (top / falling / quiet / overdue / reviews); a row opens the customer. */
export function CustomerList({ rows, columns, onOpen, emptyText }) {
  if (!rows.length) return <div className="tw:px-3 tw:py-3.5 tw:text-entry tw:text-muted-foreground">{emptyText}</div>;
  return <DataTable columns={columns} rows={rows} onRowClick={(row) => onOpen(row.id)} containerClassName="tw:max-h-[360px]" />;
}

const HEALTH_PARTS = [
  { label: 'Billing', count: (kpi) => kpi.active, color: 'tw:bg-success' },
  { label: 'Slowing', count: (kpi) => kpi.slowing, color: 'tw:bg-warning' },
  { label: 'Dormant', count: (kpi) => kpi.dormant, color: 'tw:bg-destructive' },
  { label: 'Not billed', count: (kpi) => kpi.notBilled + kpi.prospects, color: 'tw:bg-slate-300' },
];

export function HealthBar({ kpi }) {
  const parts = HEALTH_PARTS.map((part) => ({ ...part, value: part.count(kpi) }));
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
  return (
    <div>
      <div className="tw:flex tw:h-4 tw:gap-0.5 tw:overflow-hidden tw:rounded-lg tw:bg-muted">
        {parts.map((part) => part.value > 0 && (
          <div key={part.label} title={`${part.label}: ${part.value}`} className={cn('tw:w-(--part-w)', part.color)} style={{ '--part-w': `${(part.value / total) * 100}%` }} />
        ))}
      </div>
      <div className="tw:mt-1.5 tw:flex tw:flex-wrap tw:gap-3 tw:text-[11.5px] tw:text-muted-foreground">
        {parts.map((part) => (
          <span key={part.label} className="tw:inline-flex tw:items-center tw:gap-1">
            <span className={cn('tw:inline-block tw:size-2.5 tw:rounded-full', part.color)} />
            {part.label} <b className="tw:text-foreground">{part.value}</b>
          </span>
        ))}
      </div>
      <Muted className="tw:mt-1.5">Billing: a bill in the last 60 days · Slowing: 60-120 · Dormant: more than 120.</Muted>
    </div>
  );
}

const PROFILE_ITEMS = [['Contact person', 'contact'], ['Lanes (what it ships)', 'lane'], ['Industry', 'industry'], ['Potential', 'potential']];

export function ProfileCompleteness({ profile }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-2">
      {PROFILE_ITEMS.map(([label, field]) => {
        const filled = profile[field];
        const share = profile.total ? filled / profile.total : 0;
        const color = share >= 0.8 ? 'tw:bg-success' : share >= 0.4 ? 'tw:bg-warning' : 'tw:bg-destructive';
        return (
          <div key={field}>
            <div className="tw:flex tw:text-[11.5px] tw:text-muted-foreground">
              <span>{label}</span>
              <span className="tw:ml-auto tw:tabular-nums">{filled} of {profile.total}</span>
            </div>
            <div className="tw:mt-0.5 tw:h-2 tw:rounded tw:bg-muted">
              <div className={cn('tw:h-full tw:w-(--fill-w) tw:rounded', color)} style={{ '--fill-w': `${Math.max(share * 100, share > 0 ? 2 : 0)}%` }} />
            </div>
          </div>
        );
      })}
      <Muted>Customers billed this FY or last FY. Fill these on the customer to plan visits and quotations.</Muted>
    </div>
  );
}

export function BillingChart({ months, fyLabel }) {
  const data = months.map((month) => ({ ...month, cy: month.future ? null : month.cy, cyReimb: month.future ? null : month.cyReimb }));
  return (
    <div className="tw:h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="salesBillGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#1d4ed8" /></linearGradient>
            <linearGradient id="salesReimbGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e2e8f0" /><stop offset="100%" stopColor="#cbd5e1" /></linearGradient>
          </defs>
          <CartesianGrid stroke="#eef2f7" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS_TEXT }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: AXIS_TEXT }} axisLine={false} tickLine={false} width={48} tickFormatter={(value) => Math.round(value / 1e5).toLocaleString('en-IN')} />
          <Tooltip formatter={(value, name) => [value == null ? '-' : `Rs ${inr(value)}`, name]} labelStyle={{ fontWeight: 700 }} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconSize={9} />
          <Bar dataKey="cy" name={`FY ${fyLabel}`} stackId="a" fill="url(#salesBillGrad)" radius={[0, 0, 0, 0]} maxBarSize={34} />
          <Bar dataKey="cyReimb" name="Duty / DO" stackId="a" fill="url(#salesReimbGrad)" radius={[4, 4, 0, 0]} maxBarSize={34} />
          <Line dataKey="ly" name="Last FY" type="linear" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TeamTable({ team, billedTotal, monthLabel, canOpen, onOpenPerson }) {
  const rightMoney = (key, header, extra) => ({ ...moneyColumn(key, header), ...extra });
  const columns = [
    {
      key: 'name',
      header: 'Sales person',
      className: 'tw:whitespace-normal',
      cell: (person) => {
        const share = billedTotal > 0 ? Math.max(person.cy, 0) / billedTotal : 0;
        return (
          <>
            {canOpen(person)
              ? <Button variant="link" className="tw:h-auto tw:font-bold" onClick={() => onOpenPerson(String(person.id))}>{person.name}</Button>
              : <b className={person.id ? 'tw:text-foreground' : 'tw:text-warning'}>{person.name}</b>}
            <div className="tw:mt-0.5 tw:h-1 tw:w-[140px] tw:rounded-sm tw:bg-muted" title={`${Math.round(share * 100)}% of the billing`}>
              <div className="tw:h-full tw:w-(--share-w) tw:rounded-sm tw:bg-linear-to-r tw:from-blue-400 tw:to-blue-600" style={{ '--share-w': `${share * 100}%` }} />
            </div>
          </>
        );
      },
    },
    {
      key: 'customers',
      header: 'Customers',
      align: 'right',
      cell: (person) => <>{person.customers}{person.prospects ? <Muted className="tw:text-[10.5px]">+{person.prospects} prospects</Muted> : null}</>,
    },
    { key: 'active', header: 'Billing', align: 'right' },
    { key: 'quiet', header: 'Gone quiet', align: 'right', cell: (person) => <span className={person.quiet ? 'tw:text-warning' : 'tw:text-muted-foreground'}>{person.quiet}</span> },
    rightMoney('cy', 'This FY', { className: 'tw:font-bold' }),
    rightMoney('lyTo', 'Same days LY', { className: 'tw:text-muted-foreground' }),
    { key: 'growth', header: 'Change', align: 'right', cell: (person) => <Delta growth={person.growth} /> },
    moneyColumn('thisMonth', monthLabel),
    moneyColumn('outstanding', 'Outstanding'),
    { key: 'overdue', header: 'Overdue', align: 'right', cell: (person) => <span className={person.overdue > 0 ? 'tw:text-destructive' : 'tw:text-muted-foreground'}><Money amount={person.overdue} /></span> },
    { key: 'dockets', header: 'Dockets', align: 'right', cell: (person) => (person.dockets == null ? '' : person.dockets || '-') },
  ];
  return <DataTable columns={columns} rows={team} rowKey={(person) => person.id || 'none'} />;
}

export function UpcomingEvents({ events, onOpen }) {
  if (events.length === 0) {
    return <div className="tw:px-3 tw:py-3.5 tw:text-entry tw:text-muted-foreground">None coming up. Add birthdays / anniversaries on the customer's contacts.</div>;
  }
  return (
    <div className="tw:max-h-[300px] tw:overflow-auto">
      {events.map((event, index) => {
        const today = event.inDays === 0;
        return (
          <Button key={index} variant="ghost" size="block" onClick={() => onOpen(event.customerId)} className="tw:gap-2.5 tw:rounded-none tw:border-t tw:border-t-border/60 tw:px-3 tw:first:border-t-0">
            <span className={cn('tw:w-11 tw:shrink-0 tw:rounded-lg tw:py-0.5 tw:text-center', today ? 'tw:bg-success/10' : 'tw:bg-pink-600/10')}>
              <span className={cn('tw:block tw:text-base tw:font-extrabold', today ? 'tw:text-success' : 'tw:text-pink-600')}>{event.date.slice(8, 10)}</span>
              <span className="tw:block tw:text-[10px] tw:text-muted-foreground">{MONTH_NAMES[Number(event.date.slice(5, 7)) - 1]}</span>
            </span>
            <span className="tw:min-w-0">
              <b>{event.contact}</b>{event.designation ? `, ${event.designation}` : ''}{' '}
              <span className="tw:text-muted-foreground">· {event.what}{today ? ' today' : ` in ${event.inDays} day(s)`}</span>
              <span className="tw:block tw:text-[11px] tw:text-muted-foreground">{event.customer}{event.mobile ? ` · ${event.mobile}` : ''}</span>
            </span>
          </Button>
        );
      })}
    </div>
  );
}

