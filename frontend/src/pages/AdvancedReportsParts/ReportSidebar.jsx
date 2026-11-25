import { cn } from '@/lib/utils';
import { Button, Card } from '@/components/ui';
import { REPORT_GROUPS, REPORTS } from './reports';

export default function ReportSidebar({ activeId, onSelect }) {
  return (
    <Card className="tw:gap-1 tw:py-4">
      {REPORT_GROUPS.map((group, index) => (
        <div key={group} className="tw:flex tw:flex-col tw:gap-1">
          <div className={cn('tw:px-4 tw:pb-2 tw:text-[11px] tw:font-bold tw:tracking-widest tw:uppercase tw:text-muted-foreground/70', index > 0 && 'tw:pt-3')}>
            {group}
          </div>
          {REPORTS.filter((report) => report.group === group).map(({ id, icon: Icon, label }) => (
            <Button
              key={id}
              variant="ghost"
              size="block"
              onClick={() => onSelect(id)}
              className={cn(
                'tw:gap-2.5 tw:rounded-none tw:rounded-r-md tw:border-0 tw:border-l-[3px] tw:border-l-transparent tw:px-4 tw:py-3 tw:text-sm tw:normal-case tw:text-muted-foreground',
                id === activeId && 'tw:border-l-primary tw:bg-primary/10 tw:font-bold tw:text-head',
              )}
            >
              <Icon className="tw:size-[18px]" /> {label}
            </Button>
          ))}
        </div>
      ))}
    </Card>
  );
}
