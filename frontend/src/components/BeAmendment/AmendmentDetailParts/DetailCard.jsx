import { cn } from '@/lib/utils';

export default function DetailCard({ title, note, actions, className, children }) {
  return (
    <div className={cn('tw:flex tw:min-w-0 tw:flex-col tw:gap-2 tw:rounded-md tw:border tw:border-border tw:bg-card tw:px-3 tw:py-2.5', className)}>
      {title && (
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          <b className="tw:text-entry tw:text-foreground">{title}</b>
          {note && <span className="tw:text-muted-foreground">{note}</span>}
          {actions && <div className="tw:ml-auto tw:flex tw:flex-wrap tw:gap-1.5">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
