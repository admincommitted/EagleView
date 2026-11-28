import { Ban, CheckCircle, Lock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

const CHIP = 'tw:inline-flex tw:h-6 tw:items-center tw:gap-1.5 tw:rounded-full tw:border tw:border-border tw:bg-background tw:px-2.5 tw:text-[11px] tw:font-semibold tw:text-foreground tw:transition-colors tw:hover:bg-accent';

/**
 * The strip under a job list: every chip shows the row colour / icon it stands for and how many listed jobs have it;
 * a click shows only those jobs, a second click (or Clear) shows all again.
 * groups: [{ name, title, items: [{ value, label, count, title, icon, iconClassName, swatchClassName }] }]
 * picked: { [group name]: value } - onPick(groupName, value | null)
 */
export function JobListLegend({ groups, picked, onPick, className }) {
  const anyPicked = Object.values(picked || {}).some(Boolean);
  return (
    <div className={cn('tw:flex tw:flex-wrap tw:items-center tw:gap-x-4 tw:gap-y-2 tw:border-t tw:border-border tw:bg-background tw:px-4 tw:py-2', className)}>
      {groups.map((group) => (
        <div key={group.name} className="tw:flex tw:flex-wrap tw:items-center tw:gap-1.5" role="group" aria-label={group.title}>
          <span className="tw:text-[10px] tw:font-bold tw:tracking-wider tw:text-muted-foreground tw:uppercase">{group.title}</span>
          {group.items.map((item) => {
            const active = picked?.[group.name] === item.value;
            const Icon = item.icon;
            return (
              <Button
                key={item.value}
                type="button"
                variant="ghost"
                aria-pressed={active}
                title={`${item.title || item.label} - click to show only these jobs`}
                onClick={() => onPick(group.name, active ? null : item.value)}
                className={cn(CHIP, active && 'tw:border-primary tw:bg-accent tw:ring-2 tw:ring-primary/30')}
              >
                {item.swatchClassName && <span className={cn('tw:size-3 tw:rounded-sm tw:border tw:border-border', item.swatchClassName)} />}
                {Icon && <Icon className={cn('tw:size-3.5', item.iconClassName)} />}
                {item.label}
                <span className="tw:text-muted-foreground">({item.count})</span>
              </Button>
            );
          })}
        </div>
      ))}
      {anyPicked && (
        <Button type="button" variant="ghost" size="sm" className="tw:h-6 tw:text-[11px]" onClick={() => groups.forEach((group) => onPick(group.name, null))}>
          <X /> Clear filter
        </Button>
      )}
    </div>
  );
}

const STATUS_ICONS = {
  locked: { icon: Lock, className: 'tw:text-destructive' },
  void: { icon: Ban, className: 'tw:text-warning' },
  received: { icon: CheckCircle, className: 'tw:text-success' },
};

/** status: 'locked' | 'void' | 'received' | anything else (no icon); title: what it means for this job */
export function JobStatusIcon({ status, title }) {
  const look = STATUS_ICONS[status];
  if (!look) return null;
  const Icon = look.icon;
  return <Icon role="img" aria-label={title} className={cn('tw:size-3.5 tw:shrink-0', look.className)}><title>{title}</title></Icon>;
}

export const STATUS_LEGEND_ICONS = STATUS_ICONS;
