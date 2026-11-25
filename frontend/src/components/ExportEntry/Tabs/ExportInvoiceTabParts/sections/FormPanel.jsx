import { cn } from '@/lib/utils';

/** A bordered block with a thin title band (title, a short note, actions on the right). */
export function PanelBand({ title, note, noteClassName, actions, className }) {
  return (
    <div className={cn('tw:flex tw:flex-wrap tw:items-center tw:gap-x-2.5 tw:gap-y-0.5 tw:border-b tw:border-border tw:bg-accent/40 tw:px-2.5 tw:py-1 tw:text-[11.5px] tw:font-bold tw:tracking-wide tw:text-head', className)}>
      <span>{title}</span>
      {note && <small className={cn('tw:text-[11px] tw:font-semibold tw:tracking-normal tw:normal-case tw:text-muted-foreground', noteClassName)}>{note}</small>}
      {actions && <div className="tw:ml-auto tw:flex tw:items-center tw:gap-1.5">{actions}</div>}
    </div>
  );
}

export default function FormPanel({ title, note, noteClassName, actions, className, bodyClassName, children }) {
  return (
    <div className={cn('tw:min-w-0 tw:rounded-md tw:border tw:border-border tw:bg-page', className)}>
      <PanelBand title={title} note={note} noteClassName={noteClassName} actions={actions} className="tw:rounded-t-md" />
      <div className={cn('tw:flex tw:min-w-0 tw:flex-col tw:gap-1.5 tw:px-2.5 tw:py-1.5', bodyClassName)}>{children}</div>
    </div>
  );
}
