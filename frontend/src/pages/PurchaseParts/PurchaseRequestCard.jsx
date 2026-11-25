import { CheckCircle, Clock, XCircle } from 'lucide-react';
import Notice from './Notice';
import StatusBadge from './StatusBadge';
import { ukDate } from './purchaseFormat';

const STATUS_TONES = {
  APPROVED: { variant: 'success', icon: CheckCircle },
  REJECTED: { variant: 'danger', icon: XCircle },
};
const PENDING = { variant: 'warning', icon: Clock, label: 'PENDING' };

export default function PurchaseRequestCard({ request }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded-md tw:border tw:border-border tw:p-3">
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-2">
        <div className="tw:min-w-0">
          <b className="tw:text-sm tw:text-foreground">{request.itemName}</b>
          <div className="tw:text-[11px] tw:text-muted-foreground">₹{request.amount} | For: {request.intendedUser}</div>
        </div>
        <StatusBadge status={request.status} tones={STATUS_TONES} fallback={PENDING} />
      </div>
      {request.status === 'REJECTED' && request.rejectionReason && (
        <Notice tone="danger" className="tw:border-dashed"><span><b>Reason:</b> {request.rejectionReason}</span></Notice>
      )}
      {request.status === 'APPROVED' && (
        <div className="tw:text-[11px] tw:text-success">Approved by {request.approvedBy} on {ukDate(request.approvedAt)}</div>
      )}
    </div>
  );
}
