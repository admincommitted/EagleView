import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

export function ChoiceButton({ selected, onClick, className, children }) {
  return (
    <Button size="block" aria-pressed={selected} onClick={onClick}
      className={cn('tw:border-2', selected ? 'tw:border-primary tw:bg-primary/10' : 'tw:border-border tw:bg-card', className)}>
      {children}
    </Button>
  );
}

export function RadioDot({ selected }) {
  return (
    <span className={cn('tw:mt-0.5 tw:flex tw:size-3.5 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:border tw:border-input', selected && 'tw:border-primary')}>
      {selected && <span className="tw:size-2 tw:rounded-full tw:bg-primary" />}
    </span>
  );
}
