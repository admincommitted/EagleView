import { cn } from '@/lib/utils';
import { DateInput } from '@/components/ui';

const cssSize = (size) => (typeof size === 'number' ? `${size}px` : size);

// Of the caller's style only width and flex are kept (the box's place in its row); the box has the standard look.
export default function ModernDatePicker({ id, name, value, onChange, className, style, disabled, readOnly, required, placeholder, title }) {
  const width = cssSize(style?.width);
  const flex = style?.flex;
  return (
    <div
      title={title}
      className={cn('tw:min-w-0', width && 'tw:w-(--picker-w)', flex !== undefined && 'tw:flex-(--picker-flex)')}
      style={{ '--picker-w': width, '--picker-flex': flex }}
    >
      <DateInput
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        placeholder={placeholder}
        className={className}
      />
    </div>
  );
}
