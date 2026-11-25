import { cn } from '@/lib/utils';

const TONE_CLASS = {
  success: 'tw:border-success/30 tw:bg-success/10 tw:text-success',
  danger: 'tw:border-destructive/30 tw:bg-destructive/10 tw:text-destructive',
  warning: 'tw:border-warning/30 tw:bg-warning/10 tw:text-warning',
  info: 'tw:border-border tw:bg-page tw:text-head',
};

/** A coloured message strip; `title` is the bold first line, `children` the rest. */
export default function Notice({ tone = 'info', icon: Icon, title, children, className }) {
  return (
    <div className={cn('tw:flex tw:gap-2 tw:rounded-md tw:border tw:px-3 tw:py-2 tw:text-entry tw:normal-case', TONE_CLASS[tone], className)}>
      {Icon && <Icon className="tw:mt-px tw:size-4 tw:shrink-0" />}
      <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
        {title && <b>{title}</b>}
        {children}
      </div>
    </div>
  );
}
