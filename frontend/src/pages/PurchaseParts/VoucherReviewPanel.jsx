import { CheckCircle, CornerUpLeft, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Card, CardContent, CardHeader, CardTitle, Field, Textarea } from '@/components/ui';
import ApprovalButtons from './ApprovalButtons';
import DetailList from './DetailList';

const SECOND_LINE_ACTIONS = [
  { key: 'Return', label: 'Return to Maker', icon: CornerUpLeft, variant: 'warning', className: 'tw:flex-1' },
  { key: 'Reject', label: 'Reject', icon: XCircle, variant: 'destructive', className: 'tw:flex-1' },
];

/** onAction('Approve' | 'Return' | 'Reject') */
export default function VoucherReviewPanel({ voucher, remarks, onRemarks, onAction, className }) {
  const details = [
    { label: 'Type', value: voucher.type },
    { label: 'Amount', value: `₹ ${voucher.amount.toLocaleString()}`, valueClassName: 'tw:text-sm tw:text-warning' },
    { label: 'Requested By', value: voucher.requestedBy },
    { label: 'Ledgers', value: voucher.ledgers.join(', ') || '-' },
    { label: 'Narration', value: voucher.narration, wide: true, valueClassName: 'tw:rounded-sm tw:border tw:border-border tw:bg-page tw:p-2 tw:font-normal' },
  ];
  return (
    <Card className={cn('tw:border-t-4 tw:border-t-primary', className)}>
      <CardHeader className="tw:border-b tw:border-border"><CardTitle>Review Voucher: {voucher.voucherNumber}</CardTitle></CardHeader>
      <CardContent className="tw:gap-5 tw:pt-3">
        <DetailList items={details} />
        <Field label="Manager Remarks (Required for Reject/Return)" layout="col">
          <Textarea rows={3} data-allow-text="" placeholder="Add your comments here..." value={remarks} onChange={(event) => onRemarks(event.target.value)} />
        </Field>
        <div className="tw:flex tw:flex-col tw:gap-3">
          <Button variant="success" size="lg" onClick={() => onAction('Approve')}><CheckCircle /> Approve Voucher</Button>
          <ApprovalButtons actions={SECOND_LINE_ACTIONS} onAction={onAction} size="lg" className="tw:flex-nowrap tw:gap-3" />
        </div>
      </CardContent>
    </Card>
  );
}
