import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

/** buttons: [{ label, icon, variant, title, onClick }]; children are shown before the buttons. */
export default function ActionButtonRow({ buttons, className, children }) {
  return (
    <div className={cn('tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:bg-accent/40 tw:px-2.5 tw:py-1.5', className)}>
      {children}
      {buttons.map(({ label, icon: Icon, variant, onClick, title }) => (
        <Button key={label} variant={variant} title={title} onClick={() => onClick()}><Icon /> {label}</Button>
      ))}
    </div>
  );
}
