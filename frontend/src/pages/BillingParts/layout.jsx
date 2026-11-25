import { cn } from '@/lib/utils';
import { Section } from '@/components/ui';

/** The centred page column every billing screen sits in. */
export function BillingPage({ className, children }) {
  return <div className={cn('tw:mx-auto tw:flex tw:w-full tw:min-w-0 tw:flex-col tw:gap-4 tw:p-3 tw:md:p-6', className)}>{children}</div>;
}

/** A bordered card with an optional icon title and header actions. */
export function Panel({ icon: Icon, title, actions, className, bodyClassName, children }) {
  const heading = title && (
    <span className="tw:flex tw:items-center tw:gap-1.5 tw:text-sm">
      {Icon && <Icon className="tw:size-4 tw:text-primary" />}
      {title}
    </span>
  );
  return (
    <Section title={heading} actions={actions} bodyClassName={cn('tw:gap-3 tw:pt-2', bodyClassName)}
      className={cn('tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-3 tw:shadow-sm tw:md:p-4', className)}>
      {children}
    </Section>
  );
}
