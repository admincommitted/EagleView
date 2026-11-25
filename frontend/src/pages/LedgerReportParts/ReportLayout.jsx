import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_TONES = { primary: 'tw:bg-primary', warning: 'tw:bg-warning', success: 'tw:bg-success' };

// Printing shows only the report sheet, not the menus, the header bar or the filters.
const PRINT_ONLY_REPORT = `@media print {
  body * { visibility: hidden; }
  .printable-area, .printable-area * { visibility: visible; }
  .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
}`;

export function ReportPage({ icon: Icon, tone = 'primary', title, subtitle, actions, children }) {
  return (
    <div className="tw:mx-auto tw:flex tw:w-full tw:max-w-[1600px] tw:min-w-0 tw:flex-col tw:gap-4 tw:p-2 tw:md:p-4">
      <style>{PRINT_ONLY_REPORT}</style>
      <div className="tw:flex tw:flex-col tw:gap-3 tw:rounded-md tw:border tw:border-border tw:bg-page tw:px-4 tw:py-3 tw:print:hidden tw:lg:flex-row tw:lg:items-center tw:lg:justify-between">
        <div className="tw:flex tw:items-center tw:gap-3">
          <div className={cn('tw:flex tw:rounded-md tw:p-2 tw:text-primary-foreground', ICON_TONES[tone])}>
            <Icon className="tw:size-5" />
          </div>
          <div>
            <h2 className="tw:m-0 tw:text-lg tw:font-bold tw:text-foreground">{title}</h2>
            <span className="tw:text-[11px] tw:font-medium tw:text-muted-foreground">{subtitle}</span>
          </div>
        </div>
        {actions && <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function ReportFrame({ filters, filtersLabel = 'Parameters :', children }) {
  return (
    <div className="tw:min-w-0 tw:rounded-md tw:border tw:border-input tw:bg-card tw:shadow-sm">
      {filters && (
        <div className="tw:flex tw:flex-col tw:gap-3 tw:rounded-t-md tw:border-b tw:border-warning/30 tw:bg-warning/10 tw:px-4 tw:py-3 tw:print:hidden tw:md:flex-row tw:md:flex-wrap tw:md:items-center tw:md:gap-6">
          <span className="tw:flex tw:items-center tw:gap-2 tw:text-entry tw:font-bold tw:text-warning">
            <Filter className="tw:size-3.5" /> {filtersLabel}
          </span>
          {filters}
        </div>
      )}
      <div className="printable-area tw:min-h-[500px] tw:min-w-0 tw:rounded-b-md tw:bg-page tw:p-2 tw:md:p-4">{children}</div>
    </div>
  );
}

export function ReportSheet({ title, subtitle, period, children }) {
  return (
    <div className="tw:min-w-0 tw:rounded-sm tw:border tw:border-border tw:bg-card">
      <div className="tw:flex tw:flex-col tw:gap-2 tw:border-b-2 tw:border-foreground tw:px-5 tw:py-4 tw:sm:flex-row tw:sm:items-end tw:sm:justify-between">
        <div>
          <h1 className="tw:m-0 tw:text-xl tw:font-bold tw:text-foreground">{title}</h1>
          {subtitle && <div className="tw:mt-1 tw:text-entry tw:text-muted-foreground">{subtitle}</div>}
        </div>
        {period && (
          <div className="tw:text-entry tw:sm:text-right">
            <div className="tw:font-bold tw:text-foreground">Period</div>
            <div className="tw:text-muted-foreground">{period}</div>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

const MESSAGE_TONES = {
  muted: 'tw:text-muted-foreground',
  loading: 'tw:font-bold tw:text-primary',
  error: 'tw:text-destructive',
};

export function ReportMessage({ tone = 'muted', icon: Icon, title, children }) {
  return (
    <div className={cn('tw:flex tw:flex-col tw:items-center tw:gap-1 tw:p-10 tw:text-center tw:text-sm', MESSAGE_TONES[tone])}>
      {Icon && <Icon className="tw:mb-3 tw:size-12 tw:opacity-20" />}
      {title && <div className="tw:text-base tw:font-semibold">{title}</div>}
      {children}
    </div>
  );
}

const CARD_TONES = {
  primary: { card: 'tw:border-l-primary', value: 'tw:text-foreground' },
  success: { card: 'tw:border-l-success tw:bg-success/5', value: 'tw:text-success' },
  caution: { card: 'tw:border-l-warning/50', value: 'tw:text-warning/80' },
  warning: { card: 'tw:border-l-warning', value: 'tw:text-warning' },
  danger: { card: 'tw:border-l-destructive', value: 'tw:text-destructive' },
  dark: { card: 'tw:border-l-foreground tw:bg-foreground tw:text-background', value: 'tw:text-background' },
};

export function SummaryCard({ label, value, note, tone = 'primary', className, children }) {
  const colors = CARD_TONES[tone];
  return (
    <div className={cn('tw:flex tw:min-w-0 tw:flex-col tw:gap-1 tw:rounded-lg tw:border tw:border-l-4 tw:border-border tw:bg-card tw:p-4 tw:shadow-xs', colors.card, className)}>
      <div className="tw:text-entry tw:font-semibold tw:opacity-70">{label}</div>
      <div className={cn('tw:text-2xl tw:font-bold tw:tabular-nums', colors.value)}>{value}</div>
      {note && <div className="tw:text-[11px] tw:opacity-70">{note}</div>}
      {children}
    </div>
  );
}
