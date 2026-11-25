import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Field, Input } from '@/components/ui';

export const TWO_PANE = 'tw:grid tw:grid-cols-1 tw:items-start tw:gap-3 tw:lg:grid-cols-[minmax(260px,330px)_minmax(0,1fr)]';
export const GRID_2 = 'tw:grid tw:grid-cols-1 tw:gap-2.5 tw:sm:grid-cols-2';
export const GRID_3 = 'tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-3';
export const GRID_4 = 'tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2 tw:lg:grid-cols-4';
const SPAN = { 2: 'tw:sm:col-span-2', 4: 'tw:sm:col-span-2 tw:lg:col-span-4' };

// label over its box; span = columns taken on the wider grids
export function FormField({ label, required, hint, span, className, children }) {
  return <Field label={label} required={required} note={hint} layout="col" className={cn(SPAN[span], className)}>{children}</Field>;
}

export function Stat({ label, children }) {
  return (
    <div className="tw:min-w-0">
      <div className="tw:text-[10px] tw:font-extrabold tw:text-muted-foreground tw:uppercase">{label}</div>
      <div className="tw:mt-px tw:text-[13px] tw:font-extrabold tw:text-foreground">{children}</div>
    </div>
  );
}

// the list on the left of a master screen
export function ListPanel({ title, count, search, onSearch, children, tools, placeholder = 'Search' }) {
  return (
    <div className="tw:flex tw:max-h-[calc(100vh-190px)] tw:min-h-0 tw:flex-col tw:rounded-lg tw:border tw:border-border tw:bg-card tw:lg:sticky tw:lg:top-2">
      <div className="tw:flex tw:items-center tw:gap-1.5 tw:border-b tw:border-border tw:px-2.5 tw:py-2">
        <span className="tw:text-[11px] tw:font-extrabold tw:tracking-wider tw:text-head tw:uppercase">{title}</span>
        <span className="tw:ml-auto tw:text-[10.5px] tw:text-muted-foreground">{count}</span>
      </div>
      <div className="tw:flex tw:flex-col tw:gap-1.5 tw:border-b tw:border-border tw:p-2">
        <Input data-allow-text leftIcon={Search} value={search} onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} />
        {tools}
      </div>
      <div className="tw:flex-1 tw:overflow-y-auto">{children}</div>
    </div>
  );
}

export const listRowClass = (on) => cn('tw:cursor-pointer tw:border-b tw:border-l-[3px] tw:border-b-border/40 tw:px-2.5 tw:py-1.5', on ? 'tw:border-l-primary tw:bg-primary/10' : 'tw:border-l-transparent');
