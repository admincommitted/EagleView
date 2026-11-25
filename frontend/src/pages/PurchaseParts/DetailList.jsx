import { cn } from '@/lib/utils';

/**
 * Read-only "label: value" pairs. items: [{ label, value, wide, valueClassName }] - `wide` takes the whole row.
 */
export default function DetailList({ items, className }) {
  return (
    <dl className={cn('tw:m-0 tw:grid tw:grid-cols-1 tw:gap-x-4 tw:gap-y-2 tw:sm:grid-cols-2', className)}>
      {items.map((item) => (
        <div key={item.label} className={cn('tw:flex tw:min-w-0 tw:flex-col tw:gap-0.5', item.wide && 'tw:sm:col-span-full')}>
          <dt className="tw:text-[11px] tw:text-muted-foreground">{item.label}</dt>
          <dd className={cn('tw:m-0 tw:text-entry tw:font-semibold tw:break-words tw:text-foreground', item.valueClassName)}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
