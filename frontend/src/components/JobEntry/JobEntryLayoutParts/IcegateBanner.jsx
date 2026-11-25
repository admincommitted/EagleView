import { CheckCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

const TONES = {
  success: { Icon: CheckCircle, className: 'tw:border-success/30 tw:bg-success/10 tw:text-success' },
  error: { Icon: X, className: 'tw:border-destructive/40 tw:bg-destructive/10 tw:text-destructive' },
};

export default function IcegateBanner({ tone, title, onClose, children }) {
  const { Icon, className } = TONES[tone];
  return (
    <div className={cn('tw:mb-1.5 tw:flex tw:items-center tw:justify-between tw:rounded-md tw:border tw:px-3 tw:py-2', className)}>
      <div className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:gap-2 tw:text-[11px]">
        <Icon className="tw:size-3.5" />
        <span className="tw:font-semibold">{title}</span>
        {children}
      </div>
      <Button variant="ghost" size="icon-sm" className="tw:text-current" aria-label="Close" onClick={onClose}><X /></Button>
    </div>
  );
}
