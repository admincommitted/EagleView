import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui';

/** A titled settings block: icon + title + description, the fields, then an optional footer (Save / Test buttons). */
export function SettingsCard({ icon: Icon, title, description, actions, footer, className, bodyClassName, children }) {
  return (
    <Card className={className}>
      {(title || actions) && (
        <CardHeader className="tw:flex-wrap tw:items-start">
          <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-0.5">
            <CardTitle icon={Icon && <Icon />}>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions && <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-1.5">{actions}</div>}
        </CardHeader>
      )}
      <CardContent className={bodyClassName}>{children}</CardContent>
      {footer && <CardFooter className="tw:flex-wrap">{footer}</CardFooter>}
    </Card>
  );
}

/** The big heading at the top of a settings tab. */
export function SettingsHeading({ icon: Icon, title, description, actions, className }) {
  return (
    <div className={cn('tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3', className)}>
      <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-2.5">
        {Icon && <Icon className="tw:size-5 tw:shrink-0 tw:text-primary" />}
        <div className="tw:min-w-0">
          <h3 className="tw:m-0 tw:text-[15px] tw:font-bold tw:text-head">{title}</h3>
          {description && <p className="tw:m-0 tw:text-entry tw:text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">{actions}</div>}
    </div>
  );
}
