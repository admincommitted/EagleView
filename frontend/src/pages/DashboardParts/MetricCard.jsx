import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

const TONES = {
  blue: { edge: 'tw:border-b-primary', icon: 'tw:bg-primary/10 tw:text-primary', tint: 'tw:bg-primary/5' },
  green: { edge: 'tw:border-b-success', icon: 'tw:bg-success/10 tw:text-success', tint: 'tw:bg-success/5' },
  amber: { edge: 'tw:border-b-warning', icon: 'tw:bg-warning/10 tw:text-warning', tint: 'tw:bg-warning/5' },
  red: { edge: 'tw:border-b-destructive', icon: 'tw:bg-destructive/10 tw:text-destructive', tint: 'tw:bg-destructive/5' },
  violet: { edge: 'tw:border-b-violet-500', icon: 'tw:bg-violet-500/10 tw:text-violet-500', tint: 'tw:bg-violet-500/5' },
  cyan: { edge: 'tw:border-b-cyan-500', icon: 'tw:bg-cyan-500/10 tw:text-cyan-500', tint: 'tw:bg-cyan-500/5' },
};

/** A figure with its icon and a coloured bottom edge; children are the small line under the value. tint washes the card in the tone. */
export function MetricCard({ label, value, icon: Icon, tone = 'blue', tint, valueClassName, children, className }) {
  const colors = TONES[tone];
  return (
    <Card className={cn('tw:gap-1.5 tw:border-b-4 tw:px-4 tw:py-3 tw:2xl:gap-2 tw:2xl:p-4', colors.edge, tint && colors.tint, className)}>
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-2">
        <span className="tw:pt-1 tw:text-[11px] tw:font-bold tw:tracking-wide tw:text-muted-foreground tw:uppercase">{label}</span>
        {Icon && (
          <span className={cn('tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full', colors.icon)}>
            <Icon className="tw:size-4" />
          </span>
        )}
      </div>
      <span className={cn('tw:text-2xl tw:leading-tight tw:font-extrabold tw:text-foreground tw:tabular-nums', valueClassName)}>{value}</span>
      {children && <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-1 tw:text-[11px] tw:font-semibold tw:text-muted-foreground">{children}</div>}
    </Card>
  );
}
