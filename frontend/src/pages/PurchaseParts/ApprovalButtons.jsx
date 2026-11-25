import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

/**
 * actions: [{ key, label, icon, variant, className }] - one button each; onAction(key).
 * iconOnly shows just the icon (the label becomes the tooltip), for a grid row.
 */
export default function ApprovalButtons({ actions, onAction, disabled, iconOnly, subject = '', size, className }) {
  return (
    <div className={cn('tw:flex tw:flex-wrap tw:items-center tw:gap-1.5', className)}>
      {actions.map(({ key, label, icon: Icon, variant, className: buttonClassName }) => (
        <Button key={key} variant={variant} size={iconOnly ? 'icon' : size} disabled={disabled} className={buttonClassName}
          title={iconOnly ? label : undefined} aria-label={iconOnly ? `${label} ${subject}`.trim() : undefined}
          onClick={() => onAction(key)}>
          {Icon && <Icon />}
          {!iconOnly && label}
        </Button>
      ))}
    </div>
  );
}
