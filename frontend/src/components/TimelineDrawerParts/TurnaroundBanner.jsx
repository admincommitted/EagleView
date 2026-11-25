import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';

const STATES = {
  cleared: { className: 'tw:bg-success/10 tw:border-success/25 tw:text-success', badge: 'success', label: 'CLEARED' },
  delayed: { className: 'tw:bg-destructive/10 tw:border-destructive/25 tw:text-destructive', badge: 'danger', label: 'DELAYED' },
  running: { className: 'tw:bg-warning/10 tw:border-warning/25 tw:text-warning', badge: 'warning', label: 'IN PROGRESS' },
};

export default function TurnaroundBanner({ turnaround }) {
  const look = STATES[turnaround.state];
  return (
    <div className={cn('tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:px-4 tw:py-2', look.className)}>
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <Clock className="tw:size-3.5" />
        <span className="tw:text-[11px] tw:font-semibold tw:uppercase">{turnaround.title}</span>
        <span className="tw:text-[13px] tw:font-bold">{turnaround.elapsed}</span>
      </div>
      <Badge variant={look.badge}>{look.label}</Badge>
    </div>
  );
}
