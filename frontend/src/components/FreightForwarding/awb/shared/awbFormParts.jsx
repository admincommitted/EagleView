import { cn } from '@/lib/utils';
import { Button, Checkbox, Label } from '@/components/ui';

export function LinkButton({ className, tone, ...props }) {
  return (
    <Button
      variant="link"
      size="sm"
      className={cn('tw:h-auto tw:text-[11px]', tone === 'danger' && 'tw:text-destructive', className)}
      {...props}
    />
  );
}

/** Red "must fill" line round a box that has no `required` prop of its own (FieldAutocomplete / CustomAutocomplete). */
export function RequiredBox({ required, className, children }) {
  return (
    <div data-required={required ? 'true' : undefined} className={cn('tw:flex tw:w-full tw:min-w-0', required && 'tw:[&_input]:border-required-line', className)}>
      {children}
    </div>
  );
}

export function PillCheck({ label, checked, onCheckedChange }) {
  return (
    <Label className="tw:cursor-pointer tw:gap-1.5 tw:rounded-full tw:border tw:border-input tw:bg-background tw:px-2 tw:py-px tw:text-[11px] tw:font-semibold">
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
      {label}
    </Label>
  );
}
