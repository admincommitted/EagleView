import { cn } from '@/lib/utils';

const TONES = { success: 'tw:text-success', danger: 'tw:text-destructive', warning: 'tw:text-warning', primary: 'tw:text-head' };

export function Stat({ label, value, tone, size = 'md' }) {
  return (
    <div>
      <div className="tw:text-[10px] tw:font-extrabold tw:tracking-wide tw:text-muted-foreground tw:uppercase">{label}</div>
      <div className={cn('tw:font-extrabold tw:tabular-nums', size === 'md' ? 'tw:text-base' : 'tw:text-[15px]', TONES[tone] || 'tw:text-foreground')}>{value}</div>
    </div>
  );
}

// a white bar of headline figures: items = [[label, value, tone], ...] (falsy items are left out)
export function StatStrip({ items = [], children, className }) {
  return (
    <div className={cn('tw:flex tw:flex-wrap tw:items-center tw:gap-x-8 tw:gap-y-2 tw:rounded-lg tw:border tw:border-border tw:bg-background tw:px-4 tw:py-2.5', className)}>
      {children}
      {items.filter(Boolean).map(([label, value, tone]) => <Stat key={label} label={label} value={value} tone={tone} />)}
    </div>
  );
}
