import { cn } from '@/lib/utils';

const TONE_CLASS = { muted: 'tw:font-normal tw:text-muted-foreground', danger: 'tw:font-normal tw:text-destructive' };

/** rows: [{ label, value, tone: 'muted' | 'danger', grand }]; the grand row is the big ruled total. */
export default function TotalsPanel({ rows, className, children }) {
  return (
    <div className={cn('tw:flex tw:min-w-0 tw:flex-col tw:gap-2', className)}>
      {rows.map((row) => (
        <div key={row.label}
          className={cn('tw:flex tw:justify-between tw:gap-4 tw:text-entry tw:font-semibold tw:text-foreground',
            row.grand && 'tw:mt-1 tw:border-t-2 tw:border-border tw:pt-2 tw:text-lg tw:font-black', TONE_CLASS[row.tone])}>
          <span>{row.label}</span>
          <span className="tw:tabular-nums">{row.value}</span>
        </div>
      ))}
      {children}
    </div>
  );
}
