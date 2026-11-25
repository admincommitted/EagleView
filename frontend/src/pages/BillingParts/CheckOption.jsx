import { useId } from 'react';
import { cn } from '@/lib/utils';
import { Checkbox, Label } from '@/components/ui';

/** A tick box with a bold label and an optional explanation line under it. */
export default function CheckOption({ checked, onCheckedChange, label, description, icon: Icon, className, labelClassName }) {
  const id = useId();
  return (
    <div className={cn('tw:flex tw:items-start tw:gap-2', className)}>
      <Checkbox id={id} checked={checked} onCheckedChange={(next) => onCheckedChange(next === true)} className="tw:mt-0.5" />
      <Label htmlFor={id} className="tw:flex-col tw:items-start tw:gap-0.5 tw:whitespace-normal tw:cursor-pointer">
        <span className={cn('tw:flex tw:items-center tw:gap-1.5 tw:font-semibold', labelClassName)}>
          {Icon && <Icon className="tw:size-3.5" />}
          {label}
        </span>
        {description && <span className="tw:text-[11px] tw:normal-case tw:text-muted-foreground">{description}</span>}
      </Label>
    </div>
  );
}
