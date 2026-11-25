import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui';

/** A suggestion list under a box or button; the screen keeps the open state and the highlighted row. */
export function DropList({ open, onClose, anchor, className, anchorClassName, children }) {
  const anchorRef = useRef(null);
  return (
    <Popover open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose?.(); }}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className={cn('tw:relative tw:flex tw:min-w-0', anchorClassName)}>{anchor}</div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={2}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => { if (anchorRef.current?.contains(event.target)) event.preventDefault(); }}
        className={cn('tw:max-h-[220px] tw:overflow-y-auto tw:p-0 tw:normal-case', className)}
      >
        <div role="listbox">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

export function DropItem({ active, disabled, title, onPick, onHover, onLeave, className, children }) {
  const itemRef = useRef(null);
  useEffect(() => {
    if (active) itemRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);
  return (
    <div
      ref={itemRef}
      role="option"
      aria-selected={Boolean(active)}
      aria-disabled={disabled || undefined}
      title={title}
      onMouseDown={onPick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={cn(
        'tw:cursor-pointer tw:border-b tw:border-border/60 tw:px-2 tw:py-1.5 tw:text-entry tw:hover:bg-accent',
        active && 'tw:bg-accent tw:text-accent-foreground',
        disabled && 'tw:cursor-not-allowed tw:opacity-60',
        className
      )}
    >
      {children}
    </div>
  );
}

export function DropEmpty({ children }) {
  return <div className="tw:px-3 tw:py-2 tw:text-center tw:text-entry tw:italic tw:text-muted-foreground">{children}</div>;
}
