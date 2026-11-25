import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';

const STATUS_VARIANT = {
  Draft: 'neutral',
  Ready: 'info',
  Submitted: 'warning',
  Accepted: 'success',
  Rejected: 'danger',
  Void: 'neutral',
};

export default function StatusChip({ status }) {
  return (
    <Badge variant={STATUS_VARIANT[status] || 'neutral'} className={cn('tw:text-[11px] tw:normal-case', status === 'Void' && 'tw:line-through tw:opacity-70')}>
      {status}
    </Badge>
  );
}
