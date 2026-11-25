import { AlertOctagon, MapPin, PieChart, Target, Users } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, DataTable } from '@/components/ui';
import { cn } from '@/lib/utils';
import { money, rupees } from './money';

function Panel({ title, icon, titleClassName, className, contentClassName, children }) {
  return (
    <Card className={cn('tw:shadow-sm', className)}>
      <CardHeader className="tw:justify-start tw:px-5 tw:pt-5 tw:pb-3">
        <CardTitle icon={icon} className={cn('tw:text-base tw:text-foreground tw:[&_svg]:size-5', titleClassName)}>{title}</CardTitle>
      </CardHeader>
      <CardContent className={cn('tw:px-5 tw:pb-5', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

function BarRow({ label, amount, percent, labelClassName, barClassName, color }) {
  return (
    <div>
      <div className="tw:mb-1.5 tw:flex tw:justify-between tw:gap-2 tw:text-[13px] tw:font-semibold tw:text-foreground/80">
        <span className={cn('tw:min-w-0', labelClassName)}>{label}</span>
        <span className="tw:shrink-0">{amount}</span>
      </div>
      <div className="tw:h-2.5 tw:w-full tw:overflow-hidden tw:rounded-full tw:bg-muted">
        <div
          className={cn('tw:h-full tw:w-(--bar-w) tw:rounded-full', color ? 'tw:bg-(--bar-color)' : barClassName)}
          style={{ '--bar-w': `${percent}%`, ...(color && { '--bar-color': color }) }}
        />
      </div>
    </div>
  );
}

const LANE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9'];

export function LaneProfitPanel({ lanes }) {
  const maxProfit = Math.max(1, ...lanes.map((lane) => Math.abs(lane.profit) || 0));
  return (
    <Panel title="Most Profitable Trade Lanes" icon={<MapPin className="tw:text-blue-500" />} contentClassName="tw:gap-4">
      {lanes.map((lane, index) => (
        <BarRow
          key={`${lane.lane}-${index}`}
          label={lane.lane + (lane.jobs ? ` (${lane.jobs} job${lane.jobs === 1 ? '' : 's'})` : '')}
          amount={`₹ ${(lane.profit / 100000).toFixed(1)} L`}
          percent={Math.round((Math.abs(lane.profit) / maxProfit) * 100)}
          color={LANE_COLORS[index % LANE_COLORS.length]}
        />
      ))}
    </Panel>
  );
}

export function TopClientsPanel({ clients, totalRevenue }) {
  const columns = [
    { key: 'name', header: 'Client Name', className: 'tw:font-semibold tw:text-primary' },
    { key: 'revenue', header: 'Revenue', align: 'right', cell: (client) => money(client.revenue) },
    {
      key: 'share',
      header: 'Share',
      align: 'center',
      // profit per client needs each client's job costs, known only for vouchers that carry a job number
      cell: (client) => <Badge variant="info">{totalRevenue > 0 ? `${Math.round((client.revenue / totalRevenue) * 100)}%` : '-'}</Badge>,
    },
  ];
  return (
    <Panel title="Top Performing Clients" icon={<Users className="tw:text-violet-500" />} contentClassName="tw:px-0 tw:pb-0">
      <DataTable columns={columns} rows={clients} rowKey={(client, index) => `${client.name}-${index}`} emptyText="No sales booked in this period" />
    </Panel>
  );
}

export function LossJobsPanel({ jobs, unlinked }) {
  const unlinkedNote = unlinked && (unlinked.salesWithoutJob || unlinked.purchasesWithoutJob)
    ? ` (${unlinked.salesWithoutJob} sale and ${unlinked.purchasesWithoutJob} purchase voucher(s) carry no job number, so they are not counted job-wise)`
    : '';
  const columns = [
    { key: 'jobNo', header: 'Job No.', className: 'tw:font-semibold tw:text-destructive' },
    { key: 'client', header: 'Client', cell: (job) => job.lane || job.mode || '-' },
    { key: 'revenue', header: 'Estimated Cost', align: 'right', cell: (job) => rupees(job.revenue) },
    { key: 'cost', header: 'Actual Booked Cost', align: 'right', className: 'tw:text-destructive', cell: (job) => rupees(job.cost) },
    { key: 'profit', header: 'Variance (Loss)', align: 'right', className: 'tw:font-extrabold tw:text-destructive', cell: (job) => `- ₹ ${Math.abs(job.profit).toLocaleString('en-IN')}` },
    { key: 'why', header: 'Why', className: 'tw:text-destructive', cell: () => 'Cost booked is more than the amount billed' },
    {
      key: 'action',
      header: 'Action',
      align: 'center',
      cell: (job) => (
        <Button
          variant="destructive"
          title={`Open the expense register for ${job.jobNo}`}
          onClick={() => window.open(`/reports?report=expenses&q=${encodeURIComponent(job.jobNo)}`, '_blank')}
        >
          Investigate
        </Button>
      ),
    },
  ];
  return (
    <Card className="tw:border-l-4 tw:border-l-destructive tw:shadow-sm">
      <CardHeader className="tw:flex-wrap tw:justify-start tw:px-5 tw:pt-5 tw:pb-3">
        <CardTitle icon={<AlertOctagon />} className="tw:text-base tw:text-destructive tw:[&_svg]:size-5">Revenue Leakage & Cost Overrun Alerts</CardTitle>
        <Badge variant="danger" className="tw:ml-auto tw:text-[12px]">2 Alerts Require Attention</Badge>
      </CardHeader>
      <CardContent className="tw:px-5 tw:pb-5">
        <DataTable
          columns={columns}
          rows={jobs}
          rowKey={(job, index) => `${job.jobNo}-${index}`}
          rowClassName={() => 'tw:bg-destructive/5'}
          emptyText={`No job is booked at a loss in this period${unlinkedNote}`}
        />
      </CardContent>
    </Card>
  );
}

const RISK_LEVELS = [
  { above: 60, label: 'HIGH', badge: 'danger', text: 'tw:text-destructive' },
  { above: 30, label: 'MEDIUM', badge: 'warning', text: 'tw:text-warning' },
  { above: -Infinity, label: 'LOW', badge: 'success', text: 'tw:text-success' },
];
const riskOf = (row) => RISK_LEVELS.find((level) => row.overdueDays > level.above);

const DEBTOR_COLUMNS = [
  { key: 'party', header: 'Client Name', className: 'tw:font-semibold tw:text-primary' },
  { key: 'pending', header: 'Pending Amount', align: 'right', className: 'tw:font-bold', cell: (row) => rupees(row.pending) },
  { key: 'overdueDays', header: 'Ageing (Overdue)', align: 'center', cell: (row) => <span className={cn('tw:font-bold', riskOf(row).text)}>{row.overdueDays} Days</span> },
  { key: 'risk', header: 'Risk Level', align: 'center', cell: (row) => <Badge variant={riskOf(row).badge}>{riskOf(row).label}</Badge> },
];

export function DebtorsPanel({ rows }) {
  return (
    <Panel
      title="Critical Outstanding (Top Defaulters)"
      icon={<Target />}
      titleClassName="tw:text-warning"
      className="tw:border-l-4 tw:border-l-warning"
    >
      <DataTable columns={DEBTOR_COLUMNS} rows={rows} rowKey={(row, index) => `${row.party}-${index}`} emptyText="Nothing overdue" />
    </Panel>
  );
}

const AGEING_BUCKETS = [
  { key: 'days30', label: '0 - 30 Days (Current)', text: 'tw:text-success', bar: 'tw:bg-success' },
  { key: 'days60', label: '31 - 60 Days (Due)', text: 'tw:text-yellow-500', bar: 'tw:bg-yellow-500' },
  { key: 'days90', label: '61 - 90 Days (Overdue)', text: 'tw:text-orange-500', bar: 'tw:bg-orange-500' },
  { key: 'over90', label: '90+ Days (Critical)', text: 'tw:text-destructive', bar: 'tw:bg-destructive' },
];

export function AgeingPanel({ buckets, outstanding }) {
  const total = Object.values(buckets || {}).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
  return (
    <Panel title={`Outstanding Ageing (Total: ${money(outstanding)})`} icon={<PieChart />} contentClassName="tw:gap-5">
      {AGEING_BUCKETS.map((bucket) => {
        const amount = (buckets && buckets[bucket.key]) || 0;
        const percent = total > 0 ? Math.round((amount / total) * 100) : 0;
        return (
          <BarRow
            key={bucket.key}
            label={bucket.label}
            amount={`${money(amount)} (${percent}%)`}
            percent={percent}
            labelClassName={bucket.text}
            barClassName={bucket.bar}
          />
        );
      })}
      <Button asChild size="lg" className="tw:mt-2 tw:w-full tw:bg-page tw:font-bold tw:text-primary tw:no-underline">
        <a href="/credit-control">View Full Credit Control CRM &rarr;</a>
      </Button>
    </Panel>
  );
}
