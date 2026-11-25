import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';

const TONES = {
  success: 'tw:border-success/40 tw:bg-success/10 tw:text-success',
  error: 'tw:border-destructive/40 tw:bg-destructive/10 tw:text-destructive',
  info: 'tw:border-sky-200 tw:bg-sky-100 tw:text-sky-800',
};

/** Coloured message box (tone success | error | info); `seconds` adds a "⏱ 1.2s" chip for a timed connection test. */
export default function SettingsNotice({ tone = 'info', icon: Icon, seconds, className, children }) {
  return (
    <div className={cn('tw:flex tw:items-center tw:gap-2 tw:rounded-md tw:border tw:px-3 tw:py-2.5 tw:text-[13px] tw:font-medium', TONES[tone], className)}>
      {Icon && <Icon className="tw:size-4 tw:shrink-0" />}
      <span className="tw:min-w-0 tw:break-words">{children}</span>
      {seconds && <Badge variant={tone === 'success' ? 'success' : 'danger'} className="tw:shrink-0">⏱ {seconds}s</Badge>}
    </div>
  );
}
