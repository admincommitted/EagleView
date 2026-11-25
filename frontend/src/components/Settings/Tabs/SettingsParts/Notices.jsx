import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONES = {
  success: 'tw:border-success/40 tw:bg-success/10 tw:text-success',
  error: 'tw:border-destructive/40 tw:bg-destructive/5 tw:text-destructive',
  warning: 'tw:border-warning/40 tw:bg-warning/10 tw:text-warning',
  neutral: 'tw:border-border tw:bg-page tw:text-muted-foreground',
};

const TONE_ICONS = { success: CheckCircle, error: XCircle, warning: AlertTriangle };

/** An inline coloured line (saved / failed / a hint). `icon={false}` hides the icon. */
export function StatusBanner({ tone = 'success', icon, className, children }) {
  const Icon = icon === false ? null : icon || TONE_ICONS[tone];
  return (
    <div className={cn('tw:flex tw:items-start tw:gap-2 tw:rounded-md tw:border tw:px-3 tw:py-2 tw:text-entry tw:font-semibold', TONES[tone], className)}>
      {Icon && <Icon className="tw:mt-px tw:size-4 tw:shrink-0" />}
      <div className="tw:min-w-0 tw:flex-1">{children}</div>
    </div>
  );
}

/** The message box in the top-right corner, drawn on <body> so the top bar does not hide it. */
export function CornerToast({ notice }) {
  if (!notice) return null;
  return createPortal(
    <StatusBanner tone={notice.type === 'error' ? 'error' : 'success'}
      className="tw:fixed tw:top-20 tw:right-4 tw:z-[100000] tw:max-w-[calc(100vw-2rem)] tw:px-4 tw:py-3 tw:shadow-md tw:md:max-w-[520px]">
      {notice.msg}
    </StatusBanner>,
    document.body,
  );
}
