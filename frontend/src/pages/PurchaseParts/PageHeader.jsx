import { cn } from '@/lib/utils';

export default function PageHeader({ icon: Icon, title, subtitle, actions, className }) {
  return (
    <div className={cn('tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between', className)}>
      <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-2.5">
        {Icon && (
          <span className="tw:flex tw:size-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:bg-primary tw:text-primary-foreground">
            <Icon className="tw:size-5" />
          </span>
        )}
        <div className="tw:min-w-0">
          <h2 className="tw:m-0 tw:text-base tw:font-bold tw:normal-case tw:text-foreground">{title}</h2>
          {subtitle && <p className="tw:m-0 tw:text-[11px] tw:normal-case tw:text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">{actions}</div>}
    </div>
  );
}
