import { Badge, Button } from '@/components/ui';
import { daysWaiting } from './voucherRows';

const OVERDUE_DAYS = 7;

function WaitingBadge({ voucher }) {
  const days = daysWaiting(voucher);
  if (days <= 0) return <Badge variant="neutral">TODAY</Badge>;
  return <Badge variant={days >= OVERDUE_DAYS ? 'danger' : 'neutral'}>{days} DAY{days === 1 ? '' : 'S'}</Badge>;
}

export function voucherColumns(onReview) {
  return [
    {
      key: 'voucher', header: 'Date & Voucher',
      cell: (voucher) => (
        <>
          <div className="tw:font-bold tw:text-primary">{voucher.voucherNumber}</div>
          <div className="tw:text-[11px] tw:text-muted-foreground">{voucher.date}</div>
        </>
      ),
    },
    {
      key: 'narration', header: 'Narration & Dept', className: 'tw:whitespace-normal',
      cell: (voucher) => (
        <>
          <div className="tw:font-medium">{voucher.narration}</div>
          <div className="tw:mt-0.5 tw:text-[11px] tw:text-muted-foreground">
            {[voucher.requestedBy && `By: ${voucher.requestedBy}`, voucher.type, voucher.ledgers.join(', ')].filter(Boolean).join(' | ')}
          </div>
        </>
      ),
    },
    { key: 'amount', header: 'Amount (₹)', align: 'right', className: 'tw:font-bold', cell: (voucher) => voucher.amount.toLocaleString() },
    { key: 'waiting', header: 'Waiting', align: 'center', cell: (voucher) => <WaitingBadge voucher={voucher} /> },
    { key: 'action', header: 'Action', align: 'center', cell: (voucher) => <Button size="sm" onClick={() => onReview(voucher)}>Review</Button> },
  ];
}
