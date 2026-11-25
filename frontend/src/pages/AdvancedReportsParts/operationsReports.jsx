import { Anchor, TrendingUp } from 'lucide-react';
import { Badge, TableCell, TableRow } from '@/components/ui';
import { accountsApi } from '../AccountsHubParts/accountsApi';
import { requestReport } from './reportRequest';
import { DASH, money } from './reportFormat';

const marginOf = (job) => (job.revenue ? Math.round((job.profit / job.revenue) * 1000) / 10 : null);

const marginVariant = (margin) => {
  if (margin > 15) return 'success';
  return margin > 0 ? 'warning' : 'danger';
};

export const profitabilityReport = {
  id: 'profitability',
  group: 'Operations',
  label: 'Shipment Profitability',
  icon: TrendingUp,
  title: 'Shipment-wise Profitability (Job Costing)',
  load: async ({ from, to }) => {
    const body = await requestReport(() => accountsApi.jobProfitabilityReport({ from, to }));
    return { rows: body.jobs || [], meta: body };
  },
  rowKey: (job) => job.jobNo,
  searchText: (job) => `${job.jobNo} ${job.lane || ''} ${job.mode || ''}`,
  amount: (job) => job.revenue,
  columns: [
    { key: 'jobNo', header: 'Job No.', className: 'tw:font-bold tw:text-primary' },
    { key: 'mode', header: 'Mode', cell: (job) => job.mode || DASH },
    { key: 'lane', header: 'Lane', cell: (job) => job.lane || DASH },
    { key: 'revenue', header: 'Total Income (₹)', align: 'right', className: 'tw:text-success', cell: (job) => money(job.revenue) },
    { key: 'cost', header: 'Total Expense (₹)', align: 'right', className: 'tw:text-destructive', cell: (job) => money(job.cost) },
    {
      key: 'profit',
      header: 'Net Profit (₹)',
      align: 'right',
      className: (job) => (job.profit < 0 ? 'tw:font-bold tw:text-destructive' : 'tw:font-bold'),
      cell: (job) => money(job.profit),
    },
    {
      key: 'margin',
      header: 'Margin %',
      align: 'center',
      cell: (job) => {
        const margin = marginOf(job);
        if (margin == null) return <span className="tw:text-[11px] tw:text-muted-foreground">no revenue booked</span>;
        return <Badge variant={marginVariant(margin)}>{margin}%</Badge>;
      },
    },
  ],
  emptyText: 'No job has both revenue and cost booked against its job number in this period. Put the job number on the sales and purchase vouchers to see it here.',
  footer: ({ unlinked }) => (unlinked && (unlinked.salesWithoutJob || unlinked.purchasesWithoutJob) ? (
    <TableRow>
      <TableCell colSpan={7} className="tw:bg-warning/10 tw:text-[11px] tw:font-normal tw:whitespace-normal tw:text-warning">
        {unlinked.salesWithoutJob} sales and {unlinked.purchasesWithoutJob} purchase voucher(s) in this period carry no job number, so they are in none of the rows above.
      </TableCell>
    </TableRow>
  ) : null),
  sheet: 'Job profitability',
  exportRow: (job) => ({
    'Job No': job.jobNo,
    Mode: job.mode || '',
    Lane: job.lane || '',
    'Revenue (INR)': job.revenue,
    'Cost (INR)': job.cost,
    'Profit (INR)': job.profit,
    'Margin %': marginOf(job) ?? '',
  }),
};

// The tonnage report is its own screen (with its own filters and export), shown inside this page.
export const tonnageReport = {
  id: 'tonnage',
  group: 'Operations',
  label: 'Tonnage / Volume Report',
  icon: Anchor,
  title: 'Tonnage Report - Air Export',
  embedded: true,
};
