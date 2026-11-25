import { Checkbox } from '@/components/ui';
import { cn } from '@/lib/utils';

export function CheckLabel({ checked, onChange, disabled, className, children }) {
  return (
    <label className={cn('tw:m-0 tw:flex tw:cursor-pointer tw:items-center tw:gap-1.5 tw:whitespace-nowrap tw:text-entry', className)}>
      <Checkbox checked={!!checked} disabled={disabled} onCheckedChange={(value) => onChange(value === true)} />
      {children}
    </label>
  );
}
