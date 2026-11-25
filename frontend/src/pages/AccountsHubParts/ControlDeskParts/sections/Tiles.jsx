import { cn } from '@/lib/utils';

const COLUMNS = { 4: 'tw:lg:grid-cols-4', 5: 'tw:lg:grid-cols-5', 6: 'tw:lg:grid-cols-6', 7: 'tw:lg:grid-cols-7' };

// figure boxes in a row; with onPick a click picks (or un-picks) the box. item: { key, label, value, tone (text colour class), sub }
export default function Tiles({ items, active, onPick }) {
  return (
    <div className={cn('tw:grid tw:grid-cols-2 tw:gap-2', COLUMNS[items.length])}>
      {items.map((item) => {
        const on = active === item.key;
        return (
          <div key={item.key} onClick={() => onPick && onPick(on ? '' : item.key)}
            className={cn('tw:min-w-0 tw:rounded-lg tw:border tw:px-3 tw:py-2', onPick && 'tw:cursor-pointer', on ? 'tw:border-head tw:bg-primary/10' : 'tw:border-border tw:bg-card')}>
            <div className="tw:truncate tw:text-[10px] tw:font-extrabold tw:tracking-wide tw:text-muted-foreground tw:uppercase">{item.label}</div>
            <div className={cn('tw:text-[16px] tw:font-extrabold tw:tabular-nums', item.tone || 'tw:text-head')}>{item.value}</div>
            {item.sub && <div className="tw:text-[10.5px] tw:text-muted-foreground">{item.sub}</div>}
          </div>
        );
      })}
    </div>
  );
}
