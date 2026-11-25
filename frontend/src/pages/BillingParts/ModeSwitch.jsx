import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

/** A segmented row of buttons; options: [{ value, label, icon }]. */
export default function ModeSwitch({ options, value, onChange, className }) {
  return (
    <div className={cn('tw:flex tw:flex-wrap tw:gap-1 tw:rounded-lg tw:bg-muted tw:p-1', className)}>
      {options.map(({ value: optionValue, label, icon: Icon }) => (
        <Button key={optionValue} size="lg" variant={optionValue === value ? 'default' : 'ghost'} aria-pressed={optionValue === value}
          onClick={() => onChange(optionValue)}>
          {Icon && <Icon />} {label}
        </Button>
      ))}
    </div>
  );
}
