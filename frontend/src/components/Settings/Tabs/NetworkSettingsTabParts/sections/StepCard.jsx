import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { cn } from '@/lib/utils';

export default function StepCard({ icon: Icon, title, note, aside, className, children }) {
  return (
    <Card className={cn('tw:bg-page', className)}>
      <CardHeader className="tw:flex-wrap tw:justify-start tw:pt-3">
        <CardTitle icon={Icon && <Icon className="tw:text-primary" />} className="tw:uppercase tw:tracking-wide">{title}</CardTitle>
        {note && <span className="tw:text-[10px] tw:font-normal tw:text-muted-foreground tw:normal-case">{note}</span>}
        {aside && <div className="tw:ml-auto tw:flex tw:items-center tw:gap-1.5">{aside}</div>}
      </CardHeader>
      <CardContent className="tw:gap-3 tw:pb-4">{children}</CardContent>
    </Card>
  );
}
