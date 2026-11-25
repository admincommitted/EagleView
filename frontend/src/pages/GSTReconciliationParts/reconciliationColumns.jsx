import { Badge, Button } from '@/components/ui';
import { dayFirst } from '../AdvancedReportsParts/reportFormat';

const statusVariant = (status) => {
  if (status === 'Matched') return 'success';
  if (status === 'Mismatched') return 'warning';
  return status.includes('Missing') ? 'danger' : null;
};

const rupees = (amount) => `₹ ${amount.toLocaleString()}`;

const documentDetails = (record) => [
  record.docKind,
  record.date && ` · ${dayFirst(record.date)}`,
  record.matchedOn && ` · matched on ${record.matchedOn}`,
  record.docKind !== 'Books only' && !record.itcAvailable && ' · ITC NOT available on portal',
].filter(Boolean).join('');

export const reconciliationColumns = (onOpenVoucher) => [
  { key: 'vendor', header: 'Vendor Name', className: 'tw:font-bold tw:whitespace-normal' },
  {
    key: 'invoice',
    header: 'Invoice No.',
    cell: (record) => (
      <>
        {record.invoice}
        <div className="tw:text-[10px] tw:text-muted-foreground">{documentDetails(record)}</div>
      </>
    ),
  },
  { key: 'portalAmt', header: 'Amount as per Portal', align: 'right', className: 'tw:text-primary', cell: (record) => rupees(record.portalAmt) },
  { key: 'bookAmt', header: 'Amount in ERP Books', align: 'right', className: 'tw:text-success', cell: (record) => rupees(record.bookAmt) },
  {
    key: 'diff',
    header: 'Difference',
    align: 'right',
    className: 'tw:font-bold tw:text-destructive',
    cell: (record) => (record.diff ? rupees(record.diff) : '-'),
  },
  {
    key: 'status',
    header: 'Match Status',
    align: 'center',
    cell: (record) => {
      const variant = statusVariant(record.status);
      return variant && <Badge variant={variant}>{record.status}</Badge>;
    },
  },
  {
    key: 'action',
    header: 'Action',
    align: 'center',
    cell: (record) => (
      <Button size="sm" disabled={!record.voucherId} onClick={() => onOpenVoucher(record)}
        title={record.voucherId ? `Open voucher ${record.id}` : 'Not in the books - nothing to open'}>
        {record.voucherId ? 'View voucher' : 'Not in books'}
      </Button>
    ),
  },
];
