import { FileSpreadsheet, IndianRupee, PieChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, TableCell, TableRow } from '@/components/ui';
import { accountsApi } from '../AccountsHubParts/accountsApi';
import { requestReport } from './reportRequest';
import { DASH, dayFirst, money } from './reportFormat';

const RIGHT = 'tw:text-right tw:tabular-nums';
const NOTE = 'tw:text-[11px] tw:font-normal tw:whitespace-normal';

const taxOf = (invoice) => (invoice.cgst || 0) + (invoice.sgst || 0) + (invoice.igst || 0) + (invoice.cess || 0);

export const salesReport = {
  id: 'sales',
  group: 'Financials',
  label: 'Sales Register (Revenue)',
  icon: FileSpreadsheet,
  title: 'Sales Register (Invoice-wise)',
  load: async ({ from, to }) => {
    const body = await requestReport(() => accountsApi.gstReturnRegister({ type: 'GSTR1', startDate: from, endDate: to }));
    return { rows: body.data || [], meta: { totals: body.totals, withoutGstin: body.withoutGstin } };
  },
  rowKey: (invoice) => invoice.id,
  searchText: (invoice) => `${invoice.partyName} ${invoice.voucherNumber}`,
  amount: (invoice) => invoice.total,
  columns: [
    { key: 'date', header: 'Date', cell: (invoice) => (invoice.date ? dayFirst(invoice.date) : '') },
    { key: 'voucherNumber', header: 'Invoice No.', className: 'tw:font-bold tw:text-primary' },
    {
      key: 'partyName',
      header: 'Client',
      cell: (invoice) => invoice.partyName || <span className="tw:text-warning">no party ledger with a GSTIN on this voucher</span>,
    },
    { key: 'gstin', header: 'GSTIN', cell: (invoice) => invoice.gstin || DASH },
    { key: 'taxable', header: 'Taxable Value (₹)', align: 'right', cell: (invoice) => money(invoice.taxable) },
    {
      key: 'gst',
      header: 'GST Amt (₹)',
      align: 'right',
      cell: (invoice) => (taxOf(invoice) ? money(taxOf(invoice)) : <span className="tw:text-muted-foreground">no tax line</span>),
    },
    { key: 'total', header: 'Total Invoice (₹)', align: 'right', className: 'tw:font-bold', cell: (invoice) => money(invoice.total) },
  ],
  emptyText: 'No sales voucher in this period.',
  footer: ({ totals }) => totals && (
    <TableRow>
      <TableCell colSpan={4} className={RIGHT}>Total</TableCell>
      <TableCell className={RIGHT}>{money(totals.taxable)}</TableCell>
      <TableCell className={RIGHT}>{money(totals.cgst + totals.sgst + totals.igst + totals.cess)}</TableCell>
      <TableCell className={RIGHT}>{money(totals.total)}</TableCell>
    </TableRow>
  ),
  sheet: 'Sales register',
  exportRow: (invoice) => ({
    Date: invoice.date,
    'Invoice No': invoice.voucherNumber,
    Client: invoice.partyName,
    GSTIN: invoice.gstin,
    'Taxable (INR)': invoice.taxable,
    CGST: invoice.cgst,
    SGST: invoice.sgst,
    IGST: invoice.igst,
    Cess: invoice.cess,
    'Total (INR)': invoice.total,
    Narration: invoice.narration || '',
  }),
};

const expenseTypeVariant = (type) => {
  if (/direct/i.test(type)) return 'neutral';
  return /overhead/i.test(type) ? 'warning' : 'info';
};

export const expensesReport = {
  id: 'expenses',
  group: 'Financials',
  label: 'Expense Register',
  icon: PieChart,
  title: 'Expense & Purchase Register',
  load: async ({ from, to }) => {
    const body = await requestReport(() => accountsApi.expenseRegisterReport({ from, to }));
    return { rows: body.data || [], meta: body };
  },
  rowKey: (expense, index) => `${expense.vr}-${expense.head}-${index}`,
  searchText: (expense) => `${expense.vendor} ${expense.head} ${expense.vr}`,
  amount: (expense) => expense.amount,
  columns: [
    { key: 'date', header: 'Date', cell: (expense) => (expense.date ? dayFirst(expense.date) : '') },
    {
      key: 'vr',
      header: 'Voucher No.',
      className: 'tw:font-bold tw:text-destructive',
      cell: (expense) => (
        <>
          {expense.vr}
          {expense.jobNo && <div className="tw:text-[10px] tw:font-normal tw:text-muted-foreground">job {expense.jobNo}</div>}
        </>
      ),
    },
    { key: 'vendor', header: 'Vendor / Supplier', cell: (expense) => expense.vendor || DASH },
    { key: 'head', header: 'Expense Head' },
    {
      key: 'type',
      header: 'Category',
      cell: (expense) => <Badge variant={expenseTypeVariant(expense.type)} className="tw:rounded-sm tw:font-normal">{expense.type}</Badge>,
    },
    { key: 'amount', header: 'Amount (₹)', align: 'right', className: 'tw:font-bold', cell: (expense) => money(expense.amount) },
  ],
  emptyText: 'No purchase or payment voucher with an expense head in this period.',
  footer: ({ totals }) => totals && (
    <TableRow>
      <TableCell colSpan={5} className={RIGHT}>
        Total &nbsp;&nbsp;
        <span className={cn(NOTE, 'tw:text-muted-foreground')}>
          direct {money(totals.direct)} &middot; overhead {money(totals.overhead)}
          {totals.ungrouped ? ` · ungrouped ${money(totals.ungrouped)}` : ''}
        </span>
      </TableCell>
      <TableCell className={RIGHT}>{money(totals.all)}</TableCell>
    </TableRow>
  ),
  sheet: 'Expense register',
  exportRow: (expense) => ({
    Date: expense.date,
    'Voucher No': expense.vr,
    Kind: expense.voucherKind,
    Vendor: expense.vendor,
    'Expense Head': expense.head,
    Category: expense.type,
    'Job No': expense.jobNo,
    'Bill No': expense.refNo,
    'Amount (INR)': expense.amount,
  }),
};

const bucketVariant = (bucket) => {
  if (/Cleared|Within/.test(bucket)) return 'success';
  return /90|61/.test(bucket) ? 'danger' : 'warning';
};

function followUpCell(client) {
  if (client.lastFollowUp) {
    return (
      <>
        {dayFirst(client.lastFollowUp)}
        {client.nextPromise && <div className="tw:text-warning">promised {dayFirst(client.nextPromise)}</div>}
        {client.lastFollowUpNote && <div className="tw:text-[11px] tw:text-muted-foreground/70">{client.lastFollowUpNote}</div>}
      </>
    );
  }
  return client.pending > 0 ? <span className="tw:text-warning">never followed up</span> : DASH;
}

export const collectionReport = {
  id: 'collection',
  group: 'Financials',
  label: 'Collection & Outstanding',
  icon: IndianRupee,
  title: 'Client-wise Collection & Outstanding',
  load: async ({ from, to }) => {
    const body = await requestReport(() => accountsApi.collectionReport({ from, to, asOn: to }));
    return { rows: body.data || [], meta: body };
  },
  rowKey: (client) => client.ledgerId,
  searchText: (client) => client.client,
  amount: (client) => client.pending || client.billed,
  columns: [
    { key: 'client', header: 'Client Name', className: 'tw:font-bold' },
    { key: 'billed', header: 'Billed in period (₹)', align: 'right', cell: (client) => money(client.billed) },
    { key: 'collected', header: 'Collected (₹)', align: 'right', className: 'tw:text-success', cell: (client) => money(client.collected) },
    {
      key: 'pending',
      header: 'Pending Due (₹)',
      align: 'right',
      className: (client) => cn('tw:font-bold', client.pending > 0 ? 'tw:text-destructive' : 'tw:text-muted-foreground'),
      cell: (client) => money(client.pending),
    },
    { key: 'bucket', header: 'Ageing Bucket', cell: (client) => <Badge variant={bucketVariant(client.bucket)}>{client.bucket}</Badge> },
    {
      key: 'lastFollowUp',
      header: 'Last Follow-Up',
      className: 'tw:whitespace-normal tw:text-muted-foreground',
      cell: followUpCell,
    },
  ],
  emptyText: 'No customer billed, paid or outstanding in this period.',
  footer: ({ totals }) => totals && (
    <TableRow>
      <TableCell>Total</TableCell>
      <TableCell className={RIGHT}>{money(totals.billed)}</TableCell>
      <TableCell className={RIGHT}>{money(totals.collected)}</TableCell>
      <TableCell className={RIGHT}>{money(totals.pending)}</TableCell>
      <TableCell colSpan={2} className={cn(NOTE, 'tw:text-warning')}>
        {totals.clientsWithNoFollowUp ? `${totals.clientsWithNoFollowUp} customer(s) owe money with no follow-up logged` : ''}
      </TableCell>
    </TableRow>
  ),
  sheet: 'Collection',
  exportRow: (client) => ({
    Client: client.client,
    'Billed (INR)': client.billed,
    'Collected (INR)': client.collected,
    'Pending (INR)': client.pending,
    'Ageing bucket': client.bucket,
    'Oldest overdue days': client.oldestOverdueDays ?? '',
    'Last follow-up': client.lastFollowUp,
    'Next promise': client.nextPromise,
    Note: client.lastFollowUpNote,
  }),
};
