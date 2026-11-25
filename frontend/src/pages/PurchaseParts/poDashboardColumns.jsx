import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle, Eye, Send, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button } from '@/components/ui';
import ApprovalButtons from './ApprovalButtons';
import StatusBadge from './StatusBadge';
import { decisionActions } from './poDecisions';
import { actionTime, rupeesGrouped, shortTime, ukDate, vendorName } from './purchaseFormat';

const PO_STATUS_TONES = { Approved: { variant: 'success' }, Rejected: { variant: 'danger' } };
const isDecided = (po) => po.status !== 'Pending Approval' && po.status !== 'Draft';

function SubmittedCell({ po }) {
  const submitted = po.submittedAt || po.createdAt;
  return (
    <>
      <div className="tw:font-medium">{ukDate(submitted)}</div>
      <div className="tw:text-[11px] tw:text-muted-foreground">{shortTime(submitted)}</div>
    </>
  );
}

function ItemsCell({ po }) {
  const items = po.items || [];
  const firstItemName = items.length ? items[0].itemName : 'No Items';
  const moreText = items.length > 1 ? `(+${items.length - 1} more)` : '';
  return (
    <div className="tw:max-w-[220px] tw:truncate tw:text-muted-foreground" title={`${firstItemName}${moreText ? ` ${moreText}` : ''}`}>
      {firstItemName}
      {moreText && <i className="tw:ml-1">{moreText}</i>}
    </div>
  );
}

function StatusCell({ po }) {
  const approved = po.status === 'Approved';
  const RemarkIcon = approved ? CheckCircle : AlertCircle;
  const decidedAt = actionTime(po);
  return (
    <>
      {po.directorRemarks
        ? (
          <span className={cn('tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-sm tw:border tw:px-2 tw:py-1 tw:text-[11px] tw:font-bold tw:whitespace-normal tw:uppercase',
            approved ? 'tw:border-success/30 tw:bg-success/10 tw:text-success' : 'tw:border-destructive/30 tw:bg-destructive/10 tw:text-destructive')}>
            <RemarkIcon className="tw:size-3 tw:shrink-0" />
            {po.directorRemarks}
          </span>
        )
        : <StatusBadge status={po.status} tones={PO_STATUS_TONES} />}
      {decidedAt && isDecided(po) && (
        <div className="tw:mt-0.5 tw:text-[10px] tw:font-bold tw:text-muted-foreground">ON {ukDate(decidedAt)} AT {shortTime(decidedAt)}</div>
      )}
    </>
  );
}

function ActionCell({ po, canDecide, isDirector, onDecide, onResend, onDelete }) {
  return (
    <div className="tw:flex tw:flex-nowrap tw:items-center tw:justify-center tw:gap-1">
      <Button asChild size="icon" className="tw:text-primary" title="View" aria-label={`View ${po.poNumber}`}>
        <Link to={`/po-view/${po.id}`}><Eye /></Link>
      </Button>
      {canDecide && (
        <ApprovalButtons iconOnly subject={po.poNumber} className="tw:flex-nowrap tw:gap-1"
          actions={decisionActions(po, (decision) => decision.verb)} onAction={(status) => onDecide(po, status)} />
      )}
      {!isDirector && po.status === 'Pending Approval' && (
        <Button size="icon" variant="success" title="Resend to Director" aria-label={`Resend ${po.poNumber}`} onClick={() => onResend(po)}><Send /></Button>
      )}
      {!isDirector && (po.status === 'Pending Approval' || po.status === 'Draft') && (
        <Button size="icon" variant="destructive" title="Delete" aria-label={`Delete ${po.poNumber}`} onClick={() => onDelete(po)}><Trash2 /></Button>
      )}
    </div>
  );
}

export function poDashboardColumns({ firstRowNumber, ...actions }) {
  return [
    { key: 'srNo', header: 'Sr.', width: 40, cell: (po, index) => firstRowNumber + index },
    { key: 'poNumber', header: 'PO Number', cell: (po) => <Badge variant="info" className="tw:rounded-sm tw:text-[11px]">{po.poNumber}</Badge> },
    { key: 'submitted', header: 'Submitted On', cell: (po) => <SubmittedCell po={po} /> },
    { key: 'vendor', header: 'Vendor', className: 'tw:font-semibold', cell: vendorName },
    { key: 'items', header: 'Items', cell: (po) => <ItemsCell po={po} /> },
    { key: 'branch', header: 'Branch', cell: (po) => <Badge variant="outline" className="tw:rounded-sm tw:text-[11px] tw:font-normal">{po.branch}</Badge> },
    { key: 'totalAmount', header: 'Total Amount', align: 'right', className: 'tw:font-bold', cell: (po) => rupeesGrouped(po.totalAmount) },
    { key: 'status', header: 'Status', className: 'tw:min-w-[150px] tw:whitespace-normal', cell: (po) => <StatusCell po={po} /> },
    { key: 'action', header: 'Action', align: 'center', cell: (po) => <ActionCell po={po} {...actions} /> },
  ];
}
