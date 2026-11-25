import { cn } from '@/lib/utils';
import { Checkbox, Label } from '@/components/ui';
import { codesOf } from '../statusOptions';

const TONES = {
  danger: { title: 'tw:text-destructive', dot: 'tw:bg-destructive', box: 'tw:border-destructive/40 tw:bg-destructive/5', item: 'tw:border-destructive/25' },
  success: { title: 'tw:text-success', dot: 'tw:bg-success', box: 'tw:border-success/40 tw:bg-success/5', item: 'tw:border-success/25' },
};

// ticks the other statuses of the module into a "CODE_A, CODE_B" list (disables / enables)
export default function LinkedStatusPicker({ title, tone, statuses, value, onToggle }) {
  const colours = TONES[tone];
  const linked = codesOf(value);
  return (
    <div className="tw:flex tw:flex-col tw:gap-1">
      <span className={cn('tw:flex tw:items-center tw:gap-1.5 tw:text-entry tw:font-bold', colours.title)}>
        <span className={cn('tw:size-2 tw:rounded-full', colours.dot)} /> {title}
      </span>
      <div className={cn('tw:grid tw:h-40 tw:grid-cols-1 tw:content-start tw:gap-2 tw:overflow-y-auto tw:rounded-md tw:border tw:p-2.5 tw:sm:grid-cols-2', colours.box)}>
        {statuses.map((status) => (
          <Label key={status.code} className={cn('tw:flex tw:cursor-pointer tw:items-center tw:gap-1.5 tw:rounded-sm tw:border tw:bg-card tw:px-2 tw:py-1 tw:text-[11px]', colours.item, colours.title)}>
            <Checkbox checked={linked.includes(status.code)} onCheckedChange={(checked) => onToggle(status.code, checked === true)} />
            {status.code}
          </Label>
        ))}
        {statuses.length === 0 && <span className={cn('tw:text-[11px] tw:sm:col-span-2', colours.title)}>No other statuses available</span>}
      </div>
    </div>
  );
}
