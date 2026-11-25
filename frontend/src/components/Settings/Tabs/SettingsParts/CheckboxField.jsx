import { useId } from 'react';
import { cn } from '@/lib/utils';
import { Checkbox, Label } from '@/components/ui';

/** A tick box with its label (and an optional line under it); onCheckedChange gets true / false. */
export function CheckboxField({ label, note, checked, onCheckedChange, disabled, title, className, labelClassName }) {
  const id = useId();
  return (
    <div className={cn('tw:flex tw:items-start tw:gap-2', className)} title={title}>
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(value) => onCheckedChange(value === true)} className="tw:mt-px" />
      {(label || note) && (
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-0.5">
          {label && <Label htmlFor={id} className={cn('tw:cursor-pointer tw:whitespace-normal tw:font-semibold', labelClassName)}>{label}</Label>}
          {note && <p className="tw:m-0 tw:text-[11px] tw:leading-4 tw:text-muted-foreground">{note}</p>}
        </div>
      )}
    </div>
  );
}
