import { Badge, TableCell, TableRow } from '@/components/ui';
import { dayFirst, formatAmount } from '../format';
import { MessageRow, ReportCell, ReportTable, TotalsRow } from '../ReportTable';

const COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'refNo', header: 'Voucher No' },
  { key: 'billRef', header: 'Bill / Job Ref' },
  { key: 'dueDate', header: 'Due Date' },
  { key: 'pending', header: 'Pending (₹)', align: 'right' },
  { key: 'ageing', header: 'Ageing', align: 'center' },
];

const ageingVariant = (overdueDays) => {
  if (overdueDays > 30) return 'danger';
  return overdueDays > 0 ? 'warning' : 'success';
};

export default function PendingInvoicesTab({ detail }) {
  const footer = (
    <>
      <TotalsRow label="Total" span={4} cells={[{ value: formatAmount(detail.total) }, { value: '' }]} />
      <TableRow className="tw:hover:bg-transparent">
        <TableCell colSpan={COLUMNS.length} className="tw:py-2.5 tw:text-[11px] tw:font-normal tw:whitespace-normal tw:text-muted-foreground">{detail.basis}</TableCell>
      </TableRow>
    </>
  );

  return (
    <ReportTable columns={COLUMNS} footer={footer}>
      {detail.bills.map((bill) => (
        <TableRow key={bill.id}>
          <ReportCell>{dayFirst(bill.date, '—')}</ReportCell>
          <ReportCell className="tw:font-medium tw:text-primary">{bill.refNo}</ReportCell>
          <ReportCell>{[bill.billNo, bill.jobNo].filter(Boolean).join(' / ') || '—'}</ReportCell>
          <ReportCell>{dayFirst(bill.dueDate, '—')}</ReportCell>
          <ReportCell align="right" className="tw:font-semibold">{formatAmount(bill.pending)}</ReportCell>
          <ReportCell align="center">
            <Badge variant={ageingVariant(bill.overdueDays)}>{bill.overdueDays > 0 ? `${bill.overdueDays} days overdue` : 'Within terms'}</Badge>
          </ReportCell>
        </TableRow>
      ))}
      {!detail.bills.length && <MessageRow span={COLUMNS.length} className="tw:not-italic">Nothing outstanding from this customer.</MessageRow>}
    </ReportTable>
  );
}
